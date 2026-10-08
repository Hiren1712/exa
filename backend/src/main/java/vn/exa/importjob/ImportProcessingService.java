package vn.exa.importjob;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
@Slf4j
public class ImportProcessingService {

    private final ImportJobRepository importJobRepository;
    private final DocumentParser documentParser;
    private final GeminiParser geminiParser;
    private final ObjectMapper objectMapper;

    @Async("importTaskExecutor")
    public void processAsync(Long jobId, String subjectHint) {
        ImportJob job = importJobRepository.findById(jobId)
                .orElseThrow(() -> new IllegalStateException("Import job disappeared before processing"));
        try {
            job.setStatus(ImportJob.Status.EXTRACTING);
            job.setStartedAt(LocalDateTime.now());
            importJobRepository.save(job);

            Path path = Paths.get(job.getStoragePath());
            if (!Files.exists(path)) {
                fail(job, "Không tìm thấy file");
                return;
            }

            MultipartFile multipartFile = new StoredMultipartFile(
                    job.getOriginalName(), Files.readAllBytes(path));
            String text = documentParser.extractText(multipartFile);
            if (text == null || text.isBlank()) {
                fail(job, "Không đọc được nội dung file");
                return;
            }

            job.setExtractedText(text);
            job.setStatus(ImportJob.Status.PARSING);
            importJobRepository.save(job);

            GeminiParser.ParseResult result = geminiParser.parse(text, subjectHint);
            job.setParsedResult(objectMapper.writeValueAsString(result.questions()));
            job.setTotalFound(result.questions().size());
            job.setAiModel("gemini-1.5-flash");
            job.setAiTokensUsed(result.tokensUsed());
            job.setStatus(ImportJob.Status.REVIEW);
            job.setFinishedAt(LocalDateTime.now());
            importJobRepository.save(job);
            log.info("Import job {} parsed {} questions", jobId, result.questions().size());
        } catch (Exception error) {
            log.error("Import job {} failed", jobId, error);
            fail(job, "Không thể phân tích nội dung tệp");
        }
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
