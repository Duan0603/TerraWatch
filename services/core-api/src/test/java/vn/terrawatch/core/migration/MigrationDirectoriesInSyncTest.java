package vn.terrawatch.core.migration;

import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.TreeSet;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Flyway (this module) applies src/main/resources/db/migration; scripts/migrate.py and the GIS CI
 * workflow apply database/migrations. The two copies must stay identical, otherwise the GIS tests run
 * on a different schema than the application. Plain file reads: no Spring context, no database.
 * Paths are relative to the module directory (Maven runs tests there).
 */
class MigrationDirectoriesInSyncTest {

    private static final Path FLYWAY = Path.of("src/main/resources/db/migration");
    private static final Path STANDALONE = Path.of("../../database/migrations");

    // Known differences, tracked by the two @Disabled tests below. Everything else is enforced.
    private static final String KNOWN_ONLY_IN_FLYWAY = "V15__multi_phase_sms_broadcast.sql";
    private static final String KNOWN_DIFFERENT_CONTENT = "V3__rainfall_terrain_forecast_schema.sql";

    @Test
    void sameFilesExistInBothDirectoriesExceptKnownOnes() throws IOException {
        assertThat(problems(Set.of(KNOWN_ONLY_IN_FLYWAY), Set.of(), true)).isEmpty();
    }

    @Test
    void sameFileNameHasSameContentExceptKnownOnes() throws IOException {
        assertThat(problems(Set.of(), Set.of(KNOWN_DIFFERENT_CONTENT), false)).isEmpty();
    }

    @Test
    @Disabled("BUG: expected both directories to hold the same files; actual V15__multi_phase_sms_broadcast.sql exists only in "
        + "services/core-api/src/main/resources/db/migration, so scripts/migrate.py and the GIS CI never get the incident_phase / "
        + "SMS columns on alert_broadcasts and alert_deliveries")
    void noFileMissingFromEitherDirectory() throws IOException {
        assertThat(problems(Set.of(), Set.of(), true)).isEmpty();
    }

    @Test
    @Disabled("BUG: expected identical V3 in both directories; actual database/migrations copy has one extra comment line "
        + "(\"-- Partial unique index handles NULL district/commune ...\" before idx_uq_user_subscription), "
        + "which does not change the resulting schema")
    void noFileHasDifferentContent() throws IOException {
        assertThat(problems(Set.of(), Set.of(), false)).isEmpty();
    }

    /** One message per offending file; names the file. filesOnly: check existence, otherwise check content. */
    private static List<String> problems(Set<String> ignoreMissing, Set<String> ignoreContent, boolean filesOnly)
            throws IOException {
        Set<String> flyway = sqlNames(FLYWAY);
        Set<String> standalone = sqlNames(STANDALONE);
        List<String> out = new ArrayList<>();
        if (filesOnly) {
            for (String f : flyway) {
                if (!standalone.contains(f) && !ignoreMissing.contains(f)) {
                    out.add(f + " exists in " + FLYWAY + " but not in " + STANDALONE);
                }
            }
            for (String f : standalone) {
                if (!flyway.contains(f) && !ignoreMissing.contains(f)) {
                    out.add(f + " exists in " + STANDALONE + " but not in " + FLYWAY);
                }
            }
        } else {
            for (String f : flyway) {
                if (standalone.contains(f) && !ignoreContent.contains(f)
                        && !Arrays.equals(Files.readAllBytes(FLYWAY.resolve(f)), Files.readAllBytes(STANDALONE.resolve(f)))) {
                    out.add(f + " has different content in " + FLYWAY + " and " + STANDALONE);
                }
            }
        }
        return out;
    }

    private static Set<String> sqlNames(Path dir) throws IOException {
        try (Stream<Path> s = Files.list(dir)) {
            Set<String> names = new TreeSet<>();
            s.map(p -> p.getFileName().toString()).filter(n -> n.endsWith(".sql")).forEach(names::add);
            // guard against a wrong path making the test pass on two empty sets
            assertThat(names).as("migrations found in %s", dir.toAbsolutePath().normalize()).isNotEmpty();
            return names;
        }
    }
}
