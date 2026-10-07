package vn.exa.exam;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ExamQuestionRepository extends JpaRepository<ExamQuestion, Long> {

    List<ExamQuestion> findByExamIdOrderByOrderIndexAsc(Long examId);

    void deleteByExamId(Long examId);

    void deleteByExamIdAndQuestionId(Long examId, Long questionId);
}
