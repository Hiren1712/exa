package vn.exa.exam;

import org.junit.jupiter.api.Test;
import vn.exa.question.Question;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class AutoGradeServiceTest {

    private final AutoGradeService service = new AutoGradeService();

    @Test
    void gradeUsesConfiguredQuestionPointsAndIgnoresEssayAnswers() {
        Question multipleChoice = Question.builder()
                .id(1L)
                .type(Question.Type.MCQ)
                .correctAnswer("B")
                .build();
        Question shortAnswer = Question.builder()
                .id(2L)
                .type(Question.Type.SHORT_ANSWER)
                .answerText("  Đáp án đúng! ")
                .build();
        Question essay = Question.builder()
                .id(3L)
                .type(Question.Type.ESSAY)
                .build();

        BigDecimal score = service.grade(
                List.of(multipleChoice, shortAnswer, essay),
                Map.of(1L, "b", 2L, "đáp án đúng", 3L, "bài tự luận"),
                Map.of(1L, new BigDecimal("3.25"), 2L, new BigDecimal("2.75"),
                        3L, new BigDecimal("4.00")));

        assertThat(score).isEqualByComparingTo("6.00");
    }
}
