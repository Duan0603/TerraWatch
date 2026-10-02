#!/usr/bin/env python3
"""
GeoSentry (TerraWatch) - Automated GitHub Issues & Labels Generator
Parses Epics and User Stories, generating color-coded labels and professional GitHub Issues
with explicit team member assignments in title and body.
"""

import subprocess
import time
import os
import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

GH_BIN = r"C:\Program Files\GitHub CLI\gh.exe"
if not os.path.exists(GH_BIN):
    GH_BIN = "gh"

LABELS = [
    # Members
    {"name": "member:duan", "color": "1f77b4", "desc": "Phụ trách: Duẫn (AI / Computer Vision Engineer)"},
    {"name": "member:tu", "color": "2ca02c", "desc": "Phụ trách: Tú (GIS Pipeline & Data Engineer)"},
    {"name": "member:thuan", "color": "d62728", "desc": "Phụ trách: Thuận (Backend Engineer & System Architect)"},
    {"name": "member:huy", "color": "9467bd", "desc": "Phụ trách: Huy (Frontend WebGIS 3D Engineer)"},
    {"name": "member:lam", "color": "ff7f0e", "desc": "Phụ trách: Lâm (Mobile App & Geofencing Engineer)"},
    {"name": "team:all", "color": "e377c2", "desc": "Toàn bộ 5 thành viên phối hợp liên thông"},

    # Roles / Components
    {"name": "role:backend", "color": "0052cc", "desc": "Core API Service (Java Spring Boot 3 + PostGIS)"},
    {"name": "role:ai", "color": "5319e7", "desc": "AI Inference Service (Python FastAPI / ONNX)"},
    {"name": "role:gis", "color": "006b75", "desc": "GIS Data Service (Python FastAPI / Sentinel-2 / DEM)"},
    {"name": "role:webgis", "color": "1d76db", "desc": "WebGIS Command Center (React 18 + Mapbox 3D)"},
    {"name": "role:mobile", "color": "fbca04", "desc": "Mobile Citizen App (Flutter 3.x + SQLite Geofencing)"},

    # Sprints
    {"name": "sprint-1", "color": "0e8a16", "desc": "Sprint 1: Auth & PostGIS Foundation (Tuần 1)"},
    {"name": "sprint-2", "color": "0e8a16", "desc": "Sprint 2: GIS Pipeline & Landslide Ingestion (Tuần 2)"},
    {"name": "sprint-3", "color": "0e8a16", "desc": "Sprint 3: AI DeepLabV3+ & Route Optimization (Tuần 3)"},
    {"name": "sprint-4", "color": "0e8a16", "desc": "Sprint 4: WebGIS 3D Command Center & Dispatch (Tuần 4)"},
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
- **Epic:** Epic 1: Authentication, Multi-Role RBAC & Landslide Database Foundation

---

### 🎯 Mô tả yêu cầu (User Story):
> **As a** User (Citizen, Rescue Team Member, Disaster Officer, or Admin),  
> **I want to** register and log in securely to obtain a role-specific JWT access token,  
> **So that** my identity and permissions are verified across WebGIS and Mobile applications.

---

### ✅ Tiêu chuẩn chấp thuận (Acceptance Criteria):
- [ ] Endpoint `POST /api/v1/auth/register` tạo người dùng với 4 roles: `citizen`, `rescue_team`, `officer`, `admin`. Mật khẩu băm bằng BCrypt.
- [ ] Endpoint `POST /api/v1/auth/login` kiểm tra email/mật khẩu và trả về JWT token chứa `userId`, `email`, và `role`.
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
- **Epic:** Epic 1: Authentication, Multi-Role RBAC & Landslide Database Foundation

---

### 🎯 Mô tả yêu cầu (User Story):
> **As a** Backend & Data Engineer,  
> **I want** PostgreSQL 15 + PostGIS schemas (`core_schema`, `gis_schema`) configured with GiST spatial indexes and Flyway migration scripts,  
> **So that** spatial queries on landslide hazard polygons execute in $< 50\text{ ms}$ with strict data isolation.

---

### ✅ Tiêu chuẩn chấp thuận (Acceptance Criteria):
- [ ] Khởi tạo đầy đủ bảng `core_schema.users`, `core_schema.landslide_events`, `core_schema.landslide_event_history`, `core_schema.sos_requests`, `core_schema.rescue_missions`, và `gis_schema.monitoring_areas`.
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
- **Epic:** Epic 1: Authentication, Multi-Role RBAC & Landslide Database Foundation

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
- **Epic:** Epic 2: GIS Satellite Pipeline & Landslide Ingestion

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
- **Epic:** Epic 2: GIS Satellite Pipeline & Landslide Ingestion

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
- **Epic:** Epic 2: GIS Satellite Pipeline & Landslide Ingestion

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
        "title": "[Thuận - Backend] Story 2.4: Emergency Landslide SOS Ingestion API with GPS & Photo Upload",
        "labels": ["member:thuan", "role:backend", "sprint-2"],
        "body": """### 👤 Người phụ trách: **Thuận (Backend Engineer)** | Phối hợp: **Lâm (Mobile)**
- **Phân hệ code:** `services/core-api/`
- **Thời gian thực hiện:** Sprint 2 (Tuần 2)
- **Epic:** Epic 2: GIS Satellite Pipeline & Landslide Ingestion

---

### 🎯 Mô tả yêu cầu (User Story):
> **As a** Disaster Officer,  
> **I want** an API endpoint to receive emergency SOS reports from citizens trapped in landslide zones containing GPS coordinates and field photos,  
> **So that** ground-truth reports can immediately supplement satellite observations.

---

### ✅ Tiêu chuẩn chấp thuận (Acceptance Criteria):
- [ ] Endpoint `POST /api/v1/sos/send` tiếp nhận tọa độ GPS, nội dung mô tả và file ảnh/video hiện trường.
- [ ] Tạo bản ghi trong `core_schema.sos_requests` và bắn sự kiện `LANDSLIDE_SOS_TRIGGERED` lên Redis Event Bus.
"""
    },

    # Epic 3
    {
        "title": "[Duẫn - AI] Story 3.1: Pretrained DeepLabV3+ ONNX Model Loading (Landslide4Sense Benchmark)",
        "labels": ["member:duan", "role:ai", "sprint-3"],
        "body": """### 👤 Người phụ trách: **Duẫn (AI / Computer Vision Engineer)**
- **Phân hệ code:** `services/ai-service/`
- **Thời gian thực hiện:** Sprint 3 (Tuần 3)
- **Epic:** Epic 3: AI Deep Learning & Landslide Segmentation Engine

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
- **Epic:** Epic 3: AI Deep Learning & Landslide Segmentation Engine

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
- **Epic:** Epic 3: AI Deep Learning & Landslide Segmentation Engine

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
        "title": "[Duẫn - AI] Story 3.4: AI Rescue Route Recommendation Engine (Bypass Landslide Hazard Zones)",
        "labels": ["member:duan", "role:ai", "sprint-3"],
        "body": """### 👤 Người phụ trách: **Duẫn (AI Engineer)** | Phối hợp: **Tú (GIS)**
- **Phân hệ code:** `services/ai-service/`
- **Thời gian thực hiện:** Sprint 3 (Tuần 3)
- **Epic:** Epic 3: AI Deep Learning & Landslide Segmentation Engine

---

### 🎯 Mô tả yêu cầu (User Story):
> **As a** Rescue Team Leader,  
> **I want** the AI to calculate the safest approach route from the rescue station to trapped victims, bypassing active landslide hazard zones,  
> **So that** rescue vehicles avoid blocked mountain passes and unstable mudslide roads.

---

### ✅ Tiêu chuẩn chấp thuận (Acceptance Criteria):
- [ ] Thuật toán tìm đường (A* / Dijkstra trên đồ thị OpenStreetMap qua `osmnx` hoặc `networkx`) áp trọng số phạt cực lớn cho các đoạn đường giao cắt với đa giác nguy cơ sạt lở (Danger Zone).
- [ ] Xuất kết quả tuyến đường cứu hộ dưới dạng `GeoJSON LineString`.
- [ ] Nhận diện các điểm chướng ngại vật thứ cấp (⚠ Hazard: đá lăn, taluy âm sạt trượt).
"""
    },

    # Epic 4
    {
        "title": "[Thuận - Backend] Story 4.1: Redis Pub/Sub Event Bus & Resilience4j Circuit Breaker",
        "labels": ["member:thuan", "role:backend", "sprint-4"],
        "body": """### 👤 Người phụ trách: **Thuận (Backend Engineer & Architect)**
- **Phân hệ code:** `services/core-api/`
- **Thời gian thực hiện:** Sprint 4 (Tuần 4)
- **Epic:** Epic 4: Event-Driven Processing & WebGIS 3D Command Center

---

### 🎯 Mô tả yêu cầu (User Story):
> **As a** Backend Engineer,  
> **I want** bidirectional asynchronous communication via Redis channel `terrawatch:events` and Circuit Breaker isolation for AI/GIS calls,  
> **So that** the Core API never crashes when dependent Python services are overloaded.

---

### ✅ Tiêu chuẩn chấp thuận (Acceptance Criteria):
- [ ] Các sự kiện `LANDSLIDE_DETECTED`, `LANDSLIDE_VERIFIED`, và `SOS_TRIGGERED` được publish và consume ổn định.
- [ ] Resilience4j Circuit Breaker tự động chuyển sang `OPEN` khi tỷ lệ lỗi $\ge 50\%$, kích hoạt Fallback lưu vào hàng đợi ngầm mà không gây sập Core API.
"""
    },
    {
        "title": "[Huy - WebGIS] Story 4.2: WebGIS Incident Management Dashboard & One-Click Landslide Approval",
        "labels": ["member:huy", "role:webgis", "sprint-4"],
        "body": """### 👤 Người phụ trách: **Huy (Frontend WebGIS Engineer)** | Phối hợp: **Thuận (Backend)**
- **Phân hệ code:** `apps/webgis/`
- **Thời gian thực hiện:** Sprint 4 (Tuần 4)
- **Epic:** Epic 4: Event-Driven Processing & WebGIS 3D Command Center

---

### 🎯 Mô tả yêu cầu (User Story):
> **As a** Disaster Officer,  
> **I want** a dashboard listing pending AI landslide detections with confidence scores and one-click verification,  
> **So that** verified alerts immediately propagate to the emergency broadcast and rescue dispatch system.

---

### ✅ Tiêu chuẩn chấp thuận (Acceptance Criteria):
- [ ] Dashboard hiển thị danh sách các sự kiện sạt lở chờ duyệt (`PENDING`), kèm diện tích (ha), độ dốc và độ tin cậy.
- [ ] Nút "Phê Duyệt (Approve)" gọi `POST /api/v1/core/landslides/{id}/verify`, chuyển trạng thái sang `VERIFIED` và bắn còi báo động.
"""
    },
    {
        "title": "[Huy - WebGIS] Story 4.3: 3D Landslide Rescue Scene (Terrain 3D, Danger Zone, Victim, Hazard, Route)",
        "labels": ["member:huy", "role:webgis", "sprint-4"],
        "body": """### 👤 Người phụ trách: **Huy (Frontend WebGIS Engineer)**
- **Phân hệ code:** `apps/webgis/`
- **Thời gian thực hiện:** Sprint 4 (Tuần 4)
- **Epic:** Epic 4: Event-Driven Processing & WebGIS 3D Command Center

---

### 🎯 Mô tả yêu cầu (User Story):
> **As a** Rescue Commander,  
> **I want** an interactive 3D scene visualizing the mountain terrain, the landslide scar (🔴 Danger Zone), trapped victim locations (🟢 Victim), rockfall hazards (⚠ Hazard), and the rescue route (🚒 Rescue Route),  
> **So that** rescue teams can grasp the dangerous topography before entering the disaster zone.

---

### ✅ Tiêu chuẩn chấp thuận (Acceptance Criteria):
- [ ] Bản đồ Mapbox GL bật lớp 3D Terrain hiển thị địa hình núi đồi Yên Bái, Lào Cai chân thực.
- [ ] Hiển thị đầy đủ 4 lớp marker không gian 3D:
  - 🔴 Danger Zone: Đa giác bùn đất sạt lở.
  - 🟢 Victim: Vị trí người dân gửi SOS kêu cứu.
  - ⚠ Hazard: Điểm nguy cơ sạt trượt thứ cấp.
  - 🚒 Rescue Route: Tuyến đường cứu hộ được AI đề xuất.
- [ ] Điều khiển camera 3D: Xoay 360 độ, nghiêng góc nhìn (pitch), phóng to chi tiết điểm sạt lở.
"""
    },
    {
        "title": "[Huy - WebGIS & Thuận - Backend] Story 4.4: Rescue Team Dispatch & Mission Status Management",
        "labels": ["member:huy", "member:thuan", "role:webgis", "role:backend", "sprint-4"],
        "body": """### 👤 Người phụ trách: **Huy (WebGIS)** & **Thuận (Backend)**
- **Phân hệ code:** `apps/webgis/`, `services/core-api/`
- **Thời gian thực hiện:** Sprint 4 (Tuần 4)
- **Epic:** Epic 4: Event-Driven Processing & WebGIS 3D Command Center

---

### 🎯 Mô tả yêu cầu (User Story):
> **As an** Emergency Dispatcher,  
> **I want** to assign a specific Rescue Team to a landslide incident and track mission status in real time,  
> **So that** rescue operations are coordinated efficiently.

---

### ✅ Tiêu chuẩn chấp thuận (Acceptance Criteria):
- [ ] Cán bộ chọn sự cố sạt lở $\rightarrow$ Gán đội cứu hộ phụ trách $\rightarrow$ Đổi trạng thái sang `DISPATCHED`.
- [ ] Trạng thái nhiệm vụ chuyển đổi tuần tự: `EN_ROUTE` $\rightarrow$ `ON_SCENE` $\rightarrow$ `VICTIMS_EVACUATED` $\rightarrow$ `RESOLVED`.
- [ ] Mọi thao tác được lưu vết kiểm toán (Audit Trail) trong bảng `landslide_event_history`.
"""
    },

    # Epic 5
    {
        "title": "[Lâm - Mobile] Story 5.1: 1-Tap Landslide SOS Emergency Button with Auto-GPS & Media Capture",
        "labels": ["member:lam", "role:mobile", "sprint-5"],
        "body": """### 👤 Người phụ trách: **Lâm (Mobile App Engineer)** | Phối hợp: **Thuận (Backend)**
- **Phân hệ code:** `apps/mobile/`
- **Thời gian thực hiện:** Sprint 5 (Tuần 5)
- **Epic:** Epic 5: Citizen Mobile App, Offline Geofencing & End-to-End Demo

---

### 🎯 Mô tả yêu cầu (User Story):
> **As a** Citizen trapped or isolated by a landslide,  
> **I want** a prominent 1-tap SOS button that auto-captures my precise GPS coordinates and allows instant photo transmission of the landslide,  
> **So that** I can call for rescue immediately even when panicked.

---

### ✅ Tiêu chuẩn chấp thuận (Acceptance Criteria):
- [ ] Nút bấm SOS màu đỏ nổi bật ngay giữa màn hình chính ứng dụng di động.
- [ ] Tự động lấy tọa độ GPS chính xác cao, đính kèm ảnh hiện trường và gửi lên `/api/v1/sos/send`.
- [ ] Màn hình xác nhận hiển thị mã yêu cầu cứu hộ và số điện thoại đường dây nóng khẩn cấp.
"""
    },
    {
        "title": "[Lâm - Mobile] Story 5.2: Live Rescue Support Tracking for Trapped Mountain Communities",
        "labels": ["member:lam", "role:mobile", "sprint-5"],
        "body": """### 👤 Người phụ trách: **Lâm (Mobile App Engineer)**
- **Phân hệ code:** `apps/mobile/`
- **Thời gian thực hiện:** Sprint 5 (Tuần 5)
- **Epic:** Epic 5: Citizen Mobile App, Offline Geofencing & End-to-End Demo

---

### 🎯 Mô tả yêu cầu (User Story):
> **As a** Citizen waiting for rescue,  
> **I want** to see the real-time status of my rescue request and the approaching rescue team on a map,  
> **So that** trapped victims remain informed and reassured.

---

### ✅ Tiêu chuẩn chấp thuận (Acceptance Criteria):
- [ ] Thanh tiến trình trên điện thoại: `Đã tiếp nhận` $\rightarrow$ `Đội cứu hộ đang di chuyển` $\rightarrow$ `Đã tiếp cận hiện trường`.
- [ ] Bản đồ hiển thị khoảng cách và thời gian dự kiến (ETA) của xe cứu nạn đang di chuyển tới.
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
- [ ] CSDL SQLite cục bộ trên điện thoại lưu trữ sẵn danh sách đa giác các vùng có nguy cơ sạt lở.
- [ ] Background location tracker chạy ngầm, tính khoảng cách Haversine và thuật toán Ray-Casting mỗi 10 giây.
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
> **I want to** demonstrate a complete, flawless end-to-end operational flow across all components,  
> **So that** the 5-week MVP milestone is 100% achieved and ready for faculty review.

---

### ✅ Tiêu chuẩn chấp thuận (Acceptance Criteria):
- [ ] Kịch bản demo thông suốt từ đầu đến cuối:
  1. Tú & Duẫn: Vệ tinh Sentinel-2 nạp vào $\rightarrow$ AI DeepLabV3+ quét ra đa giác sạt lở.
  2. Thuận: Core API ghi nhận sự cố, bắn Redis Event Bus.
  3. Duẫn: AI tính toán tuyến đường cứu hộ né tránh vùng sạt lở.
  4. Huy: WebGIS 3D hiển thị vết sạt lở, cán bộ ấn duyệt và gán đội cứu hộ.
  5. Lâm: Mobile App nhận nhiệm vụ cứu hộ; đồng thời mô phỏng người dân mất mạng bước vào vùng nguy cơ còi hú báo động ngay lập tức.
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
