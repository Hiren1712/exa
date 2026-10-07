package vn.exa.exam;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ExamRepository extends JpaRepository<Exam, Long> {

    List<Exam> findByOwnerIdAndDeletedAtIsNullOrderByCreatedAtDesc(Long ownerId);

    List<Exam> findByClassroomIdAndStatusAndDeletedAtIsNull(Long classroomId, Exam.Status status);

    List<Exam> findByStatusAndDeletedAtIsNull(Exam.Status status);

    Optional<Exam> findByIdAndDeletedAtIsNull(Long id);
}