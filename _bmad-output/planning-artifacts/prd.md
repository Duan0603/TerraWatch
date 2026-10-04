# Product Requirements Document (PRD)
## Project: GeoSentry (TerraWatch) - Hệ Thống Viễn Thám & AI Cảnh Báo Sớm Sạt Lở Đất

**Version:** 4.0.0 (Thu gọn phạm vi: chỉ cảnh báo sạt lở đất + Nút cảnh báo khẩn cấp cho Admin)  
**Date:** 2026-10-04  
**Target:** Software Engineering Capstone Project (Đồ Án Tốt Nghiệp Kỹ Sư Phần Mềm)  
**Nguồn yêu cầu gốc:** `Tai_Lieu_Yeu_Cau_Va_Thiet_Ke_He_Thong_Canh_Bao_Sat_Lo_Dat.docx`

---

### 0. PHẠM VI SẢN PHẨM (PRODUCT SCOPE)

**Trong phạm vi (In scope):**
- **FR1 — Thu thập & xử lý viễn thám:** Cấu hình AOI, thu thập ảnh Sentinel-2 định kỳ, lọc mây, cắt tile.
- **FR2 — AI nhận diện sạt lở:** Inference DeepLabV3+, vector hóa đa giác, tự động xếp hạng mức nguy cơ (độ dốc, khoảng cách tới khu dân cư).
- **FR3 — Thẩm định & cảnh báo:** Hàng đợi thẩm định, phê duyệt/bác bỏ, phát tán cảnh báo tới người dân.
- **FR4 — Nút cảnh báo khẩn cấp của Admin:** Admin chủ động phát cảnh báo khẩn cấp qua **SMS** và **thông báo App (FCM Push)** tới người dân trong vùng ảnh hưởng.
- **Mobile:** Đăng ký nhận cảnh báo (UC07), Geofencing ngoại tuyến hú còi (UC08), Báo cáo hiện trường (UC09).

**Ngoài phạm vi (Out of scope):** Điều phối đội cứu hộ, tuyến đường cứu hộ, nút SOS kêu cứu, theo dõi cứu nạn thời gian thực, các loại thiên tai khác (lũ lụt, cháy rừng...).

**Vai trò người dùng (RBAC 3 roles):**

| Role | Quyền chính |
| :--- | :--- |
| `admin` | Quản lý người dùng & AOI, **phát cảnh báo khẩn cấp (SMS + Push)**, toàn bộ quyền của `officer` |
| `officer` | Thẩm định điểm sạt lở (duyệt/bác bỏ), xem báo cáo hiện trường, xem bản đồ WebGIS |
| `citizen` | Đăng ký vùng nhận cảnh báo, nhận Push/SMS, gửi báo cáo hiện trường, Geofencing ngoại tuyến |

---

### 1. BẢNG PHÂN CÔNG VAI TRÒ & NHÂN SỰ CHÍNH THỨC (WBS TEAM ROSTER)

| STT | Thành viên | Vai trò chuyên trách | Phân hệ đảm nhiệm | Nhiệm vụ kỹ thuật cốt lõi |
| :---: | :---: | :--- | :--- | :--- |
| **1** | **Duẫn** | **AI / Computer Vision Engineer** | [`services/ai-service/`](file:///d:/SECapstone/services/ai-service) | Xây dựng dataset (Landslide4Sense/Bijie), tiền xử lý dải phổ 8 kênh, huấn luyện & fine-tune mô hình Segmentation (U-Net, ResU-Net, DeepLabV3+), đánh giá chỉ số ($F_1 \ge 0.768$, $\text{IoU} \ge 0.642$), đóng gói mô hình ONNX Runtime và thuật toán xếp hạng mức nguy cơ sạt lở (Risk Scoring). |
| **2** | **Tú** | **GIS Pipeline & Data Engineer** | [`services/gis-service/`](file:///d:/SECapstone/services/gis-service), [`database/`](file:///d:/SECapstone/database) | Xây dựng pipeline tự động crawl ảnh vệ tinh từ GEE / Sentinel Hub API, xử lý mặt nạ lọc mây (Cloud masking QA60/s2cloudless), tính các chỉ số viễn thám ($\Delta\text{NDVI}$, Slope từ DEM SRTM 30m), cắt ghép patch raster $128 \times 128$, chuyển đổi mask sang vector polygon (Raster-to-Vector) và quản trị CSDL PostGIS / Tile server. |
| **3** | **Thuận** | **Backend Engineer & System Architect** | [`services/core-api/`](file:///d:/SECapstone/services/core-api), [`gateway/`](file:///d:/SECapstone/gateway) | Thiết kế kiến trúc Microservices, xây dựng Core API (Spring Boot 3 / Java 17), Redis Pub/Sub Event Bus, bảo mật phân quyền (JWT/RBAC 3 roles), Resilience4j Circuit Breaker, **dịch vụ phát cảnh báo khẩn cấp (FCM Push + SMS Gateway)** và quản trị hạ tầng Docker / Gateway Nginx. |
| **4** | **Huy** | **Frontend WebGIS Engineer** | [`apps/webgis/`](file:///d:/SECapstone/apps/webgis) | Phát triển Web Dashboard bằng React 18, bản đồ Mapbox GL JS 3D Terrain, thanh trượt so sánh ảnh trước/sau (Time-slider swipe), hàng đợi thẩm định (One-click Approval), **nút & form "🚨 Phát Cảnh Báo Khẩn Cấp" cho Admin** và thống kê kết quả gửi cảnh báo. |
| **5** | **Lâm** | **Mobile App Engineer** | [`apps/mobile/`](file:///d:/SECapstone/apps/mobile) | Phát triển ứng dụng Flutter 3.x: đăng ký nhận cảnh báo & nhận thông báo khẩn cấp (FCM), Background Geolocation, SQLite cache polygon nguy cơ ($\ge 10,000$ điểm), Geofencing ngoại tuyến (Ray-Casting & Haversine) hú còi báo động và module báo cáo hiện trường (Crowdsourcing). |

---

### 2. TỔNG QUAN TIẾN ĐỘ 5 TUẦN TỐC LỰC (5-WEEK MVP SPRINT)

- **Tuần 1: Dựng Nền Tảng & Xác Thực (Foundation & Auth Contracts)**
  - Thuận: Auth JWT (Register/Login/Me, 3 roles), PostGIS schema core migration.
  - Tú: Schema GIS, kết nối PostGIS, seed data mẫu Yên Bái/Lào Cai.
  - Duẫn: Setup ONNX runtime, nạp dataset Landslide4Sense, script tiền xử lý 8 kênh.
  - Huy: Khởi tạo module WebGIS React, trang đăng nhập/đăng ký, kết nối Gateway.
  - Lâm: Khởi tạo Flutter app, trang đăng nhập/đăng ký, cấu hình SQLite.
- **Tuần 2: Ingestion & Core Logic**
  - Thuận: API sự cố sạt lở, API báo cáo hiện trường (`/reports`), bọc Resilience4j Circuit Breaker.
  - Tú: Pipeline Sentinel-2 L2A qua Sentinel Hub/Copernicus, lọc mây QA60, tính $\Delta\text{NDVI}$ và DEM Slope.
  - Duẫn: Fine-tune DeepLabV3+, xuất file `landslide_deeplabv3plus.onnx`, benchmark F1/IoU.
  - Huy: Mapbox 3D Terrain, tải và hiển thị danh sách vùng giám sát AOI.
  - Lâm: Background Geolocation, thuật toán Haversine và Ray-Casting.
- **Tuần 3: AI Inference & Tiling Engine**
  - Thuận: Redis Pub/Sub Event Bus 2 chiều kết nối Spring Boot và Python.
  - Tú: Tiling engine cắt ảnh $128 \times 128$, thuật toán Raster-to-Vector (polygonization).
  - Duẫn: Hoàn thiện `/api/v1/ai/inference` ONNX, thuật toán xếp hạng mức nguy cơ (độ dốc + khoảng cách khu dân cư).
  - Huy: Thanh trượt so sánh ảnh trước/sau (Time-slider swipe), hiển thị đa giác sạt lở theo mức nguy cơ.
  - Lâm: CSDL SQLite lưu 10,000 đa giác sạt lở, kích hoạt chuông còi hú khi vào vùng nguy cơ.
- **Tuần 4: Command Center & Cảnh Báo Khẩn Cấp**
  - Thuận: Endpoint duyệt sạt lở (`/verify`), bảng lịch sử kiểm toán `landslide_event_history`, API phát cảnh báo khẩn cấp (`/alerts/broadcast`) tích hợp FCM Push + SMS Gateway.
  - Tú: Tối ưu PostGIS GiST index, phục vụ MVT/Raster Tiles cho WebGIS; truy vấn xác định người nhận theo vùng.
  - Duẫn: Redis event listener tự động chạy batch inference ngầm trong `ai-service`.
  - Huy: Bảng duyệt sự cố cho cán bộ (Approve/Reject), nút & form "🚨 Phát Cảnh Báo Khẩn Cấp" cho Admin.
  - Lâm: Đăng ký nhận cảnh báo (số điện thoại + vùng quan tâm), nhận Push khẩn cấp toàn màn hình, báo cáo hiện trường.
- **Tuần 5: Khép Kín Luồng, Tích Hợp Toàn Diện & Demo 5 Tuần**
  - Cả 5 thành viên phối hợp thông luồng 100%: Sentinel-2 $\rightarrow$ AI $\rightarrow$ Core API $\rightarrow$ WebGIS (duyệt + phát cảnh báo) $\rightarrow$ SMS / Mobile.
  - Đo kiểm hiệu năng, quay video demo hoàn chỉnh.

---

### 3. YÊU CẦU CHI TIẾT: NÚT CẢNH BÁO KHẨN CẤP CỦA ADMIN (FR4)

| Mã | Yêu cầu |
| :--- | :--- |
| FR4.1 | Chỉ role `admin` thấy nút "🚨 Phát Cảnh Báo Khẩn Cấp" trên WebGIS; API trả HTTP 403 với role khác. |
| FR4.2 | Chọn phạm vi nhận: theo sự cố sạt lở đã duyệt (vùng đệm bán kính), theo AOI, hoặc toàn bộ người dùng. |
| FR4.3 | Chọn kênh gửi: SMS, Thông báo App (FCM), hoặc cả hai; nội dung SMS $\le 160$ ký tự, có mẫu soạn sẵn. |
| FR4.4 | Xác nhận 2 bước, hiển thị số người nhận dự kiến trước khi gửi. |
| FR4.5 | Gửi bất đồng bộ theo lô qua Redis worker, có retry; lưu kết quả từng người nhận (`sent`/`failed`). |
| FR4.6 | Người nhận xác định theo vùng quan tâm đã đăng ký (`alert_subscriptions`), **không** dùng vị trí GPS thời gian thực (tuân thủ NFR5). |
| FR4.7 | Ghi vết kiểm toán mọi lần phát cảnh báo; hiển thị lịch sử & thống kê trên dashboard. |
| NFR6 | Cảnh báo Push tới thiết bị trong $\le 30$ giây; SMS được đẩy sang gateway trong $\le 60$ giây kể từ khi Admin xác nhận. |
