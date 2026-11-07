package vn.terrawatch.core.service;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/** Story 4.21: the reset e-mail shows the code, escapes the name and says what to do. */
class SmtpPasswordResetMailerTest {
    @Test
    void htmlShowsTheCodeAndTheExpiryAndEscapesTheName() {
        String html = SmtpPasswordResetMailer.html("<script>alert(1)</script> Lâm", "028224", 10);
        assertThat(html).contains("028224").contains("10 phút").contains("TERRAWATCH GEOSENTRY");
        assertThat(html).doesNotContain("<script>").contains("&lt;script&gt;");
        assertThat(html).doesNotContain("%1$s", "%2$d", "%3$s");
    }

    @Test
    void plainTextCarriesTheSameFactsForClientsWithoutHtml() {
        String text = SmtpPasswordResetMailer.plainText("Vũ Hải Lâm", "028224", 10);
        assertThat(text).contains("Xin chào Vũ Hải Lâm").contains("028224").contains("10 phút").contains("Không chia sẻ");
        assertThat(SmtpPasswordResetMailer.plainText(null, "000001", 10)).contains("Xin chào bạn");
    }
}
