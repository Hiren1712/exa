package vn.exa.submission;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SubmissionRepository extends JpaRepository<Submission, Long> {

    Optional<Submission> findByExamIdAndStudentIdAndAttemptNumber(
            Long examId, Long studentId, Integer attemptNumber);

    List<Submission> findByExamIdOrderBySubmittedAtDesc(Long examId);

    List<Submission> findByExamIdIn(List<Long> examIds);

    List<Submission> findByStudentIdOrderBySubmittedAtDesc(Long studentId);

    Optional<Submission> findByIdAndStudentId(Long id, Long studentId);

    long countByExamId(Long examId);

    long countByExamIdAndStudentId(Long examId, Long studentId);

    long countByExamIdAndStatus(Long examId, Submission.Status status);
}