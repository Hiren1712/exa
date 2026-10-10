package vn.exa.exam;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.security.crypto.password.PasswordEncoder;
import vn.exa.common.BusinessException;
import vn.exa.question.QuestionRepository;
import vn.exa.submission.SubmissionRepository;
import vn.exa.question.Question;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class ExamService {

    private final ExamRepository examRepository;
    private final ExamQuestionRepository examQuestionRepository;
    private final QuestionRepository questionRepository;
    private final PasswordEncoder passwordEncoder;
    private final SubmissionRepository submissionRepository;

    public List<Exam> listByOwner(Long ownerId) {
        return examRepository.findByOwnerIdAndDeletedAtIsNullOrderByCreatedAtDesc(ownerId);
    }

    public List<Exam> listAvailableForStudent(List<Long> classroomIds) {
        return examRepository.findByStatusAndDeletedAtIsNull(Exam.Status.OPEN).stream()
                .filter(exam -> exam.getClassroomId() == null
                        || classroomIds.contains(exam.getClassroomId()))
                .toList();
    }

    public long countSubmissions(Long examId) {
        return submissionRepository.countByExamId(examId);
    }

    public Exam getById(Long id) {
        return examRepository.findByIdAndDeletedAtIsNull(id)
                .orElseThrow(() -> BusinessException.notFound("Đề thi không tồn tại"));
    }

    @Transactional
    public Exam create(Long ownerId, ExamRequest req) {
        Exam exam = Exam.builder()
                .ownerId(ownerId)
                .classroomId(req.getClassroomId())
                .title(req.getTitle())
                .description(req.getDescription())
                .subject(req.getSubject())
                .durationMin(req.getDurationMin() != null ? req.getDurationMin() : 45)
                .totalPoints(req.getTotalPoints() != null ? req.getTotalPoints() : BigDecimal.TEN)
                .status(Exam.Status.DRAFT)
                .shuffleQuestions(req.getShuffleQuestions() != null ? req.getShuffleQuestions() : true)
                .shuffleOptions(req.getShuffleOptions() != null ? req.getShuffleOptions() : true)
                .proctorEnabled(req.getProctorEnabled() != null ? req.getProctorEnabled() : true)
                .lockScreen(req.getLockScreen() != null ? req.getLockScreen() : false)
                .maxAttempts(req.getMaxAttempts() != null ? req.getMaxAttempts() : 1)
                .showAnswerAfter(req.getShowAnswerAfter() != null ? req.getShowAnswerAfter() : "AFTER_SUBMIT")
                .passwordHash(req.getPassword() == null || req.getPassword().isBlank()
                        ? null : passwordEncoder.encode(req.getPassword()))
                .build();

        exam = examRepository.save(exam);
        if (req.getQuestionIds() != null) syncQuestions(exam, ownerId, req.getQuestionIds());
        log.info("Exam created: id={}, title={}", exam.getId(), exam.getTitle());
        return exam;
    }

    @Transactional
    public Exam update(Long id, Long ownerId, ExamRequest req) {
        Exam exam = getById(id);
        if (!exam.getOwnerId().equals(ownerId)) {
            throw BusinessException.forbidden("Bạn không có quyền sửa đề này");
        }

        exam.setTitle(req.getTitle());
        exam.setDescription(req.getDescription());
        exam.setSubject(req.getSubject());
        exam.setClassroomId(req.getClassroomId());
        if (req.getDurationMin() != null) exam.setDurationMin(req.getDurationMin());
        if (req.getTotalPoints() != null) exam.setTotalPoints(req.getTotalPoints());
        if (req.getShuffleQuestions() != null) exam.setShuffleQuestions(req.getShuffleQuestions());
        if (req.getShuffleOptions() != null) exam.setShuffleOptions(req.getShuffleOptions());
        if (req.getProctorEnabled() != null) exam.setProctorEnabled(req.getProctorEnabled());
        if (req.getLockScreen() != null) exam.setLockScreen(req.getLockScreen());
        if (req.getMaxAttempts() != null) exam.setMaxAttempts(req.getMaxAttempts());
        if (req.getShowAnswerAfter() != null) exam.setShowAnswerAfter(req.getShowAnswerAfter());
        if (req.getPassword() != null && !req.getPassword().isBlank()) {
            exam.setPasswordHash(passwordEncoder.encode(req.getPassword()));
        }

        if (req.getQuestionIds() != null) syncQuestions(exam, ownerId, req.getQuestionIds());
        return examRepository.save(exam);
    }

    @Transactional
    public void publish(Long id, Long ownerId) {
        Exam exam = getById(id);
        if (!exam.getOwnerId().equals(ownerId)) {
            throw BusinessException.forbidden("Bạn không có quyền công khai đề này");
        }
        exam.setStatus(Exam.Status.OPEN);
        examRepository.save(exam);
        log.info("Exam published: id={}", id);
    }

    @Transactional
    public void close(Long id, Long ownerId) {
        Exam exam = getById(id);
        if (!exam.getOwnerId().equals(ownerId)) {
            throw BusinessException.forbidden("Bạn không có quyền đóng đề này");
        }
        exam.setStatus(Exam.Status.CLOSED);
        examRepository.save(exam);
    }

    @Transactional
    public void delete(Long id, Long ownerId) {
        Exam exam = getById(id);
        if (!exam.getOwnerId().equals(ownerId)) {
            throw BusinessException.forbidden("Bạn không có quyền xóa đề này");
        }
        exam.setDeletedAt(LocalDateTime.now());
        examRepository.save(exam);
    }

    public List<Question> listQuestions(Long examId) {
        return examQuestionRepository.findByExamIdOrderByOrderIndexAsc(examId).stream()
                .map(link -> questionRepository.findByIdAndDeletedAtIsNull(link.getQuestionId())
                        .orElse(null))
                .filter(java.util.Objects::nonNull)
                .toList();
    }

    public boolean isOwner(Long examId, Long ownerId) {
        return getById(examId).getOwnerId().equals(ownerId);
    }

    public boolean passwordMatches(Exam exam, String password) {
        if (exam.getPasswordHash() == null) return true;
        return password != null && passwordEncoder.matches(password, exam.getPasswordHash());
    }

    public List<Long> listQuestionIds(Long examId) {
        return examQuestionRepository.findByExamIdOrderByOrderIndexAsc(examId).stream()
                .map(ExamQuestion::getQuestionId).toList();
    }

    public java.util.Map<Long, BigDecimal> listQuestionPoints(Long examId) {
        return examQuestionRepository.findByExamIdOrderByOrderIndexAsc(examId).stream()
                .collect(java.util.stream.Collectors.toMap(ExamQuestion::getQuestionId, ExamQuestion::getPoints));
    }

    @Transactional
    public void addQuestions(Long examId, Long ownerId, List<Long> questionIds) {
        Exam exam = getById(examId);
        requireOwner(exam, ownerId);
        if (questionIds == null || questionIds.isEmpty()) {
            throw BusinessException.badRequest("Chọn ít nhất một câu hỏi");
        }
        List<Long> current = examQuestionRepository.findByExamIdOrderByOrderIndexAsc(examId).stream()
                .map(ExamQuestion::getQuestionId).collect(java.util.stream.Collectors.toCollection(ArrayList::new));
        current.addAll(questionIds);
        syncQuestions(exam, ownerId, current);
    }

    @Transactional
    public void removeQuestion(Long examId, Long questionId, Long ownerId) {
        Exam exam = getById(examId);
        requireOwner(exam, ownerId);
        examQuestionRepository.deleteByExamIdAndQuestionId(examId, questionId);
        reorder(examId, ownerId, examQuestionRepository.findByExamIdOrderByOrderIndexAsc(examId).stream()
                .map(ExamQuestion::getQuestionId).toList());
    }

    @Transactional
    public void reorder(Long examId, Long ownerId, List<Long> questionIds) {
        Exam exam = getById(examId);
        requireOwner(exam, ownerId);
        List<Long> existing = examQuestionRepository.findByExamIdOrderByOrderIndexAsc(examId).stream()
                .map(ExamQuestion::getQuestionId).toList();
        if (questionIds == null || questionIds.size() != existing.size()
                || new HashSet<>(questionIds).size() != existing.size()
                || !new HashSet<>(questionIds).equals(new HashSet<>(existing))) {
            throw BusinessException.badRequest("Thứ tự câu hỏi phải chứa chính xác các câu đang có trong đề");
        }
        List<ExamQuestion> links = examQuestionRepository.findByExamIdOrderByOrderIndexAsc(examId);
        java.util.Map<Long, ExamQuestion> byQuestion = links.stream()
                .collect(java.util.stream.Collectors.toMap(ExamQuestion::getQuestionId, link -> link));
        for (int index = 0; index < questionIds.size(); index++) {
            byQuestion.get(questionIds.get(index)).setOrderIndex(index);
        }
        examQuestionRepository.saveAll(links);
    }

    private void syncQuestions(Exam exam, Long ownerId, List<Long> questionIds) {
        if (questionIds.size() > 500 || new HashSet<>(questionIds).size() != questionIds.size()) {
            throw BusinessException.badRequest("Danh sách câu hỏi không hợp lệ");
        }
        List<Question> questions = questionRepository.findAllById(questionIds);
        if (questions.size() != questionIds.size()
                || questions.stream().anyMatch(question ->
                !question.getOwnerId().equals(ownerId) || question.getDeletedAt() != null)) {
            throw BusinessException.forbidden("Một hoặc nhiều câu hỏi không tồn tại hoặc không thuộc quyền của bạn");
        }
        examQuestionRepository.deleteByExamId(exam.getId());
        if (questions.isEmpty()) return;

        BigDecimal totalPoints = exam.getTotalPoints() == null ? BigDecimal.TEN : exam.getTotalPoints();
        BigDecimal pointsEach = totalPoints.divide(BigDecimal.valueOf(questions.size()), 2, RoundingMode.DOWN);
        BigDecimal assigned = BigDecimal.ZERO;
        List<ExamQuestion> links = new ArrayList<>();
        for (int index = 0; index < questions.size(); index++) {
            BigDecimal points = index == questions.size() - 1
                    ? totalPoints.subtract(assigned) : pointsEach;
            assigned = assigned.add(points);
            links.add(ExamQuestion.builder().examId(exam.getId())
                    .questionId(questions.get(index).getId()).orderIndex(index).points(points).build());
        }
        examQuestionRepository.saveAll(links);
    }

    private void requireOwner(Exam exam, Long ownerId) {
        if (!exam.getOwnerId().equals(ownerId)) {
            throw BusinessException.forbidden("Bạn không có quyền sửa đề này");
        }
    }

    // ===== DTO =====
    @lombok.Data
    public static class ExamRequest {
        @NotBlank
        @Size(max = 200)
        private String title;
        @Size(max = 4000)
        private String description;
        @NotBlank
        @Size(max = 60)
        private String subject;
        private Long classroomId;
        @Min(1)
        @Max(600)
        private Integer durationMin;
        @DecimalMin("1.0")
        @DecimalMax("100.0")
        private BigDecimal totalPoints;
        private Boolean shuffleQuestions;
        private Boolean shuffleOptions;
        private Boolean proctorEnabled;
        private Boolean lockScreen;
        @Min(1)
        @Max(20)
        private Integer maxAttempts;
        @Size(max = 128)
        private String password;
        @Pattern(regexp = "AFTER_SUBMIT|AFTER_CLOSE|NEVER")
        private String showAnswerAfter;
        private List<Long> questionIds;
    }
}