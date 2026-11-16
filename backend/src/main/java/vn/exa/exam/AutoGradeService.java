package vn.exa.exam;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import vn.exa.question.Question;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class AutoGradeService {
    private static final List<BigDecimal> TRUE_FALSE_SCORE_RATIOS = List.of(
            BigDecimal.ZERO,
            new BigDecimal("0.1"),
            new BigDecimal("0.25"),
            new BigDecimal("0.5"),
            BigDecimal.ONE);

    /**
     * Chấm điểm tự động cho câu trắc nghiệm.
     *
     * @param questions danh sách câu hỏi của đề
     * @param answers   map: questionId → đáp án học sinh chọn (A/B/C/D hoặc nội dung)
     * @param pointsByQuestion điểm tối đa đã phân bổ cho từng câu hỏi
     * @return điểm khách quan theo thang điểm của đề; câu tự luận chờ giáo viên chấm
     */
    public BigDecimal grade(List<Question> questions, Map<Long, String> answers,
                            Map<Long, BigDecimal> pointsByQuestion) {
        if (questions == null || questions.isEmpty()) {
            return BigDecimal.ZERO;
        }

        BigDecimal totalEarned = BigDecimal.ZERO;

        for (Question q : questions) {
            String studentAnswer = answers.get(q.getId());
            if (studentAnswer == null || studentAnswer.isBlank()) {
                continue; // Không trả lời → 0 điểm
            }

            boolean correct = false;
            switch (q.getType()) {
                case MCQ -> {
                    correct = q.getCorrectAnswer() != null
                            && q.getCorrectAnswer().equalsIgnoreCase(studentAnswer.trim());
                }
                case TRUE_FALSE -> {
                    if (q.getCorrectAnswer() != null
                            && q.getCorrectAnswer().matches("(?i)^[TF]{4}$")) {
                        String expected = q.getCorrectAnswer().toUpperCase(Locale.ROOT);
                        String selected = studentAnswer.trim().toUpperCase(Locale.ROOT);
                        int correctStatements = 0;
                        if (selected.matches("^[TF-]{4}$")) {
                            for (int i = 0; i < expected.length(); i++) {
                                if (expected.charAt(i) == selected.charAt(i)) correctStatements++;
                            }
                        }
                        BigDecimal ratio = TRUE_FALSE_SCORE_RATIOS.get(correctStatements);
                        totalEarned = totalEarned.add(
                                pointsByQuestion.getOrDefault(q.getId(), BigDecimal.ZERO).multiply(ratio));
                        continue;
                    }
                    correct = q.getCorrectAnswer() != null
                            && q.getCorrectAnswer().equalsIgnoreCase(studentAnswer.trim());
                }
                case SHORT_ANSWER -> {
                    correct = q.getAnswerText() != null
                            && normalize(q.getAnswerText()).equals(normalize(studentAnswer));
                }
                case ESSAY -> {
                    // Essay responses are intentionally left for manual grading.
                }
            }
            if (correct) {
                totalEarned = totalEarned.add(
                        pointsByQuestion.getOrDefault(q.getId(), BigDecimal.ZERO));
            }
        }

        BigDecimal score = totalEarned.setScale(2, RoundingMode.HALF_UP);

        log.debug("Auto graded: {}/{} questions, score = {}", answers.size(), questions.size(), score);
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