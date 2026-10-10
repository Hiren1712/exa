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

    @Value("${exa.gemini.model:gemini-2.5-flash}")
    private String model;

    @Value("${exa.gemini.timeout-ms:60000}")
    private long timeoutMs;

    private static final String GEMINI_URL =
            "https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent";
    private static final int MAX_INLINE_PDF_SIZE = 15 * 1024 * 1024;

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
        requireConfiguredApiKey();
        if (pdfBytes == null || pdfBytes.length == 0) {
            throw BusinessException.badRequest("Tệp PDF trống");
        }
        if (pdfBytes.length > MAX_INLINE_PDF_SIZE) {
            throw BusinessException.badRequest("PDF scan để OCR trực tiếp phải nhỏ hơn 15MB");
        }

        String subjectLine = subjectHint == null || subjectHint.isBlank()
                ? "" : "\nMôn học gợi ý: " + subjectHint;
        String prompt = """
                Đọc toàn bộ tài liệu PDF, bao gồm cả nội dung trong ảnh scan, bảng và công thức.
                Trích xuất tất cả câu hỏi cùng đáp án được đánh dấu (nếu có). Trả về duy nhất
                JSON array theo schema:
                [{"number":1,"type":"MCQ","content":"...","options":["...","..."],
                "correctAnswer":"A","answerText":null,"difficulty":"RECOGNITION","explanation":null}].
                type chỉ được là MCQ, TRUE_FALSE, SHORT_ANSWER hoặc ESSAY.
                difficulty chỉ được là RECOGNITION, COMPREHENSION, APPLICATION hoặc HIGH_APPLICATION.
                Không tự đoán đáp án đúng nếu tài liệu không cung cấp; khi đó dùng null.
                Giữ nguyên công thức bằng LaTeX. Nếu không có câu hỏi, trả về [].
                Không trả markdown hay văn bản ngoài JSON.
                %s
                """.formatted(subjectLine);

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

    public List<ParsedQuestion> generateQuestions(String subject, Integer grade, String topic,
                                                  Integer count, String difficulty) {
        requireConfiguredApiKey();
        String prompt = """
                Tạo %d câu hỏi trắc nghiệm chất lượng bằng tiếng Việt cho môn %s, khối %d,
                chủ đề "%s", độ khó %s. Trả về DUY NHẤT một JSON array đúng schema:
                [{"number":1,"type":"MCQ","content":"...","options":["A. ...","B. ...","C. ...","D. ..."],
                "correctAnswer":"A","answerText":null,"difficulty":"%s","explanation":"..."}].
                Đáp án phải chính xác, các lựa chọn nhiễu hợp lý; nội dung toán học giữ LaTeX $...$.
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
                   - content: nội dung câu hỏi (giữ LaTeX dạng $...$)
                   - options: array 4 đáp án ["A. ...", "B. ...", "C. ...", "D. ..."] — chỉ với MCQ
                   - correctAnswer: "A"|"B"|"C"|"D" — nếu không có, để null
                   - answerText: đáp án SHORT_ANSWER/ESSAY
                   - difficulty: "RECOGNITION" | "COMPREHENSION" | "APPLICATION" | "HIGH_APPLICATION"
                   - explanation: giải thích (hoặc null)

                2. Giữ nguyên công thức LaTeX: $x^2 + 1$.
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
        String url = String.format(GEMINI_URL, model);

        try {
            return webClientBuilder.build()
                    .post()
                    .uri(url)
                    .header("x-goog-api-key", apiKey)
                    .contentType(MediaType.APPLICATION_JSON)
                    .bodyValue(body)
                    .retrieve()
                    .bodyToMono(String.class)
                    .timeout(Duration.ofMillis(timeoutMs))
                    .block();
        } catch (WebClientResponseException e) {
            log.warn("Gemini API returned HTTP {}", e.getStatusCode().value());
            throw BusinessException.badRequest(
                    userMessageForGeminiError(e.getStatusCode().value(), e.getResponseBodyAsString()));
        } catch (Exception e) {
            log.error("Gemini API call failed: {}", e.getClass().getSimpleName());
            throw BusinessException.badRequest("Không kết nối được Gemini. Vui lòng thử lại sau.");
        }
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
            return "Gemini không chấp nhận API key. Kiểm tra lại biến GEMINI_API_KEY trên Railway rồi redeploy backend.";
        }
        if (statusCode == 404) {
            return "Không tìm thấy Gemini model đang cấu hình. Kiểm tra GEMINI_MODEL trên Railway (mặc định: gemini-2.5-flash).";
        }
        if (statusCode == 429) {
            return "Gemini đang quá tải hoặc API key đã hết hạn mức. Kiểm tra quota/billing của Google AI Studio rồi thử lại.";
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