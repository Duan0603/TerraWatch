package vn.terrawatch.core.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import vn.terrawatch.core.client.SmsSender;
import vn.terrawatch.core.repository.PhoneOtpRepository;
import vn.terrawatch.core.repository.PhoneOtpRepository.Row;

import java.security.SecureRandom;
import java.time.OffsetDateTime;
import java.util.Base64;
import java.util.UUID;

/**
 * Story 4.44: phone verification without Firebase billing. The server makes a 6-digit code, sends it with the configured
 * {@link SmsSender} (SMS Gateway on a phone, eSMS or Twilio) and hands out a one-time phone token for the right code.
 * Register, officer request and phone password reset use the token up via {@link #consume}.
 */
@Service
public class PhoneOtpService {
    private static final Logger log = LoggerFactory.getLogger(PhoneOtpService.class);
    static final int CODE_MINUTES = 5;
    static final int TOKEN_MINUTES = 10;
    static final int MAX_ATTEMPTS = 5;
    static final int RESEND_SECONDS = 60;
    static final int MAX_PER_PHONE_HOUR = 5;
    static final int MAX_ALL_HOUR = 30; // every code is a real SMS from one SIM
    private static final String FAIL = "Mã xác thực không đúng hoặc đã hết hạn";

    private final PhoneOtpRepository codes;
    private final SmsSender sms;
    private final BCryptPasswordEncoder hasher;
    private final SecureRandom random = new SecureRandom();

    public PhoneOtpService(PhoneOtpRepository codes, SmsSender sms, BCryptPasswordEncoder hasher) {
        this.codes = codes;
        this.sms = sms;
        this.hasher = hasher;
    }

    public void request(String phoneNumber) {
        String phone = e164(phoneNumber);
        OffsetDateTime now = OffsetDateTime.now();
        Row last = codes.latest(phone);
        if (last != null && last.createdAt().isAfter(now.minusSeconds(RESEND_SECONDS))) {
            throw tooMany("Vui lòng đợi 60 giây rồi mới gửi lại mã.");
        }
        if (codes.countSince(phone, now.minusHours(1)) >= MAX_PER_PHONE_HOUR) {
            throw tooMany("Số này đã nhận quá nhiều mã trong 1 giờ. Thử lại sau.");
        }
        if (codes.countSince(null, now.minusHours(1)) >= MAX_ALL_HOUR) {
            throw tooMany("Hệ thống đang gửi quá nhiều mã. Thử lại sau ít phút.");
        }
        String code = String.format("%06d", random.nextInt(1_000_000));
        UUID id = codes.insert(phone, hasher.encode(code), now.plusMinutes(CODE_MINUTES));
        // no diacritics: one SMS segment, and the text reads the same on every phone
        SmsSender.Result sent = sms.send(phone, "TerraWatch: ma xac thuc cua ban la " + code
            + ", het han sau " + CODE_MINUTES + " phut. Khong chia se ma nay cho ai.");
        if (!sent.ok()) {
            codes.delete(id); // an unsent code must not block the resend nor count as valid
            log.warn("Phone OTP SMS not sent: {}", sent.error());
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "SMS not configured".equals(sent.error())
                ? "Máy chủ chưa bật gửi SMS nên chưa gửi được mã. Hãy liên hệ quản trị viên."
                : "Chưa gửi được tin nhắn mã xác thực. Thử lại sau ít phút.");
        }
    }

    /** Right code in time gives a one-time phone token (valid {@value #TOKEN_MINUTES} minutes). */
    public String verify(String phoneNumber, String code) {
        String phone = e164(phoneNumber);
        Row row = codes.latest(phone);
        if (row == null || row.verifiedAt() != null || row.expiresAt().isBefore(OffsetDateTime.now())
            || row.attempts() >= MAX_ATTEMPTS) throw fail();
        if (!hasher.matches(code == null ? "" : code.trim(), row.codeHash())) {
            codes.addAttempt(row.otpId());
            throw fail();
        }
        byte[] raw = new byte[32];
        random.nextBytes(raw);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(raw);
        codes.markVerified(row.otpId(), EmailResetService.sha256(token), OffsetDateTime.now().plusMinutes(TOKEN_MINUTES));
        return token;
    }

    /** Phone (E.164) proved by this token, now used up; null when it is not a live token of ours. */
    public String consume(String token) {
        return token == null || token.isBlank() ? null : codes.consume(EmailResetService.sha256(token));
    }

    /** 0xxxxxxxxx or +84xxxxxxxxx (spaces, dots, dashes ignored) as +84xxxxxxxxx. */
    static String e164(String phoneNumber) {
        String p = phoneNumber == null ? "" : phoneNumber.replaceAll("[\\s.-]", "");
        if (p.matches("0\\d{9}")) return "+84" + p.substring(1);
        if (p.matches("\\+84\\d{9}")) return p;
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Số điện thoại phải là 0 và 9 số (ví dụ 0912345678) hoặc +84…");
    }

    private static ResponseStatusException tooMany(String message) {
        return new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, message);
    }

    private static ResponseStatusException fail() {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, FAIL);
    }
}
