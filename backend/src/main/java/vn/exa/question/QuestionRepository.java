package vn.exa.question;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface QuestionRepository extends JpaRepository<Question, Long> {

    Page<Question> findByOwnerIdAndDeletedAtIsNull(Long ownerId, Pageable pageable);

    Optional<Question> findByIdAndDeletedAtIsNull(Long id);

    @Query("""
        SELECT q FROM Question q
        WHERE q.ownerId = :ownerId
          AND q.deletedAt IS NULL
          AND (:subject IS NULL OR q.subject = :subject)
          AND (:grade IS NULL OR q.grade = :grade)
          AND (:difficulty IS NULL OR q.difficulty = :difficulty)
          AND (:type IS NULL OR q.type = :type)
          AND (:keyword IS NULL OR LOWER(q.content) LIKE LOWER(CONCAT('%', :keyword, '%')))
        ORDER BY q.createdAt DESC
    """)
    Page<Question> search(
            @Param("ownerId") Long ownerId,
            @Param("subject") String subject,
            @Param("grade") Integer grade,
            @Param("difficulty") Question.Difficulty difficulty,
            @Param("type") Question.Type type,
            @Param("keyword") String keyword,
            Pageable pageable);
}