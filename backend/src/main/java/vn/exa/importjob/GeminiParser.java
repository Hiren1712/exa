package vn.exa.importjob;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import vn.exa.common.BusinessException;

import java.time.Duration;
import java.math.BigDecimal;
import java.util.Base64;
import java.util.*;

@Component
@Slf4j
@RequiredArgsConstructor
public class GeminiParser {

    private final WebClient.Builder webClientBuilder;
    private final ObjectMapper objectMapper;

    @Value("${exa.gemini.api-key:}")
    private String apiKey;

    @Value("${exa.gemini.model:gemini-3.6-flash}")
    private String model;

    @Value("${exa.gemini.timeout-ms:60000}")
    private long timeoutMs;

    private volatile List<String> availableFallbackModels;

    private static final String GEMINI_URL =
            "https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent";
    private static final String GEMINI_MODELS_URL =
            "https://generativelanguage.googleapis.com/v1beta/models";
    private static final int MAX_INLINE_PDF_SIZE = 15 * 1024 * 1024;
    private static final int MAX_GEMINI_RETRIES = 2;
    private static final int MAX_FALLBACK_MODELS = 2;

    public void validateConfiguration() {
        requireConfiguredApiKey();
    }

    /**
     * Parse text → danh sách câu hỏi có cấu trúc.
     */
    public ParseResult parse(String rawText, String subjectHint) {
        requireConfiguredApiKey();

        List<String> chunks = chunkText(rawText, 6000);
        List<ParsedQuestion> all = new ArrayList<>();
        int totalTokens = 0;

        for (int i = 0; i < chunks.size(); i++) {
            log.info("Parsing chunk {}/{}", i + 1, chunks.size());
            ParseResult r = parseChunk(chunks.get(i), subjectHint);
            all.addAll(r.questions());
            totalTokens += r.tokensUsed();
        }

        List<ParsedQuestion> deduped = dedupe(all);
        return new ParseResult(deduped, totalTokens);
    }

    public ParseResult parsePdf(byte[] pdfBytes, String subjectHint) {
        return processPdf(pdfBytes, subjectHint, ImportMode.EXTRACT, 10, 12);
    }

    public ParseResult processPdf(byte[] pdfBytes, String subjectHint, ImportMode mode,
                                  int questionCount, int grade) {
        return processPdf(pdfBytes, subjectHint, "", mode, questionCount, grade);
    }

    public ParseResult processPdf(byte[] pdfBytes, String subjectHint, String supplementalContent,
                                  ImportMode mode, int questionCount, int grade) {
        requireConfiguredApiKey();
        if (pdfBytes == null || pdfBytes.length == 0) {
            throw BusinessException.badRequest("Tệp PDF trống");
        }
        if (pdfBytes.length > MAX_INLINE_PDF_SIZE) {
            throw BusinessException.badRequest("PDF scan để OCR trực tiếp phải nhỏ hơn 15MB");
        }

        String prompt = sourcePrompt(subjectHint, grade, mode, questionCount)
                + (supplementalContent == null || supplementalContent.isBlank()
                ? "" : "\n\nNỘI DUNG BỔ SUNG:\n" + supplementalContent);

        Map<String, Object> pdfPart = Map.of("inline_data", Map.of(
                "mime_type", "application/pdf",
                "data", Base64.getEncoder().encodeToString(pdfBytes)));
        Map<String, Object> body = Map.of(
                "contents", List.of(Map.of("parts", List.of(
                        Map.of("text", prompt),
                        pdfPart))),
                "generationConfig", Map.of(
                        "temperature", 0.1,
                        "maxOutputTokens", 16384,
                        "responseMimeType", "application/json"));

        return parseResponse(callGemini(body));
    }

    public ParseResult processImage(byte[] imageBytes, String mimeType, String subjectHint,
                                    String supplementalContent, ImportMode mode,
                                    int questionCount, int grade) {
        requireConfiguredApiKey();
        if (imageBytes == null || imageBytes.length == 0) {
            throw BusinessException.badRequest("Tệp ảnh trống");
        }
        if (imageBytes.length > MAX_INLINE_PDF_SIZE) {
            throw BusinessException.badRequest("Ảnh gửi đến AI phải nhỏ hơn 15MB");
        }
        if (!List.of("image/png", "image/jpeg", "image/webp").contains(mimeType)) {
            throw BusinessException.badRequest("Định dạng ảnh chưa được hỗ trợ");
        }

        String prompt = sourcePrompt(subjectHint, grade, mode, questionCount)
                + (supplementalContent == null || supplementalContent.isBlank()
                ? "" : "\n\nNỘI DUNG BỔ SUNG:\n" + supplementalContent);
        Map<String, Object> imagePart = Map.of("inline_data", Map.of(
                "mime_type", mimeType,
                "data", Base64.getEncoder().encodeToString(imageBytes)));
        Map<String, Object> body = Map.of(
                "contents", List.of(Map.of("parts", List.of(Map.of("text", prompt), imagePart))),
                "generationConfig", Map.of(
                        "temperature", 0.1,
                        "maxOutputTokens", 16384,
                        "responseMimeType", "application/json"));
        return parseResponse(callGemini(body));
    }

    public ParseResult generateQuestionsFromText(String sourceText, String subject, int grade,
                                                 int questionCount, String difficulty) {
        requireConfiguredApiKey();
        if (sourceText == null || sourceText.isBlank()) {
            throw BusinessException.badRequest("Hãy nhập nội dung để AI tạo câu hỏi");
        }
        List<String> chunks = chunkText(sourceText, 6000);
        List<Integer> counts = distributeQuestionCount(chunks, questionCount);
        List<ParsedQuestion> questions = new ArrayList<>();
        int tokens = 0;
        for (int i = 0; i < chunks.size(); i++) {
            int chunkCount = counts.get(i);
            if (chunkCount == 0) continue;
            String prompt = generationPrompt(chunks.get(i), subject, grade, chunkCount, difficulty);
            ParseResult result = parseResponse(callGemini(prompt));
            questions.addAll(result.questions());
            tokens += result.tokensUsed();
        }
        List<ParsedQuestion> deduped = dedupe(questions);
        if (deduped.size() > questionCount) {
            deduped = new ArrayList<>(deduped.subList(0, questionCount));
        }
        return new ParseResult(deduped, tokens);
    }

    List<Integer> distributeQuestionCount(List<String> chunks, int questionCount) {
        if (chunks.isEmpty()) return List.of();
        List<Integer> result = new ArrayList<>(Collections.nCopies(chunks.size(), 0));
        int questionsLeft = questionCount;
        if (questionCount >= chunks.size()) {
            Collections.fill(result, 1);
            questionsLeft -= chunks.size();
        }
        for (int question = 0; question < questionsLeft; question++) {
            int bestChunk = 0;
            double bestRatio = -1;
            for (int i = 0; i < chunks.size(); i++) {
                double ratio = (double) chunks.get(i).length() / (result.get(i) + 1);
                if (ratio > bestRatio) {
                    bestRatio = ratio;
                    bestChunk = i;
                }
            }
            result.set(bestChunk, result.get(bestChunk) + 1);
        }
        return List.copyOf(result);
    }

    String generationPrompt(String sourceText, String subject, int grade, int count, String difficulty) {
        String subjectName = subject == null || subject.isBlank() ? "chưa xác định" : subject;
        String level = difficulty == null || difficulty.isBlank() ? "COMPREHENSION" : difficulty;
        return """
                Dựa CHỈ trên kiến thức, dữ kiện và nội dung nguồn dưới đây, hãy tự biên soạn đúng %d câu hỏi trắc nghiệm mới bằng tiếng Việt cho môn %s, lớp %d, độ khó %s.
                Nguồn không cần chứa câu hỏi có sẵn. Không chép nguyên văn câu hỏi nếu có; hãy kiểm tra mức độ phù hợp với nội dung nguồn, không thêm kiến thức ngoài nguồn và không bịa dữ kiện.
                Mỗi câu có đúng 4 lựa chọn, chỉ một đáp án đúng; cung cấp đáp án và giải thích ngắn.
                Định dạng công thức toán bằng $...$ (ví dụ $x^2$, $\\frac{a}{b}$, $\\sqrt{x}$).
                Định dạng công thức/phản ứng hóa học bằng $\\ce{...}$ (ví dụ $\\ce{H2O}$, $\\ce{2H2 + O2 -> 2H2O}$).
                Giữ ký hiệu sinh học, chỉ số dưới/trên, chữ Hy Lạp, đơn vị và dấu tiếng Việt chính xác.
                Trả về duy nhất JSON array theo schema:
                [{"number":1,"type":"MCQ","content":"...","options":["...","...","...","..."],"correctAnswer":"A","answerText":null,"difficulty":"%s","explanation":"..."}].
                Nếu nội dung nguồn quá ít hoặc không đủ căn cứ để tạo câu hỏi chính xác, trả về [].
                === NỘI DUNG NGUỒN ===
                %s
                === HẾT NỘI DUNG ===
                """.formatted(count, subjectName, grade, level, level, sourceText);
    }

    private String sourcePrompt(String subjectHint, int grade, ImportMode mode, int questionCount) {
        String subject = subjectHint == null || subjectHint.isBlank()
                ? "chưa xác định" : subjectHint;
        if (mode == ImportMode.GENERATE) {
            return """
                    Dựa CHỈ trên kiến thức, dữ kiện và nội dung trong tài liệu được đính kèm, hãy tự biên soạn đúng %d câu hỏi trắc nghiệm mới bằng tiếng Việt cho môn %s, lớp %d, độ khó COMPREHENSION.
                    Tài liệu không cần chứa câu hỏi có sẵn. Không thêm kiến thức ngoài nguồn, không bịa dữ kiện; mỗi câu có đúng 4 lựa chọn, chỉ một đáp án đúng, kèm giải thích ngắn.
                    Dùng $...$ cho công thức toán và $\\ce{...}$ cho công thức/phản ứng hóa học; giữ chỉ số, số mũ, đơn vị, ký hiệu sinh học và tiếng Việt chính xác.
                    Trả về duy nhất JSON array theo schema:
                    [{"number":1,"type":"MCQ","content":"...","options":["...","...","...","..."],"correctAnswer":"A","answerText":null,"difficulty":"COMPREHENSION","explanation":"..."}].
                    Nếu nguồn quá ít hoặc không đủ căn cứ để tạo câu hỏi chính xác, trả về [].
                    """.formatted(questionCount, subject, grade);
        }
        return """
                Đọc toàn bộ tài liệu đính kèm, bao gồm chữ trong ảnh scan, bảng và công thức.
                Chỉ trích xuất câu hỏi thực sự có trong tài liệu cùng đáp án được đánh dấu (nếu có).
                Không tự tạo thêm câu hỏi trong chế độ trích xuất và không đoán đáp án; nếu không có câu hỏi, trả về [].
                Môn học gợi ý: %s. Trả về duy nhất JSON array theo schema:
                [{"number":1,"type":"MCQ","content":"...","options":["...","..."],
                "correctAnswer":"A","answerText":null,"difficulty":"RECOGNITION","explanation":null}].
                type chỉ được là MCQ, TRUE_FALSE, SHORT_ANSWER hoặc ESSAY.
                difficulty chỉ được là RECOGNITION, COMPREHENSION, APPLICATION hoặc HIGH_APPLICATION.
                Giữ ký hiệu toán, hóa, sinh, chỉ số dưới/trên và đơn vị chính xác; dùng $...$ cho công thức toán và $\\ce{...}$ cho công thức hóa học. Không trả markdown hay văn bản ngoài JSON.
                """.formatted(subject);
    }

    public List<ParsedQuestion> generateQuestions(String subject, Integer grade, String topic,
                                                  Integer count, String difficulty) {
        requireConfiguredApiKey();
        String prompt = """
                Tạo %d câu hỏi trắc nghiệm chất lượng bằng tiếng Việt cho môn %s, khối %d,
                chủ đề "%s", độ khó %s. Trả về DUY NHẤT một JSON array đúng schema:
                [{"number":1,"type":"MCQ","content":"...","options":["A. ...","B. ...","C. ...","D. ..."],
                "correctAnswer":"A","answerText":null,"difficulty":"%s","explanation":"..."}].
                Đáp án phải chính xác, các lựa chọn nhiễu hợp lý; dùng $...$ cho công thức toán và $\\ce{...}$ cho công thức hóa học.
                """.formatted(count, subject, grade, topic, difficulty, difficulty);
        try {
            return parseAiResponse(extractResponseText(callGemini(prompt)));
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            log.error("Failed to generate questions with Gemini", e);
            throw BusinessException.badRequest("AI không tạo được câu hỏi hợp lệ. Vui lòng thử lại.");
        }
    }

    public EssayGrade gradeEssay(String question, String answer, String rubric, BigDecimal maxScore) {
        requireConfiguredApiKey();
        String prompt = """
                Hãy đánh giá câu trả lời tự luận theo thang điểm 0 đến %s.
                Câu hỏi: %s
                Câu trả lời của học sinh: %s
                Tiêu chí chấm: %s
                Trả về duy nhất JSON object: {"score": number, "feedback": "nhận xét ngắn bằng tiếng Việt"}.
                Không cộng điểm vượt quá thang điểm. Nếu câu trả lời bỏ trống thì cho 0 điểm.
                """.formatted(maxScore, question, answer, rubric == null || rubric.isBlank() ? "Độ chính xác, lập luận và mức độ đầy đủ." : rubric);
        try {
            JsonNode result = objectMapper.readTree(extractResponseText(callGemini(prompt)));
            BigDecimal score = new BigDecimal(result.path("score").asText());
            score = score.max(BigDecimal.ZERO).min(maxScore);
            return new EssayGrade(score, result.path("feedback").asText(""));
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            log.error("Failed to grade essay with Gemini", e);
            throw BusinessException.badRequest("AI không chấm được câu trả lời. Vui lòng thử lại.");
        }
    }

    private void requireConfiguredApiKey() {
        if (apiKey == null || apiKey.isBlank() || apiKey.equals("your_gemini_api_key_here")) {
            throw BusinessException.badRequest("Chưa cấu hình Gemini API key trên máy chủ");
        }
    }

    private String extractResponseText(String responseBody) throws Exception {
        return extractResponseText(objectMapper.readTree(responseBody));
    }

    private String extractResponseText(JsonNode root) {
        JsonNode candidates = root.path("candidates");
        if (!candidates.isArray() || candidates.isEmpty()) {
            throw new IllegalStateException("AI không trả về nội dung");
        }
        for (JsonNode part : candidates.get(0).path("content").path("parts")) {
            if (part.hasNonNull("text")) return part.path("text").asText();
        }
        throw new IllegalStateException("AI không trả về nội dung văn bản");
    }

    private ParseResult parseChunk(String chunk, String subjectHint) {
        String prompt = buildPrompt(chunk, subjectHint);
        Map<String, Object> body = Map.of(
                "contents", List.of(Map.of("parts", List.of(Map.of("text", prompt)))),
                "generationConfig", Map.of(
                        "temperature", 0.1,
                        "maxOutputTokens", 16384,
                        "responseMimeType", "application/json"));
        return parseResponse(callGemini(body));
    }

    private ParseResult parseResponse(String responseBody) {
        try {
            JsonNode root = objectMapper.readTree(responseBody);
            String aiText = extractResponseText(root);
            int tokens = root.path("usageMetadata").path("totalTokenCount").asInt(0);
            List<ParsedQuestion> questions = parseAiResponse(aiText);
            return new ParseResult(questions, tokens);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            log.error("Failed to parse Gemini response", e);
            throw BusinessException.badRequest("AI trả về dữ liệu không hợp lệ. Vui lòng thử lại.");
        }
    }

    private String buildPrompt(String chunk, String subjectHint) {
        String subjectLine = (subjectHint == null || subjectHint.isBlank())
                ? "" : "\n- Môn học (gợi ý): " + subjectHint;

        return """
                Bạn là chuyên gia số hoá đề thi Việt Nam. Nhiệm vụ: trích xuất TẤT CẢ câu hỏi
                từ văn bản đề thi dưới đây và trả về DUY NHẤT một JSON array.

                QUY TẮC:
                1. Mỗi câu hỏi là 1 object JSON:
                   - number: số thứ tự câu (int)
                   - type: "MCQ" | "TRUE_FALSE" | "SHORT_ANSWER" | "ESSAY"
                   - content: nội dung câu hỏi; công thức toán dùng $...$, công thức hóa học dùng $\\ce{...}$
                   - options: array 4 đáp án ["A. ...", "B. ...", "C. ...", "D. ..."] — chỉ với MCQ
                   - correctAnswer: "A"|"B"|"C"|"D" — nếu không có, để null
                   - answerText: đáp án SHORT_ANSWER/ESSAY
                   - difficulty: "RECOGNITION" | "COMPREHENSION" | "APPLICATION" | "HIGH_APPLICATION"
                   - explanation: giải thích (hoặc null)

                2. Giữ nguyên công thức toán trong $...$; công thức và phản ứng hóa học trong $\\ce{...}$.
                   Ví dụ: $\\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}$, $\\ce{H2SO4}$, $\\ce{2H2 + O2 -> 2H2O}$.
                   Giữ chính xác chỉ số dưới/trên, ký hiệu sinh học, chữ Hy Lạp, đơn vị và tiếng Việt.
                3. Nếu đáp án đúng có đánh dấu trong file, nhận diện.
                4. Nếu không tìm thấy câu hỏi, trả về [].
                5. KHÔNG text giải thích, KHÔNG markdown, CHỈ JSON.
                %s

                === VĂN BẢN ĐỀ THI ===
                %s
                === KẾT THÚC ===
                """.formatted(subjectLine, chunk);
    }

    private String callGemini(String prompt) {
        Map<String, Object> body = Map.of(
                "contents", List.of(Map.of("parts", List.of(Map.of("text", prompt)))),
                "generationConfig", Map.of(
                        "temperature", 0.1,
                        "maxOutputTokens", 8192,
                        "responseMimeType", "application/json"));
        return callGemini(body);
    }

    private String callGemini(Map<String, Object> body) {
        try {
            return sendGeminiRequest(model, body);
        } catch (WebClientResponseException e) {
            if (shouldTryFallbackModel(e.getStatusCode().value())) {
                List<String> fallbacks = getAvailableFallbackModels();
                WebClientResponseException lastModelError = e;
                int attemptedFallbacks = 0;
                for (String fallback : fallbacks) {
                    if (fallback.equals(normalizeModelName(model))) continue;
                    if (attemptedFallbacks >= MAX_FALLBACK_MODELS) break;
                    attemptedFallbacks++;
                    log.warn("Gemini model {} returned HTTP {}; retrying with {}",
                            normalizeModelName(model), e.getStatusCode().value(), fallback);
                    try {
                        return sendGeminiRequest(fallback, body);
                    } catch (WebClientResponseException fallbackError) {
                        if (!shouldTryFallbackModel(fallbackError.getStatusCode().value())) {
                            throw BusinessException.badRequest(userMessageForGeminiError(
                                    fallbackError.getStatusCode().value(), fallbackError.getResponseBodyAsString()));
                        }
                        lastModelError = fallbackError;
                    }
                }
                throw BusinessException.badRequest(userMessageForGeminiError(
                        lastModelError.getStatusCode().value(), lastModelError.getResponseBodyAsString()));
            }
            log.warn("Gemini API returned HTTP {}", e.getStatusCode().value());
            throw BusinessException.badRequest(
                    userMessageForGeminiError(e.getStatusCode().value(), e.getResponseBodyAsString()));
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            log.error("Gemini API call failed: {}", e.getClass().getSimpleName());
            throw BusinessException.badRequest("Không kết nối được Gemini. Vui lòng thử lại sau.");
        }
    }

    private String sendGeminiRequest(String modelName, Map<String, Object> body) {
        String url = String.format(GEMINI_URL, normalizeModelName(modelName));
        for (int attempt = 0; ; attempt++) {
            try {
                return webClientBuilder.build()
                        .post()
                        .uri(url)
                        .header("x-goog-api-key", apiKey.trim())
                        .contentType(MediaType.APPLICATION_JSON)
                        .bodyValue(body)
                        .retrieve()
                        .bodyToMono(String.class)
                        .timeout(Duration.ofMillis(timeoutMs))
                        .block();
            } catch (WebClientResponseException error) {
                if (!isTransientGeminiStatus(error.getStatusCode().value())
                        || attempt >= MAX_GEMINI_RETRIES) {
                    throw error;
                }
                long delayMs = 1000L << attempt;
                log.warn("Gemini returned HTTP {} for {}; retrying in {}ms (attempt {}/{})",
                        error.getStatusCode().value(), normalizeModelName(modelName),
                        delayMs, attempt + 1, MAX_GEMINI_RETRIES);
                try {
                    Thread.sleep(delayMs);
                } catch (InterruptedException interrupted) {
                    Thread.currentThread().interrupt();
                    throw BusinessException.badRequest("Yêu cầu xử lý AI đã bị gián đoạn. Vui lòng thử lại.");
                }
            }
        }
    }

    static boolean isTransientGeminiStatus(int statusCode) {
        return statusCode == 500 || statusCode == 502 || statusCode == 503 || statusCode == 504;
    }

    static boolean shouldTryFallbackModel(int statusCode) {
        return statusCode == 404 || isTransientGeminiStatus(statusCode);
    }

    private List<String> getAvailableFallbackModels() {
        List<String> cached = availableFallbackModels;
        if (cached != null) return cached;
        try {
            String response = webClientBuilder.build()
                    .get()
                    .uri(GEMINI_MODELS_URL)
                    .header("x-goog-api-key", apiKey.trim())
                    .retrieve()
                    .bodyToMono(String.class)
                    .timeout(Duration.ofMillis(timeoutMs))
                    .block();
            if (response == null) return List.of();
            List<String> selected = selectAvailableModels(objectMapper.readTree(response), model);
            if (!selected.isEmpty()) availableFallbackModels = selected;
            return selected;
        } catch (WebClientResponseException error) {
            throw BusinessException.badRequest(
                    userMessageForGeminiError(error.getStatusCode().value(), error.getResponseBodyAsString()));
        } catch (Exception error) {
            log.warn("Could not discover Gemini models for fallback");
            return List.of();
        }
    }

    List<String> selectAvailableModels(JsonNode response, String configuredModel) {
        List<String> available = new ArrayList<>();
        for (JsonNode candidate : response.path("models")) {
            boolean supportsGenerateContent = false;
            for (JsonNode method : candidate.path("supportedGenerationMethods")) {
                if ("generateContent".equals(method.asText())) {
                    supportsGenerateContent = true;
                    break;
                }
            }
            String name = candidate.path("name").asText("");
            if (supportsGenerateContent && name.startsWith("models/gemini-")) {
                available.add(normalizeModelName(name));
            }
        }
        if (available.isEmpty()) return List.of();

        String configured = normalizeModelName(configuredModel);
        Comparator<String> preference = Comparator
                .comparingInt(this::modelFamilyPreference)
                .thenComparing(Comparator.comparingDouble(this::modelVersion).reversed())
                .thenComparing(String::compareTo);
        List<String> stableFlash = available.stream()
                .filter(name -> !name.equals(configured))
                .filter(name -> name.contains("flash") && !name.contains("preview"))
                .sorted(preference)
                .toList();
        List<String> stableModels = available.stream()
                .filter(name -> !name.equals(configured))
                .filter(name -> !name.contains("preview"))
                .filter(name -> !stableFlash.contains(name))
                .sorted(preference)
                .toList();
        List<String> previewModels = available.stream()
                .filter(name -> !name.equals(configured))
                .filter(name -> name.contains("preview"))
                .sorted(preference)
                .toList();

        List<String> fallbacks = new ArrayList<>(stableFlash);
        fallbacks.addAll(stableModels);
        fallbacks.addAll(previewModels);
        return List.copyOf(fallbacks);
    }

    private int modelFamilyPreference(String name) {
        if (name.matches("gemini-\\d+(?:\\.\\d+)?-flash(?:-\\d+)?")) return 0;
        if (name.contains("flash")) return 1;
        return 2;
    }

    private double modelVersion(String name) {
        java.util.regex.Matcher matcher = java.util.regex.Pattern
                .compile("^gemini-(\\d+(?:\\.\\d+)?)")
                .matcher(name);
        if (matcher.find()) return Double.parseDouble(matcher.group(1));
        return 3;
    }

    private String normalizeModelName(String modelName) {
        String normalized = modelName == null ? "" : modelName.trim();
        return normalized.startsWith("models/") ? normalized.substring("models/".length()) : normalized;
    }

    String userMessageForGeminiError(int statusCode, String responseBody) {
        String reason = "";
        try {
            JsonNode error = objectMapper.readTree(responseBody).path("error");
            for (JsonNode detail : error.path("details")) {
                String detailReason = detail.path("reason").asText("");
                if (!detailReason.isBlank()) {
                    reason = detailReason;
                    break;
                }
            }
            if (reason.isBlank()) reason = error.path("status").asText("");
        } catch (JsonProcessingException ignored) {
            log.debug("Gemini error response did not contain readable error metadata");
        }

        if (statusCode == 401 || statusCode == 403 || "API_KEY_INVALID".equals(reason)) {
            if ("API_KEY_HTTP_REFERRER_BLOCKED".equals(reason)) {
                return "API key Gemini bị giới hạn theo website. Backend Railway cần key không giới hạn HTTP referrer; cập nhật giới hạn key rồi thử lại.";
            }
            if ("API_KEY_SERVICE_BLOCKED".equals(reason)) {
                return "API key chưa được phép gọi Gemini. Cho phép Generative Language API trong phần giới hạn API key của Google Cloud.";
            }
            if ("API_KEY_INVALID".equals(reason)) {
                return "Gemini không chấp nhận API key. Kiểm tra lại biến GEMINI_API_KEY trên Railway rồi redeploy backend.";
            }
            if (statusCode == 401) {
                return "Gemini không xác thực được API key. Kiểm tra lại biến GEMINI_API_KEY trên Railway rồi redeploy backend.";
            }
            return "Gemini từ chối quyền của API key. Kiểm tra giới hạn API key và quyền dùng Generative Language API.";
        }
        if (statusCode == 404) {
            return "Gemini không tìm thấy model khả dụng cho API key này. Kiểm tra quyền Generative Language API của key và thử chọn một model được liệt kê trong Google AI Studio.";
        }
        if (statusCode == 429) {
            return "Gemini đang quá tải hoặc API key đã hết hạn mức. Kiểm tra quota/billing của Google AI Studio rồi thử lại.";
        }
        if (statusCode == 503) {
            return "Gemini đang tạm thời quá tải. Hệ thống đã tự thử lại; vui lòng chờ một chút rồi thử lại.";
        }
        if (statusCode == 400) {
            return "Gemini từ chối nội dung yêu cầu. Hãy kiểm tra model, kích thước/định dạng tệp và thử một tệp nhỏ hơn.";
        }
        if (statusCode == 413) {
            return "Tệp quá lớn để gửi đến Gemini. Hãy dùng tệp nhỏ hơn.";
        }
        return "Gemini đang gặp sự cố (HTTP " + statusCode + "). Vui lòng thử lại sau.";
    }

    private List<ParsedQuestion> parseAiResponse(String aiText) throws Exception {
        String cleaned = aiText.trim();
        if (cleaned.startsWith("```json")) cleaned = cleaned.substring(7);
        else if (cleaned.startsWith("```")) cleaned = cleaned.substring(3);
        if (cleaned.endsWith("```")) cleaned = cleaned.substring(0, cleaned.length() - 3);

        JsonNode arr = objectMapper.readTree(cleaned.trim());
        List<ParsedQuestion> result = new ArrayList<>();

        if (!arr.isArray()) {
            throw new IllegalArgumentException("Gemini response must be a JSON array");
        }

        for (JsonNode node : arr) {
            ParsedQuestion q = new ParsedQuestion();
            q.setNumber(node.path("number").asInt(0));
            q.setType(normalizeQuestionType(node.path("type").asText("MCQ")));
            q.setContent(node.path("content").asText(""));

            List<String> options = new ArrayList<>();
            node.path("options").forEach(o -> options.add(
                    o.asText().replaceFirst("^\\s*[A-Da-d][.)、:]\\s*", "").trim()));
            q.setOptions(options);

            q.setCorrectAnswer(normalizeCorrectAnswer(node.path("correctAnswer").asText(null)));
            q.setAnswerText(node.path("answerText").asText(null));
            q.setDifficulty(normalizeDifficulty(node.path("difficulty").asText("RECOGNITION")));
            q.setExplanation(node.path("explanation").asText(null));

            if (!q.getContent().isBlank()) result.add(q);
        }
        return result;
    }

    private String normalizeCorrectAnswer(String answer) {
        if (answer == null || answer.isBlank()) return null;
        String normalized = answer.trim().toUpperCase(Locale.ROOT);
        if (normalized.matches("^[A-D](?:[.)、:]\\s*.*)?$")) {
            return normalized.substring(0, 1);
        }
        return answer.trim();
    }

    private String normalizeQuestionType(String type) {
        if (type == null || type.isBlank()) return "MCQ";
        return switch (type.trim().toUpperCase(Locale.ROOT)) {
            case "TRUE_FALSE", "TRUE/FALSE", "TRUE-FALSE", "TRUEFALSE" -> "TRUE_FALSE";
            case "SHORT_ANSWER", "SHORT ANSWER", "SHORT-ANSWER" -> "SHORT_ANSWER";
            case "ESSAY" -> "ESSAY";
            default -> "MCQ";
        };
    }

    private String normalizeDifficulty(String difficulty) {
        if (difficulty == null || difficulty.isBlank()) return "RECOGNITION";
        String normalized = difficulty.trim().toUpperCase(Locale.ROOT).replace(' ', '_');
        return switch (normalized) {
            case "COMPREHENSION", "APPLICATION", "HIGH_APPLICATION" -> normalized;
            default -> "RECOGNITION";
        };
    }

    private List<String> chunkText(String text, int maxChars) {
        List<String> chunks = new ArrayList<>();
        String[] lines = text.split("\n");
        StringBuilder current = new StringBuilder();

        for (String line : lines) {
            if (current.length() + line.length() > maxChars && current.length() > 0) {
                chunks.add(current.toString());
                current = new StringBuilder();
            }
            current.append(line).append("\n");
        }
        if (current.length() > 0) chunks.add(current.toString());
        return chunks;
    }

    private List<ParsedQuestion> dedupe(List<ParsedQuestion> questions) {
        Map<String, ParsedQuestion> seen = new LinkedHashMap<>();
        for (ParsedQuestion q : questions) {
            String key = normalize(q.getContent());
            seen.putIfAbsent(key, q);
        }
        return new ArrayList<>(seen.values());
    }

    private String normalize(String s) {
        return s.toLowerCase()
                .replaceAll("\\s+", " ")
                .replaceAll("[^a-z0-9àáảãạăâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]", "")
                .trim();
    }

    public record ParseResult(List<ParsedQuestion> questions, int tokensUsed) {}
    public record EssayGrade(java.math.BigDecimal score, String feedback) {}
}