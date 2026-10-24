# GeoSentry (TerraWatch) — Tài Liệu Tổng Quan Dự Án (Project Summary)

> **Dự án:** GeoSentry (TerraWatch) — Hệ Thống Viễn Thám & AI Cảnh Báo Sớm Sạt Lở Đất  
> **Loại hình:** Đồ Án Tốt Nghiệp Kỹ Sư Phần Mềm (Software Engineering Capstone Project)  
> **Phiên bản:** 4.0.0 (Chuẩn hóa phạm vi cảnh báo sạt lở đất & Nút cảnh báo khẩn cấp Admin)  
> **Thời gian:** Tháng 10/2026  

---

## 1. Mục Tiêu & Phạm Vi Hệ Thống (System Scope)

### 1.1. Mục Tiêu Cốt Lõi
Hệ thống kết hợp dữ liệu ảnh viễn thám vệ tinh (Sentinel-2 L2A), mô hình Deep Learning (DeepLabV3+ Segmentation), cơ sở dữ liệu không gian PostGIS, bản đồ 3D WebGIS và ứng dụng di động Flutter có khả năng **Geofencing ngoại tuyến (offline)** để phát hiện và cảnh báo sớm nguy cơ sạt lở đất tại các vùng miền núi trọng điểm (như Lào Cai, Yên Bái).

### 1.2. Phạm Vi Nghiệp Vụ
- **Trong phạm vi (In-scope):**
  1. **FR1 — Thu thập & Xử lý Viễn thám:** Cấu hình AOI (Area of Interest), tự động lấy ảnh Sentinel-2 định kỳ, lọc mây QA60, tính chỉ số $\Delta\text{NDVI}$ và độ dốc Slope từ DEM SRTM 30m, phân mảnh raster $128 \times 128$.
  2. **FR2 — Nhận diện Sạt lở bằng AI:** Suy luận mô hình DeepLabV3+ ONNX Runtime trên dữ liệu đa phổ (8 kênh), chuyển đổi mặt nạ pixel sang đa giác vector (Polygon), tự động chấm điểm mức độ nguy hiểm (Risk Scoring: Low, Medium, High, Extreme).
  3. **FR3 — Thẩm định & Giám sát WebGIS:** Giao diện Command Center (React 18 + Mapbox GL 3D), thanh trượt so sánh ảnh trước/sau (Time-slider swipe), hàng đợi duyệt sự cố cho cán bộ (Approve / Reject).
  4. **FR4 — Phát Cảnh Báo Khẩn Cấp (Admin Broadcast):** Nút bấm khẩn cấp dành riêng cho Admin để gửi đồng thời tin nhắn **SMS** (qua SMS Gateway) và **Push Notification** (qua Firebase Cloud Messaging - FCM) tới người dân đã đăng ký vùng quan tâm.
  5. **FR5 — Ứng dụng Di động Người dân (Mobile App):** Đăng ký nhận tin theo vùng, lưu đệm $\ge 10,000$ đa giác sạt lở vào SQLite máy, thuật toán **Geofencing ngoại tuyến** (Ray-Casting & Haversine) tự động kích hoạt **Còi hú âm lượng tối đa & Rung** khi đi vào vùng nguy cơ (kể cả khi mất sóng 4G/WiFi), và module gửi báo cáo hiện trường kèm ảnh + GPS.
- **Ngoài phạm vi (Out-of-scope):**
  - Không quản lý xe/đội cứu hộ, không vẽ tuyến đường sơ tán, không phát cảnh báo cho thiên tai khác (cháy rừng, lũ lụt đô thị).

---

## 2. Kiến Trúc Hệ Thống (Microservices Architecture)

Hệ thống được thiết kế theo kiến trúc Microservices chuẩn hóa, triển khai qua Docker Compose:

```
[ WebGIS (React 18) ]      [ Mobile App (Flutter) ]
          │                           │
          └─────────────┬─────────────┘
                        ▼ (Port 8080)
             [ API Gateway (Nginx) ]
                        │
       ┌────────────────┼────────────────┐
       ▼                ▼                ▼
 [ Core API Service ] [ AI Service ]   [ GIS Service ]
  (Spring Boot 3)     (FastAPI / ONNX) (FastAPI / GEE)
   Port: 3000          Port: 8001       Port: 8002
       │                │                │
       ├────────────────┼────────────────┘
       ▼                ▼
 [ Redis 7 Alpine ] [ PostGIS 15 Database (Port 5432) ]
  (Pub/Sub & Queue)  ├── core_schema (users, events, alerts)
                     └── gis_schema (aoi, scenes, tiles)
```

### 2.1. Phân Tầng Kỹ Thuật
1. **API Gateway (Nginx Reverse Proxy - Port 8080):** Đầu mối duy nhất định tuyến toàn bộ request, kiểm soát Rate Limiting (50 req/s) và Global CORS.
2. **Core API Service (Spring Boot 3 / Java 17 - Port 3000):** Xử lý nghiệp vụ chính, quản lý người dùng & phân quyền RBAC (Admin, Officer, Citizen), Circuit Breaker (Resilience4j) bọc các lệnh gọi sang GIS/AI, và điều phối gửi SMS / FCM Push.
3. **GIS Data Service (Python FastAPI - Port 8002):** Tự động crawl ảnh Sentinel-2, xử lý lọc mây QA60, tính độ dốc Slope và chỉ số $\Delta\text{NDVI}$, phân mảnh Tile $128 \times 128$, chuyển đổi Raster sang Vector Polygon.
4. **AI Inference Service (Python FastAPI - Port 8001):** Tích hợp ONNX Runtime thực thi DeepLabV3+ phân đoạn vùng sạt lở, tính toán Risk Score, lắng nghe sự kiện ngầm qua Redis Pub/Sub.
5. **Cơ Sở Dữ Liệu Không Gian (PostgreSQL 15 + PostGIS 3.3 - Port 5432):** Áp dụng kiến trúc **Logical Schema-per-Service**:
   - `core_schema`: `users`, `landslide_events`, `landslide_event_history`, `community_reports`, `alert_subscriptions`, `alert_broadcasts`, `alert_deliveries`.
   - `gis_schema`: `monitoring_areas` (AOI), `satellite_scenes`, `raster_tiles`.
6. **Message Broker (Redis 7 - Port 6379):** Event Bus liên lạc bất đồng bộ giữa Core API và Python services qua channel `terrawatch:events`.

---

## 3. Phân Công Trách Nhiệm Đội Ngũ (Team Roster & WBS)

| STT | Thành viên | Vai trò | Phân hệ chính | Nhiệm vụ kỹ thuật cốt lõi |
| :-: | :--- | :--- | :--- | :--- |
| **1** | **Duẫn** | **AI / CV Engineer** | `services/ai-service/` | Xây dựng dataset (Landslide4Sense/Bijie), tiền xử lý 8 kênh phổ, huấn luyện DeepLabV3+ ($F_1 \ge 0.768, \text{IoU} \ge 0.642$), đóng gói ONNX, thuật toán xếp hạng nguy cơ sạt lở (Risk Scoring). |
| **2** | **Tú** | **GIS Pipeline Engineer** | `services/gis-service/`, `database/` | Pipeline Sentinel-2, lọc mây QA60, tính Slope & $\Delta\text{NDVI}$, Tiling $128 \times 128$, thuật toán Raster-to-Vector, tối ưu hóa PostGIS GiST index. |
| **3** | **Thuận** | **Backend / Architect** | `services/core-api/`, `gateway/` | Kiến trúc Microservices, Core API Spring Boot 3, JWT RBAC 3 roles, Resilience4j Circuit Breaker, Redis Event Bus, API phát cảnh báo khẩn cấp (SMS Gateway + FCM Push). |
| **4** | **Huy** | **WebGIS Engineer** | `apps/webgis/` | Web Dashboard React 18, bản đồ Mapbox GL JS 3D Terrain, thanh trượt so sánh ảnh trước/sau (Time-slider swipe), hàng đợi duyệt sự cố, nút bấm "🚨 Phát Cảnh Báo Khẩn Cấp" của Admin. |
| **5** | **Lâm** | **Mobile App Engineer** | `apps/mobile/` | Flutter 3.x, Background Geolocation, SQLite lưu $\ge 10,000$ đa giác, Geofencing ngoại tuyến (Ray-Casting & Haversine) hú còi & rung vượt chế độ im lặng, nhận FCM Push và module báo cáo hiện trường. |

---

## 4. Lộ Trình 5 Tuần Sprint Tốc Lực

- **Tuần 1 (Foundation & Auth):** Dựng khung Microservices, PostGIS migration, JWT Authentication 3 roles, dataset AI, cấu hình Flutter & React.
- **Tuần 2 (Ingestion & Core Logic):** Pipeline Sentinel-2 lọc mây QA60, fine-tune DeepLabV3+ ONNX, API sự cố và báo cáo hiện trường, Mapbox 3D Terrain, Background Geolocation.
- **Tuần 3 (Inference & Tiling Engine):** Cắt tile $128 \times 128$, Raster-to-Vector polygon, endpoint AI Inference, thanh trượt so sánh ảnh WebGIS, nạp 10,000 đa giác vào SQLite mobile và kiểm thử còi hú ngoại tuyến.
- **Tuần 4 (Command Center & Emergency Alerts):** Hàng đợi duyệt sự cố (`/verify`), API phát cảnh báo khẩn cấp Admin (`/alerts/broadcast`), tích hợp SMS + FCM, màn hình đăng ký nhận tin và cảnh báo toàn màn hình trên Mobile.
- **Tuần 5 (Integration & Final Defense):** Khép kín luồng End-to-End từ ảnh vệ tinh $\rightarrow$ AI $\rightarrow$ Duyệt $\rightarrow$ SMS/Push $\rightarrow$ Mobile; kiểm thử tải và chuẩn bị video/slide bảo vệ đồ án.

---

## 5. Cấu Trúc Thư Mục Dự Án (Repository Structure)

```
TerraWatch/
├── .agent/                    # Các workflows và skills của hệ thống AI BMAD & Ponytail
├── _bmad-output/              # Các tài liệu đặc tả chuẩn hóa (PRD, Architecture, Epics, Sprint)
│   ├── planning-artifacts/    # prd.md, architecture.md, epics.md, members/
│   └── implementation-artifacts/ # sprint-status.yaml
├── apps/
│   ├── mobile/                # Ứng dụng di động Flutter 3.x (Lâm)
│   └── webgis/                # Dashboard điều hành React 18 + Mapbox GL (Huy)
├── database/                  # Kịch bản khởi tạo CSDL PostGIS (init.sql, seed.sql)
├── docs/                      # Tài liệu thuyết trình, slide báo cáo, file Word đề tài
├── gateway/                   # API Gateway cấu hình Nginx Reverse Proxy
├── scripts/                   # Script tự động sinh GitHub issues, tạo slide PPTX
├── services/
│   ├── ai-service/            # Python FastAPI + ONNX Runtime DeepLabV3+ (Duẫn)
│   ├── core-api/              # Java 17 + Spring Boot 3 Core Service (Thuận)
│   └── gis-service/           # Python FastAPI + Raster/Vector GIS Pipeline (Tú)
├── docker-compose.yml         # File khởi chạy toàn bộ 6 containers hệ thống
└── README.md                  # Hướng dẫn chi tiết cài đặt và vận hành
```

---

## 6. Hướng Dẫn Vận Hành Hệ Thống

### 6.1. Khởi động toàn bộ qua Docker Compose
```bash
docker compose up -d --build
```

### 6.2. Các cổng dịch vụ mặc định:
- **API Gateway (Nginx):** `http://localhost:8080`
- **WebGIS Dashboard:** `http://localhost:5173` (hoặc qua Gateway `http://localhost:8080`)
- **Core API Swagger:** `http://localhost:3000/swagger-ui.html`
- **GIS Service Docs:** `http://localhost:8002/docs`
- **AI Service Docs:** `http://localhost:8001/docs`
- **PostGIS Database:** `localhost:5432` (`user: postgres`, `pass: postgrespassword`, `db: terrawatch`)
- **Redis:** `localhost:6379`
