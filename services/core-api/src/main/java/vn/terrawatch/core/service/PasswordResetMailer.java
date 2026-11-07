package vn.terrawatch.core.service;

/** Sends the reset code by e-mail. An interface so tests can capture the code without an SMTP server. */
public interface PasswordResetMailer {
    /** False when no sender account is configured (MAIL_USERNAME / MAIL_PASSWORD). */
    boolean configured();

    void sendCode(String to, String fullName, String code, int validMinutes);
}
