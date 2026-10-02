# Kế Hoạch Epics & Stories Chi Tiết — Thành Viên 4: HUY
## Vai trò: Frontend WebGIS Engineer
**Phân hệ đảm nhiệm:** `apps/webgis/`  
**Dự án:** GeoSentry (TerraWatch) - Hệ Thống Viễn Thám, AI & Mô Hình 3D Cảnh Báo & Hỗ Trợ Cứu Hộ Sạt Lở Đất  

---

### 1. Mục Tiêu & Trách Nhiệm Kỹ Thuật
- Phát triển Web Dashboard quản trị và điều phối thiên tai bằng React 18 / Next.js + Tailwind CSS.
- Tích hợp bản đồ số WebGL chất lượng cao (Mapbox GL JS / MapLibre GL JS) hỗ trợ **Địa hình số 3D (3D Terrain)** các tỉnh đồi núi Tây Bắc.
- Xây dựng tính năng **Thanh trượt so sánh ảnh đa thời gian (Time-slider swipe)** đối soát ảnh vệ tinh trước và sau sạt lở.
- Xây dựng **Mô hình 3D Hiện trường Cứu hộ (3D Landslide Rescue Scene)** thể hiện 4 lớp không gian:
  - 🔴 **Danger Zone:** Đa giác khối trượt sạt lở bùn đất.
  - 🟢 **Victim:** Vị trí người dân gửi SOS kêu cứu.
  - ⚠ **Hazard:** Các điểm đá lăn, sụt lún taluy âm nguy hiểm.
  - 🚒 **Rescue Route:** Tuyến đường cứu hộ được AI đề xuất an toàn nhất.
- Hàng đợi thẩm định sự cố sạt lở cho Cán bộ (One-click Approval/Rejection) và xuất báo cáo thống kê thiên tai.

---

### 2. Lộ Trình 5 Tuần Tốc Lực Của Huy

```
Tuần 1: Refactor đập nhỏ file App.jsx thành các component React chuẩn; dựng màn hình Đăng ký / Đăng nhập cán bộ.
Tuần 2: Tích hợp Mapbox 3D Terrain núi đồi Yên Bái/Lào Cai; kết nối API Thuận tải danh sách vùng giám sát AOI.
Tuần 3: Xây dựng thanh trượt so sánh ảnh vệ tinh trước/sau (Time-slider swipe); hiển thị đa giác sạt lở AI vẽ.
Tuần 4: Hoàn thiện Dashboard thẩm định One-click Approval; dựng Mô hình 3D Hiện trường sạt lở và gán Đội cứu hộ.
Tuần 5: Tối ưu hóa render WebGL 60fps, responsive đa màn hình, fix bug và đóng gói Docker container Nginx.
```

---

### 3. Danh Sách Epics & User Stories Đảm Nhiệm

#### Story 4.2: WebGIS Incident Management Dashboard & One-Click Landslide Approval (Tuần 1 - 4)
As a Disaster Officer,  
I want a dashboard listing pending AI landslide detections with confidence scores and one-click verification,  
So that verified alerts immediately propagate to the emergency broadcast and rescue dispatch system.  
**Acceptance Criteria:**
- Dashboard hiển thị danh sách các sự kiện sạt lở chờ duyệt (`PENDING`), kèm diện tích (ha), độ dốc và độ tin cậy.
- Nút "Phê Duyệt (Approve)" gọi `POST /api/v1/core/landslides/{id}/verify`, chuyển trạng thái sang `VERIFIED` và bắn còi báo động.
- Màn hình Đăng nhập/Đăng ký cán bộ lưu trữ JWT trong `localStorage` và tự động gắn header Authorization.

#### Story 4.3: 3D Landslide Rescue Scene (Terrain 3D, Danger Zone, Victim, Hazard, Route) (Tuần 2 - 4)
As a Rescue Commander,  
I want an interactive 3D scene visualizing the mountain terrain, the landslide scar (🔴 Danger Zone), trapped victim locations (🟢 Victim), rockfall hazards (⚠ Hazard), and the rescue route (🚒 Rescue Route),  
So that rescue teams can grasp the dangerous topography before entering the disaster zone.  
**Acceptance Criteria:**
- Bản đồ Mapbox GL bật lớp 3D Terrain elevation hiển thị địa hình núi đồi Yên Bái, Lào Cai chân thực.
- Hiển thị đầy đủ 4 lớp marker không gian 3D:
  - 🔴 Danger Zone: Đa giác bùn đất sạt lở.
  - 🟢 Victim: Vị trí người dân gửi SOS kêu cứu.
  - ⚠ Hazard: Điểm nguy cơ sạt trượt thứ cấp.
  - 🚒 Rescue Route: Tuyến đường cứu hộ được AI đề xuất.
- Điều khiển camera 3D: Xoay 360 độ, nghiêng góc nhìn (pitch), phóng to chi tiết điểm sạt lở.

#### Story 4.4: Rescue Team Dispatch & Mission Status Management (Tuần 4)
As an Emergency Dispatcher,  
I want to assign a specific Rescue Team to a landslide incident and track mission status in real time,  
So that rescue operations are coordinated efficiently.  
**Acceptance Criteria:**
- Cán bộ chọn sự cố sạt lở $\rightarrow$ Gán đội cứu hộ phụ trách $\rightarrow$ Đổi trạng thái sang `DISPATCHED`.
- Bảng điều phối hiển thị trạng thái thời gian thực của các đội cứu hộ (`EN_ROUTE`, `ON_SCENE`, `RESOLVED`).

---

### 4. Hợp Đồng Giao Tiếp Với Các Thành Viên Khác (Input/Output Contracts)
- **Nhận từ Thuận (Backend):** REST API danh sách sự cố sạt lở, danh sách tin báo SOS, API phê duyệt `/verify`.
- **Nhận từ Tú (GIS):** Map Vector Tiles (MVT) qua `/tiles/{z}/{x}/{y}.pbf` và ảnh vệ tinh đa thời gian.
- **Nhận từ Duẫn (AI):** GeoJSON MultiPolygon vết sạt lở và GeoJSON LineString tuyến đường cứu hộ để vẽ lên Mapbox.
