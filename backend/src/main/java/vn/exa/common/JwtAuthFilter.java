package vn.exa.common;

import io.jsonwebtoken.Claims;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;
import vn.exa.auth.AuthSessionRepository;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.List;

@Component
@RequiredArgsConstructor
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtTokenProvider jwtTokenProvider;
    private final AuthSessionRepository sessionRepository;

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain) throws ServletException, IOException {

        String token = extractToken(request);

        if (StringUtils.hasText(token) && jwtTokenProvider.validate(token)) {
            Claims claims = jwtTokenProvider.parseClaims(token);

            if (claims != null && "access".equals(claims.get("type", String.class))) {
                Long userId = claims.get("uid", Long.class);
                String email = claims.getSubject();
                String role = claims.get("role", String.class);
                String sessionId = claims.get("sid", String.class);
                boolean activeSession = userId != null && (sessionId == null
                        || sessionRepository.existsByIdAndUserIdAndRevokedAtIsNullAndExpiresAtAfter(
                                sessionId, userId, LocalDateTime.now()));

                if (userId != null && StringUtils.hasText(email) && StringUtils.hasText(role) && activeSession) {
                    CurrentUser principal = new CurrentUser(userId, email, role, sessionId);

                    UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(
                            principal,
                            null,
                            List.of(new SimpleGrantedAuthority("ROLE_" + role))
                    );
                    auth.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));

                    SecurityContextHolder.getContext().setAuthentication(auth);
                }
            }
        }

        filterChain.doFilter(request, response);
    }

    /**
     * Extract token từ header "Authorization: Bearer xxx"
     */
    private String extractToken(HttpServletRequest request) {
        String bearer = request.getHeader("Authorization");
        if (StringUtils.hasText(bearer) && bearer.startsWith("Bearer ")) {
            return bearer.substring(7);
        }
        return null;
    }
}