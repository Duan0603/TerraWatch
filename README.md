<div align="center">

# 🛰️ GEOSENTRY (TERRAWATCH)
### HỆ THỐNG VIỄN THÁM, TRÍ TUỆ NHÂN TẠO & MÔ HÌNH 3D CẢNH BÁO SỚM & HỖ TRỢ CỨU HỘ SẠT LỞ ĐẤT
**Đồ Án Tốt Nghiệp Kỹ Sư Phần Mềm (Software Engineering Capstone Project)**

[![CI Core API](https://img.shields.io/badge/CI_Core_API-Spring_Boot_3_Maven-6DB33F?logo=github-actions&logoColor=white)](.github/workflows/ci-core-api.yml)
[![CI AI Service](https://img.shields.io/badge/CI_AI-Python_FastAPI-009688?logo=github-actions&logoColor=white)](.github/workflows/ci-ai-service.yml)
[![CI WebGIS](https://img.shields.io/badge/CI_WebGIS-React_18_+_Vite-61DAFB?logo=github-actions&logoColor=black)](.github/workflows/ci-webgis.yml)
[![Docker Orchestration](https://img.shields.io/badge/Orchestrator-Docker_Compose-2496ED?logo=docker&logoColor=white)](docker-compose.yml)
[![API Gateway](https://img.shields.io/badge/Gateway-Nginx_Reverse_Proxy-009639?logo=nginx&logoColor=white)](gateway)
[![Fault Tolerance](https://img.shields.io/badge/Resilience-Circuit_Breaker-red?logo=apache&logoColor=white)](services/core-api)
[![Defense Slides](https://img.shields.io/badge/Presentation-10_Slides_PPTX-orange?logo=microsoftpowerpoint&logoColor=white)](docs/GeoSentry_Capstone_Presentation.pptx)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

<br/>

[📌 Tổng Quan](#-1-tổng-quan-đề-tài--giải-pháp) • 
[👥 Phân Công 5 Thành Viên](#-2-phân-công-vai-trò-5-thành-viên-wbs) • 
[🏛️ Kiến Trúc Microservices](#-3-kiến-trúc-hệ-thống-chuẩn-8-thành-phần) • 
[📁 Cấu Trúc Toàn Bộ Dự Án](#-4-cấu-trúc-toàn-bộ-dự-án--thư-mục-tài-liệu) • 
[⚙️ Thiết Lập File .env](#-5-hướng-dẫn-thiết-lập-file-cấu-hình-env) • 
[🚀 Cách Chạy Dự Án](#-6-hướng-dẫn-khởi-chạy-dự-án-chi-tiết) • 
[🗄️ CSDL: Migration & JPA](#-7-hướng-dẫn-vận-hành-csdl-từ-migration-đến-spring-data-jpa) • 
[🌐 Danh Mục Cổng Dịch Vụ](#-8-danh-mục-cổng-dịch-vụ--api-gateway-routing) • 
[🤖 Quy Trình BMAD Dev](#-9-hướng-dẫn-dùng-bmad-slash-commands-cho-nhóm)

</div>

---

## 📌 1. Tổng Quan Đề Tài & Giải Pháp

Hệ thống **GeoSentry (TerraWatch)** là giải pháp công nghệ viễn thám, trí tuệ nhân tạo và địa không gian 3D toàn diện nhằm giám sát, cảnh báo sớm và hỗ trợ điều phối cứu hộ thiên tai sạt lở đất tại các tỉnh miền núi phía Bắc Việt Nam (Yên Bái, Lào Cai, Hà Giang — giải quyết bài toán thực tế sau thảm họa bão Yagi 2024 tại Làng Nủ).

### 4 Trụ Cột Đột Phá Của Hệ Thống:
1. **Viễn thám diện rộng (Sentinel-2 & DEM 30m):** Tự động lọc mây, tính toán chỉ số biến động thực vật $\Delta\text{NDVI}$ và góc dốc sườn núi từ ảnh độ cao số SRTM 30m.
2. **AI Semantic Segmentation & Rescue Route:** Mô hình DeepLabV3+ ONNX Runtime (huấn luyện trên benchmark quốc tế *Landslide4Sense*, $F_1 = 0.768$) phân đoạn đa giác sạt lở và thuật toán AI A* gợi ý tuyến đường tiếp cận hiện trường né tránh vùng nguy hiểm.
3. **WebGIS 3D Command Center:** Giao diện điều phối trực quan trên nền bản đồ số Mapbox 3D Terrain, thanh trượt so sánh ảnh trước/sau và mô hình 3D hiện trường (🔴 Danger Zone, 🟢 Victim, ⚠ Hazard, 🚒 Rescue Route).
4. **Geofencing Ngoại Tuyến (Offline-First Mobile App):** Lưu trữ sẵn 10,000 đa giác sạt lở trong SQLite cục bộ trên điện thoại; tự động **rung chuông còi hú âm lượng tối đa** cứu mạng người dân khi bước vào vùng nguy hiểm ngay cả khi mất sạch 100% sóng 4G/Internet.

---

## 👥 2. Phân Công Vai Trò 5 Thành Viên (WBS)

Toàn bộ kế hoạch công việc chi tiết của từng thành viên đã được chia thành **5 thư mục riêng biệt** trong [`_bmad-output/planning-artifacts/members/`](_bmad-output/planning-artifacts/members/):

| STT | Thành viên | Vai trò chuyên môn | Phân hệ code chính | Kế hoạch & User Stories chi tiết |
| :---: | :---: | :--- | :--- | :--- |
| **1** | **Duẫn** | **AI / Computer Vision Engineer** | [`services/ai-service/`](services/ai-service) | 📂 [Kế hoạch Epics của Duẫn](_bmad-output/planning-artifacts/members/duan-ai/epics.md)<br/>- Dataset Landslide4Sense, tiền xử lý 8 kênh tensor<br/>- DeepLabV3+ ONNX Runtime suy luận $< 300\text{ ms}$<br/>- Thuật toán AI Rescue Route A* né Danger Zone |
| **2** | **Tú** | **GIS Pipeline & Data Engineer** | [`services/gis-service/`](services/gis-service)<br/>[`database/`](database) | 📂 [Kế hoạch Epics của Tú](_bmad-output/planning-artifacts/members/tu-gis/epics.md)<br/>- Crawl Sentinel-2 L2A qua Copernicus / Sentinel Hub API<br/>- Lọc mây SCL, tính $\Delta\text{NDVI}$, độ dốc SRTM DEM 30m<br/>- Tiling $128 \times 128$, Raster-to-Vector PostGIS, Vector Tiles |
| **3** | **Thuận** | **Backend Engineer & Architect** | [`services/core-api/`](services/core-api)<br/>[`gateway/`](gateway) | 📂 [Kế hoạch Epics của Thuận](_bmad-output/planning-artifacts/members/thuan-backend/epics.md)<br/>- Core API Spring Boot 3, Spring Security 6 & JWT 4 roles<br/>- Resilience4j Circuit Breaker chống sập lan truyền<br/>- Redis Pub/Sub Event Bus 2 chiều, FCM Push, Gateway Nginx |
| **4** | **Huy** | **Frontend WebGIS Engineer** | [`apps/webgis/`](apps/webgis) | 📂 [Kế hoạch Epics của Huy](_bmad-output/planning-artifacts/members/huy-webgis/epics.md)<br/>- React 18 / Next.js + Tailwind CSS, Mapbox GL 3D Terrain<br/>- Thanh trượt so sánh ảnh đa thời gian (Time-slider swipe)<br/>- Hàng đợi duyệt sạt lở 1-click & Mô hình 3D Hiện trường |
| **5** | **Lâm** | **Mobile App Engineer** | [`apps/mobile/`](apps/mobile) | 📂 [Kế hoạch Epics của Lâm](_bmad-output/planning-artifacts/members/lam-mobile/epics.md)<br/>- Ứng dụng Flutter 3.x, SQLite cache 10,000 đa giác sạt lở<br/>- Background Geolocation, Ray-Casting & Haversine ngoại tuyến<br/>- Còi hú khẩn cấp khi mất mạng, Nút SOS 1-chạm & Live Tracking |

---

## 🏛️ 3. Kiến Trúc Hệ Thống: Chuẩn 8 Thành Phần

```mermaid
graph TD
    subgraph Clients ["1. Clients (Giao Diện Đa Nền Tảng)"]
        WebGIS["🖥️ WebGIS Command Center (React 18 + Mapbox 3D)"]
        MobileApp["📱 Mobile Citizen App (Flutter 3.x + SQLite Offline Geofencing)"]
    end

    subgraph GatewayLayer ["2. API Gateway (Single Entry Point)"]
        APIGateway["🚪 Nginx Reverse Proxy (Port 8080)<br/>Định tuyến, Rate Limiting (50 r/s), Global CORS, Gzip"]
    end

    subgraph ServiceDiscovery ["3. Service Discovery & Networking"]
        DockerDNS["🌐 Container Internal DNS Engine (terrawatch-net)<br/>Phân giải IP nội bộ giữa các microservices"]
    end

    subgraph Services ["4. Microservices (Vi Dịch Vụ Độc Lập)"]
        CoreAPI["⚙️ Core API Service (Java 17 + Spring Boot 3)<br/>Port 3000 | RBAC 4 Roles, Thẩm định sạt lở, Quản lý AOI"]
        AIService["🧠 AI Inference Service (Python FastAPI)<br/>Port 8001 | DeepLabV3+ ONNX, AI Rescue Route A*"]
        GISService["🗺️ GIS Data Service (Python FastAPI)<br/>Port 8002 | Sentinel-2 Ingestion, NDVI, DEM Slope, Tiling, MVT"]
    end

    subgraph Resilience ["8. Circuit Breaker & Fault Tolerance"]
        CB["🛡️ Resilience4j Circuit Breaker<br/>Tự động ngắt mạch (Open) & kích hoạt Fallback khi AI/GIS service sập"]
    end

    subgraph EventBroker ["6. Message Broker & Event Bus"]
        RedisBus["⚡ Redis 7 Pub/Sub (Port 6379)<br/>Channel: 'terrawatch:events' | Đồng bộ sự kiện bất đồng bộ 2 chiều"]
    end

    subgraph DataLayer ["5. Database per Service (Logical Schema-per-Service)"]
        PostGIS[("🐘 PostgreSQL 15 + PostGIS 3.3 (Port 5432)<br/>├── public: PostGIS native engine ST_*, UUID, migrations<br/>├── core_schema: users, landslide_events, history, sos_requests<br/>└── gis_schema: monitoring_areas AOIs, satellite_scenes, tiles")]
    end

    subgraph ConfigLayer ["7. Configuration Management"]
        ConfigEnv["⚙️ Twelve-Factor Config (.env, Docker Environment Variables)"]
    end

    WebGIS -->|HTTP 8080| APIGateway
    MobileApp -->|HTTP 8080| APIGateway

    APIGateway -->|/api/v1/auth/*, /api/v1/core/*, /landslides/*| CoreAPI
    APIGateway -->|/api/v1/ai/*| AIService
    APIGateway -->|/api/v1/gis/*, /tiles/*| GISService
    APIGateway -->|/| WebGIS

    CoreAPI -.->|Bọc bởi Circuit Breaker| AIService
    CoreAPI -.->|Bọc bởi Circuit Breaker| GISService
    CoreAPI -->|Publish Events| RedisBus
    RedisBus -->|Subscribe & Async Inference| AIService

    CoreAPI <-->|core_schema| PostGIS
    GISService <-->|gis_schema| PostGIS
```

---

## 📁 4. Cấu Trúc Toàn Bộ Dự Án & Thư Mục Tài Liệu

```
SECapstone/
├── _bmad-output/                           # [Tài Liệu Quy Hoạch & Kế Hoạch Sprint BMAD]
│   ├── planning-artifacts/                 # Tài liệu thiết kế sản phẩm & kỹ thuật
│   │   ├── prd.md                          # Product Requirements Document (PRD v3.1)
│   │   ├── architecture.md                 # System Architecture Document (SAD)
│   │   ├── epics.md                        # Toàn bộ 8 Epics & 25 User Stories dự án
│   │   └── members/                        # THƯ MỤC EPICS RIÊNG CỦA 5 THÀNH VIÊN
│   │       ├── duan-ai/epics.md            # Kế hoạch của Duẫn (AI / CV)
│   │       ├── tu-gis/epics.md             # Kế hoạch của Tú (GIS Pipeline)
│   │       ├── thuan-backend/epics.md      # Kế hoạch của Thuận (Backend & Arch)
│   │       ├── huy-webgis/epics.md         # Kế hoạch của Huy (Frontend WebGIS)
│   │       └── lam-mobile/epics.md         # Kế hoạch của Lâm (Mobile App)
│   └── implementation-artifacts/           # Theo dõi tiến độ thi công code
│       ├── sprint-status.yaml              # File trạng thái sprint toàn nhóm (BMAD)
│       └── 1-1-multi-role-user-registration-authentication-register-login-jwt.md # Story 1.1 ready-for-dev
├── docs/                                   # [Tài Liệu Thuyết Trình & Đặc Tả Kỹ Thuật]
│   ├── GeoSentry_Capstone_Presentation.pptx # 📽️ Slide PowerPoint 10 trang thiết kế Dark Theme 16:9
│   ├── PRESENTATION_SLIDES.md              # 📑 Bản đọc slide Markdown chi tiết
│   ├── ARCHITECTURE.md                     # Tài liệu kiến trúc C4 Model
│   ├── AI_MODEL_CARD.md                    # Hồ sơ mô hình DeepLabV3+ (Landslide4Sense)
│   └── microservices-setup-guide.md        # Hướng dẫn thiết lập repo & quy ước Git
├── gateway/                                # [API Gateway Nginx - Port 8080]
│   ├── nginx.conf                          # Định tuyến reverse proxy, Rate Limit, CORS, Gzip
│   └── Dockerfile                          # Nginx 1.25 Alpine
├── database/                               # [Quản Lý CSDL Địa Không Gian PostGIS 15]
│   ├── init.sql                            # DDL Schema-per-Service (core_schema, gis_schema)
│   ├── seed.sql                            # Dữ liệu mẫu Yên Bái, Lào Cai, Hà Giang
│   └── migrations/                         # Flyway migration tuần tự (V1, V2)
├── services/                               # [Các Microservices Độc Lập]
│   ├── core-api/                           # [Java 17 + Spring Boot 3 - Port 3000] Thuận phụ trách
│   │   ├── pom.xml                         # Spring Security 6, JPA, Resilience4j, Redis, Flyway
│   │   ├── Dockerfile                      # Multi-stage build (Maven 3.9 + Temurin 17 JRE)
│   │   └── src/main/java/vn/terrawatch/core/
│   │       ├── client/                     # Clients gọi liên service bọc Circuit Breaker
│   │       ├── config/                     # SecurityConfig, AppConfig
│   │       ├── controller/                 # REST Controllers (Auth, Landslides, SOS, Diagnostic)
│   │       ├── entity/                     # JPA Entities (User, LandslideEvent, MonitoringArea)
│   │       ├── event/                      # Redis Pub/Sub EventPublisher & Consumer
│   │       └── repository/                 # JpaRepositories + SpatialRepository (Native PostGIS)
│   ├── ai-service/                         # [Python 3.11 + FastAPI - Port 8001] Duẫn phụ trách
│   │   ├── app/
│   │   │   ├── main.py                     # Endpoints /api/v1/inference, /health
│   │   │   └── services/                   # inference.py (ONNX Runtime), event_listener.py
│   │   ├── models/                         # Thư mục chứa trọng số landslide_deeplabv3plus.onnx
│   │   ├── requirements.txt
│   │   └── Dockerfile
│   └── gis-service/                        # [Python 3.11 + FastAPI - Port 8002] Tú phụ trách
│       ├── app/
│       │   ├── main.py                     # Endpoints /api/v1/gis/tiling, /query-satellite, /tiles
│       │   └── pipeline/processor.py       # Tính toán NDVI, DEM Slope, Tiling, Vector Tiles
│       ├── requirements.txt
│       └── Dockerfile
├── apps/                                   # [Ứng Dụng Client Đa Nền Tảng]
│   ├── webgis/                             # [React 18 + Vite - Port 5173 / 8080] Huy phụ trách
│   │   ├── src/                            # App.jsx, MapContainer, 3D Terrain, Time-slider
│   │   ├── package.json
│   │   └── Dockerfile                      # Nginx serving static SPA bundle
│   └── mobile/                             # [Flutter 3.x] Lâm phụ trách
│       ├── lib/                            # main.dart, services/geofencing_service.dart
│       └── pubspec.yaml                    # sqflite, geolocator, flutter_background_geolocation
├── scripts/                                # [Công Cụ Tự Động Hóa & CLI]
│   ├── generate_slides.py                  # Script python-pptx sinh slide thuyết trình
│   └── migrate.py                          # CLI tool kiểm soát migration CSDL
├── docker-compose.yml                      # Điều phối khởi chạy toàn bộ 7 services
├── Makefile                                # Bộ phím tắt điều hành dự án 1 lệnh & demo
└── .env.example                            # Mẫu biến môi trường đầy đủ
```

---

## ⚙️ 5. Hướng Dẫn Thiết Lập File Cấu Hình `.env`

Trước khi khởi chạy hệ thống, sao chép file `.env.example` thành `.env`:

```bash
# Trên Linux / macOS / Git Bash:
cp .env.example .env

# Trên Windows PowerShell:
Copy-Item .env.example .env
```

### Bảng Giải Thích Chi Tiết Các Biến Môi Trường Trong `.env`:

| Biến môi trường | Giá trị mặc định trong `.env.example` | Ý nghĩa kỹ thuật | Phân hệ sử dụng |
| :--- | :--- | :--- | :--- |
| `POSTGRES_USER` | `postgres` | Tài khoản quản trị CSDL PostGIS | PostGIS, Core API, GIS Service |
| `POSTGRES_PASSWORD` | `postgrespassword` | Mật khẩu truy cập PostgreSQL | PostGIS, Core API, GIS Service |
| `POSTGRES_DB` | `terrawatch` | Tên cơ sở dữ liệu chính | PostGIS, Core API, GIS Service |
| `DATABASE_URL` | `postgresql://postgres:postgrespassword@localhost:5432/terrawatch` | Chuỗi kết nối CSDL chuẩn PostgreSQL | GIS Service, Migrate script |
| `JDBC_DATABASE_URL` | `jdbc:postgresql://postgres:5432/terrawatch` | Chuỗi kết nối JDBC cho Java Spring Boot | Core API |
| `REDIS_HOST` | `localhost` (hoặc `redis` trong Docker) | Địa chỉ máy chủ Redis Message Broker | Core API, AI Service |
| `REDIS_PORT` | `6379` | Cổng kết nối Redis | Core API, AI Service |
| `REDIS_EVENT_CHANNEL` | `terrawatch:events` | Tên channel trao đổi sự kiện bất đồng bộ | Core API, AI Service |
| `SERVER_PORT` | `3000` | Cổng lắng nghe nội bộ của Core API | Core API |
| `JWT_SECRET` | `terrawatch_super_secret_jwt_key_...` | Khóa bí mật ký token JWT xác thực người dùng | Core API |
| `JWT_EXPIRATION_MS` | `86400000` (24 giờ) | Thời hạn hiệu lực của token đăng nhập | Core API |
| `CORE_API_URL` | `http://localhost:3000` | URL gọi Core API từ Gateway/WebGIS | Gateway, WebGIS |
| `AI_SERVICE_URL` | `http://localhost:8001` | URL gọi AI Inference Service | Core API, Gateway |
| `GIS_SERVICE_URL` | `http://localhost:8002` | URL gọi GIS Pipeline Service | Core API, Gateway |
| `MAPBOX_ACCESS_TOKEN` | `pk.placeholder_mapbox_token` | Token hiển thị bản đồ số Mapbox 3D Terrain | WebGIS |
| `NASA_FIRMS_MAP_KEY` | `placeholder_nasa_firms_key` | Khóa API vệ tinh NASA FIRMS | GIS Service |
| `SENTINEL_HUB_CLIENT_ID` | `placeholder_sentinel_client_id` | Khóa xác thực Copernicus / Sentinel Hub | GIS Service |

---

## 🚀 6. Hướng Dẫn Khởi Chạy Dự Án Chi Tiết

Dự án hỗ trợ **3 hình thức làm việc linh hoạt** tùy theo nhu cầu:
1. **CÁCH 1:** Khởi chạy toàn bộ hệ thống bằng Docker Compose (Khuyên dùng khi chạy demo toàn diện hoặc bảo vệ đồ án).
2. **⚡ MÔ HÌNH DEV SIÊU TỐC (KẾT HỢP CÁCH 1 & CÁCH 3 - KHUYÊN DÙNG HÀNG NGÀY):** Không bao giờ phải tắt đi compose lại từ đầu! Tận dụng Hot-Reload trong Docker hoặc chạy local kết hợp Docker nền.
3. **CÁCH 2:** Từng thành viên khởi chạy riêng phân hệ của mình 100% trên máy local.

---

### CÁCH 1: Khởi Chạy Toàn Bộ Bằng Docker Compose (1 Lệnh Duy Nhất)

Toàn bộ 7 dịch vụ (PostGIS, Redis, Core API, AI Service, GIS Service, WebGIS, API Gateway) sẽ được khởi tạo tự động trong cùng mạng nội bộ `terrawatch-net`:

```bash
# Bước 1: Sao chép file cấu hình môi trường
cp .env.example .env

# Bước 2: Khởi động toàn bộ 7 services (Tự động build và chạy nền)
make up
# hoặc: docker compose up -d --build

# Bước 3: Xem log hệ thống thời gian thực
make logs
# hoặc: docker compose logs -f

# Bước 4: Kiểm tra trạng thái hoạt động của các container
make ps
# hoặc: docker compose ps

# Bước 5: Thử nghiệm các tính năng nâng cao (Demo buổi bảo vệ)
make demo-circuit-breaker  # Thử nghiệm Circuit Breaker Resilience4j ngắt mạch
make demo-event-bus        # Thử nghiệm Message Broker Redis Pub/Sub phát sự kiện

# Khi muốn dừng toàn bộ hệ thống:
make down
# hoặc: docker compose down
```

---

### ⚡ MÔ HÌNH DEV SIÊU TỐC: KẾT HỢP CÁCH 1 (DOCKER LIVE RELOAD) & CÁCH 3 (HYBRID CHÂN TRONG CHÂN NGOÀI)

> **NGUYÊN TẮC VÀNG:** Tuyệt đối **KHÔNG CẦN** tắt đi compose lại từ đầu cả 7 services mỗi khi có ai sửa một dòng code!

Cả team chỉ cần chạy `make up` một lần vào đầu ngày. Sau đó áp dụng linh hoạt 3 cơ chế sau:

#### 1. Sửa Code Ăn Ngay Trong 0.5 Giây (Cách 1 — Live Reload qua Volume Mount):
- Áp dụng sẵn cho: **Duẫn (`ai-service`)** và **Tú (`gis-service`)**.
- Thư mục code máy thật (`./services/.../app`) đã được mount trực tiếp vào container kèm lệnh `uvicorn --reload`.
- **Thao tác:** Mở VS Code trên Windows sửa file Python (`inference.py` hoặc `processor.py`) rồi bấm `Ctrl + S`. Container bên trong Docker **tự động reload sau 0.5 giây** mà không cần gõ bất kỳ lệnh docker nào!

#### 2. Rebuild ĐÚNG 1 Service Bị Sửa (Chỉ Mất 5–10 Giây — CSDL & Các Service Khác Vẫn Chạy Nguyên):
Khi một bạn cài thêm thư viện mới (sửa `pom.xml`, `package.json`, hoặc `requirements.txt`), chỉ cần build lại **ĐÚNG SERVICE ĐÓ**:

```bash
# Thuận sửa Backend: Chỉ build lại Core API
make rebuild-core     # (docker compose up -d --build core-api)

# Duẫn sửa AI: Chỉ build lại AI Service
make rebuild-ai       # (docker compose up -d --build ai-service)

# Tú sửa GIS: Chỉ build lại GIS Service
make rebuild-gis      # (docker compose up -d --build gis-service)

# Huy sửa Web: Chỉ build lại WebGIS
make rebuild-web      # (docker compose up -d --build webgis)

# Sửa Nginx Gateway:
make rebuild-gateway  # (docker compose up -d --build gateway)
```

#### 3. Mô Hình Hybrid "Chân Trong Chân Ngoài" (Cách 3 — Dành Cho Huy WebGIS & Thuận Backend):
Cách làm sướng nhất để debug sâu từng dòng code và cập nhật giao diện trong 50ms:

* **Với Huy (Làm React WebGIS):**
  1. Tắt riêng container web: `docker compose stop webgis`
  2. Mở terminal local gõ: `cd apps/webgis && npm run dev`
  3. WebGIS chạy local tại `http://localhost:5173`, gọi thẳng vào Gateway Docker `http://localhost:8080`. Huy sửa code JSX/CSS thì trình duyệt cập nhật ngay trong **50ms (Vite Fast Refresh)**!
* **Với Thuận (Làm Java Spring Boot):**
  1. Tắt riêng container core: `docker compose stop core-api`
  2. Mở IntelliJ IDEA / VS Code bấm nút **Run/Debug** cho `TerraWatchCoreApplication.java`.
  3. Core API local kết nối vào PostgreSQL (5432) và Redis (6379) đang chạy trong Docker. Thuận đặt **Breakpoint Debug** từng dòng code mượt mà!
* **Khi code xong muốn đóng gói demo lại:**
  Chỉ cần gõ: `docker compose start core-api webgis` (hoặc `make up`).

---

### CÁCH 2: Khởi Chạy Từng Phân Hệ Local Độc Lập (100% Không Cần Docker Cả Cụm)

Mỗi thành viên chỉ cần chạy hạ tầng dùng chung (PostgreSQL & Redis), sau đó chạy service của riêng mình:

#### 0. Khởi chạy CSDL & Redis nền trước (Tất cả đều cần):
```bash
# Khởi chạy riêng container PostGIS và Redis:
docker-compose up -d postgres redis
```

---

#### 1. 🧠 DUẪN — Chạy AI Inference Service Local (`services/ai-service`):
```bash
# Di chuyển vào thư mục AI Service
cd services/ai-service

# Tạo và kích hoạt môi trường ảo Python
python -m venv venv
# Windows:
.\venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate

# Cài đặt các thư viện phụ thuộc (FastAPI, ONNX Runtime, NumPy, Shapely)
pip install -r requirements.txt

# Khởi chạy server AI tại cổng 8001 (hỗ trợ Hot-Reload khi sửa code)
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload

# Kiểm tra Swagger UI tài liệu API:
# Mở trình duyệt: http://localhost:8001/docs
```

---

#### 2. 🗺️ TÚ — Chạy GIS Pipeline & Data Service Local (`services/gis-service`):
```bash
# Di chuyển vào thư mục GIS Service
cd services/gis-service

# Tạo và kích hoạt môi trường ảo Python
python -m venv venv
# Windows:
.\venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate

# Cài đặt thư viện (FastAPI, Rasterio, GeoPandas, Psycopg2)
pip install -r requirements.txt

# Chạy migration CSDL PostGIS (nếu cần):
python ../../scripts/migrate.py up

# Khởi chạy server GIS tại cổng 8002
uvicorn app.main:app --host 0.0.0.0 --port 8002 --reload

# Mở trình duyệt xem Swagger UI: http://localhost:8002/docs
```

---

#### 3. ⚙️ THUẬN — Chạy Core API Spring Boot 3 Local (`services/core-api`):
```bash
# Di chuyển vào thư mục Core API
cd services/core-api

# Khởi chạy Spring Boot 3 bằng Maven Wrapper:
# Trên Windows PowerShell:
.\mvnw.cmd spring-boot:run

# Trên Linux / macOS:
./mvnw spring-boot:run

# Service sẽ khởi động tại cổng 3000
# Mở Swagger UI kiểm thử: http://localhost:3000/swagger-ui/index.html
```

---

#### 4. 🖥️ HUY — Chạy WebGIS Dashboard Local (`apps/webgis`):
```bash
# Di chuyển vào thư mục WebGIS
cd apps/webgis

# Cài đặt các gói npm
npm install

# Khởi chạy Vite Dev Server tại cổng 5173
npm run dev

# Mở trình duyệt điều khiển: http://localhost:5173
```

---

#### 5. 📱 LÂM — Chạy Mobile Citizen App Local (`apps/mobile`):
```bash
# Di chuyển vào thư mục Mobile
cd apps/mobile

# Tải các gói thư viện Flutter
flutter pub get

# Kiểm tra danh sách thiết bị/máy ảo đang kết nối
flutter devices

# Khởi chạy app trên máy ảo Android/iOS hoặc thiết bị thật
flutter run
```

---

## 🗄️ 7. Hướng Dẫn Vận Hành CSDL Thực Chiến: Từ Khởi Tạo, Migration Đến Spring Data JPA

Cơ sở dữ liệu của dự án sử dụng **PostgreSQL 15 kết hợp tiện ích địa không gian PostGIS 3.3**, được chia theo mô hình **Logical Schema-per-Service**:
- `core_schema`: Chứa các bảng nghiệp vụ chính của Spring Boot (`users`, `landslide_events`, `community_reports`, `monitoring_areas`, `landslide_event_history`).
- `gis_schema`: Chứa dữ liệu viễn thám và tiles của GIS Service (`raster_scenes`, `satellite_tiles`).
- `public`: Tiện ích PostGIS (`postgis`, `postgis_raster`) và bảng quản lý migration.

Dưới đây là **hướng dẫn hành động từng bước (Runbook)** cho mọi tình huống:

---

### 📍 TÌNH HUỐNG 1: Bạn mới clone dự án về, muốn CSDL có bảng và dữ liệu mẫu ngay lập tức

Làm theo đúng 3 bước sau:

#### Bước 1: Khởi động container PostgreSQL (PostGIS)
```bash
docker compose up -d postgres redis
```
*(Chờ 3 giây để PostgreSQL sẵn sàng nhận kết nối tại cổng `5432`)*

#### Bước 2: Chạy migration để tự động tạo bảng và nạp dữ liệu mẫu
Chọn **1 trong 2 cách** tùy theo bạn đang làm việc ở phân hệ nào:

* **Cách A (Dành cho Thuận - Backend Spring Boot):**
  Chỉ cần khởi động Core API, thư viện **Flyway** tích hợp sẵn sẽ tự động chạy toàn bộ migration:
  ```bash
  # Trên Windows PowerShell:
  cd services/core-api
  .\mvnw.cmd spring-boot:run
  
  # Trên Linux / macOS:
  cd services/core-api
  ./mvnw spring-boot:run
  ```
  👉 **Dấu hiệu thành công:** Màn hình console xuất hiện dòng log của Flyway:
  `Flyway Community Edition ... Successfully applied 2 migrations to schema "core_schema"` (đã chạy xong `V1__init_postgis_schema.sql` và `V2__seed_vietnam_geospatial_data.sql`).

* **Cách B (Dành cho Tú GIS, Duẫn AI, Huy Web hoặc ai không muốn bật Java):**
  Dùng Python CLI chạy 1 lệnh duy nhất từ thư mục gốc dự án:
  ```bash
  # Xem trạng thái hiện tại của CSDL:
  python scripts/migrate.py status

  # Thực thi toàn bộ migration vào CSDL:
  python scripts/migrate.py up
  ```
  👉 **Dấu hiệu thành công:** Terminal in ra thông báo xanh:
  ```text
  ⚡ Applying: V1__init_postgis_schema.sql...
  ✅ Applied:  V1__init_postgis_schema.sql
  ⚡ Applying: V2__seed_vietnam_geospatial_data.sql...
  ✅ Applied:  V2__seed_vietnam_geospatial_data.sql
  🎉 Migration finished! 2 migration(s) applied successfully.
  ```

#### Bước 3: Kiểm tra dữ liệu xem đã vào CSDL thành công chưa
* **Cách 1 (Bằng dòng lệnh Docker nhanh):**
  ```bash
  docker exec -it terrawatch-postgis psql -U postgres -d terrawatch -c "SELECT event_id, risk_level, status, affected_area_m2 FROM core_schema.landslide_events LIMIT 5;"
  ```
* **Cách 2 (Bằng công cụ GUI: DBeaver, TablePlus, Navicat, pgAdmin):**
  - **Host:** `localhost` | **Port:** `5432`
  - **Database:** `terrawatch`
  - **Username:** `postgres` | **Password:** `postgrespassword`
  - Bấm vào mục **Schemas** ➔ Mở **`core_schema`** ➔ Xem bảng `landslide_events` đã có sẵn dữ liệu sạt lở mẫu tại Yên Bái, Lào Cai, Hà Giang!

---

### 📍 TÌNH HUỐNG 2: Thuận lập trình Core API kết nối CSDL qua Spring Data JPA như thế nào?

Toàn bộ luồng từ CSDL ➔ JPA Entity ➔ Repository ➔ Service đã được cấu hình chuẩn:

#### Bước 1: Khai báo Entity (Lưu ý luôn có `schema = "core_schema"`):
Tại `services/core-api/src/main/java/vn/terrawatch/core/entity/`:
```java
@Entity
@Table(name = "landslide_events", schema = "core_schema") // Bắt buộc chỉ định core_schema
public class LandslideEvent {
    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    @Column(name = "event_id")
    private UUID eventId;

    @Column(name = "risk_level")
    private String riskLevel; // low, medium, high, extreme

    @Column(name = "status")
    private String status;     // pending, verified, rejected, false_alarm

    @Column(name = "affected_area_m2")
    private Double affectedAreaM2;
    // Getters & Setters...
}
```

#### Bước 2: Tạo Repository kế thừa `JpaRepository`:
Tại `services/core-api/src/main/java/vn/terrawatch/core/repository/`:
```java
@Repository
public interface LandslideEventJpaRepository extends JpaRepository<LandslideEvent, UUID> {
    // Spring Data JPA tự động sinh câu lệnh SQL:
    List<LandslideEvent> findByStatusOrderByDetectionDateDesc(String status);
    List<LandslideEvent> findByRiskLevel(String riskLevel);
    long countByStatus(String status);
}
```

#### Bước 3: Inject Repository vào Service / Controller để sử dụng:
```java
@Service
public class LandslideService {
    @Autowired
    private LandslideEventJpaRepository repository;

    public List<LandslideEvent> getPendingEvents() {
        return repository.findByStatusOrderByDetectionDateDesc("pending");
    }
}
```

#### ⚠️ QUY TẮC VÀNG VỀ HIBERNATE (`application.yml`):
Trong file `services/core-api/src/main/resources/application.yml`:
```yaml
spring:
  jpa:
    hibernate:
      ddl-auto: none  # BẮT BUỘC LÀ NONE: Không được đổi sang update/create-drop!
    properties:
      hibernate:
        default_schema: core_schema
```
*Lý do:* Để Hibernate không tự ý thay đổi cấu trúc bảng hoặc xóa các kiểu dữ liệu PostGIS (`geometry`, `enum`) do Flyway quản lý.

#### Bước 4: Xử lý dữ liệu không gian PostGIS (ST_AsGeoJSON, GIST):
Vì Hibernate chuẩn không tối ưu khi xử lý hình học đa giác PostGIS, hệ thống đã viết sẵn **`SpatialRepository`** dùng `JdbcTemplate`:
```java
@Autowired
private SpatialRepository spatialRepository;

// Lấy danh sách sạt lở đã chuyển sẵn sang format GeoJSON để trả thẳng cho React WebGIS / Mobile:
List<Map<String, Object>> geoJsonEvents = spatialRepository.getVerificationQueue();
```

---

### 📍 TÌNH HUỐNG 3: Khi bạn muốn tạo thêm bảng mới hoặc thêm cột mới (Quy trình tạo Migration mới)

> ⛔ **NGHIÊM CẤM:** Không dùng DBeaver bấm tay sửa trực tiếp trên DB máy bạn, vì khi người khác kéo code về sẽ bị lỗi thiếu bảng!

Thực hiện đúng 3 bước chuẩn:

1. **Bước 1: Tạo file migration SQL mới**
   Tạo file mới trong thư mục `services/core-api/src/main/resources/db/migration/` theo quy ước tăng số phiên bản:
   `V3__tao_bang_cam_bien_iot.sql`
   ```sql
   -- Ví dụ thêm bảng cảm biến IoT giám sát độ nghiêng sườn đồi
   CREATE TABLE core_schema.iot_sensors (
       sensor_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
       sensor_code VARCHAR(50) NOT NULL UNIQUE,
       tilt_angle DOUBLE PRECISION DEFAULT 0.0,
       battery_percentage INTEGER DEFAULT 100,
       geom geometry(Point, 4326),
       created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
   );

   CREATE INDEX idx_iot_sensors_geom ON core_schema.iot_sensors USING GIST (geom);
   ```

2. **Bước 2: Đồng bộ sang thư mục script chung**
   Copy file `V3__tao_bang_cam_bien_iot.sql` vừa tạo sang `database/migrations/` (để Tú & Duẫn có thể chạy bằng Python).

3. **Bước 3: Chạy áp dụng**
   - Chỉ cần khởi động lại Core API (`mvnw spring-boot:run`), Flyway sẽ tự động nhận diện file `V3` và chạy ngay trong 1 giây!
   - Hoặc gõ `python scripts/migrate.py up`.

---

### 📍 TÌNH HUỐNG 4: Muốn xóa sạch toàn bộ CSDL để nạp lại dữ liệu gốc từ đầu (Reset Database)

Khi bạn test dữ liệu lung tung hoặc muốn CSDL trở lại trạng thái tinh khôi của buổi bảo vệ:
```bash
# Bước 1: Dừng toàn bộ và xóa Volume lưu trữ của Docker
docker compose down -v

# Bước 2: Khởi động lại hệ thống (PostGIS sẽ tự động tạo mới hoàn toàn và nạp dữ liệu mẫu)
make up
# hoặc: docker compose up -d postgres redis && python scripts/migrate.py up
```

---

## 🌐 8. Danh Mục Cổng Dịch Vụ & API Gateway Routing

Khi toàn bộ hệ thống chạy qua Docker, **mọi truy cập chỉ cần đi qua API Gateway duy nhất tại cổng `8080`**:

| Phân hệ / Dịch vụ | Cổng chạy trực tiếp | Cổng đi qua Gateway (Khuyên Dùng) | Đường dẫn Swagger / Giao diện |
| :--- | :---: | :---: | :--- |
| **API Gateway Nginx** | `8080` | **`http://localhost:8080`** | Điểm tiếp nhận duy nhất cho toàn bộ hệ thống |
| **WebGIS Command Center** | `5173` | [http://localhost:8080](http://localhost:8080) | Giao diện điều phối bản đồ 3D cho cán bộ |
| **Core API Service** | `3000` | [http://localhost:8080/api/v1/core](http://localhost:8080/api/v1/core) | [http://localhost:8080/swagger-ui/index.html](http://localhost:8080/swagger-ui/index.html) |
| **AI Inference Service** | `8001` | [http://localhost:8080/api/v1/ai](http://localhost:8080/api/v1/ai) | [http://localhost:8001/docs](http://localhost:8001/docs) |
| **GIS Pipeline Service** | `8002` | [http://localhost:8080/api/v1/gis](http://localhost:8080/api/v1/gis) | [http://localhost:8002/docs](http://localhost:8002/docs) |
| **PostGIS Database** | `5432` | `localhost:5432` | Database: `terrawatch` (user: `postgres`) |
| **Redis Event Bus** | `6379` | `localhost:6379` | Channel: `terrawatch:events` |

---

## 🤖 9. Hướng Dẫn Dùng BMAD Slash Commands Cho Nhóm

Dự án tích hợp đầy đủ hệ sinh thái **AI Agentic BMAD** hỗ trợ 5 thành viên lập trình tự động theo Story:

### 1. Bắt tay vào viết code cho một Story:
Khi một thành viên muốn AI hỗ trợ code Story được giao (ví dụ Thuận làm Story 1.1):
```text
/bmad-dev-story
```
Agent Amelia sẽ tự động đọc ngữ cảnh story, phân tích ranh giới kiến trúc, viết code triển khai, kiểm thử và cập nhật trạng thái vào `sprint-status.yaml`.

### 2. Tạo Story mới từ danh sách Backlog:
Khi một story hoàn thành và bạn muốn lấy tiếp story tiếp theo trong [epics.md](_bmad-output/planning-artifacts/epics.md):
```text
/bmad-create-story
```
Agent sẽ tự động sinh file story đặc tả chi tiết với đầy đủ checklist và chuyển sang trạng thái `ready-for-dev`.

---

<div align="center">
<b>GeoSentry (TerraWatch) — Đồng lòng cùng đồng bào miền núi ứng phó thiên tai sạt lở đất.</b><br/>
<i>Đồ án tốt nghiệp Kỹ sư phần mềm 2026.</i>
</div>
