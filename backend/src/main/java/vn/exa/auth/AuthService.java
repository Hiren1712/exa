package vn.exa.auth;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.exa.auth.dto.AuthResponse;
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