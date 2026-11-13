package vn.exa.question;

import lombok.RequiredArgsConstructor;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import vn.exa.common.ApiResponse;
import vn.exa.common.BusinessException;
import vn.exa.common.CurrentUser;
import java.io.IOException;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/v1/question-media")
@RequiredArgsConstructor
public class QuestionMediaController {
    private static final long MAX_BYTES = 5L * 1024 * 1024;
    private static final Map<String, byte[]> SIGNATURES = Map.of(
        "image/png", new byte[]{(byte)0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a},
        "image/jpeg", new byte[]{(byte)0xff, (byte)0xd8, (byte)0xff},
        "image/webp", new byte[]{0x52, 0x49, 0x46, 0x46}
    );
    private final QuestionMediaRepository repository;

    @PostMapping
    @PreAuthorize("hasAnyRole('TEACHER','ADMIN')")
    public ResponseEntity<ApiResponse<String>> upload(@RequestParam("file") MultipartFile file,
                                                       @AuthenticationPrincipal CurrentUser user) {
        if (file == null || file.isEmpty() || file.getSize() > MAX_BYTES)
            throw BusinessException.badRequest("Ảnh phải có dung lượng từ 1 byte đến 5 MB");
        String mime = file.getContentType();
        byte[] signature = SIGNATURES.get(mime);
        if (signature == null) throw BusinessException.badRequest("Chỉ chấp nhận PNG, JPEG hoặc WebP");
        byte[] bytes;
        try { bytes = file.getBytes(); }
        catch (IOException ex) { throw BusinessException.badRequest("Không đọc được ảnh"); }
        if (bytes.length < signature.length) throw BusinessException.badRequest("Định dạng ảnh không hợp lệ");
        for (int i = 0; i < signature.length; i++)
            if (bytes[i] != signature[i]) throw BusinessException.badRequest("Tệp ảnh không hợp lệ");
        if ("image/webp".equals(mime) && (bytes.length < 12 || bytes[8] != 'W' || bytes[9] != 'E' || bytes[10] != 'B' || bytes[11] != 'P'))
            throw BusinessException.badRequest("Tệp WebP không hợp lệ");
        QuestionMedia media = new QuestionMedia();
        media.setId(UUID.randomUUID().toString());
        media.setOwnerId(user.getId());
        media.setMimeType(mime);
        media.setImageData(bytes);
        repository.save(media);
        return ResponseEntity.ok(ApiResponse.ok("/api/v1/question-media/" + media.getId()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<byte[]> get(@PathVariable String id) {
        QuestionMedia media = repository.findById(id)
            .orElseThrow(() -> BusinessException.notFound("Không tìm thấy hình ảnh"));
        return ResponseEntity.ok()
            .contentType(MediaType.parseMediaType(media.getMimeType()))
            .cacheControl(CacheControl.maxAge(java.time.Duration.ofDays(7)).cachePublic())
            .header("X-Content-Type-Options", "nosniff")
            .header("Content-Security-Policy", "default-src 'none'; sandbox")
            .body(media.getImageData());
    }
}
