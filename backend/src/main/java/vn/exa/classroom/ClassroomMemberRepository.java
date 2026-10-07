package vn.exa.classroom;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ClassroomMemberRepository extends JpaRepository<ClassroomMember, Long> {

    List<ClassroomMember> findByClassroomIdAndStatusOrderByJoinedAtAsc(
            Long classroomId, ClassroomMember.Status status);

    Optional<ClassroomMember> findByClassroomIdAndStudentId(Long classroomId, Long studentId);

    boolean existsByClassroomIdAndStudentIdAndStatus(
            Long classroomId, Long studentId, ClassroomMember.Status status);

    List<ClassroomMember> findByStudentIdAndStatusOrderByJoinedAtDesc(
            Long studentId, ClassroomMember.Status status);

    long countByClassroomIdAndStatus(Long classroomId, ClassroomMember.Status status);
}
