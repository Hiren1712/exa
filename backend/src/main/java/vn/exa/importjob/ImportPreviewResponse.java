package vn.exa.importjob;

import lombok.*;

import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ImportPreviewResponse {
    private Long jobId;
    private String originalName;
    private String status;
    private Integer totalFound;
    private List<ParsedQuestion> questions;
    private String errorMessage;
}