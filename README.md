<div align="center">

# 🛰️ GEOSENTRY (TERRAWATCH)
### HỆ THỐNG VIỄN THÁM & TRÍ TUỆ NHÂN TẠO CẢNH BÁO SỚM SẠT LỞ ĐẤT
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

Hệ thống **GeoSentry (TerraWatch)** là giải pháp công nghệ viễn thám, trí tuệ nhân tạo và địa không gian nhằm **giám sát, phát hiện và cảnh báo sớm sạt lở đất** tại các tỉnh miền núi phía Bắc Việt Nam (Yên Bái, Lào Cai, Hà Giang — giải quyết bài toán thực tế sau thảm họa bão Yagi 2024 tại Làng Nủ).

> **Phạm vi:** Dự án chỉ tập trung vào **cảnh báo sạt lở đất** (FR1–FR4). Không bao gồm nghiệp vụ cứu hộ (điều phối đội cứu hộ, tuyến đường cứu hộ, SOS kêu cứu) hay các loại thiên tai khác.

### 5 Trụ Cột Của Hệ Thống:
1. **Viễn thám diện rộng (Sentinel-2 & DEM 30m):** Tự động lọc mây, tính toán chỉ số biến động thực vật $\Delta\text{NDVI}$ và góc dốc sườn núi từ ảnh độ cao số SRTM 30m.
2. **AI Semantic Segmentation & Risk Scoring:** Mô hình DeepLabV3+ ONNX Runtime (huấn luyện trên benchmark quốc tế *Landslide4Sense*, $F_1 = 0.768$) phân đoạn đa giác sạt lở và tự động xếp hạng mức nguy cơ theo độ dốc và khoảng cách tới khu dân cư.
3. **WebGIS 3D Command Center:** Bản đồ Mapbox 3D Terrain, thanh trượt so sánh ảnh trước/sau, hàng đợi thẩm định 1-click cho cán bộ và bản đồ vùng nguy cơ tô màu theo mức độ.
4. **🚨 Nút Cảnh Báo Khẩn Cấp cho Admin:** Admin chọn vùng ảnh hưởng và phát cảnh báo tới người dân qua **SMS** và **thông báo App (Firebase Cloud Messaging)**, có xác nhận 2 bước và thống kê kết quả gửi.
5. **Geofencing Ngoại Tuyến (Offline-First Mobile App):** Lưu trữ sẵn 10,000 đa giác sạt lở trong SQLite cục bộ trên điện thoại; tự động **hú còi âm lượng tối đa** khi người dân bước vào vùng nguy hiểm ngay cả khi mất sạch 100% sóng 4G/Internet.

---

## 👥 2. Phân Công Vai Trò 5 Thành Viên (WBS)

Toàn bộ kế hoạch công việc chi tiết của từng thành viên đã được chia thành **5 thư mục riêng biệt** trong [`_bmad-output/planning-artifacts/members/`](_bmad-output/planning-artifacts/members/):

| STT | Thành viên | Vai trò chuyên môn | Phân hệ code chính | Kế hoạch & User Stories chi tiết |
| :---: | :---: | :--- | :--- | :--- |
| **1** | **Duẫn** | **AI / Computer Vision Engineer** | [`services/ai-service/`](services/ai-service) | 📂 [Kế hoạch Epics của Duẫn](_bmad-output/planning-artifacts/members/duan-ai/epics.md)<br/>- Dataset Landslide4Sense, tiền xử lý 8 kênh tensor<br/>- DeepLabV3+ ONNX Runtime suy luận $< 300\text{ ms}$<br/>- Xếp hạng mức nguy cơ (độ dốc + khoảng cách khu dân cư) |
| **2** | **Tú** | **GIS Pipeline & Data Engineer** | [`services/gis-service/`](services/gis-service)<br/>[`database/`](database) | 📂 [Kế hoạch Epics của Tú](_bmad-output/planning-artifacts/members/tu-gis/epics.md)<br/>- Crawl Sentinel-2 L2A qua Copernicus / Sentinel Hub API<br/>- Lọc mây SCL, tính $\Delta\text{NDVI}$, độ dốc SRTM DEM 30m<br/>- Tiling $128 \times 128$, Raster-to-Vector PostGIS, Vector Tiles |
| **3** | **Thuận** | **Backend Engineer & Architect** | [`services/core-api/`](services/core-api)<br/>[`gateway/`](gateway) | 📂 [Kế hoạch Epics của Thuận](_bmad-output/planning-artifacts/members/thuan-backend/epics.md)<br/>- Core API Spring Boot 3, Spring Security 6 & JWT 3 roles<br/>- Resilience4j Circuit Breaker, Redis Pub/Sub Event Bus<br/>- API phát cảnh báo khẩn cấp: FCM Push + SMS Gateway, Gateway Nginx |
| **4** | **Huy** | **Frontend WebGIS Engineer** | [`apps/webgis/`](apps/webgis) | 📂 [Kế hoạch Epics của Huy](_bmad-output/planning-artifacts/members/huy-webgis/epics.md)<br/>- React 18 + Vite, Mapbox GL 3D Terrain<br/>- Thanh trượt so sánh ảnh đa thời gian (Time-slider swipe)<br/>- Hàng đợi duyệt sạt lở 1-click & Nút 🚨 Phát Cảnh Báo Khẩn Cấp (Admin) |
| **5** | **Lâm** | **Mobile App Engineer** | [`apps/mobile/`](apps/mobile) | 📂 [Kế hoạch Epics của Lâm](_bmad-output/planning-artifacts/members/lam-mobile/epics.md)<br/>- Ứng dụng Flutter 3.x, SQLite cache 10,000 đa giác sạt lở<br/>- Background Geolocation, Ray-Casting & Haversine ngoại tuyến, còi hú<br/>- Đăng ký & nhận cảnh báo khẩn cấp (FCM), Báo cáo hiện trường |

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
        CoreAPI["⚙️ Core API Service (Java 17 + Spring Boot 3)<br/>Port 3000 | RBAC 3 Roles, Thẩm định sạt lở, Phát cảnh báo khẩn cấp"]
        AIService["🧠 AI Inference Service (Python FastAPI)<br/>Port 8001 | DeepLabV3+ ONNX, Xếp hạng mức nguy cơ"]
        GISService["🗺️ GIS Data Service (Python FastAPI)<br/>Port 8002 | Sentinel-2 Ingestion, NDVI, DEM Slope, Tiling, MVT"]
    end

    subgraph Resilience ["8. Circuit Breaker & Fault Tolerance"]
        CB["🛡️ Resilience4j Circuit Breaker<br/>Tự động ngắt mạch (Open) & kích hoạt Fallback khi AI/GIS service sập"]
    end

    subgraph EventBroker ["6. Message Broker & Event Bus"]
        RedisBus["⚡ Redis 7 Pub/Sub (Port 6379)<br/>Channel: 'terrawatch:events' | Đồng bộ sự kiện bất đồng bộ 2 chiều"]
    end

    subgraph DataLayer ["5. Database per Service (Logical Schema-per-Service)"]
        PostGIS[("🐘 PostgreSQL 15 + PostGIS 3.3 (Port 5432)<br/>├── public: PostGIS native engine ST_*, UUID, migrations<br/>├── core_schema: users, landslide_events, history, community_reports, alerts<br/>└── gis_schema: monitoring_areas AOIs, satellite_scenes, tiles")]
    end

    subgraph ConfigLayer ["7. Configuration Management"]
        ConfigEnv["⚙️ Twelve-Factor Config (.env, Docker Environment Variables)"]
    end

    subgraph Notify ["Kênh Phát Cảnh Báo (External)"]
        FCM["🔔 Firebase Cloud Messaging (Push App)"]
        SMS["✉️ SMS Gateway (eSMS / SpeedSMS / Twilio)"]
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
    CoreAPI -->|Cảnh báo khẩn cấp| FCM
    CoreAPI -->|Cảnh báo khẩn cấp| SMS
    FCM -->|Push| MobileApp

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
│   │   ├── epics.md                        # Toàn bộ 8 Epics & 26 User Stories dự án
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

## ⚙️ 5. Hướng Dẫn Thiết Lập Cấu Hình `.env` (Toàn Cục & Từng Phân Hệ)

Dự án áp dụng kiến trúc cấu hình **2 tầng linh hoạt**:
1. **Tầng 1 — File `.env` gốc (Root):** Quản lý tập trung toàn bộ biến môi trường khi chạy qua **Docker Compose** (`docker compose up -d` / `make up` / `.\run.ps1 up`). Cả nhóm chỉ cần cấu hình file này 1 lần là toàn bộ 7 services tự động nhận đủ.
2. **Tầng 2 — File `.env` riêng trong từng thư mục con:** Dành cho các thành viên khi khởi chạy riêng lẻ từng phân hệ dưới máy **Local** (Cách 2). Đã có sẵn file `.env.example` trong từng thư mục, bạn chỉ cần copy thành `.env` để tùy biến riêng cho máy mình.

---

### 1. Thiết lập File `.env` gốc (Tùy chọn cho Docker Compose):

> 💡 **Tin vui cho cả nhóm:** Khi chạy toàn bộ hệ thống bằng Docker Compose (`docker compose up -d` / `make up` / `.\run.ps1 up`), bạn **KHÔNG BẮT BUỘC** phải tạo file `.env` vì toàn bộ thông số CSDL, Redis và cổng dịch vụ đã được định nghĩa sẵn giá trị mặc định chuẩn trong `docker-compose.yml` để **chạy được ngay 100% sau khi clone**!
>
> Bạn chỉ cần tạo file `.env` khi:
> 1. Muốn đổi API Key thật bên ngoài (như Mapbox Token, Sentinel Hub Client ID).
> 2. Hoặc khi chạy riêng lẻ các phân hệ trên máy Local.

```bash
# Nếu muốn tùy biến biến môi trường, sao chép file mẫu:
# Trên Linux / macOS / Git Bash:
cp .env.example .env

# Trên Windows PowerShell:
Copy-Item .env.example .env
```

#### Bảng Giải Thích Chi Tiết Các Biến Trong `.env` Gốc:

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
| `SENTINEL_HUB_CLIENT_ID` | `placeholder_sentinel_client_id` | Khóa xác thực Copernicus / Sentinel Hub | GIS Service |
| `FIREBASE_CREDENTIALS_PATH` | `./secrets/firebase-service-account.json` | File service account Firebase để gửi Push App (FCM) | Core API |
| `SMS_PROVIDER` | `esms` | Nhà cung cấp SMS Gateway (`esms` / `speedsms` / `twilio` / `mock`) | Core API |
| `SMS_API_KEY` / `SMS_SECRET_KEY` | `placeholder_sms_key` | Khóa API của SMS Gateway | Core API |
| `SMS_BRANDNAME` | `TERRAWATCH` | Tên thương hiệu hiển thị trên tin nhắn cảnh báo | Core API |

---

### 2. Danh Sách File `.env` Riêng Ở Từng Thư Mục Con (Khi Chạy Local):

Khi một thành viên chỉ muốn chạy riêng service của mình trên máy local (không qua Docker), hãy vào thư mục con tương ứng và copy `.env.example` thành `.env`:

| Thư mục phân hệ | File cấu hình mẫu | Các biến quan trọng bên trong |
| :--- | :--- | :--- |
| **`apps/webgis/`** | [`.env.example`](apps/webgis/.env.example) | `VITE_PORT=5173`<br/>`VITE_API_BASE_URL=http://localhost:8080`<br/>`VITE_MAPBOX_ACCESS_TOKEN=...` |
| **`services/ai-service/`** | [`.env.example`](services/ai-service/.env.example) | `PORT=8001`<br/>`REDIS_HOST=localhost`<br/>`REDIS_PORT=6379`<br/>`ONNX_MODEL_PATH=models/...` |
| **`services/gis-service/`** | [`.env.example`](services/gis-service/.env.example) | `PORT=8002`<br/>`DATABASE_URL=postgresql://...`<br/>`SENTINEL_HUB_CLIENT_ID=...` |
| **`apps/mobile/`** | [`.env.example`](apps/mobile/.env.example) | `API_BASE_URL=http://10.0.2.2:8080` (Android) hoặc `localhost` (iOS)<br/>`MAPBOX_ACCESS_TOKEN=...` |
| **`services/core-api/`** | [`.env.example`](services/core-api/.env.example)<br/>và `application.yml` | `SERVER_PORT=3000`<br/>`DATABASE_URL=jdbc:postgresql://...`<br/>`JWT_SECRET=...`<br/>*(Spring Boot tự động inject từ biến môi trường OS, file `.env`, hoặc fallback mặc định trong `application.yml`)* |

---

## 🚀 6. Hướng Dẫn Khởi Chạy Dự Án (Dành Cho Toàn Bộ Thành Viên)

> **MỤC TIÊU CỐT LÕI:** Bất kỳ thành viên nào trong nhóm (kể cả phụ trách AI, GIS, Backend, Frontend hay Mobile) đều có thể tự mình khởi chạy toàn bộ hệ thống GeoSentry trên máy tính cá nhân để lập trình, kiểm thử liên thông và phục vụ bảo vệ đồ án.

Dự án hỗ trợ **3 hình thức làm việc linh hoạt**:
1. **CÁCH 1:** Khởi chạy toàn bộ hệ thống bằng Docker Compose (Khuyên dùng khi bắt đầu, kiểm thử liên thông hoặc demo đồ án).
2. **⚡ MÔ HÌNH DEV SIÊU TỐC (DOCKER LIVE RELOAD & REBUILD TỪNG SERVICE):** Quy trình làm việc hàng ngày giúp sửa code ăn ngay mà không bao giờ phải tắt đi compose lại từ đầu.
3. **CÁCH 2:** Khởi chạy từng phân hệ trên máy local (Dành cho việc viết code độc lập, debug chi tiết từng dịch vụ).

---

### CÁCH 1: Khởi Chạy Toàn Bộ Hệ Thống (1 Lệnh Duy Nhất - Khuyên Dùng Cho Mọi Thành Viên)

Chỉ với 1 lệnh, toàn bộ 7 dịch vụ (PostGIS, Redis, Core API, AI Service, GIS Service, WebGIS, API Gateway) sẽ được tự động biên dịch và khởi chạy trong mạng nội bộ `terrawatch-net`:

```bash
# Bước 1: Sao chép file .env (TÙY CHỌN - Nếu không làm bước này thì Docker vẫn chạy 100% bằng cấu hình mặc định!)
# Trên Linux/macOS:
cp .env.example .env
# Trên Windows PowerShell:
Copy-Item .env.example .env

# Bước 2: Khởi động toàn bộ 7 services (Tự động build và chạy nền)
# Cách A - Chuẩn Docker (100% MÁY CÀI DOCKER ĐỀU CÓ SẴN, KHÔNG CẦN CÀI THÊM GÌ):
docker compose up -d --build

# Cách B - Dùng phím tắt tiện lợi:
make up           # Nếu dùng Linux, macOS hoặc Git Bash
.\run.ps1 up      # Nếu dùng Windows PowerShell (đã tạo sẵn script trong dự án)

# 💡 Lệnh trên TỰ ĐỘNG tạo và bật luôn cả PostgreSQL (PostGIS) và Redis, không cần bật lẻ!

# Bước 3: Xem log toàn bộ hệ thống thời gian thực
docker compose logs -f    # hoặc: make logs / .\run.ps1 logs

# Bước 4: Kiểm tra trạng thái hoạt động của các container (Tất cả phải ở trạng thái "Up")
docker compose ps         # hoặc: make ps / .\run.ps1 ps
```

#### 🎯 Kiểm tra kết quả ngay trên trình duyệt:
Sau khi chạy xong, bất kỳ thành viên nào cũng có thể truy cập ngay:
- **Giao diện WebGIS 3D Command Center:** [http://localhost:8080](http://localhost:8080)
- **Tài liệu Swagger Core API Backend:** [http://localhost:8080/swagger-ui/index.html](http://localhost:8080/swagger-ui/index.html)
- **Tài liệu Swagger AI Service:** [http://localhost:8001/docs](http://localhost:8001/docs)
- **Tài liệu Swagger GIS Pipeline:** [http://localhost:8002/docs](http://localhost:8002/docs)

```bash
# Khi muốn tạm dừng toàn bộ hệ thống:
docker compose down       # hoặc: make down / .\run.ps1 down
```

---

### ⚡ MÔ HÌNH DEV SIÊU TỐC: DOCKER LIVE RELOAD & REBUILD NHANH TỪNG SERVICE

> **NGUYÊN TẮC VÀNG:** Tuyệt đối **KHÔNG CẦN** tắt đi compose lại từ đầu cả 7 services mỗi khi có ai sửa một dòng code!

Cả nhóm chỉ cần chạy `make up` một lần vào đầu buổi làm việc. Sau đó áp dụng 3 cơ chế cực nhanh sau:

#### 1. Sửa Code Ăn Ngay Trong 0.5 Giây (Live Reload qua Volume Mount):
- Áp dụng sẵn cho các dịch vụ Python: **`ai-service`** và **`gis-service`**.
- Thư mục code máy thật (`./services/.../app`) đã được mount trực tiếp vào container kèm cờ `uvicorn --reload`.
- **Thao tác:** Mở VS Code trên máy bạn, sửa file Python (`inference.py`, `processor.py`,...) rồi bấm `Ctrl + S`. Container bên trong Docker **tự động reload sau 0.5 giây** mà không cần gõ bất kỳ lệnh docker nào!

#### 2. Rebuild ĐÚNG 1 Service Bị Sửa (Chỉ Mất 5–10 Giây — CSDL & Các Service Khác Vẫn Chạy Bình Thường):
Khi bạn cài thêm thư viện mới (sửa `pom.xml`, `package.json`, hoặc `requirements.txt`), chỉ cần build lại **ĐÚNG DỊCH VỤ ĐÓ**:

```bash
# Khi sửa Backend Core API:
docker compose up -d --build core-api   # Phím tắt: make rebuild-core / .\run.ps1 rebuild-core

# Khi sửa AI Service:
docker compose up -d --build ai-service # Phím tắt: make rebuild-ai / .\run.ps1 rebuild-ai

# Khi sửa GIS Service:
docker compose up -d --build gis-service# Phím tắt: make rebuild-gis / .\run.ps1 rebuild-gis

# Khi sửa Frontend WebGIS:
docker compose up -d --build webgis     # Phím tắt: make rebuild-web / .\run.ps1 rebuild-web

# Khi sửa Nginx API Gateway:
docker compose up -d --build gateway    # Phím tắt: make rebuild-gateway / .\run.ps1 rebuild-gateway
```

#### 3. Mô Hình Hybrid "Chân Trong Chân Ngoài" (Debug Sâu & Cập Nhật Giao Diện 50ms):
Dành cho bất kỳ thành viên nào muốn debug từng dòng code hoặc làm giao diện nhanh:

* **Khi phát triển Frontend (React WebGIS):**
  1. Tắt riêng container web: `docker compose stop webgis`
  2. Mở terminal gõ: `cd apps/webgis && npm run dev`
  3. WebGIS chạy local tại `http://localhost:5173`, gọi thẳng vào Gateway Docker `http://localhost:8080`. Bạn sửa JSX/CSS thì trình duyệt cập nhật ngay trong **50ms (Vite Fast Refresh)**!
* **Khi phát triển Backend (Java Spring Boot):**
  1. Tắt riêng container core: `docker compose stop core-api`
  2. Mở IntelliJ IDEA / VS Code bấm nút **Run/Debug** cho `TerraWatchCoreApplication.java`.
  3. Core API local kết nối thẳng vào PostgreSQL (5432) và Redis (6379) đang chạy trong Docker. Bạn có thể đặt **Breakpoint Debug** từng dòng code mượt mà!
* **Khi làm xong muốn đóng gói lại Docker:**
  Chỉ cần gõ: `docker compose start core-api webgis` (hoặc `make up`).

---

### CÁCH 2: Khởi Chạy Từng Phân Hệ Dưới Máy Local (Phát Triển Độc Lập)

Cách này chỉ dành cho trường hợp bạn **không muốn chạy `make up`**, mà chỉ muốn chạy riêng service của mình trên máy thật (local IDE):

#### Bước 0: Khởi chạy CSDL PostGIS & Redis nền (Bắt buộc chạy trước nếu chưa chạy `make up`):
> 💡 *Nếu bạn đã chạy `make up` rồi thì Database và Redis **đã có sẵn**, bỏ qua bước này!*

```bash
docker compose up -d postgres redis
```

---

#### 1. 🧠 Phân Hệ AI Inference Service (`services/ai-service` - Python FastAPI):
```bash
cd services/ai-service

# Tạo và kích hoạt môi trường ảo Python
python -m venv venv
# Windows:
.\venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate

# Cài đặt thư viện phụ thuộc
pip install -r requirements.txt

# Khởi chạy server AI tại cổng 8001
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload

# Mở trình duyệt xem Swagger UI: http://localhost:8001/docs
```

---

#### 2. 🗺️ Phân Hệ GIS Pipeline & Data Service (`services/gis-service` - Python FastAPI + Geo):
```bash
cd services/gis-service

# Tạo và kích hoạt môi trường ảo Python
python -m venv venv
# Windows:
.\venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate

# Cài đặt thư viện
pip install -r requirements.txt

# Chạy migration CSDL PostGIS (nếu chưa chạy):
python ../../scripts/migrate.py up

# Khởi chạy server GIS tại cổng 8002
uvicorn app.main:app --host 0.0.0.0 --port 8002 --reload

# Mở trình duyệt xem Swagger UI: http://localhost:8002/docs
```

---

#### 3. ⚙️ Phân Hệ Core API Service (`services/core-api` - Java 17 + Spring Boot 3):
```bash
cd services/core-api

# Khởi chạy Spring Boot 3 bằng Maven Wrapper:
# Trên Windows PowerShell:
.\mvnw.cmd spring-boot:run

# Trên Linux / macOS:
./mvnw spring-boot:run

# Mở Swagger UI kiểm thử: http://localhost:3000/swagger-ui/index.html
```

---

#### 4. 🖥️ Phân Hệ WebGIS Dashboard (`apps/webgis` - React 18 + Vite):
```bash
cd apps/webgis

# Cài đặt các gói thư viện
npm install

# Khởi chạy Vite Dev Server tại cổng 5173
npm run dev

# Mở trình duyệt: http://localhost:5173
```

---

#### 5. 📱 Phân Hệ Mobile Citizen App (`apps/mobile` - Flutter 3.x):
```bash
cd apps/mobile

# Tải các gói thư viện Flutter
flutter pub get

# Kiểm tra danh sách thiết bị/máy ảo đang kết nối
flutter devices

# Khởi chạy app trên máy ảo hoặc điện thoại thật
flutter run
```

---

## 🗄️ 7. Hướng Dẫn Vận Hành CSDL: Từ Khởi Tạo, Migration Đến Spring Data JPA (Dành Cho Toàn Bộ Thành Viên)

Cơ sở dữ liệu của dự án sử dụng **PostgreSQL 15 kết hợp tiện ích địa không gian PostGIS 3.3**, được chia theo mô hình **Logical Schema-per-Service**:
- `core_schema`: Chứa các bảng nghiệp vụ chính của Spring Boot (`users`, `landslide_events`, `community_reports`, `monitoring_areas`, `landslide_event_history`; các bảng cảnh báo `alert_subscriptions`, `device_tokens`, `alert_broadcasts`, `alert_deliveries` sẽ được thêm theo Story 1.2 / 4.4).
- `gis_schema`: Chứa dữ liệu viễn thám và tiles của GIS Service (`raster_scenes`, `satellite_tiles`).
- `public`: Tiện ích PostGIS (`postgis`, `postgis_raster`) và bảng quản lý migration.

Dưới đây là **cẩm nang thực chiến từng bước (Runbook)** để bất kỳ ai cũng có thể làm chủ CSDL:

---

### 📍 TÌNH HUỐNG 1: Bất kỳ thành viên nào mới clone dự án về, muốn CSDL có bảng và dữ liệu mẫu ngay lập tức

Làm theo đúng 3 bước sau:

#### Bước 1: Khởi động container PostgreSQL (PostGIS)
```bash
docker compose up -d postgres redis
```
*(Chờ 3 giây để PostgreSQL sẵn sàng nhận kết nối tại cổng `5432`)*

#### Bước 2: Chạy migration để tự động tạo bảng và nạp dữ liệu mẫu
Bất kỳ thành viên nào cũng có thể chọn **1 trong 2 cách** sau:

* **Cách A (Nhanh nhất cho tất cả mọi người - Chạy bằng Python CLI, không cần cài Java):**
  Từ thư mục gốc của dự án, gõ lệnh:
  ```bash
  # Xem trạng thái hiện tại của CSDL:
  python scripts/migrate.py status

  # Thực thi toàn bộ migration nạp cấu trúc bảng và dữ liệu mẫu:
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

* **Cách B (Tự động qua Spring Boot Core API):**
  Khi chạy `core-api` (bằng Docker `make up` hoặc chạy local `./mvnw spring-boot:run`), thư viện **Flyway** tích hợp sẵn trong Spring Boot sẽ tự động quét thư mục `db/migration` và áp dụng migration ngay lập tức.
  👉 **Dấu hiệu thành công:** Màn hình console xuất hiện dòng log:
  `Flyway Community Edition ... Successfully applied 2 migrations to schema "core_schema"`.

#### Bước 3: Kiểm tra dữ liệu trong CSDL
* **Cách 1 (Dòng lệnh Docker nhanh):**
  ```bash
  docker exec -it terrawatch-postgis psql -U postgres -d terrawatch -c "SELECT event_id, risk_level, status, affected_area_m2 FROM core_schema.landslide_events LIMIT 5;"
  ```
* **Cách 2 (Bằng công cụ GUI: DBeaver, TablePlus, Navicat, pgAdmin):**
  - **Host:** `localhost` | **Port:** `5432`
  - **Database:** `terrawatch`
  - **Username:** `postgres` | **Password:** `postgrespassword`
  - Bấm vào mục **Schemas** ➔ Mở **`core_schema`** ➔ Xem bảng `landslide_events` đã có sẵn dữ liệu sạt lở mẫu tại Yên Bái, Lào Cai, Hà Giang!

---

### 📍 TÌNH HUỐNG 2: Cách Core API kết nối CSDL qua Spring Data JPA & PostGIS

Toàn bộ thành viên khi làm việc với Core API cần nắm chuẩn thiết kế dữ liệu sau:

#### Bước 1: Khai báo Entity (Luôn chỉ định `schema = "core_schema"`):
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

### 📍 TÌNH HUỐNG 3: Khi muốn tạo thêm bảng mới hoặc thêm cột mới (Quy trình Migration cho cả nhóm)

> ⛔ **NGHIÊM CẤM:** Không dùng DBeaver bấm tay sửa trực tiếp trên DB máy cá nhân, vì khi người khác kéo code về sẽ bị thiếu bảng và lỗi hệ thống!

Thực hiện đúng 3 bước chuẩn của dự án:

1. **Bước 1: Tạo file migration SQL mới**
   Tạo file mới trong thư mục `services/core-api/src/main/resources/db/migration/` theo quy ước tăng số phiên bản:
   `V3__tao_bang_alert_subscriptions.sql`
   ```sql
   -- Ví dụ thêm bảng đăng ký vùng nhận cảnh báo của người dân (UC07)
   CREATE TABLE core_schema.alert_subscriptions (
       subscription_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
       user_id UUID NOT NULL REFERENCES core_schema.users(user_id),
       phone_number VARCHAR(20),
       area_name VARCHAR(255),
       geom geometry(MultiPolygon, 4326) NOT NULL,
       created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
   );

   CREATE INDEX idx_alert_subscriptions_geom ON core_schema.alert_subscriptions USING GIST (geom);
   ```

2. **Bước 2: Đồng bộ sang thư mục script chung**
   Copy file `V3__tao_bang_alert_subscriptions.sql` vừa tạo sang `database/migrations/` (để bất kỳ thành viên nào cũng có thể chạy qua Python).

3. **Bước 3: Chạy áp dụng**
   - Chạy lại Core API (`mvnw spring-boot:run`), Flyway sẽ tự động nhận diện file `V3` và chạy ngay trong 1 giây.
   - Hoặc gõ `python scripts/migrate.py up`.
   - Commit file migration này lên Git để cả nhóm nhận được cập nhật CSDL.

---

### 📍 TÌNH HUỐNG 4: Muốn xóa sạch toàn bộ CSDL để nạp lại dữ liệu gốc từ đầu (Reset Database)

Khi bạn muốn CSDL trở lại trạng thái sạch ban đầu với dữ liệu mẫu chuẩn:
```bash
# Bước 1: Dừng toàn bộ và xóa Volume lưu trữ của Docker
docker compose down -v

# Bước 2: Khởi động lại hệ thống (PostGIS sẽ tự động tạo mới hoàn toàn và nạp lại dữ liệu mẫu)
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
<b>GeoSentry (TerraWatch) — Cảnh báo sớm sạt lở đất, bảo vệ đồng bào miền núi.</b><br/>
<i>Đồ án tốt nghiệp Kỹ sư phần mềm 2026.</i>
</div>
