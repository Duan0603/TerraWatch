package vn.terrawatch.core.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import vn.terrawatch.core.client.FcmSender;
import vn.terrawatch.core.client.GoogleFcmSender;

import java.nio.file.Files;
import java.nio.file.Path;

@Configuration
public class FcmConfig {
    private static final Logger log = LoggerFactory.getLogger(FcmConfig.class);

    /**
     * Real FCM when a Firebase service account key file is configured; otherwise every send fails with a clear
     * reason (the broadcast is still stored) instead of pretending the push was delivered.
     */
    @Bean
    public FcmSender fcmSender(@Value("${firebase.service-account-file:}") String file, ObjectMapper json) {
        if (!file.isBlank() && Files.isReadable(Path.of(file))) {
            try {
                log.info("FCM enabled with service account {}", file);
                return GoogleFcmSender.fromFile(Path.of(file), json);
            } catch (Exception e) {
                log.error("FCM service account {} is unusable: {}", file, e.getMessage());
                String reason = "FCM service account unusable: " + e.getMessage();
                return (token, message) -> FcmSender.Result.failed(reason);
            }
        }
        log.warn("FCM not configured (set FIREBASE_SERVICE_ACCOUNT_FILE); broadcasts are stored but nothing is pushed");
        return (token, message) -> FcmSender.Result.failed("FCM not configured");
    }
}
