package vn.exa.importjob;

import lombok.*;

import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ParsedQuestion {
    private Integer number;
    private String type;
    private String content;
    private List<String> options;
    private String correctAnswer;
    private String answerText;
    private String difficulty;
    private String explanation;
}