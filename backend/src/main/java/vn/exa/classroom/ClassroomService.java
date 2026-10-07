package vn.exa.classroom;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.exa.auth.User;
import vn.exa.auth.UserRepository;
import vn.exa.common.BusinessException;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Objects;

@Service
@RequiredArgsConstructor
@Slf4j
public class ClassroomService {

    private final ClassroomRepository classroomRepository;
    private final ClassroomMemberRepository memberRepository;
    private final UserRepository userRepository;

    private static final String CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final SecureRandom RANDOM = new SecureRandom();

    public List<ClassroomSummary> listByTeacher(Long teacherId) {
        return classroomRepository.findByTeacherIdAndDeletedAtIsNullOrderByCreatedAtDesc(teacherId)
                .stream().map(this::toSummary).toList();
    }

    public Classroom getById(Long id, Long userId) {
        Classroom classroom = findClassroom(id);
        boolean isTeacher = classroom.getTeacherId().equals(userId);
        boolean isMember = memberRepository.findByClassroomIdAndStudentId(id, userId)
                .filter(member -> member.getStatus() == ClassroomMember.Status.ACTIVE)
                .isPresent();
        if (!isTeacher && !isMember) {
            throw BusinessException.forbidden("Bạn không có quyền truy cập lớp học này");
        }
        return classroom;
    }

    public List<ClassroomMemberDetails> listMembers(Long id, Long teacherId) {
        Classroom classroom = findClassroom(id);
        requireTeacher(classroom, teacherId);
        return memberRepository.findByClassroomIdAndStatusOrderByJoinedAtAsc(
                        classroom.getId(), ClassroomMember.Status.ACTIVE).stream()
                .map(member -> userRepository.findByIdAndDeletedAtIsNull(member.getStudentId())
                        .map(student -> new ClassroomMemberDetails(
                                member.getStudentId(), student.getFullName(), student.getEmail(),
                                member.getStatus().name(), member.getJoinedAt()))
                        .orElse(null))
                .filter(Objects::nonNull)
                .toList();
    }

    public List<ClassroomSummary> listByStudent(Long studentId) {
        return memberRepository.findByStudentIdAndStatusOrderByJoinedAtDesc(
                        studentId, ClassroomMember.Status.ACTIVE).stream()
                .map(member -> classroomRepository.findByIdAndDeletedAtIsNull(member.getClassroomId())
                        .orElse(null))
                .filter(Objects::nonNull)
                .map(this::toSummary)
                .toList();
    }

    private ClassroomSummary toSummary(Classroom classroom) {
        long memberCount = memberRepository.countByClassroomIdAndStatus(
                classroom.getId(), ClassroomMember.Status.ACTIVE);
        return new ClassroomSummary(classroom.getId(), classroom.getTeacherId(), classroom.getName(),
                classroom.getCode(), classroom.getSubject(), classroom.getGrade(), classroom.getDescription(),
                classroom.getMaxStudents(), classroom.getArchived(), classroom.getCreatedAt(), memberCount);
    }

    @Transactional
    public Classroom join(String code, Long studentId) {
        return join(code, null, studentId);
    }

    @Transactional
    public Classroom join(String code, Long expectedClassroomId, Long studentId) {
        String normalizedCode = code == null ? "" : code.trim().toUpperCase();
        Classroom classroom = classroomRepository.findByCodeAndDeletedAtIsNull(normalizedCode)
                .orElseThrow(() -> BusinessException.notFound("Mã lớp không tồn tại"));
        if (expectedClassroomId != null && !classroom.getId().equals(expectedClassroomId)) {
            throw BusinessException.badRequest("Mã lớp không khớp với lớp yêu cầu");
        }
        User student = userRepository.findByIdAndDeletedAtIsNull(studentId)
                .orElseThrow(() -> BusinessException.notFound("Tài khoản không tồn tại"));
        if (student.getRole() != User.Role.STUDENT) {
            throw BusinessException.forbidden("Chỉ học sinh mới có thể tham gia lớp");
        }

        ClassroomMember existing = memberRepository.findByClassroomIdAndStudentId(
                classroom.getId(), studentId).orElse(null);
        if (existing != null && existing.getStatus() == ClassroomMember.Status.ACTIVE) {
            throw BusinessException.conflict("Bạn đã là thành viên của lớp này");
        }
        long activeCount = memberRepository.countByClassroomIdAndStatus(
                classroom.getId(), ClassroomMember.Status.ACTIVE);
        if (activeCount >= classroom.getMaxStudents()) {
            throw BusinessException.badRequest("Lớp học đã đủ số lượng học sinh");
        }

        if (existing == null) {
            existing = ClassroomMember.builder()
                    .classroomId(classroom.getId())
                    .studentId(studentId)
                    .studentCode(normalizedCode)
                    .build();
        } else {
            existing.setStatus(ClassroomMember.Status.ACTIVE);
            existing.setJoinedAt(LocalDateTime.now());
        }
        memberRepository.save(existing);
        return classroom;
    }

    @Transactional
    public Classroom create(Long teacherId, String name, String subject, Integer grade, String description) {
        String code = generateCode();
        Classroom classroom = Classroom.builder()
                .teacherId(teacherId)
                .name(name)
                .code(code)
                .subject(subject)
                .grade(grade)
                .description(description)
                .build();

        classroom = classroomRepository.save(classroom);
        log.info("Classroom created: {} (code={})", name, code);
        return classroom;
    }

    @Transactional
    public Classroom update(Long id, Long teacherId, String name, String subject, Integer grade, String description) {
        Classroom classroom = findClassroom(id);
        requireTeacher(classroom, teacherId);

        classroom.setName(name);
        classroom.setSubject(subject);
        classroom.setGrade(grade);
        classroom.setDescription(description);
        return classroomRepository.save(classroom);
    }

    @Transactional
    public void archive(Long id, Long teacherId) {
        Classroom classroom = findClassroom(id);
        requireTeacher(classroom, teacherId);
        classroom.setArchived(true);
        classroom.setDeletedAt(java.time.LocalDateTime.now());
        classroomRepository.save(classroom);
    }

    private String generateCode() {
        for (int attempt = 0; attempt < 10; attempt++) {
            StringBuilder sb = new StringBuilder("EXA-");
            for (int i = 0; i < 6; i++) {
                sb.append(CODE_CHARS.charAt(RANDOM.nextInt(CODE_CHARS.length())));
            }
            String code = sb.toString();
            if (!classroomRepository.existsByCodeAndDeletedAtIsNull(code)) return code;
        }
        throw new IllegalStateException("Không thể tạo mã lớp duy nhất");
    }

    private Classroom findClassroom(Long id) {
        return classroomRepository.findByIdAndDeletedAtIsNull(id)
                .orElseThrow(() -> BusinessException.notFound("Lớp học không tồn tại"));
    }

    private void requireTeacher(Classroom classroom, Long teacherId) {
        if (!classroom.getTeacherId().equals(teacherId)) {
            throw BusinessException.forbidden("Bạn không có quyền truy cập lớp học này");
        }
    }

    public record ClassroomMemberDetails(
            Long studentId, String fullName, String email, String status, LocalDateTime joinedAt) {}

    public record ClassroomSummary(
            Long id, Long teacherId, String name, String code, String subject, Integer grade,
            String description, Integer maxStudents, Boolean archived, LocalDateTime createdAt,
            long memberCount) {}
}