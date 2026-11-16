package vn.exa.importjob;

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

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.Duration;
import java.util.Base64;
import java.util.List;
import java.util.Map;

@Component
@RequiredArgsConstructor
@Slf4j
public class GeminiImageEnhancer {
    private static final String INTERACTIONS_URL = "https://generativelanguage.googleapis.com/v1beta/interactions";
    private static final String API_REVISION = "2026-05-20";
    private static final long MAX_OUTPUT_BYTES = 20L * 1024 * 1024;
    private static final long MAX_OUTPUT_PIXELS = 40_000_000L;
    private static final String ENHANCEMENT_PROMPT = """
            Create a faithful high-resolution enhancement of this exact image.
            Keep the same aspect ratio, framing, layout, colors, labels, numbers,
            graph lines, curves, symbols, and all visible content unchanged.
            Improve resolution and edge clarity only. Do not add, remove, translate,
            reinterpret, or guess any detail. If a detail is unreadable, preserve it
            as unclear instead of inventing a replacement.
            """;

    private final GeminiParser geminiParser;
    private final WebClient.Builder webClientBuilder;
    private final ObjectMapper objectMapper;

    @Value("${exa.gemini.image-model:gemini-3.1-flash-image}")
    private String imageModel;

    @Value("${exa.gemini.image-timeout-ms:120000}")
    private long timeoutMs;

    public BufferedImage enhance(BufferedImage source) {
        List<String> apiKeys = geminiParser.configuredApiKeys();
        if (apiKeys.isEmpty()) {
            throw BusinessException.badRequest(
                    "Tăng nét ảnh tự động cần cấu hình GEMINI_API_KEY và quyền dùng model Gemini Image.");
        }

        byte[] sourceBytes = encodePng(source);
        Map<String, Object> request = buildRequest(imageModel, sourceBytes);

        WebClientResponseException lastProviderError = null;
        for (String apiKey : apiKeys) {
            try {
                String response = webClientBuilder.build()
                        .post()
                        .uri(INTERACTIONS_URL)
                        .header("x-goog-api-key", apiKey.trim())
                        .header("Api-Revision", API_REVISION)
                        .contentType(MediaType.APPLICATION_JSON)
                        .bodyValue(request)
                        .retrieve()
                        .bodyToMono(String.class)
                        .timeout(Duration.ofMillis(timeoutMs))
                        .block();
                return parseEnhancedImage(response, source.getWidth(), source.getHeight());
            } catch (WebClientResponseException error) {
                lastProviderError = error;
                log.warn("Gemini image enhancement returned HTTP {}", error.getStatusCode().value());
                if (!List.of(401, 403, 429).contains(error.getStatusCode().value())) break;
            } catch (BusinessException error) {
                throw error;
            } catch (Exception error) {
                log.error("Gemini image enhancement failed: {}", error.getClass().getSimpleName());
                throw BusinessException.badRequest(
                        "Không kết nối được Gemini Image để làm nét ảnh. Vui lòng kiểm tra cấu hình và thử lại.");
            }
        }

        if (lastProviderError != null) {
            int status = lastProviderError.getStatusCode().value();
            if (status == 429) {
                throw BusinessException.badRequest(
                        "Gemini Image đã hết quota hoặc đang quá tải. Kiểm tra quota/billing rồi thử lại.");
            }
            if (status == 401 || status == 403 || status == 404) {
                throw BusinessException.badRequest(
                        "Gemini Image không khả dụng với API key/model hiện tại. Kiểm tra GEMINI_API_KEY và GEMINI_IMAGE_MODEL.");
            }
            throw BusinessException.badRequest(
                    "Gemini Image gặp lỗi HTTP " + status + ". Vui lòng thử lại sau.");
        }
        throw BusinessException.badRequest("Gemini Image không thể làm nét ảnh. Vui lòng thử lại.");
    }

    Map<String, Object> buildRequest(String model, byte[] sourceBytes) {
        return Map.of(
                "model", model,
                "input", List.of(
                        Map.of("type", "text", "text", ENHANCEMENT_PROMPT),
                        Map.of(
                                "type", "image",
                                "mime_type", "image/png",
                                "data", Base64.getEncoder().encodeToString(sourceBytes))),
                "response_format", Map.of(
                        "type", "image",
                        "mime_type", "image/png",
                        "image_size", "2K"),
                "store", false);
    }

    BufferedImage parseEnhancedImage(String responseBody, int sourceWidth, int sourceHeight) {
        try {
            JsonNode response = objectMapper.readTree(responseBody);
            JsonNode interaction = response.path("interaction");
            if (!interaction.isObject()) interaction = response;
            JsonNode image = findOutputImage(interaction);
            if (!image.hasNonNull("data")) {
                throw BusinessException.badRequest(
                        "Gemini Image không trả về ảnh đã làm nét. Hãy thử lại hoặc kiểm tra model.");
            }
            String mimeType = image.path("mime_type").asText("image/png");
            if (!"image/png".equalsIgnoreCase(mimeType)) {
                throw BusinessException.badRequest(
                        "Gemini Image trả về định dạng không được hỗ trợ.");
            }
            byte[] bytes = Base64.getDecoder().decode(image.path("data").asText());
            if (bytes.length == 0 || bytes.length > MAX_OUTPUT_BYTES) {
                throw BusinessException.badRequest("Ảnh AI trả về vượt quá giới hạn lưu trữ.");
            }
            BufferedImage enhanced = ImageIO.read(new ByteArrayInputStream(bytes));
            if (enhanced == null) {
                throw BusinessException.badRequest("Gemini Image trả về dữ liệu ảnh không hợp lệ.");
            }
            long pixels = (long) enhanced.getWidth() * enhanced.getHeight();
            if (pixels > MAX_OUTPUT_PIXELS) {
                throw BusinessException.badRequest("Ảnh AI trả về có độ phân giải vượt giới hạn.");
            }
            if (enhanced.getWidth() <= sourceWidth || enhanced.getHeight() <= sourceHeight) {
                throw BusinessException.badRequest(
                        "Gemini Image không tăng độ phân giải ảnh. Hãy thử lại hoặc dùng file gốc rõ hơn.");
            }
            return enhanced;
        } catch (BusinessException error) {
            throw error;
        } catch (IOException | IllegalArgumentException error) {
            throw BusinessException.badRequest("Không đọc được ảnh Gemini Image trả về.");
        }
    }

    private JsonNode findOutputImage(JsonNode interaction) {
        JsonNode outputImage = interaction.path("output_image");
        if (outputImage.hasNonNull("data")) return outputImage;
        JsonNode steps = interaction.path("steps");
        if (steps.isArray()) {
            for (int stepIndex = steps.size() - 1; stepIndex >= 0; stepIndex--) {
                JsonNode content = steps.get(stepIndex).path("content");
                if (!content.isArray()) continue;
                for (JsonNode part : content) {
                    if ("image".equals(part.path("type").asText()) && part.hasNonNull("data")) {
                        return part;
                    }
                }
            }
        }
        return outputImage;
    }

    private byte[] encodePng(BufferedImage image) {
        try (ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            if (!ImageIO.write(image, "png", output)) {
                throw BusinessException.badRequest("Không thể chuẩn bị ảnh để Gemini làm nét.");
            }
            return output.toByteArray();
        } catch (IOException error) {
            throw BusinessException.badRequest("Không thể chuẩn bị ảnh để Gemini làm nét.");
        }
    }
}
