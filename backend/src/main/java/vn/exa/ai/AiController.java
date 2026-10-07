package vn.exa.ai;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import vn.exa.common.ApiResponse;
import vn.exa.common.CurrentUser;
import vn.exa.importjob.GeminiParser;
import vn.exa.question.Question;

import java.math.BigDecimal;
import java.util.List;

@RestController
@RequestMapping("/v1/ai")
@RequiredArgsConstructor
public class AiController {

    private final AiService aiService;

    @PostMapping("/generate-questions")
    @PreAuthorize("hasAnyRole('TEACHER','ADMIN')")
    public ResponseEntity<ApiResponse<List<Question>>> generateQuestions(
            @Valid @RequestBody GenerateQuestionsRequest request,
            @AuthenticationPrincipal CurrentUser user) {
        AiService.GenerateQuestionsRequest command = new AiService.GenerateQuestionsRequest(
                request.getSubject(), request.getGrade(), request.getTopic(),
                request.getCount(), request.getDifficulty());
        return ResponseEntity.ok(ApiResponse.ok(
                aiService.generateQuestions(user.getId(), command), "Đã tạo câu hỏi bằng AI"));
    }

    @PostMapping("/grade-essay")
    @PreAuthorize("hasAnyRole('TEACHER','ADMIN')")
    public ResponseEntity<ApiResponse<GeminiParser.EssayGrade>> gradeEssay(
            @Valid @RequestBody GradeEssayRequest request,
            @AuthenticationPrincipal CurrentUser user) {
        AiService.GradeEssayRequest command = new AiService.GradeEssayRequest(
                request.getQuestion(), request.getAnswer(), request.getRubric(), request.getMaxScore());
        return ResponseEntity.ok(ApiResponse.ok(
                aiService.gradeEssay(user.getId(), command), "AI đã tạo gợi ý chấm điểm"));
    }

    @Data
    public static class GenerateQuestionsRequest {
        @NotBlank @Size(max = 60)
        private String subject;
        @NotNull @Min(6) @Max(12)
        private Integer grade;
        @NotBlank @Size(max = 200)
        private String topic;
        @NotNull @Min(1) @Max(20)
        private Integer count;
        @NotBlank @Pattern(regexp = "RECOGNITION|COMPREHENSION|APPLICATION|HIGH_APPLICATION")
        private String difficulty;
    }

    @Data
    public static class GradeEssayRequest {
        @NotBlank @Size(max = 5000)
        private String question;
        @NotBlank @Size(max = 12000)
        private String answer;
        @Size(max = 5000)
        private String rubric;
        @NotNull @DecimalMin("0.01") @DecimalMax("10.00")
        private BigDecimal maxScore;
    }
}
