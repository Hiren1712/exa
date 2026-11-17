package vn.exa.importjob;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.rendering.ImageType;
import org.apache.pdfbox.rendering.PDFRenderer;
import org.springframework.stereotype.Component;
import vn.exa.common.BusinessException;
import vn.exa.question.QuestionMedia;
import vn.exa.question.QuestionMediaRepository;

import javax.imageio.IIOImage;
import javax.imageio.ImageIO;
import javax.imageio.ImageWriteParam;
import javax.imageio.ImageWriter;
import javax.imageio.stream.ImageInputStream;
import javax.imageio.stream.ImageOutputStream;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Component
@Slf4j
@RequiredArgsConstructor
public class QuestionImageCropper {
    private static final long MAX_IMAGE_PIXELS = 40_000_000L;
    private static final int MAX_CROP_BYTES = 5 * 1024 * 1024;
    private static final int MAX_CROP_DIMENSION = 4096;
    private static final int PDF_RENDER_MAX_DIMENSION = 2400;
    private static final float[] JPEG_QUALITIES = {0.9f, 0.8f, 0.7f, 0.6f, 0.5f};

    private final QuestionMediaRepository questionMediaRepository;

    public void attachRasterImages(List<ParsedQuestion> questions, byte[] source, Long ownerId) {
        List<ParsedQuestion> withRegions = questionsWithRegions(questions);
        if (withRegions.isEmpty()) return;

        BufferedImage image;
        try {
            image = readImage(source);
        } catch (IOException error) {
            withRegions.forEach(question -> setCropWarning(question,
                    "Không thể đọc ảnh nguồn để cắt hình minh họa."));
            log.warn("Could not decode import source image for question illustration crops", error);
            return;
        }
        if (image == null) {
            withRegions.forEach(question -> setCropWarning(question,
                    "Định dạng ảnh nguồn chưa hỗ trợ cắt tự động; hãy thêm ảnh thủ công."));
            log.warn("No ImageIO reader available for import source image crops");
            return;
        }

        for (ParsedQuestion question : withRegions) {
            ImageRegion region = question.getImageRegion();
            if (!region.isValidForPages(1)) {
                setCropWarning(question, "AI không xác định được vùng ảnh hợp lệ; hãy thêm ảnh thủ công.");
                continue;
            }
            saveCrop(question, crop(image, region), ownerId);
        }
    }

    public void attachPdfImages(List<ParsedQuestion> questions, byte[] source, Long ownerId) {
        List<ParsedQuestion> withRegions = questionsWithRegions(questions);
        if (withRegions.isEmpty()) return;

        try (PDDocument document = Loader.loadPDF(source)) {
            PDFRenderer renderer = new PDFRenderer(document);
            Map<Integer, BufferedImage> renderedPages = new HashMap<>();
            for (ParsedQuestion question : withRegions) {
                ImageRegion region = question.getImageRegion();
                if (!region.isValidForPages(document.getNumberOfPages())) {
                    setCropWarning(question, "AI không xác định được trang hoặc vùng ảnh hợp lệ; hãy thêm ảnh thủ công.");
                    continue;
                }
                BufferedImage page = renderedPages.get(region.page());
                if (page == null) {
                    page = renderPage(document, renderer, region.page() - 1);
                    renderedPages.put(region.page(), page);
                }
                saveCrop(question, crop(page, region), ownerId);
            }
        } catch (IOException error) {
            throw BusinessException.badRequest("Không thể cắt ảnh minh họa từ PDF. Hãy thử lại hoặc thêm ảnh thủ công.");
        }
    }

    private List<ParsedQuestion> questionsWithRegions(List<ParsedQuestion> questions) {
        return questions.stream().filter(question -> question.getImageRegion() != null).toList();
    }

    private void saveCrop(ParsedQuestion question, BufferedImage crop, Long ownerId) {
        EncodedImage encodedImage = encodeCrop(crop);
        QuestionMedia media = new QuestionMedia();
        media.setId(UUID.randomUUID().toString());
        media.setOwnerId(ownerId);
        media.setMimeType(encodedImage.mimeType());
        media.setImageData(encodedImage.bytes());
        questionMediaRepository.save(media);
        question.setImageUrl("/api/v1/question-media/" + media.getId());
        question.setImageRegion(null);
        question.setImageCropWarning(null);
    }

    private EncodedImage encodeCrop(BufferedImage image) {
        ByteArrayOutputStream pngBytes = new ByteArrayOutputStream();
        try {
            if (ImageIO.write(image, "png", pngBytes) && pngBytes.size() <= MAX_CROP_BYTES) {
                return new EncodedImage(pngBytes.toByteArray(), "image/png");
            }
        } catch (IOException error) {
            throw BusinessException.badRequest("Không thể mã hóa ảnh minh họa đã cắt");
        }
        return new EncodedImage(encodeJpeg(image), "image/jpeg");
    }

    private void setCropWarning(ParsedQuestion question, String warning) {
        question.setImageRegion(null);
        question.setImageCropWarning(warning);
    }

    private BufferedImage crop(BufferedImage source, ImageRegion region) {
        int left = region.x() * source.getWidth() / 1000;
        int top = region.y() * source.getHeight() / 1000;
        int right = (int) Math.ceil((region.x() + region.width()) * source.getWidth() / 1000.0);
        int bottom = (int) Math.ceil((region.y() + region.height()) * source.getHeight() / 1000.0);
        left = Math.max(0, Math.min(source.getWidth() - 1, left));
        top = Math.max(0, Math.min(source.getHeight() - 1, top));
        right = Math.max(left + 1, Math.min(source.getWidth(), right));
        bottom = Math.max(top + 1, Math.min(source.getHeight(), bottom));

        BufferedImage result = new BufferedImage(right - left, bottom - top, BufferedImage.TYPE_INT_RGB);
        Graphics2D graphics = result.createGraphics();
        try {
            graphics.setColor(Color.WHITE);
            graphics.fillRect(0, 0, result.getWidth(), result.getHeight());
            graphics.drawImage(source, 0, 0, result.getWidth(), result.getHeight(),
                    left, top, right, bottom, null);
        } finally {
            graphics.dispose();
        }
        return resizeIfNeeded(result);
    }

    private BufferedImage readImage(byte[] source) throws IOException {
        try (ImageInputStream input = ImageIO.createImageInputStream(new ByteArrayInputStream(source))) {
            if (input == null) return null;
            Iterator<javax.imageio.ImageReader> readers = ImageIO.getImageReaders(input);
            if (!readers.hasNext()) return null;
            javax.imageio.ImageReader reader = readers.next();
            try {
                reader.setInput(input, true, true);
                long pixels = (long) reader.getWidth(0) * reader.getHeight(0);
                if (pixels <= 0 || pixels > MAX_IMAGE_PIXELS) {
                    throw new IOException("Image dimensions exceed the crop limit");
                }
                return reader.read(0);
            } finally {
                reader.dispose();
            }
        }
    }

    private BufferedImage renderPage(PDDocument document, PDFRenderer renderer, int pageIndex) throws IOException {
        var pageSize = document.getPage(pageIndex).getMediaBox();
        float pageMaxPoints = Math.max(pageSize.getWidth(), pageSize.getHeight());
        float dpi = Math.min(144f, PDF_RENDER_MAX_DIMENSION * 72f / pageMaxPoints);
        return renderer.renderImageWithDPI(pageIndex, Math.max(36f, dpi), ImageType.RGB);
    }

    private BufferedImage resizeIfNeeded(BufferedImage source) {
        int maxDimension = Math.max(source.getWidth(), source.getHeight());
        if (maxDimension <= MAX_CROP_DIMENSION) return source;
        double scale = (double) MAX_CROP_DIMENSION / maxDimension;
        int width = Math.max(1, (int) Math.round(source.getWidth() * scale));
        int height = Math.max(1, (int) Math.round(source.getHeight() * scale));
        BufferedImage resized = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        Graphics2D graphics = resized.createGraphics();
        try {
            graphics.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC);
            graphics.drawImage(source, 0, 0, width, height, null);
        } finally {
            graphics.dispose();
        }
        return resized;
    }

    private byte[] encodeJpeg(BufferedImage image) {
        Iterator<ImageWriter> writers = ImageIO.getImageWritersByFormatName("jpeg");
        if (!writers.hasNext()) throw BusinessException.badRequest("Không có bộ mã hóa ảnh JPEG trên máy chủ");
        ImageWriter writer = writers.next();
        try {
            for (float quality : JPEG_QUALITIES) {
                ByteArrayOutputStream bytes = new ByteArrayOutputStream();
                try (ImageOutputStream output = ImageIO.createImageOutputStream(bytes)) {
                    writer.setOutput(output);
                    ImageWriteParam parameters = writer.getDefaultWriteParam();
                    parameters.setCompressionMode(ImageWriteParam.MODE_EXPLICIT);
                    parameters.setCompressionQuality(quality);
                    writer.write(null, new IIOImage(image, null, null), parameters);
                    output.flush();
                } finally {
                    writer.reset();
                }
                if (bytes.size() <= MAX_CROP_BYTES) return bytes.toByteArray();
            }
        } catch (IOException error) {
            throw BusinessException.badRequest("Không thể mã hóa ảnh minh họa đã cắt");
        } finally {
            writer.dispose();
        }
        throw BusinessException.badRequest("Ảnh minh họa đã cắt quá lớn để lưu");
    }

    private record EncodedImage(byte[] bytes, String mimeType) {}
}
