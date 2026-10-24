package vn.terrawatch.core.service;

import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.server.ResponseStatusException;
import vn.terrawatch.core.dto.ChangePasswordRequest;
import vn.terrawatch.core.dto.SubscriptionRequest;
import vn.terrawatch.core.dto.UpdateProfileRequest;
import vn.terrawatch.core.entity.AlertSubscription;
import vn.terrawatch.core.entity.MonitoringArea;
import vn.terrawatch.core.entity.User;
import vn.terrawatch.core.repository.AlertSubscriptionRepository;
import vn.terrawatch.core.repository.MonitoringAreaJpaRepository;
import vn.terrawatch.core.repository.UserRepository;
import vn.terrawatch.core.security.JwtTokenProvider;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ProfileAndSubscriptionServiceTest {
    private final UserRepository users = mock(UserRepository.class);
    private final BCryptPasswordEncoder passwords = new BCryptPasswordEncoder();
    private final AuthService auth = new AuthService(users, passwords,
        new JwtTokenProvider("test-only-secret-at-least-thirty-two-bytes-long", 60_000));
    private final AlertSubscriptionRepository subs = mock(AlertSubscriptionRepository.class);
    private final MonitoringAreaJpaRepository areas = mock(MonitoringAreaJpaRepository.class);
    private final AlertSubscriptionService subscriptions = new AlertSubscriptionService(subs, areas, users);
    private final UUID me = UUID.randomUUID();

    private User user(String provider, String phone) {
        User user = new User("An", "an@example.com", passwords.encode("oldpass123"), "citizen", phone);
        user.setUserId(me);
        user.setAuthProvider(provider);
        when(users.findById(me)).thenReturn(Optional.of(user));
        when(users.save(any(User.class))).thenAnswer(call -> call.getArgument(0));
        return user;
    }

    private MonitoringArea area(boolean active) {
        MonitoringArea area = new MonitoringArea("Mu Cang Chai", "d", active);
        area.setAreaId(1);
        when(areas.findById(1)).thenReturn(Optional.of(area));
        return area;
    }

    private static void assertStatus(Runnable action, int status) {
        assertThatThrownBy(action::run).isInstanceOfSatisfying(ResponseStatusException.class,
            e -> assertThat(e.getStatusCode().value()).isEqualTo(status));
    }

    @Test
    void updatesNameAndPhoneAndClearsBlankPhone() {
        User user = user("email", "0901234567");
        var updated = auth.updateProfile(me, new UpdateProfileRequest("  Binh  ", "0912345678"));
        assertThat(updated.fullName()).isEqualTo("Binh");
        assertThat(updated.phoneNumber()).isEqualTo("0912345678");
        auth.updateProfile(me, new UpdateProfileRequest("Binh", ""));
        assertThat(user.getPhoneNumber()).isNull();
    }

    @Test
    void changesPasswordOnlyWithCorrectCurrentOneAndNeverAnswers401() {
        User user = user("email", null);
        assertStatus(() -> auth.changePassword(me, new ChangePasswordRequest("wrong-pass", "newpass123")), 400);
        auth.changePassword(me, new ChangePasswordRequest("oldpass123", "newpass123"));
        assertThat(passwords.matches("newpass123", user.getPasswordHash())).isTrue();
    }

    @Test
    void googleAccountsCannotChangePassword() {
        user("google", null);
        assertStatus(() -> auth.changePassword(me, new ChangePasswordRequest("x", "newpass123")), 400);
        verify(users, never()).save(any());
    }

    @Test
    void subscribeSavesChannelsAndPhoneThenUpdatesInsteadOfDuplicating() {
        User user = user("email", null);
        area(true);
        when(subs.findByUserIdAndAreaId(me, 1)).thenReturn(Optional.empty());
        when(subs.save(any(AlertSubscription.class))).thenAnswer(call -> {
            AlertSubscription s = call.getArgument(0);
            if (s.getSubscriptionId() == null) {
                try {
                    var id = AlertSubscription.class.getDeclaredField("subscriptionId");
                    id.setAccessible(true);
                    id.set(s, UUID.randomUUID());
                } catch (ReflectiveOperationException e) {
                    throw new IllegalStateException(e);
                }
            }
            return s;
        });
        var created = subscriptions.subscribe(me, new SubscriptionRequest(1, List.of("PUSH", "SMS"), "0912345678"));
        assertThat(created.alertChannels()).containsExactly("PUSH", "SMS");
        assertThat(created.areaName()).isEqualTo("Mu Cang Chai");
        assertThat(user.getPhoneNumber()).isEqualTo("0912345678");

        AlertSubscription existing = new AlertSubscription(me, 1, true, true);
        when(subs.findByUserIdAndAreaId(me, 1)).thenReturn(Optional.of(existing));
        var updated = subscriptions.subscribe(me, new SubscriptionRequest(1, List.of("PUSH"), null));
        assertThat(updated.alertChannels()).containsExactly("PUSH");
    }

    @Test
    void smsNeedsAPhoneNumberAndAreaMustBeActive() {
        user("email", null);
        area(true);
        assertStatus(() -> subscriptions.subscribe(me, new SubscriptionRequest(1, List.of("SMS"), null)), 400);
        area(false);
        assertStatus(() -> subscriptions.subscribe(me, new SubscriptionRequest(1, List.of("PUSH"), null)), 404);
        when(areas.findById(99)).thenReturn(Optional.empty());
        assertStatus(() -> subscriptions.subscribe(me, new SubscriptionRequest(99, List.of("PUSH"), null)), 404);
    }

    @Test
    void cannotRemoveSomeoneElsesSubscription() {
        UUID subscriptionId = UUID.randomUUID();
        when(subs.findBySubscriptionIdAndUserId(subscriptionId, me)).thenReturn(Optional.empty());
        assertStatus(() -> subscriptions.unsubscribe(me, subscriptionId), 404);
        verify(subs, never()).delete(any());
    }
}
