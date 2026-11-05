package vn.terrawatch.core.service;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import vn.terrawatch.core.dto.UserProfileResponse;
import vn.terrawatch.core.entity.User;
import vn.terrawatch.core.entity.UserAvatar;
import vn.terrawatch.core.repository.UserAvatarRepository;
import vn.terrawatch.core.repository.UserRepository;

import java.util.Base64;
import java.util.UUID;

/** The signed-in citizen's profile picture. Only the owner can read or change it. */
@Service
public class UserAvatarService {
    static final int MAX_BYTES = 200_000;

    private final UserRepository users;
    private final UserAvatarRepository avatars;
    private final AuthService auth;

    public UserAvatarService(UserRepository users, UserAvatarRepository avatars, AuthService auth) {
        this.users = users;
        this.avatars = avatars;
        this.auth = auth;
    }

    @Transactional
    public UserProfileResponse save(UUID userId, String imageBase64) {
        validate(imageBase64);
        User user = users.findById(userId).orElseThrow(() ->
            new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Unauthorized"));
        avatars.save(new UserAvatar(userId, imageBase64));
        user.setHasAvatar(true);
        users.save(user);
        return auth.getCurrentUser(userId);
    }

    @Transactional(readOnly = true)
    public String get(UUID userId) {
        return avatars.findById(userId).map(UserAvatar::getImageBase64).orElseThrow(() ->
            new ResponseStatusException(HttpStatus.NOT_FOUND, "No avatar"));
    }

    @Transactional
    public void delete(UUID userId) {
        avatars.deleteById(userId);
        users.findById(userId).ifPresent(user -> {
            user.setHasAvatar(false);
            users.save(user);
        });
    }

    /** Valid base64, small enough, and really a JPEG or PNG (checked by file signature, not by the claimed type). */
    private static void validate(String imageBase64) {
        byte[] bytes;
        try {
            bytes = Base64.getDecoder().decode(imageBase64);
        } catch (IllegalArgumentException notBase64) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Image is not valid base64");
        }
        if (bytes.length > MAX_BYTES) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Image is larger than 200 KB");
        }
        boolean jpeg = bytes.length > 3 && (bytes[0] & 0xFF) == 0xFF && (bytes[1] & 0xFF) == 0xD8 && (bytes[2] & 0xFF) == 0xFF;
        boolean png = bytes.length > 4 && (bytes[0] & 0xFF) == 0x89 && bytes[1] == 'P' && bytes[2] == 'N' && bytes[3] == 'G';
        if (!jpeg && !png) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Image must be JPEG or PNG");
        }
    }
}
