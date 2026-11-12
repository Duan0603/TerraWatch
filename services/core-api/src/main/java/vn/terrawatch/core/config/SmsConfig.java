package vn.terrawatch.core.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import vn.terrawatch.core.client.EsmsSender;
import vn.terrawatch.core.client.SmsSender;
import vn.terrawatch.core.client.TwilioSmsSender;

@Configuration
public class SmsConfig {
    private static final Logger log = LoggerFactory.getLogger(SmsConfig.class);

    @Bean
    public SmsSender smsSender(@Value("${sms.provider:}") String provider,
                               @Value("${twilio.account-sid:}") String twilioSid,
                               @Value("${twilio.auth-token:}") String twilioToken,
                               @Value("${twilio.from-number:}") String twilioFrom,
                               @Value("${esms.api-key:}") String esmsApiKey,
                               @Value("${esms.secret-key:}") String esmsSecretKey,
                               @Value("${esms.brandname:Baotrixemay}") String esmsBrandname,
                               @Value("${esms.sandbox:0}") String esmsSandbox,
                               ObjectMapper json) {
        String prov = provider == null ? "" : provider.trim().toLowerCase();

        // 1. eSMS.vn Gateway (Domestic VN SMS)
        if ("esms".equals(prov) || (prov.isBlank() && !esmsApiKey.isBlank())) {
            if (!esmsApiKey.isBlank() && !esmsSecretKey.isBlank()) {
                boolean sandbox = "1".equals(esmsSandbox.trim()) || "true".equalsIgnoreCase(esmsSandbox.trim());
                log.info("SMS enabled via eSMS (brandname: {}, sandbox: {})", esmsBrandname, sandbox);
                return new EsmsSender(esmsApiKey, esmsSecretKey, esmsBrandname, sandbox, json);
            }
        }

        // 2. Twilio Gateway (International SMS)
        if ("twilio".equals(prov) || (prov.isBlank() && !twilioSid.isBlank())) {
            if (!twilioSid.isBlank() && !twilioToken.isBlank() && !twilioFrom.isBlank()) {
                log.info("SMS enabled via Twilio (from {})", twilioFrom);
                return new TwilioSmsSender(twilioSid, twilioToken, twilioFrom, json);
            }
        }

        // 3. Fallback mock lambda (AC7)
        log.warn("SMS not configured; broadcasts store but no SMS sent");
        return (phone, body) -> SmsSender.Result.failed("SMS not configured");
    }
}
