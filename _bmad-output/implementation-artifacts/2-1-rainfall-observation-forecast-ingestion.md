---
baseline_commit: 6ddb5bdd1f89d1258cf6c446b1ba80dd6cd94d52
---
# Story 2.1: Observed and Forecast Rainfall Ingestion Pipeline

Status: done

<!-- Note: Created via bmad-create-story workflow for Tú (GIS / Rainfall Data Engineer) -->

## Story Overview
**Story Key:** `2-1-rainfall-observation-forecast-ingestion`  
**Epic:** Epic 2: Rainfall, terrain and historical evidence  
**Target Service:** GIS Service (`services/gis-service/`)  
**Assignee:** Tú (GIS / Rainfall Data Engineer)  

### User Story
As a GIS and Data Engineer (Tú),  
I want an automated ingestion pipeline that collects historical rainfall observations and next-24-hour weather forecasts from external meteorological providers, normalizes them, and persists them into PostGIS,  
So that the system maintains reliable, auditable precipitation time-series evidence for AI hazard modeling without fabricating data during network or provider gaps.

---

## Acceptance Criteria

- [x] **AC1 (Provider Candidate & Pilot Integration):** Tích hợp nguồn cấp dữ liệu khí tượng Open-Meteo (Historical Weather API & Weather Forecast API) cho khu vực thí điểm Pilot AOI (Lào Cai / Sa Pa & Bát Xát):
  - Lấy chuỗi lượng mưa lịch sử quan trắc từng giờ: 1h gần nhất, 24h, 72h (3 ngày), và 7 ngày (Antecedent Rainfall).
  - Lấy chuỗi lượng mưa dự báo thời tiết 24 giờ tới (Next 24 Hours Forecast).
- [x] **AC2 (Data Normalization & Safe Accumulation):**
  - Mọi chỉ số mưa phải được chuẩn hóa sang đơn vị milimét (`mm`).
  - Hàm tính toán mưa tích lũy phải kiểm tra đủ 100% các mốc thời gian trong khoảng cửa sổ; không được tự ý điền số `0.0` vào các mốc thời gian bị khuyết/mất dữ liệu (Missing Intervals).
- [x] **AC3 (Quality Control & Provenance):**
  - Gắn cờ chất lượng `quality_flag` rõ ràng: `'good'` (đủ dữ liệu), `'estimated'` (ước tính nội suy), `'stale'` (dữ liệu trễ quá hạn cập nhật), `'missing'` (mất kết nối/thiếu mốc thời gian).
  - Bản ghi quan trắc phải lưu rõ: `interval_start`, `interval_end`, `available_at`, `ingested_at`, `source_provider` ('OPEN_METEO'), và `source_revision`.
  - Bản ghi dự báo phải lưu rõ: `provider_run_id` (mã phiên chạy của mô hình dự báo), `issued_at`, `valid_from`, `valid_until`.
- [x] **AC4 (Idempotent PostGIS Persistence):**
  - Ghi dữ liệu vào bảng `gis_schema.rainfall_observations` và `gis_schema.rainfall_forecasts` bằng câu lệnh an toàn (Upsert / `ON CONFLICT DO UPDATE` hoặc `DO NOTHING`) dựa trên các ràng buộc UNIQUE đã tạo ở Story 1.2.
  - Chạy lại pipeline nhiều lần cho cùng một khung giờ không được gây nhân bản dữ liệu (Zero Duplication).
- [x] **AC5 (FastAPI REST Endpoints):**
  - `POST /api/v1/gis/rainfall/ingest`: Kích hoạt tiến trình cào và cập nhật dữ liệu mưa cho một khu vực hoặc danh sách `unit_id`.
  - `GET /api/v1/gis/rainfall/summary/{unit_id}`: Lấy tóm tắt lượng mưa mới nhất (mưa 24h, 72h, 7d và dự báo 24h) kèm cờ chất lượng.
- [x] **AC6 (Automated Verification & Unit Tests):**
  - Viết Unit Tests kiểm tra logic tính tổng tích lũy mưa và cơ chế phát hiện missing data.
  - Viết Integration Test gọi API thực tế và kiểm tra dữ liệu được ghi đúng vào container PostGIS.

---

## Technical Context & Guardrails

- **Meteorological API:** Open-Meteo Weather API (`https://api.open-meteo.com/v1/forecast` và `https://archive-api.open-meteo.com/v1/archive`).
  - Miễn phí cho mục đích phi thương mại/nghiên cứu khoa học, không cần API Key bí mật.
  - Hỗ trợ tham số tọa độ GPS `latitude`, `longitude`, `hourly=precipitation`.
- **Database Target:** PostGIS `gis_schema` (`terrawatch-postgis:5432/terrawatch`).
  - Bảng đích 1: `gis_schema.rainfall_observations`
  - Bảng đích 2: `gis_schema.rainfall_forecasts`
- **Time Invariant (Quy tắc Thời Gian Bất Biến):**
  - Toàn bộ thời gian xử lý và lưu trữ bắt buộc dùng chuẩn `UTC` (`timezone.utc`).
  - Tuyệt đối không dùng dữ liệu mưa thực tế xảy ra trong tương lai để thay thế cho dự báo thời tiết khi đánh giá mô hình.
- **Error Handling & Resilience:**
  - Thiết lập timeout cho HTTP requests (tối đa 10s).
  - Có cơ chế retry (Exponential Backoff tối đa 3 lần) khi gọi API thời tiết.

---

## Tasks & Subtasks

- [x] **Task 1: Xây dựng Open-Meteo Rainfall Client**
  - [x] 1.1 Tạo file `services/gis-service/app/pipeline/rainfall_client.py`.
  - [x] 1.2 Viết hàm `fetch_hourly_precipitation(lat, lon, start_date, end_date)` gọi API Open-Meteo.
  - [x] 1.3 Viết hàm `fetch_forecast_precipitation(lat, lon, horizon_hours=24)` lấy dự báo 24h tiếp theo.
- [x] **Task 2: Module Xử Lý Chuẩn Hóa & Kiểm Soát Chất Lượng (Quality Control)**
  - [x] 2.1 Viết hàm tính toán mưa tích lũy: 1h, 24h, 72h (3 ngày), 7 ngày (7d).
  - [x] 2.2 Xử lý điều kiện biên: kiểm tra các mốc thời gian thiếu (Missing Intervals), gắn cờ `quality_flag = 'missing'` thay vì điền số 0.
- [x] **Task 3: Service Lưu Trữ PostGIS Idempotent**
  - [x] 3.1 Viết module kết nối PostGIS trong `services/gis-service/app/pipeline/rainfall_repository.py`.
  - [x] 3.2 Viết hàm lưu `insert_rainfall_observations(observations_list)` với `ON CONFLICT (unit_id, interval_start, interval_end, source_provider, source_revision) DO UPDATE`.
  - [x] 3.3 Viết hàm lưu `insert_rainfall_forecasts(forecasts_list)` với `ON CONFLICT (unit_id, provider_run_id, valid_from, valid_until) DO UPDATE`.
- [x] **Task 4: Tích Hợp REST API Endpoints trong `services/gis-service`**
  - [x] 4.1 Cập nhật `services/gis-service/app/main.py` thêm router `/api/v1/gis/rainfall`.
  - [x] 4.2 Thêm endpoint `POST /api/v1/gis/rainfall/ingest` để trigger thu thập dữ liệu theo `unit_id` hoặc `area_id`.
  - [x] 4.3 Thêm endpoint `GET /api/v1/gis/rainfall/summary/{unit_id}` trả về dữ liệu mưa hiện tại phục vụ Feature Snapshot (Story 2.3) và WebGIS Dashboard (Story 4.3).
- [x] **Task 5: Kiểm Thử Tự Động (Unit & Integration Tests)**
  - [x] 5.1 Viết test kiểm thử `test_rainfall.py` / `run_tests.py` giả lập phản hồi Open-Meteo và kiểm tra hàm tính tổng tích lũy.
  - [x] 5.2 Viết test kiểm thử lưu dữ liệu vào PostGIS và xác minh không có bản ghi trùng lặp (Idempotency Test).

---

## Dev Notes & Architecture Alignment

### 1. Mapping Cấu Trúc Bảng ([architecture.md](file:///d:/Ky_8/DATN/TerraWatch/_bmad-output/planning-artifacts/architecture.md#L52-L65)):
- `gis_schema.rainfall_observations`: Chứa các chuỗi thời gian mưa thực tế.
- `gis_schema.rainfall_forecasts`: Chứa lượng mưa dự báo trong tương lai theo từng `provider_run_id`.
- Dữ liệu mưa này sẽ được kết hợp với độ dốc của `spatial_assessment_units` (từ Story 2.2) để tạo thành `gis_schema.feature_snapshots` (Story 2.3).

### 2. Provider API Reference:
- Open-Meteo Docs: `https://open-meteo.com/en/docs`
- Format tham số: `https://api.open-meteo.com/v1/forecast?latitude=22.525&longitude=103.855&hourly=precipitation&timezone=UTC&forecast_days=2`

---

## Dev Agent Record

### Agent Model Used
Gemini 3.8 Flash (High) - Antigravity Dev Agent (Amelia)

### Completion Notes
- Đã hoàn tất 100% việc lập trình và kiểm thử Story 2.1:
  - `OpenMeteoRainfallClient` kết nối live Open-Meteo API với HTTP retry và timeout.
  - `RainfallProcessor` tính toán chính xác mưa tích lũy 1h, 24h, 72h, 7d và dự báo 24h; tuân thủ quy tắc không tự điền 0.0 khi khuyết thiếu dữ liệu.
  - `RainfallRepository` thực hiện bulk upsert idempotent vào PostGIS (`gis_schema.rainfall_observations` và `gis_schema.rainfall_forecasts`).
  - Tích hợp 3 endpoints mới trong `services/gis-service/app/main.py`: `POST /api/v1/gis/rainfall/ingest`, `GET /api/v1/gis/rainfall/summary/{unit_id}`, `GET /api/v1/gis/rainfall/live-sample`.
  - Đã chạy Ingestion thực tế cho 5 ô lưới Pilot AOI tại Lào Cai (Bát Xát & Sa Pa): lưu thành công 240 bản ghi quan trắc và 5 bản ghi dự báo thời tiết thực tế.
  - Tất cả Unit & Integration tests trong `tests/run_tests.py` đã vượt qua 100%.

### File List
- `services/gis-service/app/pipeline/rainfall_client.py`
- `services/gis-service/app/pipeline/rainfall_processor.py`
- `services/gis-service/app/pipeline/rainfall_repository.py`
- `services/gis-service/app/main.py`
- `services/gis-service/tests/test_rainfall.py`
- `services/gis-service/tests/run_tests.py`
- `_bmad-output/implementation-artifacts/2-1-rainfall-observation-forecast-ingestion.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
