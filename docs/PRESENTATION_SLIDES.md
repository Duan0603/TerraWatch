# BỘ SLIDE THUYẾT TRÌNH ĐỒ ÁN TỐT NGHIỆP KỸ SƯ PHẦN MỀM
## Đề tài: GEOSENTRY (TERRAWATCH) — HỆ THỐNG VIỄN THÁM & AI CẢNH BÁO SỚM SẠT LỞ ĐẤT
**File PowerPoint đã xuất sẵn:** [`docs/GeoSentry_Capstone_Presentation.pptx`](file:///d:/SECapstone/docs/GeoSentry_Capstone_Presentation.pptx)  
**Nhóm sinh viên thực hiện:**
- **Thành viên 1:** Duẫn — AI / Computer Vision Engineer
- **Thành viên 2:** Tú — GIS Pipeline & Data Engineer
- **Thành viên 3:** Thuận — Backend Engineer & System Architect
- **Thành viên 4:** Huy — Frontend WebGIS Engineer
- **Thành viên 5:** Lâm — Mobile App Engineer

---

### SLIDE 1: TRANG TIÊU ĐỀ (TITLE SLIDE)
* **Tiêu đề chính:** GEOSENTRY (TERRAWATCH)
* **Tiêu đề phụ:** Hệ Thống Viễn Thám & Trí Tuệ Nhân Tạo Cảnh Báo Sớm Sạt Lở Đất Miền Núi
* **Chuyên ngành:** Kỹ thuật Phần mềm (Software Engineering Capstone Project)
* **Đội ngũ thực hiện:** Duẫn, Tú, Thuận, Huy, Lâm

---

### SLIDE 2: TÍNH CẤP THIẾT & ĐẶT VẤN ĐỀ (PROBLEM STATEMENT)
* **Thực trạng đau xót:** Miền núi phía Bắc (Lào Cai, Yên Bái, Hà Giang) chịu thiệt hại nặng nề sau các đợt mưa bão kéo dài (điển hình: vụ sạt lở Làng Nủ - Lào Cai sau bão Yagi 2024).
* **4 Điểm nghẽn lớn trong công tác cảnh báo hiện nay:**
  1. *Phát hiện chậm trễ:* Chỉ biết khi thảm họa đã xảy ra hoặc có người dân chạy về báo; không có phương tiện giám sát diện rộng tự động.
  2. *Mất liên lạc khi có bão:* Mưa bão quật đổ cột viễn thông, người dân mất sóng 4G/Internet, không nhận được thông báo qua các kênh thông thường.
  3. *Thiếu trực quan địa hình:* Cán bộ quản lý thiếu công cụ 3D và so sánh ảnh viễn thám trước/sau để xác minh nhanh điểm có nguy cơ sạt lở.
  4. *Cảnh báo chưa kịp thời:* Thiếu công cụ cho người có thẩm quyền chủ động phát cảnh báo khẩn cấp đồng thời qua SMS và App tới người dân trong vùng ảnh hưởng.

---

### SLIDE 3: GIẢI PHÁP ĐỀ XUẤT: HỆ SINH THÁI GEOSENTRY
* **Mô hình tiếp cận 4 tầng toàn diện (100% chuyên sâu cảnh báo sạt lở):**
  1. **Tầng Vĩ mô (Vệ tinh Sentinel-2 & DEM 30m):** Quét diện rộng không cần đặt thiết bị tại hiện trường, tự động lọc mây và tính chỉ số suy giảm thảm phủ $\Delta\text{NDVI}$ và độ dốc sườn núi.
  2. **Tầng Phân tích AI & Xếp hạng Nguy cơ (DeepLabV3+ ONNX):** Phân đoạn vết trượt sạt lở và tự động xếp hạng mức độ nguy cơ dựa trên độ dốc và khoảng cách tới khu dân cư.
  3. **Tầng Trung tâm Điều hành WebGIS (Command Center):** Bản đồ 3D Terrain, thanh trượt so sánh ảnh trước/sau, hàng đợi duyệt sạt lở 1-click và **nút phát cảnh báo khẩn cấp cho Admin**.
  4. **Tầng Hiện trường Ngoại tuyến (Mobile Offline Geofencing):** Rung chuông còi hú âm lượng tối đa cứu người dân khi vào vùng nguy cơ ngay cả khi mất sóng 4G/Internet; hỗ trợ gửi báo cáo hiện trường.

---

### SLIDE 4: KIẾN TRÚC HỆ THỐNG: CHUẨN 8 THÀNH PHẦN MICROSERVICES
* **1. Client đa nền tảng:** WebGIS React 18 + Mobile Flutter 3.x.
* **2. API Gateway duy nhất:** Nginx Reverse Proxy (Port 8080) — Rate Limiting 50 req/s, Global CORS.
* **3. Service Discovery & Networking:** Docker Container Internal DNS (`terrawatch-net`).
* **4. Microservices độc lập:**
  - `core-api` (Java 17 + Spring Boot 3)
  - `ai-service` (Python 3.11 + FastAPI + ONNX Runtime)
  - `gis-service` (Python 3.11 + FastAPI + GDAL/Rasterio)
* **5. Database per Service:** PostgreSQL 15 + PostGIS 3.3 (`core_schema`, `gis_schema`).
* **6. Message Broker & Event Bus:** Redis 7 Pub/Sub (`terrawatch:events`).
* **7. Configuration Management:** Twelve-Factor App (`.env`).
* **8. Fault Tolerance & Resilience:** Resilience4j Circuit Breaker chống sập lan truyền.
* **Kênh phát cảnh báo tích hợp:** Firebase Cloud Messaging (FCM Push) + SMS Gateway.

---

### SLIDE 5: PHÂN HỆ GIS PIPELINE & DỮ LIỆU VIỄN THÁM (TÚ PHỤ TRÁCH)
* **Tự động hóa chuỗi thu thập dữ liệu:**
  - Kết nối trực tiếp Copernicus API / Sentinel Hub API tải ảnh đa phổ Sentinel-2 L2A.
  - Thuật toán lọc mây thông minh Scene Classification Layer (SCL / s2cloudless).
* **Xử lý số liệu địa không gian:**
  - Tính toán chỉ số thực vật chuẩn hóa $\Delta\text{NDVI} = \text{NDVI}_{\text{post}} - \text{NDVI}_{\text{pre}}$.
  - Trích xuất độ dốc sườn đồi từ ảnh số độ cao SRTM DEM 30m.
  - Module Tiling băm ảnh thành các patch $128 \times 128$ chuyển giao cho AI.
  - Thuật toán Raster-to-Vector (Polygonization) chuyển mặt nạ AI thành đa giác WGS84 PostGIS.

---

### SLIDE 6: PHÂN HỆ TRÍ TUỆ NHÂN TẠO & DEEP LEARNING (DUẪN PHỤ TRÁCH)
* **Mô hình Semantic Segmentation phát hiện vết sạt lở:**
  - Kiến trúc: DeepLabV3+ với Backbone ResNet-50 / EfficientNet và Atrous Spatial Pyramid Pooling (ASPP).
  - Tensor đầu vào 8 kênh: `[B02, B03, B04, B08, B11, B12, NDVI, SLOPE]`.
  - Bộ dữ liệu chuẩn quốc tế: **Landslide4Sense Benchmark** ($> 3,799$ mẫu).
  - Độ chính xác vượt trội: $F_1 = 0.768$, $\text{IoU} = 0.642$.
* **Đóng gói suy luận hiệu năng cao:**
  - Tối ưu hóa qua ONNX Runtime, tốc độ suy luận $< 300\text{ ms}$/patch trên CPU.
* **Thuật toán Xếp hạng Mức độ Nguy cơ (Risk Scoring):**
  - Tự động đánh giá theo độ dốc trung bình, diện tích, độ tin cậy và khoảng cách đến khu dân cư gần nhất (`low`, `medium`, `high`, `extreme`).

---

### SLIDE 7: PHÂN HỆ BACKEND, SECURITY & PHÁT CẢNH BÁO (THUẬN PHỤ TRÁCH)
* **Core API Spring Boot 3 vững chắc:**
  - Bảo mật Spring Security 6 & JWT, hỗ trợ phân quyền 3 vai trò: `citizen`, `officer`, `admin`.
  - Thiết kế CSDL không gian Schema-per-Service trên PostgreSQL 15 + PostGIS 3.3.
* **Độ bền vững & Chịu lỗi cao (Resilience):**
  - Cơ chế Circuit Breaker với Resilience4j: Tự động ngắt mạch khi AI/GIS service quá tải và kích hoạt Fallback lưu hàng đợi ngầm.
* **Luồng xử lý hướng sự kiện & Kênh phát cảnh báo:**
  - Redis Pub/Sub đồng bộ bất đồng bộ tức thời giữa Spring Boot và FastAPI.
  - **Hạ tầng phát cảnh báo khẩn cấp:** Tích hợp Firebase Cloud Messaging (FCM Push) và SMS Gateway gửi tin nhắn trực tiếp về SĐT người dân.
  - Ghi vết kiểm toán (Audit Trail) bất biến cho mọi lần phê duyệt và phát cảnh báo.

---

### SLIDE 8: PHÂN HỆ WEBGIS COMMAND CENTER & CẢNH BÁO KHẨN CẤP (HUY PHỤ TRÁCH)
* **Trung tâm điều hành trực quan trên nền Web:**
  - Xây dựng bằng React 18 + Vite.
  - Bản đồ địa hình số 3D (Mapbox GL 3D Terrain) hiển thị chi tiết độ dốc núi rừng Tây Bắc.
* **Tính năng chuyên sâu phục vụ cán bộ:**
  - Thanh trượt so sánh ảnh viễn thám đa thời gian (Time-slider swipe) đối soát trực quan trước và sau sạt lở.
  - Hàng đợi thẩm định sạt lở 1-click (One-click Approval).
  - Bản đồ vùng nguy cơ 3D tô màu theo cấp độ rủi ro và các điểm báo cáo hiện trường của người dân.
* **Nút "🚨 Phát Cảnh Báo Khẩn Cấp" dành riêng cho Admin:**
  - Chọn phạm vi vùng nguy hiểm, lựa chọn kênh gửi (SMS / App Push / cả hai), xem trước số người nhận và xác nhận 2 bước an toàn.

---

### SLIDE 9: PHÂN HỆ MOBILE CITIZEN APP & GEOFENCING NGOẠI TUYẾN (LÂM PHỤ TRÁCH)
* **Ứng dụng di động Flutter 3.x đa nền tảng:**
  - Giao diện thân thiện cho đồng bào miền núi.
* **Cơ chế Geofencing Ngoại tuyến đột phá (Offline-First):**
  - Lưu sẵn $\ge 10,000$ đa giác vùng sạt lở vào CSDL SQLite nội bộ trên máy.
  - Chạy ngầm dịch vụ GPS nền (Background Geolocation), liên tục tính khoảng cách Haversine và thuật toán Ray-Casting cục bộ (bảo mật tuyệt đối, NFR5).
  - **Rung chuông còi hú báo động âm lượng tối đa** ngay khi bước vào vùng nguy cơ kể cả khi mất sạch sóng 4G/WiFi.
* **Đăng ký nhận cảnh báo & Báo cáo hiện trường:**
  - Nhận thông báo khẩn cấp toàn màn hình qua FCM Push và SMS từ Admin.
  - Gửi hình ảnh và tọa độ GPS phản ánh dấu hiệu sạt trượt đất thực địa (Crowdsourcing).

---

### SLIDE 10: KẾ HOẠCH TRIỂN KHAI, HƯỚNG PHÁT TRIỂN & KẾT LUẬN
* **Tiến độ 5 tuần tăng tốc MVP (100% cảnh báo sạt lở):**
  - Tuần 1: Dựng nền tảng, CSDL PostGIS và Auth JWT 3 roles.
  - Tuần 2: Ingestion Sentinel-2, DEM Slope và API báo cáo hiện trường.
  - Tuần 3: Tích hợp mô hình ONNX thật, cắt ảnh Tiling và thuật toán xếp hạng nguy cơ.
  - Tuần 4: WebGIS thẩm định, Nút Phát Cảnh Báo Khẩn Cấp Admin (SMS/Push) và Mobile FCM.
  - Tuần 5: Thông luồng 100%, kiểm thử chịu tải và demo kịch bản thực tế Làng Nủ - Lào Cai.
* **Hướng phát triển nâng cấp Capstone (Epic 6):**
  - Trạm IoT ESP32 quan trắc rung chấn sườn dốc đẩy MQTT.
  - Tích hợp ảnh Radar SAR Sentinel-1 xuyên mây mùa mưa bão.
  - Tích hợp chỉ số mưa tích lũy Antecedent Rainfall Index (ARI) từ vệ tinh GPM NASA.
* **Kết luận:** GeoSentry là giải pháp công nghệ toàn diện, tập trung giải quyết bài toán cảnh báo sớm sạt lở đất, mang tính nhân văn sâu sắc và sẵn sàng ứng dụng thực tế bảo vệ tính mạng nhân dân.
