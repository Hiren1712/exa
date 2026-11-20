package vn.exa.common;

import lombok.AllArgsConstructor;
import lombok.Getter;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

import java.util.Collection;
import java.util.List;

@Getter
@AllArgsConstructor
public class CurrentUser {

    private final Long id;
    private final String email;
    private final String role;
    private final String sessionId;

    public CurrentUser(Long id, String email, String role) {
        this(id, email, role, null);
    }

    public boolean isTeacher() {
        return "TEACHER".equals(role) || "ADMIN".equals(role);
    }

    public boolean isStudent() {
        return "STUDENT".equals(role);
    }

    public boolean isAdmin() {
        return "ADMIN".equals(role);
    }

    public Collection<? extends GrantedAuthority> getAuthorities() {
        return List.of(new SimpleGrantedAuthority("ROLE_" + role));
    }
}