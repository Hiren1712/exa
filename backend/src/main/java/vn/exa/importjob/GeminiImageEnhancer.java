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
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Component
@RequiredArgsConstructor
@Slf4j
public class GeminiImageEnhancer {
    private static final String GENERATE_CONTENT_URL =
            "https://generativelanguage.googleapis.com/v1/models/{model}:generateContent";
    private static final long MAX_OUTPUT_BYTES = 20L * 1024 * 1024;
    private static final long MAX_OUTPUT_PIXELS = 40_000_000L;
    private static final List<String> SUPPORTED_ASPECT_RATIOS = List.of(
            "1:1", "1:4", "1:8", "2:3", "3:2", "3:4", "4:1", "4:3",
            "4:5", "5:4", "8:1", "9:16", "16:9", "21:9");
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
        Map<String, Object> request = buildRequest(sourceBytes, source.getWidth(), source.getHeight());

        WebClientResponseException lastProviderError = null;
        for (String apiKey : apiKeys) {
            try {
                String response = sendRequest(request, apiKey);
                return parseEnhancedImage(response, source.getWidth(), source.getHeight());
            } catch (WebClientResponseException error) {
                lastProviderError = error;
                log.warn("Gemini image enhancement returned HTTP {}: {}",
                        lastProviderError.getStatusCode().value(), providerErrorMessage(lastProviderError));
                if (!List.of(401, 403, 429).contains(lastProviderError.getStatusCode().value())) break;
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
                        "Gemini Image không khả dụng với API key/model hiện tại. "
                                + providerErrorMessage(lastProviderError));
            }
            if (status == 400) {
                throw BusinessException.badRequest(
                        "Gemini Image từ chối yêu cầu: " + providerErrorMessage(lastProviderError));
            }
            throw BusinessException.badRequest(
                    "Gemini Image gặp lỗi HTTP " + status + ". Vui lòng thử lại sau.");
        }
        throw BusinessException.badRequest("Gemini Image không thể làm nét ảnh. Vui lòng thử lại.");
    }

    Map<String, Object> buildRequest(byte[] sourceBytes, int width, int height) {
        return Map.of(
                "contents", List.of(Map.of("parts", List.of(
                        Map.of("text", ENHANCEMENT_PROMPT),
                        Map.of("inline_data", Map.of(
                                "mime_type", "image/png",
                                "data", Base64.getEncoder().encodeToString(sourceBytes)))))),
                "generationConfig", Map.of(
                        "responseModalities", List.of("TEXT", "IMAGE"),
                        "imageConfig", Map.of(
                                "imageSize", "2K",
                                "aspectRatio", closestAspectRatio(width, height))));
    }

    String closestAspectRatio(int width, int height) {
        double sourceRatio = (double) width / height;
        return SUPPORTED_ASPECT_RATIOS.stream()
                .min(Comparator.comparingDouble(ratio -> Math.abs(Math.log(sourceRatio / ratioValue(ratio)))))
                .orElseThrow();
    }

    private double ratioValue(String ratio) {
        String[] parts = ratio.split(":");
        return Double.parseDouble(parts[0]) / Double.parseDouble(parts[1]);
    }

    private String sendRequest(Map<String, Object> request, String apiKey) {
        return webClientBuilder.build()
                .post()
                .uri(GENERATE_CONTENT_URL, imageModel)
                .header("x-goog-api-key", apiKey.trim())
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(request)
                .retrieve()
                .bodyToMono(String.class)
                .timeout(Duration.ofMillis(timeoutMs))
                .block();
    }

    String providerErrorMessage(WebClientResponseException error) {
        try {
            String message = objectMapper.readTree(error.getResponseBodyAsString())
                    .path("error").path("message").asText();
            if (!message.isBlank()) {
                String singleLine = message.replaceAll("[\\r\\n\\t]+", " ").trim();
                return singleLine.length() <= 400 ? singleLine : singleLine.substring(0, 400);
            }
        } catch (IOException ignored) {
            // Fall through to a status-only diagnostic when the provider body is not JSON.
        }
        return "Không có chi tiết lỗi từ Gemini.";
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
            String mimeType = image.path("mimeType").asText(image.path("mime_type").asText("image/png"));
            if (!List.of("image/png", "image/jpeg").contains(mimeType.toLowerCase(Locale.ROOT))) {
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
        JsonNode candidates = interaction.path("candidates");
        if (candidates.isArray()) {
            for (JsonNode candidate : candidates) {
                JsonNode parts = candidate.path("content").path("parts");
                if (!parts.isArray()) continue;
                for (JsonNode part : parts) {
                    JsonNode inlineData = part.hasNonNull("inlineData")
                            ? part.path("inlineData") : part.path("inline_data");
                    if (inlineData.hasNonNull("data")) return inlineData;
                }
            }
        }
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
