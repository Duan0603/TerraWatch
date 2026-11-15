package vn.terrawatch.core.service;

import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;
import vn.terrawatch.core.dto.UserProfileResponse;
import vn.terrawatch.core.entity.User;
import vn.terrawatch.core.entity.UserAvatar;
import vn.terrawatch.core.repository.UserAvatarRepository;
import vn.terrawatch.core.repository.UserRepository;

import java.util.Arrays;
import java.util.Base64;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/** Unit tests with mocked repositories. The HTTP round trip is in ProfileDetailsApiTest; this adds the exact byte-level rules. */
class UserAvatarServiceTest {
    private final UserRepository users = mock(UserRepository.class);
    private final UserAvatarRepository avatars = mock(UserAvatarRepository.class);
    private final AuthService auth = mock(AuthService.class);
    private final UserAvatarService service = new UserAvatarService(users, avatars, auth);
    private final UUID me = UUID.randomUUID();

    private static String b64(int... bytes) {
        byte[] b = new byte[bytes.length];
        for (int i = 0; i < b.length; i++) b[i] = (byte) bytes[i];
        return Base64.getEncoder().encodeToString(b);
    }

    private static void assertStatus(Runnable action, int status) {
        assertThatThrownBy(action::run).isInstanceOfSatisfying(ResponseStatusException.class,
            e -> assertThat(e.getStatusCode().value()).isEqualTo(status));
    }

    private User signedIn() {
        User u = new User("An", "an@x.vn", "h", "citizen", null);
        u.setUserId(me);
        when(users.findById(me)).thenReturn(Optional.of(u));
        return u;
    }

    @Test
    void jpegAndPngAreAcceptedStoredAndFlagOnTheUserIsSet() {
        User u = signedIn();
        UserProfileResponse profile = mock(UserProfileResponse.class);
        when(auth.getCurrentUser(me)).thenReturn(profile);
        String jpeg = b64(0xFF, 0xD8, 0xFF, 0xE0);
        String png = b64(0x89, 'P', 'N', 'G', 0x0D);

        assertThat(service.save(me, jpeg)).isSameAs(profile);
        assertThat(service.save(me, png)).isSameAs(profile);

        assertThat(u.isHasAvatar()).isTrue();
        verify(avatars).save(org.mockito.ArgumentMatchers.argThat((UserAvatar a) -> a.getUserId().equals(me) && jpeg.equals(a.getImageBase64())));
        verify(avatars).save(org.mockito.ArgumentMatchers.argThat((UserAvatar a) -> png.equals(a.getImageBase64())));
        verify(users, org.mockito.Mockito.times(2)).save(u);
    }

    @Test
    void notBase64NotAnImageOrTooShortIsRejectedWithoutTouchingTheDatabase() {
        assertStatus(() -> service.save(me, "***not base64***"), 400);
        assertStatus(() -> service.save(me, Base64.getEncoder().encodeToString("plain text".getBytes())), 400);
        assertStatus(() -> service.save(me, b64(0xFF, 0xD8, 0xFF)), 400);          // JPEG signature needs more than 3 bytes
        assertStatus(() -> service.save(me, b64(0x89, 'P', 'N', 'G')), 400);       // PNG signature needs more than 4 bytes
        assertStatus(() -> service.save(me, b64(0x47, 0x49, 0x46, 0x38, 0x39)), 400); // GIF
        assertStatus(() -> service.save(me, ""), 400);
        verifyNoInteractions(users, avatars, auth);
    }

    @Test
    void sizeLimitIs200000BytesInclusive() {
        signedIn();
        when(auth.getCurrentUser(me)).thenReturn(mock(UserProfileResponse.class));
        byte[] atLimit = new byte[200_000];
        Arrays.fill(atLimit, (byte) 1);
        atLimit[0] = (byte) 0xFF; atLimit[1] = (byte) 0xD8; atLimit[2] = (byte) 0xFF;
        service.save(me, Base64.getEncoder().encodeToString(atLimit));
        verify(avatars).save(any(UserAvatar.class));

        byte[] over = Arrays.copyOf(atLimit, 200_001);
        assertStatus(() -> service.save(me, Base64.getEncoder().encodeToString(over)), 400);
    }

    @Test
    void saveForUnknownUserIs401AndStoresNothing() {
        when(users.findById(me)).thenReturn(Optional.empty());
        assertStatus(() -> service.save(me, b64(0xFF, 0xD8, 0xFF, 0xE0)), 401);
        verify(avatars, never()).save(any());
    }

    @Test
    void getReturnsStoredImageOr404() {
        when(avatars.findById(me)).thenReturn(Optional.of(new UserAvatar(me, "abc")));
        assertThat(service.get(me)).isEqualTo("abc");
        UUID other = UUID.randomUUID();
        when(avatars.findById(other)).thenReturn(Optional.empty());
        assertStatus(() -> service.get(other), 404);
    }

    @Test
    void deleteRemovesImageAndClearsFlagAndToleratesMissingUser() {
        User u = signedIn();
        u.setHasAvatar(true);
        service.delete(me);
        verify(avatars).deleteById(me);
        assertThat(u.isHasAvatar()).isFalse();
        verify(users).save(u);

        UUID ghost = UUID.randomUUID();
        when(users.findById(ghost)).thenReturn(Optional.empty());
        service.delete(ghost);
        verify(avatars).deleteById(ghost);
    }
}
