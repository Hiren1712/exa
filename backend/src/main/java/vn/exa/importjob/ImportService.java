package vn.exa.importjob;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
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
import java.util.Locale;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class ImportService {

    private final ImportJobRepository importJobRepo;
    private final ImportProcessingService importProcessingService;
    private final GeminiParser geminiParser;
    private final QuestionRepository questionRepo;
    private final ObjectMapper objectMapper;

    @Value("${exa.storage.upload-dir:./uploads}")
    private String uploadDir;

    public Long uploadAndProcess(MultipartFile file, Long userId, String subjectHint) {
        validateFile(file);
        geminiParser.validateConfiguration();

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
        if (subject.length() > 60 || (grade != null && (grade < 1 || grade > 12))
                || (unit != null && unit.length() > 120)) {
            throw BusinessException.badRequest("Môn học, khối lớp hoặc chuyên đề không hợp lệ");
        }

        int saved = 0;
        for (ParsedQuestion pq : selected) {
            if (pq == null || pq.getContent() == null || pq.getContent().isBlank()) {
                throw BusinessException.badRequest("Nội dung câu hỏi không được để trống");
            }
            Question.Type type = mapType(pq.getType());
            if (type == Question.Type.MCQ && (pq.getOptions() == null || pq.getOptions().size() < 2)) {
                throw BusinessException.badRequest("Câu trắc nghiệm cần ít nhất 2 phương án");
            }
            if (pq.getOptions() != null && pq.getOptions().stream().anyMatch(option -> option == null || option.isBlank())) {
                throw BusinessException.badRequest("Phương án trả lời không được để trống");
            }
            String correctAnswer = pq.getCorrectAnswer();
            if (correctAnswer != null) {
                correctAnswer = correctAnswer.trim().toUpperCase(Locale.ROOT);
                if (correctAnswer.isEmpty()) correctAnswer = null;
            }
            if (correctAnswer != null) {
                int answerIndex = correctAnswer.charAt(0) - 'A';
                if (!correctAnswer.matches("^[A-D]$")
                        || (pq.getOptions() != null && answerIndex >= pq.getOptions().size())) {
                    throw BusinessException.badRequest("Đáp án đúng phải khớp với các phương án đã nhập");
                }
            }
            Question q = Question.builder()
                    .ownerId(userId)
                    .subject(subject)
                    .grade(grade)
                    .unit(unit)
                    .difficulty(mapDifficulty(pq.getDifficulty()))
                    .type(type)
                    .content(pq.getContent())
                    .options(toJson(pq.getOptions()))
                    .correctAnswer(correctAnswer)
                    .answerText(pq.getAnswerText())
                    .explanation(pq.getExplanation())
                    .aiGenerated(true)
                    .importJobId(jobId)
                    .importReviewed(true)
                    .source("AI import")
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
        if (file == null) throw BusinessException.badRequest("Vui lòng chọn tệp để import");
        if (file.isEmpty()) throw BusinessException.badRequest("File trống");
        long maxSize = 20L * 1024 * 1024;
        if (file.getSize() > maxSize) throw BusinessException.badRequest("File quá lớn (tối đa 20MB)");
        String ext = getExtension(file.getOriginalFilename()).toLowerCase();
        if (!List.of("docx", "pdf", "xlsx", "xls").contains(ext)) {
            throw BusinessException.badRequest("Định dạng không hỗ trợ. Chỉ nhận docx, pdf, xlsx hoặc xls");
        }
    }

    private String saveFile(MultipartFile file, Long userId) throws Exception {
        Path userUploadDir = Paths.get(uploadDir).resolve("imports").resolve(String.valueOf(userId));
        Files.createDirectories(userUploadDir);
        String filename = UUID.randomUUID() + "." + getExtension(file.getOriginalFilename()).toLowerCase();
        Path target = userUploadDir.resolve(filename);
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
        if (aiValue == null || aiValue.isBlank()) return Question.Difficulty.RECOGNITION;
        try {
            return Question.Difficulty.valueOf(aiValue.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException error) {
            throw BusinessException.badRequest("Độ khó của câu hỏi không hợp lệ");
        }
    }

    private Question.Type mapType(String aiValue) {
        if (aiValue == null || aiValue.isBlank()) return Question.Type.MCQ;
        try {
            return Question.Type.valueOf(aiValue.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException error) {
            throw BusinessException.badRequest("Loại câu hỏi không hợp lệ");
        }
    }

    private String toJson(List<String> list) {
        if (list == null || list.isEmpty()) return null;
        try {
            return objectMapper.writeValueAsString(list);
        } catch (Exception e) {
            throw new IllegalStateException("Không thể lưu danh sách đáp án", e);
        }
    }

    private String getExtension(String name) {
        if (name == null) return "";
        int i = name.lastIndexOf('.');
        return i >= 0 ? name.substring(i + 1) : "";
    }

}