# Story 4.3: Rainfall, Terrain & 24h Hazard Forecast Dashboard (3D WebGIS)

Status: done

## Story Overview
**Story Key:** `4-3-rainfall-terrain-24h-hazard-dashboard`  
**Epic:** Epic 4: Forecast orchestration, WebGIS and warnings  
**Target Service:** WebGIS (`apps/webgis/`)  
**Assignee:** Huy (Frontend WebGIS Engineer) | Phối hợp: Tú (GIS Pipeline)

### User Story
As a Disaster Officer,  
I want an interactive 3D WebGIS map showing mountain terrain, landslide hazard polygons, rainfall evidence and field reports,  
So that I can rigorously inspect the physical basis of a 24-hour hazard forecast before approving warnings.

---

## Acceptance Criteria
- [x] AC1: `MapViewer.jsx` tích hợp Mapbox GL JS hiển thị lớp 3D Terrain elevation (`mapbox-dem` exaggeration 1.5x) khu vực đồi núi Tây Bắc (Yên Bái, Lào Cai: Đèo Khau Phạ, Bản Dế Xu Phình, Làng Nủ) kèm điều khiển camera 3D (pitch 60°, xoay bearing, zoom và reset view).
- [x] AC2: Hiển thị trực quan các lớp không gian GeoJSON: Đa giác rủi ro sạt lở tô màu theo `risk_level` (🟢 Low, 🟡 Medium, 🟠 High, 🔴 Extreme), ranh giới vùng giám sát (AOI boundary), và marker các điểm báo cáo hiện trường của người dân (`community_reports`).
- [x] AC3: Tương tác đồng bộ giữa Hàng đợi thẩm định và Bản đồ: Khi Cán bộ click chọn sự cố từ `VerificationQueue`, camera bản đồ tự động `flyTo` mượt mà đến tọa độ mục tiêu, phóng to chi tiết vết sạt trượt và highlight vòng đệm nguy cơ.
- [x] AC4: Bảng bằng chứng dự báo 24h (`RainfallEvidencePanel.jsx`): Biểu đồ thanh đối soát lượng mưa 24h (Mưa thực đo tích lũy vs Mưa dự báo theo giờ), thời gian phát hành (`issuedAt`) và thời hạn hiệu lực (`validUntil`), thông số độ dốc taluy và trạng thái dữ liệu (Fresh / Stale / Expired).
- [x] AC5: Tối ưu hiệu năng WebGL theo triết lý Ponytail: Tự động dọn dẹp map instance khi unmount chống rò rỉ bộ nhớ, vẽ biểu đồ mưa bằng SVG/CSS Flexbox thuần (không cài thêm thư viện Chart.js/Recharts nặng nề), hỗ trợ cơ chế fallback vệ tinh khi mất mạng hoặc token Mapbox trống.

---

## Technical Context & Guardrails (Ponytail Minimalist)
- **Framework & Libraries:** React 18, Vite 5, `mapbox-gl` (CSS đã tích hợp sẵn trong `index.html`), Lucide React.
- **Mapbox Config:** Đọc `import.meta.env.VITE_MAPBOX_ACCESS_TOKEN` từ `.env`. Cung cấp sẵn token dự phòng hợp lệ để bản đồ 3D tải được ngay cả khi người dùng chưa cấu hình key cá nhân.
- **No Heavy Dependencies:** Vẽ biểu đồ lượng mưa 24h bằng SVG inline hoặc CSS flexbox bars siêu nhẹ, responsive, tốc độ tải tức thì.
- **Mapbox 3D Terrain Source:** Sử dụng `mapbox://mapbox.mapbox-terrain-dem-v1` kết hợp vệ tinh độ phân giải cao `mapbox://styles/mapbox/satellite-streets-v12`.
- **Target Coordinates (Miền núi phía Bắc):**
  - Mù Cang Chải / Đèo Khau Phạ (Yên Bái): `[104.085, 21.845]`, zoom: 13.5, pitch: 60, bearing: 35
  - Bản Dế Xu Phình (Quốc lộ 32): `[104.110, 21.860]`, zoom: 14, pitch: 65, bearing: -20
  - Làng Nủ / Bảo Yên (Lào Cai): `[104.420, 22.350]`, zoom: 13.8, pitch: 62, bearing: 45

---

## Tasks & Subtasks
- [x] Task 1: Cài đặt & Cấu hình Mapbox GL JS Client
  - [x] 1.1 Kiểm tra/cài đặt `mapbox-gl` trong `apps/webgis/package.json`.
  - [x] 1.2 Cấu hình `src/config/mapbox.js`: Quản lý Mapbox Token, tọa độ mặc định các trọng điểm sạt lở, thiết lập các tham số địa hình 3D (`exaggeration: 1.5`).
- [x] Task 2: Xây dựng Component MapViewer 3D Terrain & Lớp GeoJSON
  - [x] 2.1 Tạo `src/components/MapViewer.jsx`: Khởi tạo Mapbox GL canvas, gắn source `mapbox-dem` và bật `setTerrain`.
  - [x] 2.2 Thêm các lớp GeoJSON (Layers):
    - Layer `landslide-polygons`: Đa giác vết trượt tô màu theo `risk_level` (opacity 0.75, stroke 2px).
    - Layer `buffer-zone`: Vòng đệm an toàn cảnh báo (bán kính 500m - 2km).
    - Layer `aoi-boundaries`: Ranh giới vùng giám sát viễn thám.
  - [x] 2.3 Thêm điều khiển camera 3D: Nút chuyển đổi góc nhìn 2D / 3D, nút xoay hướng Bắc, nút phóng to/thu nhỏ.
- [x] Task 3: Bảng Bằng Chứng Dự Báo 24h & Biểu Đồ Lượng Mưa (RainfallEvidencePanel)
  - [x] 3.1 Tạo `src/components/RainfallEvidencePanel.jsx`: Trực quan hóa lượng mưa tích lũy 24h qua biểu đồ cột SVG/CSS đối soát giữa *Mưa thực tế* (Observed) và *Mưa dự báo* (Forecast).
  - [x] 3.2 Hiển thị mốc thời gian phát hành (`Issued`), thời hạn cảnh báo (`Valid until`), độ dốc sườn núi và trạng thái dữ liệu (Fresh / 24h window).
  - [x] 3.3 Thiết kế Dark Theme trong suốt (glassmorphism) đồng bộ với bảng điều khiển hiện tại.
- [x] Task 4: Kết nối Đồng Bộ Hàng Đợi Thẩm Định (Story 4.2) & Bản Đồ 3D
  - [x] 4.1 Cập nhật `DetailPanel.jsx` / `DashboardPage.jsx`: Thay thế mock canvas radar bằng `MapViewer` thực tế.
  - [x] 4.2 Viết hiệu ứng `map.flyTo` khi người dùng click vào bất kỳ sự cố nào ở `VerificationQueue`.
  - [x] 4.3 Thêm popup thông tin nhanh khi click trực tiếp vào đa giác sạt lở trên bản đồ 3D.
- [x] Task 5: Kiểm Thử Hiệu Năng & Xác Thực Giao Diện
  - [x] 5.1 Kiểm tra bản đồ 3D hiển thị địa hình đồi núi thực tế tại `http://localhost:5173/`.
  - [x] 5.2 Kiểm tra chuyển đổi mượt mà giữa các điểm sạt lở Yên Bái, Lào Cai.
  - [x] 5.3 Chạy `npm run build` xác nhận đóng gói 0 lỗi, tách riêng chunk mapbox độc lập.

---

## Dev Agent Record
### Debug Log
- Story 4.3 hoàn thành 100% theo triết lý Ponytail Minimalist.
- Đã cài đặt `mapbox-gl` v3.2.0, cấu hình 3D terrain elevation 1.5x và camera 60°.
- Đã tạo `MapViewer.jsx`, `RainfallEvidencePanel.jsx`, tích hợp hoàn chỉnh vào `DetailPanel.jsx`.
- Đã cấu hình Vite code-splitting tối ưu riêng chunk Mapbox và ReactVendor.
- Build kiểm tra thành công `npm run build` 0 lỗi.
### Completion Notes
- Trạng thái: `review`.
- Bản đồ 3D và biểu đồ bằng chứng dự báo mưa 24h sẵn sàng trải nghiệm tại `http://localhost:5173/`.
