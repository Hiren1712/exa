package vn.exa.importjob;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import vn.exa.common.BusinessException;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.util.Base64;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;

class GeminiImageEnhancerTest {

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final GeminiImageEnhancer enhancer = new GeminiImageEnhancer(
            mock(GeminiParser.class), mock(WebClient.Builder.class), objectMapper);

    @Test
    void parsesLargerPngFromTheGeminiInteractionResponse() throws Exception {
        BufferedImage generated = new BufferedImage(4, 2, BufferedImage.TYPE_INT_RGB);
        ByteArrayOutputStream imageBytes = new ByteArrayOutputStream();
        ImageIO.write(generated, "png", imageBytes);
        String response = objectMapper.writeValueAsString(Map.of(
                "interaction", Map.of(
                        "steps", java.util.List.of(Map.of(
                                "type", "model_output",
                                "content", java.util.List.of(Map.of(
                                        "type", "image",
                                        "mime_type", "image/png",
                                        "data", Base64.getEncoder().encodeToString(imageBytes.toByteArray()))))))));

        BufferedImage result = enhancer.parseEnhancedImage(response, 2, 1);

        assertThat(result.getWidth()).isEqualTo(4);
        assertThat(result.getHeight()).isEqualTo(2);
    }

    @Test
    void rejectsResponsesWithoutAnUpscaledImage() throws Exception {
        String response = objectMapper.writeValueAsString(Map.of("interaction", Map.of()));

        assertThatThrownBy(() -> enhancer.parseEnhancedImage(response, 2, 1))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("không trả về ảnh");
    }

    @Test
    void sendsImageEnhancementAsAStatelessTwoKRequest() {
        Map<String, Object> request = enhancer.buildRequest("gemini-3.1-flash-image", new byte[]{1, 2});

        assertThat(request.get("store")).isEqualTo(false);
        assertThat(request.get("response_format")).isEqualTo(
                Map.of("type", "image", "mime_type", "image/png", "image_size", "2K"));
    }

    @Test
    void retriesWithoutImageOutputOptionsOnlyWhenGeminiRejectsThem() {
        WebClientResponseException responseFormatError = WebClientResponseException.create(
                400, "Bad Request", null, """
                        {"error":{"message":"Unknown name \\"response_format\\""}}
                        """.getBytes(java.nio.charset.StandardCharsets.UTF_8), null);
        Map<String, Object> fallbackRequest = enhancer.buildRequest(
                "gemini-3.1-flash-image", new byte[]{1, 2}, false);

        assertThat(enhancer.isResponseFormatError(responseFormatError)).isTrue();
        assertThat(fallbackRequest).doesNotContainKey("response_format");
        assertThat(fallbackRequest.get("store")).isEqualTo(false);
        assertThat(enhancer.providerErrorMessage(responseFormatError))
                .isEqualTo("Unknown name \"response_format\"");
    }

    @Test
    void capsAndFlattensProviderErrorMessages() {
        String longMessage = "x".repeat(450);
        WebClientResponseException error = WebClientResponseException.create(
                400, "Bad Request", null, objectMapper.valueToTree(
                        Map.of("error", Map.of("message", "  " + longMessage + "\nmore  "))).toString()
                        .getBytes(java.nio.charset.StandardCharsets.UTF_8), null);

        assertThat(enhancer.providerErrorMessage(error))
                .hasSize(400)
                .doesNotContain("\n");
    }
}
