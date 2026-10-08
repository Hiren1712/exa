package vn.exa.auth;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import vn.exa.auth.dto.AuthResponse;
import vn.exa.common.BusinessException;

import java.io.IOException;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class ProfileMediaService {

    private static final long AVATAR_MAX_BYTES = 3L * 1024 * 1024;
    private static final long COVER_MAX_BYTES = 5L * 1024 * 1024;
    private static final Map<String, byte[]> SIGNATURES = Map.of(
            "image/png", new byte[]{(byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A},
            "image/jpeg", new byte[]{(byte) 0xFF, (byte) 0xD8, (byte) 0xFF},
            "image/gif", new byte[]{0x47, 0x49, 0x46, 0x38},
            "image/webp", new byte[]{0x52, 0x49, 0x46, 0x46}
    );

    private final AuthService authService;
    private final UserRepository userRepository;
    private final UserProfileMediaRepository mediaRepository;

    @Transactional
    public AuthResponse.UserInfo update(Long userId, ImageType type, MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw BusinessException.badRequest("Vui lòng chọn tệp ảnh");
        }

        long maxBytes = type == ImageType.AVATAR ? AVATAR_MAX_BYTES : COVER_MAX_BYTES;
        if (file.getSize() > maxBytes) {
            throw BusinessException.badRequest(type.label + " không được vượt quá "
                    + (maxBytes / (1024 * 1024)) + " MB");
        }

        String contentType = file.getContentType();
        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (IOException ex) {
            throw BusinessException.badRequest("Không thể đọc tệp ảnh đã chọn");
        }
        validateImage(contentType, bytes);

        User user = authService.getById(userId);
        UserProfileMedia media = mediaRepository.findById(userId).orElseGet(() -> {
            UserProfileMedia newMedia = new UserProfileMedia();
            newMedia.setUserId(userId);
            return newMedia;
        });
        String mediaUrl = "/api/v1/users/" + userId + "/media/" + type.path
                + "?v=" + System.currentTimeMillis();

        if (type == ImageType.AVATAR) {
            media.setAvatarData(bytes);
            media.setAvatarContentType(contentType);
            user.setAvatarUrl(mediaUrl);
        } else {
            media.setCoverData(bytes);
            media.setCoverContentType(contentType);
            user.setCoverImageUrl(mediaUrl);
        }

        mediaRepository.save(media);
        userRepository.save(user);
        return authService.toUserInfo(user);
    }

    @Transactional
    public AuthResponse.UserInfo delete(Long userId, ImageType type) {
        User user = authService.getById(userId);
        mediaRepository.findById(userId).ifPresent(media -> {
            if (type == ImageType.AVATAR) {
                media.setAvatarData(null);
                media.setAvatarContentType(null);
            } else {
                media.setCoverData(null);
                media.setCoverContentType(null);
            }

            if (media.getAvatarData() == null && media.getCoverData() == null) {
                mediaRepository.delete(media);
            } else {
                mediaRepository.save(media);
            }
        });

        if (type == ImageType.AVATAR) {
            user.setAvatarUrl(null);
        } else {
            user.setCoverImageUrl(null);
        }
        userRepository.save(user);
        return authService.toUserInfo(user);
    }

    @Transactional(readOnly = true)
    public StoredImage get(Long userId, ImageType type) {
        UserProfileMedia media = mediaRepository.findById(userId)
                .orElseThrow(() -> BusinessException.notFound("Không tìm thấy ảnh hồ sơ"));
        byte[] bytes = type == ImageType.AVATAR ? media.getAvatarData() : media.getCoverData();
        String contentType = type == ImageType.AVATAR
                ? media.getAvatarContentType()
                : media.getCoverContentType();
        if (bytes == null || contentType == null) {
            throw BusinessException.notFound("Không tìm thấy ảnh hồ sơ");
        }
        return new StoredImage(bytes, contentType);
    }

    private void validateImage(String contentType, byte[] bytes) {
        byte[] signature = SIGNATURES.get(contentType);
        if (signature == null || bytes.length < signature.length || !startsWith(bytes, signature)) {
            throw BusinessException.badRequest("Chỉ chấp nhận ảnh PNG, JPEG, GIF hoặc WebP hợp lệ");
        }
        if ("image/webp".equals(contentType)
                && (bytes.length < 12 || bytes[8] != 'W' || bytes[9] != 'E'
                || bytes[10] != 'B' || bytes[11] != 'P')) {
            throw BusinessException.badRequest("Tệp WebP không hợp lệ");
        }
    }

    private boolean startsWith(byte[] bytes, byte[] signature) {
        for (int i = 0; i < signature.length; i++) {
            if (bytes[i] != signature[i]) return false;
        }
        return true;
    }

    public enum ImageType {
        AVATAR("avatar", "Ảnh đại diện"),
        COVER("cover", "Ảnh bìa");

        private final String path;
        private final String label;

        ImageType(String path, String label) {
            this.path = path;
            this.label = label;
        }

        public static ImageType fromPath(String path) {
            for (ImageType type : values()) {
                if (type.path.equalsIgnoreCase(path)) return type;
            }
            throw BusinessException.notFound("Không tìm thấy ảnh hồ sơ");
        }
    }

    public record StoredImage(byte[] data, String contentType) {
    }
}
