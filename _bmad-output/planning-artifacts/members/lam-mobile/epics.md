# Kế Hoạch Epics & Stories Chi Tiết — Thành Viên 5: LÂM
## Vai trò: Mobile App Engineer
**Phân hệ đảm nhiệm:** `apps/mobile/`  
**Dự án:** GeoSentry (TerraWatch) - Hệ Thống Viễn Thám & AI Cảnh Báo Sớm Sạt Lở Đất  

---

### 1. Mục Tiêu & Trách Nhiệm Kỹ Thuật
- Phát triển ứng dụng di động đa nền tảng (Android & iOS) bằng Flutter 3.x.
- Dựng giao diện Đăng ký / Đăng nhập cho Người dân.
- **Đăng ký nhận cảnh báo** (số điện thoại + vùng quan tâm) và **nhận thông báo khẩn cấp** qua Firebase Cloud Messaging (FCM): màn hình cảnh báo đỏ toàn màn hình, rung, âm thanh báo động.
- Lập trình dịch vụ định vị chạy nền (**Background Geolocation**) — vị trí chỉ xử lý cục bộ trên máy, không gửi lên máy chủ (NFR5).
- Lưu trữ bộ nhớ đệm CSDL không gian ngoại tuyến bằng **SQLite (`sqflite`)** chứa $\ge 10,000$ đa giác điểm sạt lở nguy hiểm.
- Xử lý thuật toán **Geofencing ngoại tuyến** không cần mạng Internet/4G (thuật toán khoảng cách Haversine & thuật toán Point-in-Polygon Ray-Casting).
- Cơ chế kích hoạt **Còi hú báo động âm lượng tối đa & Rung liên tục** (vượt qua chế độ im lặng của máy) khi đi vào vùng sạt lở.
- Module **Báo cáo hiện trường** (Crowdsourcing) gửi ảnh + tọa độ GPS dấu hiệu sạt lở.

---

### 2. Lộ Trình 5 Tuần Tốc Lực Của Lâm

```
Tuần 1: Cấu hình Flutter 3.x, dựng giao diện Đăng ký / Đăng nhập người dân kết nối API Thuận; cài đặt sqflite.
Tuần 2: Lập trình Background Geolocation chạy ngầm; viết thuật toán Haversine và Ray-Casting kiểm tra tọa độ.
Tuần 3: Hoàn thiện nạp 10,000 đa giác vào SQLite; lập trình còi hú báo động & rung khi GPS lọt vào vùng nguy cơ.
Tuần 4: Tích hợp FCM + màn hình đăng ký nhận cảnh báo & cảnh báo khẩn cấp toàn màn hình; màn hình báo cáo hiện trường.
Tuần 5: Thử nghiệm thực địa: Tắt sạch mạng 4G/WiFi, giả lập GPS di chuyển vào vùng sạt lở, đo độ trễ còi hú (< 20 ms); test nhận Push/SMS từ Admin.
```

---

### 3. Danh Sách Epics & User Stories Đảm Nhiệm

#### Story 5.1: Citizen Alert Subscription & Emergency Alert Reception (Push + SMS) (Tuần 4)
As a Citizen,  
I want to register my phone number and areas of interest in the app and receive emergency landslide alerts,  
So that I am warned immediately when the authorities issue an evacuation warning for my area.  
**Acceptance Criteria:**
- Màn hình đăng ký nhận cảnh báo: nhập/xác nhận số điện thoại, chọn vùng quan tâm (xã/huyện hoặc AOI) $\rightarrow$ `POST /api/v1/core/alerts/subscriptions`.
- App tự động đăng ký FCM token khi đăng nhập $\rightarrow$ `POST /api/v1/core/devices/register`.
- Khi nhận Push loại `EMERGENCY_ALERT`: hiển thị màn hình cảnh báo đỏ toàn màn hình, rung và phát âm thanh báo động kể cả khi app chạy nền; hiển thị nội dung, khu vực và hướng dẫn sơ tán.
- Danh sách lịch sử các cảnh báo đã nhận trong app.
- Người dân không cài app hoặc mất dữ liệu di động vẫn nhận được cảnh báo qua SMS (do Backend gửi).

#### Story 5.2: Mobile Community Field Report (Photo & GPS) (Tuần 4)
As a Citizen,  
I want to report observed landslide signs with a photo and my GPS location,  
So that officers receive ground-truth evidence to verify landslide hazards.  
**Acceptance Criteria:**
- Màn hình "Báo cáo hiện trường": tự động lấy tọa độ GPS, chụp/chọn ảnh, nhập mô tả ngắn.
- Gửi lên `POST /api/v1/core/reports`; nếu mất mạng thì lưu hàng đợi cục bộ và tự gửi lại khi có kết nối.
- Màn hình xác nhận hiển thị mã báo cáo và trạng thái xử lý (`submitted` / `processed`).

#### Story 5.3: Offline Geofencing Hazard Alert & Loud Siren (Ray-Casting & SQLite) (Tuần 2 - 3)
As a Mountain Traveler or Citizen moving through mountainous areas with zero cell reception,  
I want my phone to detect nearby landslide hazard zones locally and sound a loud emergency siren,  
So that I am warned to evacuate before entering an active slide zone.  
**Acceptance Criteria:**
- CSDL SQLite cục bộ trên điện thoại lưu trữ sẵn danh sách đa giác các vùng có nguy cơ sạt lở.
- Background location tracker chạy ngầm, tính khoảng cách Haversine và thuật toán Ray-Casting mỗi 10 giây.
- Bước chân vào vùng đa giác sạt lở: Lập tức chớp màn hình đỏ, rung và phát còi hú âm lượng tối đa ngay cả khi máy để chế độ im lặng.

---

### 4. Hợp Đồng Giao Tiếp Với Các Thành Viên Khác (Input/Output Contracts)
- **Giao tiếp với Thuận (Backend):**
  * Gửi request Đăng ký / Đăng nhập nhận JWT token.
  * Tải danh sách đa giác sạt lở mới nhất về đồng bộ vào SQLite: `GET /api/v1/core/landslides/active-zones`.
  * Đăng ký nhận cảnh báo: `POST /api/v1/core/alerts/subscriptions`, `POST /api/v1/core/devices/register`.
  * Gửi báo cáo hiện trường: `POST /api/v1/core/reports`.
  * Nhận thông báo cảnh báo khẩn cấp qua Firebase Cloud Messaging (FCM), payload `{ "type": "EMERGENCY_ALERT", "broadcastId", "severity", "message", "areaName" }`.
- **Phối hợp với Huy (WebGIS):**
  * Báo cáo hiện trường của Lâm gửi lên hiển thị marker 📍 trên bản đồ của Huy để cán bộ đối chiếu khi thẩm định.
  * Cảnh báo do Admin bấm trên WebGIS của Huy sẽ hiển thị toàn màn hình trên app của Lâm.
