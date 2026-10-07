package vn.exa.classroom;

import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;

@Entity
@Table(name = "classrooms", indexes = {
        @Index(name = "idx_classroom_code", columnList = "code"),
        @Index(name = "idx_classroom_teacher", columnList = "teacher_id")
})
@EntityListeners(AuditingEntityListener.class)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Classroom {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "teacher_id", nullable = false)
    private Long teacherId;

    @Column(nullable = false, length = 120)
    private String name;

    @Column(nullable = false, unique = true, length = 20)
    private String code;

    @Column(length = 60)
    private String subject;

    private Integer grade;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "max_students")
    @Builder.Default
    private Integer maxStudents = 100;

    @Column(name = "is_archived")
    @Builder.Default
    private Boolean archived = false;

    @CreatedDate
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @LastModifiedDate
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Column(name = "deleted_at")
    private LocalDateTime deletedAt;
}