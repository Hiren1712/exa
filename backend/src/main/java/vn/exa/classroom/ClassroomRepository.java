package vn.exa.classroom;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ClassroomRepository extends JpaRepository<Classroom, Long> {

    List<Classroom> findByTeacherIdAndDeletedAtIsNullOrderByCreatedAtDesc(Long teacherId);

    Optional<Classroom> findByCodeAndDeletedAtIsNull(String code);

    Optional<Classroom> findByIdAndDeletedAtIsNull(Long id);

    boolean existsByCodeAndDeletedAtIsNull(String code);
}