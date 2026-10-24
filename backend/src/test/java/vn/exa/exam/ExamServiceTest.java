package vn.exa.exam;

import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;
import vn.exa.question.Question;
import vn.exa.question.QuestionRepository;
import vn.exa.submission.SubmissionRepository;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ExamServiceTest {

    @Test
    void flushesRemovedQuestionLinksBeforeReinsertingTheSameQuestions() {
        Exam exam = Exam.builder()
                .id(7L)
                .ownerId(12L)
                .title("Đề cũ")
                .subject("Toán")
                .maxAttempts(1)
                .build();
        Question question = Question.builder()
                .id(18L)
                .ownerId(12L)
                .subject("Toán")
                .difficulty(Question.Difficulty.COMPREHENSION)
                .type(Question.Type.MCQ)
                .content("Câu hỏi")
                .build();
        ExamRepository examRepository = mock(ExamRepository.class);
        ExamQuestionRepository examQuestionRepository = mock(ExamQuestionRepository.class);
        QuestionRepository questionRepository = mock(QuestionRepository.class);
        when(examRepository.findByIdAndDeletedAtIsNull(7L)).thenReturn(Optional.of(exam));
        when(examRepository.save(any(Exam.class))).thenAnswer(call -> call.getArgument(0));
        when(questionRepository.findAllById(List.of(18L))).thenReturn(List.of(question));
        ExamService service = new ExamService(
                examRepository,
                examQuestionRepository,
                questionRepository,
                mock(PasswordEncoder.class),
                mock(SubmissionRepository.class));
        ExamService.ExamRequest request = new ExamService.ExamRequest();
        request.setTitle("Đề cũ");
        request.setDescription("");
        request.setSubject("Toán");
        request.setDurationMin(45);
        request.setTotalPoints(BigDecimal.TEN);
        request.setMaxAttempts(0);
        request.setQuestionIds(List.of(18L));

        service.update(7L, 12L, request);

        var order = inOrder(examQuestionRepository);
        order.verify(examQuestionRepository).deleteByExamId(7L);
        order.verify(examQuestionRepository).flush();
        order.verify(examQuestionRepository).saveAll(anyList());
        verify(examRepository).save(exam);
    }
}
