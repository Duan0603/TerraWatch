# Software Architecture Document (SAD) - GeoSentry (TerraWatch)

> **Hệ Thống Phát Hiện & Cảnh Báo Sạt Lở Đất Viễn Thám Đa Phân Hệ**  
> Kiến trúc tuân theo chuẩn **C4 Model** (Context, Container, Component, Deployment) và đáp ứng toàn diện **8 thành phần cốt lõi của hệ thống Microservices doanh nghiệp**.

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

Các dịch vụ độc lập cấu thành hệ thống GeoSentry cùng API Gateway và Event Bus:

```mermaid
C4Container
    title Container Diagram - GeoSentry Microservices Architecture

    Container(webgis, "WebGIS Dashboard", "React 18, Mapbox GL JS", "Giao diện bản đồ cho cán bộ & quản trị viên")
    Container(mobile, "Mobile App", "Flutter 3.x, SQLite", "Ứng dụng di động người dân có Geofencing ngoại tuyến")

    Container(gateway, "API Gateway", "Nginx Reverse Proxy (Port 8080)", "Single Entry Point: Định tuyến, Rate Limiting, CORS, Gzip")

    Container(core_api, "Core API Service", "Java 17, Spring Boot 3", "Xác thực RBAC, thẩm định sự kiện, quản lý AOI, Circuit Breaker (Resilience4j)")
    Container(ai_service, "AI Inference Service", "Python 3.11, FastAPI, ONNX", "Phân đoạn ảnh sạt lở (DeepLabV3+) trên Landslide4Sense, Event Listener")
    Container(gis_service, "GIS Data Service", "Python 3.11, FastAPI, GDAL", "Lọc mây, tính NDVI/Slope, Tiling và xuất Vector Tile MVT")

    ContainerDb(postgis, "Spatial Database", "PostgreSQL 15 + PostGIS 3.3", "Lưu trữ hình học không gian (WGS84), phân chia Logical Schema-per-Service")
    ContainerDb(redis, "Message Broker & Event Bus", "Redis 7 Alpine", "Kênh phát tán sự kiện Pub/Sub và bộ đệm phân tán")

    Rel(webgis, gateway, "Gọi API & Tải Tiles", "HTTP/JSON")
    Rel(mobile, gateway, "Đồng bộ điểm offline & gửi báo cáo", "HTTP/JSON")

    Rel(gateway, webgis, "Phục vụ Static SPA Assets", "HTTP")
    Rel(gateway, core_api, "Chuyển tiếp /api/v1/core/*, /landslides/*", "Reverse Proxy")
    Rel(gateway, ai_service, "Chuyển tiếp /api/v1/ai/*", "Reverse Proxy")
    Rel(gateway, gis_service, "Chuyển tiếp /api/v1/gis/*, /tiles/*", "Reverse Proxy")
    
    Rel(core_api, ai_service, "Gọi suy luận AI (Resilience4j Circuit Breaker)", "HTTP/REST")
    Rel(core_api, gis_service, "Yêu cầu cắt ảnh & siêu dữ liệu vệ tinh", "HTTP/REST")
    Rel(core_api, postgis, "Đọc/ghi core_schema", "TCP / SQL PostGIS")
    Rel(gis_service, postgis, "Đọc/ghi gis_schema", "TCP / SQL PostGIS")

    Rel(core_api, redis, "Publish sự kiện (LANDSLIDE_VERIFIED,...)", "Redis Pub/Sub")
    Rel(redis, ai_service, "Subscribe & kích hoạt batch inference ngầm", "Redis Pub/Sub")
```

---

## 3. C4 Level 3: Event-Driven & Fault Tolerance Processing

### A. Cơ chế Ngắt Mạch (Circuit Breaker Pattern - Resilience4j)

Nhằm chống sập dây chuyền (Cascading Failures) khi `ai-service` hoặc `gis-service` bị quá tải hoặc hết bộ nhớ GPU:

```mermaid
stateDiagram-v2
    [*] --> Closed: Bình thường (Mọi request đi qua)
    Closed --> Open: Tỷ lệ lỗi >= 50% trong 10 calls gần nhất
    Open --> HalfOpen: Sau 5 giây (waitDurationInOpenState)
    HalfOpen --> Closed: 3 calls thử nghiệm thành công
    HalfOpen --> Open: Vẫn thất bại
    
    note right of Open
      Khi Open State:
      Core API lập tức kích hoạt Fallback:
      Trả về kết quả dự phòng và đưa request
      vào hàng đợi xử lý ngầm,
      Core API KHÔNG BAO GIỜ BỊ SẬP!
    end note
```

### B. Luồng Sự Kiện Bất Đồng Bộ (Event Bus - Redis Pub/Sub)

```mermaid
sequenceDiagram
    autonumber
    participant Officer as Cán bộ Thẩm định
    participant Core as Core API (Spring Boot)
    participant Redis as Redis Event Bus (Broker)
    participant AI as AI Service (FastAPI)
    participant Mobile as Mobile App (Flutter)

    Officer->>Core: Phê duyệt điểm sạt lở (POST /api/v1/landslides/{id}/verify)
    Core->>Core: Cập nhật CSDL core_schema.landslide_events
    Core->>Redis: Publish Event: "LANDSLIDE_VERIFIED" (kèm tọa độ, mức độ nguy hiểm)
    
    par Phát tán song song
        Redis-->>Mobile: FCM Push Notification khẩn cấp đến thiết bị di động
    and
        Redis-->>AI: Bắn tín hiệu cập nhật Retrain Dataset & Spatial Cache
    end
```

---

## 4. Đáp Ứng Yêu Cầu Phi Chức Năng (Non-Functional Requirements)

| Tiêu chuẩn NFR | Đặc tả kỹ thuật | Giải pháp kiến trúc đáp ứng |
| :--- | :--- | :--- |
| **NFR1: Hiệu năng** | Xử lý diện tích 200 km² dưới 10 phút | Cơ chế Tiling chia nhỏ thành các patch 2km, phân tán batch inference trên ONNX Runtime. |
| **NFR2: Ngoại tuyến** | Lưu trữ ≥ 10,000 điểm nguy cơ trên di động | Cơ chế đồng bộ nén GeoJSON vào SQLite nội bộ trên Flutter, tính toán cục bộ qua Ray Casting & Haversine. |
| **NFR3: Độ chính xác** | F1-Score ≥ 0.70 trên tập test độc lập | Mô hình DeepLabV3+ kết hợp 8 kênh đặc trưng (Spectral + Topographic) đạt F1 0.768 trên Landslide4Sense. |
| **NFR4: Tiêu chuẩn GIS** | Chuẩn OGC WMS/WFS, EPSG:4326 | Sử dụng PostGIS chuẩn OGC, phân phối dữ liệu dạng Mapbox Vector Tile (MVT PBF) và GeoJSON chuẩn. |
| **NFR5: Khả năng chịu lỗi** | Cách ly lỗi, không sập toàn hệ thống | Tích hợp **Resilience4j Circuit Breaker**: khi AI Service chết tiến trình, Core API tự động ngắt mạch và kích hoạt Fallback. |

---

## 5. Kiến Trúc Cơ Sở Dữ Liệu: Logical Schema-per-Service (Phương Án A)

Trong kiến trúc Microservices chuyên sâu về xử lý không gian (Spatial Computing), việc tách rời hoàn toàn database vật lý (Physical Database-per-service) sẽ gây ra độ trễ mạng lớn và loại bỏ các toán tử tính toán hình học native của PostGIS (`ST_DWithin`, `ST_Intersects`). Do đó, hệ thống GeoSentry áp dụng mô hình **Logical Schema-per-Service (Phương án A)**:

```
PostgreSQL 15 + PostGIS (terrawatch)
├── public (Shared Spatial Engine)
│   ├── postgis (Hàm hình học ST_*, chỉ mục GIST)
│   ├── uuid-ossp (Sinh khóa định danh toàn cầu)
│   └── schema_migrations (Lịch sử thực thi migration)
│
├── core_schema (Core API Microservice - Spring Boot 3)
│   ├── users (Quản lý người dùng, phân quyền RBAC)
│   ├── landslide_events (Sự kiện sạt lở, đa giác hình học, điểm rủi ro)
│   ├── landslide_event_history (Audit Trail truy vết thẩm định)
│   ├── community_reports (Báo cáo cộng đồng crowdsourcing)
│   ├── v_active_landslide_zones (Spatial View vùng đệm nguy hiểm 500m)
│   └── Triggers: fn_update_landslide_metrics(), fn_log_landslide_verification()
│
└── gis_schema (GIS Data Service - FastAPI / Python)
    └── monitoring_areas (Khu vực giám sát trọng điểm AOI)
```

---

## 6. Đối Soát Toàn Diện 8 Thành Phần Cốt Lõi Microservices

Hệ thống GeoSentry đã hoàn thiện đầy đủ 8 thành phần cấu thành kiến trúc Microservices tiêu chuẩn công nghiệp:

| STT | Thành phần cốt lõi | Hiện thực hóa trong TerraWatch | Công nghệ sử dụng |
| :---: | :--- | :--- | :--- |
| **1** | **Client (Web, Mobile)** | WebGIS Command Center & Mobile App Offline Geofencing | React 18, Mapbox GL JS, Flutter 3.x, SQLite |
| **2** | **API Gateway** | Điểm vào duy nhất (Port 8080): định tuyến, Rate Limiting (50 req/s), CORS, Gzip | Nginx Reverse Proxy (`gateway/`) |
| **3** | **Service Discovery** | Định danh và phân giải địa chỉ động qua tên container nội bộ | Docker Container Internal DNS (`terrawatch-net`) |
| **4** | **Microservices (Vi dịch vụ)** | Các service độc lập theo chuẩn Bounded Context (Core API, AI Service, GIS Service) | Java 17 Spring Boot 3, Python 3.11 FastAPI |
| **5** | **Database per Service** | Phân chia Logical Schema-per-Service đảm bảo cô lập dữ liệu và tối ưu PostGIS | PostgreSQL 15, PostGIS 3.3 (`core_schema`, `gis_schema`) |
| **6** | **Message Broker / Event Bus** | Kênh giao tiếp bất đồng bộ, phát tán sự kiện thẩm định sạt lở | Redis 7 Alpine Pub/Sub (`terrawatch:events`) |
| **7** | **Configuration Management** | Quản lý cấu hình tập trung theo chuẩn Twelve-Factor App | Biến môi trường `.env`, Docker Compose Config Profiles |
| **8** | **Circuit Breaker / Resilience** | Ngắt mạch tự động chống sập lan truyền khi AI/GIS service gặp sự cố | Resilience4j Spring Boot 3 (`@CircuitBreaker`) |
