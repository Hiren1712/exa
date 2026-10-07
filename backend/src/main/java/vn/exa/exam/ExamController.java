package vn.exa.exam;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import vn.exa.common.ApiResponse;
import vn.exa.common.BusinessException;
import vn.exa.common.CurrentUser;
import vn.exa.classroom.ClassroomMember;
import vn.exa.classroom.ClassroomMemberRepository;
import vn.exa.question.Question;

import java.util.List;

@RestController
@RequestMapping("/v1/exams")
@RequiredArgsConstructor
public class ExamController {

    private final ExamService examService;
    private final ClassroomMemberRepository classroomMemberRepository;

    @GetMapping
    public ResponseEntity<ApiResponse<List<ExamListItem>>> list(@AuthenticationPrincipal CurrentUser user) {
        List<Exam> exams;
        if (user.isStudent()) {
            List<Long> classroomIds = classroomMemberRepository.findByStudentIdAndStatusOrderByJoinedAtDesc(
                            user.getId(), ClassroomMember.Status.ACTIVE).stream()
                    .map(ClassroomMember::getClassroomId).toList();
            exams = examService.listAvailableForStudent(classroomIds);
        } else {
            exams = examService.listByOwner(user.getId());
        }
        List<ExamListItem> items = exams.stream()
                .map(exam -> new ExamListItem(exam.getId(), exam.getTitle(), exam.getSubject(),
                        exam.getClassroomId(), exam.getStatus().name(), exam.getDurationMin(),
                        examService.listQuestionIds(exam.getId()).size(),
                        examService.countSubmissions(exam.getId()), exam.getCreatedAt(),
                        Boolean.TRUE.equals(exam.getProctorEnabled()), Boolean.TRUE.equals(exam.getLockScreen()),
                        exam.getMaxAttempts(), exam.getShowAnswerAfter()))
                .toList();
        return ResponseEntity.ok(ApiResponse.ok(items));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<ExamDetail>> detail(
            @PathVariable Long id, @AuthenticationPrincipal CurrentUser user) {
        Exam exam = examService.getById(id);
        boolean isOwner = exam.getOwnerId().equals(user.getId());
        if (user.isTeacher() && !isOwner && !user.isAdmin()) {
            throw BusinessException.forbidden("Bạn không có quyền xem đề thi này");
        }
        if (user.isStudent()) {
            if (exam.getStatus() != Exam.Status.OPEN) {
                throw BusinessException.badRequest("Đề thi hiện không mở");
            }
            if (exam.getClassroomId() != null
                    && !classroomMemberRepository.existsByClassroomIdAndStudentIdAndStatus(
                    exam.getClassroomId(), user.getId(), ClassroomMember.Status.ACTIVE)) {
                throw BusinessException.forbidden("Bạn chưa tham gia lớp được giao đề thi này");
            }
        }
        boolean includeAnswers = isOwner || user.isAdmin();
        List<QuestionDetail> questions = examService.listQuestions(id).stream()
                .map(question -> QuestionDetail.from(question, includeAnswers))
                .toList();
        ExamDetail result = new ExamDetail(exam.getId(), exam.getTitle(), exam.getDescription(),
                exam.getSubject(), exam.getClassroomId(), exam.getDurationMin(),
                exam.getTotalPoints(), exam.getStatus().name(), exam.getShuffleQuestions(),
                exam.getShuffleOptions(), exam.getProctorEnabled(), exam.getLockScreen(),
                exam.getMaxAttempts(), exam.getShowAnswerAfter(), exam.getCreatedAt(),
                exam.getPasswordHash() != null, questions);
        return ResponseEntity.ok(ApiResponse.ok(result));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('TEACHER','ADMIN')")
    public ResponseEntity<ApiResponse<Exam>> create(
            @Valid @RequestBody ExamService.ExamRequest req,
            @AuthenticationPrincipal CurrentUser user) {
        Exam exam = examService.create(user.getId(), req);
        return ResponseEntity.ok(ApiResponse.ok(exam, "Tạo đề thi thành công"));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('TEACHER','ADMIN')")
    public ResponseEntity<ApiResponse<Exam>> update(
            @PathVariable Long id,
            @Valid @RequestBody ExamService.ExamRequest req,
            @AuthenticationPrincipal CurrentUser user) {
        Exam exam = examService.update(id, user.getId(), req);
        return ResponseEntity.ok(ApiResponse.ok(exam, "Cập nhật thành công"));
    }

    @PatchMapping("/{id}/publish")
    @PreAuthorize("hasAnyRole('TEACHER','ADMIN')")
    public ResponseEntity<ApiResponse<Void>> publish(
            @PathVariable Long id,
            @AuthenticationPrincipal CurrentUser user) {
        examService.publish(id, user.getId());
        return ResponseEntity.ok(ApiResponse.ok(null, "Đã công khai đề thi"));
    }

    @PatchMapping("/{id}/close")
    @PreAuthorize("hasAnyRole('TEACHER','ADMIN')")
    public ResponseEntity<ApiResponse<Void>> close(
            @PathVariable Long id,
            @AuthenticationPrincipal CurrentUser user) {
        examService.close(id, user.getId());
        return ResponseEntity.ok(ApiResponse.ok(null, "Đã đóng đề thi"));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('TEACHER','ADMIN')")
    public ResponseEntity<ApiResponse<Void>> delete(
            @PathVariable Long id,
            @AuthenticationPrincipal CurrentUser user) {
        examService.delete(id, user.getId());
        return ResponseEntity.ok(ApiResponse.ok(null, "Đã xóa đề thi"));
    }

    @PostMapping("/{id}/questions")
    @PreAuthorize("hasAnyRole('TEACHER','ADMIN')")
    public ResponseEntity<ApiResponse<Void>> addQuestions(
            @PathVariable Long id,
            @RequestBody QuestionIdsRequest req,
            @AuthenticationPrincipal CurrentUser user) {
        examService.addQuestions(id, user.getId(), req.getQuestionIds());
        return ResponseEntity.ok(ApiResponse.ok(null, "Đã thêm câu hỏi vào đề"));
    }

    @DeleteMapping("/{id}/questions/{questionId}")
    @PreAuthorize("hasAnyRole('TEACHER','ADMIN')")
    public ResponseEntity<ApiResponse<Void>> removeQuestion(
            @PathVariable Long id,
            @PathVariable Long questionId,
            @AuthenticationPrincipal CurrentUser user) {
        examService.removeQuestion(id, questionId, user.getId());
        return ResponseEntity.ok(ApiResponse.ok(null, "Đã xóa câu hỏi khỏi đề"));
    }

    @PutMapping("/{id}/questions/reorder")
    @PreAuthorize("hasAnyRole('TEACHER','ADMIN')")
    public ResponseEntity<ApiResponse<Void>> reorderQuestions(
            @PathVariable Long id,
            @RequestBody QuestionIdsRequest req,
            @AuthenticationPrincipal CurrentUser user) {
        examService.reorder(id, user.getId(), req.getQuestionIds());
        return ResponseEntity.ok(ApiResponse.ok(null, "Đã sắp xếp câu hỏi"));
    }

    @lombok.Data
    public static class QuestionIdsRequest {
        private List<Long> questionIds;
    }

    public record ExamListItem(
            Long id, String title, String subject, Long classroomId, String status,
            Integer durationMin, Integer questionCount, long submissionCount, java.time.LocalDateTime createdAt,
            boolean proctorEnabled, boolean lockScreen, Integer maxAttempts, String showAnswerAfter) {}

    public record ExamDetail(
            Long id, String title, String description, String subject, Long classroomId,
            Integer durationMin, java.math.BigDecimal totalPoints, String status,
            Boolean shuffleQuestions, Boolean shuffleOptions, Boolean proctorEnabled,
            Boolean lockScreen, Integer maxAttempts, String showAnswerAfter,
            java.time.LocalDateTime createdAt, boolean passwordProtected,
            List<QuestionDetail> questions) {}

    public record QuestionDetail(
            Long id, String subject, Integer grade, String unit, String difficulty,
            String type, String content, String options, String correctAnswer,
            String answerText, String explanation) {
        static QuestionDetail from(Question question, boolean includeAnswers) {
            return new QuestionDetail(question.getId(), question.getSubject(), question.getGrade(),
                    question.getUnit(), question.getDifficulty().name(), question.getType().name(),
                    question.getContent(), question.getOptions(),
                    includeAnswers ? question.getCorrectAnswer() : null,
                    includeAnswers ? question.getAnswerText() : null,
                    includeAnswers ? question.getExplanation() : null);
        }
    }
}