package vn.exa.importjob;

import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import vn.exa.common.ApiResponse;
import vn.exa.common.CurrentUser;

import java.util.List;

@RestController
@RequestMapping("/v1/imports")
@RequiredArgsConstructor
public class ImportController {

    private final ImportService importService;

    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAnyRole('TEACHER','ADMIN')")
    public ResponseEntity<ApiResponse<Long>> upload(
            @RequestParam(value = "file", required = false) MultipartFile file,
            @RequestParam(value = "content", required = false) String content,
            @RequestParam(value = "subject", required = false) String subjectHint,
            @RequestParam(value = "mode", defaultValue = "EXTRACT") ImportMode mode,
            @RequestParam(value = "questionCount", defaultValue = "10") Integer questionCount,
            @RequestParam(value = "grade", defaultValue = "12") Integer grade,
            @AuthenticationPrincipal CurrentUser user) {
        Long jobId = importService.uploadAndProcess(
                file, content, user.getId(), subjectHint, mode, questionCount, grade);
        return ResponseEntity.ok(ApiResponse.ok(jobId, "Đã upload, đang xử lý"));
    }

    @GetMapping("/{jobId}/preview")
    @PreAuthorize("hasAnyRole('TEACHER','ADMIN')")
    public ResponseEntity<ApiResponse<ImportPreviewResponse>> preview(
            @PathVariable Long jobId,
            @AuthenticationPrincipal CurrentUser user) {
        return ResponseEntity.ok(ApiResponse.ok(
                importService.getPreview(jobId, user.getId())
        ));
    }

    @PostMapping("/{jobId}/save")
    @PreAuthorize("hasAnyRole('TEACHER','ADMIN')")
    public ResponseEntity<ApiResponse<Integer>> save(
            @PathVariable Long jobId,
            @RequestBody SaveToBankRequest req,
            @AuthenticationPrincipal CurrentUser user) {
        int count = importService.saveToBank(
                jobId, user.getId(),
                req.getQuestions(), req.getSubject(), req.getGrade(), req.getUnit()
        );
        return ResponseEntity.ok(ApiResponse.ok(count, "Đã lưu " + count + " câu hỏi"));
    }

    @Data
    public static class SaveToBankRequest {
        private List<ParsedQuestion> questions;
        private String subject;
        private Integer grade;
        private String unit;
    }
}