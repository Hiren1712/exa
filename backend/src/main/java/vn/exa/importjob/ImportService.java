package vn.exa.importjob;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import vn.exa.common.BusinessException;
import vn.exa.question.Question;
import vn.exa.question.QuestionRepository;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class ImportService {

    private final ImportJobRepository importJobRepo;
    private final ImportProcessingService importProcessingService;
    private final QuestionRepository questionRepo;
    private final ObjectMapper objectMapper;

    public Long uploadAndProcess(MultipartFile file, Long userId, String subjectHint) {
        validateFile(file);

        try {
            String storagePath = saveFile(file, userId);

            ImportJob job = ImportJob.builder()
                    .userId(userId)
                    .originalName(file.getOriginalFilename())
                    .storagePath(storagePath)
                    .fileType(getExtension(file.getOriginalFilename()).toLowerCase())
                    .fileSize(file.getSize())
                    .status(ImportJob.Status.UPLOADED)
                    .build();

            job = importJobRepo.save(job);
            importProcessingService.processAsync(job.getId(), subjectHint);
            return job.getId();
        } catch (BusinessException be) {
            throw be;
        } catch (Exception error) {
            log.error("Upload failed for user {}", userId, error);
            throw BusinessException.badRequest("Upload thất bại. Vui lòng thử lại.");
        }
    }

    public ImportPreviewResponse getPreview(Long jobId, Long userId) {
        ImportJob job = importJobRepo.findByIdAndUserId(jobId, userId)
                .orElseThrow(() -> BusinessException.notFound("Job không tồn tại"));

        List<ParsedQuestion> questions = parseJsonArray(job.getParsedResult());

        ImportPreviewResponse resp = new ImportPreviewResponse();
        resp.setJobId(jobId);
        resp.setOriginalName(job.getOriginalName());
        resp.setStatus(job.getStatus().name());
        resp.setTotalFound(job.getTotalFound());
        resp.setQuestions(questions);
        resp.setErrorMessage(job.getErrorMessage());
        return resp;
    }

    @Transactional
    public int saveToBank(Long jobId, Long userId, List<ParsedQuestion> selected,
                          String subject, Integer grade, String unit) {
        ImportJob job = importJobRepo.findByIdAndUserId(jobId, userId)
                .orElseThrow(() -> BusinessException.notFound("Job không tồn tại"));
        if (job.getStatus() != ImportJob.Status.REVIEW) {
            throw BusinessException.badRequest("Chỉ có thể lưu câu hỏi sau khi hoàn tất bước xem trước");
        }
        if (selected == null || selected.isEmpty() || subject == null || subject.isBlank()) {
            throw BusinessException.badRequest("Cần chọn câu hỏi và môn học trước khi lưu");
        }

        int saved = 0;
        for (ParsedQuestion pq : selected) {
            if (pq.getContent() == null || pq.getContent().isBlank()) {
                throw BusinessException.badRequest("Nội dung câu hỏi không được để trống");
            }
            Question q = Question.builder()
                    .ownerId(userId)
                    .subject(subject)
                    .grade(grade)
                    .unit(unit)
                    .difficulty(mapDifficulty(pq.getDifficulty()))
                    .type(mapType(pq.getType()))
                    .content(pq.getContent())
                    .contentHtml(pq.getContent())
                    .options(toJson(pq.getOptions()))
                    .correctAnswer(pq.getCorrectAnswer())
                    .answerText(pq.getAnswerText())
                    .explanation(pq.getExplanation())
                    .aiGenerated(true)
                    .build();
            questionRepo.save(q);
            saved++;
        }

        job.setStatus(ImportJob.Status.IMPORTED);
        job.setTotalImported(saved);
        importJobRepo.save(job);

        log.info("Saved {} questions to bank from job {}", saved, jobId);
        return saved;
    }

    private void validateFile(MultipartFile file) {
        if (file.isEmpty()) throw BusinessException.badRequest("File trống");
        long maxSize = 20L * 1024 * 1024;
        if (file.getSize() > maxSize) throw BusinessException.badRequest("File quá lớn (tối đa 20MB)");
        String ext = getExtension(file.getOriginalFilename()).toLowerCase();
        if (!List.of("docx", "pdf", "xlsx", "xls").contains(ext)) {
            throw BusinessException.badRequest("Định dạng không hỗ trợ. Chỉ nhận docx, pdf, xlsx hoặc xls");
        }
    }

    private String saveFile(MultipartFile file, Long userId) throws Exception {
        Path uploadDir = Paths.get("./uploads/imports/" + userId);
        Files.createDirectories(uploadDir);
        String filename = UUID.randomUUID() + "." + getExtension(file.getOriginalFilename()).toLowerCase();
        Path target = uploadDir.resolve(filename);
        file.transferTo(target.toFile());
        return target.toString();
    }

    private List<ParsedQuestion> parseJsonArray(String json) {
        if (json == null || json.isBlank()) return List.of();
        try {
            return objectMapper.readValue(json,
                    objectMapper.getTypeFactory().constructCollectionType(List.class, ParsedQuestion.class));
        } catch (Exception e) {
            throw new IllegalStateException("Dữ liệu xem trước câu hỏi không hợp lệ", e);
        }
    }

    private Question.Difficulty mapDifficulty(String aiValue) {
        if (aiValue == null) return Question.Difficulty.RECOGNITION;
        return switch (aiValue) {
            case "COMPREHENSION" -> Question.Difficulty.COMPREHENSION;
            case "APPLICATION" -> Question.Difficulty.APPLICATION;
            case "HIGH_APPLICATION" -> Question.Difficulty.HIGH_APPLICATION;
            default -> Question.Difficulty.RECOGNITION;
        };
    }

    private Question.Type mapType(String aiValue) {
        if (aiValue == null) return Question.Type.MCQ;
        return switch (aiValue) {
            case "TRUE_FALSE" -> Question.Type.TRUE_FALSE;
            case "SHORT_ANSWER" -> Question.Type.SHORT_ANSWER;
            case "ESSAY" -> Question.Type.ESSAY;
            default -> Question.Type.MCQ;
        };
    }

    private String toJson(List<String> list) {
        if (list == null || list.isEmpty()) return null;
        try {
            return objectMapper.writeValueAsString(list);
        } catch (Exception e) {
            return null;
        }
    }

    private String getExtension(String name) {
        if (name == null) return "";
        int i = name.lastIndexOf('.');
        return i >= 0 ? name.substring(i + 1) : "";
    }

}