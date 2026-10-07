package vn.exa.submission;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.security.crypto.password.PasswordEncoder;
import vn.exa.common.BusinessException;
import vn.exa.exam.AutoGradeService;
import vn.exa.exam.Exam;
import vn.exa.exam.ExamRepository;
import vn.exa.exam.ExamQuestionRepository;
import vn.exa.classroom.ClassroomMember;
import vn.exa.classroom.ClassroomMemberRepository;
import vn.exa.question.Question;
import vn.exa.question.QuestionRepository;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class SubmissionService {

    private final SubmissionRepository submissionRepository;
    private final ProctorEventRepository proctorEventRepository;
    private final ExamRepository examRepository;
    private final QuestionRepository questionRepository;
    private final AutoGradeService autoGradeService;
    private final ObjectMapper objectMapper;
    private final PasswordEncoder passwordEncoder;
    private final ExamQuestionRepository examQuestionRepository;
    private final ClassroomMemberRepository classroomMemberRepository;

    /**
     * Bắt đầu phiên thi — tạo submission với status IN_PROGRESS.
     */
    @Transactional
    public Submission start(Long examId, Long studentId, String password) {
        Exam exam = examRepository.findByIdAndDeletedAtIsNull(examId)
                .orElseThrow(() -> BusinessException.notFound("Đề thi không tồn tại"));

        if (exam.getStatus() != Exam.Status.OPEN) {
            throw BusinessException.badRequest("Đề thi chưa mở hoặc đã đóng");
        }
        if (exam.getClassroomId() != null
                && !classroomMemberRepository.existsByClassroomIdAndStudentIdAndStatus(
                        exam.getClassroomId(), studentId, ClassroomMember.Status.ACTIVE)) {
            throw BusinessException.forbidden("Bạn chưa tham gia lớp được giao đề thi này");
        }
        if (exam.getPasswordHash() != null
                && (password == null || !passwordEncoder.matches(password, exam.getPasswordHash()))) {
            throw BusinessException.forbidden("Mật khẩu đề thi không chính xác");
        }

        // Kiểm tra số lần làm bài
        int currentAttempts = Math.toIntExact(
                submissionRepository.countByExamIdAndStudentId(examId, studentId));

        if (currentAttempts >= exam.getMaxAttempts()) {
            throw BusinessException.badRequest("Bạn đã hết số lần làm bài");
        }

        Submission sub = Submission.builder()
                .examId(examId)
                .studentId(studentId)
                .attemptNumber(currentAttempts + 1)
                .startedAt(LocalDateTime.now())
                .status(Submission.Status.IN_PROGRESS)
                .build();

        sub = submissionRepository.save(sub);
        log.info("Submission started: examId={}, studentId={}, submissionId={}",
                examId, studentId, sub.getId());
        return sub;
    }

    /**
     * Nộp bài — chấm điểm tự động cho trắc nghiệm.
     */
    @Transactional
    public Submission submit(Long submissionId, Long studentId, Map<Long, String> answers) {
        Submission sub = submissionRepository.findByIdAndStudentId(submissionId, studentId)
                .orElseThrow(() -> BusinessException.notFound("Không tìm thấy bài nộp"));

        if (sub.getStatus() != Submission.Status.IN_PROGRESS) {
            throw BusinessException.badRequest("Bài đã được nộp rồi");
        }

        List<Long> examQuestionIds = examQuestionRepository.findByExamIdOrderByOrderIndexAsc(sub.getExamId())
                .stream().map(link -> link.getQuestionId()).toList();
        if (answers == null) {
            throw BusinessException.badRequest("Danh sách câu trả lời không hợp lệ");
        }
        if (answers.keySet().stream().anyMatch(questionId -> !examQuestionIds.contains(questionId))) {
            throw BusinessException.badRequest("Bài nộp chứa câu hỏi không thuộc đề thi");
        }
        try {
            sub.setAnswers(objectMapper.writeValueAsString(answers));
        } catch (Exception e) {
            throw new IllegalStateException("Không thể lưu đáp án bài thi", e);
        }
        List<Question> questions = questionRepository.findAllById(examQuestionIds);
        BigDecimal score = autoGradeService.grade(questions, answers);
        boolean hasEssay = questions.stream().anyMatch(question -> question.getType() == Question.Type.ESSAY);
        sub.setTotalScore(hasEssay ? null : score);

        LocalDateTime now = LocalDateTime.now();
        sub.setSubmittedAt(now);
        sub.setDurationSec((int) java.time.Duration.between(sub.getStartedAt(), now).getSeconds());
        sub.setStatus(Submission.Status.SUBMITTED);

        sub = submissionRepository.save(sub);
        log.info("Submission submitted: id={}, score={}", submissionId, score);
        return sub;
    }

    @Transactional
    public Submission saveAnswers(Long submissionId, Long studentId, Map<Long, String> answers) {
        Submission sub = submissionRepository.findByIdAndStudentId(submissionId, studentId)
                .orElseThrow(() -> BusinessException.notFound("Không tìm thấy bài thi"));
        if (sub.getStatus() != Submission.Status.IN_PROGRESS) {
            throw BusinessException.badRequest("Bài thi đã được nộp, không thể lưu đáp án");
        }
        if (answers == null || answers.isEmpty()) {
            return sub;
        }
        List<Long> examQuestionIds = examQuestionRepository.findByExamIdOrderByOrderIndexAsc(sub.getExamId())
                .stream().map(link -> link.getQuestionId()).toList();
        if (answers.keySet().stream().anyMatch(questionId -> !examQuestionIds.contains(questionId))) {
            throw BusinessException.badRequest("Đáp án chứa câu hỏi không thuộc đề thi");
        }
        Map<Long, String> merged = new HashMap<>();
        if (sub.getAnswers() != null && !sub.getAnswers().isBlank()) {
            try {
                Map<String, String> saved = objectMapper.readValue(sub.getAnswers(),
                        objectMapper.getTypeFactory().constructMapType(HashMap.class, String.class, String.class));
                saved.forEach((key, value) -> merged.put(Long.valueOf(key), value));
            } catch (Exception e) {
                throw new IllegalStateException("Dữ liệu đáp án đã lưu không hợp lệ", e);
            }
        }
        merged.putAll(answers);
        try {
            sub.setAnswers(objectMapper.writeValueAsString(merged));
        } catch (Exception e) {
            throw new IllegalStateException("Không thể lưu đáp án", e);
        }
        return submissionRepository.save(sub);
    }

    /**
     * Lấy submission theo id.
     */
    public Submission getById(Long id, Long studentId) {
        return submissionRepository.findByIdAndStudentId(id, studentId)
                .orElseThrow(() -> BusinessException.notFound("Không tìm thấy bài nộp"));
    }

    public SubmissionReview getReview(Long submissionId, Long studentId) {
        Submission submission = getById(submissionId, studentId);
        if (submission.getStatus() == Submission.Status.IN_PROGRESS) {
            throw BusinessException.forbidden("Bạn chỉ có thể xem lại bài sau khi nộp");
        }
        Exam exam = examRepository.findByIdAndDeletedAtIsNull(submission.getExamId())
                .orElseThrow(() -> BusinessException.notFound("Đề thi không tồn tại"));
        String answerPolicy = exam.getShowAnswerAfter() == null ? "AFTER_SUBMIT" : exam.getShowAnswerAfter();
        boolean revealAnswers = switch (answerPolicy) {
            case "AFTER_SUBMIT" -> true;
            case "AFTER_CLOSE" -> exam.getStatus() == Exam.Status.CLOSED;
            default -> false;
        };
        Map<String, String> savedAnswers;
        try {
            savedAnswers = submission.getAnswers() == null
                    ? Map.of()
                    : objectMapper.readValue(submission.getAnswers(),
                            objectMapper.getTypeFactory().constructMapType(HashMap.class, String.class, String.class));
        } catch (Exception e) {
            throw new IllegalStateException("Không thể đọc câu trả lời của bài thi", e);
        }
        List<ReviewQuestion> questions = examQuestionRepository.findByExamIdOrderByOrderIndexAsc(exam.getId()).stream()
                .map(link -> questionRepository.findByIdAndDeletedAtIsNull(link.getQuestionId())
                        .orElseThrow(() -> BusinessException.notFound("Câu hỏi không còn tồn tại")))
                .map(question -> {
                    String answer = savedAnswers.get(String.valueOf(question.getId()));
                    return new ReviewQuestion(question.getId(), question.getType().name(),
                            question.getContent(), question.getOptions(), answer,
                            revealAnswers ? question.getCorrectAnswer() : null,
                            revealAnswers ? question.getAnswerText() : null,
                            revealAnswers ? question.getExplanation() : null);
                }).toList();
        boolean needsManualGrading = submission.getStatus() == Submission.Status.SUBMITTED
                && questions.stream().anyMatch(question -> question.type().equals(Question.Type.ESSAY.name()));
        return new SubmissionReview(exam.getTitle(), submission.getTotalScore(), submission.getDurationSec(),
                revealAnswers, needsManualGrading, submission.getTeacherFeedback(), questions);
    }

    /**
     * Danh sách bài nộp của 1 đề (cho giáo viên).
     */
    public List<Submission> listByExam(Long examId, Long teacherId, boolean admin) {
        Exam exam = examRepository.findByIdAndDeletedAtIsNull(examId)
                .orElseThrow(() -> BusinessException.notFound("Đề thi không tồn tại"));
        if (!admin && !exam.getOwnerId().equals(teacherId)) {
            throw BusinessException.forbidden("Bạn không có quyền xem bài nộp của đề thi này");
        }
        return submissionRepository.findByExamIdOrderBySubmittedAtDesc(examId);
    }

    public List<Submission> listByStudent(Long studentId) {
        return submissionRepository.findByStudentIdOrderBySubmittedAtDesc(studentId);
    }

    public List<GradingItem> gradingQueue(Long teacherId) {
        return examRepository.findByOwnerIdAndDeletedAtIsNullOrderByCreatedAtDesc(teacherId).stream()
                .flatMap(exam -> {
                    List<ReviewQuestion> essayQuestions = examQuestionRepository
                            .findByExamIdOrderByOrderIndexAsc(exam.getId()).stream()
                            .map(link -> questionRepository.findByIdAndDeletedAtIsNull(link.getQuestionId())
                                    .orElse(null))
                            .filter(question -> question != null && question.getType() == Question.Type.ESSAY)
                            .map(question -> new ReviewQuestion(question.getId(), question.getType().name(),
                                    question.getContent(), question.getOptions(), null,
                                    null, null, null))
                            .toList();
                    if (essayQuestions.isEmpty()) return java.util.stream.Stream.empty();
                    return submissionRepository.findByExamIdOrderBySubmittedAtDesc(exam.getId()).stream()
                            .filter(submission -> submission.getStatus() == Submission.Status.SUBMITTED)
                            .map(submission -> {
                                Map<String, String> answers = readAnswers(submission.getAnswers());
                                List<ReviewQuestion> responses = essayQuestions.stream()
                                        .map(question -> new ReviewQuestion(question.id(), question.type(),
                                                question.content(), question.options(),
                                                answers.get(String.valueOf(question.id())),
                                                null, null, null))
                                        .toList();
                                return new GradingItem(submission.getId(), exam.getId(), exam.getTitle(),
                                        submission.getStudentId(), submission.getSubmittedAt(),
                                        submission.getTotalScore(), responses);
                            });
                })
                .toList();
    }

    @Transactional
    public Submission grade(Long submissionId, Long teacherId, BigDecimal score, String feedback) {
        Submission submission = submissionRepository.findById(submissionId)
                .orElseThrow(() -> BusinessException.notFound("Không tìm thấy bài nộp"));
        Exam exam = examRepository.findByIdAndDeletedAtIsNull(submission.getExamId())
                .orElseThrow(() -> BusinessException.notFound("Đề thi không tồn tại"));
        if (!exam.getOwnerId().equals(teacherId)) {
            throw BusinessException.forbidden("Bạn không có quyền chấm bài này");
        }
        boolean hasEssayQuestion = examQuestionRepository.findByExamIdOrderByOrderIndexAsc(exam.getId()).stream()
                .map(link -> questionRepository.findByIdAndDeletedAtIsNull(link.getQuestionId()).orElse(null))
                .anyMatch(question -> question != null && question.getType() == Question.Type.ESSAY);
        if (!hasEssayQuestion) {
            throw BusinessException.badRequest("Đề thi này không có câu tự luận cần chấm");
        }
        if (submission.getStatus() != Submission.Status.SUBMITTED) {
            throw BusinessException.badRequest("Bài thi không còn ở trạng thái chờ chấm");
        }
        submission.setTotalScore(score);
        submission.setTeacherFeedback(feedback);
        submission.setStatus(Submission.Status.GRADED);
        return submissionRepository.save(submission);
    }

    private Map<String, String> readAnswers(String json) {
        if (json == null || json.isBlank()) return Map.of();
        try {
            return objectMapper.readValue(json,
                    objectMapper.getTypeFactory().constructMapType(HashMap.class, String.class, String.class));
        } catch (Exception e) {
            throw new IllegalStateException("Không thể đọc câu trả lời của bài thi", e);
        }
    }

    /**
     * Ghi sự kiện proctor (tab switch, copy, v.v.).
     */
    @Transactional
    public ProctorEvent logProctorEvent(Long submissionId, Long studentId, ProctorEvent.EventType type,
                                         ProctorEvent.Severity severity, String payload) {
        Submission submission = submissionRepository.findByIdAndStudentId(submissionId, studentId)
                .orElseThrow(() -> BusinessException.notFound("Không tìm thấy bài thi"));
        if (submission.getStatus() != Submission.Status.IN_PROGRESS) {
            throw BusinessException.badRequest("Không thể ghi sự kiện cho bài thi đã nộp");
        }
        ProctorEvent event = ProctorEvent.builder()
                .submissionId(submissionId)
                .eventType(type)
                .severity(severity)
                .occurredAt(LocalDateTime.now())
                .payload(payload)
                .build();
        return proctorEventRepository.save(event);
    }

    /**
     * Lấy tất cả proctor events của submission.
     */
    public List<ProctorEvent> getProctorEvents(Long submissionId) {
        return proctorEventRepository.findBySubmissionIdOrderByOccurredAtDesc(submissionId);
    }

    public Map<String, Long> getProctorSummary(Long submissionId, Long userId, boolean teacher, boolean admin) {
        Submission submission = submissionRepository.findById(submissionId)
                .orElseThrow(() -> BusinessException.notFound("Không tìm thấy bài nộp"));
        if (teacher) {
            Exam exam = examRepository.findByIdAndDeletedAtIsNull(submission.getExamId())
                    .orElseThrow(() -> BusinessException.notFound("Đề thi không tồn tại"));
            if (!admin && !exam.getOwnerId().equals(userId)) {
                throw BusinessException.forbidden("Bạn không có quyền xem nhật ký giám sát này");
            }
        } else if (!submission.getStudentId().equals(userId)) {
            throw BusinessException.forbidden("Bạn không có quyền xem nhật ký giám sát này");
        }
        return getProctorSummary(submissionId);
    }

    public record SubmissionReview(String examTitle, BigDecimal totalScore, Integer durationSec,
                                   boolean answersRevealed, boolean needsManualGrading,
                                   String teacherFeedback, List<ReviewQuestion> questions) {}

    public record GradingItem(Long submissionId, Long examId, String examTitle, Long studentId,
                              LocalDateTime submittedAt, BigDecimal currentScore,
                              List<ReviewQuestion> essayResponses) {}

    public record ReviewQuestion(Long id, String type, String content, String options,
                                 String studentAnswer, String correctAnswer,
                                 String answerText, String explanation) {}

    /**
     * Thống kê proctor theo loại sự kiện.
     */
    public Map<String, Long> getProctorSummary(Long submissionId) {
        List<ProctorEvent> events = getProctorEvents(submissionId);
        Map<String, Long> summary = new HashMap<>();
        for (ProctorEvent e : events) {
            summary.merge(e.getEventType().name(), 1L, Long::sum);
        }
        return summary;
    }
}