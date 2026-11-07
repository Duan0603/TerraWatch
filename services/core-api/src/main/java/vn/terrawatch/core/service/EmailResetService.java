package vn.terrawatch.core.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import vn.terrawatch.core.entity.User;
import vn.terrawatch.core.repository.PasswordResetRepository;
import vn.terrawatch.core.repository.PasswordResetRepository.Row;
import vn.terrawatch.core.repository.UserRepository;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.OffsetDateTime;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Locale;

/**
 * Story 4.21: forgot password by an e-mailed 6-digit code, in three calls: request (code goes to the
 * inbox), verify (right code gives a one-time token) and complete (token + new password).
 * Every failure after "request" is the same 400 so nothing says which part was wrong, and "request"
 * answers the same whether or not the e-mail has an account.
 */
@Service
public class EmailResetService {
    private static final Logger log = LoggerFactory.getLogger(EmailResetService.class);
    static final int CODE_MINUTES = 10;
    static final int MAX_ATTEMPTS = 5;
    static final int RESEND_SECONDS = 60;
    static final int MAX_PER_HOUR = 5;
    private static final String FAIL = "Mã xác nhận không đúng hoặc đã hết hạn";

    private final UserRepository users;
    private final PasswordResetRepository resets;
    private final PasswordResetMailer mailer;
    private final BCryptPasswordEncoder passwords;
    private final SecureRandom random = new SecureRandom();

    public EmailResetService(UserRepository users, PasswordResetRepository resets, PasswordResetMailer mailer,
                             BCryptPasswordEncoder passwords) {
        this.users = users;
        this.resets = resets;
        this.mailer = mailer;
        this.passwords = passwords;
    }

    public void request(String email) {
        if (!mailer.configured()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                "Máy chủ chưa cấu hình gửi email. Hãy liên hệ quản trị viên để đặt lại mật khẩu.");
        }
        User user = users.findByEmail(normalize(email)).filter(u -> u.isActive() && "email".equals(u.getAuthProvider())).orElse(null);
        if (user == null) return; // same answer as for a real account
        OffsetDateTime now = OffsetDateTime.now();
        Row last = resets.latest(user.getUserId());
        if (last != null && last.createdAt().isAfter(now.minusSeconds(RESEND_SECONDS))) return; // one code per minute
        if (resets.countSince(user.getUserId(), now.minusHours(1)) >= MAX_PER_HOUR) return;
        String code = String.format("%06d", random.nextInt(1_000_000));
        resets.insert(user.getUserId(), passwords.encode(code), now.plusMinutes(CODE_MINUTES));
        try {
            mailer.sendCode(user.getEmail(), user.getFullName(), code, CODE_MINUTES);
        } catch (RuntimeException error) {
            log.error("Could not send the password reset e-mail", error);
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Không gửi được email. Thử lại sau ít phút.");
        }
    }

    /** Right code in time gives a one-time token (valid another 10 minutes) for {@link #complete}. */
    public String verify(String email, String code) {
        User user = users.findByEmail(normalize(email)).orElseThrow(EmailResetService::fail);
        Row row = resets.latest(user.getUserId());
        OffsetDateTime now = OffsetDateTime.now();
        if (row == null || row.usedAt() != null || row.verifiedAt() != null || row.expiresAt().isBefore(now)
            || row.attempts() >= MAX_ATTEMPTS) throw fail();
        if (!passwords.matches(code == null ? "" : code.trim(), row.codeHash())) {
            resets.addAttempt(row.resetId());
            throw fail();
        }
        byte[] raw = new byte[32];
        random.nextBytes(raw);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(raw);
        resets.markVerified(row.resetId(), sha256(token), now.plusMinutes(CODE_MINUTES));
        return token;
    }

    public void complete(String email, String token, String newPassword) {
        if (newPassword.getBytes(StandardCharsets.UTF_8).length > 72) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Password exceeds 72 UTF-8 bytes");
        }
        User user = users.findByEmail(normalize(email)).orElseThrow(EmailResetService::fail);
        Row row = resets.latest(user.getUserId());
        if (row == null || row.usedAt() != null || row.verifiedAt() == null || row.tokenHash() == null
            || row.expiresAt().isBefore(OffsetDateTime.now()) || !row.tokenHash().equals(sha256(token == null ? "" : token))
            || !user.isActive()) throw fail();
        user.setPasswordHash(passwords.encode(newPassword));
        user.setUpdatedAt(OffsetDateTime.now());
        users.save(user);
        resets.markUsed(row.resetId());
    }

    private static ResponseStatusException fail() {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, FAIL);
    }

    private static String normalize(String email) {
        return email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
    }

    private static String sha256(String text) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(text.getBytes(StandardCharsets.UTF_8)));
        } catch (java.security.NoSuchAlgorithmException impossible) {
            throw new IllegalStateException(impossible);
        }
    }
}
