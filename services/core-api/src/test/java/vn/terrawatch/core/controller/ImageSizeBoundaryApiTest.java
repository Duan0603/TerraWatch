package vn.terrawatch.core.controller;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.http.HttpMethod;

import java.util.Base64;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * The size edge just under each limit, end to end (BL-PROF-001, BL-RPT-001). The limit itself and one byte over are asserted
 * by CitizenValidationMatrixTest (BL-PROF-002/003, BL-RPT-002/003), the file-type and base64 rejections there and in the
 * avatar and report flow tests (BL-PROF-004..009, BL-RPT-004..006), the birth-date edge there too (BL-PROF-010/011), the
 * observed-time edges there too (BL-RPT-007..011). Here: the image is stored whole and served back byte for byte, which
 * a validation matrix does not read, and a GIF/WebP file is refused without touching what was stored.
 */
class ImageSizeBoundaryApiTest extends FlowTestBase {
    private static byte[] image(int size) {
        byte[] bytes = new byte[size];
        bytes[0] = (byte) 0xFF; bytes[1] = (byte) 0xD8; bytes[2] = (byte) 0xFF; bytes[3] = (byte) 0xE0;
        return bytes;
    }

    @Test
    void anAvatarOf199999BytesIsStoredWholeAndServedBack() throws Exception {
        // BL-PROF-001
        Acct user = account("citizen");
        String encoded = Base64.getEncoder().encodeToString(image(199_999));

        call(HttpMethod.PUT, "/api/v1/auth/me/avatar", user, Map.of("imageBase64", encoded)).andExpect(status().isOk()).andExpect(jsonPath("$.hasAvatar").value(true));

        String served = read(call(HttpMethod.GET, "/api/v1/auth/me/avatar", user, null).andExpect(status().isOk())).get("imageBase64").asText();
        assertThat(Base64.getDecoder().decode(served)).hasSize(199_999);
        assertThat(count("SELECT count(*) FROM core_schema.user_avatars WHERE user_id = ?", user.id())).isEqualTo(1);
    }

    @ParameterizedTest(name = "a {0} avatar is refused with 400 and the stored avatar stays [BL-PROF-006]")
    @CsvSource({"GIF, 'GIF89a'", "WebP, 'RIFF....WEBPVP8 '"})
    void aGifOrWebpAvatarIsRefusedAndTheOldAvatarStays(String type, String signature) throws Exception {
        Acct user = account("citizen");
        call(HttpMethod.PUT, "/api/v1/auth/me/avatar", user, Map.of("imageBase64", JPEG)).andExpect(status().isOk());

        call(HttpMethod.PUT, "/api/v1/auth/me/avatar", user, Map.of("imageBase64", Base64.getEncoder().encodeToString(signature.getBytes())))
            .andExpect(status().isBadRequest());

        call(HttpMethod.GET, "/api/v1/auth/me/avatar", user, null).andExpect(jsonPath("$.imageBase64").value(JPEG));
    }

    @Test
    void aReportPhotoOf699999BytesIsStoredWholeAndStaffGetItsExactBytes() throws Exception {
        // BL-RPT-001
        Acct citizen = account("citizen");
        Acct officer = account("officer");
        byte[] original = image(699_999);

        String photoId = read(call(HttpMethod.POST, "/api/v1/community-reports/photos", citizen, Map.of("imageBase64", Base64.getEncoder().encodeToString(original)))
            .andExpect(status().isOk())).get("photoId").asText();

        byte[] served = call(HttpMethod.GET, "/api/v1/community-reports/photos/" + photoId, officer, null)
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsByteArray();
        assertThat(served).isEqualTo(original);
        assertThat(count("SELECT count(*) FROM core_schema.report_photos WHERE user_id = ?", citizen.id())).isEqualTo(1);
    }
}
