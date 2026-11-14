package vn.exa.importjob;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.reactive.function.client.ClientResponse;
import org.springframework.web.reactive.function.client.ExchangeFunction;
import org.springframework.web.reactive.function.client.WebClient;
import vn.exa.common.BusinessException;
import reactor.core.publisher.Mono;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;

import java.io.ByteArrayOutputStream;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Map;
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
                .hasMessage("Chưa cấu hình Gemini hoặc Groq API key và model trên máy chủ");
    }

    @Test
    void geminiImportKeysUsePrimaryThenNumberedSlotsInNumericOrder() {
        assertThat(GeminiParser.orderApiKeys("primary-key", Map.of(
                "gemini2", "second-key",
                "gemini10", "tenth-key",
                "GEMINI1", "first-key",
                "deep1", "unrelated-key")))
                .containsExactly("primary-key", "first-key", "second-key", "tenth-key");
    }

    @Test
    void geminiImportKeysDeduplicateValuesAndIgnorePlaceholderKeys() {
        assertThat(GeminiParser.orderApiKeys(" ", Map.of(
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
                .contains("không cần đúng định dạng đề thi")
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
    void imageImportPromptSolvesExtractedQuestionsAndLeavesUnclearAnswersBlank() {
        GeminiParser parser = new GeminiParser(WebClient.builder(), objectMapper);

        String extractPrompt = parser.sourcePrompt("Toán", 12, ImportMode.EXTRACT, 10);
        String generatePrompt = parser.sourcePrompt("Toán", 12, ImportMode.GENERATE, 10);

        assertThat(extractPrompt)
                .contains("ảnh scan")
                .contains("biểu đồ và sơ đồ")
                .contains("tự giải từ nội dung câu hỏi và phương án đọc được")
                .contains("không thể xác định duy nhất đáp án")
                .contains("điền answerText nếu đủ dữ kiện");
        assertThat(generatePrompt)
                .contains("đọc chữ tiếng Việt")
                .contains("[Hình: ...]")
                .contains("không tự bịa chi tiết");
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
    void textQuestionGenerationRequiresAnAiProviderConfiguration() {
        GeminiParser parser = new GeminiParser(WebClient.builder(), objectMapper);

        assertThatThrownBy(() -> parser.generateQuestionsFromText(
                "Tạo câu hỏi về quang hợp", "Sinh học", 10, 1, "COMPREHENSION"))
                .isInstanceOf(BusinessException.class)
                .hasMessage("Chưa cấu hình Gemini hoặc Groq API key và model trên máy chủ");
    }

    @Test
    void groqKeyAndModelEnableAiTasksWithoutGemini() {
        GeminiParser parser = new GeminiParser(WebClient.builder(), objectMapper);
        ReflectionTestUtils.setField(parser, "groqApiKey", "groq-test-key");
        ReflectionTestUtils.setField(parser, "groqModel", "vision-model");

        assertThat(parser.isConfigured()).isTrue();
        org.assertj.core.api.Assertions.assertThatCode(parser::validateConfiguration)
                .doesNotThrowAnyException();
    }

    @Test
    void groqFallbackIsUsedAfterGeminiFailsForQuestionGeneration() {
        List<String> requestedHosts = new ArrayList<>();
        ExchangeFunction exchange = request -> {
            requestedHosts.add(request.url().getHost());
            if (request.url().getHost().equals("generativelanguage.googleapis.com")) {
                return Mono.just(ClientResponse.create(HttpStatus.TOO_MANY_REQUESTS)
                        .body("{\"error\":{\"status\":\"RESOURCE_EXHAUSTED\"}}")
                        .build());
            }
            return Mono.just(ClientResponse.create(HttpStatus.OK)
                    .header("Content-Type", "application/json")
                    .body("""
                            {"choices":[{"message":{"content":"[{\\"number\\":1,\\"content\\":\\"Generated\\",\\"options\\":[\\"A\\",\\"B\\"],\\"correctAnswer\\":\\"A\\"}]"}}],
                             "usage":{"total_tokens":12}}
                            """)
                    .build());
        };
        GeminiParser parser = new GeminiParser(
                WebClient.builder().exchangeFunction(exchange), objectMapper);
        ReflectionTestUtils.setField(parser, "apiKey", "gemini-test-key");
        ReflectionTestUtils.setField(parser, "model", "gemini-test-model");
        ReflectionTestUtils.setField(parser, "timeoutMs", 1000L);
        ReflectionTestUtils.setField(parser, "groqApiKey", "groq-test-key");
        ReflectionTestUtils.setField(parser, "groqModel", "groq-test-model");
        ReflectionTestUtils.setField(parser, "groqBaseUrl",
                "https://api.groq.com/openai/v1/chat/completions");
        ReflectionTestUtils.setField(parser, "groqTimeoutMs", 1000L);

        List<ParsedQuestion> questions = parser.generateQuestions(
                "Toán", 10, "Phân số", 1, "COMPREHENSION");

        assertThat(questions).hasSize(1);
        assertThat(questions.get(0).getContent()).isEqualTo("Generated");
        assertThat(requestedHosts).containsExactly(
                "generativelanguage.googleapis.com", "api.groq.com");
        assertThat(parser.getAndClearLastTaskModel()).isEqualTo("Groq: groq-test-model");
    }

    @Test
    void selectedGroqProviderIsTriedBeforeGeminiForImportTasks() {
        List<String> requestedHosts = new ArrayList<>();
        ExchangeFunction exchange = request -> {
            requestedHosts.add(request.url().getHost());
            return Mono.just(ClientResponse.create(HttpStatus.OK)
                    .header("Content-Type", "application/json")
                    .body("""
                            {"choices":[{"message":{"content":"[{\\"number\\":1,\\"content\\":\\"Groq question\\",\\"options\\":[\\"A\\",\\"B\\"],\\"correctAnswer\\":\\"A\\"}]"}}]}
                            """)
                    .build());
        };
        GeminiParser parser = new GeminiParser(
                WebClient.builder().exchangeFunction(exchange), objectMapper);
        ReflectionTestUtils.setField(parser, "apiKey", "gemini-test-key");
        ReflectionTestUtils.setField(parser, "model", "gemini-test-model");
        ReflectionTestUtils.setField(parser, "groqApiKey", "groq-test-key");
        ReflectionTestUtils.setField(parser, "groqModel", "groq-test-model");
        ReflectionTestUtils.setField(parser, "groqBaseUrl",
                "https://api.groq.com/openai/v1/chat/completions");
        ReflectionTestUtils.setField(parser, "groqTimeoutMs", 1000L);
        parser.setPreferredTaskProvider(ImportAiProvider.GROQ);

        List<ParsedQuestion> questions = parser.generateQuestions(
                "Toán", 10, "Phân số", 1, "COMPREHENSION");

        assertThat(questions).hasSize(1);
        assertThat(questions.get(0).getContent()).isEqualTo("Groq question");
        assertThat(requestedHosts).containsExactly("api.groq.com");
        assertThat(parser.getAndClearLastTaskModel()).isEqualTo("Groq: groq-test-model");
    }

    @Test
    void selectedGroqProviderFallsBackToGeminiWhenGroqFails() {
        List<String> requestedHosts = new ArrayList<>();
        ExchangeFunction exchange = request -> {
            requestedHosts.add(request.url().getHost());
            if (request.url().getHost().equals("api.groq.com")) {
                return Mono.just(ClientResponse.create(HttpStatus.TOO_MANY_REQUESTS)
                        .body("{\"error\":\"rate limit\"}")
                        .build());
            }
            return Mono.just(ClientResponse.create(HttpStatus.OK)
                    .header("Content-Type", "application/json")
                    .body("""
                            {"candidates":[{"content":{"parts":[{"text":"[{\\"number\\":1,\\"content\\":\\"Gemini question\\",\\"options\\":[\\"A\\",\\"B\\"],\\"correctAnswer\\":\\"B\\"}]"}]}}]}
                            """)
                    .build());
        };
        GeminiParser parser = new GeminiParser(
                WebClient.builder().exchangeFunction(exchange), objectMapper);
        ReflectionTestUtils.setField(parser, "apiKey", "gemini-test-key");
        ReflectionTestUtils.setField(parser, "model", "gemini-test-model");
        ReflectionTestUtils.setField(parser, "groqApiKey", "groq-test-key");
        ReflectionTestUtils.setField(parser, "groqModel", "groq-test-model");
        ReflectionTestUtils.setField(parser, "groqBaseUrl",
                "https://api.groq.com/openai/v1/chat/completions");
        ReflectionTestUtils.setField(parser, "timeoutMs", 1000L);
        ReflectionTestUtils.setField(parser, "groqTimeoutMs", 1000L);
        parser.setPreferredTaskProvider(ImportAiProvider.GROQ);

        List<ParsedQuestion> questions = parser.generateQuestions(
                "Toán", 10, "Phân số", 1, "COMPREHENSION");

        assertThat(questions).hasSize(1);
        assertThat(questions.get(0).getContent()).isEqualTo("Gemini question");
        assertThat(requestedHosts).containsExactly("api.groq.com", "generativelanguage.googleapis.com");
        assertThat(parser.getAndClearLastTaskModel()).isEqualTo("Gemini: gemini-test-model");
    }

    @Test
    void groqMessagesPreserveImagePartsAsDataUrls() throws Exception {
        GeminiParser parser = new GeminiParser(WebClient.builder(), objectMapper);
        JsonNode geminiRequest = objectMapper.readTree("""
                {"contents":[{"parts":[
                  {"text":"Read this image"},
                  {"inline_data":{"mime_type":"image/png","data":"aGVsbG8="}}
                ]}]}
                """);

        JsonNode groqRequest = objectMapper.valueToTree(parser.toGroqMessages(geminiRequest));

        assertThat(groqRequest.at("/0/role").asText()).isEqualTo("system");
        assertThat(groqRequest.at("/0/content").asText()).contains("correctAnswer/answerText");
        assertThat(groqRequest.at("/1/role").asText()).isEqualTo("user");
        assertThat(groqRequest.at("/1/content/0/text").asText()).isEqualTo("Read this image");
        assertThat(groqRequest.at("/1/content/1/image_url/url").asText())
                .isEqualTo("data:image/png;base64,aGVsbG8=");
    }

    @Test
    void groqPdfFallbackRejectsDocumentsOverThreePagesInsteadOfDroppingPages() throws Exception {
        GeminiParser parser = new GeminiParser(WebClient.builder(), objectMapper);
        ByteArrayOutputStream pdfBytes = new ByteArrayOutputStream();
        try (PDDocument document = new PDDocument()) {
            for (int page = 0; page < 4; page++) document.addPage(new PDPage());
            document.save(pdfBytes);
        }
        JsonNode geminiRequest = objectMapper.valueToTree(Map.of(
                "contents", List.of(Map.of("parts", List.of(
                        Map.of("text", "Read the scanned document"),
                        Map.of("inline_data", Map.of(
                                "mime_type", "application/pdf",
                                "data", Base64.getEncoder().encodeToString(pdfBytes.toByteArray()))))))));

        assertThatThrownBy(() -> parser.toGroqMessages(geminiRequest))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("tối đa 3 trang");
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
