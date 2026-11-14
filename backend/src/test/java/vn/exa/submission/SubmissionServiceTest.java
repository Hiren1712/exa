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

import java.time.LocalDateTime;
import java.util.List;
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
    void startCanResumeExistingAttemptAfterExamCloses() {
        SubmissionRepository submissionRepository = mock(SubmissionRepository.class);
        Exam exam = Exam.builder().id(7L).status(Exam.Status.CLOSED).build();
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
        verify(submissionRepository, never()).save(any(Submission.class));
        verify(submissionRepository, never()).countByExamIdAndStudentId(anyLong(), anyLong());
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

    @Test
    void proctorOverviewReturnsAllEventTypesForOnlyActiveSubmissions() {
        SubmissionRepository submissionRepository = mock(SubmissionRepository.class);
        ProctorEventRepository proctorEventRepository = mock(ProctorEventRepository.class);
        Exam exam = Exam.builder().id(7L).ownerId(9L).proctorEnabled(true).build();
        Submission active = Submission.builder()
                .id(15L)
                .examId(7L)
                .studentId(23L)
                .startedAt(LocalDateTime.now())
                .status(Submission.Status.IN_PROGRESS)
                .build();
        ProctorEventRepository.EventCountProjection eventCount =
                mock(ProctorEventRepository.EventCountProjection.class);
        when(eventCount.getSubmissionId()).thenReturn(15L);
        when(eventCount.getEventType()).thenReturn(ProctorEvent.EventType.FULLSCREEN_EXIT);
        when(eventCount.getEventCount()).thenReturn(2L);
        ExamRepository examRepository = mock(ExamRepository.class);
        when(examRepository.findByIdAndDeletedAtIsNull(7L)).thenReturn(Optional.of(exam));
        when(submissionRepository.findByExamIdAndStatusOrderByStartedAtDesc(
                7L, Submission.Status.IN_PROGRESS)).thenReturn(List.of(active));
        when(proctorEventRepository.summarizeBySubmissionIds(List.of(15L))).thenReturn(List.of(eventCount));

        SubmissionService service = new SubmissionService(
                submissionRepository,
                proctorEventRepository,
                examRepository,
                mock(QuestionRepository.class),
                new AutoGradeService(),
                new ObjectMapper(),
                mock(PasswordEncoder.class),
                mock(ExamQuestionRepository.class),
                mock(ClassroomMemberRepository.class));

        List<SubmissionService.ProctorMonitorItem> overview = service.getProctorOverview(7L, 9L, false);

        assertThat(overview).singleElement().satisfies(item -> {
            assertThat(item.submissionId()).isEqualTo(15L);
            assertThat(item.proctorEvents()).containsEntry("FULLSCREEN_EXIT", 2L);
        });
        verify(proctorEventRepository).summarizeBySubmissionIds(List.of(15L));
    }

    @Test
    void proctorEventsCannotBeLoggedForAnExamWithoutProctoring() {
        SubmissionRepository submissionRepository = mock(SubmissionRepository.class);
        Submission active = Submission.builder()
                .id(15L)
                .examId(7L)
                .studentId(23L)
                .status(Submission.Status.IN_PROGRESS)
                .build();
        when(submissionRepository.findByIdAndStudentId(15L, 23L)).thenReturn(Optional.of(active));
        ExamRepository examRepository = mock(ExamRepository.class);
        when(examRepository.findByIdAndDeletedAtIsNull(7L))
                .thenReturn(Optional.of(Exam.builder().id(7L).proctorEnabled(false).build()));
        ProctorEventRepository proctorEventRepository = mock(ProctorEventRepository.class);

        SubmissionService service = new SubmissionService(
                submissionRepository,
                proctorEventRepository,
                examRepository,
                mock(QuestionRepository.class),
                new AutoGradeService(),
                new ObjectMapper(),
                mock(PasswordEncoder.class),
                mock(ExamQuestionRepository.class),
                mock(ClassroomMemberRepository.class));

        org.assertj.core.api.Assertions.assertThatThrownBy(() -> service.logProctorEvent(
                15L, 23L, ProctorEvent.EventType.TAB_SWITCH, ProctorEvent.Severity.MEDIUM, null))
                .isInstanceOf(vn.exa.common.BusinessException.class)
                .hasMessageContaining("chưa bật chức năng giám sát");
        verifyNoInteractions(proctorEventRepository);
    }
}
