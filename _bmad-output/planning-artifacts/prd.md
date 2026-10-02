# Product Requirements Document (PRD)
## Project: GeoSentry (TerraWatch) - Hệ Thống Viễn Thám, AI & Mô Hình 3D Cảnh Báo & Hỗ Trợ Cứu Hộ Sạt Lở Đất

**Version:** 3.1.0 (Phân bổ WBS chi tiết cho 5 Thành viên)  
**Date:** 2026-10-02  
**Target:** Software Engineering Capstone Project (Đồ Án Tốt Nghiệp Kỹ Sư Phần Mềm)  

---

### 1. BẢNG PHÂN CÔNG VAI TRÒ & NHÂN SỰ CHÍNH THỨC (WBS TEAM ROSTER)

| STT | Thành viên | Vai trò chuyên trách | Phân hệ đảm nhiệm | Nhiệm vụ kỹ thuật cốt lõi |
| :---: | :---: | :--- | :--- | :--- |
| **1** | **Duẫn** | **AI / Computer Vision Engineer** | [`services/ai-service/`](file:///d:/SECapstone/services/ai-service) | Xây dựng dataset (Landslide4Sense/Bijie), tiền xử lý dải phổ 8 kênh, huấn luyện & fine-tune mô hình Segmentation (U-Net, ResU-Net, DeepLabV3+), đánh giá chỉ số ($F_1 \ge 0.768$, $\text{IoU} \ge 0.642$), đóng gói mô hình ONNX Runtime và thuật toán AI gợi ý tuyến đường cứu hộ (Rescue Route A*). |
| **2** | **Tú** | **GIS Pipeline & Data Engineer** | [`services/gis-service/`](file:///d:/SECapstone/services/gis-service), [`database/`](file:///d:/SECapstone/database) | Xây dựng pipeline tự động crawl ảnh vệ tinh từ GEE / Sentinel Hub API, xử lý mặt nạ lọc mây (Cloud masking QA60/s2cloudless), tính các chỉ số viễn thám ($\Delta\text{NDVI}$, Slope từ DEM SRTM 30m), cắt ghép patch raster $128 \times 128$, chuyển đổi mask sang vector polygon (Raster-to-Vector) và quản trị CSDL PostGIS / Tile server. |
| **3** | **Thuận** | **Backend Engineer & System Architect** | [`services/core-api/`](file:///d:/SECapstone/services/core-api), [`gateway/`](file:///d:/SECapstone/gateway) | Thiết kế kiến trúc Microservices, xây dựng Core API (Spring Boot 3 / Java 17), quản lý hàng đợi tác vụ nền (Redis Pub/Sub Event Bus), cấu hình bảo mật phân quyền (JWT/RBAC 4 roles), bọc Resilience4j Circuit Breaker, tích hợp Firebase Cloud Messaging (FCM) và quản trị hạ tầng Docker / Gateway Nginx. |
| **4** | **Huy** | **Frontend WebGIS Engineer** | [`apps/webgis/`](file:///d:/SECapstone/apps/webgis) | Phát triển Web Dashboard quản trị bằng React 18 / Next.js, tích hợp bản đồ WebGL (Mapbox GL JS 3D Terrain), thanh trượt so sánh ảnh trước/sau (Time-slider swipe), màn hình duyệt điểm sạt lở cho cán bộ (One-click Approval), mô hình 3D hiện trường (🔴 Danger, 🟢 Victim, ⚠ Hazard, 🚒 Route) và xuất báo cáo thống kê thiên tai. |
| **5** | **Lâm** | **Mobile App Engineer** | [`apps/mobile/`](file:///d:/SECapstone/apps/mobile) | Phát triển ứng dụng di động đa nền tảng bằng Flutter 3.x, lập trình dịch vụ định vị chạy nền (Background Geolocation), lưu trữ bộ nhớ đệm polygon nguy cơ ngoại tuyến bằng SQLite ($\ge 10,000$ điểm), xử lý thuật toán Geofencing không cần mạng (Ray-Casting & Haversine), còi hú báo động khẩn cấp và module SOS gửi ảnh/GPS hiện trường (Crowdsourcing). |

---

### 2. TỔNG QUAN TIẾN ĐỘ 5 TUẦN TỐC LỰC (5-WEEK MVP SPRINT)

- **Tuần 1: Dựng Nền Tảng & Xác Thực (Foundation & Auth Contracts)**
  - Thuận: Auth JWT (Register/Login/Me 4 roles), PostGIS schema core migration.
  - Tú: Schema GIS, kết nối PostGIS, seed data mẫu Yên Bái/Lào Cai.
  - Duẫn: Setup ONNX runtime, nạp dataset Landslide4Sense, script tiền xử lý 8 kênh.
  - Huy: Khởi tạo module WebGIS React, trang đăng nhập/đăng ký, kết nối Gateway.
  - Lâm: Khởi tạo Flutter app, trang đăng nhập/đăng ký, cấu hình SQLite.
- **Tuần 2: Ingestion & Core Logic**
  - Thuận: API sự cố sạt lở, API nhận SOS, bọc Resilience4j Circuit Breaker.
  - Tú: Pipeline Sentinel-2 L2A qua Sentinel Hub/Copernicus, lọc mây QA60, tính $\Delta\text{NDVI}$ và DEM Slope.
  - Duẫn: Fine-tune DeepLabV3+, xuất file `landslide_deeplabv3plus.onnx`, benchmark F1/IoU.
  - Huy: Mapbox 3D Terrain, tải và hiển thị danh sách vùng giám sát AOI.
  - Lâm: Background Geolocation, thuật toán Haversine và Ray-Casting.
- **Tuần 3: AI Inference & Tiling Engine**
  - Thuận: Redis Pub/Sub Event Bus 2 chiều kết nối Spring Boot và Python.
  - Tú: Tiling engine cắt ảnh $128 \times 128$, thuật toán Raster-to-Vector (polygonization).
  - Duẫn: Hoàn thiện `/api/v1/ai/inference` ONNX, thuật toán Rescue Route A* né Danger Zone.
  - Huy: Thanh trượt so sánh ảnh trước/sau (Time-slider swipe), hiển thị đa giác sạt lở.
  - Lâm: CSDL SQLite lưu 10,000 đa giác sạt lở, kích hoạt chuông còi hú khi vào vùng nguy cơ.
- **Tuần 4: Command Center & Cứu Hộ**
  - Thuận: Endpoint duyệt sạt lở (`/verify`), bảng lịch sử kiểm toán `landslide_event_history`, FCM Push.
  - Tú: Tối ưu PostGIS GiST index, phục vụ MVT/Raster Tiles cho WebGIS.
  - Duẫn: Redis event listener tự động chạy batch inference ngầm trong `ai-service`.
  - Huy: Bảng duyệt sự cố cho cán bộ (Approve/Reject), dựng Mô hình 3D Hiện trường sạt lở.
  - Lâm: Nút bấm SOS 1-chạm gửi GPS/ảnh hiện trường, màn hình Live Rescue Tracking.
- **Tuần 5: Khép Kín Luồng, Tích Hợp Toàn Diện & Demo 5 Tuần**
  - Cả 5 thành viên phối hợp thông luồng 100%: Sentinel-2 / SOS $\rightarrow$ AI $\rightarrow$ Core API $\rightarrow$ WebGIS $\rightarrow$ Mobile.
  - Đo kiểm hiệu năng, quay video demo hoàn chỉnh.
