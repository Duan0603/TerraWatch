---
baseline_commit: 5264248031277bbfdbd92225727687040f696faa
---
# Story 1.3: Gateway routing and access

Status: done

## Story

As a client (WebGIS, Mobile, or an external integrator),
I want to reach every Core API capability consistently through the single gateway entry point (port 8080),
so that I never have to special-case "go direct to port 3000" and so that auth, CORS, and rate limiting are applied uniformly regardless of which route I call.

**Epic:** Epic 1: Foundation, identity and forecast data contracts
**Sprint key:** `1-3-api-gateway-reverse-proxy-rate-limiting`
**Target:** `gateway/nginx.conf` (Nginx reverse proxy, port 8080 → core-api:3000 / ai-service:8001 / gis-service:8002 / webgis:80)
**Owner (per epics.md):** Thuận

## Acceptance Criteria

1. **AC1 — Explicit routing, no silent 401s:** Every real Core API controller route is reachable through the gateway with its actual path preserved (no route returns 401/404 due to a gateway prefix-rewrite mismatch). `/api/v1/forecasts` is *not* added yet — no controller implements it (Epic 3/4 scope) — adding a route to a non-existent endpoint would be routing to nothing; when that controller lands, add its location using the same pattern this story establishes. Verify by testing the **same request** both directly against `core-api:3000` and through the gateway at `:8080` and confirming identical success/failure behavior (modulo CORS, which only applies browser-side).
2. **AC2 — CORS has exactly one source of truth per response, and rate limiting is applied consistently:** No response ever carries two `Access-Control-Allow-Origin` values (browsers reject that outright). Every `/api/v1/*` location — not just the ones already covered — has an explicit `limit_req zone=api_limit` (or a documented, deliberate exception, e.g. tile caching).
3. **AC3 — No gateway-level route exposes a mutation endpoint without the authorization core-api already enforces:** The gateway does not accidentally bypass or weaken what Spring Security already checks (e.g. must not strip the `Authorization` header, must not cache a response that varies by caller identity). Gateway-level authorization/rate-limit tuning for admin-only or service-to-service routes is additive to core-api's own enforcement, not a replacement for it (see Dev Notes → Architecture Compliance for why re-implementing RBAC in Nginx is explicitly out of scope here).

## Tasks / Subtasks

- [x] **Task 1: Fix the two confirmed, never-worked path mismatches** (AC: #1)
  - [x] 1.1 `location /api/v1/areas` proxies to `core_api_upstream/api/v1/areas` — **no controller is mapped at `/api/v1/areas`**; the real controller is `MonitoringAreaController` at `/api/v1/monitoring-areas` (`services/core-api/src/main/java/vn/terrawatch/core/controller/MonitoringAreaController.java:14`). Rename the location to `/api/v1/monitoring-areas` and fix the `proxy_pass` target to match. This route has **never actually worked** through the gateway (confirmed: no path produces anything but 404, since nothing has ever called `/api/v1/areas`).
  - [x] 1.2 `location /api/v1/reports` proxies to `core_api_upstream/api/v1/reports` — real controller is `CommunityReportController` at `/api/v1/community-reports` (`CommunityReportController.java:14`). Same fix: rename location + `proxy_pass` target to `/api/v1/community-reports`.
  - [x] 1.3 `location /api/v1/alerts` proxies to `core_api_upstream/api/v1/alerts` — **no controller is mapped at `/api/v1/alerts`** at all; the closest real controller is `NotificationController` at `/api/v1/notifications` (`NotificationController.java:13`, currently only `POST /broadcast`). Rename location + `proxy_pass` target to `/api/v1/notifications`.
  - [x] 1.4 Add a `location /api/v1/diagnostic` block for `DiagnosticController` (`/api/v1/diagnostic`) — currently has **no gateway route at all** (falls through to the webgis SPA fallback). Low priority (demo/diagnostic endpoint only, not a client-facing feature), but still "explicit routing" per AC1 — include it for completeness, same pattern as the others.
- [x] **Task 2: Fix the CORS double-header bug on the two remaining proxy groups** (AC: #2)
  - [x] 2.1 **Context you must know before touching this:** this exact bug class (nginx's blanket `add_header 'Access-Control-Allow-Origin' '*' always;` at the server block + the proxied service's *own* CORS middleware both firing on the same response → browser sees `"http://localhost:5173, *"` and rejects the response outright) was found and fixed **live, during Story 1.1's review**, for every location proxying to `core_api_upstream` (`/api/v1/core/`, `/api/v1/auth/`, `/api/v1/landslides`, `/api/v1/monitoring-areas`, `/api/v1/community-reports`, `/api/v1/notifications` — all already have `proxy_hide_header Access-Control-Allow-Origin;` + `proxy_hide_header Access-Control-Allow-Credentials;`). **It was never applied to `/api/v1/ai/` or `/api/v1/gis/`.**
  - [x] 2.2 Confirmed by reading the actual service code (not assumed): both `services/ai-service/app/main.py` and `services/gis-service/app/main.py` register `CORSMiddleware` with `allow_origins=["*"]` (`app.add_middleware(CORSMiddleware, allow_origins=["*"], ...)`). This is the **identical bug pattern** — add the same two `proxy_hide_header` lines to `location /api/v1/ai/` and `location /api/v1/gis/`. Verify live with a real cross-origin request (see Dev Notes → Testing) — don't just infer it from matching code patterns, the Story 1.1 bug looked "obviously fine" from the nginx config alone until an actual browser request exposed it.
  - [x] 2.3 `location /api/v1/tiles/` has no `limit_req` at all (every other `/api/v1/*` location does). If this is deliberate (tile requests are cached, high-volume, read-only vector tiles — rate limiting them like mutation-capable API calls may be wrong), document that reasoning in a comment instead of silently leaving it inconsistent; if it's an oversight, add `limit_req zone=api_limit burst=30 nodelay;` matching the sibling `/api/v1/gis/` block.
- [x] **Task 3: Verify no regression on the already-fixed routes, and confirm end-to-end** (AC: #1, #2, #3)
  - [x] 3.1 Re-run the direct-vs-gateway comparison for `/api/v1/auth/login`, `/api/v1/auth/me`, `/api/v1/core/landslides/active`, `/api/v1/landslides/queue`, `/api/v1/notifications/broadcast` (admin token required — see Story 1.1) to confirm Task 1/2's changes didn't disturb them.
  - [x] 3.2 Confirm `monitoring-areas` and `community-reports` now actually return data through the gateway (they never did before this story — don't just check for "not 404", check the response body is the real JSON list, same as calling core-api directly on :3000).
  - [x] 3.3 Confirm rate limiting still triggers (burst exceeded → `503`/`429` per nginx's `limit_req` default) on at least one of the newly-fixed routes, proving `limit_req zone=api_limit` is actually wired, not just present in the config file.

### Review Findings

- [x] [Review][Patch] `DiagnosticController` was publicly reachable through the gateway with no authentication gate — `location /api/v1/diagnostic` was added (Task 1.4) with no matching rule in `SecurityConfig.java`, so it fell under the blanket `.requestMatchers("/api/v1/**").permitAll()`. Previously it had no gateway route at all (internal-network-only), so this story made it internet-reachable for the first time. **Resolved by user 2026-10-15: require authentication (any role).** Applied: `.requestMatchers("/api/v1/diagnostic/**").authenticated()` added to `SecurityConfig.java`, ordered before the blanket permitAll rule. [`services/core-api/src/main/java/vn/terrawatch/core/config/SecurityConfig.java`]
- [x] [Review][Patch] `Access-Control-Allow-Credentials` was stripped via `proxy_hide_header` on every core-api-proxied location (and at server level) but never re-added — core-api's own `SecurityConfig.corsConfigurationSource()` sets `config.setAllowCredentials(true)` (`SecurityConfig.java:69`). Fixed: added `add_header 'Access-Control-Allow-Credentials' 'true' always;` at server level. Verified live: `curl -D - ... -H "Origin: http://localhost:5173"` to `/api/v1/auth/login` now returns exactly one `Access-Control-Allow-Origin: *` and one `Access-Control-Allow-Credentials: true`. [`gateway/nginx.conf`]
- [x] [Review][Patch] 18 lines of redundant `proxy_hide_header Access-Control-Allow-Origin;` / `-Credentials;` across all 9 proxying locations — live-verified dead code (inherited correctly from `server` level). Fixed: deleted all 18 location-level lines, kept only the server-level pair, added a comment explaining the inheritance so it isn't "fixed" back in by a future editor. Re-verified live after rebuild: single clean ACAO/ACAC headers on `/api/v1/auth/login` and single ACAO on `/api/v1/gis/mvt/0/0/0.pbf`; `nginx -t` passed; full regression (`/api/v1/monitoring-areas` → 200, `/api/v1/core/landslides/active` → 200, admin broadcast → 200) unaffected. [`gateway/nginx.conf`]
- [x] [Review][Patch] Stale comment on `location /api/v1/auth/` claiming "Full gateway policy ... remains Story 1.3's scope" — Story 1.3 is complete and added no auth-specific throttling. Fixed: comment rewritten to state the final, shipped reality (shared `burst=20`, no special throttling was found necessary). [`gateway/nginx.conf`]
- [x] [Review][Defer] Server-level `if ($request_method = 'OPTIONS') { return 204; }` runs in the rewrite phase, before any location's `limit_req` (access phase) applies — OPTIONS preflights are completely unthrottled regardless of per-location `burst=` values. Pre-existing (this exact block predates Story 1.3's diff), not introduced by this story.
- [x] [Review][Defer] All `/api/v1/*` locations share one `limit_req_zone $binary_remote_addr zone=api_limit:10m rate=50r/s` bucket keyed only on client IP — heavy traffic to one location (e.g. `/api/v1/gis/` at `burst=30`) can exhaust the shared bucket and 503 an unrelated request to a different location (e.g. `/api/v1/auth/` at `burst=20`) whose own burst was never approached. Pre-existing zone definition and sharing pattern, not introduced by this story.
- [x] [Review][Defer] Trailing-slash-less prefix locations (`/api/v1/landslides`, `/api/v1/monitoring-areas`, `/api/v1/community-reports`, `/api/v1/notifications`, `/api/v1/diagnostic`) match by raw string prefix, not path segment — e.g. a hypothetical `/api/v1/notificationsFoo` would be captured by the `/api/v1/notifications` location instead of falling through. Pre-existing pattern (already true of `/api/v1/landslides` before this diff); this story extends the same convention to the renamed routes rather than introducing a new class of bug. No real route collides with this today.
- [x] [Review][Defer] The new `location ~ ^/api/v1/core/(.*)$` regex alias: (a) doesn't match the bare `/api/v1/core` with no trailing slash (falls to the SPA fallback, returning HTML instead of JSON/404 — the same failure mode this story fixes elsewhere, one path segment up); (b) matches against nginx's percent-decoded, normalized `$uri`, so an encoded `%2F` in the path could reshape `$1` unexpectedly; (c) doesn't normalize a double slash (`/api/v1/core//landslides`) before `proxy_pass`, which could 404 against core-api depending on its path-matching strictness. All three are low-practical-risk nginx-mechanics edge cases against a Spring Boot backend (no filesystem path handling), not reachable by any real client path today.
- [x] [Review][Defer] `/api/v1/tiles/0/0/0.pbf` has no matching GIS handler (gis-service only implements `/api/v1/gis/mvt/{z}/{x}/{y}.pbf`) and 404s on both direct and gateway calls — a pre-existing backend gap, already explicitly observed and documented by the dev's own Completion Notes ("left outside this story... No backend behavior was patched to mask these findings"), not a gateway defect this story introduced or should fix.

**Dismissed as noise (reviewed, not actionable):**
- "`/api/v1/tiles/` never got the CORS fix" — incorrect: the dev's own RED/GREEN log explicitly tested Origin-echoing on AI/GIS/tiles/api-docs/Swagger UI and confirmed exactly one ACAO after the server-level `proxy_hide_header` was added; independently re-verified live by hot-swapping a location-stripped config into the running container.
- "Renaming `/api/v1/areas`→`monitoring-areas` and `/api/v1/reports`/`/api/v1/alerts`→`community-reports`/`notifications` risks breaking a caller of the old names" — checked: no client code anywhere in `apps/webgis/src` or `apps/mobile/lib` ever called the old (always-broken) names; nothing to break.
- "No automated regression test accompanies a fix confirmed live" — the dev's Debug Log includes a documented, runnable regression script (CORS header assertions across 4 representative routes); this project has no nginx test runner by design (per this story's own Testing Requirements), so a reusable manual script is the appropriate artifact, not a gap.
- "`proxy_cache_valid 200 1h` on `/api/v1/tiles/` is a no-op since no cache zone exists" — already correctly acknowledged in-line by the dev's own comment and Completion Notes; documented, not silently hidden, and pre-existing (not introduced by this diff).
- "Dev Agent Record's Completion Notes/File List are empty" — stale: the file was updated with a full Debug Log, Completion Notes, File List and Change Log after this claim was first raised; re-verified against the current file content.
- Location-precedence concern between the new `/api/v1/core/` regex and the renamed sibling prefix locations — self-resolved by the Edge Case Hunter's own trace: the regex only matches paths literally starting with `/api/v1/core/`, which none of the renamed siblings share; no ambiguity.

## Dev Notes

### Critical Guardrail: this file was already touched mid-Story-1.1, read the current state first

`gateway/nginx.conf` is **not** in the state the original (pre-pivot) epics draft assumed. During Story 1.1's code review (2026-10-15), real, live, browser-verified bugs were found and fixed in this exact file — not as part of Story 1.3, but because Story 1.1's login flow was silently broken by them and needed to actually work. **Read the current file before changing anything** — several of what might look like "obvious gaps" are already fixed, and the inline comments in the file explain why (they reference "Story 1.1" and "confirmed live" because that's literally when/how they were found — a human watching a real browser session, not a static read of the config). Do not revert these without understanding why they're there:
- `location ~ ^/api/v1/core/(.*)$` is a **regex location**, not the simple prefix `location /api/v1/core/` it used to be — it now rewrites to `core_api_upstream/api/v1/$1$is_args$args` (preserves `/api/v1/`), not `core_api_upstream/` (which used to strip the whole prefix and forward paths with no `/api/v1/` at all — matching nothing, 401 on every call).
- `/api/v1/auth/` didn't exist before Story 1.1 at all (fell through to the SPA fallback, returning HTML instead of JSON for login).
- `proxy_hide_header Access-Control-Allow-Origin;` / `proxy_hide_header Access-Control-Allow-Credentials;` on the core-api-proxying locations are not decorative — removing them reintroduces a real, browser-confirmed CORS rejection.

### Architecture Compliance

- **Do not re-implement authorization in Nginx.** `core_schema`'s Spring Security config (`services/core-api/src/main/java/vn/terrawatch/core/config/SecurityConfig.java`) already enforces real JWT-based role authorization — as of Story 1.1, `POST /api/v1/notifications/broadcast` requires `ROLE_ADMIN` (`hasRole("ADMIN")`), verified live (citizen/officer → 403, admin → 200). AC3 ("enforce intended role/service access") is about the gateway **not undermining** that (don't strip `Authorization`, don't cache a per-caller-identity response, don't accidentally permit a method bypass), not about parsing JWTs in Nginx (would require `njs`/Lua, a second place for role logic to drift out of sync with the real source of truth in `SecurityConfig.java`, and isn't justified by anything in this story's ACs). If the user wants actual gateway-level service-to-service auth (e.g., mTLS or a shared internal token between gateway and backend services) for defense-in-depth, that's a distinct, larger architectural decision — flag it as an open question, don't invent it unprompted.
- **`/api/v1/forecasts` has no backend implementation yet.** `docs/API_SPECIFICATION.md:34` and `architecture.md:83` both say the gateway must route it, but as of this story there is no Core controller mapped at `/api/v1/forecasts` anywhere (`grep -rn "forecasts" services/core-api/.../controller/` returns nothing). Do not add a gateway location that proxies to a path with no matching controller — that's exactly the bug this story is fixing elsewhere (routes that *look* configured but 404/401 on every real call). When Epic 3/4 lands the forecasts controller, add its location using the same explicit, verified-by-direct-vs-gateway-comparison pattern this story establishes.
- **`REDIS_URL` vs `REDIS_HOST` mismatch** (`architecture.md:87`: "Current Docker Core sets REDIS_URL while Spring reads REDIS_HOST; fix this in the orchestration story") is explicitly **not this story's scope** — it's `docker-compose.yml`'s `core-api` service environment block, not `gateway/nginx.conf`, and architecture.md names a different ("orchestration") story for it. Don't fix it here even though it's adjacent; flag it to the user as still-open if it comes up, but Story 1.3 is gateway routing/CORS/rate-limiting only.
- **Mobile app:** no reference to a gateway base URL was found anywhere in `apps/mobile/lib` at the time of writing — the Flutter app likely calls services directly or doesn't have its networking layer built yet. Don't assume mobile routing requirements beyond what's verifiable; if this turns out to matter, it's a question for the user, not an assumption to encode into the gateway config.

### Library / Framework Requirements

No new dependencies. This is a pure `gateway/nginx.conf` change (Nginx config syntax only — no njs/Lua, no new Docker base image). `gateway/Dockerfile` already builds from a standard nginx image; no change needed there.

### File Structure Requirements

- Modify only: `gateway/nginx.conf`.
- No other service's files should need to change for this story. If the direct-vs-gateway comparison in Task 3 reveals that core-api itself is missing a route entirely (not just a gateway mismatch), that's a core-api story's bug, not this one's — document it as a new finding, don't silently expand scope to patch `services/core-api` from here.

### Testing Requirements

No automated test suite exists for `gateway/nginx.conf` (it's infra config, not application code with a test runner). Verification must be done by actually running the stack and issuing real requests — this project's own established pattern (used throughout Story 1.1/1.2's review) is:
1. `docker compose build gateway && docker compose up -d gateway` after every config change.
2. `curl` both `http://localhost:3000/<path>` (direct to core-api) and `http://localhost:8080/<gateway-path>` for the same logical request, comparing status codes and bodies.
3. For the CORS fix specifically, `curl -D - -o /dev/null -H "Origin: http://localhost:5173" <gateway-url>` and grep the response headers for `access-control-allow-origin` — confirm exactly **one** line, not two comma-joined values. A real browser (or Playwright) is the most trustworthy check, since this bug is specifically about what a *browser* rejects, not what `curl` complains about (curl doesn't enforce CORS at all — it will happily show you two header lines without erroring, so don't conclude "fine" from a curl exit code; read the actual header count).
4. For rate limiting, issue a tight burst of requests (e.g. `for i in $(seq 1 100); do curl -s -o /dev/null -w "%{http_code}\n" <url>; done`) against a route just fixed in Task 1 and confirm some requests get rate-limited once burst+rate is exceeded.

### Previous Story Intelligence

Story 1.2 (PostGIS schema, `done`) and Story 1.1 (multi-role auth, `done`) are both complete; neither touched `gateway/nginx.conf` except for the live mid-review fixes already described above in Critical Guardrail. There is no prior "Story 1.3 draft" to build on — this file replaces a much thinner earlier version per the epics pivot (`sprint-change-proposal-2026-10-13.md` keeps Story 1.3's sprint key and scope unchanged across the rainfall/terrain pivot).

### Git Intelligence Summary

Recent commits (`8a6b9a8` "complete enterprise microservices suite with API Gateway, Resilience4j Circuit Breaker, and Redis Event Bus") introduced `gateway/nginx.conf` in roughly its current shape — the `/api/v1/areas`/`/api/v1/reports`/`/api/v1/alerts` naming mismatches have been present since that commit and were never caught because nothing in the frontend ever actually called those exact gateway paths (WebGIS's `landslideApi.js`/`broadcastApi.js` call `/core/...` aliases instead, which is why the `/api/v1/core/` prefix bug was the one that surfaced first, in Story 1.1).

### Project Context Reference

- [Epics — Story 1.3](../planning-artifacts/epics.md#story-13-gateway-routing-and-access): "Route auth, existing incidents and new /api/v1/forecasts explicitly; test direct versus gateway paths. Enforce intended role/service access and CORS; retain rate limiting. Keep internal forecast/ingestion mutation endpoints off public unauthenticated routes."
- [Architecture §6 — API and access](../planning-artifacts/architecture.md#6-api-and-access): forecasts routing (not yet applicable — no controller), REDIS_URL/REDIS_HOST mismatch (explicitly a different story's scope), "/api/v1/core/ prefix stripping is not evidence every route works" (confirmed true — that's exactly what Story 1.1 found).
- [API Specification §2](../../docs/API_SPECIFICATION.md): "Add an explicit Core gateway location: current Nginx does not route /api/v1/forecasts" — still true, still correctly out of scope until the controller exists.
- Story 1.1 (`1-1-multi-role-user-registration-authentication-register-login-jwt.md`): source of the live-verified CORS/prefix fixes already in `gateway/nginx.conf` today; read its Dev Agent Record / Change Log for the exact sequence of bugs found if you need more context on *why* the current config looks the way it does.

### Open Questions (for the user, not blocking ready-for-dev)

1. Should the gateway add any defense-in-depth authorization of its own (e.g., a shared internal token for service-to-service calls to AI/GIS), or is core-api's existing Spring Security enforcement (plus these services not being directly internet-exposed) considered sufficient for MVP?
2. Is Mobile expected to go through the gateway (port 8080) at all, or does it call services directly? No evidence of gateway usage was found in `apps/mobile/lib` — worth confirming before assuming mobile is unaffected by this story.

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

- Activation resolved with no prepend/append steps or completion hooks; no project-context.md or AGENTS.md was found. Started from ready-for-dev with no review follow-ups.
- Task 1 RED: live requests to monitoring-areas, community-reports, notifications/broadcast, and diagnostic/circuit-breaker/gis returned gateway 404/non-JSON versus direct 200/200/401/200. GREEN: identical direct/gateway JSON and status after the routing fix; monitoring-areas returned 6 rows and community-reports returned 4 rows.
- Task 2 RED: Origin `http://localhost:5173` produced two ACAO headers (`http://localhost:5173` and `*`) on AI, GIS, tiles, api-docs, and Swagger UI. The tiles location also lacked a limiter. GREEN: each response has exactly one ACAO (`*`), no upstream credentials header; four representative OPTIONS requests return 204 with Authorization allowed. All 10 API locations explicitly use `api_limit`.
- Applied each config change using `docker compose build gateway` followed by `docker compose up -d --no-deps gateway`; `docker exec terrawatch-gateway nginx -t` passed after both builds.
- Task 3 and final regression: 43 live direct/gateway identity, JSON, status, CORS, and preflight assertions passed, plus health and SPA checks. JWT comparison checks subject/email/role and token lifetime rather than time-dependent token strings; broadcast comparison excludes its generated timestamp; OpenAPI paths/components match while its generated server URL follows the request host.
- Authorization matrix passed on both `/api/v1/notifications/broadcast` and its `/api/v1/core/notifications/broadcast` alias: anonymous 401, citizen 403, officer 403, admin 200. Consecutive role-specific login/me requests returned the correct distinct profiles with no cached identity. Tests used the documented V4 demo credentials; no credentials were changed.
- Rate test: 160 concurrent GET requests, 64 workers, to `/api/v1/monitoring-areas` yielded 36 HTTP 200 and 124 HTTP 503 responses in both full regression runs. Every response retained one ACAO header; a request after a one-second drain returned 200.
- Final syntax/config checks: `nginx -t`, `docker compose config --quiet`, and `git diff --check` passed. Existing Compose obsolete-version and Git line-ending warnings remain unrelated.
- Minimal runnable CORS regression check (PowerShell; running stack required):

```powershell
@'
import urllib.request
for path in ('/api/v1/ai/models/info', '/api/v1/gis/mvt/0/0/0.pbf', '/api-docs', '/swagger-ui/index.html'):
    request = urllib.request.Request('http://localhost:8080' + path, headers={'Origin': 'http://localhost:5173'})
    with urllib.request.urlopen(request, timeout=15) as response:
        assert response.status == 200
        assert response.headers.get_all('Access-Control-Allow-Origin') == ['*'], path
        assert not response.headers.get_all('Access-Control-Allow-Credentials'), path
print('CORS regression checks passed')
'@ | python -
```

### Completion Notes List

- Completed all 13 task/subtask checkboxes and AC1-AC3. Production changes are confined to `gateway/nginx.conf`; only the story and sprint tracking accompany them.
- Reused existing Nginx upstreams, proxy headers, shared rate zone, and Core API security enforcement. Corrected areas/reports/alerts locations to their actual controller names and added diagnostic routing. Preserved the Story 1.1 auth location, regex `/core/` alias, Authorization forwarding, query arguments, and existing per-location CORS fixes.
- Added explicit AI/GIS CORS suppression as requested and server-level suppression inherited by docs/tiles/SPA proxies. This closes the same live double-header bug on all observed proxy groups without changing any backend CORS middleware.
- Added the existing GIS `burst=30 nodelay` policy to tiles. `proxy_cache_valid` does not activate a cache by itself, so there is no configured cache justifying a rate-limit exemption; no identity-varying API response cache was introduced.
- Kept the shared 50 requests/second/IP zone and Nginx's existing 503 rejection status; verified actual rejection and recovery on a newly corrected route.
- Existing backend limitations were observed equally on direct/gateway requests and left outside this story: `/api/v1/tiles/0/0/0.pbf` has no GIS handler and returns 404 (the current `/api/v1/gis/mvt/0/0/0.pbf` handler returns 200); malformed JSON on non-auth Core mutation routes currently returns 401 on both ports; diagnostic GIS invokes an absent legacy query-satellite handler and returns its existing circuit-breaker fallback JSON. No backend behavior was patched to mask these findings.
- No forecasts location, gateway JWT parser, new dependency, Docker base-image change, or REDIS_URL/REDIS_HOST orchestration change was added. All pre-existing unrelated working-tree changes were preserved.

### File List

- `gateway/nginx.conf`
- `services/core-api/src/main/java/vn/terrawatch/core/config/SecurityConfig.java` (review fix: require auth on `/api/v1/diagnostic/**`)
- `_bmad-output/implementation-artifacts/1-3-api-gateway-reverse-proxy-rate-limiting.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/deferred-work.md`

## Change Log

- 2026-10-15: Corrected Core controller routing, completed gateway-owned CORS suppression and tiles rate limiting, verified live direct/gateway parity and authorization, and marked Story 1.3 ready for review.
- 2026-10-15: Code review (4-layer + ponytail) found 1 decision-needed and 3 patch items. Resolved: `/api/v1/diagnostic/**` now requires authentication (user decision); re-added `Access-Control-Allow-Credentials` at gateway level; removed 18 lines of dead/redundant `proxy_hide_header` duplication (live-verified inheritance from server level); fixed a stale comment on the auth location. All 4 fixes rebuilt and re-verified live (curl header counts, direct-vs-gateway parity, full `mvn test` 16/16 pass). 6 pre-existing nginx-mechanics items deferred to `deferred-work.md`; 6 findings dismissed as factually incorrect or already resolved on re-verification.
