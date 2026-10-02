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
[🚀 Cách Chạy Dự Án (Docker & Local)](#-6-hướng-dẫn-khởi-chạy-dự-án-chi-tiết) • 
[🌐 Danh Mục Cổng Dịch Vụ](#-7-danh-mục-cổng-dịch-vụ--api-gateway-routing) • 
[🤖 Quy Trình BMAD Dev](#-8-hướng-dẫn-dùng-bmad-slash-commands)

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

Dự án hỗ trợ **cả 2 hình thức khởi chạy linh hoạt**:
- **CÁCH 1:** Chạy toàn bộ hệ thống bằng Docker Compose (Khuyên dùng khi chạy demo toàn diện hoặc chấm điểm bảo vệ).
- **CÁCH 2:** Từng thành viên khởi chạy riêng phân hệ của mình trên máy local để lập trình độc lập.

---

### CÁCH 1: Khởi Chạy Toàn Bộ Bằng Docker Compose (1 Lệnh Duy Nhất)

Toàn bộ 7 dịch vụ (PostGIS, Redis, Core API, AI Service, GIS Service, WebGIS, API Gateway) sẽ được khởi tạo tự động trong cùng mạng nội bộ `terrawatch-net`:

```bash
# Bước 1: Sao chép file cấu hình môi trường
cp .env.example .env

# Bước 2: Khởi động toàn bộ 7 services (Tự động build và chạy nền)
make up
# hoặc: docker-compose up -d --build

# Bước 3: Xem log hệ thống thời gian thực
make logs
# hoặc: docker-compose logs -f

# Bước 4: Kiểm tra trạng thái hoạt động của các container
make ps
# hoặc: docker-compose ps

# Bước 5: Thử nghiệm các tính năng nâng cao (Demo buổi bảo vệ)
make demo-circuit-breaker  # Thử nghiệm Circuit Breaker Resilience4j ngắt mạch
make demo-event-bus        # Thử nghiệm Message Broker Redis Pub/Sub phát sự kiện

# Khi muốn dừng toàn bộ hệ thống:
make down
# hoặc: docker-compose down
```

---

### CÁCH 2: Khởi Chạy Từng Phân Hệ Local (Dành Cho 5 Thành Viên Lập Trình)

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

## 🌐 7. Danh Mục Cổng Dịch Vụ & API Gateway Routing

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

## 🤖 8. Hướng Dẫn Dùng BMAD Slash Commands Cho Nhóm

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
