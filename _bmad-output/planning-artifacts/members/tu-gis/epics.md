# Kế Hoạch Epics & Stories Chi Tiết — Thành Viên 2: TÚ
## Vai trò: GIS Pipeline & Data Engineer
**Phân hệ đảm nhiệm:** `services/gis-service/` & `database/`  
**Dự án:** GeoSentry (TerraWatch) - Hệ Thống Viễn Thám & AI Cảnh Báo Sớm Sạt Lở Đất  

---

### 1. Mục Tiêu & Trách Nhiệm Kỹ Thuật
- Xây dựng pipeline tự động crawl ảnh vệ tinh Sentinel-2 L2A từ Copernicus Data Space Ecosystem (CDSE) / Sentinel Hub API.
- Xử lý mặt nạ lọc mây (Cloud masking QA60 / s2cloudless).
- Tính các chỉ số viễn thám: biến động thực vật $\Delta\text{NDVI} = \text{NDVI}_{\text{post}} - \text{NDVI}_{\text{pre}}$, trích xuất độ dốc địa hình (Slope in degrees) từ DEM SRTM 30m.
- Module Tiling băm lưới AOI thành các patch $128 \times 128$ pixel.
- Thuật toán chuyển đổi kết quả mask sang vector polygon (Raster-to-Vector) WGS84 EPSG:4326.
- Quản trị CSDL không gian PostgreSQL 15 + PostGIS 3.3 (`gis_schema`) & Tile server phục vụ MVT cho WebGIS.
- Chuẩn bị lớp dữ liệu khu dân cư (OSM buildings / places) phục vụ xếp hạng mức nguy cơ (Story 3.4) và truy vấn không gian xác định người nhận cảnh báo theo vùng (Story 4.4).

---

### 2. Lộ Trình 5 Tuần Tốc Lực Của Tú

```
Tuần 1: Cài đặt rasterio, geopandas, pyproj; cấu hình PostGIS gis_schema, viết migration Flyway & seed data.
Tuần 2: Viết client kéo ảnh Sentinel-2 L2A qua Sentinel Hub API, thuật toán lọc mây, tính NDVI & DEM Slope.
Tuần 3: Xây dựng Tiling engine cắt ảnh 128x128 pixel; viết thuật toán Raster-to-Vector (polygonization).
Tuần 4: Tối ưu GiST spatial index trên PostGIS; dựng endpoint phục vụ Vector Tiles (MVT) / Raster Tiles.
Tuần 5: Chuẩn bị bộ dữ liệu viễn thám thực tế bão Yagi 2024 (Lào Cai / Yên Bái) phục vụ demo và bảo vệ đồ án.
```

---

### 3. Danh Sách Epics & User Stories Đảm Nhiệm

#### Story 1.2: PostGIS Schema-per-Service Migration & Spatial Indexes (Tuần 1 - Cùng Thuận)
As a Data Engineer,  
I want PostgreSQL 15 + PostGIS schemas (`core_schema`, `gis_schema`) configured with GiST spatial indexes and Flyway migration scripts,  
So that spatial queries on landslide hazard polygons execute in $< 50\text{ ms}$ with strict data isolation.  
**Acceptance Criteria:**
- Tạo bảng `gis_schema.monitoring_areas`, `gis_schema.satellite_scenes`, `gis_schema.raster_tiles`.
- Chỉ mục không gian `CREATE INDEX idx_monitoring_areas_geom ON gis_schema.monitoring_areas USING GIST (geom)`.
- Script `database/seed.sql` nạp tọa độ vùng giám sát mẫu tại Mù Cang Chải (Yên Bái) và Sa Pa (Lào Cai).

#### Story 2.1: Sentinel-2 Ingestion Pipeline & Cloud Masking Filter (Tuần 2)
As a GIS Data Engineer,  
I want an automated ingestion client that pulls Sentinel-2 L2A multi-spectral images for defined Areas of Interest (AOI) and filters out scenes with cloud coverage $> 40\%$,  
So that downstream AI models receive high-quality surface reflectance data.  
**Acceptance Criteria:**
- Kết nối tới Copernicus Data Space Ecosystem (CDSE) hoặc Sentinel Hub API.
- Thuật toán lọc mây dựa trên Scene Classification Layer (SCL / s2cloudless), loại bỏ các patch bị mây che phủ.
- Lưu trữ siêu dữ liệu ảnh tải về vào bảng `gis_schema.satellite_scenes`.

#### Story 2.2: Topographic Slope (SRTM DEM) & Vegetation Index ($\Delta\text{NDVI}$) Engine (Tuần 2)
As a GIS Data Engineer,  
I want a processor that computes NDVI difference ($\Delta\text{NDVI} = \text{NDVI}_{\text{post}} - \text{NDVI}_{\text{pre}}$) and extracts topographic slope degrees from SRTM 30m DEM,  
So that sudden loss of vegetation on steep slopes is quantitatively measured.  
**Acceptance Criteria:**
- Tính toán bản đồ biến động thực vật $\Delta\text{NDVI}$ giữa ảnh trước và sau thiên tai bằng `rasterio`.
- Trích xuất độ dốc địa hình theo độ $[0^\circ, 90^\circ]$ từ ảnh số độ cao SRTM DEM 30m.
- Đồng bộ hệ quy chiếu tọa độ chuẩn WGS84 EPSG:4326.

#### Story 2.3: Adaptive Tiling Engine & Bounding Box Patch Generator (Tuần 2 - 3)
As an AI Engineer,  
I want the GIS service to slice large satellite scenes into uniform $128 \times 128$ pixel patches with bounding box coordinates,  
So that patches match the input dimensions required by deep learning segmentation networks.  
**Acceptance Criteria:**
- Endpoint `/api/v1/gis/tiling` nhận Bounding Box của AOI và trả về danh sách tọa độ các patch $128 \times 128$.
- Băm lưới tính đến độ nén kinh độ theo vĩ độ ($111 \times \cos(\text{lat})$).
- Overlapping tile margins đảm bảo vết sạt lở ở mép không bị cắt đứt.

---

### 4. Hợp Đồng Giao Tiếp Với Các Thành Viên Khác (Input/Output Contracts)
- **Bàn giao cho Duẫn (AI):** Các patch ảnh $128 \times 128$ gồm 8 kênh phổ chuẩn hóa `[B2, B3, B4, B8, B11, B12, NDVI, SLOPE]`.
- **Nhận từ Duẫn (AI):** Mặt nạ nhị phân (Binary Mask) để Tú chạy thuật toán Raster-to-Vector thành đa giác GeoJSON.
- **Bàn giao cho Thuận (Backend):** Siêu dữ liệu cảnh vệ tinh và các đa giác vùng giám sát AOI lưu trong `gis_schema`.
- **Bàn giao cho Huy (WebGIS):** Cung cấp tile bản đồ vệ tinh và vector tiles qua endpoint `/tiles/{z}/{x}/{y}.pbf`.
- **Bàn giao cho Duẫn (AI):** Lớp khu dân cư để tính khoảng cách trong thuật toán xếp hạng mức nguy cơ.
- **Bàn giao cho Thuận (Backend):** Truy vấn PostGIS (`ST_DWithin` / `ST_Intersects`) lấy danh sách `alert_subscriptions` nằm trong vùng đệm sự cố / AOI khi Admin phát cảnh báo khẩn cấp.
