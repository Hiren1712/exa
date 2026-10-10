package vn.exa.importjob;

import lombok.extern.slf4j.Slf4j;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xwpf.usermodel.*;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;
import vn.exa.common.BusinessException;

import java.io.InputStream;

@Component
@Slf4j
public class DocumentParser {

    /**
     * Extract text từ file dựa theo loại.
     */
    public String extractText(MultipartFile file) {
        String fileName = file.getOriginalFilename();
        if (fileName == null) throw BusinessException.badRequest("File không hợp lệ");

        String ext = getExtension(fileName).toLowerCase();
        try {
            return switch (ext) {
                case "docx" -> extractFromDocx(file.getInputStream());
                case "pdf" -> extractFromPdf(file.getInputStream());
                case "xlsx", "xls" -> extractFromExcel(file.getInputStream());
                default -> throw BusinessException.badRequest("Định dạng không hỗ trợ: " + ext);
            };
        } catch (BusinessException be) {
            throw be;
        } catch (Exception e) {
            log.error("Failed to extract text from {}", fileName, e);
            throw BusinessException.badRequest("Không đọc được file: " + e.getMessage());
        }
    }

    private String extractFromDocx(InputStream is) throws Exception {
        StringBuilder sb = new StringBuilder();
        try (XWPFDocument doc = new XWPFDocument(is)) {
            for (IBodyElement elem : doc.getBodyElements()) {
                if (elem instanceof XWPFParagraph p) {
                    String text = p.getText();
                    if (!text.isBlank()) sb.append(text).append("\n");
                } else if (elem instanceof XWPFTable table) {
                    for (XWPFTableRow row : table.getRows()) {
                        StringBuilder rowText = new StringBuilder();
                        for (XWPFTableCell cell : row.getTableCells()) {
                            rowText.append(cell.getText()).append(" | ");
                        }
                        sb.append(rowText.toString().trim()).append("\n");
                    }
                }
            }
        }
        return sb.toString();
    }

    private String extractFromPdf(InputStream is) throws Exception {
        byte[] bytes = is.readAllBytes();
        try (PDDocument doc = Loader.loadPDF(bytes)) {
            if (doc.getNumberOfPages() == 0) return "";
            PDFTextStripper stripper = new PDFTextStripper();
            stripper.setSortByPosition(true);
            String text = stripper.getText(doc);
            if (text.isBlank()) {
                log.warn("PDF appears to be scanned image — needs OCR");
                return "";
            }
            return text;
        }
    }

    private String extractFromExcel(InputStream is) throws Exception {
        StringBuilder sb = new StringBuilder();
        try (Workbook wb = WorkbookFactory.create(is)) {
            for (int s = 0; s < wb.getNumberOfSheets(); s++) {
                Sheet sheet = wb.getSheetAt(s);
                for (Row row : sheet) {
                    StringBuilder line = new StringBuilder();
                    for (Cell cell : row) {
                        line.append(getCellValue(cell)).append(" | ");
                    }
                    String lineStr = line.toString().trim();
                    if (!lineStr.isEmpty() && !lineStr.equals("|")) {
                        sb.append(lineStr).append("\n");
                    }
                }
            }
        }
        return sb.toString();
    }

    private String getCellValue(Cell cell) {
        return switch (cell.getCellType()) {
            case STRING -> cell.getStringCellValue();
            case NUMERIC -> DateUtil.isCellDateFormatted(cell)
                    ? cell.getLocalDateTimeCellValue().toString()
                    : String.valueOf(cell.getNumericCellValue());
            case BOOLEAN -> String.valueOf(cell.getBooleanCellValue());
            case FORMULA -> cell.getCellFormula();
            default -> "";
        };
    }

    private String getExtension(String fileName) {
        int i = fileName.lastIndexOf('.');
        return i >= 0 ? fileName.substring(i + 1) : "";
    }
}