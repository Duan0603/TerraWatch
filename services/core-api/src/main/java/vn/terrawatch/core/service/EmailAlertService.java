package vn.terrawatch.core.service;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import vn.terrawatch.core.repository.BroadcastRepository.EmailRecipient;

import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;

/**
 * Gửi email HTML cảnh báo khẩn cấp tới công dân đăng ký vùng nguy hiểm.
 * Nếu SMTP_HOST rỗng hoặc gửi thất bại thì chỉ log warning, không làm sập luồng broadcast.
 */
@Service
public class EmailAlertService {

    private static final Logger log = LoggerFactory.getLogger(EmailAlertService.class);
    private static final DateTimeFormatter VN_FMT =
        DateTimeFormatter.ofPattern("HH:mm dd/MM/yyyy").withZone(ZoneId.of("Asia/Ho_Chi_Minh"));

    private final JavaMailSender mailSender;

    @Value("${spring.mail.username:}")
    private String fromAddress;

    @Value("${spring.mail.host:}")
    private String smtpHost;

    public EmailAlertService(JavaMailSender mailSender) {
        this.mailSender = mailSender;
    }

    @Async
    public void sendBroadcastEmails(List<EmailRecipient> recipients,
                                    String title, String message, String severity,
                                    String areaName, Instant issuedAt, Instant validUntil) {
        if (smtpHost == null || smtpHost.isBlank()) {
            log.warn("[EMAIL] SMTP_HOST chưa cấu hình — bỏ qua gửi email cho {} người nhận", recipients.size());
            return;
        }
        for (EmailRecipient r : recipients) {
            try {
                sendOne(r, title, message, severity, areaName, issuedAt, validUntil);
                log.info("[EMAIL] Đã gửi cảnh báo tới {}", r.email());
            } catch (Exception e) {
                log.warn("[EMAIL] Không gửi được tới {}: {}", r.email(), e.getMessage());
            }
        }
    }

    private void sendOne(EmailRecipient r, String title, String message, String severity,
                         String areaName, Instant issuedAt, Instant validUntil) throws MessagingException {
        MimeMessage mime = mailSender.createMimeMessage();
        MimeMessageHelper helper = new MimeMessageHelper(mime, true, "UTF-8");
        helper.setFrom("TerraWatch <" + fromAddress + ">");
        helper.setTo(r.email());
        helper.setSubject("⚠️ " + title);
        helper.setText(buildHtml(r.fullName(), title, message, severity, areaName, issuedAt, validUntil), true);
        mailSender.send(mime);
    }

    private String buildHtml(String name, String title, String message, String severity,
                              String areaName, Instant issuedAt, Instant validUntil) {
        String[] sv     = severityInfo(severity);
        String svBorder = sv[0]; // left-border color
        String svBg     = sv[1]; // light tinted background
        String svLabel  = sv[2]; // text label
        String svIcon   = sv[3]; // emoji icon

        String issuedStr   = issuedAt  != null ? VN_FMT.format(issuedAt)   : "—";
        String validStr    = validUntil != null ? VN_FMT.format(validUntil) : "—";
        String nameDisplay = (name != null && !name.isBlank()) ? name : "Quý công dân";
        String areaDisplay = areaName != null ? areaName : "khu vực của bạn";
        String esc = message == null ? "" : message
            .replace("&","&amp;").replace("<","&lt;").replace(">","&gt;");

        String tpl =
            "<!DOCTYPE html>" +
            "<html lang='vi'><head><meta charset='UTF-8'/>" +
            "<meta name='viewport' content='width=device-width,initial-scale=1'/>" +
            "<title>{{TITLE}}</title></head>" +
            "<body style='margin:0;padding:0;background:#f4f4f4;font-family:Arial,Helvetica,sans-serif;'>" +
            "<table width='100%' cellpadding='0' cellspacing='0' style='background:#f4f4f4;padding:24px 12px;'>" +
            "<tr><td align='center'>" +
            "<table width='580' cellpadding='0' cellspacing='0' style='max-width:580px;width:100%;background:#ffffff;border-radius:6px;overflow:hidden;border:1px solid #e0e0e0;'>" +

            // ── Header ──────────────────────────────────────────────────
            "<tr><td style='background:#0d4a3e;padding:20px 28px;'>" +
            "<p style='margin:0;color:#ffffff;font-size:20px;font-weight:bold;letter-spacing:0.5px;'>TerraWatch</p>" +
            "<p style='margin:4px 0 0;color:#a7c4bc;font-size:12px;'>H&#7879; th&#7889;ng c&#7843;nh b&aacute;o s&#7899;m s&#7841;t l&#7903; &#273;&#7845;t vi&#7877;n th&aacute;m</p>" +
            "</td></tr>" +

            // ── Severity bar ─────────────────────────────────────────────
            "<tr><td style='background:{{SV_BG}};border-left:4px solid {{SV_BORDER}};padding:14px 28px;'>" +
            "<p style='margin:0;font-size:15px;font-weight:bold;color:#1a1a1a;'>{{SV_ICON}} {{SV_LABEL}}</p>" +
            "<p style='margin:6px 0 0;font-size:13px;color:#444444;'>{{TITLE}}</p>" +
            "</td></tr>" +

            // ── Body ─────────────────────────────────────────────────────
            "<tr><td style='padding:24px 28px 20px;'>" +
            "<p style='margin:0 0 14px;font-size:15px;color:#1a1a1a;line-height:1.6;'>K&iacute;nh g&#7917;i <strong>{{NAME}}</strong>,</p>" +
            "<p style='margin:0 0 18px;font-size:15px;color:#333333;line-height:1.7;'>" +
            "C&#417; quan ch&#7913;c n&#259;ng v&#7915;a <strong>ph&aacute;t l&#7879;nh c&#7843;nh b&aacute;o</strong> " +
            "nguy c&#417; s&#7841;t l&#7903; &#273;&#7845;t nghi&ecirc;m tr&#7885;ng t&#7841;i khu v&#7921;c c&#7911;a b&#7841;n." +
            "</p>" +

            // Message block
            "<table width='100%' cellpadding='0' cellspacing='0' style='margin-bottom:20px;'>" +
            "<tr><td style='border-left:3px solid #cccccc;padding:10px 14px;background:#fafafa;'>" +
            "<p style='margin:0;font-size:14px;color:#333333;line-height:1.7;font-style:italic;'>&#8220;{{MESSAGE}}&#8221;</p>" +
            "</td></tr></table>" +

            // Info table
            "<table width='100%' cellpadding='0' cellspacing='0' " +
            "style='border-collapse:collapse;font-size:14px;margin-bottom:20px;border:1px solid #e0e0e0;border-radius:4px;'>" +
            "<tr>" +
            "<td style='padding:10px 14px;background:#f7f7f7;color:#555555;width:42%;border-bottom:1px solid #e0e0e0;vertical-align:top;'>Khu v&#7921;c c&#7843;nh b&aacute;o</td>" +
            "<td style='padding:10px 14px;color:#1a1a1a;font-weight:bold;border-bottom:1px solid #e0e0e0;'>{{AREA}}</td>" +
            "</tr><tr>" +
            "<td style='padding:10px 14px;background:#f7f7f7;color:#555555;border-bottom:1px solid #e0e0e0;'>Th&#7901;i &#273;i&#7875;m ph&aacute;t l&#7879;nh</td>" +
            "<td style='padding:10px 14px;color:#1a1a1a;border-bottom:1px solid #e0e0e0;'>{{ISSUED}} (gi&#7901; Vi&#7879;t Nam)</td>" +
            "</tr><tr>" +
            "<td style='padding:10px 14px;background:#f7f7f7;color:#555555;'>Hi&#7879;u l&#7921;c &#273;&#7871;n</td>" +
            "<td style='padding:10px 14px;color:#1a1a1a;font-weight:bold;'>{{VALID}} (gi&#7901; Vi&#7879;t Nam)</td>" +
            "</tr></table>" +

            // Action list
            "<table width='100%' cellpadding='0' cellspacing='0' style='margin-bottom:22px;'>" +
            "<tr><td style='border:1px solid #e0e0e0;border-radius:4px;padding:14px 18px;background:#fafafa;'>" +
            "<p style='margin:0 0 10px;font-size:14px;font-weight:bold;color:#1a1a1a;'>Vi&#7879;c c&#7847;n l&agrave;m ngay:</p>" +
            "<p style='margin:0 0 7px;font-size:14px;color:#333333;line-height:1.6;'>&#9654; S&#417; t&aacute;n ng&#432;&#7901;i gi&agrave;, tr&#7867; em, ng&#432;&#7901;i c&#7847;n h&#7895; tr&#7907; &#273;&#7871;n n&#417;i an to&agrave;n</p>" +
            "<p style='margin:0 0 7px;font-size:14px;color:#333333;line-height:1.6;'>&#9654; Tr&aacute;nh xa s&#432;&#7901;n d&#7889;c, taluy &#273;&#432;&#7901;ng, khu v&#7921;c ven su&#7889;i</p>" +
            "<p style='margin:0 0 7px;font-size:14px;color:#333333;line-height:1.6;'>&#9654; Li&ecirc;n h&#7879; ch&iacute;nh quy&#7873;n &#273;&#7883;a ph&#432;&#417;ng &#273;&#7875; &#273;&#432;&#7907;c h&#7895; tr&#7907;</p>" +
            "<p style='margin:0;font-size:14px;color:#333333;line-height:1.6;'>&#9654; Theo d&#245;i th&ocirc;ng b&aacute;o ch&iacute;nh th&#7913;c t&#7915; Ban Ch&#7881; huy PCTT</p>" +
            "</td></tr></table>" +

            "<p style='margin:0;font-size:12px;color:#888888;line-height:1.6;'>" +
            "B&#7841;n nh&#7853;n &#273;&#432;&#7907;c email n&agrave;y do &#273;&atilde; &#273;&#259;ng k&yacute; theo d&#245;i khu v&#7921;c " +
            "<strong>{{AREA}}</strong> tr&ecirc;n h&#7879; th&#7889;ng TerraWatch." +
            "</p></td></tr>" +

            // ── Footer ───────────────────────────────────────────────────
            "<tr><td style='padding:14px 28px;background:#f7f7f7;border-top:1px solid #e0e0e0;'>" +
            "<p style='margin:0;font-size:11px;color:#999999;text-align:center;line-height:1.7;'>" +
            "TerraWatch &bull; H&#7879; th&#7889;ng c&#7843;nh b&aacute;o s&#7899;m s&#7841;t l&#7903; &#273;&#7845;t vi&#7877;n th&aacute;m &bull; &copy; 2026<br/>" +
            "&#272;&acirc;y l&agrave; th&ocirc;ng b&aacute;o t&#7921; &#273;&#7897;ng &mdash; vui l&ograve;ng kh&ocirc;ng tr&#7843; l&#7901;i email n&agrave;y." +
            "</p></td></tr>" +

            "</table>" +
            "</td></tr></table>" +
            "</body></html>";

        return tpl
            .replace("{{TITLE}}",     title != null ? title : "")
            .replace("{{SV_BORDER}}", svBorder)
            .replace("{{SV_BG}}",     svBg)
            .replace("{{SV_ICON}}",   svIcon)
            .replace("{{SV_LABEL}}",  svLabel)
            .replace("{{AREA}}",      areaDisplay)
            .replace("{{NAME}}",      nameDisplay)
            .replace("{{MESSAGE}}",   esc)
            .replace("{{ISSUED}}",    issuedStr)
            .replace("{{VALID}}",     validStr);
    }

    /** Returns [borderColor, bgColor, label, icon] */
    private String[] severityInfo(String severity) {
        return switch (severity == null ? "" : severity.toLowerCase(Locale.ROOT)) {
            case "extreme" -> new String[]{"#b91c1c", "#fef2f2", "Mức nguy hiểm: CỰC KỲ NGUY HIỂM", "&#9888;"};
            case "high"    -> new String[]{"#c2410c", "#fff7ed", "Mức nguy hiểm: CAO",               "&#9888;"};
            case "medium"  -> new String[]{"#b45309", "#fffbeb", "Mức nguy hiểm: TRUNG BÌNH",        "&#9888;"};
            default        -> new String[]{"#166534", "#f0fdf4", "Mức nguy hiểm: THẤP",              "&#9432;"};
        };
    }
}
