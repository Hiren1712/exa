package vn.exa.submission;

import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import vn.exa.common.ApiResponse;
import vn.exa.common.CurrentUser;

import java.util.List;
import java.util.Map;
import java.math.BigDecimal;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

@RestController
@RequestMapping("/v1/submissions")
@RequiredArgsConstructor
public class SubmissionController {

    private final SubmissionService submissionService;

    @PostMapping("/start")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<ApiResponse<Submission>> start(
            @RequestBody StartRequest req,
            @AuthenticationPrincipal CurrentUser user) {
        Submission sub = submissionService.start(req.getExamId(), user.getId(), req.getPassword());
        return ResponseEntity.ok(ApiResponse.ok(sub, "Bắt đầu làm bài"));
    }

    @PostMapping("/{id}/submit")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<ApiResponse<Submission>> submit(
            @PathVariable Long id,
            @RequestBody SubmitRequest req,
            @AuthenticationPrincipal CurrentUser user) {
        Submission sub = submissionService.submit(id, user.getId(), req.getAnswers());
        return ResponseEntity.ok(ApiResponse.ok(sub, "Nộp bài thành công"));
    }

    @PostMapping("/{id}/save-answer")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<ApiResponse<Submission>> saveAnswer(
            @PathVariable Long id,
            @RequestBody SaveAnswerRequest req,
            @AuthenticationPrincipal CurrentUser user) {
        Submission sub = submissionService.saveAnswers(id, user.getId(), req.getAnswers());
        return ResponseEntity.ok(ApiResponse.ok(sub, "Đã lưu đáp án"));
    }

    @GetMapping("/{id}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<Submission>> detail(
            @PathVariable Long id,
            @AuthenticationPrincipal CurrentUser user) {
        Submission sub = submissionService.getById(id, user.getId());
        return ResponseEntity.ok(ApiResponse.ok(sub));
    }

    @GetMapping("/{id}/review")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<ApiResponse<SubmissionService.SubmissionReview>> review(
            @PathVariable Long id, @AuthenticationPrincipal CurrentUser user) {
        return ResponseEntity.ok(ApiResponse.ok(submissionService.getReview(id, user.getId())));
    }

    @GetMapping("/exam/{examId}")
    @PreAuthorize("hasAnyRole('TEACHER','ADMIN')")
    public ResponseEntity<ApiResponse<List<Submission>>> listByExam(
            @PathVariable Long examId, @AuthenticationPrincipal CurrentUser user) {
        return ResponseEntity.ok(ApiResponse.ok(
                submissionService.listByExam(examId, user.getId(), user.isAdmin())));
    }

    @GetMapping("/mine")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<ApiResponse<List<Submission>>> listMine(
            @AuthenticationPrincipal CurrentUser user) {
        return ResponseEntity.ok(ApiResponse.ok(submissionService.listByStudent(user.getId())));
    }

    @PostMapping("/{id}/proctor-event")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<ApiResponse<ProctorEvent>> logProctorEvent(
            @PathVariable Long id,
            @RequestBody ProctorEventRequest req,
            @AuthenticationPrincipal CurrentUser user) {
        ProctorEvent event = submissionService.logProctorEvent(
                id, user.getId(), req.getEventType(), req.getSeverity(), req.getPayload());
        return ResponseEntity.ok(ApiResponse.ok(event));
    }

    @GetMapping("/{id}/proctor-events")
    @PreAuthorize("hasAnyRole('TEACHER','ADMIN','STUDENT')")
    public ResponseEntity<ApiResponse<Map<String, Long>>> getProctorSummary(
            @PathVariable Long id, @AuthenticationPrincipal CurrentUser user) {
        return ResponseEntity.ok(ApiResponse.ok(
                submissionService.getProctorSummary(id, user.getId(), user.isTeacher(), user.isAdmin())));
    }

    @GetMapping("/grading-queue")
    @PreAuthorize("hasAnyRole('TEACHER','ADMIN')")
    public ResponseEntity<ApiResponse<List<SubmissionService.GradingItem>>> gradingQueue(
            @AuthenticationPrincipal CurrentUser user) {
        return ResponseEntity.ok(ApiResponse.ok(submissionService.gradingQueue(user.getId())));
    }

    @PostMapping("/{id}/grade")
    @PreAuthorize("hasAnyRole('TEACHER','ADMIN')")
    public ResponseEntity<ApiResponse<Submission>> grade(
            @PathVariable Long id, @Valid @RequestBody GradeRequest req,
            @AuthenticationPrincipal CurrentUser user) {
        return ResponseEntity.ok(ApiResponse.ok(
                submissionService.grade(id, user.getId(), req.getScore(), req.getFeedback()),
                "Đã lưu điểm và nhận xét"));
    }

    // ===== DTO =====
    @Data
    public static class StartRequest {
        private Long examId;
        private String password;
    }

    @Data
    public static class SubmitRequest {
        private Map<Long, String> answers;
    }

    @Data
    public static class SaveAnswerRequest {
        private Map<Long, String> answers;
    }

    @Data
    public static class ProctorEventRequest {
        private ProctorEvent.EventType eventType;
        private ProctorEvent.Severity severity;
        private String payload;
    }

    @Data
    public static class GradeRequest {
        @NotNull
        @DecimalMin("0.00")
        @DecimalMax("10.00")
        private BigDecimal score;

        @Size(max = 4000)
        private String feedback;
    }
}