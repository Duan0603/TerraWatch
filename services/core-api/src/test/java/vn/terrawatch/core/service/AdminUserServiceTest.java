package vn.terrawatch.core.service;

import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;
import vn.terrawatch.core.dto.AdminUserItem;
import vn.terrawatch.core.entity.User;
import vn.terrawatch.core.repository.UserRepository;

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

/** Unit tests with a mocked repository; HTTP and role checks are covered by AdminUserApiTest and AuthorizationMatrixTest. */
class AdminUserServiceTest {
    private final UserRepository users = mock(UserRepository.class);
    private final AdminUserService service = new AdminUserService(users);
    private final UUID admin = UUID.randomUUID();

    private User user(String name, String email, String role, String phone, boolean active, String approval) {
        User u = new User(name, email, "hash", role, phone);
        u.setUserId(UUID.randomUUID());
        u.setActive(active);
        u.setApprovalStatus(approval);
        when(users.findById(u.getUserId())).thenReturn(Optional.of(u));
        return u;
    }

    private void stored(User... all) {
        when(users.findAllByOrderByCreatedAtDesc()).thenReturn(List.of(all));
        when(users.save(any(User.class))).thenAnswer(c -> c.getArgument(0));
    }

    private static void assertStatus(Runnable action, int status) {
        assertThatThrownBy(action::run).isInstanceOfSatisfying(ResponseStatusException.class,
            e -> assertThat(e.getStatusCode().value()).isEqualTo(status));
    }

    @Test
    void listWithoutFiltersKeepsRepositoryOrderAndMapsFields() {
        User a = user("An", "an@x.vn", "citizen", "0901", true, "approved");
        User b = user("Binh", "binh@x.vn", "officer", null, false, "pending");
        stored(a, b);
        List<AdminUserItem> out = service.listUsers(null, null, null, null);
        assertThat(out).extracting(AdminUserItem::email).containsExactly("an@x.vn", "binh@x.vn");
        assertThat(out.get(0).userId()).isEqualTo(a.getUserId());
        assertThat(out.get(1).isActive()).isFalse();
        assertThat(out.get(1).approvalStatus()).isEqualTo("pending");
    }

    @Test
    void searchMatchesNameEmailAndPhoneIgnoringCaseAndSurroundingSpaces() {
        User a = user("Nguyen An", "an@x.vn", "citizen", "0901234567", true, "approved");
        User b = user("Binh", "BINH@x.vn", "citizen", null, true, "approved");
        User noName = user(null, null, "citizen", null, true, "approved");
        stored(a, b, noName);
        assertThat(service.listUsers("  NGUYEN ", null, null, null)).extracting(AdminUserItem::email).containsExactly("an@x.vn");
        assertThat(service.listUsers("binh@", null, null, null)).hasSize(1);
        assertThat(service.listUsers("0901234", null, null, null)).extracting(AdminUserItem::fullName).containsExactly("Nguyen An");
        assertThat(service.listUsers("nobody", null, null, null)).isEmpty();
        assertThat(service.listUsers("   ", null, null, null)).hasSize(3);
    }

    @Test
    void roleActiveAndApprovalFiltersCombine() {
        User a = user("A", "a@x", "citizen", null, true, "approved");
        User b = user("B", "b@x", "officer", null, true, "pending");
        User c = user("C", "c@x", "officer", null, false, "approved");
        User noRole = user("D", "d@x", null, null, true, null);
        stored(a, b, c, noRole);
        assertThat(service.listUsers(null, " OFFICER ", null, null)).extracting(AdminUserItem::email).containsExactly("b@x", "c@x");
        assertThat(service.listUsers(null, "officer", true, null)).extracting(AdminUserItem::email).containsExactly("b@x");
        assertThat(service.listUsers(null, null, false, null)).extracting(AdminUserItem::email).containsExactly("c@x");
        assertThat(service.listUsers(null, "officer", null, "Pending")).extracting(AdminUserItem::email).containsExactly("b@x");
        assertThat(service.listUsers(null, "", null, "")).hasSize(4);
        assertThat(service.listUsers(null, null, null, "approved")).hasSize(2);
    }

    @Test
    void lockingYourselfIsRefusedButUnlockingYourselfIsAllowed() {
        User me = user("Me", "me@x", "admin", null, false, "approved");
        me.setUserId(admin);
        when(users.findById(admin)).thenReturn(Optional.of(me));
        when(users.save(any(User.class))).thenAnswer(c -> c.getArgument(0));
        assertStatus(() -> service.updateUserStatus(admin, false, admin), 400);
        verify(users, never()).save(any());
        assertThat(service.updateUserStatus(admin, true, admin).isActive()).isTrue();
    }

    @Test
    void statusChangeStoresFlagAndTouchesUpdatedAt() {
        User u = user("U", "u@x", "citizen", null, true, "approved");
        stored(u);
        var before = u.getUpdatedAt();
        AdminUserItem out = service.updateUserStatus(u.getUserId(), false, admin);
        assertThat(out.isActive()).isFalse();
        assertThat(u.isActive()).isFalse();
        assertThat(u.getUpdatedAt()).isAfterOrEqualTo(before);
        assertStatus(() -> service.updateUserStatus(UUID.randomUUID(), true, admin), 404);
    }

    @Test
    void roleChangeValidatesInputNormalizesAndSettlesApproval() {
        User u = user("U", "u@x", "citizen", null, true, "pending");
        stored(u);
        assertStatus(() -> service.updateUserRole(admin, "citizen", admin), 400);
        assertStatus(() -> service.updateUserRole(u.getUserId(), null, admin), 400);
        assertStatus(() -> service.updateUserRole(u.getUserId(), "  ", admin), 400);
        assertStatus(() -> service.updateUserRole(u.getUserId(), "superuser", admin), 400);
        assertStatus(() -> service.updateUserRole(UUID.randomUUID(), "officer", admin), 404);
        verify(users, never()).save(any());

        AdminUserItem out = service.updateUserRole(u.getUserId(), "  OFFICER ", admin);
        assertThat(out.role()).isEqualTo("officer");
        assertThat(u.getApprovalStatus()).isEqualTo("approved");
    }

    @Test
    void approveMakesPendingRequesterAnOfficerAndRejectLeavesRoleAlone() {
        User approve = user("A", "a@x", "citizen", null, true, "Pending");
        User reject = user("R", "r@x", "citizen", null, true, "pending");
        stored(approve, reject);
        assertThat(service.approveOfficer(approve.getUserId()).role()).isEqualTo("officer");
        assertThat(approve.getApprovalStatus()).isEqualTo("approved");
        AdminUserItem out = service.rejectOfficer(reject.getUserId());
        assertThat(out.approvalStatus()).isEqualTo("rejected");
        assertThat(reject.getRole()).isEqualTo("citizen");
    }

    @Test
    void approveAndRejectOnlyAnswerPendingRequests() {
        User decided = user("D", "d@x", "citizen", null, true, "approved");
        User none = user("N", "n@x", "admin", null, true, null);
        stored(decided, none);
        assertStatus(() -> service.approveOfficer(decided.getUserId()), 409);
        assertStatus(() -> service.rejectOfficer(decided.getUserId()), 409);
        assertStatus(() -> service.approveOfficer(none.getUserId()), 409);
        assertStatus(() -> service.rejectOfficer(UUID.randomUUID()), 404);
        assertThat(none.getRole()).isEqualTo("admin");
        verify(users, never()).save(any());
    }
}
