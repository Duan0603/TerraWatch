package vn.terrawatch.core.repository;

import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import vn.terrawatch.core.entity.User;

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest(showSql = false)
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class UserPersistenceTest {
    @Autowired UserRepository users;
    @Autowired EntityManager entityManager;

    @Test
    void insertsAndReadsNativePostgresEnumForAllRoles() {
        for (String role : new String[]{"citizen", "officer", "admin"}) {
            User saved = users.saveAndFlush(new User("Test", role + "@auth-test.example",
                new BCryptPasswordEncoder().encode("secret123"), role, null));
            assertThat(saved.getUserId()).isNotNull();
            entityManager.clear();
            assertThat(users.findById(saved.getUserId()).orElseThrow().getRole()).isEqualTo(role);
        }
    }

    @Test
    void demoAccountsHaveTheKnownV4MigrationPasswordAndRejectWrongOnes() {
        for (String email : new String[]{"admin@terrawatch.vn", "officer.yenbai@terrawatch.vn", "citizen.limmong@terrawatch.vn"}) {
            User user = users.findByEmail(email).orElseThrow();
            // V4__set_demo_user_passwords.sql sets this hash so the login page can demo all 3 roles.
            assertThat(user.getPasswordHash()).matches("\\$2[ab]\\$10\\$[./A-Za-z0-9]{53}");
            assertThat(new BCryptPasswordEncoder().matches("Terrawatch@2026", user.getPasswordHash())).isTrue();
            assertThat(new BCryptPasswordEncoder().matches("deliberately-wrong-auth-test", user.getPasswordHash())).isFalse();
        }
    }
}
