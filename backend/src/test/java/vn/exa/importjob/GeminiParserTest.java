package vn.exa.importjob;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.Test;
import org.springframework.web.reactive.function.client.WebClient;
import vn.exa.common.BusinessException;

import java.util.List;
import java.util.concurrent.TimeoutException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class GeminiParserTest {
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void parseDoesNotReturnFabricatedQuestionsWhenApiKeyIsMissing() {
        GeminiParser parser = new GeminiParser(WebClient.builder(), new ObjectMapper());

        assertThatThrownBy(() -> parser.parse("Câu 1. Nội dung câu hỏi", "Toán"))
                .isInstanceOf(BusinessException.class)
                .hasMessage("Chưa cấu hình Gemini API key trên máy chủ");
    }

    @Test
    void geminiImportKeysUsePrimaryThenNumberedSlotsInNumericOrder() {
        assertThat(GeminiParser.orderApiKeys("primary-key", java.util.Map.of(
                "gemini2", "second-key",
                "gemini10", "tenth-key",
                "GEMINI1", "first-key",
                "deep1", "unrelated-key")))
                .containsExactly("primary-key", "first-key", "second-key", "tenth-key");
    }

    @Test
    void geminiImportKeysDeduplicateValuesAndIgnorePlaceholderKeys() {
        assertThat(GeminiParser.orderApiKeys(" ", java.util.Map.of(
                "gemini1", "same-key",
                "gemini2", "same-key",
                "gemini3", "your_gemini_api_key_here")))
                .containsExactly("same-key");
    }

    @Test
    void invalidGeminiApiKeyErrorExplainsHowToFixRailwayConfiguration() {
        GeminiParser parser = new GeminiParser(WebClient.builder(), new ObjectMapper());
        String response = """
                {"error":{"code":400,"status":"INVALID_ARGUMENT","details":[
                  {"reason":"API_KEY_INVALID"}
                ]}}
                """;

        assertThat(parser.userMessageForGeminiError(400, response))
                .contains("không chấp nhận API key")
                .contains("GEMINI_API_KEY")
                .contains("redeploy");
    }

    @Test
    void quotaErrorSuggestsCheckingGoogleUsageLimits() {
        GeminiParser parser = new GeminiParser(WebClient.builder(), new ObjectMapper());

        assertThat(parser.userMessageForGeminiError(429, ""))
                .contains("quota/billing");
    }

    @Test
    void retriesOnlyTransientGeminiFailures() {
        assertThat(GeminiParser.isTransientGeminiStatus(503)).isTrue();
        assertThat(GeminiParser.isTransientGeminiStatus(500)).isTrue();
        assertThat(GeminiParser.isTransientGeminiStatus(504)).isTrue();
        assertThat(GeminiParser.isTransientGeminiStatus(429)).isFalse();
        assertThat(GeminiParser.isTransientGeminiStatus(404)).isFalse();
        assertThat(GeminiParser.isTransientGeminiStatus(403)).isFalse();
    }

    @Test
    void triesAnotherModelForUnavailableOrPersistentlyOverloadedModelsOnly() {
        assertThat(GeminiParser.shouldTryFallbackModel(404)).isTrue();
        assertThat(GeminiParser.shouldTryFallbackModel(503)).isTrue();
        assertThat(GeminiParser.shouldTryFallbackModel(429)).isFalse();
        assertThat(GeminiParser.shouldTryFallbackModel(403)).isFalse();
    }

    @Test
    void identifiesReactiveTimeoutsAsFallbackEligibleFailures() {
        assertThat(GeminiParser.isGeminiTimeout(
                new RuntimeException("reactive timeout", new TimeoutException("request timed out"))))
                .isTrue();
        assertThat(GeminiParser.isGeminiTimeout(new IllegalStateException("invalid response")))
                .isFalse();
    }

    @Test
    void generatedQuestionPromptUsesProvidedContentWithoutRequiringExistingQuestions() {
        GeminiParser parser = new GeminiParser(WebClient.builder(), objectMapper);

        String prompt = parser.generationPrompt(
                "Quang hợp chuyển năng lượng ánh sáng thành hóa năng.", "Sinh học", 10, 5, "APPLICATION");

        assertThat(prompt)
                .contains("không cần chứa câu hỏi có sẵn")
                .contains("Quang hợp chuyển năng lượng ánh sáng thành hóa năng.")
                .contains("đúng 5 câu hỏi")
                .contains("chủ đề ngắn")
                .contains("không trả về [] chỉ vì đầu vào ngắn")
                .contains("Làm theo yêu cầu về dạng câu hỏi")
                .contains("type phải là MCQ, TRUE_FALSE, SHORT_ANSWER hoặc ESSAY")
                .contains("$...$")
                .contains("$\\ce{...}$");
    }

    @Test
    void generatedQuestionPromptCanUseOnlyAShortNaturalLanguageRequest() {
        GeminiParser parser = new GeminiParser(WebClient.builder(), objectMapper);

        String prompt = parser.generationPrompt("Hãy tạo câu hỏi", "Toán", 12, 10, "COMPREHENSION");

        assertThat(prompt)
                .contains("dùng kiến thức phù hợp với môn học và khối lớp")
                .contains("không trả về [] chỉ vì đầu vào ngắn")
                .contains("Hãy tạo câu hỏi");
    }

    @Test
    void generatedQuestionCountIsAllocatedAcrossTextChunks() {
        GeminiParser parser = new GeminiParser(WebClient.builder(), objectMapper);

        List<Integer> allocation = parser.distributeQuestionCount(
                List.of("ngắn", "đoạn văn dài hơn", "đoạn dài nhất trong ba phần"), 7);

        assertThat(allocation).containsExactly(1, 2, 4);
        assertThat(allocation).allMatch(count -> count >= 0);
    }

    @Test
    void parsesDeepSeekQuestionArrayUsingTheImportQuestionSchema() {
        GeminiParser parser = new GeminiParser(WebClient.builder(), objectMapper);

        GeminiParser.ParseResult result = parser.parseGeneratedQuestions("""
                [{"number":1,"type":"MCQ","content":"Thực vật quang hợp chủ yếu ở bào quan nào?",
                "options":["Ti thể","Lục lạp","Ribosome","Nhân"],"correctAnswer":"B",
                "answerText":null,"difficulty":"COMPREHENSION","explanation":"Lục lạp chứa diệp lục."}]
                """);

        assertThat(result.questions()).hasSize(1);
        assertThat(result.questions().get(0).getContent())
                .isEqualTo("Thực vật quang hợp chủ yếu ở bào quan nào?");
        assertThat(result.questions().get(0).getCorrectAnswer()).isEqualTo("B");
        assertThat(result.questions().get(0).getOptions())
                .containsExactly("Ti thể", "Lục lạp", "Ribosome", "Nhân");
    }

    @Test
    void textQuestionGenerationCanUseTheConfiguredExternalProvider() {
        GeminiParser parser = new GeminiParser(WebClient.builder(), objectMapper);
        String response = """
                [{"number":1,"type":"MCQ","content":"Thực vật quang hợp chủ yếu ở bào quan nào?",
                "options":["Ti thể","Lục lạp","Ribosome","Nhân"],"correctAnswer":"B",
                "answerText":null,"difficulty":"COMPREHENSION","explanation":"Lục lạp chứa diệp lục."}]
                """;

        GeminiParser.ParseResult result = parser.generateQuestionsFromText(
                "Tạo câu hỏi về quang hợp", "Sinh học", 10, 1, "COMPREHENSION",
                prompt -> {
                    assertThat(prompt).contains("Tạo câu hỏi về quang hợp");
                    return parser.parseGeneratedQuestions(response);
                });

        assertThat(result.questions()).hasSize(1);
        assertThat(result.questions().getFirst().getCorrectAnswer()).isEqualTo("B");
    }

    @Test
    void serviceUnavailableMessageExplainsTheAutomaticRetry() {
        GeminiParser parser = new GeminiParser(WebClient.builder(), objectMapper);

        assertThat(parser.userMessageForGeminiError(503, ""))
                .contains("tạm thời quá tải")
                .contains("tự thử lại");
    }

    @Test
    void referrerRestrictedApiKeyExplainsServerSideKeyRestriction() {
        GeminiParser parser = new GeminiParser(WebClient.builder(), new ObjectMapper());
        String response = """
                {"error":{"details":[{"reason":"API_KEY_HTTP_REFERRER_BLOCKED"}]}}
                """;

        assertThat(parser.userMessageForGeminiError(403, response))
                .contains("giới hạn theo website")
                .contains("HTTP referrer");
    }

    @Test
    void unavailableConfiguredModelFallsBackToTheNewestAvailableStableFlashModel() throws Exception {
        GeminiParser parser = new GeminiParser(WebClient.builder(), objectMapper);
        JsonNode availableModels = objectMapper.readTree("""
                {"models":[
                  {"name":"models/text-embedding-004","supportedGenerationMethods":["embedContent"]},
                  {"name":"models/gemini-2.5-flash-lite","supportedGenerationMethods":["generateContent"]},
                  {"name":"models/gemini-2.5-flash","supportedGenerationMethods":["generateContent"]},
                  {"name":"models/gemini-3.6-flash","supportedGenerationMethods":["generateContent"]},
                  {"name":"models/gemini-3.8-live-preview","supportedGenerationMethods":["generateContent"]}
                ]}
                """);

        assertThat(parser.selectAvailableModels(availableModels, "retired-model"))
                .containsExactly("gemini-3.6-flash", "gemini-2.5-flash", "gemini-2.5-flash-lite",
                        "gemini-3.8-live-preview");
    }

    @Test
    void modelDiscoveryExcludesUnavailableConfiguredModelFromRetryCandidates() throws Exception {
        GeminiParser parser = new GeminiParser(WebClient.builder(), objectMapper);
        JsonNode availableModels = objectMapper.readTree("""
                {"models":[
                  {"name":"models/gemini-2.5-flash","supportedGenerationMethods":["generateContent"]},
                  {"name":"models/gemini-2.5-flash-lite","supportedGenerationMethods":["generateContent"]}
                ]}
                """);

        assertThat(parser.selectAvailableModels(availableModels, "gemini-2.5-flash"))
                .containsExactly("gemini-2.5-flash-lite");
    }

    @Test
    void modelDiscoveryReturnsNoRetryCandidatesWhenOnlyTheFailedModelIsListed() throws Exception {
        GeminiParser parser = new GeminiParser(WebClient.builder(), objectMapper);
        JsonNode availableModels = objectMapper.readTree("""
                {"models":[
                  {"name":"models/gemini-2.5-flash-lite","supportedGenerationMethods":["generateContent"]}
                ]}
                """);

        assertThat(parser.selectAvailableModels(availableModels, "gemini-2.5-flash-lite"))
                .isEmpty();
    }
}
