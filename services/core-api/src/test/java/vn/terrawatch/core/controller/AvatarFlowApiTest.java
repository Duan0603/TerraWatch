package vn.terrawatch.core.controller;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Avatar storage beyond the basic round trip in ProfileDetailsApiTest: formats, replacement, isolation, deletion. */
class AvatarFlowApiTest extends FlowTestBase {
    private static final String AVATAR = "/api/v1/auth/me/avatar";

    private long avatarRows(Acct user) {
        return count("SELECT count(*) FROM core_schema.user_avatars WHERE user_id = ?", user.id());
    }

    private boolean flag(Acct user) {
        return jdbc.queryForObject("SELECT has_avatar FROM core_schema.users WHERE user_id = ?", Boolean.class, user.id());
    }

    @Test
    void saveReturnsTheWholeProfileWithTheFlagSetAndNeverTheImage() throws Exception {
        Acct user = account("citizen", "Tran Thi Anh", "0912345678");

        call(HttpMethod.PUT, AVATAR, user, java.util.Map.of("imageBase64", JPEG))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.userId").value(user.id().toString()))
            .andExpect(jsonPath("$.fullName").value("Tran Thi Anh"))
            .andExpect(jsonPath("$.email").value(user.user().getEmail()))
            .andExpect(jsonPath("$.role").value("citizen"))
            .andExpect(jsonPath("$.phoneNumber").value("0912345678"))
            .andExpect(jsonPath("$.hasAvatar").value(true))
            .andExpect(jsonPath("$.imageBase64").doesNotExist());

        assertThat(flag(user)).isTrue();
        call(HttpMethod.GET, "/api/v1/auth/me", user, null).andExpect(jsonPath("$.hasAvatar").value(true)).andExpect(jsonPath("$.imageBase64").doesNotExist());
    }

    @Test
    void replacingTheAvatarKeepsOneRowAndServesTheNewImage() throws Exception {
        Acct user = account("citizen");
        call(HttpMethod.PUT, AVATAR, user, java.util.Map.of("imageBase64", PNG)).andExpect(status().isOk());

        call(HttpMethod.PUT, AVATAR, user, java.util.Map.of("imageBase64", JPEG)).andExpect(status().isOk());

        assertThat(avatarRows(user)).isEqualTo(1);
        call(HttpMethod.GET, AVATAR, user, null).andExpect(status().isOk()).andExpect(jsonPath("$.imageBase64").value(JPEG));
    }

    @Test
    void eachUserSeesAndDeletesOnlyTheirOwnAvatar() throws Exception {
        Acct first = account("citizen");
        Acct second = account("officer");
        call(HttpMethod.PUT, AVATAR, first, java.util.Map.of("imageBase64", PNG)).andExpect(status().isOk());
        call(HttpMethod.PUT, AVATAR, second, java.util.Map.of("imageBase64", JPEG)).andExpect(status().isOk());

        call(HttpMethod.GET, AVATAR, first, null).andExpect(jsonPath("$.imageBase64").value(PNG));
        call(HttpMethod.GET, AVATAR, second, null).andExpect(jsonPath("$.imageBase64").value(JPEG));

        call(HttpMethod.DELETE, AVATAR, first, null).andExpect(status().isNoContent());
        assertThat(avatarRows(first)).isZero();
        assertThat(avatarRows(second)).isEqualTo(1);
        assertThat(flag(first)).isFalse();
        assertThat(flag(second)).isTrue();
        call(HttpMethod.GET, AVATAR, second, null).andExpect(jsonPath("$.imageBase64").value(JPEG));
    }

    @Test
    void deletingWhenThereIsNoAvatarIsStillNoContentAndRepeatable() throws Exception {
        Acct user = account("citizen");

        call(HttpMethod.DELETE, AVATAR, user, null).andExpect(status().isNoContent());
        call(HttpMethod.DELETE, AVATAR, user, null).andExpect(status().isNoContent());

        assertThat(flag(user)).isFalse();
        call(HttpMethod.GET, AVATAR, user, null).andExpect(status().isNotFound());
    }

    @Test
    void aRejectedUploadKeepsTheAvatarThatWasThere() throws Exception {
        Acct user = account("citizen");
        call(HttpMethod.PUT, AVATAR, user, java.util.Map.of("imageBase64", PNG)).andExpect(status().isOk());

        call(HttpMethod.PUT, AVATAR, user, java.util.Map.of("imageBase64", java.util.Base64.getEncoder().encodeToString("GIF89a....".getBytes())))
            .andExpect(status().isBadRequest());

        call(HttpMethod.GET, AVATAR, user, null).andExpect(jsonPath("$.imageBase64").value(PNG));
        assertThat(flag(user)).isTrue();
    }
}
