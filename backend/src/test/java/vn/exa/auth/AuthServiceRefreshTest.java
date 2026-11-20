package vn.exa.auth;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.support.StaticListableBeanFactory;
import vn.exa.common.BusinessException;
import vn.exa.common.JwtTokenProvider;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AuthServiceRefreshTest {

    @Test
    void refreshRotatesTheStoredTokenWithinTheSameSession() {
        User user = User.builder()
                .id(10L)
                .email("teacher@example.com")
                .fullName("Teacher")
                .role(User.Role.TEACHER)
                .plan(User.Plan.FREE)
                .active(true)
                .build();
        AuthSession session = AuthSession.builder().id("session-10").user(user).build();
        UserRepository userRepository = mock(UserRepository.class);
        JwtTokenProvider tokenProvider = mock(JwtTokenProvider.class);
        AuthSessionService sessionService = mock(AuthSessionService.class);
        when(tokenProvider.validate("refresh-token")).thenReturn(true);
        when(tokenProvider.getTokenType("refresh-token")).thenReturn("refresh");
        when(tokenProvider.getUserId("refresh-token")).thenReturn(10L);
        when(tokenProvider.getSessionId("refresh-token")).thenReturn("session-10");
        when(userRepository.findByIdAndDeletedAtIsNull(10L)).thenReturn(Optional.of(user));
        when(sessionService.requireRefreshSession("session-10", 10L, "refresh-token")).thenReturn(session);
        when(tokenProvider.generateRefreshToken(10L, "teacher@example.com", "session-10"))
                .thenReturn("rotated-refresh-token");
        when(tokenProvider.generateAccessToken(10L, "teacher@example.com", "TEACHER", "session-10"))
                .thenReturn("new-access-token");
        when(tokenProvider.getAccessExpirationMs()).thenReturn(86_400_000L);

        AuthService service = new AuthService(
                userRepository,
                null,
                tokenProvider,
                null,
                new StaticListableBeanFactory().getBeanProvider(com.google.firebase.auth.FirebaseAuth.class),
                sessionService);

        var response = service.refresh("refresh-token", "Chrome/123 Windows");

        assertThat(response.getAccessToken()).isEqualTo("new-access-token");
        assertThat(response.getRefreshToken()).isEqualTo("rotated-refresh-token");
        verify(sessionService).rotateRefreshToken(session, "rotated-refresh-token");
        verify(sessionService, never()).createSession(
                eq(user), anyString(), anyString(), anyString());
    }

    @Test
    void refreshRequiresReauthenticationForLegacyTokensWithoutSessionIds() {
        User user = User.builder()
                .id(10L)
                .email("teacher@example.com")
                .active(true)
                .build();
        UserRepository userRepository = mock(UserRepository.class);
        JwtTokenProvider tokenProvider = mock(JwtTokenProvider.class);
        AuthSessionService sessionService = mock(AuthSessionService.class);
        when(tokenProvider.validate("legacy-refresh-token")).thenReturn(true);
        when(tokenProvider.getTokenType("legacy-refresh-token")).thenReturn("refresh");
        when(tokenProvider.getUserId("legacy-refresh-token")).thenReturn(10L);
        when(tokenProvider.getSessionId("legacy-refresh-token")).thenReturn(null);
        when(userRepository.findByIdAndDeletedAtIsNull(10L)).thenReturn(Optional.of(user));

        AuthService service = new AuthService(
                userRepository,
                null,
                tokenProvider,
                null,
                new StaticListableBeanFactory().getBeanProvider(com.google.firebase.auth.FirebaseAuth.class),
                sessionService);

        assertThatThrownBy(() -> service.refresh("legacy-refresh-token", null))
                .isInstanceOf(BusinessException.class);
        verify(sessionService, never()).createSession(
                eq(user), anyString(), anyString(), anyString());
    }
}
