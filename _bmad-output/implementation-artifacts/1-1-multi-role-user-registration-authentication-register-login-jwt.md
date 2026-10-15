---
baseline_commit: 5264248031277bbfdbd92225727687040f696faa
---
# Story 1.1: Multi-role registration and JWT

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a User (Citizen, Officer, or Admin),
I want to register an account and log in securely to receive a role-specific JWT access token,
so that my identity and authorized operational scope are verified across WebGIS and Mobile applications.

**Epic:** Epic 1: Foundation, identity and forecast data contracts
**Sprint key:** `1-1-multi-role-user-registration-authentication-register-login-jwt`
**Target service:** Core API (`services/core-api/`, Spring Boot 3.2.4 / Java 17, port 3000)
**Owners (per epics.md):** Thuận; Huy, Lâm

## Acceptance Criteria

1. **AC1 — Register:** `POST /api/v1/auth/register` creates a user with `role` forced to `citizen` regardless of any `role` value in the request body (optional `phoneNumber`/`phone_number` accepted for SMS alerts). There is **no public way to create an `officer` or `admin` account** through this endpoint — assigning those roles is out of scope for this story (see Dev Notes → Open Questions). Passwords are hashed with BCrypt before storage; duplicate email returns `409 Conflict`.
2. **AC2 — Login:** `POST /api/v1/auth/login` validates email/password against the stored BCrypt hash and returns a JWT whose claims include `userId` (subject), `email`, and `role`. Invalid credentials return `401 Unauthorized` with no indication of whether the email or the password was wrong.
3. **AC3 — Me:** `GET /api/v1/auth/me` returns the current user's profile (no `passwordHash` field) when called with a valid `Authorization: Bearer <token>` header; returns `401` when the header is missing, malformed, or the token is expired/invalid.
4. **AC4 — Security config:** Spring Security 6 permits unauthenticated access to `/api/v1/auth/register` and `/api/v1/auth/login` (and the existing `/api-docs/**`, `/swagger-ui/**` docs routes) while requiring a valid JWT for `/api/v1/auth/me` and any other route this story marks protected. **Do not flip the blanket `.requestMatchers("/api/v1/**").permitAll()` to `.anyRequest().authenticated()`** — that would also lock down `/api/v1/landslides/**`, `/api/v1/community-reports/**`, `/api/v1/monitoring-areas/**`, `/api/v1/notifications/**`, which Stories 4.2/4.3/4.4 already shipped as unauthenticated and which no client currently sends a token to (see Dev Notes → Architecture Compliance). Add auth rules narrowly, alongside the existing permissive rule.
5. **AC5 — No plaintext passwords:** `passwordHash` (and the raw `password` field from requests) must never appear in any JSON response — not in register, login, me, or error bodies/logs.

## Tasks / Subtasks

- [x] **Task 1: JWT dependency & token service** (AC: #2, #3)
  - [x] 1.1 Add `io.jsonwebtoken:jjwt-api`, `jjwt-impl`, `jjwt-jackson` **version `0.12.6`** (current stable 0.12.x line; see Dev Notes → Latest Tech Info) to `services/core-api/pom.xml`. Do NOT use the old monolithic `io.jsonwebtoken:jjwt` artifact (legacy/deprecated 0.9.x API — different method signatures).
  - [x] 1.2 Add `jwt.secret` / `jwt.expiration-ms` properties to `application.yml`, sourced from `${JWT_SECRET}` / `${JWT_EXPIRATION_MS:86400000}` — both already defined in `.env.example` (`JWT_SECRET=terrawatch_super_secret_jwt_key_for_capstone_project_2026_se_defense`, `JWT_EXPIRATION_MS=86400000`). Do not hardcode the secret in code.
  - [x] 1.3 Implement `vn.terrawatch.core.security.JwtTokenProvider` (or `JwtService`) with `generateToken(User user)` (claims: subject=`userId.toString()`, `email`, `role`) and `validateAndParse(String token)` returning claims or throwing on failure. Use `jjwt`'s `Jwts.builder()/parser()` 0.12.x fluent API (not the deprecated 0.11.x `parserBuilder()` style — confirm against the 0.12.x README when implementing).
- [x] **Task 2: Auth DTOs, UserRole handling, and AuthService** (AC: #1, #2, #5)
  - [x] 2.1 Create DTOs as Java `record`s under `vn.terrawatch.core.dto`, matching this project's existing DTO style (`BroadcastAlertRequest`, `CreateAreaRequest`, etc. are all records): `RegisterRequest(String fullName, String email, String password, String phoneNumber)` (no `role` field — see AC1), `LoginRequest(String email, String password)`, `AuthResponse(String token, String role, UserProfileResponse user)` (matches the shape the WebGIS client already expects — see Dev Notes → Previous Story Intelligence), `UserProfileResponse(String userId, String fullName, String email, String role, String phoneNumber)`.
  - [x] 2.2 **Fix the `User.role` enum/column type mismatch before anything else can insert a row** (see Dev Notes → Critical Guardrail: this is the #1 way this story silently breaks). `core_schema.users.role` is a native Postgres enum `core_schema.user_role` (`'admin'|'officer'|'citizen'`), but `User.java` maps `role` as a plain `@Column(name = "role") private String role`. Hibernate will throw `PSQLException: column "role" is of type core_schema.user_role but expression is of type character varying` on insert unless the column mapping is fixed. Recommended fix for Hibernate 6.4 (bundled with Spring Boot 3.2.4): annotate the field with `@JdbcTypeCode(org.hibernate.type.SqlTypes.NAMED_ENUM)` and `columnDefinition = "core_schema.user_role"`, keeping `role` as a Java enum (`public enum UserRole { admin, officer, citizen }`) or as `String` with `@JdbcTypeCode(SqlTypes.NAMED_ENUM)` (Hibernate 6 supports native-enum binding for both). If that path proves unreliable at runtime, fall back to the pattern this codebase already uses in `SpatialRepository` (native SQL with explicit `CAST(? AS core_schema.user_role)`) via a custom `@Query` or JDBC insert in `AuthService` — do not merge this story with an untested enum mapping.
  - [x] 2.3 Add `UserRepository.findByEmail(String email)` and `existsByEmail(String email)` — **both already exist**, do not re-add.
  - [x] 2.4 Implement `AuthService`: `register(RegisterRequest)` → reject if `existsByEmail` (throw a mapped exception → 409), hash password with `BCryptPasswordEncoder` (already available via `spring-boot-starter-security`; register it as a `@Bean` if not already present), force `role = "citizen"`, save, return `AuthResponse`. `login(LoginRequest)` → load by email, `passwordEncoder.matches()`, on failure throw 401 (generic "invalid credentials", not "user not found" vs "wrong password" — avoid email enumeration). `getCurrentUser(UUID userId)` → load and map to `UserProfileResponse`, throw 401/404 appropriately if missing.
- [x] **Task 3: AuthController, JwtAuthenticationFilter & SecurityConfig wiring** (AC: #2, #3, #4)
  - [x] 3.1 Create `AuthController` (`@RequestMapping("/api/v1/auth")`) exposing `POST /register`, `POST /login`, `GET /me`. Follow this project's controller style (constructor injection, `@Tag`/`@Operation` Swagger annotations like every existing controller) — see `NotificationController`/`CommunityReportController` for the pattern.
  - [x] 3.2 Implement `JwtAuthenticationFilter extends OncePerRequestFilter`: read `Authorization: Bearer <token>`, validate via the token provider, on success set `SecurityContextHolder` with a principal carrying `userId`/`role` (e.g. `UsernamePasswordAuthenticationToken` with a `GrantedAuthority` of `ROLE_<role_upper>`), on failure/absence just continue the chain unauthenticated (let Spring Security's `authorizeHttpRequests` decide 401 vs permit).
  - [x] 3.3 Update `SecurityConfig.securityFilterChain`: register the filter via `.addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class)`, and add explicit matchers so `/api/v1/auth/register` and `/api/v1/auth/login` stay `permitAll()` while `/api/v1/auth/me` requires `authenticated()` — **placed before** the existing `.requestMatchers("/api/v1/**").permitAll()` rule (Spring Security evaluates matchers in declaration order; the more specific rule must come first). Leave every other existing route's access rule untouched (AC4).
  - [x] 3.4 Add a `@RestControllerAdvice` (or extend one if it already exists — it doesn't yet) to map: email-already-exists → 409, bad credentials → 401, validation errors (`@Valid` on DTOs) → 400, so these don't leak as raw 500s with stack traces.
- [x] **Task 4: Verification**
  - [x] 4.1 Verify registration with a duplicate email returns 409 and does not create a second row.
  - [x] 4.2 Verify login with correct and with incorrect credentials (wrong password, nonexistent email) both return 401 without revealing which part was wrong.
  - [x] 4.3 Verify `GET /api/v1/auth/me` with a valid JWT returns the profile with no `passwordHash`, and returns 401 with no/garbage token.
  - [x] 4.4 Verify a forced-citizen register (submit `role: "admin"` in the body) still creates a `citizen` row — confirms AC1's role-forcing guard.
  - [x] 4.5 Smoke-test against the seeded V2 users (`admin@terrawatch.vn`, `officer.yenbai@terrawatch.vn`, `citizen.limmong@terrawatch.vn`) — **do not know their plaintext password**; this only confirms the stored BCrypt hash format is 60-char `$2b$10$...` (bcrypt-compatible) and that `login` can validate against pre-existing hashes, not that you know the password (ask the user if a demo password needs to be established/documented).
  - [x] 4.6 Confirm none of the previously-shipped unauthenticated routes (`/api/v1/landslides/**`, `/api/v1/community-reports`, `/api/v1/monitoring-areas`, `/api/v1/notifications/broadcast`) started requiring auth as a side effect of the SecurityConfig change.

### Review Findings

- [x] [Review][Patch] No minimum password length — `RegisterRequest.password` only enforces `@NotBlank @Size(max = 72)` (the BCrypt byte-length ceiling); a one-character password is accepted and hashed. **Resolved by user 2026-10-15: add `@Size(min = 8, max = 72)`, no complexity/character-class requirement.** Applied. [`services/core-api/src/main/java/vn/terrawatch/core/dto/RegisterRequest.java:12`]
- [x] [Review][Patch] Email is not case-normalized before dedupe/login lookup — fixed via a private `normalizeEmail()` (`.trim().toLowerCase(Locale.ROOT)`) applied before every `existsByEmail`/`findByEmail`/`saveAndFlush` call. [`services/core-api/src/main/java/vn/terrawatch/core/service/AuthService.java`]
- [x] [Review][Patch] `BCryptPasswordEncoder.matches()` could throw an uncaught `IllegalArgumentException` on a malformed stored hash — fixed by wrapping the `matches()` call and treating any `IllegalArgumentException` as a non-match (falls through to the same 401). [`services/core-api/src/main/java/vn/terrawatch/core/service/AuthService.java`]
- [x] [Review][Patch] `AuthExceptionHandler.authError` could NPE via `Map.of` when `ResponseStatusException.getReason()` is null — fixed with a null-coalescing fallback to `"Error"`. [`services/core-api/src/main/java/vn/terrawatch/core/controller/AuthExceptionHandler.java:16`]
- [x] [Review][Patch] No validation that `user.getRole()` is one of `citizen`/`officer`/`admin` before issuing a token or building a profile — fixed with a `requireKnownRole()` guard (via the new `Role` enum) called from both `response()` and `profile()`, covering register/login/me; rejects with 500 instead of issuing a token for an invalid-role row. [`services/core-api/src/main/java/vn/terrawatch/core/service/AuthService.java`]
- [x] [Review][Patch] Role allowlist duplicated as a literal instead of a single source of truth — fixed by introducing `vn.terrawatch.core.security.Role` (enum `CITIZEN`/`OFFICER`/`ADMIN` with `dbValue()`/`fromDbValue()`) as the one place the three role names live; `JwtAuthenticationFilter` and `AuthService` both now go through it instead of a hand-copied list/literal. [`services/core-api/src/main/java/vn/terrawatch/core/security/Role.java` (new), `JwtAuthenticationFilter.java:32-39`]
- [x] [Review][Patch] Unnecessary UUID string round-trip — fixed: `AuthController.me` now reads `(UUID) authentication.getPrincipal()` directly instead of `UUID.fromString(authentication.getName())`. [`services/core-api/src/main/java/vn/terrawatch/core/controller/AuthController.java:39-41`]
- [x] [Review][Patch] `docker-compose.yml`'s `JWT_SECRET: ${JWT_SECRET}` had no fallback default — fixed with Compose's required-variable syntax `${JWT_SECRET:?JWT_SECRET must be set...}`, so a missing secret now fails with a readable message at compose-parse time instead of a confusing `WeakKeyException` at JVM startup. [`docker-compose.yml:43`]

All 8 patches verified by an actual Dockerized `mvn test` run against the live Postgres test DB (not just re-reading the diff): **Tests run: 15, Failures: 0, Errors: 0 — BUILD SUCCESS** (2026-10-15).
- [x] [Review][Defer] `.env.example`/root `.env` ship a real, non-placeholder `JWT_SECRET` default meant to be copied verbatim (`cp .env.example .env`, per the file's own header comment) [`services/core-api/.env.example:21`, `.env.example:22`] — deferred, pre-existing file (added in commit `4af1cfb`, before this story's `baseline_commit`), not touched by this diff. Flagged because this story is what makes JWT signing load-bearing for the first time: anyone who copies the example verbatim into a shared/demo deployment ships a publicly-known signing key, letting anyone who has seen the repo forge a valid `admin` JWT against it. `.env` itself is gitignored, so no live secret is committed — the risk is purely "default never rotated by whoever deploys it."
- [x] [Review][Defer] Stateless JWT has no revocation/blacklist/refresh mechanism — deferred, inherent to the stateless-JWT architecture this story was scoped to deliver (`JwtAuthenticationFilter` trusts the `role` claim baked in at issuance; `/me` re-reads the DB but authorization itself doesn't). A demoted/banned user's token stays valid up to `JWT_EXPIRATION_MS` (24h default). Not a defect in this diff; would need a dedicated token-revocation story.
- [x] [Review][Defer] CORS allows `allowCredentials(true)` with `allowedOriginPatterns(List.of("*"))` [`services/core-api/src/main/java/vn/terrawatch/core/config/SecurityConfig.java` — `corsConfigurationSource()`] — deferred, pre-existing and untouched by this diff, now more consequential since a real bearer token exists to steal.

**Dismissed as noise (reviewed, not actionable):**
- jjwt's 3 artifacts (`jjwt-api`/`jjwt-impl`/`jjwt-jackson`) pinned to a literal version with no Maven BOM — stylistic, consistent with this `pom.xml`'s existing non-BOM convention for other multi-artifact deps (e.g. springdoc).
- "`email`/`role` claims are unused PII in the JWT" — inaccurate: `JwtAuthenticationFilter.java:33` actively validates `email` as a required non-blank claim before accepting a token; it's not dead weight.
- "`claims.getExpiration() == null` check is dead code since jjwt already throws on expiry" — incorrect: jjwt's default parser does not require an `exp` claim to be present and won't reject a signed token that simply omits one; this check is a real, reachable guard against such a token, not a no-op.
- "JWT plumbing doesn't gate any other endpoint" — by design, per AC4's explicit instruction not to expand `SecurityConfig` beyond `/me`; confirmed correct, not a defect.
- "`User.role`'s `@ColumnTransformer` CAST should be `@JdbcTypeCode(SqlTypes.NAMED_ENUM)` instead" — this is the story's own pre-authorized fallback (Dev Notes named this exact CAST pattern as the fallback if `NAMED_ENUM` proved unreliable), and it's proven correct end-to-end by passing tests across all 3 roles; not worth unwinding a verified-working choice for a theoretically cleaner but unverified one.

## Dev Notes

### Critical Guardrail: `User.role` enum mismatch (read before coding)

`services/core-api/src/main/java/vn/terrawatch/core/entity/User.java` currently maps `role` as:
```java
@Column(name = "role")
private String role; // admin, officer, citizen
```
But the actual column (`V1__init_postgis_schema.sql:48-58`) is:
```sql
role core_schema.user_role DEFAULT 'citizen',
```
with `core_schema.user_role` a native Postgres `ENUM('admin','officer','citizen')`. Plain JPA/Hibernate writes a `String` as `varchar`, which Postgres's JDBC driver will reject against a custom enum column unless the parameter is explicitly cast. This has evidently never been exercised yet — `User` is only ever read via `UserRepository` in the current codebase, never written by the application (only by the `V2` seed SQL, which runs as raw SQL and is unaffected). **This story is the first code path that inserts a `User` row**, so this bug has been dormant. Fix it as part of Task 2.2, and prove it with an actual insert (Task 4.1) before considering the story done — do not assume the JPA annotation works without testing it end to end.

### Architecture Compliance

- **Spring Security route rule (AC4):** `SecurityConfig.java` currently has `.requestMatchers("/api/v1/**").permitAll()` covering *everything*, including `LandslideEventController`, `CommunityReportController`, `MonitoringAreaController`, `NotificationController`, `DiagnosticController` — all shipped and working in already-`done` Stories 1.2/4.2/4.3/4.4 without any client sending a JWT. Narrowing security to `.anyRequest().authenticated()` would break all of those overnight since no existing caller attaches a token to those routes. This story must add JWT **only** for the new `/api/v1/auth/me` route (and keep `/register`, `/login` public) without touching the blanket permissive rule for the rest. Full RBAC enforcement across the other controllers is a larger, separate effort not covered by this story's ACs — flag it, don't silently expand scope to "fix" it.
- **Gateway routing gap (do not fix in this story, but be aware):** `gateway/nginx.conf` has explicit `location` blocks for `/api/v1/landslides`, `/api/v1/areas`, `/api/v1/reports`, `/api/v1/alerts`, and a catch-all `/api/v1/core/` (which strips the `/core` prefix) — but **no explicit `/api/v1/auth/` location**. The WebGIS client (`apps/webgis/.env.example`: `VITE_API_BASE_URL=http://localhost:8080`, i.e. through the gateway) calls `POST {gateway}/api/v1/auth/login` directly (not `/api/v1/core/auth/login`), which today falls through to the final catch-all `location /` (SPA fallback to the `webgis` container) rather than reaching `core-api`. Gateway routing is explicitly Story 1.3's scope (`backlog`, sprint key `1-3-api-gateway-reverse-proxy-rate-limiting`) — do not add an nginx route as part of this story. For integration verification, call Core API directly (`http://localhost:3000/api/v1/auth/...`) or run WebGIS against `VITE_API_BASE_URL=http://localhost:3000` locally; note in your completion notes that end-to-end-through-the-gateway auth is blocked on Story 1.3.
- **WebGIS already assumes a response shape** (Dev Notes → Previous Story Intelligence below) — match it exactly; don't invent a different JSON contract.
- **Password hashing:** `spring-boot-starter-security` (already a dependency) brings `BCryptPasswordEncoder` on the classpath; no new dependency needed for hashing, only for JWT (Task 1.1).
- **UUID primary key:** `User.userId` is `UUID` generated via `GenerationType.AUTO` (Hibernate will use Postgres's `uuid_generate_v4()` default per the DDL — confirm the generated value round-trips correctly when returned in `AuthResponse`/`UserProfileResponse`, since it must serialize as a string, not a Java object dump).
- **Migrations:** `services/core-api/src/main/resources/db/migration/` is the Flyway-managed copy (`spring.flyway.locations: classpath:db/migration`); `database/migrations/` is a second on-disk copy and **already differs** (`V3` files differ between the two directories per inspection — a pre-existing drift issue, not something to fix here). This story needs **no new migration** — `core_schema.users` already exists. If you do need a migration for any reason, add it only under `services/core-api/src/main/resources/db/migration/` as `V4__*.sql` and mention the `database/` copy drift to the user rather than silently reconciling it (out of scope).

### Library / Framework Requirements

- **jjwt 0.12.6** (`jjwt-api`, `jjwt-impl`, `jjwt-jackson`) — current stable 0.12.x line as of this writing; do not use the legacy single-artifact `io.jsonwebtoken:jjwt` (pre-0.10, different API: `Jwts.builder().setSubject()` instead of 0.12.x's `Jwts.builder().subject()`/claims-based builder). Double-check the exact fluent method names against the version actually resolved in `pom.xml` at implementation time — 0.11.x → 0.12.x renamed several builder methods.
- **Spring Boot 3.2.4 / Spring Security 6.x** — already pinned in the parent POM; no version change needed.
- **BCrypt** — via `org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder`, already on the classpath.

### File Structure Requirements (new files, following existing package conventions)

- `vn.terrawatch.core.dto.RegisterRequest` / `LoginRequest` / `AuthResponse` / `UserProfileResponse` (records, alongside existing DTOs)
- `vn.terrawatch.core.service.AuthService`
- `vn.terrawatch.core.controller.AuthController`
- `vn.terrawatch.core.security.JwtTokenProvider` (or `JwtService`) and `JwtAuthenticationFilter` (new `security` package — doesn't exist yet, first use)
- Modify: `vn.terrawatch.core.entity.User` (fix role mapping), `vn.terrawatch.core.config.SecurityConfig` (add filter + matchers), `pom.xml` (jjwt deps), `application.yml` (jwt.secret/expiration properties)

### Testing Standards Summary

No test infrastructure exists yet in `services/core-api` beyond the `spring-boot-starter-test` dependency (no test files currently present in the module). This story should add focused tests for the new auth flow (e.g. `AuthControllerTest`/`AuthServiceTest` using `@SpringBootTest` or `MockMvc` + mocked repository) covering: duplicate-email 409, wrong-password 401, missing-token-on-`/me` 401, valid-token-`/me` 200 without `passwordHash`, and forced-citizen-role-on-register. **CI note:** `.github/workflows/ci-core-api.yml` only runs `mvn clean compile -B` (compile check, not `test`) — passing CI does not prove the auth flow actually works; run tests locally/manually before marking done. Maven is not installed in this execution environment (only a JDK is present) — use the project's own build tooling (IDE, or install Maven) to actually run `mvn test`.

### Git Intelligence Summary

Last 5 `core-api`-touching commits: `469bd7d` (rainfall/terrain ingestion + mobile setup), `4af1cfb` (added `.env.example`), `8a6b9a8` (gateway + Resilience4j + Redis event bus), `8ca4cd6` (schema-per-service: `core_schema`/`gis_schema` split), `9322d7e` (docs/API spec + Flyway CLI migrations). None of these touched auth — this is genuinely the first implementation of the auth slice beyond the `SecurityConfig` skeleton and `User` entity/repository stubs that already exist. Established conventions to follow: DTOs as Java `record`s, constructor injection (no field `@Autowired`), Swagger `@Tag`/`@Operation` on every controller method, services returning `Map<String, Object>` in some places (`LandslideEventService`) but this story should prefer typed DTOs (`AuthResponse`) since the WebGIS client already parses typed fields (`data.token`, `data.role`, `data.user`).

### Previous Story Intelligence

No prior story exists in Epic 1 (this is Story 1.1, the first). However, **later-shipped stories already assume this story's contract**, discovered by reading forward:
- `apps/webgis/src/api/authApi.js` + `src/context/AuthContext.jsx` (built under Story 4.2, already `done`) call `POST /auth/login` and expect a response shaped `{ token, role, user: { id/fullName/email/role, ... } }` (`AuthContext.jsx`: `data.token || data.accessToken`, `data.user`, `data.role`). It stores the token as `terrawatch_token` and auto-attaches `Authorization: Bearer <token>` via an Axios interceptor (`axiosClient.js`) to every request, and force-redirects to `/login` on any `401`.
- `LoginPage.jsx` calls `authApi.registerCitizen(...)` → `POST /auth/register` with an explicit `role: 'citizen'` in the body — consistent with AC1 forcing citizen, but confirms the client doesn't rely on the server rejecting a non-citizen role, it just never sends one for this flow.
- The WebGIS client has a **graceful offline/mock fallback** (`authApi.login` catches network errors and fabricates a mock JWT + role by sniffing the email string for "officer") — this is dev-mode convenience code in the frontend, not something the backend needs to support or match; don't let it mislead you into thinking a malformed/fake token should be accepted by the Core API.
- `authApi.registerOfficerRequest` (`POST /auth/register-officer-request`) is called by the officer-signup UI flow but **is not in this story's ACs** — it has its own client-side mock fallback and is presumably intended for a future admin-approval story. Do not implement it as part of 1.1; if the user wants it in scope, that's a scope question (see Open Questions).

### Latest Tech Info

- jjwt 0.12.x is the current stable line (0.12.6 at time of writing); 0.12.x requires Java 8+ and uses a different fluent builder API than 0.9.x/0.10.x (method renames like `setSubject`→`subject`, `parserBuilder()`→`parser()`). Confirm exact method names against whatever 0.12.x patch Maven actually resolves, since minor API shifts have occurred within the 0.12 line.
- Hibernate 6 (bundled with Spring Boot 3.2.4) added native support for binding Java enums directly to Postgres enum columns via `@JdbcTypeCode(SqlTypes.NAMED_ENUM)` — this is the modern replacement for the older `@TypeDef`/custom `UserType` workarounds and is the recommended fix for the `User.role` mismatch (Task 2.2).

### Project Context Reference

- [PRD §2](../planning-artifacts/prd.md) — roles: admin/officer/citizen, admin manages users/AOIs and sends warnings, officer reviews, citizen subscribes/reports.
- [Architecture §6](../planning-artifacts/architecture.md) — "Target: admin config/broadcast, officer/admin review, citizens access published approved forecasts... Internal ingestion/inference is service-authenticated and not publicly writable" — full RBAC enforcement across those routes is a target state this story starts but does not complete.
- [Epics — Story 1.1](../planning-artifacts/epics.md) — "Keep the existing ready-for-dev story; align route checks with new forecast endpoints" (this revision superseded the original thin draft; forecast-route alignment itself is Epic 3/4 work, not this story).
- [Sprint change proposal 2026-10-13](../planning-artifacts/sprint-change-proposal-2026-10-13.md) — "1.1 | N/A — stakeholder pivot, not a failing implementation story" and "1.1 | Auth/JWT retained; existing ready-for-dev story retained" — confirms this story's scope is unchanged by the rainfall/terrain pivot.

### Open Questions (for the user, not blocking ready-for-dev)

1. AC1 says "Only admin may assign officer/admin roles" but defines no endpoint for that — should this story add an authenticated admin-only `POST /api/v1/auth/users` (or similar) to create officer/admin accounts, or is that deferred to a later story (e.g. the officer-approval flow the WebGIS `register-officer-request` UI already anticipates)?
2. Is a known demo password needed for the three seeded V2 users (admin/officer/citizen) for manual/demo verification? The seeded `password_hash` is a valid bcrypt hash but its plaintext isn't recorded anywhere in the repo.

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

- Red: `JwtTokenProviderTest` failed compilation before the token provider existed; green: 2 tests passed on Java 17.
- Red: `AuthServiceTest` failed compilation before the DTOs/service existed; green: 6 JWT/service tests passed.
- Persistence gate: 8 tests passed after Flyway V1-V3 migrated the dedicated `auth_story_1_1_test` PostgreSQL/PostGIS database. JPA inserts and reads all three native enum values and generated UUIDs.
- Red: HTTP auth tests returned 404 before controller/filter wiring; green: all 15 tests passed, including the existing public API/docs regression checks.
- Reports: `services/core-api/target/surefire-reports/`. Integration test methods roll back their writes; application database and seeded passwords were not changed.
- Runtime tooling: Maven 3.9 / Java 17 Docker image, cache volume `auth-story-1-1-maven-cache`; dedicated test database created with `docker exec terrawatch-postgis createdb -U postgres auth_story_1_1_test`.
- Repeat the complete build/test gate from the repository root:

```powershell
docker run --rm --network secapstone_terrawatch-net -v auth-story-1-1-maven-cache:/root/.m2 -v D:/SECapstone/services/core-api:/workspace -w /workspace maven:3.9-eclipse-temurin-17-alpine mvn -B -ntp '-DAUTH_TEST_DATABASE_URL=jdbc:postgresql://terrawatch-postgis:5432/auth_story_1_1_test' verify
```

- For local Maven, create the same dedicated database and run `mvn -f services/core-api/pom.xml verify`; override `AUTH_TEST_DATABASE_URL`, `AUTH_TEST_DB_USER`, and `AUTH_TEST_DB_PASSWORD` if needed. Test configuration deliberately does not inherit the application's `DATABASE_URL`.
- Verified jjwt fluent APIs against the [0.12.6 README](https://github.com/jwtk/jjwt/blob/0.12.6/README.adoc).

### Completion Notes List

- Final completion gate: `mvn verify` succeeded on Java 17; 15 tests, 0 failures/errors/skips, executable Spring Boot JAR packaged. All 21 task/subtask checkboxes are checked; AC1-AC5 satisfied. Story and sprint tracking are ready for review.

- Implemented citizen-only registration (201), role-preserving login, and JWT-authenticated profile retrieval with the existing response contract, User entity, UserRepository, and BCrypt dependency. Both phone naming conventions are accepted.
- Kept `User.role` as String and bound writes using Hibernate `@ColumnTransformer` with an explicit `CAST(? AS core_schema.user_role)`; actual PostgreSQL tests prove insertion/readback without a new enum class, repository layer, or migration.
- Registration handles existing/concurrently registered email as 409 using the existing unique constraint; invalid login returns the same generic 401 for unknown email/wrong password. A dummy BCrypt comparison avoids skipping hashing for unknown users. Validation enforces database field lengths and BCrypt's 72 UTF-8 byte limit.
- JWT identity includes UUID subject, email, role, issued-at, and expiration. Filter rejects expired, tampered, unsigned, wrong-key, malformed, and incomplete identities. Missing/deleted users return 401. Only `/api/v1/auth/me` adds an authenticated route before the existing permissive `/api/v1/**` rule.
- Password/hash fields are excluded from JSON; request records redact passwords in `toString`; auth error handlers return controlled messages without rejected input. Tests disable MockMvc request dumps.
- Existing landslide queue/active, community-report listing, monitoring-area listing, notification broadcast, and Swagger/docs routes remain public, including requests carrying invalid bearer tokens.
- V2 admin/officer/citizen seed hashes are 60-character `$2b$10$` values; BCrypt compatibility and all three login roles are tested with known test-only hashes. No demo password was guessed, reset, or documented.
- Added only the specified jjwt 0.12.6 dependencies. Core API Compose configuration now passes `JWT_SECRET` and `JWT_EXPIRATION_MS` from the environment; no other service configuration changed. `docker compose config --quiet` and `git diff --check` passed (Compose's existing obsolete-version warning remains).
- Gateway auth routing remains Story 1.3 scope: use Core API directly on port 3000, or set WebGIS `VITE_API_BASE_URL=http://localhost:3000`; auth through the gateway is still blocked on Story 1.3. Officer/admin provisioning and officer signup approval remain out of scope.
- Unrelated concurrent changes to Story 1.2 and `database/seed_v3_fixtures.sql` were left untouched.

### File List

- `_bmad-output/implementation-artifacts/1-1-multi-role-user-registration-authentication-register-login-jwt.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `docker-compose.yml`
- `services/core-api/pom.xml`
- `services/core-api/src/main/resources/application.yml`
- `services/core-api/src/main/java/vn/terrawatch/core/config/SecurityConfig.java`
- `services/core-api/src/main/java/vn/terrawatch/core/entity/User.java`
- `services/core-api/src/main/java/vn/terrawatch/core/dto/RegisterRequest.java`
- `services/core-api/src/main/java/vn/terrawatch/core/dto/LoginRequest.java`
- `services/core-api/src/main/java/vn/terrawatch/core/dto/AuthResponse.java`
- `services/core-api/src/main/java/vn/terrawatch/core/dto/UserProfileResponse.java`
- `services/core-api/src/main/java/vn/terrawatch/core/service/AuthService.java`
- `services/core-api/src/main/java/vn/terrawatch/core/controller/AuthController.java`
- `services/core-api/src/main/java/vn/terrawatch/core/controller/AuthExceptionHandler.java`
- `services/core-api/src/main/java/vn/terrawatch/core/security/JwtTokenProvider.java`
- `services/core-api/src/main/java/vn/terrawatch/core/security/JwtAuthenticationFilter.java`
- `services/core-api/src/test/resources/application.properties`
- `services/core-api/src/test/java/vn/terrawatch/core/security/JwtTokenProviderTest.java`
- `services/core-api/src/test/java/vn/terrawatch/core/service/AuthServiceTest.java`
- `services/core-api/src/test/java/vn/terrawatch/core/repository/UserPersistenceTest.java`
- `services/core-api/src/test/java/vn/terrawatch/core/controller/AuthControllerTest.java`

## Change Log

- 2026-10-15: Implemented Story 1.1 auth/JWT within Core API, fixed PostgreSQL enum writes, added focused unit/database/HTTP verification and Core API JWT environment wiring; preserved existing public routes and gateway scope.
