package vn.exa.auth;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import vn.exa.common.BusinessException;
import vn.exa.common.JwtTokenProvider;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.util.HexFormat;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthSessionServiceTest {

    @Mock
    private AuthSessionRepository sessionRepository;

    @Mock
    private JwtTokenProvider jwtTokenProvider;

    private AuthSessionService service;

    @BeforeEach
    void setUp() {
        service = new AuthSessionService(sessionRepository, jwtTokenProvider);
    }

    @Test
    void createSessionStoresOnlyTheRefreshTokenHash() {
        when(jwtTokenProvider.getRefreshExpirationMs()).thenReturn(604_800_000L);
        User user = User.builder().id(10L).build();

        service.createSession(user, "session-10", "secret-refresh-token", "Chrome/123 Windows");

        ArgumentCaptor<AuthSession> captor = ArgumentCaptor.forClass(AuthSession.class);
        verify(sessionRepository).deleteByExpiresAtBefore(any(LocalDateTime.class));
        verify(sessionRepository).save(captor.capture());
        AuthSession saved = captor.getValue();

        assertThat(saved.getId()).isEqualTo("session-10");
        assertThat(saved.getUser()).isSameAs(user);
        assertThat(saved.getRefreshTokenHash()).hasSize(64).isNotEqualTo("secret-refresh-token");
        assertThat(saved.getUserAgent()).isEqualTo("Chrome/123 Windows");
        assertThat(saved.getExpiresAt()).isAfter(saved.getCreatedAt());
    }

    @Test
    void refreshRejectsAReplayedTokenAfterRotation() throws Exception {
        AuthSession session = AuthSession.builder()
                .id("session-10")
                .user(User.builder().id(10L).build())
                .refreshTokenHash(hash("rotated-token"))
                .createdAt(LocalDateTime.now().minusMinutes(1))
                .lastSeenAt(LocalDateTime.now())
                .expiresAt(LocalDateTime.now().plusDays(7))
                .build();
        when(sessionRepository.findByIdAndUserIdForUpdate("session-10", 10L))
                .thenReturn(Optional.of(session));

        assertThatThrownBy(() -> service.requireRefreshSession("session-10", 10L, "old-token"))
                .isInstanceOf(BusinessException.class)
                .satisfies(error -> assertThat(((BusinessException) error).getStatus().value())
                        .isEqualTo(401));
    }

    @Test
    void sessionListMarksTheCurrentDeviceAndHidesRawUserAgent() {
        AuthSession session = AuthSession.builder()
                .id("session-10")
                .user(User.builder().id(10L).build())
                .userAgent("Mozilla Chrome/123 Windows")
                .createdAt(LocalDateTime.now().minusHours(1))
                .lastSeenAt(LocalDateTime.now().minusMinutes(1))
                .expiresAt(LocalDateTime.now().plusDays(7))
                .build();
        when(sessionRepository.findByUserIdAndRevokedAtIsNullAndExpiresAtAfterOrderByLastSeenAtDesc(
                eq(10L), any(LocalDateTime.class))).thenReturn(List.of(session));

        AuthSessionService.SessionList result = service.listSessions(10L, "session-10");

        assertThat(result.currentSessionTracked()).isTrue();
        assertThat(result.sessions()).singleElement().satisfies(item -> {
            assertThat(item.current()).isTrue();
            assertThat(item.deviceLabel()).isEqualTo("Chrome - Windows");
        });
    }

    @Test
    void revokeOthersKeepsTheCurrentSessionId() {
        service.revokeOtherSessions(10L, "current-session");

        verify(sessionRepository).revokeOthers(eq(10L), eq("current-session"), any(LocalDateTime.class));
    }

    private static String hash(String token) throws Exception {
        return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                .digest(token.getBytes(StandardCharsets.UTF_8)));
    }
}
