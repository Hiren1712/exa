package vn.exa.exam;

import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;
import vn.exa.question.QuestionRepository;
import vn.exa.submission.SubmissionRepository;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class ExamInviteServiceTest {

    @Test
    void createsUniqueLookingRoomCodeForNewExam() {
        ExamRepository examRepository = mock(ExamRepository.class);
        when(examRepository.existsByInviteCode(anyString())).thenReturn(false);
        when(examRepository.save(any(Exam.class))).thenAnswer(call -> call.getArgument(0));
        ExamService service = new ExamService(
                examRepository,
                mock(ExamQuestionRepository.class),
                mock(QuestionRepository.class),
                mock(PasswordEncoder.class),
                mock(SubmissionRepository.class));
        ExamService.ExamRequest request = new ExamService.ExamRequest();
        request.setTitle("Kiểm tra Toán");
        request.setSubject("Toán");

        Exam created = service.create(12L, request);

        assertThat(created.getInviteCode()).matches("[2-9A-HJ-NP-Z]{10}");
    }

    @Test
    void createsInviteCodeForExistingExamAndResolvesCaseInsensitively() {
        Exam exam = Exam.builder().id(5L).ownerId(12L).title("Kiểm tra").build();
        ExamRepository examRepository = mock(ExamRepository.class);
        when(examRepository.findByIdAndDeletedAtIsNull(5L)).thenReturn(Optional.of(exam));
        when(examRepository.existsByInviteCode(anyString())).thenReturn(false);
        when(examRepository.save(any(Exam.class))).thenAnswer(call -> call.getArgument(0));
        when(examRepository.findByInviteCodeAndDeletedAtIsNull(anyString()))
                .thenReturn(Optional.of(exam));
        ExamService service = new ExamService(
                examRepository,
                mock(ExamQuestionRepository.class),
                mock(QuestionRepository.class),
                mock(PasswordEncoder.class),
                mock(SubmissionRepository.class));

        Exam withInvite = service.getOrCreateInvite(5L, 12L);

        assertThat(service.getByInviteCode(" " + withInvite.getInviteCode().toLowerCase() + " "))
                .isSameAs(exam);
    }
}
