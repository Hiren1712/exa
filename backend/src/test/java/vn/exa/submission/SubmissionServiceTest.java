package vn.exa.submission;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;
import vn.exa.classroom.ClassroomMemberRepository;
import vn.exa.exam.AutoGradeService;
import vn.exa.exam.Exam;
import vn.exa.exam.ExamQuestionRepository;
import vn.exa.exam.ExamRepository;
import vn.exa.question.QuestionRepository;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class SubmissionServiceTest {

    @Test
    void startReturnsExistingInProgressAttemptInsteadOfCreatingAnother() {
        SubmissionRepository submissionRepository = mock(SubmissionRepository.class);
        Exam exam = Exam.builder()
                .id(7L)
                .status(Exam.Status.OPEN)
                .maxAttempts(1)
                .build();
        Submission activeAttempt = Submission.builder()
                .id(15L)
                .examId(7L)
                .studentId(23L)
                .status(Submission.Status.IN_PROGRESS)
                .build();
        ExamRepository examRepository = mock(ExamRepository.class);
        when(examRepository.findByIdAndDeletedAtIsNull(7L)).thenReturn(Optional.of(exam));
        when(submissionRepository.findFirstByExamIdAndStudentIdAndStatusOrderByStartedAtDesc(
                7L, 23L, Submission.Status.IN_PROGRESS)).thenReturn(Optional.of(activeAttempt));

        SubmissionService service = new SubmissionService(
                submissionRepository,
                mock(ProctorEventRepository.class),
                examRepository,
                mock(QuestionRepository.class),
                new AutoGradeService(),
                new ObjectMapper(),
                mock(PasswordEncoder.class),
                mock(ExamQuestionRepository.class),
                mock(ClassroomMemberRepository.class));

        assertThat(service.start(7L, 23L, null)).isSameAs(activeAttempt);
        verify(submissionRepository, never()).countByExamIdAndStudentId(anyLong(), anyLong());
        verify(submissionRepository, never()).save(any(Submission.class));
    }

    @Test
    void roomInviteAllowsStudentOutsideAssignedClassToStartExam() {
        SubmissionRepository submissionRepository = mock(SubmissionRepository.class);
        Exam exam = Exam.builder()
                .id(7L)
                .classroomId(3L)
                .inviteCode("ABC2345678")
                .status(Exam.Status.OPEN)
                .maxAttempts(1)
                .build();
        ExamRepository examRepository = mock(ExamRepository.class);
        ClassroomMemberRepository classroomMemberRepository = mock(ClassroomMemberRepository.class);
        when(examRepository.findByIdAndDeletedAtIsNull(7L)).thenReturn(Optional.of(exam));
        when(classroomMemberRepository.existsByClassroomIdAndStudentIdAndStatus(
                3L, 23L, vn.exa.classroom.ClassroomMember.Status.ACTIVE)).thenReturn(false);
        when(submissionRepository.findFirstByExamIdAndStudentIdAndStatusOrderByStartedAtDesc(
                7L, 23L, Submission.Status.IN_PROGRESS)).thenReturn(Optional.empty());
        when(submissionRepository.countByExamIdAndStudentId(7L, 23L)).thenReturn(0L);
        when(submissionRepository.save(any(Submission.class))).thenAnswer(call -> call.getArgument(0));

        SubmissionService service = new SubmissionService(
                submissionRepository,
                mock(ProctorEventRepository.class),
                examRepository,
                mock(QuestionRepository.class),
                new AutoGradeService(),
                new ObjectMapper(),
                mock(PasswordEncoder.class),
                mock(ExamQuestionRepository.class),
                classroomMemberRepository);

        Submission result = service.start(7L, 23L, null, " abc2345678 ");

        assertThat(result.getExamId()).isEqualTo(7L);
        assertThat(result.getStudentId()).isEqualTo(23L);
        verify(submissionRepository).save(any(Submission.class));
    }

    @Test
    void roomInviteDoesNotAllowStudentOutsideAssignedClassWithoutValidCode() {
        SubmissionRepository submissionRepository = mock(SubmissionRepository.class);
        Exam exam = Exam.builder()
                .id(7L)
                .classroomId(3L)
                .inviteCode("ABC2345678")
                .status(Exam.Status.OPEN)
                .maxAttempts(1)
                .build();
        ExamRepository examRepository = mock(ExamRepository.class);
        ClassroomMemberRepository classroomMemberRepository = mock(ClassroomMemberRepository.class);
        when(examRepository.findByIdAndDeletedAtIsNull(7L)).thenReturn(Optional.of(exam));
        when(classroomMemberRepository.existsByClassroomIdAndStudentIdAndStatus(
                3L, 23L, vn.exa.classroom.ClassroomMember.Status.ACTIVE)).thenReturn(false);

        SubmissionService service = new SubmissionService(
                submissionRepository,
                mock(ProctorEventRepository.class),
                examRepository,
                mock(QuestionRepository.class),
                new AutoGradeService(),
                new ObjectMapper(),
                mock(PasswordEncoder.class),
                mock(ExamQuestionRepository.class),
                classroomMemberRepository);

        org.assertj.core.api.Assertions.assertThatThrownBy(() -> service.start(7L, 23L, null, "wrong-code"))
                .isInstanceOf(vn.exa.common.BusinessException.class);
        verify(submissionRepository, never()).save(any(Submission.class));
    }

    @Test
    void unlimitedAttemptsAllowStudentToStartAnotherAttempt() {
        SubmissionRepository submissionRepository = mock(SubmissionRepository.class);
        Exam exam = Exam.builder()
                .id(7L)
                .status(Exam.Status.OPEN)
                .maxAttempts(0)
                .build();
        ExamRepository examRepository = mock(ExamRepository.class);
        when(examRepository.findByIdAndDeletedAtIsNull(7L)).thenReturn(Optional.of(exam));
        when(submissionRepository.findFirstByExamIdAndStudentIdAndStatusOrderByStartedAtDesc(
                7L, 23L, Submission.Status.IN_PROGRESS)).thenReturn(Optional.empty());
        when(submissionRepository.countByExamIdAndStudentId(7L, 23L)).thenReturn(20L);
        when(submissionRepository.save(any(Submission.class))).thenAnswer(call -> call.getArgument(0));

        SubmissionService service = new SubmissionService(
                submissionRepository,
                mock(ProctorEventRepository.class),
                examRepository,
                mock(QuestionRepository.class),
                new AutoGradeService(),
                new ObjectMapper(),
                mock(PasswordEncoder.class),
                mock(ExamQuestionRepository.class),
                mock(ClassroomMemberRepository.class));

        Submission result = service.start(7L, 23L, null);

        assertThat(result.getAttemptNumber()).isEqualTo(21);
        verify(submissionRepository).save(any(Submission.class));
    }
}
