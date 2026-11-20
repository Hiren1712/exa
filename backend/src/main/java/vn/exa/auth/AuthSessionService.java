package vn.exa.auth;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import vn.exa.common.BusinessException;
import vn.exa.common.JwtTokenProvider;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDateTime;
import java.util.HexFormat;
import java.util.List;

@Service
@RequiredArgsConstructor
public class AuthSessionService {

    private final AuthSessionRepository sessionRepository;
    private final JwtTokenProvider jwtTokenProvider;

    @Transactional
    public void createSession(User user, String sessionId, String refreshToken, String userAgent) {
        LocalDateTime now = LocalDateTime.now();
        sessionRepository.deleteByExpiresAtBefore(now);
        sessionRepository.save(AuthSession.builder()
                .id(sessionId)
                .user(user)
                .refreshTokenHash(hash(refreshToken))
                .userAgent(truncateUserAgent(userAgent))
                .createdAt(now)
                .lastSeenAt(now)
                .expiresAt(now.plusNanos(jwtTokenProvider.getRefreshExpirationMs() * 1_000_000))
                .build());
    }

    @Transactional
    public AuthSession requireRefreshSession(String sessionId, Long userId, String refreshToken) {
        AuthSession session = sessionRepository.findByIdAndUserIdForUpdate(sessionId, userId)
                .orElseThrow(() -> BusinessException.unauthorized("Refresh token không hợp lệ hoặc đã bị thu hồi"));
        LocalDateTime now = LocalDateTime.now();
        if (session.getRevokedAt() != null
                || !session.getExpiresAt().isAfter(now)
                || !constantTimeEquals(session.getRefreshTokenHash(), hash(refreshToken))) {
            throw BusinessException.unauthorized("Refresh token không hợp lệ hoặc đã bị thu hồi");
        }
        return session;
    }

    @Transactional
    public void rotateRefreshToken(AuthSession session, String refreshToken) {
        LocalDateTime now = LocalDateTime.now();
        session.setRefreshTokenHash(hash(refreshToken));
        session.setLastSeenAt(now);
        session.setExpiresAt(now.plusNanos(jwtTokenProvider.getRefreshExpirationMs() * 1_000_000));
        sessionRepository.save(session);
    }

    @Transactional
    public SessionList listSessions(Long userId, String currentSessionId) {
        LocalDateTime now = LocalDateTime.now();
        List<AuthSession> sessions = sessionRepository
                .findByUserIdAndRevokedAtIsNullAndExpiresAtAfterOrderByLastSeenAtDesc(userId, now);
        boolean currentSessionTracked = sessions.stream()
                .anyMatch(session -> session.getId().equals(currentSessionId));
        if (currentSessionTracked) {
            sessions.stream()
                    .filter(session -> session.getId().equals(currentSessionId))
                    .findFirst()
                    .ifPresent(session -> session.setLastSeenAt(now));
        }
        return new SessionList(currentSessionTracked, sessions.stream()
                .map(session -> new SessionInfo(
                        session.getId(),
                        deviceLabel(session.getUserAgent()),
                        session.getCreatedAt(),
                        session.getLastSeenAt(),
                        session.getExpiresAt(),
                        session.getId().equals(currentSessionId)))
                .toList());
    }

    @Transactional
    public void revokeSession(Long userId, String sessionId) {
        AuthSession session = sessionRepository.findByIdAndUserId(sessionId, userId)
                .orElseThrow(() -> BusinessException.notFound("Không tìm thấy phiên đăng nhập"));
        if (session.getRevokedAt() == null) {
            session.setRevokedAt(LocalDateTime.now());
            sessionRepository.save(session);
        }
    }

    @Transactional
    public int revokeOtherSessions(Long userId, String currentSessionId) {
        if (!StringUtils.hasText(currentSessionId)) {
            return 0;
        }
        LocalDateTime now = LocalDateTime.now();
        return sessionRepository.revokeOthers(userId, currentSessionId, now);
    }

    @Transactional
    public void revokeCurrentSession(Long userId, String currentSessionId) {
        if (StringUtils.hasText(currentSessionId)) {
            revokeSession(userId, currentSessionId);
        }
    }

    private String truncateUserAgent(String userAgent) {
        if (!StringUtils.hasText(userAgent)) {
            return null;
        }
        return userAgent.length() > 512 ? userAgent.substring(0, 512) : userAgent;
    }

    private String deviceLabel(String userAgent) {
        if (!StringUtils.hasText(userAgent)) {
            return null;
        }

        String browser = userAgent.contains("Edg/") ? "Edge"
                : userAgent.contains("Firefox/") ? "Firefox"
                : userAgent.contains("Chrome/") ? "Chrome"
                : userAgent.contains("Safari/") ? "Safari"
                : null;
        String platform = userAgent.contains("Windows") ? "Windows"
                : userAgent.contains("Android") ? "Android"
                : userAgent.contains("iPhone") || userAgent.contains("iPad") ? "iOS"
                : userAgent.contains("Mac OS") ? "macOS"
                : userAgent.contains("Linux") ? "Linux"
                : null;

        if (browser == null && platform == null) {
            return null;
        }
        if (browser == null) {
            return platform;
        }
        return platform == null ? browser : browser + " - " + platform;
    }

    private String hash(String token) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(token.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 is unavailable", ex);
        }
    }

    private boolean constantTimeEquals(String storedHash, String presentedHash) {
        return MessageDigest.isEqual(
                storedHash.getBytes(StandardCharsets.US_ASCII),
                presentedHash.getBytes(StandardCharsets.US_ASCII));
    }

    public record SessionList(boolean currentSessionTracked, List<SessionInfo> sessions) {}

    public record SessionInfo(
            String id,
            String deviceLabel,
            LocalDateTime createdAt,
            LocalDateTime lastSeenAt,
            LocalDateTime expiresAt,
            boolean current) {}
}
