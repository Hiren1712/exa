package vn.exa.importjob;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.web.reactive.function.client.WebClient;
import vn.exa.common.BusinessException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class GeminiParserTest {

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
}
