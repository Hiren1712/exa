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
    void parsesLargerPngFromGenerateContentResponse() throws Exception {
        BufferedImage generated = new BufferedImage(4, 2, BufferedImage.TYPE_INT_RGB);
        ByteArrayOutputStream imageBytes = new ByteArrayOutputStream();
        ImageIO.write(generated, "png", imageBytes);
        String response = objectMapper.writeValueAsString(Map.of(
                "candidates", java.util.List.of(Map.of(
                        "content", Map.of(
                                "parts", java.util.List.of(Map.of(
                                        "inlineData", Map.of(
                                                "mimeType", "image/png",
                                                "data", Base64.getEncoder().encodeToString(
                                                        imageBytes.toByteArray())))))))));

        BufferedImage result = enhancer.parseEnhancedImage(response, 2, 1);

        assertThat(result.getWidth()).isEqualTo(4);
        assertThat(result.getHeight()).isEqualTo(2);
    }

    @Test
    void rejectsResponsesWithoutAnUpscaledImage() throws Exception {
        String response = objectMapper.writeValueAsString(Map.of("candidates", java.util.List.of()));

        assertThatThrownBy(() -> enhancer.parseEnhancedImage(response, 2, 1))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("không trả về ảnh");
    }

    @Test
    void buildsGenerateContentRequestWithImageOutputConfigAndSourceAspectRatio() {
        Map<String, Object> request = enhancer.buildRequest(new byte[]{1, 2}, 16, 9);

        assertThat(request).containsKey("contents");
        assertThat(request.get("generationConfig")).isEqualTo(Map.of(
                "responseModalities", java.util.List.of("TEXT", "IMAGE"),
                "imageConfig", Map.of("imageSize", "2K", "aspectRatio", "16:9")));
        assertThat(enhancer.closestAspectRatio(16, 9)).isEqualTo("16:9");
        assertThat(enhancer.closestAspectRatio(1, 1)).isEqualTo("1:1");
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
