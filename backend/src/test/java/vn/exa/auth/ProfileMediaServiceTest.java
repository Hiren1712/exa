package vn.exa.auth;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;
import vn.exa.auth.dto.AuthResponse;
import vn.exa.common.BusinessException;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ProfileMediaServiceTest {

    @Mock
    private AuthService authService;

    @Mock
    private UserRepository userRepository;

    @Mock
    private UserProfileMediaRepository mediaRepository;

    @InjectMocks
    private ProfileMediaService profileMediaService;

    @Test
    void updateAvatarPersistsImageAndReturnsPersistentMediaUrl() {
        User user = User.builder().id(7L).email("student@example.com").fullName("Student").build();
        byte[] png = {(byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x01};
        MockMultipartFile file = new MockMultipartFile("file", "avatar.png", "image/png", png);
        when(authService.getById(7L)).thenReturn(user);
        when(authService.toUserInfo(user)).thenAnswer(invocation -> AuthResponse.UserInfo.builder()
                .avatarUrl(user.getAvatarUrl())
                .build());
        when(mediaRepository.findById(7L)).thenReturn(Optional.empty());

        var updated = profileMediaService.update(7L, ProfileMediaService.ImageType.AVATAR, file);

        ArgumentCaptor<UserProfileMedia> mediaCaptor = ArgumentCaptor.forClass(UserProfileMedia.class);
        verify(mediaRepository).save(mediaCaptor.capture());
        assertArrayEquals(png, mediaCaptor.getValue().getAvatarData());
        assertEquals("image/png", mediaCaptor.getValue().getAvatarContentType());
        verify(userRepository).save(user);
        assertTrue(user.getAvatarUrl().startsWith("/api/v1/users/7/media/avatar?v="));
        assertEquals(user.getAvatarUrl(), updated.getAvatarUrl());
    }

    @Test
    void rejectsFileThatDoesNotMatchAnImageSignature() {
        MockMultipartFile file = new MockMultipartFile(
                "file", "avatar.png", "image/png", "<script>".getBytes()
        );

        assertThrows(BusinessException.class, () ->
                profileMediaService.update(7L, ProfileMediaService.ImageType.AVATAR, file));
        verifyNoInteractions(authService, userRepository, mediaRepository);
    }
}
