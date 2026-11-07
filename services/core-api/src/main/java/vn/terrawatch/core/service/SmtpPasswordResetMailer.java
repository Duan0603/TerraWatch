package vn.terrawatch.core.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Component;

/** Gmail (or any SMTP) sender configured by spring.mail.* from MAIL_USERNAME / MAIL_PASSWORD. */
@Component
public class SmtpPasswordResetMailer implements PasswordResetMailer {
    private final JavaMailSender sender;
    private final String from;

    public SmtpPasswordResetMailer(JavaMailSender sender, @Value("${spring.mail.username:}") String from) {
        this.sender = sender;
        this.from = from == null ? "" : from.trim();
    }

    @Override
    public boolean configured() {
        return !from.isBlank();
    }

    @Override
    public void sendCode(String to, String fullName, String code, int validMinutes) {
        SimpleMailMessage mail = new SimpleMailMessage();
        mail.setFrom(from);
        mail.setTo(to);
        mail.setSubject("TerraWatch: mã đặt lại mật khẩu " + code);
        mail.setText("Xin chào " + (fullName == null || fullName.isBlank() ? "bạn" : fullName) + ",\n\n"
            + "Mã xác nhận đặt lại mật khẩu TerraWatch của bạn là: " + code + "\n"
            + "Mã có hiệu lực trong " + validMinutes + " phút và chỉ dùng được một lần.\n\n"
            + "Nếu bạn không yêu cầu, hãy bỏ qua email này; mật khẩu của bạn không thay đổi.\n");
        sender.send(mail);
    }
}
