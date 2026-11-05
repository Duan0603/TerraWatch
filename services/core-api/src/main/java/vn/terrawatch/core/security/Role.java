package vn.terrawatch.core.security;

import java.util.Locale;
import java.util.Optional;

/**
 * Single source of truth for the three role names stored in the Postgres
 * enum {@code core_schema.user_role} ('admin', 'officer', 'citizen').
 * Anywhere the app needs to validate or compare a role string, go through
 * this type instead of a hand-copied string literal/list.
 */
public enum Role {
    CITIZEN, OFFICER, ADMIN;

    /** The exact lowercase value stored in {@code core_schema.user_role}. */
    public String dbValue() {
        return name().toLowerCase(Locale.ROOT);
    }

    /** Parses a stored/claimed role value; empty if it is null or not one of the three known roles. */
    public static Optional<Role> fromDbValue(String value) {
        if (value == null) {
            return Optional.empty();
        }
        for (Role role : values()) {
            if (role.dbValue().equals(value)) {
                return Optional.of(role);
            }
        }
        return Optional.empty();
    }
}
