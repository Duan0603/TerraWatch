# Software Architecture Document (SAD) - GeoSentry (TerraWatch)

> **Hệ Thống Phát Hiện & Cảnh Báo Sạt Lở Đất Viễn Thám Đa Phân Hệ**  
> Kiến trúc tuân theo chuẩn **C4 Model** (Context, Container, Component, Deployment).

---

## 1. C4 Level 1: System Context Diagram (Ngữ Cảnh Hệ Thống)

Mô tả sự tương tác giữa các tác nhân người dùng, hệ thống GeoSentry và các hệ thống bên ngoài:

```mermaid
C4Context
    title System Context Diagram - GeoSentry
    
    Person(citizen, "Người Dân Vùng Núi", "Nhận cảnh báo sạt lở nguy cấp (kể cả khi mất sóng) và gửi báo cáo hiện trường")
    Person(officer, "Cán Bộ Thẩm Định", "Kiểm tra dữ liệu AI phát hiện, đối soát ảnh vệ tinh và phê duyệt cảnh báo")
    Person(admin, "Quản Trị Viên", "Cấu hình vùng giám sát (AOI), quản trị tài khoản và giám sát toàn hệ thống")

    System(geosentry, "GeoSentry Platform", "Thu thập ảnh vệ tinh, phân tích sạt lở bằng AI, quản lý nghiệp vụ và phát tán cảnh báo")

    System_Ext(sentinel, "ESA Copernicus / Sentinel Hub", "Cung cấp ảnh vệ tinh Sentinel-2 quang học đa phổ độ phân giải 10m")
    System_Ext(fcm, "Firebase Cloud Messaging", "Truyền phát thông báo đẩy (Push Notification) đến thiết bị di động")
    System_Ext(gee, "Google Earth Engine", "Cung cấp dữ liệu mô hình độ cao số (DEM) và chỉ số NDVI")

    Rel(citizen, geosentry, "Sử dụng Mobile App (Nhận cảnh báo, Gửi báo cáo)")
    Rel(officer, geosentry, "Sử dụng WebGIS Dashboard (Thẩm định sạt lở)")
    Rel(admin, geosentry, "Quản trị hệ thống qua WebGIS Dashboard")
    Rel(geosentry, sentinel, "Lập lịch tải ảnh vệ tinh định kỳ", "HTTPS/REST")
    Rel(geosentry, gee, "Truy vấn DEM và chỉ số địa hình", "REST API")
    Rel(geosentry, fcm, "Gửi thông điệp cảnh báo khẩn cấp", "FCM API")
```

---

## 2. C4 Level 2: Container Diagram (Kiến Trúc Container Microservices)

Các dịch vụ độc lập cấu thành hệ thống GeoSentry và giao thức liên kết:

```mermaid
C4Container
    title Container Diagram - GeoSentry Microservices Architecture

    Container(webgis, "WebGIS Dashboard", "React, Vite, Mapbox GL JS", "Giao diện bản đồ cho cán bộ & quản trị viên")
    Container(mobile, "Mobile App", "Flutter, Dart, SQLite", "Ứng dụng di động người dân có Geofencing ngoại tuyến")

    Container(core_api, "Core API Service", "NestJS, TypeScript", "Xác thực RBAC, thẩm định sự kiện, quản lý AOI, điều phối phát tán")
    Container(ai_service, "AI Inference Service", "Python, FastAPI, ONNX Runtime", "Phân đoạn ảnh sạt lở (DeepLabV3+/U-Net) trên Landslide4Sense")
    Container(gis_service, "GIS Data Service", "Python, FastAPI, Rasterio, GDAL", "Lọc mây, tính NDVI/Slope, Tiling và xuất Vector Tile MVT")

    ContainerDb(postgis, "Spatial Database", "PostgreSQL 15 + PostGIS 3.3", "Lưu trữ hình học không gian (WGS84), sự kiện sạt lở, AOI")
    ContainerDb(redis, "Queue & Cache", "Redis 7 Alpine", "Hàng đợi tác vụ bất đồng bộ và bộ đệm phân tán")

    Rel(webgis, core_api, "Truy vấn nghiệp vụ & thẩm định", "JSON/REST")
    Rel(webgis, gis_service, "Tải Mapbox Vector Tiles (MVT)", "Protobuf / PBF")
    Rel(mobile, core_api, "Đồng bộ điểm offline & gửi báo cáo", "JSON/REST")
    
    Rel(core_api, ai_service, "Yêu cầu suy luận AI trên patch", "HTTP/REST")
    Rel(core_api, gis_service, "Lập lịch phân tích & cắt ảnh", "HTTP/REST")
    Rel(core_api, postgis, "Đọc/ghi dữ liệu không gian", "TCP / SQL PostGIS")
    Rel(core_api, redis, "Đẩy việc phát tán cảnh báo", "Redis PubSub")
    Rel(gis_service, postgis, "Ghi dữ liệu Raster/Vector", "TCP / SQL")
```

---

## 3. C4 Level 3: Data Flow & Event Processing (Luồng Xử Lý Nghiệp Vụ)

Quy trình bán tự động (Semi-automated) từ lúc ảnh vệ tinh chụp đến khi người dân nhận chuông báo động:

```mermaid
sequenceDiagram
    autonumber
    participant Sat as Vệ tinh Sentinel-2
    participant GIS as GIS Service
    participant AI as AI Service
    participant Core as Core API
    participant DB as PostGIS DB
    participant Officer as Cán bộ Thẩm định
    participant Mobile as Mobile App (Offline)

    Sat->>GIS: Chụp ảnh mới khu vực giám sát (AOI)
    GIS->>GIS: Lọc mây (Cloud Masking), tính ΔNDVI & Độ dốc
    GIS->>GIS: Cắt ảnh thành các patch 2km x 2km (Tiling)
    GIS->>AI: Gửi patch đa phổ (B2, B3, B4, B8, B11, B12, NDVI, Slope)
    AI->>AI: Chạy mô hình DeepLabV3+ ONNX, vector hóa thành Polygon
    AI->>Core: Trả về kết quả phát hiện (Confidence, Polygon, Slope)
    Core->>DB: Lưu sự kiện sạt lở mới (Status = 'pending')
    DB-->>Core: Trigger tự động tính ST_Area (m2) và ST_Centroid
    
    Officer->>Core: Truy cập hàng đợi thẩm định (WebGIS)
    Core-->>Officer: Hiển thị so sánh ảnh trước/sau & chỉ số
    Officer->>Core: Phê duyệt (Status = 'verified', Mức độ: 'extreme')
    Core->>DB: Cập nhật sự kiện thành verified
    Core->>Mobile: Phát tán cảnh báo FCM & Cập nhật điểm nguy cơ
    Mobile->>Mobile: Lưu vào SQLite cục bộ
    Note over Mobile: Khi người dân đi vào bán kính 500m<br/>App rung chuông cảnh báo dù mất 4G hoàn toàn!
```

---

## 4. Đáp Ứng Yêu Cầu Phi Chức Năng (Non-Functional Requirements)

| Tiêu chuẩn NFR | Đặc tả kỹ thuật | Giải pháp kiến trúc đáp ứng |
| :--- | :--- | :--- |
| **NFR1: Hiệu năng** | Xử lý diện tích 200 km² dưới 10 phút | Cơ chế Tiling chia nhỏ thành các patch 2km, phân tán batch inference trên ONNX Runtime. |
| **NFR2: Ngoại tuyến** | Lưu trữ ≥ 10,000 điểm nguy cơ trên di động | Cơ chế đồng bộ nén GeoJSON vào SQLite nội bộ trên Flutter, tính toán cục bộ qua Ray Casting & Haversine. |
| **NFR3: Độ chính xác** | F1-Score ≥ 0.70 trên tập test độc lập | Mô hình DeepLabV3+ kết hợp 8 kênh đặc trưng (Spectral + Topographic) đạt F1 0.768 trên Landslide4Sense. |
| **NFR4: Tiêu chuẩn GIS** | Chuẩn OGC WMS/WFS, EPSG:4326 | Sử dụng PostGIS chuẩn OGC, phân phối dữ liệu dạng Mapbox Vector Tile (MVT PBF) và GeoJSON chuẩn. |
| **NFR5: Bảo mật quyền riêng tư** | Không lưu trữ vị trí cá nhân lên server | Thuật toán Geofencing chạy 100% Client-side; máy chủ chỉ phát tán các đa giác vùng sạt lở. |
