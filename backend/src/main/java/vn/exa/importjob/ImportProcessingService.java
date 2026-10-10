package vn.exa.importjob;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import vn.exa.common.BusinessException;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class ImportProcessingService {

    private final ImportJobRepository importJobRepository;
    private final DocumentParser documentParser;
    private final GeminiParser geminiParser;
    private final ObjectMapper objectMapper;

    @Value("${exa.gemini.model:gemini-3.6-flash}")
    private String aiModel;

    @Async("importTaskExecutor")
    public void processAsync(Long jobId, String subjectHint, String supplementalContent,
                             ImportMode mode, Integer questionCount, Integer grade) {
        ImportJob job = importJobRepository.findById(jobId).orElse(null);
        if (job == null) {
            log.error("Import job {} disappeared before processing", jobId);
            return;
        }
        try {
            job.setStatus(ImportJob.Status.EXTRACTING);
            job.setStartedAt(LocalDateTime.now());
            importJobRepository.save(job);

            Path path = Paths.get(job.getStoragePath());
            if (!Files.exists(path)) {
                fail(job, "Không tìm thấy file");
                return;
            }

            byte[] fileBytes = Files.readAllBytes(path);
            MultipartFile multipartFile = new StoredMultipartFile(
                    job.getOriginalName(), fileBytes);
            String fileType = job.getFileType().toLowerCase();
            boolean imageFile = List.of("png", "jpg", "jpeg", "webp").contains(fileType);
            String extractedText = "txt".equals(fileType)
                    ? Files.readString(path, java.nio.charset.StandardCharsets.UTF_8)
                    : imageFile ? "" : documentParser.extractText(multipartFile);
            String text = extractedText;
            if (supplementalContent != null && !supplementalContent.isBlank()) {
                text = text == null || text.isBlank()
                        ? supplementalContent
                        : text + "\n\nNỘI DUNG BỔ SUNG:\n" + supplementalContent;
            }

            job.setStatus(ImportJob.Status.PARSING);
            importJobRepository.save(job);

            GeminiParser.ParseResult result;
            if (imageFile) {
                result = geminiParser.processImage(fileBytes, imageMimeType(fileType), subjectHint,
                        text, mode, questionCount, grade);
            } else if ("pdf".equals(fileType) && (extractedText == null || extractedText.isBlank())) {
                if (text != null && !text.isBlank()) job.setExtractedText(text);
                result = geminiParser.processPdf(
                        fileBytes, subjectHint, text, mode, questionCount, grade);
            } else if (mode == ImportMode.GENERATE) {
                if (text == null || text.isBlank()) {
                    fail(job, "Không đọc được nội dung để tạo câu hỏi");
                    return;
                }
                job.setExtractedText(text);
                result = geminiParser.generateQuestionsFromText(
                        text, subjectHint, grade, questionCount, "COMPREHENSION");
            } else if (text == null || text.isBlank()) {
                fail(job, "Không đọc được nội dung file");
                return;
            } else {
                job.setExtractedText(text);
                result = geminiParser.parse(text, subjectHint);
            }
            saveResult(job, result);
        } catch (BusinessException error) {
            log.warn("Import job {} could not be processed: {}", jobId, error.getMessage());
            fail(job, error.getMessage());
        } catch (Exception error) {
            log.error("Import job {} failed", jobId, error);
            fail(job, "Không thể phân tích nội dung tệp. Hãy kiểm tra định dạng rồi thử lại.");
        }
    }

    private String imageMimeType(String fileType) {
        return switch (fileType) {
            case "png" -> "image/png";
            case "webp" -> "image/webp";
            default -> "image/jpeg";
        };
    }

    private void saveResult(ImportJob job, GeminiParser.ParseResult result) throws Exception {
        job.setParsedResult(objectMapper.writeValueAsString(result.questions()));
        job.setTotalFound(result.questions().size());
        job.setAiModel(aiModel);
        job.setAiTokensUsed(result.tokensUsed());
        job.setStatus(ImportJob.Status.REVIEW);
        job.setFinishedAt(LocalDateTime.now());
        importJobRepository.save(job);
        log.info("Import job {} parsed {} questions", job.getId(), result.questions().size());
    }

    private void fail(ImportJob job, String message) {
        job.setStatus(ImportJob.Status.FAILED);
        job.setErrorMessage(message);
        job.setFinishedAt(LocalDateTime.now());
        importJobRepository.save(job);
    }

    private static class StoredMultipartFile implements MultipartFile {
        private final String name;
        private final byte[] content;

        private StoredMultipartFile(String name, byte[] content) {
            this.name = name;
            this.content = content;
        }

        @Override public String getName() { return name; }
        @Override public String getOriginalFilename() { return name; }
        @Override public String getContentType() { return null; }
        @Override public boolean isEmpty() { return content.length == 0; }
        @Override public long getSize() { return content.length; }
        @Override public byte[] getBytes() { return content.clone(); }
        @Override public java.io.InputStream getInputStream() {
            return new java.io.ByteArrayInputStream(content);
        }
        @Override public void transferTo(java.io.File destination) throws java.io.IOException {
            Files.write(destination.toPath(), content);
        }
    }
}
