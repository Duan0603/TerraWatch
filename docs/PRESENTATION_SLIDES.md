# BỘ SLIDE THUYẾT TRÌNH ĐỒ ÁN TỐT NGHIỆP KỸ SƯ PHẦN MỀM
## Đề tài: GEOSENTRY (TERRAWATCH) — HỆ THỐNG VIỄN THÁM, AI & MÔ HÌNH 3D CẢNH BÁO & HỖ TRỢ CỨU HỘ SẠT LỞ ĐẤT
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
* **Tiêu đề phụ:** Hệ Thống Phần Mềm, Trí Tuệ Nhân Tạo & Mô Hình 3D Cảnh Báo Sớm và Hỗ Trợ Điều Phối Cứu Hộ Sạt Lở Đất Miền Núi
* **Chuyên ngành:** Kỹ thuật Phần mềm (Software Engineering Capstone Project)
* **Đội ngũ thực hiện:** Duẫn, Tú, Thuận, Huy, Lâm

---

### SLIDE 2: TÍNH CẤP THIẾT & ĐẶT VẤN ĐỀ (PROBLEM STATEMENT)
* **Thực trạng đau xót:** Miền núi phía Bắc (Lào Cai, Yên Bái, Hà Giang) chịu thiệt hại nặng nề sau các đợt mưa bão kéo dài (điển hình: vụ sạt lở Làng Nủ - Lào Cai sau bão Yagi 2024).
* **4 Điểm nghẽn lớn trong cứu hộ hiện nay:**
  1. *Phát hiện chậm trễ:* Chỉ biết khi thảm họa đã xảy ra hoặc có người sống sót chạy về báo.
  2. *Mất liên lạc hoàn toàn:* Mưa bão quật đổ cột sóng viễn thông, người dân và đội cứu hộ mất sạch 4G/Internet.
  3. *Thiếu thông tin địa hình:* Bản đồ 2D phẳng không thể hiện được độ dốc, vách núi đứng, và các điểm sạt lở thứ cấp.
  4. *Đội cứu hộ gặp nguy hiểm:* Xe cứu nạn di chuyển vào các cung đường đèo đã bị sụt lún taluy âm mà không hề hay biết.

---

### SLIDE 3: GIẢI PHÁP ĐỀ XUẤT: HỆ SINH THÁI GEOSENTRY
* **Mô hình tiếp cận 4 tầng toàn diện:**
  1. **Tầng Vĩ mô (Vệ tinh Sentinel-2 & DEM 30m):** Quét diện rộng không cần đặt thiết bị tại hiện trường, tự động lọc mây và tính chỉ số suy giảm thảm phủ $\Delta\text{NDVI}$.
  2. **Tầng Phân tích AI (DeepLabV3+ ONNX):** Phân đoạn vết trượt sạt lở và tính toán tuyến đường cứu hộ an toàn (Rescue Route).
  3. **Tầng Trực quan hóa 3D (WebGIS 3D Command Center):** Mô phỏng sườn núi 3D thể hiện 4 lớp: 🔴 Danger Zone, 🟢 Victim, ⚠ Hazard, 🚒 Rescue Route.
  4. **Tầng Hiện trường Ngoại tuyến (Mobile Offline Geofencing):** Rung chuông còi hú cứu người dân ngay cả khi mất sóng điện thoại; Nút SOS 1-chạm gửi GPS.

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
* **Thuật toán AI Gợi ý Tuyến đường Cứu hộ (Rescue Route Engine):**
  - Thuật toán A* trên đồ thị OpenStreetMap, tự động tránh cung đường cắt qua 🔴 Danger Zone.

---

### SLIDE 7: PHÂN HỆ BACKEND, SECURITY & ĐIỀU PHỐI (THUẬN PHỤ TRÁCH)
* **Core API Spring Boot 3 vững chắc:**
  - Bảo mật Spring Security 6 & JWT, hỗ trợ phân quyền 4 nhóm đối tượng: `citizen`, `rescue_team`, `officer`, `admin`.
  - Thiết kế CSDL không gian Schema-per-Service trên PostgreSQL 15 + PostGIS 3.3.
* **Độ bền vững & Chịu lỗi cao (Resilience):**
  - Cơ chế Circuit Breaker với Resilience4j: Tự động ngắt mạch khi AI/GIS service quá tải và kích hoạt Fallback lưu hàng đợi ngầm.
* **Luồng xử lý hướng sự kiện (Event-Driven):**
  - Redis Pub/Sub đồng bộ bất đồng bộ tức thời giữa Spring Boot và FastAPI.
  - Tích hợp thông báo khẩn cấp Firebase Cloud Messaging (FCM) và ghi vết kiểm toán (Audit Trail) bất biến.

---

### SLIDE 8: PHÂN HỆ WEBGIS COMMAND CENTER & MÔ HÌNH 3D (HUY PHỤ TRÁCH)
* **Trung tâm chỉ huy trực quan trên nền Web:**
  - Xây dựng bằng React 18 / Next.js + Tailwind CSS.
  - Bản đồ địa hình số 3D (Mapbox GL 3D Terrain) hiển thị chi tiết độ dốc núi rừng Tây Bắc.
* **Tính năng chuyên sâu phục vụ cán bộ:**
  - Thanh trượt so sánh ảnh viễn thám đa thời gian (Time-slider swipe) đối soát trực quan thảm thực vật trước và sau sạt lở.
  - Hàng đợi thẩm định sạt lở bán tự động (One-click Approval).
  - **Mô hình 3D Hiện trường Cứu hộ:** Thể hiện trực quan 🔴 Danger Zone, 🟢 Victim, ⚠ Hazard, 🚒 Rescue Route.

---

### SLIDE 9: PHÂN HỆ MOBILE CITIZEN APP & GEOFENCING NGOẠI TUYẾN (LÂM PHỤ TRÁCH)
* **Ứng dụng di động Flutter 3.x đa nền tảng:**
  - Giao diện thân thiện cho đồng bào miền núi và lực lượng cứu hộ.
* **Cơ chế Geofencing Ngoại tuyến đột phá (Offline-First):**
  - Lưu sẵn $\ge 10,000$ đa giác vùng sạt lở vào CSDL SQLite nội bộ trên máy.
  - Chạy ngầm dịch vụ GPS nền (Background Geolocation), liên tục tính khoảng cách Haversine và thuật toán Ray-Casting.
  - **Rung chuông còi hú báo động âm lượng tối đa** ngay khi bước vào vùng nguy cơ kể cả khi mất sạch sóng 4G/WiFi.
* **Nút bấm SOS khẩn cấp 1-chạm:** Tự động lấy tọa độ GPS chính xác và chụp ảnh hiện trường gửi về sở chỉ huy.

---

### SLIDE 10: KẾ HOẠCH TRIỂN KHAI, DEMO THỰC ĐỊA & KẾT LUẬN
* **Tiến độ 5 tuần tăng tốc MVP:**
  - Tuần 1: Dựng nền tảng, CSDL PostGIS và Auth JWT.
  - Tuần 2: Ingestion Sentinel-2, DEM Slope và API nhận SOS.
  - Tuần 3: Tích hợp mô hình ONNX thật, cắt ảnh Tiling và AI Rescue Route.
  - Tuần 4: Dashboard WebGIS 3D Command Center và Mobile SOS.
  - Tuần 5: Thông luồng 100%, kiểm thử chịu tải và demo kịch bản thực tế Làng Nủ - Lào Cai.
* **Giai đoạn nâng cấp Capstone (Tháng 3 - Tháng 6):**
  - Trạm IoT ESP32 quan trắc rung chấn sườn dốc đẩy MQTT.
  - Tích hợp ảnh Radar SAR Sentinel-1 xuyên mây mùa mưa bão.
* **Kết luận:** GeoSentry là giải pháp công nghệ toàn diện, mang tính nhân văn sâu sắc và sẵn sàng ứng dụng thực tế bảo vệ sinh mạng nhân dân trước thiên tai sạt lở đất.
