package vn.exa.ai;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.exa.auth.User;
import vn.exa.auth.UserRepository;
import vn.exa.common.BusinessException;
import vn.exa.importjob.GeminiParser;
import vn.exa.importjob.ParsedQuestion;
import vn.exa.question.Question;
import vn.exa.question.QuestionRepository;

import java.math.BigDecimal;
import java.util.List;

@Service
@RequiredArgsConstructor
public class AiService {

    private final UserRepository userRepository;
    private final QuestionRepository questionRepository;
    private final GeminiParser geminiParser;
    private final ObjectMapper objectMapper;

    @Transactional
    public List<Question> generateQuestions(Long userId, GenerateQuestionsRequest request) {
        requirePro(userId);
        List<ParsedQuestion> generated = geminiParser.generateQuestions(
                request.subject(), request.grade(), request.topic(), request.count(), request.difficulty());
        if (generated.isEmpty()) {
            throw BusinessException.badRequest("AI không tạo được câu hỏi. Hãy thử chủ đề khác.");
        }
        return generated.stream().map(parsed -> saveGeneratedQuestion(userId, request, parsed)).toList();
    }

    public GeminiParser.EssayGrade gradeEssay(Long userId, GradeEssayRequest request) {
        requirePro(userId);
        return geminiParser.gradeEssay(request.question(), request.answer(),
                request.rubric(), request.maxScore());
    }

    private Question saveGeneratedQuestion(Long userId, GenerateQuestionsRequest request, ParsedQuestion parsed) {
        if (parsed.getContent() == null || parsed.getContent().isBlank()
                || parsed.getOptions() == null || parsed.getOptions().size() < 2) {
            throw BusinessException.badRequest("AI trả về câu hỏi chưa đủ nội dung hoặc đáp án");
        }
        try {
            return questionRepository.save(Question.builder()
                    .ownerId(userId)
                    .subject(request.subject())
                    .grade(request.grade())
                    .unit(request.topic())
                    .difficulty(Question.Difficulty.valueOf(request.difficulty()))
                    .type(Question.Type.MCQ)
                    .content(parsed.getContent())
                    .options(objectMapper.writeValueAsString(parsed.getOptions()))
                    .correctAnswer(parsed.getCorrectAnswer())
                    .answerText(parsed.getAnswerText())
                    .explanation(parsed.getExplanation())
                    .aiGenerated(true)
                    .source("Gemini AI Studio")
                    .build());
        } catch (com.fasterxml.jackson.core.JsonProcessingException e) {
            throw new IllegalStateException("Không thể lưu danh sách đáp án AI", e);
        }
    }

    private void requirePro(Long userId) {
        User user = userRepository.findByIdAndDeletedAtIsNull(userId)
                .orElseThrow(() -> BusinessException.notFound("Tài khoản không tồn tại"));
        if (user.getPlan() == User.Plan.FREE) {
            throw BusinessException.forbidden("Tính năng AI Studio yêu cầu gói Pro");
        }
    }

    public record GenerateQuestionsRequest(String subject, Integer grade, String topic,
                                           Integer count, String difficulty) {}

    public record GradeEssayRequest(String question, String answer, String rubric, BigDecimal maxScore) {}
}
