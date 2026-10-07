package vn.exa.exam;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import vn.exa.question.Question;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class AutoGradeService {

    /**
     * Chấm điểm tự động cho câu trắc nghiệm.
     *
     * @param questions danh sách câu hỏi của đề
     * @param answers   map: questionId → đáp án học sinh chọn (A/B/C/D hoặc nội dung)
     * @return điểm khách quan tổng (thang 10); câu tự luận chờ giáo viên chấm
     */
    public BigDecimal grade(List<Question> questions, Map<Long, String> answers) {
        if (questions == null || questions.isEmpty()) {
            return BigDecimal.ZERO;
        }

        int totalQuestions = questions.size();
        double pointsPerQuestion = 10.0 / totalQuestions;
        double totalEarned = 0;

        for (Question q : questions) {
            String studentAnswer = answers.get(q.getId());
            if (studentAnswer == null || studentAnswer.isBlank()) {
                continue; // Không trả lời → 0 điểm
            }

            switch (q.getType()) {
                case MCQ, TRUE_FALSE -> {
                    // So sánh đáp án trắc nghiệm
                    if (q.getCorrectAnswer() != null
                            && q.getCorrectAnswer().equalsIgnoreCase(studentAnswer.trim())) {
                        totalEarned += pointsPerQuestion;
                    }
                }
                case SHORT_ANSWER -> {
                    // So sánh đáp án ngắn (không phân biệt hoa thường)
                    if (q.getAnswerText() != null
                            && normalize(q.getAnswerText()).equals(normalize(studentAnswer))) {
                        totalEarned += pointsPerQuestion;
                    }
                }
                case ESSAY -> {
                    // Essay responses are intentionally left for manual grading.
                }
            }
        }

        BigDecimal score = BigDecimal.valueOf(totalEarned)
                .setScale(1, RoundingMode.HALF_UP);

        log.debug("Auto graded: {}/{} questions, score = {}", answers.size(), totalQuestions, score);
        return score;
    }

    /**
     * Chuẩn hoá chuỗi để so sánh: bỏ khoảng trắng, lowercase, bỏ dấu câu.
     */
    private String normalize(String s) {
        if (s == null) return "";
        return s.toLowerCase()
                .replaceAll("\\s+", " ")
                .replaceAll("[.,;:!?]", "")
                .trim();
    }
}