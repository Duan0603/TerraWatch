package vn.terrawatch.core.service;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import vn.terrawatch.core.dto.AuthResponse;
import vn.terrawatch.core.entity.User;
import vn.terrawatch.core.repository.UserRepository;
import vn.terrawatch.core.security.FirebaseIdTokenVerifier;
import vn.terrawatch.core.security.Role;

import java.util.Locale;
import java.util.UUID;

/** Google sign-in for citizens: verified Firebase identity -> existing/new citizen -> TerraWatch JWT. */
@Service
public class GoogleAuthService {
    private final UserRepository users;
    private final BCryptPasswordEncoder passwords;
    private final FirebaseIdTokenVerifier verifier;
    private final AuthService auth;

    public GoogleAuthService(UserRepository users, BCryptPasswordEncoder passwords,
                             FirebaseIdTokenVerifier verifier, AuthService auth) {
        this.users = users;
        this.passwords = passwords;
        this.verifier = verifier;
        this.auth = auth;
    }

    public AuthResponse login(String idToken) {
        var identity = verifier.verify(idToken);
        String email = identity.email().trim().toLowerCase(Locale.ROOT);
        User user = users.findByEmail(email).orElseGet(() -> createCitizen(email, identity.name()));
        // A verified Google email must not become a back door into staff accounts.
        if (!Role.CITIZEN.dbValue().equals(user.getRole())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Google sign-in is only available for citizen accounts");
        }
        return auth.response(user);
    }

    private User createCitizen(String email, String name) {
        String fullName = (name == null || name.isBlank()) ? email.substring(0, email.indexOf('@')) : name.trim();
        // The random password is never disclosed, so the account can only be entered through Google.
        User user = new User(fullName.length() > 100 ? fullName.substring(0, 100) : fullName, email,
            passwords.encode(UUID.randomUUID().toString()), Role.CITIZEN.dbValue(), null);
        try {
            return users.saveAndFlush(user);
        } catch (DataIntegrityViolationException raced) {
            return users.findByEmail(email).orElseThrow(() -> raced);
        }
    }
}
