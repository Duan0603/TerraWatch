package vn.terrawatch.core.service;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import vn.terrawatch.core.dto.*;
import vn.terrawatch.core.entity.User;
import vn.terrawatch.core.repository.UserRepository;
import vn.terrawatch.core.security.FirebaseIdTokenVerifier;
import vn.terrawatch.core.security.JwtTokenProvider;
import vn.terrawatch.core.security.Role;

import java.nio.charset.StandardCharsets;
import java.time.OffsetDateTime;
import java.util.Locale;
import java.util.UUID;

@Service
public class AuthService {
    private final UserRepository users;
    private final BCryptPasswordEncoder passwords;
    private final JwtTokenProvider tokens;
    private final FirebaseIdTokenVerifier firebaseVerifier;
    private static final java.time.LocalDate MIN_BIRTH_DATE = java.time.LocalDate.of(1900, 1, 1);

    private final String dummyHash;

    @org.springframework.beans.factory.annotation.Autowired
    public AuthService(UserRepository users, BCryptPasswordEncoder passwords, JwtTokenProvider tokens,
                       FirebaseIdTokenVerifier firebaseVerifier) {
        this.users = users;
        this.passwords = passwords;
        this.tokens = tokens;
        this.firebaseVerifier = firebaseVerifier;
        this.dummyHash = passwords.encode("unused-login-timing-check");
    }

    public AuthService(UserRepository users, BCryptPasswordEncoder passwords, JwtTokenProvider tokens) {
        this(users, passwords, tokens, null);
    }

    public AuthResponse register(RegisterRequest request) {
        validatePasswordLength(request.password());
        String email = normalizeEmail(request.email());
        if (users.existsByEmail(email)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email already exists");
        }

        String verifiedPhone = verifiedPhone(request.phoneNumber(), request.phoneToken());

        User user = new User(request.fullName(), email, passwords.encode(request.password()),
            Role.CITIZEN.dbValue(), verifiedPhone);
        return response(saveNewUser(user, email));
    }

    /**
     * Story 4.8: anyone may ask for an officer account, but only with an OTP-verified phone, and the
     * account cannot sign in or call the API until an admin approves it (approval_status = pending).
     */
    public OfficerRequestResponse requestOfficer(OfficerRequest request) {
        validatePasswordLength(request.password());
        String email = normalizeEmail(request.email());
        if (users.existsByEmail(email)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email already exists");
        }
        String verifiedPhone = verifiedPhone(request.phoneNumber(), request.phoneToken());
        User user = new User(request.fullName(), email, passwords.encode(request.password()),
            Role.OFFICER.dbValue(), verifiedPhone);
        user.setApprovalStatus("pending");
        user.setDepartmentUnit(request.departmentUnit().trim());
        user = saveNewUser(user, email);
        return new OfficerRequestResponse(user.getUserId().toString(), "pending",
            "Hồ sơ đã được gửi. Tài khoản chỉ đăng nhập được sau khi Quản trị viên phê duyệt.");
    }

    /** Phone numbers are accepted only with a Firebase phone token for the same number (Story 4.6). */
    private String verifiedPhone(String phone, String phoneToken) {
        if (phone == null || phone.isBlank()) return null;
        if (phoneToken == null || phoneToken.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "Phone number must be verified via OTP before registration");
        }
        if (firebaseVerifier != null) {
            String tokenPhone = firebaseVerifier.verifyPhoneToken(phoneToken);
            if (!phonesMatch(tokenPhone, phone)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Phone number in verification token does not match registered phone number");
            }
        }
        return phone.trim();
    }

    private User saveNewUser(User user, String email) {
        try {
            return users.saveAndFlush(user);
        } catch (DataIntegrityViolationException error) {
            if (users.existsByEmail(email)) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Email already exists");
            }
            throw error;
        }
    }

    /** Story 4.19: lets the sign-up form warn about a used email before an SMS is spent on an OTP. */
    public boolean emailExists(String email) {
        return email != null && !email.isBlank() && users.existsByEmail(normalizeEmail(email));
    }

    public static boolean phonesMatch(String tokenPhone, String requestPhone) {
        if (tokenPhone == null || requestPhone == null) return false;
        String p1 = tokenPhone.replaceAll("[^0-9]", "");
        String p2 = requestPhone.replaceAll("[^0-9]", "");
        if (p1.equals(p2)) return true;
        if (p1.startsWith("84") && p2.startsWith("0")) {
            return p1.substring(2).equals(p2.substring(1));
        }
        if (p2.startsWith("84") && p1.startsWith("0")) {
            return p2.substring(2).equals(p1.substring(1));
        }
        return false;
    }

    public AuthResponse login(LoginRequest request) {
        validatePasswordLength(request.password());
        var user = users.findByEmail(normalizeEmail(request.email()));
        String storedHash = user.map(User::getPasswordHash).orElse(dummyHash);
        boolean matches;
        try {
            matches = passwords.matches(request.password(), storedHash);
        } catch (IllegalArgumentException malformedHash) {
            matches = false;
        }
        if (user.isEmpty() || !matches) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid credentials");
        }
        return response(user.get());
    }

    private static String normalizeEmail(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }

    public UserProfileResponse getCurrentUser(UUID userId) {
        return profile(users.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Unauthorized")));
    }

    public UserProfileResponse updateProfile(UUID userId, UpdateProfileRequest request) {
        User user = users.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Unauthorized"));
        if (request.dateOfBirth() != null && request.dateOfBirth().isBefore(MIN_BIRTH_DATE)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Date of birth is out of range");
        }
        user.setFullName(request.fullName().trim());
        user.setPhoneNumber(clean(request.phoneNumber()));
        user.setDateOfBirth(request.dateOfBirth());
        user.setGender(clean(request.gender()));
        user.setProvince(clean(request.province()));
        user.setDistrict(clean(request.district()));
        user.setCommune(clean(request.commune()));
        user.setAddressLine(clean(request.addressLine()));
        user.setEmergencyContactName(clean(request.emergencyContactName()));
        user.setEmergencyContactPhone(clean(request.emergencyContactPhone()));
        user.setEmergencyContactRelation(clean(request.emergencyContactRelation()));
        user.setUpdatedAt(OffsetDateTime.now());
        return profile(users.save(user));
    }

    /** Blank optional text is stored as null. */
    private static String clean(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    /**
     * Wrong current password is 400, not 401: clients treat 401 on an authenticated
     * call as an
     * expired session and sign the user out. Google-only accounts have no password
     * to change.
     */
    public void changePassword(UUID userId, ChangePasswordRequest request) {
        validatePasswordLength(request.newPassword());
        User user = users.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Unauthorized"));
        if (!"email".equals(user.getAuthProvider())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "This account signs in with Google and has no password");
        }
        boolean matches;
        try {
            matches = passwords.matches(request.currentPassword(), user.getPasswordHash());
        } catch (IllegalArgumentException malformedHash) {
            matches = false;
        }
        if (!matches) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Current password is incorrect");
        }
        user.setPasswordHash(passwords.encode(request.newPassword()));
        user.setUpdatedAt(OffsetDateTime.now());
        users.save(user);
    }

    private void validatePasswordLength(String password) {
        if (password.getBytes(StandardCharsets.UTF_8).length > 72) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Password exceeds 72 UTF-8 bytes");
        }
    }

    /**
     * Every sign-in path (password and Google) ends here, so a locked or unapproved account never
     * gets a token (Story 4.7: Google sign-in used to return 200 with a null token).
     */
    AuthResponse response(User user) {
        requireKnownRole(user);
        if (!user.isActive()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Tài khoản đã bị tạm khóa bởi Quản trị viên");
        }
        if ("pending".equalsIgnoreCase(user.getApprovalStatus())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Tài khoản cán bộ đang chờ Quản trị viên phê duyệt");
        }
        if ("rejected".equalsIgnoreCase(user.getApprovalStatus())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Tài khoản cán bộ đã bị từ chối phê duyệt");
        }
        return new AuthResponse(tokens.generateToken(user), user.getRole(), profile(user));
    }

    private UserProfileResponse profile(User user) {
        requireKnownRole(user);
        return new UserProfileResponse(user.getUserId().toString(), user.getFullName(), user.getEmail(),
                user.getRole(), user.getPhoneNumber(), user.getAuthProvider(),
                user.getDateOfBirth() == null ? null : user.getDateOfBirth().toString(), user.getGender(),
                user.getProvince(), user.getDistrict(), user.getCommune(), user.getAddressLine(),
                user.getEmergencyContactName(), user.getEmergencyContactPhone(), user.getEmergencyContactRelation(),
                user.isHasAvatar());
    }

    /**
     * Refuses to issue a token/profile for a row whose role isn't one of the three
     * known values.
     */
    private static void requireKnownRole(User user) {
        if (Role.fromDbValue(user.getRole()).isEmpty()) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "User account has an invalid role and cannot be authenticated");
        }
    }
}
