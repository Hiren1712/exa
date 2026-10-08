package vn.exa.auth;

import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseToken;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.beans.factory.support.StaticListableBeanFactory;
import org.springframework.http.HttpStatus;
import vn.exa.auth.dto.GoogleLoginRequest;
import vn.exa.common.BusinessException;
import vn.exa.common.JwtTokenProvider;

import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AuthServiceGoogleLoginTest {

    @Test
    void googleLoginReportsServiceUnavailableWhenFirebaseIsNotConfigured() {
        AuthService service = new AuthService(
                null,
                null,
                null,
                null,
                new StaticListableBeanFactory().getBeanProvider(FirebaseAuth.class));

        assertThatThrownBy(() -> service.googleLogin(new GoogleLoginRequest()))
                .isInstanceOf(BusinessException.class)
                .satisfies(error -> assertThat(((BusinessException) error).getStatus())
                        .isEqualTo(HttpStatus.SERVICE_UNAVAILABLE));
    }

    @Test
    void googleLoginRejectsFirebaseTokensAuthenticatedByAnotherProvider() throws Exception {
        FirebaseAuth firebaseAuth = mock(FirebaseAuth.class);
        FirebaseToken token = mock(FirebaseToken.class);
        when(firebaseAuth.verifyIdToken("firebase-id-token")).thenReturn(token);
        when(token.getEmail()).thenReturn("student@example.com");
        when(token.getClaims()).thenReturn(Map.of(
                "email_verified", true,
                "firebase", Map.of("sign_in_provider", "password")));

        StaticListableBeanFactory beanFactory = new StaticListableBeanFactory();
        beanFactory.addBean("firebaseAuth", firebaseAuth);
        AuthService service = new AuthService(
                null,
                null,
                null,
                null,
                beanFactory.getBeanProvider(FirebaseAuth.class));
        GoogleLoginRequest request = new GoogleLoginRequest();
        request.setIdToken("firebase-id-token");
        request.setRole(User.Role.STUDENT);

        assertThatThrownBy(() -> service.googleLogin(request))
                .isInstanceOf(BusinessException.class)
                .satisfies(error -> assertThat(((BusinessException) error).getStatus())
                        .isEqualTo(HttpStatus.UNAUTHORIZED));
    }

    @Test
    void googleLoginCreatesVerifiedStudentAndReturnsExaTokens() throws Exception {
        FirebaseAuth firebaseAuth = mock(FirebaseAuth.class);
        FirebaseToken token = mock(FirebaseToken.class);
        UserRepository userRepository = mock(UserRepository.class);
        PasswordEncoder passwordEncoder = mock(PasswordEncoder.class);
        JwtTokenProvider jwtTokenProvider = mock(JwtTokenProvider.class);
        when(firebaseAuth.verifyIdToken("firebase-id-token")).thenReturn(token);
        when(token.getEmail()).thenReturn(" Student@Example.com ");
        when(token.getName()).thenReturn("Student Example");
        when(token.getPicture()).thenReturn("https://example.com/avatar.png");
        when(token.getClaims()).thenReturn(Map.of(
                "email_verified", true,
                "firebase", Map.of("sign_in_provider", "google.com")));
        when(userRepository.findByEmailAndDeletedAtIsNull("student@example.com"))
                .thenReturn(Optional.empty());
        when(userRepository.findByEmail("student@example.com")).thenReturn(Optional.empty());
        when(passwordEncoder.encode(anyString())).thenReturn("random-password-hash");
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> {
            User user = invocation.getArgument(0);
            user.setId(24L);
            return user;
        });
        when(jwtTokenProvider.generateAccessToken(24L, "student@example.com", "STUDENT"))
                .thenReturn("exa-access-token");
        when(jwtTokenProvider.generateRefreshToken(24L, "student@example.com"))
                .thenReturn("exa-refresh-token");
        when(jwtTokenProvider.getAccessExpirationMs()).thenReturn(86_400_000L);

        StaticListableBeanFactory beanFactory = new StaticListableBeanFactory();
        beanFactory.addBean("firebaseAuth", firebaseAuth);
        AuthService service = new AuthService(
                userRepository,
                passwordEncoder,
                jwtTokenProvider,
                null,
                beanFactory.getBeanProvider(FirebaseAuth.class));
        GoogleLoginRequest request = new GoogleLoginRequest();
        request.setIdToken("firebase-id-token");
        request.setRole(User.Role.STUDENT);

        var response = service.googleLogin(request);

        assertThat(response.getAccessToken()).isEqualTo("exa-access-token");
        assertThat(response.getRefreshToken()).isEqualTo("exa-refresh-token");
        assertThat(response.getUser().getEmail()).isEqualTo("student@example.com");
        assertThat(response.getUser().getRole()).isEqualTo("STUDENT");
        verify(userRepository).save(org.mockito.ArgumentMatchers.argThat(user ->
                user.getEmailVerified() && user.getRole() == User.Role.STUDENT));
    }

    @Test
    void googleLoginReturnsRoleRequiredCodeForNewAccountWithoutRole() throws Exception {
        FirebaseAuth firebaseAuth = mock(FirebaseAuth.class);
        FirebaseToken token = mock(FirebaseToken.class);
        UserRepository userRepository = mock(UserRepository.class);
        when(firebaseAuth.verifyIdToken("firebase-id-token")).thenReturn(token);
        when(token.getEmail()).thenReturn("student@example.com");
        when(token.getClaims()).thenReturn(Map.of(
                "email_verified", true,
                "firebase", Map.of("sign_in_provider", "google.com")));
        when(userRepository.findByEmailAndDeletedAtIsNull("student@example.com"))
                .thenReturn(Optional.empty());
        when(userRepository.findByEmail("student@example.com")).thenReturn(Optional.empty());

        StaticListableBeanFactory beanFactory = new StaticListableBeanFactory();
        beanFactory.addBean("firebaseAuth", firebaseAuth);
        AuthService service = new AuthService(
                userRepository,
                null,
                null,
                null,
                beanFactory.getBeanProvider(FirebaseAuth.class));
        GoogleLoginRequest request = new GoogleLoginRequest();
        request.setIdToken("firebase-id-token");

        assertThatThrownBy(() -> service.googleLogin(request))
                .isInstanceOf(BusinessException.class)
                .satisfies(error -> assertThat(((BusinessException) error).getCode())
                        .isEqualTo("GOOGLE_ROLE_REQUIRED"));
    }

    @Test
    void googleLoginDoesNotAllowAdminProvisioning() {
        AuthService service = new AuthService(
                null,
                null,
                null,
                null,
                new StaticListableBeanFactory().getBeanProvider(FirebaseAuth.class));
        GoogleLoginRequest request = new GoogleLoginRequest();
        request.setRole(User.Role.ADMIN);

        assertThatThrownBy(() -> service.googleLogin(request))
                .isInstanceOf(BusinessException.class)
                .satisfies(error -> assertThat(((BusinessException) error).getStatus())
                        .isEqualTo(HttpStatus.FORBIDDEN));
    }
}
