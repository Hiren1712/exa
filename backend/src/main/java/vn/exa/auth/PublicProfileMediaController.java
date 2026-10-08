package vn.exa.auth;

import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/v1/users")
@RequiredArgsConstructor
public class PublicProfileMediaController {

    private final ProfileMediaService profileMediaService;

    @GetMapping("/{userId}/media/{type}")
    public ResponseEntity<byte[]> getProfileImage(
            @PathVariable Long userId,
            @PathVariable String type) {
        ProfileMediaService.StoredImage image = profileMediaService.get(
                userId, ProfileMediaService.ImageType.fromPath(type));
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(image.contentType()))
                .cacheControl(CacheControl.noCache())
                .header("X-Content-Type-Options", "nosniff")
                .body(image.data());
    }
}
