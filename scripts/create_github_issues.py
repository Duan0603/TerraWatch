#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script tự động khởi tạo toàn bộ GitHub Labels và 19 GitHub Issues cho 5 thành viên nhóm GeoSentry (TerraWatch)
Chuyên ngành: Kỹ sư Phần mềm (Software Engineering Capstone Project)
Đề tài: Hệ Thống Viễn Thám & AI Cảnh Báo Sớm Sạt Lở Đất Miền Núi
"""

import subprocess
import time
import os
import sys

GH_BIN = r"C:\Program Files\GitHub CLI\gh.exe"
if not os.path.exists(GH_BIN):
    GH_BIN = "gh"

LABELS = [
    # Members
    {"name": "member:duan", "color": "d73a4a", "desc": "Assigned to Duẫn (AI / CV Engineer)"},
    {"name": "member:tu", "color": "0075ca", "desc": "Assigned to Tú (GIS Pipeline & Data Engineer)"},
    {"name": "member:thuan", "color": "a2eeef", "desc": "Assigned to Thuận (Backend Engineer & Architect)"},
    {"name": "member:huy", "color": "7057ff", "desc": "Assigned to Huy (Frontend WebGIS Engineer)"},
    {"name": "member:lam", "color": "008672", "desc": "Assigned to Lâm (Mobile App Engineer)"},
    {"name": "team:all", "color": "e99695", "desc": "All 5 Team Members"},

    # Roles / Domains
    {"name": "role:ai", "color": "cfd3d7", "desc": "Artificial Intelligence & Computer Vision (Python / ONNX)"},
    {"name": "role:gis", "color": "bfd4f2", "desc": "Geographic Information Systems & Satellite Pipeline"},
    {"name": "role:backend", "color": "bfe5bf", "desc": "Core API Service & Microservices Infrastructure"},
    {"name": "role:webgis", "color": "1d76db", "desc": "WebGIS Command Center (React 18 + Mapbox 3D)"},
    {"name": "role:mobile", "color": "fbca04", "desc": "Mobile Citizen App (Flutter 3.x + SQLite Geofencing)"},

    # Sprints
    {"name": "sprint-1", "color": "0e8a16", "desc": "Sprint 1: Auth & PostGIS Foundation (Tuần 1)"},
    {"name": "sprint-2", "color": "0e8a16", "desc": "Sprint 2: GIS Pipeline & Field Reports (Tuần 2)"},
    {"name": "sprint-3", "color": "0e8a16", "desc": "Sprint 3: AI DeepLabV3+ & Risk Scoring (Tuần 3)"},
    {"name": "sprint-4", "color": "0e8a16", "desc": "Sprint 4: WebGIS Command Center & Emergency Alerts (Tuần 4)"},
    {"name": "sprint-5", "color": "0e8a16", "desc": "Sprint 5: Mobile App Geofencing & End-to-End Demo (Tuần 5)"},
]

STORIES = [
    # Epic 1
    {
        "title": "[Thuận - Backend] Story 1.1: Multi-Role User Registration & Authentication (Register / Login / JWT)",
        "labels": ["member:thuan", "role:backend", "sprint-1"],
        "body": """### 👤 Người phụ trách chính: **Thuận (Backend Engineer & Architect)**
- **Thành viên phối hợp:** Huy (WebGIS), Lâm (Mobile)
- **Phân hệ code:** `services/core-api/`
- **Thời gian thực hiện:** Sprint 1 (Tuần 1)
- **Epic:** Epic 1: Authentication, RBAC & Landslide Database Foundation

---

### 🎯 Mô tả yêu cầu (User Story):
> **As a** User (Citizen, Officer, or Admin),  
> **I want to** register and log in securely to obtain a role-specific JWT access token,  
> **So that** my identity and permissions are verified across WebGIS and Mobile applications.

---

### ✅ Tiêu chuẩn chấp thuận (Acceptance Criteria):
- [ ] Endpoint `POST /api/v1/auth/register` tạo người dùng với role mặc định `citizen`, có trường `phone_number` nhận SMS. Mật khẩu băm bằng BCrypt.
- [ ] Chỉ `admin` mới được cấp/đổi role `officer` hoặc `admin`.
- [ ] Endpoint `POST /api/v1/auth/login` kiểm tra email/mật khẩu và trả về JWT token chứa `userId`, `email`, và `role` (`admin`, `officer`, `citizen`).
- [ ] Endpoint `GET /api/v1/auth/me` trả về thông tin profile người dùng khi gửi kèm header `Authorization: Bearer <token>`.
- [ ] Các endpoint bảo vệ từ chối truy cập không có token hợp lệ với mã HTTP 401.
"""
    },
    {
        "title": "[Tú - GIS & Thuận - Backend] Story 1.2: PostGIS Schema-per-Service Migration & Spatial Indexes",
        "labels": ["member:tu", "member:thuan", "role:gis", "role:backend", "sprint-1"],
        "body": """### 👤 Người phụ trách: **Tú (GIS Pipeline)** & **Thuận (Backend)**
- **Phân hệ code:** `database/migrations/`, `services/core-api/`
- **Thời gian thực hiện:** Sprint 1 (Tuần 1)
- **Epic:** Epic 1: Authentication, RBAC & Landslide Database Foundation

---

### 🎯 Mô tả yêu cầu (User Story):
> **As a** Backend & Data Engineer,  
> **I want** PostgreSQL 15 + PostGIS schemas (`core_schema`, `gis_schema`) configured with GiST spatial indexes and Flyway migration scripts,  
> **So that** spatial queries on landslide hazard polygons execute in $< 50\text{ ms}$ with strict data isolation.

---

### ✅ Tiêu chuẩn chấp thuận (Acceptance Criteria):
- [ ] Khởi tạo đầy đủ bảng `core_schema.users`, `core_schema.landslide_events`, `core_schema.landslide_event_history`, `core_schema.community_reports`, `core_schema.alert_subscriptions`, `core_schema.device_tokens`, `core_schema.alert_broadcasts`, `core_schema.alert_deliveries` và `gis_schema.monitoring_areas`.
- [ ] Mọi cột kiểu `geometry` được đánh chỉ mục không gian `USING GIST (geom)`.
- [ ] Script nạp dữ liệu địa bàn mẫu (Seed data) cho các điểm nóng sạt lở tại Yên Bái, Lào Cai, Hà Giang.
"""
    },
    {
        "title": "[Thuận - Backend / DevOps] Story 1.3: API Gateway Reverse Proxy & Rate Limiting",
        "labels": ["member:thuan", "role:backend", "sprint-1"],
        "body": """### 👤 Người phụ trách: **Thuận (Backend Engineer & DevOps)**
- **Phân hệ code:** `gateway/`
- **Thời gian thực hiện:** Sprint 1 (Tuần 1)
- **Epic:** Epic 1: Authentication, RBAC & Landslide Database Foundation

---

### 🎯 Mô tả yêu cầu (User Story):
> **As a** DevOps Engineer,  
> **I want** Nginx reverse proxy configured as the single entry point (Port 8080) with rate limiting (50 req/s) and unified CORS,  
> **So that** internal microservice ports are protected and traffic routed seamlessly.

---

### ✅ Tiêu chuẩn chấp thuận (Acceptance Criteria):
- [ ] Gateway định tuyến trong suốt: `/api/v1/auth/*`, `/api/v1/core/*`, `/api/v1/ai/*`, `/api/v1/gis/*`, và `/` (WebGIS SPA).
- [ ] CORS headers cấu hình chuẩn cho cả WebGIS (Port 5173/8080) và Flutter Mobile.
"""
    },

    # Epic 2
    {
        "title": "[Tú - GIS] Story 2.1: Sentinel-2 Ingestion Pipeline & Cloud Masking Filter",
        "labels": ["member:tu", "role:gis", "sprint-2"],
        "body": """### 👤 Người phụ trách: **Tú (GIS Pipeline & Data Engineer)**
- **Phân hệ code:** `services/gis-service/`
- **Thời gian thực hiện:** Sprint 2 (Tuần 2)
- **Epic:** Epic 2: GIS Satellite Pipeline & Community Field Reports

---

### 🎯 Mô tả yêu cầu (User Story):
> **As a** GIS Data Engineer,  
> **I want** an automated ingestion client that pulls Sentinel-2 L2A multi-spectral images for defined Areas of Interest (AOI) and filters out scenes with cloud coverage $> 40\%$,  
> **So that** downstream AI models receive high-quality surface reflectance data.

---

### ✅ Tiêu chuẩn chấp thuận (Acceptance Criteria):
- [ ] Kết nối tới Copernicus Data Space Ecosystem (CDSE) hoặc Sentinel Hub API.
- [ ] Thuật toán lọc mây dựa trên Scene Classification Layer (SCL / s2cloudless), loại bỏ các patch bị mây che phủ.
- [ ] Lưu trữ siêu dữ liệu ảnh tải về vào bảng `gis_schema.satellite_scenes`.
"""
    },
    {
        "title": "[Tú - GIS] Story 2.2: Topographic Slope (SRTM DEM) & Vegetation Index (ΔNDVI) Engine",
        "labels": ["member:tu", "role:gis", "sprint-2"],
        "body": """### 👤 Người phụ trách: **Tú (GIS Pipeline & Data Engineer)**
- **Phân hệ code:** `services/gis-service/`
- **Thời gian thực hiện:** Sprint 2 (Tuần 2)
- **Epic:** Epic 2: GIS Satellite Pipeline & Community Field Reports

---

### 🎯 Mô tả yêu cầu (User Story):
> **As a** GIS Data Engineer,  
> **I want** a processor that computes NDVI difference ($\Delta\text{NDVI} = \text{NDVI}_{\text{post}} - \text{NDVI}_{\text{pre}}$) and extracts topographic slope degrees from SRTM 30m DEM,  
> **So that** sudden loss of vegetation on steep slopes is quantitatively measured.

---

### ✅ Tiêu chuẩn chấp thuận (Acceptance Criteria):
- [ ] Tính toán bản đồ biến động thực vật $\Delta\text{NDVI}$ giữa ảnh trước và sau thiên tai bằng `rasterio`.
- [ ] Trích xuất độ dốc địa hình theo độ $[0^\circ, 90^\circ]$ từ ảnh số độ cao SRTM DEM 30m.
- [ ] Đồng bộ hệ quy chiếu tọa độ chuẩn WGS84 EPSG:4326.
"""
    },
    {
        "title": "[Tú - GIS] Story 2.3: Adaptive Tiling Engine & Bounding Box Patch Generator",
        "labels": ["member:tu", "role:gis", "sprint-2"],
        "body": """### 👤 Người phụ trách: **Tú (GIS Pipeline)** | Phối hợp: **Duẫn (AI)**
- **Phân hệ code:** `services/gis-service/`
- **Thời gian thực hiện:** Sprint 2 (Tuần 2)
- **Epic:** Epic 2: GIS Satellite Pipeline & Community Field Reports

---

### 🎯 Mô tả yêu cầu (User Story):
> **As an** AI Engineer,  
> **I want** the GIS service to slice large satellite scenes into uniform $128 \times 128$ pixel patches with bounding box coordinates,  
> **So that** patches match the input dimensions required by deep learning segmentation networks.

---

### ✅ Tiêu chuẩn chấp thuận (Acceptance Criteria):
- [ ] Endpoint `/api/v1/gis/tiling` nhận Bounding Box của AOI và trả về danh sách tọa độ các patch $128 \times 128$.
- [ ] Băm lưới tính đến độ nén kinh độ theo vĩ độ ($111 \times \cos(\text{lat})$).
- [ ] Overlapping tile margins đảm bảo vết sạt lở ở mép không bị cắt đứt.
"""
    },
    {
        "title": "[Thuận - Backend] Story 2.4: Community Field Report API (GPS & Photo Upload)",
        "labels": ["member:thuan", "role:backend", "sprint-2"],
        "body": """### 👤 Người phụ trách: **Thuận (Backend Engineer)** | Phối hợp: **Lâm (Mobile)**
- **Phân hệ code:** `services/core-api/`
- **Thời gian thực hiện:** Sprint 2 (Tuần 2)
- **Epic:** Epic 2: GIS Satellite Pipeline & Community Field Reports

---

### 🎯 Mô tả yêu cầu (User Story):
> **As a** Disaster Officer,  
> **I want** an API endpoint to receive field reports of observed landslide signs from citizens, containing GPS coordinates and photos,  
> **So that** ground-truth reports supplement satellite observations in the verification process.

---

### ✅ Tiêu chuẩn chấp thuận (Acceptance Criteria):
- [ ] Endpoint `POST /api/v1/core/reports` tiếp nhận tọa độ GPS, nội dung mô tả và ảnh hiện trường (role `citizen` trở lên).
- [ ] Tạo bản ghi trong `core_schema.community_reports` (trạng thái `submitted`) và bắn sự kiện `COMMUNITY_REPORT_SUBMITTED` lên Redis Event Bus.
- [ ] Endpoint `GET /api/v1/core/reports` (role `officer`/`admin`) trả danh sách báo cáo dạng GeoJSON để hiển thị trên WebGIS.
"""
    },

    # Epic 3
    {
        "title": "[Duẫn - AI] Story 3.1: Pretrained DeepLabV3+ ONNX Model Loading (Landslide4Sense Benchmark)",
        "labels": ["member:duan", "role:ai", "sprint-3"],
        "body": """### 👤 Người phụ trách: **Duẫn (AI / Computer Vision Engineer)**
- **Phân hệ code:** `services/ai-service/`
- **Thời gian thực hiện:** Sprint 3 (Tuần 3)
- **Epic:** Epic 3: AI Deep Learning, Landslide Segmentation & Risk Scoring

---

### 🎯 Mô tả yêu cầu (User Story):
> **As an** AI Engineer,  
> **I want** `ai-service` to load a pretrained DeepLabV3+ ONNX model and preprocess raw input into an 8-channel normalized float tensor,  
> **So that** inference executes efficiently on CPU with GPU fallback.

---

### ✅ Tiêu chuẩn chấp thuận (Acceptance Criteria):
- [ ] Nạp trọng số mô hình (`models/landslide_deeplabv3plus.onnx`) khi khởi động service bằng ONNX Runtime.
- [ ] Chuẩn hóa tensor đầu vào kích thước `[1, 8, 128, 128]` theo mean/std của bộ dữ liệu Landslide4Sense.
- [ ] Kiểm thử cold-start đảm bảo mô hình chạy suy luận tensor trong thời gian $< 300\text{ ms}$.
"""
    },
    {
        "title": "[Duẫn - AI] Story 3.2: 8-Channel Multi-Spectral Inference & Binary Mask Segmentation",
        "labels": ["member:duan", "role:ai", "sprint-3"],
        "body": """### 👤 Người phụ trách: **Duẫn (AI / Computer Vision Engineer)**
- **Phân hệ code:** `services/ai-service/`
- **Thời gian thực hiện:** Sprint 3 (Tuần 3)
- **Epic:** Epic 3: AI Deep Learning, Landslide Segmentation & Risk Scoring

---

### 🎯 Mô tả yêu cầu (User Story):
> **As an** AI Engineer,  
> **I want** the AI engine to predict pixel-level landslide probabilities from the 8-channel tensor `[B2, B3, B4, B8, B11, B12, NDVI, SLOPE]`,  
> **So that** scars of slipped earth are accurately segmented.

---

### ✅ Tiêu chuẩn chấp thuận (Acceptance Criteria):
- [ ] Hàm kích hoạt Sigmoid xuất ra ma trận xác suất $[0.0, 1.0]$ cho từng pixel.
- [ ] Ngưỡng hóa ($\ge 0.5$) tạo ra mặt nạ nhị phân (Binary Mask) phân biệt đất sạt lở với nền.
- [ ] Đánh giá trên tập test đạt $F_1 \ge 0.70$ và $\text{IoU} \ge 0.60$.
"""
    },
    {
        "title": "[Tú - GIS & Duẫn - AI] Story 3.3: Polygonization: Converting Raster Mask to PostGIS MultiPolygon GeoJSON",
        "labels": ["member:tu", "member:duan", "role:gis", "role:ai", "sprint-3"],
        "body": """### 👤 Người phụ trách: **Tú (GIS Pipeline)** & **Duẫn (AI / CV)**
- **Phân hệ code:** `services/gis-service/`, `services/ai-service/`
- **Thời gian thực hiện:** Sprint 3 (Tuần 3)
- **Epic:** Epic 3: AI Deep Learning, Landslide Segmentation & Risk Scoring

---

### 🎯 Mô tả yêu cầu (User Story):
> **As a** GIS Developer,  
> **I want** the AI service to convert binary raster masks into smooth vector polygons (GeoJSON MultiPolygon) with coordinate georeferencing,  
> **So that** detected landslide bodies can be rendered on WebGIS and stored in PostGIS.

---

### ✅ Tiêu chuẩn chấp thuận (Acceptance Criteria):
- [ ] Vector hóa từ raster sang đa giác hình học bằng `rasterio.features.shapes` và `shapely`.
- [ ] Tọa độ đa giác được ánh xạ chính xác về tọa độ địa lý WGS84 thực tế.
- [ ] Tự động lọc bỏ các đốm nhiễu có diện tích quá nhỏ ($< 100\text{ m}^2$).
"""
    },
    {
        "title": "[Duẫn - AI] Story 3.4: Landslide Risk Level Scoring (Slope & Residential Proximity)",
        "labels": ["member:duan", "role:ai", "sprint-3"],
        "body": """### 👤 Người phụ trách: **Duẫn (AI Engineer)** | Phối hợp: **Tú (GIS)**
- **Phân hệ code:** `services/ai-service/`
- **Thời gian thực hiện:** Sprint 3 (Tuần 3)
- **Epic:** Epic 3: AI Deep Learning, Landslide Segmentation & Risk Scoring

---

### 🎯 Mô tả yêu cầu (User Story):
> **As a** Disaster Officer,  
> **I want** every detected landslide polygon to be automatically ranked by risk level,  
> **So that** I can prioritize verifying and warning the most dangerous zones first.

---

### ✅ Tiêu chuẩn chấp thuận (Acceptance Criteria):
- [ ] Tính điểm nguy cơ dựa trên: độ dốc trung bình, diện tích vùng sạt lở, độ tin cậy AI và khoảng cách tới khu dân cư gần nhất (PostGIS `ST_Distance`).
- [ ] Ánh xạ điểm số sang `risk_level`: `low`, `medium`, `high`, `extreme`.
- [ ] Kết quả trả về trong JSON suy luận và lưu vào `core_schema.landslide_events.risk_level`.
"""
    },

    # Epic 4
    {
        "title": "[Thuận - Backend] Story 4.1: Redis Pub/Sub Event Bus & Resilience4j Circuit Breaker",
        "labels": ["member:thuan", "role:backend", "sprint-4"],
        "body": """### 👤 Người phụ trách: **Thuận (Backend Engineer & Architect)**
- **Phân hệ code:** `services/core-api/`
- **Thời gian thực hiện:** Sprint 4 (Tuần 4)
- **Epic:** Epic 4: Event-Driven Processing, WebGIS Command Center & Emergency Alerts

---

### 🎯 Mô tả yêu cầu (User Story):
> **As a** Backend Engineer,  
> **I want** bidirectional asynchronous communication via Redis channel `terrawatch:events` and Circuit Breaker isolation for AI/GIS calls,  
> **So that** the Core API never crashes when dependent Python services are overloaded.

---

### ✅ Tiêu chuẩn chấp thuận (Acceptance Criteria):
- [ ] Các sự kiện `LANDSLIDE_DETECTED`, `LANDSLIDE_VERIFIED`, `COMMUNITY_REPORT_SUBMITTED` và `EMERGENCY_ALERT_BROADCAST` được publish và consume ổn định.
- [ ] Resilience4j Circuit Breaker tự động chuyển sang `OPEN` khi tỷ lệ lỗi $\ge 50\%$, kích hoạt Fallback lưu vào hàng đợi ngầm mà không gây sập Core API.
"""
    },
    {
        "title": "[Huy - WebGIS] Story 4.2: WebGIS Verification Queue & One-Click Landslide Approval",
        "labels": ["member:huy", "role:webgis", "sprint-4"],
        "body": """### 👤 Người phụ trách: **Huy (Frontend WebGIS Engineer)** | Phối hợp: **Thuận (Backend)**
- **Phân hệ code:** `apps/webgis/`
- **Thời gian thực hiện:** Sprint 4 (Tuần 4)
- **Epic:** Epic 4: Event-Driven Processing, WebGIS Command Center & Emergency Alerts

---

### 🎯 Mô tả yêu cầu (User Story):
> **As a** Disaster Officer,  
> **I want** a dashboard listing pending AI landslide detections with risk level, confidence scores and one-click verification,  
> **So that** verified hazards are published on the map and ready for warning dissemination.

---

### ✅ Tiêu chuẩn chấp thuận (Acceptance Criteria):
- [ ] Dashboard hiển thị danh sách các sự kiện sạt lở chờ duyệt (`pending`), kèm diện tích (ha), độ dốc, mức nguy cơ và độ tin cậy.
- [ ] Nút "Phê Duyệt" gọi `POST /api/v1/core/landslides/{id}/verify`, chuyển trạng thái sang `verified`; nút "Bác Bỏ" chuyển sang `rejected` / `false_alarm`.
- [ ] Sau khi duyệt sự cố mức `high`/`extreme`, hệ thống gợi ý Admin mở form Phát Cảnh Báo Khẩn Cấp với vùng ảnh hưởng điền sẵn.
"""
    },
    {
        "title": "[Huy - WebGIS] Story 4.3: 3D Terrain Hazard Map & Before/After Time-Slider",
        "labels": ["member:huy", "role:webgis", "sprint-4"],
        "body": """### 👤 Người phụ trách: **Huy (Frontend WebGIS Engineer)**
- **Phân hệ code:** `apps/webgis/`
- **Thời gian thực hiện:** Sprint 4 (Tuần 4)
- **Epic:** Epic 4: Event-Driven Processing, WebGIS Command Center & Emergency Alerts

---

### 🎯 Mô tả yêu cầu (User Story):
> **As a** Disaster Officer,  
> **I want** an interactive 3D map showing mountain terrain, landslide hazard polygons colored by risk level, community field reports and a before/after satellite comparison slider,  
> **So that** I can accurately assess each detected landslide before approving warnings.

---

### ✅ Tiêu chuẩn chấp thuận (Acceptance Criteria):
- [ ] Bản đồ Mapbox GL bật lớp 3D Terrain hiển thị địa hình núi đồi Yên Bái, Lào Cai chân thực.
- [ ] Hiển thị đa giác sạt lở tô màu theo `risk_level`, báo cáo hiện trường của người dân và ranh giới AOI.
- [ ] Thanh trượt so sánh ảnh vệ tinh trước/sau biến động (Time-slider swipe).
- [ ] Điều khiển camera 3D: Xoay 360 độ, nghiêng góc nhìn (pitch), phóng to chi tiết điểm sạt lở.
"""
    },
    {
        "title": "[Thuận - Backend & Huy - WebGIS] Story 4.4: Admin Emergency Alert Broadcast (SMS & App Push)",
        "labels": ["member:thuan", "member:huy", "role:backend", "role:webgis", "sprint-4"],
        "body": """### 👤 Người phụ trách: **Thuận (Backend)** & **Huy (WebGIS)** | Phối hợp: **Lâm (Mobile)**
- **Phân hệ code:** `services/core-api/`, `apps/webgis/`
- **Thời gian thực hiện:** Sprint 4 (Tuần 4)
- **Epic:** Epic 4: Event-Driven Processing, WebGIS Command Center & Emergency Alerts

---

### 🎯 Mô tả yêu cầu (User Story):
> **As an** Admin,  
> **I want** a prominent '🚨 Phát Cảnh Báo Khẩn Cấp' button on the WebGIS dashboard to send an emergency landslide warning to citizens via SMS and mobile app push notification,  
> **So that** residents in the affected area are warned to evacuate immediately.

---

### ✅ Tiêu chuẩn chấp thuận (Acceptance Criteria):
- [ ] Nút chỉ hiển thị với role `admin`; API `POST /api/v1/core/alerts/broadcast` bảo vệ bằng `hasRole('ADMIN')`.
- [ ] Chọn phạm vi nhận: theo sự cố đã duyệt (vùng đệm bán kính), theo AOI, hoặc toàn bộ người dùng.
- [ ] Chọn kênh gửi: SMS, Push App (FCM), hoặc cả hai; xác nhận 2 bước hiển thị số người nhận dự kiến trước khi gửi.
- [ ] Gửi bất đồng bộ theo lô qua Redis worker, có retry; lưu kết quả vào `core_schema.alert_deliveries` (`sent`/`failed`).
- [ ] Người nhận xác định theo vùng quan tâm đã đăng ký (`alert_subscriptions`), không dùng GPS thời gian thực (NFR5).
- [ ] Ghi vết kiểm toán (Audit Trail) mọi lần phát cảnh báo; hiển thị lịch sử và thống kê trên dashboard.
"""
    },

    # Epic 5
    {
        "title": "[Lâm - Mobile] Story 5.1: Citizen Alert Subscription & Emergency Alert Reception (Push + SMS)",
        "labels": ["member:lam", "role:mobile", "sprint-5"],
        "body": """### 👤 Người phụ trách: **Lâm (Mobile App Engineer)** | Phối hợp: **Thuận (Backend)**
- **Phân hệ code:** `apps/mobile/`
- **Thời gian thực hiện:** Sprint 5 (Tuần 5)
- **Epic:** Epic 5: Citizen Mobile App, Offline Geofencing & End-to-End Demo

---

### 🎯 Mô tả yêu cầu (User Story):
> **As a** Citizen,  
> **I want to** register my phone number and areas of interest in the app and receive emergency landslide alerts,  
> **So that** I am warned immediately when the authorities issue an evacuation warning for my area.

---

### ✅ Tiêu chuẩn chấp thuận (Acceptance Criteria):
- [ ] Màn hình đăng ký nhận cảnh báo: nhập SĐT, chọn vùng quan tâm $\rightarrow$ `POST /api/v1/core/alerts/subscriptions`.
- [ ] App tự động đăng ký FCM token khi đăng nhập $\rightarrow$ `POST /api/v1/core/devices/register`.
- [ ] Khi nhận Push loại `EMERGENCY_ALERT`: hiển thị màn hình cảnh báo đỏ toàn màn hình, rung và phát âm thanh báo động kể cả khi chạy nền.
- [ ] Danh sách lịch sử các cảnh báo đã nhận trong app.
- [ ] Người dân không cài app hoặc mất dữ liệu di động vẫn nhận được cảnh báo qua SMS từ backend.
"""
    },
    {
        "title": "[Lâm - Mobile] Story 5.2: Mobile Community Field Report (Photo & GPS)",
        "labels": ["member:lam", "role:mobile", "sprint-5"],
        "body": """### 👤 Người phụ trách: **Lâm (Mobile App Engineer)** | Phối hợp: **Thuận (Backend)**
- **Phân hệ code:** `apps/mobile/`
- **Thời gian thực hiện:** Sprint 5 (Tuần 5)
- **Epic:** Epic 5: Citizen Mobile App, Offline Geofencing & End-to-End Demo

---

### 🎯 Mô tả yêu cầu (User Story):
> **As a** Citizen,  
> **I want to** report observed landslide signs with a photo and my GPS location,  
> **So that** officers receive ground-truth evidence to verify landslide hazards.

---

### ✅ Tiêu chuẩn chấp thuận (Acceptance Criteria):
- [ ] Màn hình "Báo cáo hiện trường": tự động lấy tọa độ GPS, chụp/chọn ảnh, nhập mô tả ngắn.
- [ ] Gửi lên `POST /api/v1/core/reports`; nếu mất mạng thì lưu hàng đợi cục bộ và tự gửi lại khi có kết nối.
- [ ] Màn hình xác nhận hiển thị mã báo cáo và trạng thái xử lý (`submitted` / `processed`).
"""
    },
    {
        "title": "[Lâm - Mobile] Story 5.3: Offline Geofencing Hazard Alert & Loud Siren (Ray-Casting & SQLite)",
        "labels": ["member:lam", "role:mobile", "sprint-5"],
        "body": """### 👤 Người phụ trách: **Lâm (Mobile App Engineer)**
- **Phân hệ code:** `apps/mobile/`
- **Thời gian thực hiện:** Sprint 5 (Tuần 5)
- **Epic:** Epic 5: Citizen Mobile App, Offline Geofencing & End-to-End Demo

---

### 🎯 Mô tả yêu cầu (User Story):
> **As a** Mountain Traveler or Citizen moving through mountainous areas with zero cell reception,  
> **I want** my phone to detect nearby landslide hazard zones locally and sound a loud emergency siren,  
> **So that** I am warned to evacuate before entering an active slide zone.

---

### ✅ Tiêu chuẩn chấp thuận (Acceptance Criteria):
- [ ] CSDL SQLite cục bộ trên điện thoại lưu trữ sẵn danh sách đa giác các vùng có nguy cơ sạt lở ($\ge 10,000$ đa giác).
- [ ] Background location tracker chạy ngầm, tính khoảng cách Haversine và thuật toán Ray-Casting mỗi 10 giây (vị trí GPS chỉ xử lý cục bộ, NFR5).
- [ ] Bước chân vào vùng đa giác sạt lở: Lập tức chớp màn hình đỏ, rung và phát còi hú âm lượng tối đa ngay cả khi máy để chế độ im lặng.
"""
    },
    {
        "title": "[Toàn Đội 5 Thành Viên] Story 5.4: End-to-End System Integration Flow & 5-Week Milestone Demo",
        "labels": ["team:all", "sprint-5"],
        "body": """### 👤 Người phụ trách: **Toàn bộ 5 thành viên (Duẫn, Tú, Thuận, Huy, Lâm)**
- **Phân hệ code:** Toàn bộ 7 services
- **Thời gian thực hiện:** Sprint 5 (Tuần 5)
- **Epic:** Epic 5: Citizen Mobile App, Offline Geofencing & End-to-End Demo

---

### 🎯 Mô tả yêu cầu (User Story):
> **As the** Project Team,  
> **I want to** demonstrate a complete, flawless end-to-end early-warning flow across all components,  
> **So that** the 5-week MVP milestone is 100% achieved and ready for faculty review.

---

### ✅ Tiêu chuẩn chấp thuận (Acceptance Criteria):
- [ ] Kịch bản demo thông suốt từ đầu đến cuối:
  1. Tú & Duẫn: Vệ tinh Sentinel-2 nạp vào $\rightarrow$ AI DeepLabV3+ quét ra đa giác sạt lở $\rightarrow$ xếp hạng mức nguy cơ.
  2. Thuận: Core API ghi nhận sự cố, bắn Redis Event Bus.
  3. Huy: WebGIS 3D hiển thị vết sạt lở, cán bộ đối chiếu ảnh trước/sau và ấn duyệt.
  4. Admin bấm "🚨 Phát Cảnh Báo Khẩn Cấp" $\rightarrow$ người dân trong vùng nhận SMS và thông báo App.
  5. Lâm: Mobile App hiển thị cảnh báo khẩn cấp; đồng thời mô phỏng người dân mất mạng bước vào vùng nguy cơ còi hú báo động ngay lập tức.
  6. 0 lỗi crash trên toàn bộ 7 services Docker.
"""
    }
]

def main():
    print("🚀 [GitHub Issue Generator] Creating labels...")
    for label in LABELS:
        cmd = [
            GH_BIN, "label", "create", label["name"],
            "--color", label["color"],
            "--description", label["desc"],
            "--force"
        ]
        res = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8")
        if res.returncode == 0:
            print(f"  ✅ Label ready: {label['name']}")
        else:
            print(f"  ⚠️ Label error {label['name']}: {res.stderr.strip()}")

    print(f"\n🚀 [GitHub Issue Generator] Creating {len(STORIES)} Issues with member assignments...")
    for idx, story in enumerate(STORIES, start=1):
        print(f"  [{idx}/{len(STORIES)}] Creating: {story['title'][:60]}...")
        cmd = [
            GH_BIN, "issue", "create",
            "--title", story["title"],
            "--body", story["body"]
        ]
        for l in story["labels"]:
            cmd.extend(["--label", l])

        res = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8")
        if res.returncode == 0:
            print(f"    🎉 Created: {res.stdout.strip()}")
        else:
            print(f"    ❌ Error: {res.stderr.strip()}")
        time.sleep(1)  # avoid rate limiting

    print("\n🏁 All 19 GitHub Issues created successfully!")

if __name__ == "__main__":
    main()
