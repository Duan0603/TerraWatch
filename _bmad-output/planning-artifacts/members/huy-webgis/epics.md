# Kế Hoạch Epics & Stories Chi Tiết — Thành Viên 4: HUY
## Vai trò: Frontend WebGIS Engineer
**Phân hệ đảm nhiệm:** `apps/webgis/`  
**Dự án:** GeoSentry (TerraWatch) - Hệ Thống Viễn Thám & AI Cảnh Báo Sớm Sạt Lở Đất  

---

### 1. Mục Tiêu & Trách Nhiệm Kỹ Thuật
- Phát triển Web Dashboard giám sát và cảnh báo sạt lở bằng React 18 + Vite.
- Tích hợp bản đồ số WebGL chất lượng cao (Mapbox GL JS / MapLibre GL JS) hỗ trợ **Địa hình số 3D (3D Terrain)** các tỉnh đồi núi Tây Bắc.
- Xây dựng tính năng **Thanh trượt so sánh ảnh đa thời gian (Time-slider swipe)** đối soát ảnh vệ tinh trước và sau sạt lở.
- Hiển thị **bản đồ vùng nguy cơ 3D**: đa giác sạt lở tô màu theo `risk_level`, báo cáo hiện trường của người dân, ranh giới vùng giám sát (AOI).
- Hàng đợi thẩm định sự cố sạt lở cho Cán bộ (One-click Approval/Rejection).
- **Nút "🚨 Phát Cảnh Báo Khẩn Cấp" cho Admin** (form chọn phạm vi, kênh SMS/Push, xác nhận 2 bước) và màn hình lịch sử/thống kê gửi cảnh báo.

---

### 2. Lộ Trình 5 Tuần Tốc Lực Của Huy

```
Tuần 1: Refactor đập nhỏ file App.jsx thành các component React chuẩn; dựng màn hình Đăng ký / Đăng nhập cán bộ.
Tuần 2: Tích hợp Mapbox 3D Terrain núi đồi Yên Bái/Lào Cai; kết nối API Thuận tải danh sách vùng giám sát AOI.
Tuần 3: Xây dựng thanh trượt so sánh ảnh vệ tinh trước/sau (Time-slider swipe); hiển thị đa giác sạt lở theo mức nguy cơ.
Tuần 4: Hoàn thiện Dashboard thẩm định One-click Approval; nút & form Phát Cảnh Báo Khẩn Cấp cho Admin.
Tuần 5: Tối ưu hóa render WebGL 60fps, responsive đa màn hình, fix bug và đóng gói Docker container Nginx.
```

---

### 3. Danh Sách Epics & User Stories Đảm Nhiệm

#### Story 4.2: WebGIS Verification Queue & One-Click Landslide Approval (Tuần 1 - 4)
As a Disaster Officer,  
I want a dashboard listing pending AI landslide detections with risk level, confidence scores and one-click verification,  
So that verified hazards are published on the map and ready for warning dissemination.  
**Acceptance Criteria:**
- Dashboard hiển thị danh sách các sự kiện sạt lở chờ duyệt (`pending`), kèm diện tích (ha), độ dốc, mức nguy cơ và độ tin cậy.
- Nút "Phê Duyệt" gọi `POST /api/v1/core/landslides/{id}/verify`, chuyển trạng thái sang `verified`; nút "Bác Bỏ" chuyển sang `rejected` / `false_alarm`.
- Sau khi duyệt sự cố mức `high`/`extreme`, nếu người dùng là Admin thì hiện gợi ý mở form Phát Cảnh Báo Khẩn Cấp với vùng ảnh hưởng điền sẵn.
- Màn hình Đăng nhập/Đăng ký cán bộ lưu trữ JWT trong `localStorage` và tự động gắn header Authorization.

#### Story 4.3: 3D Terrain Hazard Map & Before/After Time-Slider (Tuần 2 - 4)
As a Disaster Officer,  
I want an interactive 3D map showing mountain terrain, landslide hazard polygons colored by risk level, community field reports and a before/after satellite comparison slider,  
So that I can accurately assess each detected landslide before approving warnings.  
**Acceptance Criteria:**
- Bản đồ Mapbox GL bật lớp 3D Terrain elevation hiển thị địa hình núi đồi Yên Bái, Lào Cai chân thực.
- Hiển thị các lớp không gian:
  - 🔴 Vùng sạt lở (Danger Zone) tô màu theo `risk_level` (low → extreme).
  - 📍 Báo cáo hiện trường của người dân (`community_reports`).
  - 🟦 Ranh giới vùng giám sát (AOI).
- Thanh trượt so sánh ảnh vệ tinh trước/sau biến động (Time-slider swipe).
- Điều khiển camera 3D: Xoay 360 độ, nghiêng góc nhìn (pitch), phóng to chi tiết điểm sạt lở.

#### Story 4.4 (Frontend): Admin Emergency Alert Broadcast Button (Tuần 4 - Phối hợp cùng Thuận)
As an Admin,  
I want a prominent "🚨 Phát Cảnh Báo Khẩn Cấp" button on the dashboard,  
So that I can instantly warn citizens in the affected area via SMS and app notification.  
**Acceptance Criteria:**
- Nút màu đỏ nổi bật trên thanh công cụ, **chỉ hiển thị khi `role === 'admin'`** (đọc từ JWT / `/auth/me`).
- Form gồm: phạm vi nhận (chọn sự cố đã duyệt + bán kính / chọn AOI trên bản đồ / toàn bộ), mức độ (`high`/`extreme`), nội dung (bộ đếm 160 ký tự + mẫu soạn sẵn), kênh gửi (☑ SMS ☑ Thông báo App).
- Vùng nhận cảnh báo được vẽ highlight trực tiếp trên bản đồ khi chọn phạm vi.
- Hộp thoại xác nhận 2 bước hiển thị số người nhận dự kiến (`POST /api/v1/core/alerts/preview`) trước khi gọi `POST /api/v1/core/alerts/broadcast`.
- Màn hình "Lịch sử cảnh báo": danh sách các lần phát, người gửi, thời gian, số đã gửi / thất bại theo từng kênh (`GET /api/v1/core/alerts`).

---

### 4. Hợp Đồng Giao Tiếp Với Các Thành Viên Khác (Input/Output Contracts)
- **Nhận từ Thuận (Backend):** REST API danh sách sự cố sạt lở, báo cáo hiện trường, API phê duyệt `/verify`, API phát cảnh báo khẩn cấp `/alerts/*`.
- **Nhận từ Tú (GIS):** Map Vector Tiles (MVT) qua `/tiles/{z}/{x}/{y}.pbf` và ảnh vệ tinh đa thời gian.
- **Nhận từ Duẫn (AI):** GeoJSON MultiPolygon vết sạt lở kèm `risk_level` để tô màu trên Mapbox.
