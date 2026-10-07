package vn.exa.question;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import vn.exa.common.ApiResponse;
import vn.exa.common.CurrentUser;

import java.util.List;

@RestController
@RequestMapping("/v1/questions")
@RequiredArgsConstructor
public class QuestionController {

    private final QuestionService questionService;

    @GetMapping
    @PreAuthorize("hasAnyRole('TEACHER','ADMIN')")
    public ResponseEntity<ApiResponse<Page<Question>>> list(
            @RequestParam(required = false) String subject,
            @RequestParam(required = false) Integer grade,
            @RequestParam(required = false) Question.Difficulty difficulty,
            @RequestParam(required = false) Question.Type type,
            @RequestParam(required = false, name = "keyword") String keyword,
            @RequestParam(required = false, name = "q") String query,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @AuthenticationPrincipal CurrentUser user) {

        Pageable pageable = PageRequest.of(page, size);
        Page<Question> result = questionService.search(
                user.getId(), subject, grade, difficulty, type,
                query != null && !query.isBlank() ? query : keyword, pageable);
        return ResponseEntity.ok(ApiResponse.ok(result));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<Question>> detail(
            @PathVariable Long id,
            @AuthenticationPrincipal CurrentUser user) {
        return ResponseEntity.ok(ApiResponse.ok(questionService.getById(id, user.getId())));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('TEACHER','ADMIN')")
    public ResponseEntity<ApiResponse<Question>> create(
            @Valid @RequestBody QuestionService.QuestionRequest req,
            @AuthenticationPrincipal CurrentUser user) {
        Question q = questionService.create(user.getId(), req);
        return ResponseEntity.ok(ApiResponse.ok(q, "Tạo câu hỏi thành công"));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('TEACHER','ADMIN')")
    public ResponseEntity<ApiResponse<Question>> update(
            @PathVariable Long id,
            @Valid @RequestBody QuestionService.QuestionRequest req,
            @AuthenticationPrincipal CurrentUser user) {
        Question q = questionService.update(id, user.getId(), req);
        return ResponseEntity.ok(ApiResponse.ok(q, "Cập nhật thành công"));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('TEACHER','ADMIN')")
    public ResponseEntity<ApiResponse<Void>> delete(
            @PathVariable Long id,
            @AuthenticationPrincipal CurrentUser user) {
        questionService.delete(id, user.getId());
        return ResponseEntity.ok(ApiResponse.ok(null, "Đã xóa câu hỏi"));
    }

    @PostMapping("/bulk-delete")
    @PreAuthorize("hasAnyRole('TEACHER','ADMIN')")
    public ResponseEntity<ApiResponse<Integer>> bulkDelete(
            @Valid @RequestBody BulkDeleteRequest req,
            @AuthenticationPrincipal CurrentUser user) {
        int deleted = questionService.bulkDelete(user.getId(), req.getIds());
        return ResponseEntity.ok(ApiResponse.ok(deleted, "Đã xóa các câu hỏi đã chọn"));
    }

    @PostMapping("/import")
    @PreAuthorize("hasAnyRole('TEACHER','ADMIN')")
    public ResponseEntity<ApiResponse<List<Question>>> importQuestions(
            @Valid @RequestBody QuestionImportRequest req,
            @AuthenticationPrincipal CurrentUser user) {
        List<Question> created = questionService.importQuestions(user.getId(), req.getQuestions());
        return ResponseEntity.ok(ApiResponse.ok(created, "Đã nhập câu hỏi"));
    }

    @lombok.Data
    public static class BulkDeleteRequest {
        @NotEmpty
        private java.util.List<@jakarta.validation.constraints.NotNull Long> ids;
    }

    @lombok.Data
    public static class QuestionImportRequest {
        @NotEmpty
        @Valid
        private List<QuestionService.QuestionRequest> questions;
    }
}