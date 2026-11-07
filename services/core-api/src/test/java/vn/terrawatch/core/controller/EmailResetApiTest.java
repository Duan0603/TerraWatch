package vn.terrawatch.core.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Transactional;
import vn.terrawatch.core.entity.User;
import vn.terrawatch.core.repository.UserRepository;
import vn.terrawatch.core.service.PasswordResetMailer;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Story 4.21: forgot password with an e-mailed 6-digit code. */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class EmailResetApiTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired UserRepository users;
    @Autowired BCryptPasswordEncoder passwords;
    @Autowired JdbcTemplate jdbc;
    @MockBean PasswordResetMailer mailer;

    @BeforeEach
    void configured() {
        when(mailer.configured()).thenReturn(true);
    }

    private ResultActions call(String path, Map<String, String> body) throws Exception {
        return mvc.perform(post("/api/v1/auth/password-reset/email/" + path)
            .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body)));
    }

    private String sentCode() {
        ArgumentCaptor<String> code = ArgumentCaptor.forClass(String.class);
        verify(mailer).sendCode(eq("mail-reset@auth-test.example"), anyString(), code.capture(), anyInt());
        assertThat(code.getValue()).matches("\\d{6}");
        return code.getValue();
    }

    private void account() {
        users.saveAndFlush(new User("Mail Reset", "mail-reset@auth-test.example", passwords.encode("old-secret1"), "citizen", null));
    }

    @Test
    void notConfiguredAnswers503() throws Exception {
        when(mailer.configured()).thenReturn(false);
        call("request", Map.of("email", "mail-reset@auth-test.example")).andExpect(status().isServiceUnavailable());
    }

    @Test
    void requestAnswersTheSameForUnknownLockedAndGoogleAccountsAndSendsNothing() throws Exception {
        call("request", Map.of("email", "nobody@auth-test.example")).andExpect(status().isOk()).andExpect(jsonPath("$.sent").value(true));
        User locked = new User("Locked", "locked-mail@auth-test.example", passwords.encode("x-secret12"), "citizen", null);
        locked.setActive(false);
        users.saveAndFlush(locked);
        call("request", Map.of("email", "locked-mail@auth-test.example")).andExpect(status().isOk());
        User google = new User("G", "google-mail@auth-test.example", passwords.encode("x-secret12"), "citizen", null);
        google.setAuthProvider("google");
        users.saveAndFlush(google);
        call("request", Map.of("email", "google-mail@auth-test.example")).andExpect(status().isOk());
        verify(mailer, never()).sendCode(anyString(), anyString(), anyString(), anyInt());
    }

    @Test
    void codeThenTokenThenNewPasswordAndNothingCanBeReused() throws Exception {
        account();
        call("request", Map.of("email", " Mail-Reset@Auth-Test.Example ")).andExpect(status().isOk());
        String code = sentCode();
        String wrong = code.equals("000000") ? "111111" : "000000";

        // A wrong code and a token that was never issued are refused; the new password cannot skip the code.
        call("verify", Map.of("email", "mail-reset@auth-test.example", "code", wrong)).andExpect(status().isBadRequest());
        call("complete", Map.of("email", "mail-reset@auth-test.example", "resetToken", "made-up", "newPassword", "brand-new-pw1"))
            .andExpect(status().isBadRequest());

        String token = json.readTree(call("verify", Map.of("email", "mail-reset@auth-test.example", "code", code))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).get("resetToken").asText();
        assertThat(token).isNotBlank();
        // The same code cannot be verified twice.
        call("verify", Map.of("email", "mail-reset@auth-test.example", "code", code)).andExpect(status().isBadRequest());

        call("complete", Map.of("email", "mail-reset@auth-test.example", "resetToken", token + "x", "newPassword", "brand-new-pw1"))
            .andExpect(status().isBadRequest());
        call("complete", Map.of("email", "mail-reset@auth-test.example", "resetToken", token, "newPassword", "brand-new-pw1"))
            .andExpect(status().isNoContent());
        call("complete", Map.of("email", "mail-reset@auth-test.example", "resetToken", token, "newPassword", "another-pw12"))
            .andExpect(status().isBadRequest());

        mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsString(Map.of("email", "mail-reset@auth-test.example", "password", "brand-new-pw1"))))
            .andExpect(status().isOk());
        mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsString(Map.of("email", "mail-reset@auth-test.example", "password", "old-secret1"))))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void fiveWrongGuessesLockTheCodeAndAnExpiredCodeIsRefused() throws Exception {
        account();
        call("request", Map.of("email", "mail-reset@auth-test.example")).andExpect(status().isOk());
        String code = sentCode();
        String wrong = code.equals("000000") ? "111111" : "000000";
        for (int i = 0; i < 5; i++) {
            call("verify", Map.of("email", "mail-reset@auth-test.example", "code", wrong)).andExpect(status().isBadRequest());
        }
        // Even the right code no longer works after five misses.
        call("verify", Map.of("email", "mail-reset@auth-test.example", "code", code)).andExpect(status().isBadRequest());

        jdbc.update("UPDATE core_schema.password_reset_codes SET attempts = 0, expires_at = now() - interval '1 minute'");
        call("verify", Map.of("email", "mail-reset@auth-test.example", "code", code)).andExpect(status().isBadRequest());
    }

    @Test
    void oneCodePerMinuteAndFivePerHour() throws Exception {
        account();
        call("request", Map.of("email", "mail-reset@auth-test.example")).andExpect(status().isOk());
        call("request", Map.of("email", "mail-reset@auth-test.example")).andExpect(status().isOk());
        verify(mailer, times(1)).sendCode(anyString(), anyString(), anyString(), anyInt());

        // Age the first code past the one-minute gap; four more may follow, the sixth within the hour may not.
        for (int i = 0; i < 6; i++) {
            jdbc.update("UPDATE core_schema.password_reset_codes SET created_at = created_at - interval '2 minutes'");
            call("request", Map.of("email", "mail-reset@auth-test.example")).andExpect(status().isOk());
        }
        verify(mailer, times(5)).sendCode(anyString(), anyString(), anyString(), anyInt());
    }
}
