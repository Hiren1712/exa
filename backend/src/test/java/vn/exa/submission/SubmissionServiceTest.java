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
}
