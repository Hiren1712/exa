package vn.exa.auth;

import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseAuthException;
import com.google.firebase.auth.FirebaseToken;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.http.HttpStatus;
import vn.exa.auth.dto.AuthResponse;
import vn.exa.auth.dto.GoogleLoginRequest;
import vn.exa.auth.dto.LoginRequest;
import vn.exa.auth.dto.RegisterRequest;
import vn.exa.common.BusinessException;
import vn.exa.common.JwtTokenProvider;

import java.time.LocalDateTime;
import java.time.LocalDate;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;
    private final AuthenticationManager authenticationManager;
    private final ObjectProvider<FirebaseAuth> firebaseAuthProvider;

    @Transactional
    public AuthResponse register(RegisterRequest req) {
        if (userRepository.existsByEmailAndDeletedAtIsNull(req.getEmail())) {
            throw BusinessException.conflict("Email đã được sử dụng");
        }

        if (req.getRole() == User.Role.ADMIN) {
            throw BusinessException.forbidden("Không thể đăng ký tài khoản ADMIN");
        }

        User user = User.builder()
                .email(req.getEmail().toLowerCase())
                .passwordHash(passwordEncoder.encode(req.getPassword()))
                .fullName(req.getFullName())
                .dateOfBirth(req.getDateOfBirth())
                .role(req.getRole())
                .plan(User.Plan.FREE)
                .active(true)
                .emailVerified(false)
                .build();

        user = userRepository.save(user);
        log.info("New user registered: {} ({})", user.getEmail(), user.getRole());

        return buildAuthResponse(user);
    }

    @Transactional
    public AuthResponse login(LoginRequest req) {
        try {
            authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(req.getEmail(), req.getPassword())
            );
        } catch (BadCredentialsException ex) {
            log.warn("Login failed for: {}", req.getEmail());
            throw BusinessException.unauthorized("Email hoặc mật khẩu không đúng");
        }

        User user = userRepository.findByEmailAndDeletedAtIsNull(req.getEmail())
                .orElseThrow(() -> BusinessException.unauthorized("Tài khoản không tồn tại"));

        if (Boolean.FALSE.equals(user.getActive())) {
            throw BusinessException.forbidden("Tài khoản đã bị khóa");
        }

        user.setLastLoginAt(LocalDateTime.now());
        userRepository.save(user);

        log.info("User logged in: {} ({})", user.getEmail(), user.getRole());
        return buildAuthResponse(user);
    }

    @Transactional
    public AuthResponse googleLogin(GoogleLoginRequest req) {
        if (req.getRole() == User.Role.ADMIN) {
            throw BusinessException.forbidden("Không thể đăng ký tài khoản ADMIN");
        }

        FirebaseAuth firebaseAuth = firebaseAuthProvider.getIfAvailable();
        if (firebaseAuth == null) {
            throw new BusinessException(
                    "GOOGLE_AUTH_NOT_CONFIGURED",
                    "Đăng nhập Google chưa được cấu hình trên máy chủ",
                    HttpStatus.SERVICE_UNAVAILABLE);
        }

        final FirebaseToken token;
        try {
            token = firebaseAuth.verifyIdToken(req.getIdToken());
        } catch (FirebaseAuthException ex) {
            log.warn("Firebase ID token verification failed: {}", ex.getAuthErrorCode());
            throw BusinessException.unauthorized("Phiên đăng nhập Google không hợp lệ hoặc đã hết hạn");
        }

        if (!Boolean.TRUE.equals(token.getClaims().get("email_verified"))
                || token.getEmail() == null || token.getEmail().isBlank()) {
            throw BusinessException.unauthorized("Tài khoản Google chưa xác minh địa chỉ email");
        }
        Object firebaseClaim = token.getClaims().get("firebase");
        if (!(firebaseClaim instanceof java.util.Map<?, ?> firebaseClaims)
                || !"google.com".equals(firebaseClaims.get("sign_in_provider"))) {
            throw BusinessException.unauthorized("Vui lòng xác thực bằng Google");
        }

        String email = token.getEmail().trim().toLowerCase(java.util.Locale.ROOT);
        if (email.length() > 191) {
            throw BusinessException.badRequest("Email Google vượt quá giới hạn cho phép");
        }

        User user = userRepository.findByEmailAndDeletedAtIsNull(email).orElse(null);
        if (user == null) {
            if (userRepository.findByEmail(email).isPresent()) {
                throw BusinessException.conflict("Tài khoản này đã bị xóa, vui lòng liên hệ quản trị viên");
            }
            if (req.getRole() == null) {
                throw BusinessException.badRequest("Hãy chọn Đăng ký và chọn vai trò để tạo tài khoản Google mới");
            }

            String fullName = token.getName();
            if (fullName == null || fullName.isBlank()) {
                fullName = email.substring(0, email.indexOf('@'));
            }
            user = User.builder()
                    .email(email)
                    .passwordHash(passwordEncoder.encode(java.util.UUID.randomUUID().toString()))
                    .fullName(fullName.substring(0, Math.min(fullName.length(), 120)))
                    .avatarUrl(token.getPicture())
                    .role(req.getRole())
                    .plan(User.Plan.FREE)
                    .active(true)
                    .emailVerified(true)
                    .build();
        } else if (user.getRole() == User.Role.ADMIN) {
            throw BusinessException.forbidden("Tài khoản quản trị không thể đăng nhập bằng Google");
        }

        if (Boolean.FALSE.equals(user.getActive())) {
            throw BusinessException.forbidden("Tài khoản đã bị khóa");
        }
        user.setEmailVerified(true);
        user.setLastLoginAt(LocalDateTime.now());
        user = userRepository.save(user);
        log.info("User authenticated with Google: {} ({})", user.getId(), user.getRole());
        return buildAuthResponse(user);
    }

    public User getById(Long id) {
        return userRepository.findByIdAndDeletedAtIsNull(id)
                .orElseThrow(() -> BusinessException.notFound("Người dùng không tồn tại"));
    }

    @Transactional
    public AuthResponse.UserInfo updateProfile(
            Long userId, String fullName, String phone, LocalDate dateOfBirth, String avatarUrl) {
        User user = getById(userId);
        user.setFullName(fullName.trim());
        user.setPhone(phone == null || phone.isBlank() ? null : phone.trim());
        user.setDateOfBirth(dateOfBirth);
        if (avatarUrl != null) user.setAvatarUrl(avatarUrl);
        return toUserInfo(userRepository.save(user));
    }

    @Transactional
    public void changePassword(Long userId, String currentPassword, String newPassword) {
        User user = getById(userId);
        if (!passwordEncoder.matches(currentPassword, user.getPasswordHash())) {
            throw BusinessException.badRequest("Mật khẩu hiện tại không đúng");
        }
        user.setPasswordHash(passwordEncoder.encode(newPassword));
        userRepository.save(user);
    }

    public AuthResponse refresh(String refreshToken) {
        if (!jwtTokenProvider.validate(refreshToken)) {
            throw BusinessException.unauthorized("Refresh token không hợp lệ hoặc đã hết hạn");
        }

        Long userId = jwtTokenProvider.getUserId(refreshToken);
        User user = userRepository.findByIdAndDeletedAtIsNull(userId)
                .orElseThrow(() -> BusinessException.unauthorized("Người dùng không tồn tại"));

        if (Boolean.FALSE.equals(user.getActive())) {
            throw BusinessException.forbidden("Tài khoản đã bị khóa");
        }

        return buildAuthResponse(user);
    }

    private AuthResponse buildAuthResponse(User user) {
        String accessToken = jwtTokenProvider.generateAccessToken(
                user.getId(), user.getEmail(), user.getRole().name()
        );
        String refreshToken = jwtTokenProvider.generateRefreshToken(
                user.getId(), user.getEmail()
        );

        return AuthResponse.builder()
                .accessToken(accessToken)
                .refreshToken(refreshToken)
                .tokenType("Bearer")
                .expiresIn(jwtTokenProvider.getAccessExpirationMs() / 1000)
                .user(toUserInfo(user))
                .build();
    }

    private AuthResponse.UserInfo toUserInfo(User user) {
        return AuthResponse.UserInfo.builder()
                .id(user.getId())
                .email(user.getEmail())
                .fullName(user.getFullName())
                .avatarUrl(user.getAvatarUrl())
                .phone(user.getPhone())
                .role(user.getRole().name())
                .plan(user.getPlan().name())
                .dateOfBirth(user.getDateOfBirth() == null ? null : user.getDateOfBirth().toString())
                .build();
    }
}