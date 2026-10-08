package vn.exa.auth;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import vn.exa.auth.dto.AuthResponse;
import vn.exa.common.ApiResponse;
import vn.exa.common.CurrentUser;

import java.time.LocalDate;

@RestController
@RequestMapping("/v1/users/me")
@RequiredArgsConstructor
public class UserController {

    private final AuthService authService;
    private final ProfileMediaService profileMediaService;

    @PutMapping
    public ResponseEntity<ApiResponse<AuthResponse.UserInfo>> updateProfile(
            @Valid @RequestBody UpdateProfileRequest req,
            @AuthenticationPrincipal CurrentUser user) {
        AuthResponse.UserInfo updated = authService.updateProfile(
                user.getId(), req.getFullName(), req.getPhone(), req.getDateOfBirth());
        return ResponseEntity.ok(ApiResponse.ok(updated, "Đã cập nhật thông tin cá nhân"));
    }

    @PutMapping(value = "/avatar", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ApiResponse<AuthResponse.UserInfo>> updateAvatar(
            @RequestParam("file") MultipartFile file,
            @AuthenticationPrincipal CurrentUser user) {
        return ResponseEntity.ok(ApiResponse.ok(
                profileMediaService.update(user.getId(), ProfileMediaService.ImageType.AVATAR, file),
                "Đã cập nhật ảnh đại diện"
        ));
    }

    @DeleteMapping("/avatar")
    public ResponseEntity<ApiResponse<AuthResponse.UserInfo>> deleteAvatar(
            @AuthenticationPrincipal CurrentUser user) {
        return ResponseEntity.ok(ApiResponse.ok(
                profileMediaService.delete(user.getId(), ProfileMediaService.ImageType.AVATAR),
                "Đã xóa ảnh đại diện"
        ));
    }

    @PutMapping(value = "/cover", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ApiResponse<AuthResponse.UserInfo>> updateCover(
            @RequestParam("file") MultipartFile file,
            @AuthenticationPrincipal CurrentUser user) {
        return ResponseEntity.ok(ApiResponse.ok(
                profileMediaService.update(user.getId(), ProfileMediaService.ImageType.COVER, file),
                "Đã cập nhật ảnh bìa"
        ));
    }

    @DeleteMapping("/cover")
    public ResponseEntity<ApiResponse<AuthResponse.UserInfo>> deleteCover(
            @AuthenticationPrincipal CurrentUser user) {
        return ResponseEntity.ok(ApiResponse.ok(
                profileMediaService.delete(user.getId(), ProfileMediaService.ImageType.COVER),
                "Đã xóa ảnh bìa"
        ));
    }

    @PutMapping("/password")
    public ResponseEntity<ApiResponse<Void>> changePassword(
            @Valid @RequestBody ChangePasswordRequest req,
            @AuthenticationPrincipal CurrentUser user) {
        authService.changePassword(user.getId(), req.getCurrentPassword(), req.getNewPassword());
        return ResponseEntity.ok(ApiResponse.ok(null, "Đã đổi mật khẩu"));
    }

    @Data
    public static class UpdateProfileRequest {
        @NotBlank
        @Size(max = 120)
        private String fullName;

        @Size(max = 20)
        private String phone;

        private LocalDate dateOfBirth;

    }

    @Data
    public static class ChangePasswordRequest {
        @NotBlank
        private String currentPassword;

        @NotBlank
        @Size(min = 8, max = 72)
        private String newPassword;
    }
}
