package vn.exa.importjob;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import vn.exa.common.BusinessException;

import java.time.Duration;
import java.math.BigDecimal;
import java.util.*;

@Component
@Slf4j
@RequiredArgsConstructor
public class GeminiParser {

    private final WebClient.Builder webClientBuilder;
    private final ObjectMapper objectMapper;

    @Value("${exa.gemini.api-key:}")
    private String apiKey;

    @Value("${exa.gemini.model:gemini-1.5-flash}")
    private String model;

    @Value("${exa.gemini.timeout-ms:60000}")
    private long timeoutMs;

    private static final String GEMINI_URL =
            "https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s";

    /**
     * Parse text → danh sách câu hỏi có cấu trúc.
     */
    public ParseResult parse(String rawText, String subjectHint) {
        if (apiKey == null || apiKey.isBlank() || apiKey.equals("your_gemini_api_key_here")) {
            log.warn("Gemini API key not configured — using mock parser");
            return mockParse(rawText);
        }

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
        } catch (Exception e) {
            log.error("Failed to generate questions with Gemini", e);
            throw BusinessException.badRequest("AI không tạo được câu hỏi hợp lệ: " + e.getMessage());
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
        } catch (Exception e) {
            log.error("Failed to grade essay with Gemini", e);
            throw BusinessException.badRequest("AI không chấm được câu trả lời: " + e.getMessage());
        }
    }

    private void requireConfiguredApiKey() {
        if (apiKey == null || apiKey.isBlank() || apiKey.equals("your_gemini_api_key_here")) {
            throw BusinessException.badRequest("Chưa cấu hình Gemini API key trên máy chủ");
        }
    }

    private String extractResponseText(String responseBody) throws Exception {
        JsonNode root = objectMapper.readTree(responseBody);
        JsonNode candidates = root.path("candidates");
        if (!candidates.isArray() || candidates.isEmpty()) {
            throw new IllegalStateException("AI không trả về nội dung");
        }
        return candidates.get(0).path("content").path("parts").get(0).path("text").asText();
    }

    private ParseResult parseChunk(String chunk, String subjectHint) {
        String prompt = buildPrompt(chunk, subjectHint);
        String responseBody = callGemini(prompt);

        try {
            JsonNode root = objectMapper.readTree(responseBody);
            String aiText = extractResponseText(responseBody);
            int tokens = root.path("usageMetadata").path("totalTokenCount").asInt(0);
            List<ParsedQuestion> questions = parseAiResponse(aiText);
            return new ParseResult(questions, tokens);
        } catch (Exception e) {
            log.error("Failed to parse Gemini response", e);
            throw BusinessException.badRequest("AI parse thất bại: " + e.getMessage());
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
                        "responseMimeType", "application/json"
                )
        );

        String url = String.format(GEMINI_URL, model, apiKey);

        try {
            return webClientBuilder.build()
                    .post()
                    .uri(url)
                    .contentType(MediaType.APPLICATION_JSON)
                    .bodyValue(body)
                    .retrieve()
                    .bodyToMono(String.class)
                    .timeout(Duration.ofMillis(timeoutMs))
                    .block();
        } catch (Exception e) {
            log.error("Gemini API call failed", e);
            throw BusinessException.badRequest("Không gọi được AI: " + e.getMessage());
        }
    }

    private List<ParsedQuestion> parseAiResponse(String aiText) throws Exception {
        String cleaned = aiText.trim();
        if (cleaned.startsWith("```json")) cleaned = cleaned.substring(7);
        else if (cleaned.startsWith("```")) cleaned = cleaned.substring(3);
        if (cleaned.endsWith("```")) cleaned = cleaned.substring(0, cleaned.length() - 3);

        JsonNode arr = objectMapper.readTree(cleaned.trim());
        List<ParsedQuestion> result = new ArrayList<>();

        if (!arr.isArray()) return result;

        for (JsonNode node : arr) {
            ParsedQuestion q = new ParsedQuestion();
            q.setNumber(node.path("number").asInt(0));
            q.setType(node.path("type").asText("MCQ"));
            q.setContent(node.path("content").asText(""));

            List<String> options = new ArrayList<>();
            node.path("options").forEach(o -> options.add(o.asText()));
            q.setOptions(options);

            q.setCorrectAnswer(node.path("correctAnswer").isNull()
                    ? null : node.path("correctAnswer").asText());
            q.setAnswerText(node.path("answerText").isNull()
                    ? null : node.path("answerText").asText());
            q.setDifficulty(node.path("difficulty").asText("RECOGNITION"));
            q.setExplanation(node.path("explanation").isNull()
                    ? null : node.path("explanation").asText());

            if (!q.getContent().isBlank()) result.add(q);
        }
        return result;
    }

    /**
     * Mock parser — dùng khi chưa có Gemini API key.
     */
    private ParseResult mockParse(String rawText) {
        log.info("Using mock parser — file length: {}", rawText.length());
        List<ParsedQuestion> result = new ArrayList<>();

        String[] lines = rawText.split("\n");
        int count = 0;
        for (String line : lines) {
            String trimmed = line.trim();
            if (trimmed.matches("^(Câu|Question)\\s+\\d+.*") && trimmed.length() > 10) {
                count++;
                ParsedQuestion q = new ParsedQuestion();
                q.setNumber(count);
                q.setType("MCQ");
                q.setContent(trimmed);
                q.setOptions(Arrays.asList("A. Đáp án A", "B. Đáp án B", "C. Đáp án C", "D. Đáp án D"));
                q.setCorrectAnswer("A");
                q.setDifficulty("RECOGNITION");
                q.setExplanation("[MOCK] Đây là câu hỏi tạm vì chưa cấu hình Gemini API key");
                result.add(q);
            }
        }

        if (result.isEmpty()) {
            ParsedQuestion q = new ParsedQuestion();
            q.setNumber(1);
            q.setType("ESSAY");
            q.setContent("[MOCK] Không tìm thấy câu hỏi. File có " + rawText.length() + " ký tự.");
            q.setOptions(List.of());
            q.setDifficulty("RECOGNITION");
            q.setExplanation("[MOCK] Cần cấu hình GEMINI_API_KEY để parse thật");
            result.add(q);
        }

        return new ParseResult(result, 0);
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