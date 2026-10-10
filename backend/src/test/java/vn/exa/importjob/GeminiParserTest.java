package vn.exa.importjob;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.Test;
import org.springframework.web.reactive.function.client.WebClient;
import vn.exa.common.BusinessException;

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
