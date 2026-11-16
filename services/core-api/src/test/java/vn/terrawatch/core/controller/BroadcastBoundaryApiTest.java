package vn.terrawatch.core.controller;

import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.springframework.http.HttpMethod;
import vn.terrawatch.core.client.FcmSender;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Business boundary values of the alert flow (BL-BRD, BL-ALR, BL-DASH), asserted over HTTP and in the stored rows.
 * Already covered by older tests and not repeated: BL-BRD-009 (PushAlertsApiTest, validity follows the cited forecast),
 * BL-BRD-011 (PushAlertsApiTest, one device is dispatched). The 1000 character API limit is in FreeTextValidationMatrixTest.
 * BL-BRD-004: the web form blocks 161 characters, the API has no 160 limit (its limit is 1000); this class records that.
 * The SMS text is built from a template (TwilioSmsSender.smsBody) and never carries the admin's message, so a long message
 * cannot add SMS segments (BL-BRD-006).
 */
class BroadcastBoundaryApiTest extends FlowTestBase {
    private static final String BROADCAST = "/api/v1/notifications/broadcast";
    private static final String DEFAULT_MESSAGE = "Phát hiện nguy cơ sạt lở đồi núi nghiêm trọng. Vui lòng di tản ngay!";

    private String sendTo(Acct admin, int area, Object message) throws Exception {
        Map<String, Object> body = new java.util.HashMap<>(Map.of("riskLevel", "high", "areaId", area));
        if (message != null) body.put("message", message);
        return read(call(HttpMethod.POST, BROADCAST, admin, body).andExpect(status().isOk())).get("broadcast_id").asText();
    }

    private String storedMessage(String id) {
        return jdbc.queryForObject("SELECT message FROM core_schema.alert_broadcasts WHERE broadcast_id = CAST(? AS uuid)", String.class, id);
    }

    // ---- BL-BRD-001/002/003/004: the API takes any message up to its own limit, 160 is only a web-form rule ----

    @ParameterizedTest(name = "a message of {0} characters is dispatched and reaches the phone unchanged [{1}]")
    @CsvSource({"1, BL-BRD-001", "159, BL-BRD-002", "160, BL-BRD-003", "161, BL-BRD-004"})
    void aMessageOfAnyLengthUpToTheApiLimitIsStoredAndPushedUnchanged(int length, String ids) throws Exception {
        Acct admin = account("admin");
        Acct citizen = account("citizen");
        int area = seedArea();
        subscribe(citizen, area, "tok-len-" + length, false);
        String message = "a".repeat(length);

        String id = sendTo(admin, area, message);

        assertThat(storedMessage(id)).isEqualTo(message);
        ArgumentCaptor<FcmSender.Message> sent = ArgumentCaptor.forClass(FcmSender.Message.class);
        verify(fcm).send(eq("tok-len-" + length), sent.capture());
        assertThat(sent.getValue().body()).isEqualTo(message);
        assertThat(sent.getValue().data()).containsEntry("message", message);
    }

    // ---- BL-BRD-005: no message ----

    @ParameterizedTest(name = "message {0}: the default warning text is used")
    @ValueSource(strings = {"", "   "})
    void anEmptyOrBlankMessageFallsBackToTheDefaultText(String message) throws Exception {
        // BL-BRD-005 (behaviour recorded: the API does not block an empty message, it uses the default)
        Acct admin = account("admin");
        Acct citizen = account("citizen");
        int area = seedArea();
        subscribe(citizen, area, "tok-empty", false);

        String id = sendTo(admin, area, message);

        assertThat(storedMessage(id)).isEqualTo(DEFAULT_MESSAGE);
    }

    @Test
    void aMissingMessageAlsoUsesTheDefaultText() throws Exception {
        // BL-BRD-005
        Acct admin = account("admin");
        int area = seedArea();
        subscribe(account("citizen"), area, "tok-missing", false);
        assertThat(storedMessage(sendTo(admin, area, null))).isEqualTo(DEFAULT_MESSAGE);
    }

    // ---- BL-BRD-006: 160 Vietnamese characters with diacritics, and the SMS text ----

    @Test
    void aVietnameseMessageOf160CharactersKeepsItsDiacriticsAndTheSmsStaysWithinOneSegment() throws Exception {
        Acct admin = account("admin");
        Acct citizen = account("citizen", "Sms Vi", "0912345678");
        int area = seedArea("Lũng Phìn", true);
        subscribe(citizen, area, "tok-vi", true);
        String message = "Sơ tán ngay khỏi khu vực sạt lở đất, di chuyển lên nơi cao ráo ".repeat(3).substring(0, 160);
        assertThat(message).hasSize(160);

        JsonNode result = read(call(HttpMethod.POST, BROADCAST, admin, Map.of("riskLevel", "extreme", "areaId", area, "message", message))
            .andExpect(status().isOk()));

        assertThat(storedMessage(result.get("broadcast_id").asText())).isEqualTo(message);
        // the SMS goes out with the template text, ASCII only and at most 160 characters: one segment however long the message
        ArgumentCaptor<String> text = ArgumentCaptor.forClass(String.class);
        verify(sms).send(eq("0912345678"), text.capture());
        assertThat(text.getValue()).hasSizeLessThanOrEqualTo(160).doesNotContain(message.substring(0, 20)).matches("\\A\\p{ASCII}*\\z");
        assertThat(result.get("payload").get("sms_body").asText()).isEqualTo(text.getValue());
    }

    // ---- BL-BRD-007/008: the 24 hour validity of an order that cites no forecast ----

    @Test
    void anOrderWithoutAForecastIsValidForExactly24HoursAndExpiresOnlyAfterThat() throws Exception {
        Acct admin = account("admin");
        Acct citizen = account("citizen");
        int area = seedArea();
        subscribe(citizen, area, "tok-24h", false);
        String id = sendTo(admin, area, "valid 24h");

        double hours = jdbc.queryForObject("SELECT EXTRACT(EPOCH FROM (valid_until - now())) / 3600 FROM core_schema.alert_broadcasts WHERE broadcast_id = CAST(? AS uuid)", Double.class, id);
        assertThat(hours).isBetween(23.98, 24.02);

        // BL-BRD-007: 23 h 59 min after sending (1 min of validity left): still in force
        shift(id, "1 minute");
        JsonNode inForce = resync(citizen, id);
        assertThat(inForce.get("expired").asBoolean()).isFalse();
        assertThat(inForce.get("status").asText()).isEqualTo("active");
        // BL-BRD-008: 24 h 1 min after sending: expired, though never stored as a status
        shift(id, "-1 minute");
        JsonNode over = resync(citizen, id);
        assertThat(over.get("expired").asBoolean()).isTrue();
        assertThat(over.get("status").asText()).isEqualTo("active");
    }

    /** Leaves the order with this much validity (negative: already over), still a 24 hour order. */
    private void shift(String id, String remaining) {
        jdbc.update("UPDATE core_schema.alert_broadcasts SET valid_until = now() + CAST(? AS interval), "
            + "broadcast_time = now() + CAST(? AS interval) - interval '24 hours' WHERE broadcast_id = CAST(? AS uuid)", remaining, remaining, id);
    }

    private JsonNode resync(Acct citizen, String id) throws Exception {
        for (JsonNode n : read(call(HttpMethod.GET, "/api/v1/alerts/broadcasts", citizen, null).andExpect(status().isOk()))) {
            if (n.get("broadcastId").asText().equals(id)) return n;
        }
        return null;
    }

    // ---- BL-BRD-010/012: recipients ----

    @Test
    void aSubscriberWithoutAnyDeviceIsNoRecipientAndNoOrderIsCreated() throws Exception {
        // BL-BRD-010
        Acct admin = account("admin");
        Acct citizen = account("citizen");
        int area = seedArea();
        jdbc.update("INSERT INTO core_schema.alert_subscriptions (user_id, area_id, channel_push, channel_sms) VALUES (?, ?, true, false)", citizen.id(), area);

        call(HttpMethod.GET, BROADCAST + "/preview?areaId=" + area, admin, null)
            .andExpect(jsonPath("$.subscribers").value(1)).andExpect(jsonPath("$.devices").value(0));
        call(HttpMethod.POST, BROADCAST, admin, Map.of("riskLevel", "high", "areaId", area))
            .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("NO_RECIPIENTS")).andExpect(jsonPath("$.recipients_estimated").value(0));

        assertThat(count("SELECT count(*) FROM core_schema.alert_broadcasts WHERE area_id = ?", area)).isZero();
        verifyNoInteractions(fcm, sms);
    }

    @Test
    void oneDeviceAndNoPhoneWithBothChannelsChosenSendsThePushAndReportsNoSmsRecipients() throws Exception {
        // BL-BRD-012
        Acct admin = account("admin");
        Acct citizen = account("citizen", "Push only", null);
        int area = seedArea();
        subscribe(citizen, area, "tok-both-nophone", true);

        call(HttpMethod.POST, BROADCAST, admin, Map.of("riskLevel", "high", "areaId", area))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.sent").value(1))
            .andExpect(jsonPath("$.sms_recipients").value(0))
            .andExpect(jsonPath("$.sms_sent").value(0))
            .andExpect(jsonPath("$.channels.length()").value(1));

        verify(fcm).send(eq("tok-both-nophone"), org.mockito.ArgumentMatchers.any());
        verifyNoInteractions(sms);
        assertThat(count("SELECT count(*) FROM core_schema.alert_deliveries WHERE user_id = ? AND channel = 'sms'", citizen.id())).isZero();
    }

    // ---- BL-ALR-001/002: the 7 day resync window ----

    @ParameterizedTest(name = "an order sent {0} ago is in the citizen's resync: {1} [{2}]")
    @CsvSource({"'6 days 23 hours', true, BL-ALR-001", "'7 days 1 hour', false, BL-ALR-002"})
    void theResyncWindowIsSevenDays(String age, boolean listed, String ids) throws Exception {
        Acct admin = account("admin");
        Acct citizen = account("citizen");
        int area = seedArea();
        subscribe(citizen, area, "tok-window", false);
        String id = sendTo(admin, area, "window");
        jdbc.update("UPDATE core_schema.alert_broadcasts SET broadcast_time = now() - CAST(? AS interval) WHERE broadcast_id = CAST(? AS uuid)", age, id);

        assertThat(resync(citizen, id) != null).isEqualTo(listed);
        // the admin history keeps it either way: the window only limits what a phone re-syncs
        boolean inHistory = false;
        for (JsonNode n : read(call(HttpMethod.GET, "/api/v1/notifications/broadcasts?limit=500", admin, null))) {
            if (n.get("broadcastId").asText().equals(id)) inHistory = true;
        }
        assertThat(inHistory).isTrue();
    }

    // ---- BL-DASH-001/002: the live stream stays open 30 minutes, then the browser reconnects ----

    @Test
    void theLiveUpdateStreamTimesOutAfter30MinutesSoItStaysOpenAt29AndIsReconnectedAt31() {
        var emitter = hub.subscribe();
        long timeoutMs = emitter.getTimeout();
        emitter.complete();
        assertThat(timeoutMs).isEqualTo(30 * 60 * 1000L).isGreaterThan(29 * 60 * 1000L).isLessThan(31 * 60 * 1000L);
    }
}
