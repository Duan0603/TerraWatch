package vn.terrawatch.core.service;

import jakarta.mail.internet.MimeMessage;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Component;
import org.springframework.web.util.HtmlUtils;

import java.nio.charset.StandardCharsets;

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
        try {
            MimeMessage message = sender.createMimeMessage();
            MimeMessageHelper mail = new MimeMessageHelper(message, true, StandardCharsets.UTF_8.name());
            mail.setFrom(from, "TerraWatch GeoSentry");
            mail.setTo(to);
            mail.setSubject("Mã xác nhận đặt lại mật khẩu TerraWatch");
            mail.setText(plainText(fullName, code, validMinutes), html(fullName, code, validMinutes));
            sender.send(message);
        } catch (java.io.UnsupportedEncodingException | jakarta.mail.MessagingException error) {
            throw new IllegalStateException("Could not build the reset e-mail", error);
        }
    }

    static String plainText(String fullName, String code, int minutes) {
        return "Xin chào " + greet(fullName) + ",\n\n"
            + "Mã xác nhận đặt lại mật khẩu TerraWatch của bạn là: " + code + "\n\n"
            + "Mã có hiệu lực trong " + minutes + " phút và chỉ dùng được một lần.\n"
            + "Không chia sẻ mã này với bất kỳ ai, kể cả người tự xưng là nhân viên TerraWatch.\n\n"
            + "Nếu bạn không yêu cầu, hãy bỏ qua email này: mật khẩu của bạn không thay đổi.\n\n"
            + "TerraWatch GeoSentry - Hệ thống cảnh báo sạt lở đất 24 giờ (giai đoạn thử nghiệm)\n";
    }

    /** Table layout with inline styles only: works in Gmail, Outlook and phone clients, needs no images. */
    static String html(String fullName, String code, int minutes) {
        String name = HtmlUtils.htmlEscape(greet(fullName));
        String digits = HtmlUtils.htmlEscape(code);
        return """
            <!doctype html>
            <html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
            <title>Mã xác nhận đặt lại mật khẩu TerraWatch</title></head>
            <body style="margin:0;padding:0;background:#EEF3F6;">
            <div style="display:none;max-height:0;overflow:hidden;opacity:0;">Mã xác nhận của bạn có hiệu lực %2$d phút.</div>
            <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="background:#EEF3F6;padding:24px 12px;">
             <tr><td align="center">
              <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#FFFFFF;border-radius:16px;overflow:hidden;border:1px solid #DCE5E2;">
               <tr><td style="background:#0B1626;padding:22px 28px;">
                <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;letter-spacing:2px;font-weight:700;color:#5FD0C0;">TERRAWATCH GEOSENTRY</div>
                <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#8196A1;margin-top:4px;">Hệ thống cảnh báo sạt lở đất 24 giờ</div>
               </td></tr>
               <tr><td style="padding:30px 28px 8px 28px;font-family:Arial,Helvetica,sans-serif;color:#172524;">
                <div style="font-size:20px;font-weight:700;margin-bottom:12px;">Đặt lại mật khẩu</div>
                <div style="font-size:15px;line-height:1.6;color:#3C4F4C;">Xin chào %1$s, đây là mã xác nhận để đặt lại mật khẩu tài khoản TerraWatch của bạn:</div>
               </td></tr>
               <tr><td align="center" style="padding:18px 28px;">
                <div style="display:inline-block;background:#E4F4F1;border:1px solid #B7E1DA;border-radius:12px;padding:16px 26px;font-family:'Courier New',Courier,monospace;font-size:36px;font-weight:700;letter-spacing:10px;color:#075F57;">%3$s</div>
               </td></tr>
               <tr><td style="padding:0 28px 26px 28px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#3C4F4C;">
                Mã có hiệu lực trong <strong>%2$d phút</strong> và chỉ dùng được một lần. Hãy nhập mã vào trang đăng nhập TerraWatch để tiếp tục.
               </td></tr>
               <tr><td style="padding:0 28px 28px 28px;">
                <div style="background:#FFF8E6;border:1px solid #F5E1A4;border-radius:10px;padding:12px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.55;color:#6B5310;">
                 <strong>Lưu ý an toàn:</strong> không chia sẻ mã này với bất kỳ ai, kể cả người tự xưng là nhân viên TerraWatch. Nếu bạn không yêu cầu, hãy bỏ qua email này; mật khẩu của bạn không thay đổi.
                </div>
               </td></tr>
               <tr><td style="background:#F5F8F7;border-top:1px solid #DCE5E2;padding:16px 28px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:#687977;">
                Email tự động từ TerraWatch GeoSentry, giai đoạn thử nghiệm. Vui lòng không trả lời email này.
               </td></tr>
              </table>
             </td></tr>
            </table>
            </body></html>
            """.formatted(name, minutes, digits);
    }

    private static String greet(String fullName) {
        return fullName == null || fullName.isBlank() ? "bạn" : fullName.trim();
    }
}
