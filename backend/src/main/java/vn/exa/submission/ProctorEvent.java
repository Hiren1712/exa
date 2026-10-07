package vn.exa.submission;

import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;

@Entity
@Table(name = "proctor_events", indexes = {
        @Index(name = "idx_pe_submission", columnList = "submission_id"),
        @Index(name = "idx_pe_type", columnList = "event_type")
})
@EntityListeners(AuditingEntityListener.class)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ProctorEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "submission_id", nullable = false)
    private Long submissionId;

    @Enumerated(EnumType.STRING)
    @Column(name = "event_type", nullable = false, length = 30)
    private EventType eventType;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private Severity severity = Severity.MEDIUM;

    @Column(name = "occurred_at", nullable = false)
    private LocalDateTime occurredAt;

    @Column(name = "duration_ms")
    private Integer durationMs;

    @Column(columnDefinition = "JSON")
    private String payload;

    @CreatedDate
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    public enum EventType {
        TAB_SWITCH, FULLSCREEN_EXIT, COPY_ATTEMPT, NO_FACE, MULTIPLE_FACES, SCREENSHOT
    }

    public enum Severity {
        LOW, MEDIUM, HIGH, CRITICAL
    }
}