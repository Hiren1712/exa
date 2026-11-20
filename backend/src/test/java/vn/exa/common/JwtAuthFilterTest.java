package vn.exa.common;

import io.jsonwebtoken.Claims;
import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.security.core.context.SecurityContextHolder;
import vn.exa.auth.AuthSessionRepository;

import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class JwtAuthFilterTest {

    @Mock
    private JwtTokenProvider jwtTokenProvider;

    @Mock
    private AuthSessionRepository sessionRepository;

    private JwtAuthFilter filter;

    @BeforeEach
    void setUp() {
        filter = new JwtAuthFilter(jwtTokenProvider, sessionRepository);
        SecurityContextHolder.clearContext();
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void revokedSessionDoesNotAuthenticateTheAccessToken() throws Exception {
        Claims claims = claimsFor("session-10");
        when(jwtTokenProvider.validate("access-token")).thenReturn(true);
        when(jwtTokenProvider.parseClaims("access-token")).thenReturn(claims);
        when(sessionRepository.existsByIdAndUserIdAndRevokedAtIsNullAndExpiresAtAfter(
                eq("session-10"), eq(10L), any(LocalDateTime.class))).thenReturn(false);

        MockHttpServletRequest request = requestWithToken();
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = new MockFilterChain();
        filter.doFilter(request, response, chain);

        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
    }

    @Test
    void activeSessionIsAttachedToTheAuthenticatedUser() throws Exception {
        Claims claims = claimsFor("session-10");
        when(jwtTokenProvider.validate("access-token")).thenReturn(true);
        when(jwtTokenProvider.parseClaims("access-token")).thenReturn(claims);
        when(sessionRepository.existsByIdAndUserIdAndRevokedAtIsNullAndExpiresAtAfter(
                eq("session-10"), eq(10L), any(LocalDateTime.class))).thenReturn(true);

        filter.doFilter(requestWithToken(), new MockHttpServletResponse(), new MockFilterChain());

        CurrentUser principal = (CurrentUser) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        assertThat(principal.getId()).isEqualTo(10L);
        assertThat(principal.getSessionId()).isEqualTo("session-10");
    }

    @Test
    void legacyAccessTokensRemainValidDuringSessionRollout() throws Exception {
        Claims claims = claimsFor(null);
        when(jwtTokenProvider.validate("access-token")).thenReturn(true);
        when(jwtTokenProvider.parseClaims("access-token")).thenReturn(claims);

        filter.doFilter(requestWithToken(), new MockHttpServletResponse(), new MockFilterChain());

        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNotNull();
        verify(sessionRepository, org.mockito.Mockito.never())
                .existsByIdAndUserIdAndRevokedAtIsNullAndExpiresAtAfter(
                        org.mockito.ArgumentMatchers.anyString(),
                        org.mockito.ArgumentMatchers.anyLong(),
                        org.mockito.ArgumentMatchers.any(LocalDateTime.class));
    }

    private Claims claimsFor(String sessionId) {
        Claims claims = mock(Claims.class);
        when(claims.get("type", String.class)).thenReturn("access");
        when(claims.get("uid", Long.class)).thenReturn(10L);
        when(claims.get("role", String.class)).thenReturn("TEACHER");
        when(claims.get("sid", String.class)).thenReturn(sessionId);
        when(claims.getSubject()).thenReturn("teacher@example.com");
        return claims;
    }

    private MockHttpServletRequest requestWithToken() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("Authorization", "Bearer access-token");
        return request;
    }
}
