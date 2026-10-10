package vn.exa.question;

import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;

@Entity
@Table(name = "questions", indexes = {
        @Index(name = "idx_q_subject_grade", columnList = "subject,grade"),
        @Index(name = "idx_q_owner", columnList = "owner_id"),
        @Index(name = "idx_q_difficulty", columnList = "difficulty")
})
@EntityListeners(AuditingEntityListener.class)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Question {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "owner_id", nullable = false)
    private Long ownerId;

    @Column(nullable = false, length = 60)
    private String subject;

    private Integer grade;

    @Column(length = 120)
    private String unit;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private Difficulty difficulty;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Type type;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String content;

    @Column(name = "content_html", columnDefinition = "MEDIUMTEXT")
    private String contentHtml;

    @Column(columnDefinition = "JSON")
    private String options;

    @Column(name = "correct_answer", length = 10)
    private String correctAnswer;

    @Column(name = "answer_text", columnDefinition = "TEXT")
    private String answerText;

    @Column(columnDefinition = "TEXT")
    private String explanation;

    @Column(length = 200)
    private String source;

    @Column(name = "is_ai_generated")
    @Builder.Default
    private Boolean aiGenerated = false;

    @Column(name = "import_job_id")
    private Long importJobId;

    @Column(name = "import_reviewed", nullable = false)
    @Builder.Default
    private Boolean importReviewed = true;

    @Column(name = "usage_count")
    @Builder.Default
    private Integer usageCount = 0;

    @CreatedDate
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @LastModifiedDate
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Column(name = "deleted_at")
    private LocalDateTime deletedAt;

    public enum Difficulty {
        RECOGNITION, COMPREHENSION, APPLICATION, HIGH_APPLICATION
    }

    public enum Type {
        MCQ, TRUE_FALSE, SHORT_ANSWER, ESSAY
    }
}