---
baseline_commit: 6ddb5bdd1f89d1258cf6c446b1ba80dd6cd94d52
---
# Story 2.3: As-of Rainfall & Terrain Feature Snapshots

Status: review

<!-- Note: Created via bmad-create-story workflow for Tú (GIS) & Duẫn (AI) -->

## Story Overview
**Story Key:** `2-3-as-of-rainfall-terrain-feature-snapshots`  
**Epic:** Epic 2: Rainfall, terrain and historical evidence  
**Target Service:** GIS Service (`services/gis-service/`)  
**Assignee:** Tú (GIS / Rainfall Data Engineer) & Duẫn (AI Engineer)  

### User Story
As a GIS and AI Data Engineer (Tú & Duẫn),  
I want an automated snapshotting engine that aligns time-series rainfall observations and forward forecasts with static DEM terrain features at a strict prediction issue time $t$ into an immutable, versioned feature vector in PostGIS,  
So that both historical model training and operational 24h hazard inference consume identical spatial-temporal inputs without data leakage, boundary misalignment, or unhandled missingness.

---

## Acceptance Criteria

- [x] **AC1 (Strict Temporal Alignment & Lookahead Prevention):**
  - Căn chỉnh toàn bộ dữ liệu quan trắc tại thời điểm dự báo $t$ (`as_of_time`): mọi bản ghi quan trắc mưa đầu vào bắt buộc phải có `available_at <= t` (tuyệt đối chống rò rỉ dữ liệu tương lai / Lookahead Bias).
  - Lấy lượng mưa dự báo trong khoảng thời gian $(t, t+24\text{h}]$ từ phiên chạy dự báo thời tiết (`provider_run_id`) phát hành gần nhất trước hoặc tại thời điểm $t$.
- [x] **AC2 (Unified Feature Vector & Schema Versioning):**
  - Đóng gói toàn bộ đặc trưng vào cột `features` (JSONB) tuân thủ định dạng schema `schema_version = 'rainfall-terrain-24h.v1'`:
    - `rain_1h_mm`: Mưa tích lũy 1 giờ gần nhất.
    - `rain_24h_acc_mm`: Mưa tích lũy 24 giờ.
    - `rain_72h_acc_mm`: Mưa tích lũy 72 giờ (3 ngày).
    - `rain_7d_acc_mm`: Mưa tích lũy 7 ngày (Antecedent precipitation).
    - `forecast_next_24h_mm`: Mưa dự báo 24 giờ tiếp theo.
    - `slope_avg`: Độ dốc trung bình của ô (độ).
    - `slope_max`: Độ dốc lớn nhất trong ô (độ).
    - `elevation_avg`: Độ cao trung bình của ô (mét).
    - `relief_m`: Độ chênh cao địa hình (mét).
- [x] **AC3 (Missing Data & Quality Degradation Policy):**
  - Nếu thiếu dữ liệu quan trắc trong các cửa sổ trọng yếu hoặc không có dự báo thời tiết hợp lệ, gắn nhãn `coverage_quality = 'missing'` hoặc `'stale'`, các trường mưa bị thiếu phải gán giá trị `null` (tuyệt đối không điền số `0.0`).
  - Ghi nhận đầy đủ nguồn gốc trong `source_references` (JSONB): số lượng mốc quan trắc, mã phiên dự báo (`forecast_run_id`), nhà cung cấp mưa (`rainfall_provider`), nguồn DEM (`dem_source`), và độ phân giải hiệu dụng (`effective_resolution_m`).
- [x] **AC4 (Immutable PostGIS Persistence):**
  - Ghi dữ liệu vào bảng `gis_schema.feature_snapshots` với ràng buộc UNIQUE `(unit_id, unit_version, as_of_time, schema_version)`.
  - Thực hiện lưu trữ an toàn, idempotent bằng câu lệnh `ON CONFLICT DO UPDATE`. Dữ liệu snapshot sau khi lưu có tính chất bất biến (Immutable Snapshot) phục vụ truy vết và kiểm toán mô hình.
- [x] **AC5 (FastAPI REST Endpoints):**
  - `POST /api/v1/gis/snapshots/create`: Tạo và lưu trữ feature snapshot cho một hoặc danh sách `unit_id` tại mốc thời gian `as_of_time`.
  - `GET /api/v1/gis/snapshots/latest/{unit_id}`: Lấy snapshot mới nhất của một ô đánh giá nguy cơ để AI Service hoặc Core API truy vấn nhanh.
  - `GET /api/v1/gis/snapshots/{snapshot_id}`: Truy vấn snapshot theo UUID định danh duy nhất.
- [x] **AC6 (Automated Verification & Unit Tests):**
  - Viết unit test xác minh quy tắc bất biến `available_at <= as_of_time` (kiểm tra không bị rò rỉ dữ liệu tương lai).
  - Viết unit test kiểm tra xử lý missing data và gắn nhãn `coverage_quality`.
  - Viết integration test tạo snapshot thực tế từ dữ liệu mưa (Story 2.1) và dữ liệu địa hình (Story 2.2) cho 5 ô pilot tại Lào Cai và kiểm tra dữ liệu trong PostGIS.

---

## Technical Context & Guardrails

- **Target Table:** `gis_schema.feature_snapshots`
  - `snapshot_id` (UUID PK default uuid_generate_v4())
  - `schema_version` (VARCHAR(50) DEFAULT 'rainfall-terrain-24h.v1')
  - `unit_id` (VARCHAR(50) NOT NULL FK)
  - `unit_version` (VARCHAR(20) DEFAULT 'v1')
  - `as_of_time` (TIMESTAMPTZ NOT NULL)
  - `features` (JSONB NOT NULL)
  - `coverage_quality` (VARCHAR(30) DEFAULT 'good')
  - `source_references` (JSONB)
  - `created_at` (TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP)
- **Time Invariant (Quy tắc Thời Gian Bất Biến):**
  - Toàn bộ thời gian xử lý và lưu trữ bắt buộc dùng chuẩn `UTC` (`timezone.utc`).
  - Prediction issue time $t$ cố định cửa sổ $[t, t+24\text{h})$. Mọi nguồn dữ liệu đầu vào phải có sẵn trước hoặc tại thời điểm $t$.
- **Downstream Consumer Contract:**
  - Hợp phần này là cầu nối trực tiếp bàn giao dữ liệu cho Duẫn (Epic 3: AI Service).
  - AI Service (Story 3.1 & 3.3) sẽ gọi `GET /api/v1/gis/snapshots/latest/{unit_id}` hoặc nhận `snapshot_id` từ Core API để đưa vào mô hình Gradient Boosted Trees / Tabular ML suy luận xác suất nguy cơ sạt lở 24h.

---

## Tasks & Subtasks

- [x] **Task 1: Xây dựng Module Tổng Hợp Snapshot (Snapshot Processor)**
  - [x] 1.1 Tạo file `services/gis-service/app/pipeline/snapshot_processor.py`.
  - [x] 1.2 Viết logic căn chỉnh thời gian bất biến `available_at <= as_of_time`.
  - [x] 1.3 Viết hàm đóng gói `features` JSONB và siêu dữ liệu `source_references` JSONB.
- [x] **Task 2: Module Lưu Trữ PostGIS Snapshot Repository**
  - [x] 2.1 Tạo file `services/gis-service/app/pipeline/snapshot_repository.py`.
  - [x] 2.2 Viết hàm lưu `save_snapshot(snapshot_dict)` với cơ chế `ON CONFLICT DO UPDATE`.
  - [x] 2.3 Viết hàm truy vấn `get_latest_snapshot(unit_id)` và `get_snapshot_by_id(snapshot_id)`.
- [x] **Task 3: Tích Hợp FastAPI REST Endpoints**
  - [x] 3.1 Cập nhật `services/gis-service/app/main.py` thêm router `/api/v1/gis/snapshots`.
  - [x] 3.2 Thêm endpoint `POST /api/v1/gis/snapshots/create`.
  - [x] 3.3 Thêm endpoint `GET /api/v1/gis/snapshots/latest/{unit_id}` và `GET /api/v1/gis/snapshots/{snapshot_id}`.
- [x] **Task 4: Kiểm Thử Tự Động (Unit & Integration Tests)**
  - [x] 4.1 Viết `services/gis-service/tests/test_snapshots.py` kiểm tra logic temporal alignment và missing data.
  - [x] 4.2 Cập nhật `services/gis-service/tests/run_tests.py` tích hợp test snapshot.
  - [x] 4.3 Tạo snapshot thực tế cho 5 ô pilot tại Lào Cai và xác minh trong PostGIS.

---

## Dev Notes & Architecture Alignment

### 1. Mapping Cấu Trúc Bảng ([architecture.md](file:///d:/Ky_8/DATN/TerraWatch/_bmad-output/planning-artifacts/architecture.md#L52-L65)):
- `gis_schema.feature_snapshots`: Bảng lưu trữ đặc trưng hợp nhất.
- Hợp nhất giữa:
  - Dữ liệu lượng mưa từ `gis_schema.rainfall_observations` & `gis_schema.rainfall_forecasts` (Story 2.1).
  - Dữ liệu địa hình từ `gis_schema.spatial_assessment_units` (Story 2.2).
- Khóa duy nhất (Idempotency Key): `(unit_id, unit_version, as_of_time, schema_version)`.

### 2. Dữ Liệu 5 Ô Pilot Lào Cai (Bát Xát & Sa Pa):
- `VN_LC_BATXAT_0001`: Đã có chuỗi mưa và địa hình (slope: 23.76°, relief: 50m, elev: 549.36m).
- `VN_LC_BATXAT_0002`: Đã có chuỗi mưa và địa hình (slope: 33.41°, relief: 82m, elev: 621.56m).
- `VN_LC_BATXAT_0003`: Đã có chuỗi mưa và địa hình (slope: 27.30°, relief: 70m, elev: 1099.64m).
- `VN_LC_SAPA_0004`: Đã có chuỗi mưa và địa hình (slope: 30.30°, relief: 69m, elev: 1158.84m).
- `VN_LC_SAPA_0005`: Đã có chuỗi mưa và địa hình (slope: 23.17°, relief: 50m, elev: 1726.0m).

---

## File List

- `services/gis-service/app/pipeline/snapshot_processor.py` (New: Time-invariant snapshot builder, lookahead bias prevention, missing data handling, and schema v1 packager)
- `services/gis-service/app/pipeline/snapshot_repository.py` (New: PostGIS repository with connection safety, idempotent upsert, and latest snapshot querying)
- `services/gis-service/app/main.py` (Modified: Added POST create, GET latest by unit_id, and GET by snapshot_id endpoints)
- `services/gis-service/tests/test_snapshots.py` (New: Unit tests for temporal alignment and missing data policies)
- `services/gis-service/tests/run_tests.py` (Modified: Integrated TestSnapshotProcessing into runner)

---

## Change Log

- **2026-10-14:** Implemented SnapshotProcessor with `available_at <= as_of_time` guard and schema_version `rainfall-terrain-24h.v1`.
- **2026-10-14:** Implemented SnapshotRepository with PostgreSQL `@contextmanager` safe closing and idempotent upsert on `(unit_id, unit_version, as_of_time, schema_version)`.
- **2026-10-14:** Exposed REST endpoints in `app/main.py` and validated with `terrawatch-gis-service` container on port 8002.
- **2026-10-14:** Executed unit & integration test suites passing 11/11 tests; populated PostGIS `gis_schema.feature_snapshots` table for 5 Lào Cai pilot units.

---

## Dev Agent Record

### Agent Model Used
Gemini 3.8 Flash (High) - Antigravity Dev Agent (Amelia)

### Completion Notes
- All 6 Acceptance Criteria and 4 Tasks/Subtasks verified and satisfied.
- Unit and integration tests (11/11) pass with 100% success rate in 0.884s.
- Live database persistence verified in `gis_schema.feature_snapshots` table in PostGIS container `terrawatch-postgis`.
- FastAPI endpoints verified via live requests on `terrawatch-gis-service:8002`.
- Ready for code review (`/bmad-code-review`).
