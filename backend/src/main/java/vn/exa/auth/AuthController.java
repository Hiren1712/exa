package vn.exa.auth;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.*;
import vn.exa.auth.dto.AuthResponse;
import vn.exa.auth.dto.GoogleLoginRequest;
import vn.exa.auth.dto.LoginRequest;
import vn.exa.auth.dto.RegisterRequest;
import vn.exa.common.ApiResponse;
import vn.exa.common.CurrentUser;

import java.util.Map;

@RestController
@RequestMapping("/v1/auth")
@RequiredArgsConstructor
@Tag(name = "Auth", description = "Xác thực người dùng")
public class AuthController {

    private final AuthService authService;
    private final AuthSessionService authSessionService;

    @PostMapping("/register")
    @Operation(summary = "Đăng ký tài khoản mới")
    public ResponseEntity<ApiResponse<AuthResponse>> register(
            @Valid @RequestBody RegisterRequest req,
            HttpServletRequest request) {
        AuthResponse response = authService.register(req, request.getHeader("User-Agent"));
        return ResponseEntity.ok(ApiResponse.ok(response, "Đăng ký thành công"));
    }

    @PostMapping("/login")
    @Operation(summary = "Đăng nhập")
    public ResponseEntity<ApiResponse<AuthResponse>> login(
            @Valid @RequestBody LoginRequest req,
            HttpServletRequest request) {
        AuthResponse response = authService.login(req, request.getHeader("User-Agent"));
        return ResponseEntity.ok(ApiResponse.ok(response, "Đăng nhập thành công"));
    }

    @PostMapping("/google")
    @Operation(summary = "Đăng nhập bằng Google")
    public ResponseEntity<ApiResponse<AuthResponse>> googleLogin(
            @Valid @RequestBody GoogleLoginRequest req,
            HttpServletRequest request) {
        AuthResponse response = authService.googleLogin(req, request.getHeader("User-Agent"));
        return ResponseEntity.ok(ApiResponse.ok(response, "Đăng nhập Google thành công"));
    }

    @GetMapping("/me")
    @Operation(summary = "Lấy thông tin user hiện tại")
    public ResponseEntity<ApiResponse<AuthResponse.UserInfo>> me(
            @AuthenticationPrincipal CurrentUser currentUser) {

        User user = authService.getById(currentUser.getId());
        return ResponseEntity.ok(ApiResponse.ok(authService.toUserInfo(user)));
    }

    @PostMapping("/refresh")
    @Operation(summary = "Làm mới access token")
    public ResponseEntity<ApiResponse<AuthResponse>> refresh(
            @RequestBody Map<String, String> body,
            HttpServletRequest request) {

        String refreshToken = body.get("refreshToken");
        if (refreshToken == null || refreshToken.isBlank()) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("MISSING_TOKEN", "Thiếu refresh token"));
        }

        AuthResponse response = authService.refresh(refreshToken, request.getHeader("User-Agent"));
        return ResponseEntity.ok(ApiResponse.ok(response, "Token đã được làm mới"));
    }

    @GetMapping("/sessions")
    @Operation(summary = "Lấy danh sách phiên đăng nhập")
    public ResponseEntity<ApiResponse<AuthSessionService.SessionList>> sessions(
            @AuthenticationPrincipal CurrentUser currentUser) {
        return ResponseEntity.ok(ApiResponse.ok(
                authSessionService.listSessions(currentUser.getId(), currentUser.getSessionId())));
    }

    @DeleteMapping("/sessions/{sessionId}")
    @Operation(summary = "Thu hồi một phiên đăng nhập")
    public ResponseEntity<ApiResponse<Void>> revokeSession(
            @PathVariable String sessionId,
            @AuthenticationPrincipal CurrentUser currentUser) {
        authSessionService.revokeSession(currentUser.getId(), sessionId);
        return ResponseEntity.ok(ApiResponse.ok(null, "Đã đăng xuất thiết bị"));
    }

    @PostMapping("/sessions/revoke-others")
    @Operation(summary = "Đăng xuất khỏi các thiết bị khác")
    public ResponseEntity<ApiResponse<Map<String, Integer>>> revokeOtherSessions(
            @AuthenticationPrincipal CurrentUser currentUser) {
        int revokedCount = authSessionService.revokeOtherSessions(
                currentUser.getId(), currentUser.getSessionId());
        return ResponseEntity.ok(ApiResponse.ok(
                Map.of("revokedCount", revokedCount), "Đã đăng xuất khỏi các thiết bị khác"));
    }

    @PostMapping("/logout")
    @Operation(summary = "Đăng xuất thiết bị hiện tại")
    public ResponseEntity<ApiResponse<Void>> logout(
            @AuthenticationPrincipal CurrentUser currentUser) {
        authSessionService.revokeCurrentSession(currentUser.getId(), currentUser.getSessionId());
        return ResponseEntity.ok(ApiResponse.ok(null, "Đã đăng xuất"));
    }
}