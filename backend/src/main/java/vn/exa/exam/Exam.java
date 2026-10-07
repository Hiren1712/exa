package vn.exa.exam;

import jakarta.persistence.*;
import com.fasterxml.jackson.annotation.JsonIgnore;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "exams", indexes = {
        @Index(name = "idx_exam_owner", columnList = "owner_id"),
        @Index(name = "idx_exam_classroom", columnList = "classroom_id"),
        @Index(name = "idx_exam_status", columnList = "status")
})
@EntityListeners(AuditingEntityListener.class)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Exam {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "owner_id", nullable = false)
    private Long ownerId;

    @Column(name = "classroom_id")
    private Long classroomId;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(length = 60)
    private String subject;

    @Column(name = "duration_min", nullable = false)
    private Integer durationMin;

    @Column(name = "total_points", precision = 5, scale = 2)
    @Builder.Default
    private BigDecimal totalPoints = BigDecimal.TEN;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private Status status = Status.DRAFT;

    @Column(name = "starts_at")
    private LocalDateTime startsAt;

    @Column(name = "ends_at")
    private LocalDateTime endsAt;

    @Column(name = "password_hash")
    @JsonIgnore
    private String passwordHash;

    @Column(name = "shuffle_questions")
    @Builder.Default
    private Boolean shuffleQuestions = true;

    @Column(name = "shuffle_options")
    @Builder.Default
    private Boolean shuffleOptions = true;

    @Column(name = "proctor_enabled")
    @Builder.Default
    private Boolean proctorEnabled = true;

    @Column(name = "lock_screen")
    @Builder.Default
    private Boolean lockScreen = true;

    @Column(name = "max_attempts")
    @Builder.Default
    private Integer maxAttempts = 1;

    @Column(name = "show_answer_after", length = 20)
    @Builder.Default
    private String showAnswerAfter = "AFTER_SUBMIT";

    @Column(columnDefinition = "JSON")
    private String metadata;

    @CreatedDate
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @LastModifiedDate
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Column(name = "deleted_at")
    private LocalDateTime deletedAt;

    public enum Status {
        DRAFT, SCHEDULED, OPEN, CLOSED, ARCHIVED
    }
}