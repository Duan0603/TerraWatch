package vn.terrawatch.core.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.web.server.ResponseStatusException;
import vn.terrawatch.core.client.FcmSender;
import vn.terrawatch.core.client.SmsSender;
import vn.terrawatch.core.dto.BroadcastAlertRequest;
import vn.terrawatch.core.dto.BroadcastPreview;
import vn.terrawatch.core.repository.BroadcastRepository;
import vn.terrawatch.core.repository.BroadcastRepository.Area;
import vn.terrawatch.core.repository.BroadcastRepository.Recipient;
import vn.terrawatch.core.repository.BroadcastRepository.RunRef;
import vn.terrawatch.core.repository.BroadcastRepository.SmsRecipient;
import vn.terrawatch.core.repository.BroadcastRepository.Stored;
import vn.terrawatch.core.repository.DeviceTokenRepository;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/** Unit tests: repositories and the FCM/SMS senders are mocked, so nothing is sent and no database is needed. */
class NotificationServiceTest {
    private final BroadcastRepository broadcasts = mock(BroadcastRepository.class);
    private final DeviceTokenRepository devices = mock(DeviceTokenRepository.class);
    private final FcmSender fcm = mock(FcmSender.class);
    private final SmsSender sms = mock(SmsSender.class);
    private final NotificationService service = new NotificationService(broadcasts, devices, fcm, sms, "113");
    private final UUID sender = UUID.randomUUID();
    private final UUID broadcastId = UUID.randomUUID();

    private static BroadcastAlertRequest req(String event, String risk, String area, Integer areaId, String runId, String phase) {
        return new BroadcastAlertRequest(event, risk, null, area, areaId, runId, phase);
    }

    private static void assertStatus(Runnable action, int status) {
        assertThatThrownBy(action::run).isInstanceOfSatisfying(ResponseStatusException.class,
            e -> assertThat(e.getStatusCode().value()).isEqualTo(status));
    }

    @BeforeEach
    void stubs() {
        when(broadcasts.activeAreas()).thenReturn(List.of(new Area(1, "Mu Cang Chai"), new Area(2, "Sa Pa")));
        when(broadcasts.audience(any())).thenReturn(new int[]{0, 0, 0}); // no web/app-only followers unless a test says so
        when(broadcasts.insert(any(), anyString(), anyString(), anyString(), anyInt(), any(), anyInt(), any(), any(), anyString()))
            .thenReturn(new Stored(broadcastId, Instant.parse("2026-01-01T00:00:00Z")));
    }

    private void recipients(int areaId, int push, int smsCount) {
        List<Recipient> r = new java.util.ArrayList<>();
        for (int i = 0; i < push; i++) r.add(new Recipient(UUID.randomUUID(), "tok" + i));
        List<SmsRecipient> s = new java.util.ArrayList<>();
        for (int i = 0; i < smsCount; i++) s.add(new SmsRecipient(UUID.randomUUID(), "090000000" + i));
        when(broadcasts.recipients(List.of(areaId))).thenReturn(r);
        when(broadcasts.smsRecipients(List.of(areaId))).thenReturn(s);
    }

    @Test
    void rejectsUnknownRiskLevelAndPhaseBeforeTouchingAnything() {
        assertStatus(() -> service.broadcastAlert(req("e", "catastrophic", "Sa Pa", null, null, null), sender), 400);
        assertStatus(() -> service.broadcastAlert(req("e", null, "Sa Pa", null, null, null), sender), 400);
        assertStatus(() -> service.broadcastAlert(req("e", "high", "Sa Pa", null, null, "after_lunch"), sender), 400);
        verify(broadcasts, never()).insert(any(), any(), any(), any(), anyInt(), any(), anyInt(), any(), any(), any());
        verifyNoInteractions(fcm, sms);
    }

    @Test
    void malformedRunIdIs400AndUncitableRunIs409() {
        assertStatus(() -> service.broadcastAlert(req("e", "high", "Sa Pa", null, "not-a-uuid", null), sender), 400);
        UUID run = UUID.randomUUID();
        when(broadcasts.citableRun(run)).thenReturn(Optional.empty());
        assertStatus(() -> service.broadcastAlert(req("e", "high", "Sa Pa", null, run.toString(), null), sender), 409);
        verifyNoInteractions(fcm, sms);
    }

    @Test
    void noMatchingAreaOrNoRecipientsStoresAndSendsNothing() {
        var unknown = service.broadcastAlert(req("e1", "high", "Atlantis", null, null, null), sender);
        assertThat(unknown).containsEntry("status", "NO_RECIPIENTS").containsEntry("recipients_estimated", 0);
        var blank = service.broadcastAlert(req("e2", "high", "  ", null, null, null), sender);
        assertThat(blank).containsEntry("status", "NO_RECIPIENTS");

        recipients(2, 0, 0);
        var empty = service.broadcastAlert(req("e3", "HIGH", "Sa Pa", null, null, null), sender);
        assertThat(empty).containsEntry("status", "NO_RECIPIENTS").containsEntry("risk_level", "high");
        verify(broadcasts, never()).insert(any(), any(), any(), any(), anyInt(), any(), anyInt(), any(), any(), any());
        verifyNoInteractions(fcm, sms);
    }

    @Test
    void areaIdWinsOverTargetAreaName() {
        recipients(2, 1, 0);
        when(fcm.send(anyString(), any())).thenReturn(FcmSender.Result.sent());
        service.broadcastAlert(req("e", "high", "Mu Cang Chai", 2, null, null), sender);
        verify(broadcasts).recipients(List.of(2));
        verify(broadcasts, never()).recipients(List.of(1));
    }

    @Test
    void exactNameBeatsSubstringAndSubstringMatchesBothDirections() {
        when(broadcasts.activeAreas()).thenReturn(List.of(new Area(1, "Sa"), new Area(2, "Sa Pa"), new Area(3, "Sa Pa Town")));
        recipients(2, 0, 0);
        service.broadcastAlert(req("e1", "high", " sa pa ", null, null, null), sender);
        verify(broadcasts).recipients(List.of(2));

        when(broadcasts.activeAreas()).thenReturn(List.of(new Area(7, "Mu Cang Chai")));
        recipients(7, 0, 0);
        service.broadcastAlert(req("e2", "high", "huyen Mu Cang Chai tinh Yen Bai", null, null, null), sender);
        service.broadcastAlert(req("e3", "high", "cang", null, null, null), sender);
        verify(broadcasts, org.mockito.Mockito.times(2)).recipients(List.of(7));
    }

    @Test
    void fullDeliveryRecordsEachAttemptAndReportsDispatched() {
        recipients(1, 2, 1);
        when(fcm.send(anyString(), any())).thenReturn(FcmSender.Result.sent());
        when(sms.send(anyString(), anyString())).thenReturn(SmsSender.Result.sent("SM1"));

        Map<String, Object> out = service.broadcastAlert(req(" evt-1 ", "extreme", "Mu Cang Chai", null, null, "pre_incident"), sender);

        assertThat(out).containsEntry("status", "DISPATCHED").containsEntry("sent", 2).containsEntry("failed", 0)
            .containsEntry("sms_sent", 1).containsEntry("sms_failed", 0).containsEntry("incident_phase", "pre_incident")
            .containsEntry("broadcast_id", broadcastId.toString())
            .doesNotContainKeys("first_error", "sms_first_error");
        assertThat(out.get("channels")).isEqualTo(List.of("FCM_PUSH", "SMS"));
        @SuppressWarnings("unchecked") Map<String, String> payload = (Map<String, String>) out.get("payload");
        assertThat(payload.get("title")).contains("EXTREME");
        assertThat(payload.get("sms_body")).contains("113").contains("Mu Cang Chai");
        // trimmed event id is the idempotency key; no run cited so validity defaults to ~24h
        verify(broadcasts).insert(eq(sender), anyString(), anyString(), eq("extreme"), eq(1), any(OffsetDateTime.class),
            eq(2), eq("evt-1"), isNull(), eq("pre_incident"));
        verify(broadcasts, org.mockito.Mockito.times(2)).insertDelivery(eq(broadcastId), any(), eq(true), isNull());
        verify(broadcasts).insertSmsDelivery(eq(broadcastId), any(), eq(true), isNull(), eq("SM1"));
        verify(broadcasts).updateDeliveryCounts(broadcastId, 2, 0, 1, 1, 0);
        verify(devices, never()).forget(anyString());
    }

    @Test
    void partialAndTotalPushFailureAreReportedAndUnregisteredTokenIsForgotten() {
        recipients(1, 3, 0);
        when(fcm.send(eq("tok0"), any())).thenReturn(FcmSender.Result.sent());
        when(fcm.send(eq("tok1"), any())).thenReturn(FcmSender.Result.unregisteredToken("UNREGISTERED"));
        when(fcm.send(eq("tok2"), any())).thenReturn(FcmSender.Result.failed("quota"));

        Map<String, Object> out = service.broadcastAlert(req("e", "high", "Mu Cang Chai", null, null, null), sender);

        assertThat(out).containsEntry("status", "PARTIAL").containsEntry("sent", 1).containsEntry("failed", 2)
            .containsEntry("first_error", "UNREGISTERED");
        assertThat(out.get("channels")).isEqualTo(List.of("FCM_PUSH"));
        verify(devices).forget("tok1");
        verify(devices, never()).forget("tok2");
        verify(broadcasts).updateDeliveryCounts(broadcastId, 1, 2, 0, 0, 0);

        when(fcm.send(anyString(), any())).thenReturn(FcmSender.Result.failed("down"));
        assertThat(service.broadcastAlert(req("e2", "high", "Mu Cang Chai", null, null, null), sender)).containsEntry("status", "FAILED");
    }

    @Test
    void smsFailureIsCountedButDoesNotChangePushStatus() {
        recipients(1, 1, 2);
        when(fcm.send(anyString(), any())).thenReturn(FcmSender.Result.sent());
        when(sms.send(eq("0900000000"), anyString())).thenReturn(SmsSender.Result.sent("S1"));
        when(sms.send(eq("0900000001"), anyString())).thenReturn(SmsSender.Result.failed("blocked"));

        Map<String, Object> out = service.broadcastAlert(req("e", "high", "Mu Cang Chai", null, null, "during_incident"), sender);

        assertThat(out).containsEntry("status", "DISPATCHED").containsEntry("sms_sent", 1).containsEntry("sms_failed", 1)
            .containsEntry("sms_first_error", "blocked");
        verify(broadcasts).updateDeliveryCounts(broadcastId, 1, 0, 2, 1, 1);
    }

    @Test
    void smsOnlyAudienceStillCreatesBroadcastAndSkipsFcm() {
        recipients(1, 0, 1);
        when(sms.send(anyString(), anyString())).thenReturn(SmsSender.Result.sent("S"));
        Map<String, Object> out = service.broadcastAlert(req("e", "high", "Mu Cang Chai", null, null, null), sender);
        verify(fcm, never()).send(anyString(), any());
        assertThat(out).containsEntry("sms_sent", 1).containsEntry("devices", 0);
    }

    @Test
    void duplicateEventIdIs409AndNothingIsSent() {
        recipients(1, 1, 1);
        when(broadcasts.insert(any(), anyString(), anyString(), anyString(), anyInt(), any(), anyInt(), any(), any(), anyString()))
            .thenThrow(new DuplicateKeyException("dup"));
        assertStatus(() -> service.broadcastAlert(req("e", "high", "Mu Cang Chai", null, null, null), sender), 409);
        verifyNoInteractions(fcm, sms);
        verify(broadcasts, never()).updateDeliveryCounts(any(), anyInt(), anyInt(), anyInt(), anyInt(), anyInt());
    }

    @Test
    void citedRunSetsValidityAndRunReference() {
        UUID runId = UUID.randomUUID();
        OffsetDateTime until = OffsetDateTime.now().plusHours(5);
        RunRef run = new RunRef(runId, "U1", until);
        when(broadcasts.citableRun(runId)).thenReturn(Optional.of(run));
        recipients(1, 1, 0);
        when(fcm.send(anyString(), any())).thenReturn(FcmSender.Result.sent());
        service.broadcastAlert(req(null, "high", "Mu Cang Chai", null, " " + runId + " ", null), sender);
        verify(broadcasts).insert(eq(sender), anyString(), anyString(), eq("high"), eq(1), eq(until), eq(1), isNull(), eq(run), eq("during_incident"));
    }

    @Test
    void blankMessageFallsBackToDefaultText() {
        recipients(1, 1, 0);
        when(fcm.send(anyString(), any())).thenReturn(FcmSender.Result.sent());
        var blank = new BroadcastAlertRequest("e", "high", "  ", "Mu Cang Chai", null, null, null);
        @SuppressWarnings("unchecked")
        Map<String, String> payload = (Map<String, String>) service.broadcastAlert(blank, sender).get("payload");
        assertThat(payload.get("body")).contains("di tản ngay");
        var custom = new BroadcastAlertRequest("e2", "high", "Rời khỏi khu vực", "Mu Cang Chai", null, null, null);
        @SuppressWarnings("unchecked")
        Map<String, String> payload2 = (Map<String, String>) service.broadcastAlert(custom, sender).get("payload");
        assertThat(payload2.get("body")).isEqualTo("Rời khỏi khu vực");
    }

    @Test
    void historyLimitIsClampedToOneThroughFiveHundred() {
        service.history(0);
        service.history(10_000);
        service.history(25);
        verify(broadcasts).history(1);
        verify(broadcasts).history(500);
        verify(broadcasts).history(25);
    }

    @Test
    void previewReportsAudienceAndUnknownAreaIs404() {
        when(broadcasts.audience(List.of(2))).thenReturn(new int[]{4, 3, 2});
        assertThat(service.preview(2)).isEqualTo(new BroadcastPreview(2, "Sa Pa", 4, 3, 2));
        assertStatus(() -> service.preview(99), 404);
        verify(broadcasts, never()).audience(List.of(99));
    }

    @Test
    void revokeOfUnknownOrAlreadyRevokedBroadcastIs404() {
        UUID id = UUID.randomUUID();
        when(broadcasts.revoke(id)).thenReturn(true);
        service.revoke(id);
        UUID gone = UUID.randomUUID();
        when(broadcasts.revoke(gone)).thenReturn(false);
        assertStatus(() -> service.revoke(gone), 404);
    }
}
