package vn.exa.classroom;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import vn.exa.common.ApiResponse;
import vn.exa.common.CurrentUser;

import java.util.List;

@RestController
@RequestMapping("/v1/classrooms")
@RequiredArgsConstructor
public class ClassroomController {

    private final ClassroomService classroomService;

    @GetMapping
    @PreAuthorize("hasAnyRole('TEACHER','ADMIN')")
    public ResponseEntity<ApiResponse<List<ClassroomService.ClassroomSummary>>> list(
            @AuthenticationPrincipal CurrentUser user) {
        return ResponseEntity.ok(ApiResponse.ok(classroomService.listByTeacher(user.getId())));
    }

    @GetMapping("/mine")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<ApiResponse<List<ClassroomService.ClassroomSummary>>> listMine(
            @AuthenticationPrincipal CurrentUser user) {
        return ResponseEntity.ok(ApiResponse.ok(classroomService.listByStudent(user.getId())));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<Classroom>> detail(
            @PathVariable Long id, @AuthenticationPrincipal CurrentUser user) {
        return ResponseEntity.ok(ApiResponse.ok(classroomService.getById(id, user.getId())));
    }

    @GetMapping("/{id}/members")
    @PreAuthorize("hasAnyRole('TEACHER','ADMIN')")
    public ResponseEntity<ApiResponse<List<ClassroomService.ClassroomMemberDetails>>> members(
            @PathVariable Long id, @AuthenticationPrincipal CurrentUser user) {
        return ResponseEntity.ok(ApiResponse.ok(classroomService.listMembers(id, user.getId())));
    }

    @PostMapping("/join")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<ApiResponse<Classroom>> join(
            @Valid @RequestBody JoinClassroomRequest req,
            @AuthenticationPrincipal CurrentUser user) {
        return ResponseEntity.ok(ApiResponse.ok(
                classroomService.join(req.getCode(), user.getId()), "Tham gia lớp thành công"));
    }

    @PostMapping("/{id}/join")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<ApiResponse<Classroom>> joinById(
            @PathVariable Long id,
            @Valid @RequestBody JoinClassroomRequest req,
            @AuthenticationPrincipal CurrentUser user) {
        Classroom classroom = classroomService.join(req.getCode(), id, user.getId());
        return ResponseEntity.ok(ApiResponse.ok(classroom, "Tham gia lớp thành công"));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('TEACHER','ADMIN')")
    public ResponseEntity<ApiResponse<Classroom>> create(
            @Valid @RequestBody CreateClassroomRequest req,
            @AuthenticationPrincipal CurrentUser user) {
        Classroom c = classroomService.create(
                user.getId(), req.getName(), req.getSubject(),
                req.getGrade(), req.getDescription());
        return ResponseEntity.ok(ApiResponse.ok(c, "Tạo lớp thành công"));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('TEACHER','ADMIN')")
    public ResponseEntity<ApiResponse<Classroom>> update(
            @PathVariable Long id,
            @Valid @RequestBody CreateClassroomRequest req,
            @AuthenticationPrincipal CurrentUser user) {
        Classroom c = classroomService.update(
                id, user.getId(), req.getName(), req.getSubject(),
                req.getGrade(), req.getDescription());
        return ResponseEntity.ok(ApiResponse.ok(c, "Cập nhật thành công"));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('TEACHER','ADMIN')")
    public ResponseEntity<ApiResponse<Void>> delete(
            @PathVariable Long id,
            @AuthenticationPrincipal CurrentUser user) {
        classroomService.archive(id, user.getId());
        return ResponseEntity.ok(ApiResponse.ok(null, "Đã xóa lớp"));
    }

    @Data
    public static class CreateClassroomRequest {
        @NotBlank(message = "Tên lớp không được để trống")
        private String name;
        private String subject;
        private Integer grade;
        private String description;
    }

    @Data
    public static class JoinClassroomRequest {
        @NotBlank(message = "Vui lòng nhập mã lớp")
        private String code;
    }
}