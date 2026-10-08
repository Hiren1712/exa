package vn.exa.auth;

import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "users", indexes = {
        @Index(name = "idx_users_email", columnList = "email"),
        @Index(name = "idx_users_role", columnList = "role")
})
@EntityListeners(AuditingEntityListener.class)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 191)
    private String email;

    @Column(name = "password_hash", nullable = false)
    private String passwordHash;

    @Column(name = "full_name", nullable = false, length = 120)
    private String fullName;

    @Column(length = 20)
    private String phone;

    @Column(name = "avatar_url", length = 500)
    private String avatarUrl;

    @Column(name = "cover_image_url", length = 500)
    private String coverImageUrl;

    @Column(name = "date_of_birth")
    private LocalDate dateOfBirth;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Role role;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private Plan plan = Plan.FREE;

    @Column(name = "is_active")
    @Builder.Default
    private Boolean active = true;

    @Column(name = "email_verified")
    @Builder.Default
    private Boolean emailVerified = false;

    @Column(name = "last_login_at")
    private LocalDateTime lastLoginAt;

    @CreatedDate
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @LastModifiedDate
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Column(name = "deleted_at")
    private LocalDateTime deletedAt;

    // ===== Enums =====

    public enum Role {
        ADMIN, TEACHER, STUDENT
    }

    public enum Plan {
        FREE, PRO, ENTERPRISE
    }
}