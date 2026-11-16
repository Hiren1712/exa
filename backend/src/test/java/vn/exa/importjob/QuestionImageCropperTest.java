package vn.exa.importjob;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.junit.jupiter.api.Test;
import vn.exa.question.QuestionMedia;
import vn.exa.question.QuestionMediaRepository;

import javax.imageio.ImageIO;
import java.awt.Color;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class QuestionImageCropperTest {

    @Test
    void cropsOnlyTheImageRegionAssignedToTheQuestion() throws Exception {
        QuestionMediaRepository repository = mock(QuestionMediaRepository.class);
        when(repository.save(any(QuestionMedia.class))).thenAnswer(invocation -> invocation.getArgument(0));
        QuestionImageCropper cropper = new QuestionImageCropper(repository);

        BufferedImage source = new BufferedImage(100, 100, BufferedImage.TYPE_INT_RGB);
        var graphics = source.createGraphics();
        graphics.setColor(Color.BLUE);
        graphics.fillRect(0, 0, 100, 100);
        graphics.setColor(Color.RED);
        graphics.fillRect(20, 20, 20, 20);
        graphics.dispose();
        ByteArrayOutputStream sourceBytes = new ByteArrayOutputStream();
        ImageIO.write(source, "png", sourceBytes);
        ParsedQuestion question = questionWithRegion(new ImageRegion(1, 200, 200, 200, 200));

        cropper.attachRasterImages(List.of(question), sourceBytes.toByteArray(), 7L);

        assertThat(question.getImageUrl()).startsWith("/api/v1/question-media/");
        assertThat(question.getImageRegion()).isNull();
        assertThat(question.getImageCropWarning()).isNull();
        var mediaCaptor = org.mockito.ArgumentCaptor.forClass(QuestionMedia.class);
        org.mockito.Mockito.verify(repository).save(mediaCaptor.capture());
        QuestionMedia saved = mediaCaptor.getValue();
        assertThat(saved.getOwnerId()).isEqualTo(7L);
        assertThat(saved.getMimeType()).isEqualTo("image/png");
        BufferedImage crop = ImageIO.read(new java.io.ByteArrayInputStream(saved.getImageData()));
        assertThat(crop.getWidth()).isEqualTo(20);
        assertThat(crop.getHeight()).isEqualTo(20);
        assertThat(crop.getRGB(10, 10)).isEqualTo(Color.RED.getRGB());
    }

    @Test
    void cropsPdfPageRegionAndPersistsTheImageForTheOwner() throws Exception {
        QuestionMediaRepository repository = mock(QuestionMediaRepository.class);
        when(repository.save(any(QuestionMedia.class))).thenAnswer(invocation -> invocation.getArgument(0));
        QuestionImageCropper cropper = new QuestionImageCropper(repository);

        byte[] pdfBytes;
        try (PDDocument document = new PDDocument();
             ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            PDPage page = new PDPage(new PDRectangle(200, 200));
            document.addPage(page);
            try (PDPageContentStream stream = new PDPageContentStream(document, page)) {
                stream.setNonStrokingColor(Color.RED);
                stream.addRect(40, 60, 40, 30);
                stream.fill();
            }
            document.save(output);
            pdfBytes = output.toByteArray();
        }
        ParsedQuestion question = questionWithRegion(new ImageRegion(1, 200, 550, 200, 150));

        cropper.attachPdfImages(List.of(question), pdfBytes, 9L);

        assertThat(question.getImageUrl()).startsWith("/api/v1/question-media/");
        assertThat(question.getImageRegion()).isNull();
        var mediaCaptor = org.mockito.ArgumentCaptor.forClass(QuestionMedia.class);
        org.mockito.Mockito.verify(repository).save(mediaCaptor.capture());
        assertThat(mediaCaptor.getValue().getMimeType()).isEqualTo("image/png");
        BufferedImage crop = ImageIO.read(new java.io.ByteArrayInputStream(mediaCaptor.getValue().getImageData()));
        Color center = new Color(crop.getRGB(crop.getWidth() / 2, crop.getHeight() / 2));
        assertThat(center.getRed()).isGreaterThan(200);
        assertThat(center.getGreen()).isLessThan(80);
        assertThat(mediaCaptor.getValue().getOwnerId()).isEqualTo(9L);
    }

    @Test
    void invalidCropCoordinatesProduceAnExplicitPreviewWarning() throws Exception {
        QuestionMediaRepository repository = mock(QuestionMediaRepository.class);
        QuestionImageCropper cropper = new QuestionImageCropper(repository);
        ParsedQuestion question = questionWithRegion(
                new ImageRegion(1, Integer.MAX_VALUE, 0, 1, 1000));
        BufferedImage source = new BufferedImage(10, 10, BufferedImage.TYPE_INT_RGB);
        ByteArrayOutputStream sourceBytes = new ByteArrayOutputStream();
        ImageIO.write(source, "png", sourceBytes);

        cropper.attachRasterImages(List.of(question), sourceBytes.toByteArray(), 7L);

        assertThat(question.getImageUrl()).isNull();
        assertThat(question.getImageRegion()).isNull();
        assertThat(question.getImageCropWarning()).contains("không xác định được vùng ảnh hợp lệ");
    }

    private ParsedQuestion questionWithRegion(ImageRegion region) {
        return ParsedQuestion.builder()
                .number(1)
                .content("Câu hỏi có hình")
                .imageRegion(region)
                .build();
    }
}
