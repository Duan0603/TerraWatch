---
baseline_commit: 6ddb5bdd1f89d1258cf6c446b1ba80dd6cd94d52
---
# Story 1.2: PostGIS Forecast and Observation Schema & Spatial Indexes

Status: done

<!-- Note: Created via bmad-create-story workflow for Tú (GIS) & Thuận (Backend) -->

## Story Overview
**Story Key:** `1-2-postgis-schema-per-service-migration-spatial-indexes`  
**Epic:** Epic 1: Foundation, identity and forecast data contracts  
**Target Services:** Database (`database/migrations/`) & Core API Flyway (`services/core-api/src/main/resources/db/migration/`)  
**Assignee:** Tú (GIS / Rainfall Data Engineer) & Thuận (Backend Engineer / Architect)  

### User Story
As a GIS and Backend Engineer (Tú & Thuận),  
I want a unified PostGIS database schema that stores spatial assessment units, rainfall observations, weather forecasts, feature snapshots, forecast runs, and audit reviews,  
So that the system can reliably persist environmental evidence, decouple raw observations from future predictions, and serve high-performance spatial queries with sub-second latency.

---

## Acceptance Criteria

- [x] **AC1 (Schema Isolation & Compatibility):** Tạo migration mới `V3__rainfall_terrain_forecast_schema.sql` bổ sung các bảng dữ liệu vào `gis_schema` và `core_schema`. Giữ nguyên vẹn các bảng hiện có từ `V1` và `V2` (`users`, `landslide_events`, `monitoring_areas`), không xóa hoặc sửa đổi đè lên migration cũ.
- [x] **AC2 (Spatial Assessment Units Schema):** Tạo bảng `gis_schema.spatial_assessment_units` lưu trữ lưới không gian đánh giá nguy cơ (Polygon SRID 4326):
  - Khóa chính `unit_id` (VARCHAR(50), e.g., `VN_LC_BATXAT_0001`).
  - Liên kết ngoại `area_id` tới `gis_schema.monitoring_areas(area_id)`.
  - Các trường địa hình trích xuất từ DEM: `geom` (Polygon, 4326), `centroid` (Point, 4326), `slope_avg` (float), `slope_max` (float), `elevation_avg` (float), `relief_m` (float).
  - Thuộc tính phiên bản: `unit_version` (VARCHAR(20) DEFAULT 'v1'), `effective_resolution_m` (float, e.g., 1000.0).
- [x] **AC3 (Rainfall Observations & Weather Forecasts Separation):**
  - Tạo bảng `gis_schema.rainfall_observations`: Lưu trữ lượng mưa thực đo / ước tính lịch sử (`rainfall_mm`, `interval_start`, `interval_end`, `available_at`, `ingested_at`, `source_provider`, `quality_flag`, `is_gap_filled`). Ràng buộc UNIQUE `(unit_id, interval_start, interval_end, source_provider, source_revision)` để chống trùng lặp (Idempotency).
  - Tạo bảng `gis_schema.rainfall_forecasts`: Lưu trữ lượng mưa dự báo thời tiết 24h tới (`provider_run_id`, `provider_name`, `issued_at`, `valid_from`, `valid_until`, `predicted_rain_24h_mm`, `quality_flag`). Ràng buộc UNIQUE `(unit_id, provider_run_id, valid_from, valid_until)`.
  - *Quy tắc bất biến:* Phân biệt rạch ròi giữa quan trắc quá khứ và dự báo tương lai. Ghi nhận `available_at` rõ ràng; dữ liệu thiếu không được tự ý gán bằng 0.
- [x] **AC4 (Immutable Feature Snapshots Schema):** Tạo bảng `gis_schema.feature_snapshots` lưu trữ ảnh chụp đặc trưng bất biến tại thời điểm đánh giá $t$:
  - `snapshot_id` (UUID PK), `schema_version` (VARCHAR, e.g., 'rainfall-terrain-24h.v1'), `unit_id` (FK), `unit_version`, `as_of_time` (TIMESTAMPTZ).
  - Cột `features` (JSONB) chứa đầy đủ các thuộc tính địa hình và mưa: `slope_avg`, `relief_m`, `rain_1h_mm`, `rain_24h_acc_mm`, `rain_72h_acc_mm`, `rain_7d_acc_mm`, `forecast_next_24h_mm`.
  - Ràng buộc UNIQUE `(unit_id, unit_version, as_of_time, schema_version)`.
- [x] **AC5 (Forecast Runs & Officer Reviews Schema in Core):**
  - Tạo bảng `core_schema.forecast_runs`: Lưu trữ kết quả chạy mô hình AI 24h (`run_id` UUID PK, `snapshot_id` FK, `unit_id`, `issued_at`, `valid_from`, `valid_until`, `horizon_hours=24`, `availability` ('available'/'unavailable'), `probability`, `experimental_score`, `hazard_level` (enum `risk_level`), `model_version`, `threshold_version`, `contributing_factors` JSONB, `review_status` ('pending'/'approved'/'rejected'/'superseded'), `is_active` BOOL).
  - Tạo bảng `core_schema.forecast_reviews`: Lưu vết thẩm định của cán bộ (`review_id` SERIAL PK, `run_id` FK, `reviewer_id` FK users, `decision` ('approved'/'rejected'), `reason_notes` TEXT, `reviewed_at` TIMESTAMPTZ).
  - Tạo bảng `core_schema.alert_subscriptions` & `core_schema.alert_broadcasts`: Mở rộng khả năng lưu đăng ký nhận tin của người dân và lịch sử phát loa/SMS/FCM cảnh báo khẩn cấp có liên kết tới `run_id`.
- [x] **AC6 (Spatial Indexes & Automated Triggers):**
  - Tạo chỉ mục không gian `USING GIST` trên tất cả các cột hình học: `idx_assessment_units_geom`, `idx_assessment_units_centroid`.
  - Tạo chỉ mục Composite B-Tree tối ưu hóa truy vấn theo thời gian và trạng thái: `(unit_id, as_of_time DESC)`, `(valid_from, valid_until)`, `(review_status, is_active)`.
  - Trigger tự động tính toán `centroid` từ `geom` khi INSERT hoặc UPDATE trên `spatial_assessment_units`.
- [x] **AC7 (Synthetic Fixtures & Synchronization):** Cung cấp bộ dữ liệu mẫu (Seed Data) cho khu vực thí điểm (Pilot AOI: Lào Cai / Yên Bái) với ít nhất 10 ô assessment units, dữ liệu mưa giả lập và 1 bản ghi forecast run mẫu. Đồng bộ file migration giữa `services/core-api/src/main/resources/db/migration/` và `database/migrations/`.

---

## Technical Context & Guardrails

- **Database Engine:** PostgreSQL 15+ kết hợp tiện ích mở rộng PostGIS 3.3+.
- **Logical Schema Isolation (Phương án A):**
  - `gis_schema`: Chịu trách nhiệm về không gian địa lý, địa hình DEM, lượng mưa quan trắc & dự báo, và snapshot đặc trưng.
  - `core_schema`: Chịu trách nhiệm về người dùng, sự kiện thực tế, các lượt dự báo 24h, thẩm định cán bộ, và cảnh báo khẩn cấp.
  - `public`: Chứa extensions (`uuid-ossp`, `postgis`).
- **Spatial Reference System (CRS):**
  - Lưu trữ và trao đổi dữ liệu: `EPSG:4326` (WGS 84 kinh độ / vĩ độ).
  - Các phép tính khoảng cách (meters), bán kính vùng đệm (buffer) và diện tích: Sử dụng kiểu dữ liệu `geography` (e.g., `ST_Area(geom::geography)`) hoặc chuyển đổi sang hệ chiếu mét `EPSG:3405` (VN-2000 UTM Zone 48N).
- **Temporal Invariants & Timestamps:**
  - Toàn bộ cột thời gian sử dụng kiểu `TIMESTAMP WITH TIME ZONE` (`TIMESTAMPTZ`) và chuẩn hóa UTC.
  - Không gán giá trị mặc định `0.0` cho dữ liệu thiếu (Missing Data) — sử dụng `NULL` kèm cờ `quality_flag = 'missing'`.
- **Flyway Migration Standards:**
  - Tên file: `V3__rainfall_terrain_forecast_schema.sql`.
  - Chạy an toàn với cú pháp `IF NOT EXISTS` và bắt lỗi `DO $$ BEGIN ... EXCEPTION WHEN duplicate_object THEN null; END $$;` cho các kiểu Enum.

---

## Tasks & Subtasks

- [x] **Task 1: Xây dựng Schema Không Gian & Lượng Mưa trong `gis_schema`**
  - [x] 1.1 Khởi tạo bảng `gis_schema.spatial_assessment_units` kèm các thuộc tính địa hình DEM (`slope_avg`, `slope_max`, `elevation_avg`, `relief_m`, `effective_resolution_m`).
  - [x] 1.2 Khởi tạo bảng `gis_schema.rainfall_observations` với các cờ chất lượng (`quality_flag`, `is_gap_filled`) và ràng buộc UNIQUE chống trùng lặp.
  - [x] 1.3 Khởi tạo bảng `gis_schema.rainfall_forecasts` lưu trữ dự báo thời tiết theo `provider_run_id` và khoảng thời gian hiệu lực (`valid_from` -> `valid_until`).
  - [x] 1.4 Khởi tạo bảng `gis_schema.feature_snapshots` với cột `features` kiểu JSONB lưu trữ vector đặc trưng bất biến tại thời điểm $t$.
- [x] **Task 2: Xây dựng Schema Dự Báo & Thẩm Định trong `core_schema`**
  - [x] 2.1 Khởi tạo kiểu Enum `core_schema.forecast_review_status` ('pending', 'approved', 'rejected', 'superseded').
  - [x] 2.2 Khởi tạo bảng `core_schema.forecast_runs` lưu trữ kết quả chạy mô hình AI 24h, mức độ nguy cơ, xác suất / điểm thực nghiệm, và cờ trạng thái hiệu lực.
  - [x] 2.3 Khởi tạo bảng `core_schema.forecast_reviews` ghi nhận nhật ký duyệt của cán bộ trực ban (Audit Trail).
  - [x] 2.4 Khởi tạo bảng `core_schema.alert_subscriptions` (đăng ký nhận tin của người dân) và `core_schema.alert_broadcasts` (lịch sử phát cảnh báo SMS/FCM).
- [x] **Task 3: Thiết lập Chỉ mục Không gian & Trigger Tự động**
  - [x] 3.1 Tạo chỉ mục `GIST` cho `geom` và `centroid` trên `spatial_assessment_units`.
  - [x] 3.2 Tạo chỉ mục B-Tree trên các trường khóa ngoại và các trường thời gian (`as_of_time`, `valid_from`, `valid_until`).
  - [x] 3.3 Viết Trigger `gis_schema.fn_update_assessment_unit_centroid()` tự động tính toán `centroid` khi có thay đổi trên trường `geom`.
- [x] **Task 4: Soạn thảo Migration & Đồng bộ File Dự Án**
  - [x] 4.1 Tạo file `services/core-api/src/main/resources/db/migration/V3__rainfall_terrain_forecast_schema.sql`.
  - [x] 4.2 Đồng bộ file trên sang thư mục `database/migrations/V3__rainfall_terrain_forecast_schema.sql`.
- [x] **Task 5: Tạo Dữ Liệu Khởi Tạo Mẫu (Seed Fixtures)**
  - [x] 5.1 Tạo file `database/seed_v3_fixtures.sql` chứa ít nhất 10 ô lưới assessment units tại khu vực Bát Xát / Sa Pa (Lào Cai).
  - [x] 5.2 Nạp dữ liệu quan trắc mưa mẫu và 1 bản ghi dự báo 24h mẫu để hỗ trợ dev WebGIS/AI offline.
- [x] **Task 6: Kiểm Thử & Xác Thực Migration**
  - [x] 6.1 Chạy migration trên PostGIS container (`terrawatch-postgis`).
  - [x] 6.2 Kiểm tra tính toàn vẹn khóa ngoại (Foreign Keys) và ràng buộc UNIQUE chống lặp.
  - [x] 6.3 Chạy thử câu truy vấn không gian `ST_Intersects` và `ST_DWithin` đo đạc thời gian phản hồi (< 20ms).

---

## Dev Notes & Architecture Alignment

### 1. Mapping Cấu Trúc Bảng Theo Kiến Trúc V2 ([architecture.md](file:///d:/Ky_8/DATN/TerraWatch/_bmad-output/planning-artifacts/architecture.md#L52-L65)):
- `gis_schema.spatial_assessment_units`: Đại diện cho các đơn vị không gian cố định (Grid 1km hoặc tiểu lưu vực) được quan trắc.
- `gis_schema.rainfall_observations`: Lưu lịch sử chuỗi thời gian mưa (1h, 24h, 72h, 7d).
- `gis_schema.rainfall_forecasts`: Lưu dự báo lượng mưa 24h tới từ mô hình thời tiết (Open-Meteo / ECMWF).
- `gis_schema.feature_snapshots`: Cầu nối bất biến giữa GIS và AI (được sinh ra bởi Story 2.3).
- `core_schema.forecast_runs`: Lưu trữ kết quả AI phục vụ WebGIS review (Story 4.2 & Story 4.3).

### 2. File Locations:
- Migration Spring Boot Flyway: `services/core-api/src/main/resources/db/migration/V3__rainfall_terrain_forecast_schema.sql`
- Standalone Migration Script: `database/migrations/V3__rainfall_terrain_forecast_schema.sql`
- Test Seed Script: `database/seed_v3_fixtures.sql`

### 3. Dependencies & Standards:
- Giữ nguyên `flyway-core` trong Spring Boot 3.2.4.
- Đảm bảo tương thích hoàn toàn với entity JPA hiện có của Thuận (`MonitoringArea.java`, `LandslideEvent.java`).

---

## Dev Agent Record

### Agent Model Used
Gemini 3.8 Flash (High) - Antigravity Dev Agent (Amelia)

### Completion Notes
- Schema/migration portion (AC1–AC6) verified **directly against the live `terrawatch-postgis` container** (not just by re-reading the SQL file): all 9 new tables exist, Flyway history shows V3 applied successfully, all declared GIST/B-Tree indexes exist, the `trg_assessment_unit_metrics` trigger correctly populates `centroid`/`area_m2` (~1.14 km² per 1km×1km cell, confirmed on 10 live rows), and `core_schema.v_active_forecast_hazards` exists and filters correctly (returns 0 rows while the only seeded run is `review_status = 'pending'`, as expected).
- **AC7 was not actually satisfied before this audit** and the original Completion Notes overstated it. Found and fixed during a 2026-10-15 verification pass:
  1. `database/seed_v3_fixtures.sql` is a standalone script, not wired into `docker-entrypoint-initdb.d` (only `init.sql`/`seed.sql` are mounted in `docker-compose.yml`) and not a Flyway migration — it had **never actually been run** against the live container; all 5 new tables held 0 rows.
  2. The fixture file only seeded **5** assessment units, not the "≥10" AC7 requires.
  3. While fixing (1)/(2) and testing re-runnability, discovered a real idempotency bug: `rainfall_observations`/`rainfall_forecasts`/`feature_snapshots` inserts used `CURRENT_TIMESTAMP` inside the columns that form their own `ON CONFLICT` dedupe key — a moving timestamp never matches on re-run, so every re-run silently inserted a fresh batch of duplicates (reproduced live: a second run took `rainfall_observations`/`rainfall_forecasts` from 10 rows to 30). Fixed by anchoring all fixture timestamps to a fixed literal (`TIMESTAMPTZ '2026-10-14 00:00:00+00'`) instead of `CURRENT_TIMESTAMP`, and fixed `feature_snapshots`' `ON CONFLICT` target (was pointing at a composite UNIQUE that could never match because of the same moving-timestamp issue; now conflicts on the real PK `snapshot_id`).
  4. Expanded the fixture to 10 assessment units (5 original + 5 new: `VN_LC_BATXAT_0006/0007`, `VN_LC_SAPA_0008/0009/0010`), and corrected `area_id` on all 10 from `1` (which is actually "Mù Cang Chải, Yên Bái") to `2` ("Sa Pa & Bát Xát, Lào Cai" — the AOI the fixture names actually describe).
  5. Re-ran the corrected script twice against the live container: **first run inserted 10/10/10/1/1 rows, second run inserted 0/0/0/0/0** — genuinely idempotent now.
- Re-validated Task 6 claims with real data instead of trusting the prior note: FK constraint enforcement confirmed live (inserting an observation against a nonexistent `unit_id` is rejected with `violates foreign key constraint`, rolled back, no side effects). `ST_DWithin` query against the real 10-row fixture set executes in **~12ms via a planner-chosen sequential scan** — at 10 rows the planner correctly judges a seq scan cheaper than the GIST index (which exists and is structurally confirmed via `pg_indexes`); the previous note's unqualified "5.25 ms" figure could not have been measured against real data since the tables were empty at the time, so it is not carried forward as a validated number.
- Net result: schema design was solid and correctly delivered; the seed-fixture acceptance criterion (AC7) was not, and is now genuinely fixed and verified live. Status kept as `done` is appropriate going forward since AC7 is now actually met, but the user was notified of the discrepancy found in the original claim before this fix.

### Change Log
- 2026-10-15: Completion audit against the live `terrawatch-postgis` container found AC7 (seed fixtures) was not actually satisfied (0 live rows; file had 5 units instead of ≥10; non-idempotent `CURRENT_TIMESTAMP` fixture inserts). Fixed `database/seed_v3_fixtures.sql` (10 units, fixed-timestamp idempotent inserts, corrected `area_id`), reloaded and verified against the live DB, and corrected the Completion Notes to reflect what was actually verified vs. previously just claimed.

### File List
- `services/core-api/src/main/resources/db/migration/V3__rainfall_terrain_forecast_schema.sql`
- `database/migrations/V3__rainfall_terrain_forecast_schema.sql`
- `database/seed_v3_fixtures.sql` (fixed in this audit pass: 10 units, idempotent fixed-timestamp inserts, corrected `area_id`)
- `_bmad-output/implementation-artifacts/1-2-postgis-schema-per-service-migration-spatial-indexes.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
