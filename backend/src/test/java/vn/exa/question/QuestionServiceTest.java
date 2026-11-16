package vn.exa.question;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import vn.exa.common.BusinessException;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class QuestionServiceTest {

    @Test
    void rejectsTrueFalseQuestionWithOtherThanFourOrLegacyTwoStatements() {
        QuestionService service = service(mock(QuestionRepository.class));
        QuestionService.QuestionRequest request = trueFalseRequest(List.of("Một", "Hai", "Ba"), "TFT");

        assertThatThrownBy(() -> service.create(1L, request))
                .isInstanceOf(BusinessException.class)
                .hasMessage("Câu Đúng/Sai phải có đúng bốn mệnh đề");
    }

    @Test
    void rejectsFourStatementQuestionWithInvalidAnswerKey() {
        QuestionService service = service(mock(QuestionRepository.class));
        QuestionService.QuestionRequest request = trueFalseRequest(
                List.of("Một", "Hai", "Ba", "Bốn"), "TFT");

        assertThatThrownBy(() -> service.create(1L, request))
                .isInstanceOf(BusinessException.class)
                .hasMessage("Đáp án Đúng/Sai phải có bốn ký tự T/F theo thứ tự mệnh đề");
    }

    @Test
    void acceptsFourStatementQuestionWithFourCharacterAnswerKey() {
        QuestionRepository repository = mock(QuestionRepository.class);
        when(repository.save(any(Question.class))).thenAnswer(call -> call.getArgument(0));
        QuestionService service = service(repository);
        QuestionService.QuestionRequest request = trueFalseRequest(
                List.of("Một", "Hai", "Ba", "Bốn"), "TFFT");

        Question saved = service.create(1L, request);

        assertThat(saved.getCorrectAnswer()).isEqualTo("TFFT");
        verify(repository).save(any(Question.class));
    }

    private QuestionService service(QuestionRepository repository) {
        return new QuestionService(repository, mock(QuestionMediaRepository.class), new ObjectMapper());
    }

    private QuestionService.QuestionRequest trueFalseRequest(List<String> statements, String answer) {
        QuestionService.QuestionRequest request = new QuestionService.QuestionRequest();
        request.setSubject("Toán");
        request.setDifficulty(Question.Difficulty.COMPREHENSION);
        request.setType(Question.Type.TRUE_FALSE);
        request.setContent("Xét các mệnh đề sau.");
        request.setOptions(statements);
        request.setCorrectAnswer(answer);
        return request;
    }
}
