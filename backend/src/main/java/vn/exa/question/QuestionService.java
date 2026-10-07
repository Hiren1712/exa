package vn.exa.question;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.exa.common.BusinessException;

import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class QuestionService {

    private final QuestionRepository questionRepository;
    private final ObjectMapper objectMapper;

    public Page<Question> search(Long ownerId, String subject, Integer grade,
                                 Question.Difficulty difficulty, Question.Type type,
                                 String keyword, Pageable pageable) {
        return questionRepository.search(ownerId, subject, grade, difficulty, type, keyword, pageable);
    }

    public Question getById(Long id, Long ownerId) {
        Question q = questionRepository.findByIdAndDeletedAtIsNull(id)
                .orElseThrow(() -> BusinessException.notFound("Câu hỏi không tồn tại"));
        if (!q.getOwnerId().equals(ownerId)) {
            throw BusinessException.forbidden("Bạn không có quyền truy cập câu hỏi này");
        }
        return q;
    }

    @Transactional
    public Question create(Long ownerId, QuestionRequest req) {
        Question q = Question.builder()
                .ownerId(ownerId)
                .subject(req.getSubject())
                .grade(req.getGrade())
                .unit(req.getUnit())
                .difficulty(req.getDifficulty())
                .type(req.getType())
                .content(req.getContent())
                .contentHtml(req.getContent())
                .options(toJson(req.getOptions()))
                .correctAnswer(req.getCorrectAnswer())
                .answerText(req.getAnswerText())
                .explanation(req.getExplanation())
                .source(req.getSource())
                .build();

        q = questionRepository.save(q);
        log.info("Question created: id={}, subject={}", q.getId(), q.getSubject());
        return q;
    }

    @Transactional
    public Question update(Long id, Long ownerId, QuestionRequest req) {
        Question q = getById(id, ownerId);

        q.setSubject(req.getSubject());
        q.setGrade(req.getGrade());
        q.setUnit(req.getUnit());
        q.setDifficulty(req.getDifficulty());
        q.setType(req.getType());
        q.setContent(req.getContent());
        q.setContentHtml(req.getContent());
        q.setOptions(toJson(req.getOptions()));
        q.setCorrectAnswer(req.getCorrectAnswer());
        q.setAnswerText(req.getAnswerText());
        q.setExplanation(req.getExplanation());
        q.setSource(req.getSource());

        return questionRepository.save(q);
    }

    @Transactional
    public void delete(Long id, Long ownerId) {
        Question q = getById(id, ownerId);
        q.setDeletedAt(java.time.LocalDateTime.now());
        questionRepository.save(q);
    }

    @Transactional
    public int bulkDelete(Long ownerId, List<Long> ids) {
        if (ids == null || ids.isEmpty() || ids.size() > 500) {
            throw BusinessException.badRequest("Chọn từ 1 đến 500 câu hỏi để xóa");
        }
        List<Question> questions = questionRepository.findAllById(ids);
        if (questions.size() != ids.stream().distinct().count()
                || questions.stream().anyMatch(q -> !q.getOwnerId().equals(ownerId) || q.getDeletedAt() != null)) {
            throw BusinessException.forbidden("Một hoặc nhiều câu hỏi không tồn tại hoặc không thuộc quyền của bạn");
        }
        java.time.LocalDateTime deletedAt = java.time.LocalDateTime.now();
        questions.forEach(question -> question.setDeletedAt(deletedAt));
        questionRepository.saveAll(questions);
        return questions.size();
    }

    @Transactional
    public List<Question> importQuestions(Long ownerId, List<QuestionRequest> requests) {
        if (requests == null || requests.isEmpty() || requests.size() > 500) {
            throw BusinessException.badRequest("Cần nhập từ 1 đến 500 câu hỏi");
        }
        return requests.stream().map(req -> create(ownerId, req)).toList();
    }

    private String toJson(List<String> options) {
        if (options == null || options.isEmpty()) return null;
        try {
            return objectMapper.writeValueAsString(options);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Không thể mã hóa danh sách đáp án", e);
        }
    }

    // ===== DTO =====
    @lombok.Data
    public static class QuestionRequest {
        @NotBlank
        private String subject;
        private Integer grade;
        private String unit;
        @NotNull
        private Question.Difficulty difficulty;
        @NotNull
        private Question.Type type;
        @NotBlank
        private String content;
        private List<String> options;
        private String correctAnswer;
        private String answerText;
        private String explanation;
        private String source;
    }
}