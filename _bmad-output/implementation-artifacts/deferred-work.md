# Deferred Work Register

## Deferred from: code review of story-2.2 (2026-10-14)
- [x] [Review][Defer] Unify database connection factory between RainfallRepository and TerrainRepository [`services/gis-service/app/pipeline/terrain_repository.py:16`] — deferred, pre-existing pattern differences across repository classes.

## Deferred from: code review of story-1.1 (2026-10-15)
- [x] [Review][Defer] `.env.example`/root `.env` ship a real, non-placeholder `JWT_SECRET` default meant to be copied verbatim [`services/core-api/.env.example:21`, `.env.example:22`] — pre-existing file (commit `4af1cfb`), not touched by this diff, but now load-bearing since this story makes JWT signing live for the first time. `.env` itself is gitignored, so nothing live is committed — risk is a deployer never rotating the copied default.
- [x] [Review][Defer] Stateless JWT has no revocation/blacklist/refresh mechanism — inherent to the stateless-JWT architecture this story was scoped to deliver; a demoted/banned user's token stays valid up to `JWT_EXPIRATION_MS` (24h default). Would need a dedicated token-revocation story.
- [x] [Review][Defer] CORS allows `allowCredentials(true)` with `allowedOriginPatterns(List.of("*"))` [`services/core-api/src/main/java/vn/terrawatch/core/config/SecurityConfig.java` — `corsConfigurationSource()`] — pre-existing and untouched by this diff, now more consequential since a real bearer token exists to steal.

## Deferred from: code review of story-1.3 (2026-10-15)
- [x] [Review][Defer] Server-level `if ($request_method = 'OPTIONS') { return 204; }` [`gateway/nginx.conf`] runs before any location's `limit_req` applies — OPTIONS preflights are completely unthrottled. Pre-existing, predates this story's diff.
- [x] [Review][Defer] All `/api/v1/*` locations share one `limit_req_zone` bucket keyed only on client IP — heavy traffic to one location can 503 an unrelated location's request even though that location's own burst was never approached. Pre-existing zone definition and sharing pattern.
- [x] [Review][Defer] Trailing-slash-less prefix locations (`monitoring-areas`, `community-reports`, `notifications`, `diagnostic`, `landslides`) match by raw string prefix, not path segment — e.g. a hypothetical `/api/v1/notificationsFoo` would be wrongly captured. Pre-existing pattern (already true of `/api/v1/landslides`); no real route collides with this today.
- [x] [Review][Defer] New `location ~ ^/api/v1/core/(.*)$` regex alias [`gateway/nginx.conf`]: doesn't match bare `/api/v1/core` (no trailing slash, falls to SPA fallback); matches against nginx's decoded `$uri` so an encoded `%2F` could reshape `$1` unexpectedly; doesn't normalize a double slash before `proxy_pass`. Low-practical-risk nginx-mechanics edge cases against a Spring Boot backend, not reachable by any real client path today.
- [x] [Review][Defer] `/api/v1/tiles/0/0/0.pbf` has no matching GIS handler (gis-service only implements `/api/v1/gis/mvt/{z}/{x}/{y}.pbf`) — pre-existing backend gap, already observed and documented by Story 1.3's own dev agent as explicitly out of that story's scope.
