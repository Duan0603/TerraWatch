# Kế Hoạch Epics & Stories Chi Tiết — Thành Viên 5: LÂM
## Vai trò: Mobile App Engineer
**Phân hệ đảm nhiệm:** `apps/mobile/`  
**Dự án:** GeoSentry (TerraWatch) - Hệ Thống Viễn Thám, AI & Mô Hình 3D Cảnh Báo & Hỗ Trợ Cứu Hộ Sạt Lở Đất  

---

### 1. Mục Tiêu & Trách Nhiệm Kỹ Thuật
- Phát triển ứng dụng di động đa nền tảng (Android & iOS) bằng Flutter 3.x.
- Dựng giao diện Đăng ký / Đăng nhập cho Người dân & Thành viên Đội cứu hộ.
- Lập trình dịch vụ định vị chạy nền (**Background Geolocation**) liên tục theo dõi vị trí GPS ngay cả khi tắt màn hình điện thoại.
- Lưu trữ bộ nhớ đệm CSDL không gian ngoại tuyến bằng **SQLite (`sqflite`)** chứa $\ge 10,000$ đa giác điểm sạt lở nguy hiểm.
- Xử lý thuật toán **Geofencing ngoại tuyến** không cần mạng Internet/4G (thuật toán khoảng cách Haversine & thuật toán Point-in-Polygon Ray-Casting).
- Cơ chế kích hoạt **Còi hú báo động âm lượng tối đa & Rung liên tục** (vượt qua chế độ im lặng của máy) khi đi vào vùng sạt lở.
- Module **Gửi SOS khẩn cấp 1-chạm (1-Tap SOS)** kèm tọa độ GPS và ảnh hiện trường khi bị mắc kẹt / cô lập.
- Màn hình **Theo dõi tiến trình cứu hộ (Live Rescue Tracking)**.

---

### 2. Lộ Trình 5 Tuần Tốc Lực Của Lâm

```
Tuần 1: Cấu hình Flutter 3.x, dựng giao diện Đăng ký / Đăng nhập người dân kết nối API Thuận; cài đặt sqflite.
Tuần 2: Lập trình Background Geolocation chạy ngầm; viết thuật toán Haversine và Ray-Casting kiểm tra tọa độ.
Tuần 3: Hoàn thiện nạp 10,000 đa giác vào SQLite; lập trình còi hú báo động & rung khi GPS lọt vào vùng nguy cơ.
Tuần 4: Xây dựng nút SOS khẩn cấp 1-chạm gửi GPS/ảnh về Core API; dựng màn hình Live Rescue Tracking.
Tuần 5: Thử nghiệm thực địa: Tắt sạch mạng 4G/WiFi, giả lập GPS di chuyển vào vùng sạt lở, đo độ trễ còi hú (< 20 ms).
```

---

### 3. Danh Sách Epics & User Stories Đảm Nhiệm

#### Story 5.1: 1-Tap Landslide SOS Emergency Button with Auto-GPS & Media Capture (Tuần 4)
As a Citizen trapped or isolated by a landslide,  
I want a prominent 1-tap SOS button that auto-captures my precise GPS coordinates and allows instant photo transmission of the landslide,  
So that I can call for rescue immediately even when panicked.  
**Acceptance Criteria:**
- Nút bấm SOS màu đỏ nổi bật ngay giữa màn hình chính ứng dụng di động.
- Tự động lấy tọa độ GPS chính xác cao, đính kèm ảnh hiện trường và gửi lên `/api/v1/sos/send`.
- Màn hình xác nhận hiển thị mã yêu cầu cứu hộ và số điện thoại đường dây nóng khẩn cấp.

#### Story 5.2: Live Rescue Support Tracking for Trapped Mountain Communities (Tuần 4)
As a Citizen waiting for rescue,  
I want to see the real-time status of my rescue request and the approaching rescue team on a map,  
So that trapped victims remain informed and reassured.  
**Acceptance Criteria:**
- Thanh tiến trình trên điện thoại: `Đã tiếp nhận` $\rightarrow$ `Đội cứu hộ đang di chuyển` $\rightarrow$ `Đã tiếp cận hiện trường`.
- Bản đồ hiển thị khoảng cách và thời gian dự kiến (ETA) của xe cứu nạn đang di chuyển tới.

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
  * Gửi tín hiệu SOS khẩn cấp: `POST /api/v1/sos/send`.
  * Nhận thông báo cứu hộ qua Firebase Cloud Messaging (FCM).
- **Phối hợp với Huy (WebGIS):**
  * Tín hiệu SOS của Lâm gửi lên sẽ lập tức nổ marker xanh 🟢 **Victim** trên màn hình 3D của Huy để cán bộ nhìn thấy và điều phối cứu hộ.
