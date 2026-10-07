package vn.exa.auth;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import vn.exa.auth.dto.AuthResponse;
import vn.exa.common.ApiResponse;
import vn.exa.common.CurrentUser;

import java.time.LocalDate;

@RestController
@RequestMapping("/v1/users/me")
@RequiredArgsConstructor
public class UserController {

    private final AuthService authService;

    @PutMapping
    public ResponseEntity<ApiResponse<AuthResponse.UserInfo>> updateProfile(
            @Valid @RequestBody UpdateProfileRequest req,
            @AuthenticationPrincipal CurrentUser user) {
        AuthResponse.UserInfo updated = authService.updateProfile(
                user.getId(), req.getFullName(), req.getPhone(), req.getDateOfBirth(), req.getAvatarUrl());
        return ResponseEntity.ok(ApiResponse.ok(updated, "Đã cập nhật thông tin cá nhân"));
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

        @Size(max = 500)
        private String avatarUrl;
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
