# SECapstone: Epics and User Stories
## Project: GeoSentry (TerraWatch) - Hệ Thống Viễn Thám & AI Cảnh Báo Sớm Sạt Lở Đất
### Bảng Phân Bổ Nhân Sự: Duẫn (AI), Tú (GIS), Thuận (Backend), Huy (WebGIS), Lâm (Mobile)

> **Phạm vi dự án:** Chỉ tập trung vào **phát hiện và cảnh báo sớm sạt lở đất** (theo tài liệu yêu cầu gốc FR1–FR3, UC01–UC09).
> Hệ thống **không** bao gồm nghiệp vụ cứu hộ (điều phối đội cứu hộ, tuyến đường cứu hộ, SOS kêu cứu, theo dõi cứu nạn).

**Vai trò người dùng (RBAC 3 roles):** `admin` (Quản trị viên), `officer` (Cán bộ chuyên môn), `citizen` (Người dân).

---

# GIAI ĐOẠN 1: 5-WEEK ACCELERATED MVP (100% CHUYÊN SÂU CẢNH BÁO SẠT LỞ ĐẤT)

## Epic 1: Authentication, RBAC & Landslide Database Foundation (Tuần 1)
Thiết lập hệ thống xác thực người dùng 3 vai trò (`admin`, `officer`, `citizen`), JWT bảo mật và cấu trúc CSDL không gian PostGIS cho dữ liệu sạt lở và cảnh báo.

### Story 1.1: Multi-Role User Registration & Authentication (Register / Login / JWT)
**[Phụ trách chính: Thuận (Backend) | Hỗ trợ: Huy (WebGIS), Lâm (Mobile)]**  
As a User (Citizen, Officer, or Admin),  
I want to register and log in securely to obtain a role-specific JWT access token,  
So that my identity and permissions are verified across WebGIS and Mobile applications.  
**Acceptance Criteria:**
- Endpoint `POST /api/v1/auth/register` tạo người dùng (mặc định role `citizen`, có trường `phone_number` để nhận SMS cảnh báo). Mật khẩu băm bằng BCrypt.
- Chỉ `admin` mới được cấp/đổi role `officer` hoặc `admin` cho tài khoản khác.
- Endpoint `POST /api/v1/auth/login` kiểm tra email/mật khẩu và trả về JWT token chứa `userId`, `email`, và `role`.
- Endpoint `GET /api/v1/auth/me` trả về thông tin profile người dùng khi gửi kèm header `Authorization: Bearer <token>`.
- Các endpoint bảo vệ từ chối truy cập không có token hợp lệ với mã HTTP 401.

### Story 1.2: PostGIS Schema-per-Service Migration & Spatial Indexes
**[Phụ trách chính: Tú (GIS) & Thuận (Backend)]**  
As a Backend & Data Engineer,  
I want PostgreSQL 15 + PostGIS schemas (`core_schema`, `gis_schema`) configured with GiST spatial indexes and Flyway migration scripts,  
So that spatial queries on landslide hazard polygons execute in $< 50\text{ ms}$ with strict data isolation.  
**Acceptance Criteria:**
- Khởi tạo đầy đủ bảng `core_schema.users`, `core_schema.landslide_events`, `core_schema.landslide_event_history`, `core_schema.community_reports`, `core_schema.alert_subscriptions`, `core_schema.device_tokens`, `core_schema.alert_broadcasts`, `core_schema.alert_deliveries` và `gis_schema.monitoring_areas`.
- Mọi cột kiểu `geometry` được đánh chỉ mục không gian `USING GIST (geom)`.
- Script nạp dữ liệu địa bàn mẫu (Seed data) cho các điểm nóng sạt lở tại Yên Bái, Lào Cai, Hà Giang.

### Story 1.3: API Gateway Reverse Proxy & Rate Limiting
**[Phụ trách chính: Thuận (Backend / DevOps)]**  
As a DevOps Engineer,  
I want Nginx reverse proxy configured as the single entry point (Port 8080) with rate limiting (50 req/s) and unified CORS,  
So that internal microservice ports are protected and traffic routed seamlessly.  
**Acceptance Criteria:**
- Gateway định tuyến trong suốt: `/api/v1/auth/*`, `/api/v1/core/*`, `/api/v1/ai/*`, `/api/v1/gis/*`, và `/` (WebGIS SPA).
- CORS headers cấu hình chuẩn cho cả WebGIS (Port 5173/8080) và Flutter Mobile.

---

## Epic 2: GIS Satellite Pipeline & Community Field Reports (Tuần 2)
Xây dựng pipeline thu thập ảnh viễn thám Sentinel-2, tính toán độ dốc DEM, chỉ số suy giảm thảm phủ $\Delta\text{NDVI}$, phân mảnh Tiling và API tiếp nhận báo cáo hiện trường từ người dân (UC09).

### Story 2.1: Sentinel-2 Ingestion Pipeline & Cloud Masking Filter
**[Phụ trách chính: Tú (GIS Pipeline)]**  
As a GIS Data Engineer,  
I want an automated ingestion client that pulls Sentinel-2 L2A multi-spectral images for defined Areas of Interest (AOI) and filters out scenes with cloud coverage $> 40\%$,  
So that downstream AI models receive high-quality surface reflectance data.  
**Acceptance Criteria:**
- Kết nối tới Copernicus Data Space Ecosystem (CDSE) hoặc Sentinel Hub API.
- Thuật toán lọc mây dựa trên Scene Classification Layer (SCL / s2cloudless), loại bỏ các patch bị mây che phủ.
- Lưu trữ siêu dữ liệu ảnh tải về vào bảng `gis_schema.satellite_scenes`.

### Story 2.2: Topographic Slope (SRTM DEM) & Vegetation Index ($\Delta\text{NDVI}$) Engine
**[Phụ trách chính: Tú (GIS Pipeline)]**  
As a GIS Data Engineer,  
I want a processor that computes NDVI difference ($\Delta\text{NDVI} = \text{NDVI}_{\text{post}} - \text{NDVI}_{\text{pre}}$) and extracts topographic slope degrees from SRTM 30m DEM,  
So that sudden loss of vegetation on steep slopes is quantitatively measured.  
**Acceptance Criteria:**
- Tính toán bản đồ biến động thực vật $\Delta\text{NDVI}$ giữa ảnh trước và sau thiên tai bằng `rasterio`.
- Trích xuất độ dốc địa hình theo độ $[0^\circ, 90^\circ]$ từ ảnh số độ cao SRTM DEM 30m.
- Đồng bộ hệ quy chiếu tọa độ chuẩn WGS84 EPSG:4326.

### Story 2.3: Adaptive Tiling Engine & Bounding Box Patch Generator
**[Phụ trách chính: Tú (GIS Pipeline) | Phối hợp: Duẫn (AI)]**  
As an AI Engineer,  
I want the GIS service to slice large satellite scenes into uniform $128 \times 128$ pixel patches with bounding box coordinates,  
So that patches match the input dimensions required by deep learning segmentation networks.  
**Acceptance Criteria:**
- Endpoint `/api/v1/gis/tiling` nhận Bounding Box của AOI và trả về danh sách tọa độ các patch $128 \times 128$.
- Băm lưới tính đến độ nén kinh độ theo vĩ độ ($111 \times \cos(\text{lat})$).
- Overlapping tile margins đảm bảo vết sạt lở ở mép không bị cắt đứt.

### Story 2.4: Community Field Report API (GPS & Photo Upload)
**[Phụ trách chính: Thuận (Backend) | Phối hợp: Lâm (Mobile)]**  
As a Disaster Officer,  
I want an API endpoint to receive field reports of observed landslide signs (cracks, slope movement, fresh slides) from citizens, containing GPS coordinates and photos,  
So that ground-truth reports supplement satellite observations in the verification process.  
**Acceptance Criteria:**
- Endpoint `POST /api/v1/core/reports` tiếp nhận tọa độ GPS, nội dung mô tả và ảnh hiện trường (role `citizen` trở lên).
- Tạo bản ghi trong `core_schema.community_reports` (trạng thái `submitted`) và bắn sự kiện `COMMUNITY_REPORT_SUBMITTED` lên Redis Event Bus.
- Endpoint `GET /api/v1/core/reports` (role `officer`/`admin`) trả danh sách báo cáo dạng GeoJSON để hiển thị trên WebGIS.

---

## Epic 3: AI Deep Learning, Landslide Segmentation & Risk Scoring (Tuần 3)
Hiện thực hóa mô hình DeepLabV3+ ONNX thật trên tập dữ liệu Landslide4Sense, phân đoạn đa giác sạt lở từ tensor 8 kênh và tự động xếp hạng mức độ nguy cơ (FR2.3).

### Story 3.1: Pretrained DeepLabV3+ ONNX Model Loading (Landslide4Sense Benchmark)
**[Phụ trách chính: Duẫn (AI / CV)]**  
As an AI Engineer,  
I want `ai-service` to load a pretrained DeepLabV3+ ONNX model and preprocess raw input into an 8-channel normalized float tensor,  
So that inference executes efficiently on CPU with GPU fallback.  
**Acceptance Criteria:**
- Nạp trọng số mô hình (`models/landslide_deeplabv3plus.onnx`) khi khởi động service bằng ONNX Runtime.
- Chuẩn hóa tensor đầu vào kích thước `[1, 8, 128, 128]` theo mean/std của bộ dữ liệu Landslide4Sense.
- Kiểm thử cold-start đảm bảo mô hình chạy suy luận tensor trong thời gian $< 300\text{ ms}$.

### Story 3.2: 8-Channel Multi-Spectral Inference & Binary Mask Segmentation
**[Phụ trách chính: Duẫn (AI / CV)]**  
As an AI Engineer,  
I want the AI engine to predict pixel-level landslide probabilities from the 8-channel tensor `[B2, B3, B4, B8, B11, B12, NDVI, SLOPE]`,  
So that scars of slipped earth are accurately segmented.  
**Acceptance Criteria:**
- Hàm kích hoạt Sigmoid xuất ra ma trận xác suất $[0.0, 1.0]$ cho từng pixel.
- Ngưỡng hóa ($\ge 0.5$) tạo ra mặt nạ nhị phân (Binary Mask) phân biệt đất sạt lở với nền.
- Đánh giá trên tập test đạt $F_1 \ge 0.70$ và $\text{IoU} \ge 0.60$.

### Story 3.3: Polygonization: Converting Raster Mask to PostGIS MultiPolygon GeoJSON
**[Phụ trách chính: Tú (GIS) & Duẫn (AI)]**  
As a GIS Developer,  
I want the AI service to convert binary raster masks into smooth vector polygons (GeoJSON MultiPolygon) with coordinate georeferencing,  
So that detected landslide bodies can be rendered on WebGIS and stored in PostGIS.  
**Acceptance Criteria:**
- Vector hóa từ raster sang đa giác hình học bằng `rasterio.features.shapes` và `shapely`.
- Tọa độ đa giác được ánh xạ chính xác về tọa độ địa lý WGS84 thực tế.
- Tự động lọc bỏ các đốm nhiễu có diện tích quá nhỏ ($< 100\text{ m}^2$).

### Story 3.4: Landslide Risk Level Scoring (Slope & Residential Proximity)
**[Phụ trách chính: Duẫn (AI) | Phối hợp: Tú (GIS)]**  
As a Disaster Officer,  
I want every detected landslide polygon to be automatically ranked by risk level,  
So that I can prioritize verifying and warning the most dangerous zones first.  
**Acceptance Criteria:**
- Tính điểm nguy cơ dựa trên: độ dốc trung bình (Slope), diện tích vùng sạt lở, độ tin cậy của mô hình và **khoảng cách tới khu dân cư gần nhất** (PostGIS `ST_Distance` với lớp dân cư/OSM buildings).
- Ánh xạ điểm số sang `risk_level`: `low`, `medium`, `high`, `extreme` (ngưỡng cấu hình được).
- Kết quả trả về trong JSON suy luận và lưu vào `core_schema.landslide_events.risk_level`.

---

## Epic 4: Event-Driven Processing, WebGIS Command Center & Emergency Alerts (Tuần 4)
Kết nối Redis Pub/Sub, Resilience4j Circuit Breaker và giao diện WebGIS Command Center: Bản đồ địa hình 3D vùng nguy cơ, hàng đợi thẩm định và **nút phát cảnh báo khẩn cấp của Admin (SMS + Push App)**.

### Story 4.1: Redis Pub/Sub Event Bus & Resilience4j Circuit Breaker
**[Phụ trách chính: Thuận (Backend)]**  
As a Backend Engineer,  
I want bidirectional asynchronous communication via Redis channel `terrawatch:events` and Circuit Breaker isolation for AI/GIS calls,  
So that the Core API never crashes when dependent Python services are overloaded.  
**Acceptance Criteria:**
- Các sự kiện `LANDSLIDE_DETECTED`, `LANDSLIDE_VERIFIED`, `COMMUNITY_REPORT_SUBMITTED` và `EMERGENCY_ALERT_BROADCAST` được publish và consume ổn định.
- Resilience4j Circuit Breaker tự động chuyển sang `OPEN` khi tỷ lệ lỗi $\ge 50\%$, kích hoạt Fallback lưu vào hàng đợi ngầm mà không gây sập Core API.

### Story 4.2: WebGIS Verification Queue & One-Click Landslide Approval
**[Phụ trách chính: Huy (Frontend WebGIS) | Phối hợp: Thuận (Backend)]**  
As a Disaster Officer,  
I want a dashboard listing pending AI landslide detections with risk level, confidence scores and one-click verification,  
So that verified hazards are published on the map and ready for warning dissemination.  
**Acceptance Criteria:**
- Dashboard hiển thị danh sách các sự kiện sạt lở chờ duyệt (`pending`), kèm diện tích (ha), độ dốc, mức nguy cơ và độ tin cậy.
- Nút "Phê Duyệt" gọi `POST /api/v1/core/landslides/{id}/verify`, chuyển trạng thái sang `verified`; nút "Bác Bỏ" chuyển sang `rejected` / `false_alarm`.
- Sau khi duyệt sự cố mức `high`/`extreme`, hệ thống gợi ý Admin phát cảnh báo khẩn cấp (mở sẵn form của Story 4.4 với vùng ảnh hưởng điền trước).

### Story 4.3: 3D Terrain Hazard Map & Before/After Time-Slider
**[Phụ trách chính: Huy (Frontend WebGIS)]**  
As a Disaster Officer,  
I want an interactive 3D map showing mountain terrain, landslide hazard polygons colored by risk level, community field reports and a before/after satellite comparison slider,  
So that I can accurately assess each detected landslide before approving warnings.  
**Acceptance Criteria:**
- Bản đồ Mapbox GL bật lớp 3D Terrain hiển thị địa hình núi đồi Yên Bái, Lào Cai chân thực.
- Hiển thị các lớp không gian:
  - 🔴 Vùng sạt lở (Danger Zone) tô màu theo `risk_level`.
  - 📍 Báo cáo hiện trường của người dân (`community_reports`).
  - 🟦 Ranh giới vùng giám sát (AOI).
- Thanh trượt so sánh ảnh vệ tinh trước/sau biến động (Time-slider swipe).
- Điều khiển camera 3D: Xoay 360 độ, nghiêng góc nhìn (pitch), phóng to chi tiết điểm sạt lở.

### Story 4.4: Admin Emergency Alert Broadcast (SMS & App Push Notification)
**[Phụ trách chính: Thuận (Backend) & Huy (WebGIS) | Phối hợp: Lâm (Mobile)]**  
As an Admin,  
I want a prominent "🚨 Phát Cảnh Báo Khẩn Cấp" button on the WebGIS dashboard to send an emergency landslide warning to citizens via SMS and mobile app push notification,  
So that residents in the affected area are warned to evacuate immediately.  
**Acceptance Criteria:**
- **Phân quyền:** Nút chỉ hiển thị với role `admin`; API `POST /api/v1/core/alerts/broadcast` được bảo vệ bằng `hasRole('ADMIN')` (role khác nhận HTTP 403).
- **Form phát cảnh báo:**
  - Phạm vi nhận: theo một sự cố sạt lở đã `verified` (vùng đệm bán kính cấu hình, mặc định 2 km), theo một/nhiều vùng giám sát (AOI), hoặc toàn bộ người dùng.
  - Mức độ: `high` / `extreme`; nội dung tin nhắn (SMS giới hạn 160 ký tự, có mẫu soạn sẵn).
  - Kênh gửi: ☑ SMS ☑ Thông báo App (FCM) — chọn một hoặc cả hai.
  - Hộp thoại xác nhận 2 bước hiển thị số người nhận dự kiến trước khi gửi (chống bấm nhầm).
- **Xử lý gửi:**
  - Tạo bản ghi `core_schema.alert_broadcasts` và publish `EMERGENCY_ALERT_BROADCAST` lên Redis; worker gửi bất đồng bộ theo lô, có retry.
  - Push App: gửi qua Firebase Cloud Messaging (FCM) tới `device_tokens` của người nhận.
  - SMS: gửi qua SMS Gateway (eSMS.vn / SpeedSMS / Twilio — cấu hình qua `.env`) tới `phone_number` của người nhận.
  - Người nhận được xác định theo **vùng quan tâm đã đăng ký** (`alert_subscriptions`, UC07) — không dùng vị trí GPS thời gian thực của người dân (tuân thủ NFR5).
- **Theo dõi:** Kết quả từng người nhận lưu vào `core_schema.alert_deliveries` (`sent` / `failed`); dashboard hiển thị thống kê đã gửi / thất bại và lịch sử các lần phát cảnh báo.
- Mọi lần phát cảnh báo được ghi vết kiểm toán (Audit Trail): ai gửi, lúc nào, phạm vi, nội dung.

---

## Epic 5: Citizen Mobile App, Offline Geofencing & End-to-End Demo (Tuần 5)
Hoàn thiện ứng dụng di động Flutter: đăng ký nhận cảnh báo & nhận thông báo khẩn cấp, gửi báo cáo hiện trường, còi hú Geofencing ngoại tuyến khi mất sóng và kịch bản demo thông luồng 100%.

### Story 5.1: Citizen Alert Subscription & Emergency Alert Reception (Push + SMS)
**[Phụ trách chính: Lâm (Mobile App) | Phối hợp: Thuận (Backend)]**  
As a Citizen,  
I want to register my phone number and areas of interest in the app and receive emergency landslide alerts,  
So that I am warned immediately when the authorities issue an evacuation warning for my area.  
**Acceptance Criteria:**
- Màn hình đăng ký nhận cảnh báo: nhập/xác nhận số điện thoại, chọn vùng quan tâm (xã/huyện hoặc AOI) $\rightarrow$ `POST /api/v1/core/alerts/subscriptions` (UC07).
- App tự động đăng ký FCM token khi đăng nhập $\rightarrow$ `POST /api/v1/core/devices/register`.
- Khi nhận Push loại `EMERGENCY_ALERT`: hiển thị màn hình cảnh báo đỏ toàn màn hình, rung và phát âm thanh báo động kể cả khi app chạy nền; hiển thị nội dung, khu vực và hướng dẫn sơ tán.
- Danh sách lịch sử các cảnh báo đã nhận trong app.
- Người dân không cài app hoặc mất dữ liệu di động vẫn nhận được cảnh báo qua SMS.

### Story 5.2: Mobile Community Field Report (Photo & GPS)
**[Phụ trách chính: Lâm (Mobile App) | Phối hợp: Thuận (Backend)]**  
As a Citizen,  
I want to report observed landslide signs with a photo and my GPS location,  
So that officers receive ground-truth evidence to verify landslide hazards.  
**Acceptance Criteria:**
- Màn hình "Báo cáo hiện trường": tự động lấy tọa độ GPS, chụp/chọn ảnh, nhập mô tả ngắn.
- Gửi lên `POST /api/v1/core/reports`; nếu mất mạng thì lưu hàng đợi cục bộ và tự gửi lại khi có kết nối.
- Màn hình xác nhận hiển thị mã báo cáo và trạng thái xử lý (`submitted` / `processed`).

### Story 5.3: Offline Geofencing Hazard Alert & Loud Siren (Ray-Casting & SQLite)
**[Phụ trách chính: Lâm (Mobile App)]**  
As a Mountain Traveler or Citizen moving through mountainous areas with zero cell reception,  
I want my phone to detect nearby landslide hazard zones locally and sound a loud emergency siren,  
So that I am warned to evacuate before entering an active slide zone.  
**Acceptance Criteria:**
- CSDL SQLite cục bộ trên điện thoại lưu trữ sẵn danh sách đa giác các vùng có nguy cơ sạt lở ($\ge 10,000$ đa giác).
- Background location tracker chạy ngầm, tính khoảng cách Haversine và thuật toán Ray-Casting mỗi 10 giây; vị trí GPS chỉ xử lý cục bộ, không gửi lên máy chủ (NFR5).
- Bước chân vào vùng đa giác sạt lở: Lập tức chớp màn hình đỏ, rung và phát còi hú âm lượng tối đa ngay cả khi máy để chế độ im lặng.

### Story 5.4: End-to-End System Integration Flow & 5-Week Milestone Demo
**[Phụ trách: Toàn bộ 5 thành viên (Duẫn, Tú, Thuận, Huy, Lâm)]**  
As the Project Team,  
I want to demonstrate a complete, flawless end-to-end early-warning flow across all components,  
So that the 5-week MVP milestone is 100% achieved and ready for faculty review.  
**Acceptance Criteria:**
- Kịch bản demo thông suốt từ đầu đến cuối:
  1. Tú & Duẫn: Vệ tinh Sentinel-2 nạp vào $\rightarrow$ AI DeepLabV3+ quét ra đa giác sạt lở $\rightarrow$ xếp hạng mức nguy cơ.
  2. Thuận: Core API ghi nhận sự cố, bắn Redis Event Bus.
  3. Huy: WebGIS 3D hiển thị vết sạt lở, cán bộ đối chiếu ảnh trước/sau và ấn duyệt.
  4. Admin bấm "🚨 Phát Cảnh Báo Khẩn Cấp" $\rightarrow$ người dân trong vùng nhận SMS và thông báo App.
  5. Lâm: Mobile App hiển thị cảnh báo khẩn cấp; đồng thời mô phỏng người dân mất mạng bước vào vùng nguy cơ, còi hú báo động ngay lập tức.
  6. 0 lỗi crash trên toàn bộ 7 services Docker.

---

# GIAI ĐOẠN 2: CAPSTONE UPGRADES & THESIS DEFENSE (HƯỚNG PHÁT TRIỂN)

## Epic 6: Nâng Cao Độ Chính Xác Cảnh Báo Sớm (Hướng phát triển)
- **Story 6.1:** Trạm IoT ESP32 quan trắc sườn dốc (cảm biến rung & độ ẩm đất, đẩy dữ liệu qua MQTT).
- **Story 6.2:** Tích hợp ảnh Radar SAR Sentinel-1 quan sát xuyên mây trong mùa mưa bão.
- **Story 6.3:** Tích hợp chỉ số mưa tích lũy Antecedent Rainfall Index (ARI) từ dữ liệu GPM NASA.

## Epic 7: Tối Ưu Hiệu Năng & Kiểm Toán
- **Story 7.1:** PostGIS spatial partitioning theo tỉnh & tile caching.
- **Story 7.2:** Audit Trail toàn diện cho thẩm định và phát cảnh báo (Event Sourcing).

## Epic 8: Thử Nghiệm Thực Địa & Bảo Vệ Đồ Án
- **Story 8.1:** Mô phỏng & thử nghiệm cảnh báo thực tế tại Lào Cai / Yên Bái.
- **Story 8.2:** Hoàn thiện tài liệu đồ án, video demo và slide thuyết trình.
