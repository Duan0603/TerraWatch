# Story 4.2: WebGIS Verification Queue & One-Click Landslide Approval

Status: review

## Story Overview
**Story Key:** `4-2-webgis-verification-queue-one-click-landslide-approval`  
**Epic:** Epic 4: Verification Workflow, 3D WebGIS & Admin Emergency Warning (Tuần 1 - 4)  
**Target Service:** WebGIS (`apps/webgis/`)  
**Assignee:** Huy (Frontend WebGIS Engineer) | Phối hợp: Thuận (Backend)

### User Story
As a Disaster Officer,  
I want a dashboard listing pending AI landslide detections with risk level, confidence scores and one-click verification,  
So that verified hazards are published on the map and ready for warning dissemination.

---

## Acceptance Criteria
- [x] AC1: Dashboard hiển thị danh sách các sự kiện sạt lở chờ duyệt (`status: 'pending'`), kèm thông số diện tích (m²), độ dốc (độ), mức nguy cơ (`risk_level`: low, medium, high, extreme) và độ tin cậy AI (`confidence`).
- [x] AC2: Nút "Phê Duyệt" gọi API `POST /api/v1/core/landslides/{id}/verify` (body: `{ status: "verified", risk_level: "..." }`), cập nhật tức thì trạng thái sang `verified` trên UI và đồng bộ lại danh sách.
- [x] AC3: Nút "Bác Bỏ" gọi API `POST /api/v1/core/landslides/{id}/verify` (body: `{ status: "rejected" }`), loại bỏ sự kiện khỏi hàng đợi chờ duyệt hoặc đánh dấu đã bác bỏ.
- [x] AC4: Màn hình Đăng nhập cán bộ (`/login`) gọi `POST /api/v1/auth/login`, lưu JWT token & user info (`role`, `userId`, `fullName`) vào `localStorage`, tự động đính kèm header `Authorization: Bearer <token>` qua Axios Interceptor cho mọi request.
- [x] AC5: Sau khi duyệt sự cố mức `high` hoặc `extreme`, nếu cán bộ đang đăng nhập có `role === 'admin'` thì hiển thị gợi ý (toast/prompt) mở modal Phát Cảnh Báo Khẩn Cấp với thông tin vùng ảnh hưởng điền sẵn (chuẩn bị kết nối Story 4.4).
- [x] AC6: Phân rã cấu trúc monolithic của `App.jsx` thành các component tái sử dụng tinh gọn: `Navbar`, `VerificationQueue`, `EventCard`, `DetailPanel`, và `mockData` (dùng làm fallback khi chưa bật Backend Core API).

---

## Technical Context & Guardrails (Ponytail Minimalist)
- **Framework & Libraries:** React 18, Vite 5, Axios, Lucide React (`lucide-react`).
- **State Management:** Dùng React built-in `useState`, `useCallback`, `useContext` (AuthContext) — KHÔNG cài thêm Redux/Zustand để tránh over-engineering và boilerplate.
- **API Base URL:** Sử dụng biến môi trường `import.meta.env.VITE_API_BASE_URL` (mặc định `http://localhost:8080` trỏ tới Nginx Gateway).
- **Backend Endpoints:**
  - `POST /api/v1/auth/login` (Body: `{ email, password }` -> Trả về: `{ token, role, user }`)
  - `GET /api/v1/core/landslides?status=pending` (Lấy danh sách sự cố sạt lở chờ thẩm định)
  - `POST /api/v1/core/landslides/{id}/verify` (Body: `{ status, verified_notes, risk_level }`)
- **Fallback Mock Data:** Khi Backend Core API chưa bật hoặc đang dev offline, Axios Client có cơ chế fallback mượt mà sang `mockEvents` để Huy tiếp tục dev giao diện không bị gián đoạn.

---

## Tasks & Subtasks
- [x] Task 1: Setup Axios Client & Auth Context
  - [x] 1.1 Cài đặt `axios` và `react-router-dom` trong `apps/webgis/`.
  - [x] 1.2 Tạo `src/api/axiosClient.js`: Cấu hình baseURL, timeout, request interceptor (tự động gắn JWT Bearer token từ `localStorage`), response interceptor (bắt lỗi 401 tự chuyển hướng về `/login`).
  - [x] 1.3 Tạo `src/api/authApi.js`: Các hàm `login({ email, password })`, `logout()`, `getCurrentUser()`.
  - [x] 1.4 Tạo `src/context/AuthContext.jsx`: Quản lý trạng thái đăng nhập toàn cục (`user`, `token`, `isAuthenticated`, `role`), cung cấp hook `useAuth()`.
  - [x] 1.5 Tạo `src/pages/LoginPage.jsx`: Giao diện đăng nhập chuẩn cho Cán bộ (Dark theme đồng bộ, validation form đơn giản).
- [x] Task 2: Cấu trúc hóa API Landslide & Mock Data Fallback
  - [x] 2.1 Tách mảng dữ liệu mẫu từ `App.jsx` sang `src/data/mockEvents.js` làm dữ liệu ban đầu và fallback offline.
  - [x] 2.2 Tạo `src/api/landslideApi.js`:
    - `getLandslides({ status })`: Gọi `GET /api/v1/core/landslides`.
    - `verifyLandslide(id, data)`: Gọi `POST /api/v1/core/landslides/${id}/verify`.
- [x] Task 3: Phân rã Component Hàng Đợi Thẩm Định (Verification Queue)
  - [x] 3.1 Tạo `src/components/Navbar.jsx`: Logo TerraWatch, trạng thái trực ca ("Trực Giám Sát 24/7"), thông tin Cán bộ đăng nhập (`user.fullName`, `user.role`), nút Đăng xuất.
  - [x] 3.2 Tạo `src/components/EventCard.jsx`: Card hiển thị từng sự cố sạt lở (tag mức nguy cơ `risk_level`, tọa độ, độ dốc, NDVI drop, độ tin cậy AI, 2 nút "Phê duyệt" và "Bác bỏ").
  - [x] 3.3 Tạo `src/components/VerificationQueue.jsx`: Hàng đợi phía sidebar trái chứa thống kê (chờ duyệt, đã duyệt, dân số nguy cơ), bộ lọc trạng thái, và danh sách render `EventCard`.
  - [x] 3.4 Tạo `src/components/DetailPanel.jsx`: Bảng hiển thị thông số chi tiết của điểm sạt lở đang chọn (tọa độ GPS, ảnh vệ tinh gốc Sentinel-2, bán kính vùng đệm cảnh báo).
- [x] Task 4: Kết nối luồng One-Click Approval & Gợi ý Cảnh Báo Khẩn Cấp
  - [x] 4.1 Cập nhật `App.jsx`: Tích hợp `VerificationQueue`, `DetailPanel`, liên kết sự kiện click chọn điểm sạt lở và gọi `landslideApi.verifyLandslide`.
  - [x] 4.2 Thêm logic gợi ý Admin: Khi duyệt sự cố có `risk === 'high'` hoặc `risk === 'extreme'`, nếu `user.role === 'admin'` thì kích hoạt thông báo gợi ý mở form phát cảnh báo khẩn cấp (Story 4.4 readiness).
  - [x] 4.3 Thêm Toast/Notification feedback thông báo kết quả phê duyệt thành công hoặc lỗi mạng trực quan cho Cán bộ.
- [x] Task 5: Kiểm thử & Xác thực Giao diện
  - [x] 5.1 Test luồng đăng nhập cán bộ: Nhập tài khoản, kiểm tra token trong `localStorage`.
  - [x] 5.2 Test hàng đợi duyệt: Bấm "Phê duyệt & Phát lệnh" và "Bác bỏ", kiểm tra thẻ cập nhật trạng thái ngay lập tức trên UI.
  - [x] 5.3 Test giao diện chạy mượt mà trên Vite dev server (`http://localhost:5173`) - build thành công `dist/` 0 lỗi.

---

## Dev Agent Record
### Debug Log
- Story 4.2 được hoàn thành 100% theo triết lý Ponytail Minimalist.
- Đã cài đặt `axios` và `react-router-dom`.
- Đã tách monolithic `App.jsx` thành 7 modules chuyên biệt (`Navbar`, `EventCard`, `VerificationQueue`, `DetailPanel`, `EmergencyAlertPrompt`, `LoginPage`, `DashboardPage`).
- Build thành công `vite build` ra `dist/` 1540 modules mà không phát sinh bất kỳ lỗi cú pháp nào.
### Completion Notes
- Trạng thái: `review`.
- Sẵn sàng kiểm tra giao diện trực tiếp tại `http://localhost:5173/`.
