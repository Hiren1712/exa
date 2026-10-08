package vn.exa.report;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import vn.exa.common.ApiResponse;
import vn.exa.common.BusinessException;
import vn.exa.common.CurrentUser;
import vn.exa.exam.Exam;
import vn.exa.exam.ExamRepository;
import vn.exa.exam.ExamQuestionRepository;
import vn.exa.question.Question;
import vn.exa.question.QuestionRepository;
import vn.exa.submission.Submission;
import vn.exa.submission.SubmissionRepository;

import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/v1/reports")
@RequiredArgsConstructor
@Slf4j
public class ReportController {

    private final SubmissionRepository submissionRepository;
    private final ExamRepository examRepository;
    private final ExamQuestionRepository examQuestionRepository;
    private final QuestionRepository questionRepository;
    private final ObjectMapper objectMapper;

    @GetMapping("/summary")
    @PreAuthorize("hasAnyRole('TEACHER','ADMIN')")
    public ResponseEntity<ApiResponse<TeacherSummary>> teacherSummary(
            @org.springframework.security.core.annotation.AuthenticationPrincipal CurrentUser user) {
        List<Exam> exams = user.isAdmin()
                ? examRepository.findAll().stream().filter(exam -> exam.getDeletedAt() == null).toList()
                : examRepository.findByOwnerIdAndDeletedAtIsNullOrderByCreatedAtDesc(user.getId());
        List<Long> examIds = exams.stream().map(Exam::getId).toList();
        List<Submission> submissions = examIds.isEmpty()
                ? List.of() : submissionRepository.findByExamIdIn(examIds);
        List<Submission> graded = submissions.stream()
                .filter(submission -> submission.getSubmittedAt() != null && submission.getTotalScore() != null)
                .toList();
        Map<Long, BigDecimal> totalPointsByExam = exams.stream().collect(Collectors.toMap(
                Exam::getId,
                exam -> exam.getTotalPoints() == null || exam.getTotalPoints().signum() <= 0
                        ? BigDecimal.TEN : exam.getTotalPoints()));
        BigDecimal average = graded.isEmpty() ? null
                : graded.stream()
                        .map(submission -> submission.getTotalScore().multiply(BigDecimal.TEN)
                                .divide(totalPointsByExam.getOrDefault(submission.getExamId(), BigDecimal.TEN),
                                        2, RoundingMode.HALF_UP))
                        .reduce(BigDecimal.ZERO, BigDecimal::add)
                        .divide(BigDecimal.valueOf(graded.size()), 2, RoundingMode.HALF_UP);
        return ResponseEntity.ok(ApiResponse.ok(new TeacherSummary(exams.size(),
                submissions.stream().filter(submission -> submission.getSubmittedAt() != null).count(),
                average)));
    }

    @GetMapping("/exams/{examId}")
    @PreAuthorize("hasAnyRole('TEACHER','ADMIN')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> examReport(
            @PathVariable Long examId, @org.springframework.security.core.annotation.AuthenticationPrincipal CurrentUser user) {
        verifyOwnership(examId, user);
        Exam exam = examRepository.findByIdAndDeletedAtIsNull(examId)
                .orElseThrow(() -> BusinessException.notFound("Đề thi không tồn tại"));
        BigDecimal totalPoints = exam.getTotalPoints() == null || exam.getTotalPoints().signum() <= 0
                ? BigDecimal.TEN : exam.getTotalPoints();
        List<Submission> subs = submissionRepository.findByExamIdOrderBySubmittedAtDesc(examId);
        List<Submission> graded = subs.stream()
                .filter(s -> s.getTotalScore() != null)
                .collect(Collectors.toList());

        BigDecimal avg = BigDecimal.ZERO;
        BigDecimal max = BigDecimal.ZERO;
        BigDecimal min = totalPoints;
        int passCount = 0;
        int[] distribution = new int[10];

        for (Submission s : graded) {
            BigDecimal score = s.getTotalScore();
            avg = avg.add(score);
            if (score.compareTo(max) > 0) max = score;
            if (score.compareTo(min) < 0) min = score;
            if (score.compareTo(totalPoints.divide(BigDecimal.valueOf(2), 2, RoundingMode.HALF_UP)) >= 0) {
                passCount++;
            }
            int bucket = score.multiply(BigDecimal.TEN).divide(totalPoints, 0, RoundingMode.DOWN).intValue();
            bucket = Math.max(0, Math.min(9, bucket));
            distribution[bucket]++;
        }

        if (!graded.isEmpty()) {
            avg = avg.divide(BigDecimal.valueOf(graded.size()), 2, RoundingMode.HALF_UP);
        } else {
            max = BigDecimal.ZERO;
            min = BigDecimal.ZERO;
        }

        List<Map<String, Object>> rankings = graded.stream()
                .sorted(Comparator.comparing(Submission::getTotalScore).reversed())
                .map(s -> {
                    Map<String, Object> m = new HashMap<>();
                    m.put("submissionId", s.getId());
                    m.put("studentId", s.getStudentId());
                    m.put("score", s.getTotalScore());
                    m.put("durationSec", s.getDurationSec());
                    m.put("submittedAt", s.getSubmittedAt());
                    return m;
                })
                .collect(Collectors.toList());

        Map<String, Object> report = new HashMap<>();
        report.put("examId", examId);
        report.put("totalPoints", totalPoints);
        report.put("totalSubmissions", subs.stream().filter(s -> s.getSubmittedAt() != null).count());
        report.put("gradedSubmissions", graded.size());
        report.put("averageScore", avg);
        report.put("maxScore", max);
        report.put("minScore", min);
        report.put("passRate", graded.isEmpty() ? 0
                : Math.round(passCount * 100.0 / graded.size()));
        report.put("distribution", distribution);
        report.put("rankings", rankings);
        report.put("questionAnalysis", questionAnalysis(examId, subs));

        return ResponseEntity.ok(ApiResponse.ok(report));
    }

    @GetMapping("/exams/{examId}/export")
    @PreAuthorize("hasAnyRole('TEACHER','ADMIN')")
    public ResponseEntity<byte[]> exportExcel(
            @PathVariable Long examId, @org.springframework.security.core.annotation.AuthenticationPrincipal CurrentUser user) {
        verifyOwnership(examId, user);
        List<Submission> subs = submissionRepository.findByExamIdOrderBySubmittedAtDesc(examId).stream()
                .filter(submission -> submission.getSubmittedAt() != null)
                .toList();

        try (Workbook wb = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Sheet sheet = wb.createSheet("Bang diem");

            // Header style
            CellStyle headerStyle = wb.createCellStyle();
            Font headerFont = wb.createFont();
            headerFont.setBold(true);
            headerStyle.setFont(headerFont);

            String[] headers = {"STT", "Học sinh", "Điểm", "Thời gian (s)", "Nộp lúc"};
            Row headerRow = sheet.createRow(0);
            for (int i = 0; i < headers.length; i++) {
                Cell c = headerRow.createCell(i);
                c.setCellValue(headers[i]);
                c.setCellStyle(headerStyle);
                sheet.setColumnWidth(i, 20 * 256);
            }

            int rowNum = 1;
            for (Submission s : subs) {
                Row row = sheet.createRow(rowNum++);
                row.createCell(0).setCellValue(rowNum - 1);
                row.createCell(1).setCellValue("HS #" + s.getStudentId());
                row.createCell(2).setCellValue(s.getTotalScore() == null ? 0
                        : s.getTotalScore().doubleValue());
                row.createCell(3).setCellValue(s.getDurationSec() == null ? 0 : s.getDurationSec());
                row.createCell(4).setCellValue(s.getSubmittedAt() == null ? ""
                        : s.getSubmittedAt().toString());
            }

            wb.write(out);
            String filename = "bang-diem-exam-" + examId + ".xlsx";

            HttpHeaders httpHeaders = new HttpHeaders();
            httpHeaders.setContentType(MediaType.parseMediaType(
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"));
            httpHeaders.set(HttpHeaders.CONTENT_DISPOSITION,
                    "attachment; filename=\"" + filename + "\"");

            return ResponseEntity.ok()
                    .headers(httpHeaders)
                    .body(out.toByteArray());
        } catch (Exception e) {
            log.error("Failed to export Excel", e);
            return ResponseEntity.internalServerError()
                    .body(("Lỗi xuất Excel: " + e.getMessage()).getBytes(StandardCharsets.UTF_8));
        }
    }

    private void verifyOwnership(Long examId, CurrentUser user) {
        Exam exam = examRepository.findByIdAndDeletedAtIsNull(examId)
                .orElseThrow(() -> BusinessException.notFound("Đề thi không tồn tại"));
        if (!user.isAdmin() && !exam.getOwnerId().equals(user.getId())) {
            throw BusinessException.forbidden("Bạn không có quyền xem báo cáo này");
        }
    }

    private List<Map<String, Object>> questionAnalysis(Long examId, List<Submission> submissions) {
        List<Submission> completed = submissions.stream()
                .filter(submission -> submission.getSubmittedAt() != null)
                .toList();
        List<Map<String, Object>> result = new ArrayList<>();
        for (var link : examQuestionRepository.findByExamIdOrderByOrderIndexAsc(examId)) {
            Question question = questionRepository.findByIdAndDeletedAtIsNull(link.getQuestionId())
                    .orElse(null);
            if (question == null) continue;
            int answered = 0;
            int correct = 0;
            for (Submission submission : completed) {
                Map<String, String> answers = parseAnswers(submission.getAnswers());
                String answer = answers.get(String.valueOf(question.getId()));
                if (answer == null || answer.isBlank()) continue;
                answered++;
                if (isCorrect(question, answer)) correct++;
            }
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("questionId", question.getId());
            item.put("content", question.getContent());
            item.put("type", question.getType().name());
            item.put("responses", answered);
            item.put("correctResponses", question.getType() == Question.Type.ESSAY ? null : correct);
            item.put("accuracyRate", question.getType() == Question.Type.ESSAY || answered == 0
                    ? null : Math.round(correct * 100.0 / answered));
            result.add(item);
        }
        return result;
    }

    private Map<String, String> parseAnswers(String json) {
        if (json == null || json.isBlank()) return Map.of();
        try {
            return objectMapper.readValue(json, new TypeReference<>() {});
        } catch (Exception e) {
            throw new IllegalStateException("Dữ liệu câu trả lời không hợp lệ", e);
        }
    }

    private boolean isCorrect(Question question, String answer) {
        if (question.getType() == Question.Type.MCQ || question.getType() == Question.Type.TRUE_FALSE) {
            return question.getCorrectAnswer() != null
                    && question.getCorrectAnswer().equalsIgnoreCase(answer.trim());
        }
        if (question.getType() == Question.Type.SHORT_ANSWER) {
            return question.getAnswerText() != null
                    && normalize(question.getAnswerText()).equals(normalize(answer));
        }
        return false;
    }

    private String normalize(String value) {
        return value.toLowerCase().replaceAll("\\s+", " ")
                .replaceAll("[.,;:!?]", "").trim();
    }

    public record TeacherSummary(int examCount, long submissionCount, BigDecimal averageScore) {}
}