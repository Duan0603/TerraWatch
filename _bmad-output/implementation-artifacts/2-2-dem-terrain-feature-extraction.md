---
baseline_commit: 6ddb5bdd1f89d1258cf6c446b1ba80dd6cd94d52
---
# Story 2.2: DEM Terrain Feature Extraction & Assessment Units

Status: done

<!-- Note: Created via bmad-create-story workflow for Tú (GIS / Rainfall Data Engineer) -->

## Story Overview
**Story Key:** `2-2-dem-terrain-feature-extraction`  
**Epic:** Epic 2: Rainfall, terrain and historical evidence  
**Target Service:** GIS Service (`services/gis-service/`)  
**Assignee:** Tú (GIS / Rainfall Data Engineer)  

### User Story
As a GIS and Data Engineer (Tú),  
I want an automated terrain feature extraction engine that processes Digital Elevation Models (DEM) over spatial assessment units to compute versioned slope, elevation, and relief metrics with rigorous CRS and nodata handling,  
So that the AI hazard forecasting service receives accurate, reproducible geomorphic baseline evidence without erroneous elevation artifacts or unit-scale mismatch.

---

## Acceptance Criteria

- [x] **AC1 (DEM Source Ingestion & Coordinate Reference System):**
  - Tích hợp nguồn dữ liệu độ cao số (Digital Elevation Model - DEM/SRTM 30m / Copernicus DEM 30m) cho khu vực thí điểm Pilot AOI (Lào Cai / Bát Xát & Sa Pa).
  - Sử dụng hệ tọa độ chuẩn: Dữ liệu không gian lưu trữ và trao đổi bằng `EPSG:4326`, nhưng mọi phép tính khoảng cách ngang ($dx, dy$) và độ dốc ($dz/dx$) bắt buộc phải quy đổi sang hệ tọa độ mét (metric projection: UTM Zone 48N - `EPSG:32648` hoặc sử dụng công thức trắc địa Geodesic WGS84).
- [x] **AC2 (Robust Terrain Metrics Calculation):**
  - Trích xuất và tính toán các chỉ số địa hình cốt lõi cho từng ô `spatial_assessment_units`:
    - `elevation_avg`: Độ cao trung bình của ô (đơn vị: mét).
    - `elevation_min`, `elevation_max`: Độ cao tối thiểu và tối đa trong ô.
    - `relief_m`: Độ chênh cao địa hình (`elevation_max - elevation_min`, đơn vị: mét).
    - `slope_avg`: Độ dốc trung bình (đơn vị: độ - degrees).
    - `slope_max`: Độ dốc lớn nhất trong ô đơn vị (phản ánh vách dốc taluy có nguy cơ sạt lở cao nhất).
- [x] **AC3 (Nodata & Border Validation):**
  - Kiểm tra và loại bỏ triệt để các điểm khuyết dữ liệu (Nodata values như -9999, -32768, NaN). Tuyệt đối không đưa giá trị nodata vào tính trung bình hoặc gradient làm méo mó địa hình.
  - Xử lý các ô biên hoặc vùng giao cắt chính xác theo ranh giới `geom` (Polygon) của từng ô đơn vị đánh giá.
- [x] **AC4 (Versioned PostGIS Persistence):**
  - Cập nhật các chỉ số đã tính toán vào bảng `gis_schema.spatial_assessment_units`:
    - Ghi nhận `dem_source` (mặc định `'SRTM_30M'` hoặc `'COPERNICUS_GLO_30'`), `dem_resolution_m` (30.0), `effective_resolution_m` (1000.0), `unit_version` ('v1').
    - Thực hiện cập nhật an toàn, idempotent (`UPDATE gis_schema.spatial_assessment_units SET ... WHERE unit_id = ...`).
- [x] **AC5 (FastAPI REST Endpoints):**
  - `POST /api/v1/gis/terrain/extract`: Kích hoạt tiến trình trích xuất đặc trưng địa hình cho một danh sách `unit_id` hoặc toàn bộ các ô thuộc `area_id`.
  - `GET /api/v1/gis/terrain/{unit_id}`: Trả về thông tin địa hình chi tiết của ô đơn vị đánh giá (độ cao trung bình, độ dốc trung bình, độ dốc tối đa, độ chênh cao, nguồn DEM, độ phân giải).
- [x] **AC6 (Automated Verification & Unit Tests):**
  - Viết unit tests kiểm tra thuật toán tính độ dốc và chênh cao với dữ liệu lưới độ cao nhân tạo (Synthetic DEM grid).
  - Kiểm tra xử lý ngoại lệ khi gặp giá trị nodata hoặc vùng đồng bằng bằng phẳng (slope = 0).
  - Viết integration test xác minh dữ liệu địa hình được cập nhật chính xác vào PostGIS cho 5 ô pilot tại Lào Cai.

---

## Technical Context & Guardrails

- **Digital Elevation Models (DEM):**
  - Open-Meteo Elevation API (`https://api.open-meteo.com/v1/elevation`) hỗ trợ lấy độ cao số dựa trên Copernicus DEM 30m/90m với cơ chế batch query tọa độ GPS.
  - Có thể kết hợp raster local / synthetic sampling hoặc API để tính toán ma trận độ dốc (Slope Gradient Matrix) dựa trên thuật toán Horn / Zevenbergen-Thorne.
- **Metric Coordinate Transformation (Quy tắc Không Gian Bất Biến):**
  - Tại vĩ độ Lào Cai (~$22.5^\circ\text{N}$), $1^\circ$ vĩ độ $\approx 110.7\text{ km}$, $1^\circ$ kinh độ $\approx 102.8\text{ km}$.
  - Tuyệt đối không tính độ dốc trực tiếp bằng $\frac{\Delta z}{\Delta \text{degree}}$ vì sẽ gây sai số tỉ lệ trầm trọng; bắt buộc quy đổi khoảng cách ngang sang mét ($dx = \Delta \text{lon} \times 111320 \times \cos(\text{lat})$, $dy = \Delta \text{lat} \times 110540$).
- **Database Schema Target:**
  - Bảng đích: `gis_schema.spatial_assessment_units`.
  - Các trường cần update: `slope_avg`, `slope_max`, `elevation_avg`, `relief_m`, `dem_source`, `dem_resolution_m`, `effective_resolution_m`, `updated_at`.
- **Downstream Consumer Contract:**
  - Kết quả địa hình từ Story 2.2 sẽ được kết hợp trực tiếp với chuỗi mưa từ Story 2.1 trong Story 2.3 (`as_of_feature_snapshots`) tạo thành vector đầu vào (feature vector) cho mô hình dự báo AI (Story 3.1 & 3.3).

---

## Tasks & Subtasks

- [x] **Task 1: Xây dựng Module Xử Lý Dữ Liệu Địa Hình (Terrain Engine)**
  - [x] 1.1 Tạo file `services/gis-service/app/pipeline/terrain_processor.py`.
  - [x] 1.2 Cài đặt thuật toán tính toán độ dốc (Slope) và độ chênh cao (Relief) theo công thức sai phân trung tâm kết hợp quy đổi khoảng cách mét địa phương.
  - [x] 1.3 Cài đặt cơ chế lọc Nodata (-9999, NaN, Inf) bảo đảm không làm sai lệch thống kê.
- [x] **Task 2: Xây dựng Terrain Provider / Client**
  - [x] 2.1 Tạo file `services/gis-service/app/pipeline/terrain_client.py`.
  - [x] 2.2 Hỗ trợ lấy lưới độ cao mẫu (Elevation Sampling Grid) qua Open-Meteo Elevation API hoặc DEM raster cục bộ.
- [x] **Task 3: Module Cập Nhật PostGIS Repository**
  - [x] 3.1 Tạo file `services/gis-service/app/pipeline/terrain_repository.py`.
  - [x] 3.2 Viết hàm cập nhật các chỉ số địa hình vào `gis_schema.spatial_assessment_units`.
  - [x] 3.3 Viết hàm truy vấn thông tin địa hình theo `unit_id`.
- [x] **Task 4: Tích Hợp FastAPI REST Endpoints**
  - [x] 4.1 Cập nhật `services/gis-service/app/main.py` thêm router `/api/v1/gis/terrain`.
  - [x] 4.2 Thêm endpoint `POST /api/v1/gis/terrain/extract` để trích xuất và cập nhật địa hình cho danh sách `unit_id`.
  - [x] 4.3 Thêm endpoint `GET /api/v1/gis/terrain/{unit_id}` trả về thông số địa hình của ô.
- [x] **Task 5: Kiểm Thử Tự Động (Unit & Integration Tests)**
  - [x] 5.1 Viết `services/gis-service/tests/test_terrain.py` kiểm tra logic tính slope, relief, elevation và nodata handling.
  - [x] 5.2 Cập nhật `services/gis-service/tests/run_tests.py` chạy toàn bộ test suite.
  - [x] 5.3 Chạy trích xuất thực tế cho 5 ô Pilot tại Lào Cai và kiểm tra dữ liệu trong PostGIS.

### Review Findings (AI Code Review - 2026-10-14)
- [x] [Review][Patch] Fix PostgreSQL connection leak by ensuring `conn.close()` in repository classes [`services/gis-service/app/pipeline/rainfall_repository.py:60`, `services/gis-service/app/pipeline/terrain_repository.py:53`]
- [x] [Review][Patch] Distinguish live DEM source from fallback synthetic data to preserve provenance [`services/gis-service/app/pipeline/terrain_client.py:65`]
- [x] [Review][Patch] Force odd integer grid size in DEM grid generator to prevent reshape crash on even dimensions [`services/gis-service/app/pipeline/terrain_client.py:34`]
- [x] [Review][Patch] Add null guard for centroid latitude/longitude in lazy rainfall fetch [`services/gis-service/app/main.py:145`]
- [x] [Review][Defer] Unify database connection parameters between repositories [`services/gis-service/app/pipeline/terrain_repository.py:16`] — deferred, pre-existing

---

## Dev Notes & Architecture Alignment

### 1. Phép Tính Độ Dốc Chuẩn (Slope Calculation Formula)
Cho một ô lưới độ cao có các điểm lân cận với bước lưới mét $dx, dy$:
$$\text{Slope} = \arctan\left(\sqrt{\left(\frac{\partial z}{\partial x}\right)^2 + \left(\frac{\partial z}{\partial y}\right)^2}\right) \times \frac{180}{\pi}$$
Với $\frac{\partial z}{\partial x} = \frac{z_{\text{east}} - z_{\text{west}}}{2 \cdot dx}$ và $\frac{\partial z}{\partial y} = \frac{z_{\text{north}} - z_{\text{south}}}{2 \cdot dy}$.

### 2. Dữ Liệu 5 Ô Pilot Lào Cai (Bát Xát & Sa Pa):
Các ô đơn vị mẫu đã có sẵn trong bảng `gis_schema.spatial_assessment_units`:
- `VN_LC_BATXAT_0001`: Ô 001 - Sườn Ta-luy Dốc Bản Qua (Bát Xát) -> elev: 549.36m, slope_avg: 23.76°, slope_max: 37.02°, relief: 50m
- `VN_LC_BATXAT_0002`: Ô 002 - Lưu Vực Suối Ngòi Phát (Bát Xát) -> elev: 621.56m, slope_avg: 33.41°, slope_max: 43.36°, relief: 82m
- `VN_LC_BATXAT_0003`: Ô 003 - Dốc Tỉnh Lộ 156B (Bát Xát) -> elev: 1099.64m, slope_avg: 27.3°, slope_max: 43.31°, relief: 70m
- `VN_LC_SAPA_0004`: Ô 004 - Thung Lũng Mường Hoa (Sa Pa) -> elev: 1158.84m, slope_avg: 30.3°, slope_max: 43.68°, relief: 69m
- `VN_LC_SAPA_0005`: Ô 005 - Ta-luy Đèo Ô Quy Hồ (Sa Pa) -> elev: 1726.0m, slope_avg: 23.17°, slope_max: 38.16°, relief: 50m

---

## Dev Agent Record

### Agent Model Used
Gemini 3.8 Flash (High) - Antigravity Dev Agent (Amelia)

### Completion Notes
- Đã hoàn tất 100% việc lập trình và kiểm thử Story 2.2:
  - Cài đặt `TerrainProcessor` với công thức quy đổi khoảng cách WGS84 ellipsoid sang mét, sai phân trung tâm tính gradient địa hình và cơ chế lọc nodata (-9999, NaN, Inf).
  - Cài đặt `OpenMeteoElevationClient` truy vấn Copernicus DEM 30m batch query theo tọa độ GPS và fallback generator khi offline.
  - Cài đặt `TerrainRepository` cập nhật an toàn dữ liệu địa hình vào `gis_schema.spatial_assessment_units` trong PostGIS.
  - Tích hợp 2 REST endpoints: `POST /api/v1/gis/terrain/extract` và `GET /api/v1/gis/terrain/{unit_id}`.
  - Chạy trích xuất thực tế cho cả 5 ô Pilot tại Lào Cai (Bát Xát & Sa Pa): các trường `elevation_avg`, `slope_avg`, `slope_max`, `relief_m`, `dem_source` đã được nạp thành công vào database.
  - Toàn bộ 7/7 tests (3 tests Story 2.1 + 4 tests Story 2.2) chạy thành công 100% trong 0.059s.

### File List
- `services/gis-service/app/pipeline/terrain_processor.py`
- `services/gis-service/app/pipeline/terrain_client.py`
- `services/gis-service/app/pipeline/terrain_repository.py`
- `services/gis-service/app/main.py`
- `services/gis-service/tests/test_terrain.py`
- `services/gis-service/tests/run_tests.py`
- `_bmad-output/implementation-artifacts/2-2-dem-terrain-feature-extraction.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
