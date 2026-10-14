# Story 4.4: Admin Emergency Alert Broadcast (SMS & FCM Mobile App Push)

Status: ready-for-dev

## Story Overview
**Story Key:** `4-4-admin-emergency-alert-broadcast-sms-app-push-notification`  
**Epic:** Epic 4: Forecast orchestration, WebGIS and warnings  
**Target Service:** WebGIS (`apps/webgis/`)  
**Assignee:** Huy (Frontend WebGIS Engineer) | Phối hợp: Thuận (Core Backend), Lâm (Mobile App)

### User Story
As an Emergency Operations Center Admin,  
I want a multi-channel emergency alert broadcast modal (SMS & FCM Mobile Push) with recipient estimation, message templates, character counters, and two-step safety confirmation,  
So that I can rapidly disseminate life-saving landslide evacuation warnings to threatened citizens without the risk of accidental mass-triggers.

---

## Acceptance Criteria
- [ ] **AC1 (Admin Role Authorization):** Nút kích hoạt "🚨 Phát Cảnh Báo Khẩn Cấp" trên thanh điều hướng (`Navbar.jsx`) chỉ mở được giao diện phát lệnh khi người dùng đăng nhập có vai trò `role === 'admin'`. Nếu người dùng là `officer`, nút bị vô hiệu hóa kèm tooltip thông báo yêu cầu quyền Tổng Chỉ Huy.
- [ ] **AC2 (Seamless Trigger Integration):** Tích hợp liên kết mở modal trực tiếp từ:
  - (1) Nút đỏ trên `Navbar.jsx`.
  - (2) Nút "Phát Cảnh Báo" trên hộp thoại gợi ý `EmergencyAlertPrompt.jsx` ngay sau khi Cán bộ phê duyệt một sự cố nguy cơ cao (`high` hoặc `extreme`). Thông tin sự cố (địa điểm, tọa độ, mức rủi ro, bán kính mặc định) được điền sẵn vào modal.
- [ ] **AC3 (Multi-channel & Scope Selection):**
  - **Phạm vi (Scope):** Cho phép chọn giữa: (a) Bán kính vùng đệm sạt lở (500m, 1.000m, 2.000m quanh tâm sự cố), (b) Vùng trọng điểm AOI (Yên Bái / Lào Cai), hoặc (c) Toàn bộ thuê bao đăng ký trên địa bàn.
  - **Kênh phát tin (Channels):** Checkbox đa kênh gồm *Tin nhắn SMS Khẩn Cấp* (qua Telco SMS Gateway) và *Thông Báo Đẩy Ứng Dụng* (Firebase Cloud Messaging - FCM Push).
- [ ] **AC4 (Templates & SMS Character Counter):**
  - Cung cấp ít nhất 3 mẫu tin nhắn tình huống khẩn cấp soạn sẵn (Sơ tán tức thì, Mưa lớn lũ bùn đá, Hạn chế giao thông qua đèo).
  - Bộ đếm ký tự SMS chuẩn (160 ký tự / 1 SMS tiêu chuẩn). Cảnh báo trực quan màu vàng/đỏ khi nội dung vượt quá 160 ký tự (sẽ bị phân tách thành nhiều tin nhắn).
- [ ] **AC5 (Recipient Preview Estimation):** Hiển thị bảng tóm tắt ước tính số lượng người nhận trong phạm vi đã chọn (VD: ~395 người dân đăng ký thường trú trong bán kính 1km, 24 cán bộ ứng cứu tại chỗ; chia theo kênh SMS và App).
- [ ] **AC6 (Two-step Safety Confirmation):** Có bước xác nhận thứ 2 bắt buộc (Confirm Dialog / Countdown / Gõ mã xác nhận) để ngăn chặn hoàn toàn việc bấm nhầm phát lệnh báo động diện rộng gây hoang mang dư luận.
- [ ] **AC7 (Broadcast History Log):** Có modal/drawer xem lịch sử các lần phát lệnh khẩn cấp (`BroadcastHistoryModal.jsx`): thời gian phát sóng, người phát lệnh, phạm vi, kênh truyền, số lượng tin thành công/thất bại, và trạng thái (Delivered / Processing).
- [ ] **AC8 (API Client & Offline Mock Resilience):** Tạo `broadcastApi.js` kết nối `POST /api/v1/broadcasts` (hoặc `/core/broadcasts`), lưu vết vào `localStorage` (`terrawatch_broadcast_history`) đảm bảo chạy mượt mà ngay cả khi backend offline.

---

## Technical Context & Guardrails (Ponytail Minimalist)
- **Framework & Libraries:** React 18, Vite 5, Lucide React (`lucide-react`).
- **State Management:** Sử dụng React local state (`useState`, `useMemo`, `useCallback`) tinh gọn. KHÔNG thêm thư viện quản lý state ngoài.
- **Styling:** CSS-in-JS / Inline styling kết hợp Vanilla CSS có sẵn (`index.css`), phong cách Red/Black Emergency HUD cao cấp (backdrop blur, glassmorphism, pulse animations).
- **Backend API Endpoints (Core API):**
  - `POST /api/v1/broadcasts` (Body: `{ landslide_id, scope, radius_m, channels: ['sms', 'fcm'], message, templates_id, issued_by }`)
  - `GET /api/v1/broadcasts/history` (Lấy danh sách các lệnh cảnh báo đã phát)
  - `GET /api/v1/broadcasts/recipient-preview?scope=...&radius=...` (Xem trước số lượng thuê bao)
- **Zero-loss Fallback:** Khi API Gateway hoặc Core Backend chưa bật, `broadcastApi.js` tự động lưu dữ liệu vào `localStorage` và mô phỏng phản hồi sau 800ms để phục vụ kiểm thử nghiệm thu trực tiếp.

---

## Tasks & Subtasks
- [ ] Task 1: Xây dựng API Client & Dữ Liệu Lịch Sử Phát Cảnh Báo (`broadcastApi.js`)
  - [ ] 1.1 Tạo `src/api/broadcastApi.js` cấu hình các phương thức `sendBroadcast`, `getBroadcastHistory`, `getRecipientPreview`.
  - [ ] 1.2 Thiết lập mock data lịch sử với các lần phát lệnh mẫu tại Lào Cai, Yên Bái để hiển thị lịch sử ngay lần đầu truy cập.
- [ ] Task 2: Xây dựng Modal Phát Cảnh Báo Khẩn Cấp (`BroadcastModal.jsx`)
  - [ ] 2.1 Thiết kế giao diện Modal Trung tâm Chỉ huy khẩn cấp (Emergency Command Red Theme).
  - [ ] 2.2 Bộ chọn phạm vi phát sóng (Scope & Radius Slider/Select).
  - [ ] 2.3 Bộ chọn kênh (SMS & FCM App Push) và xem trước người nhận (Recipient Preview).
  - [ ] 2.4 Dropdown chọn mẫu thông báo (Templates) & textarea soạn thảo kèm bộ đếm ký tự SMS chuẩn (160 ký tự).
  - [ ] 2.5 Hộp thoại xác nhận 2 bước an toàn (Two-step confirmation dialog) với cảnh báo đỏ nghiêm ngặt.
- [ ] Task 3: Xây dựng Modal Xem Lịch Sử Phát Cảnh Báo (`BroadcastHistoryModal.jsx`)
  - [ ] 3.1 Bảng danh sách các lệnh cảnh báo đã phát (Mã lệnh, Khu vực, Thời gian, Kênh, Số người nhận, Trạng thái thành công).
  - [ ] 3.2 Bộ lọc tìm kiếm nhanh theo khu vực và trạng thái.
- [ ] Task 4: Tích hợp Vào Dashboard, Navbar & Emergency Prompt
  - [ ] 4.1 Cập nhật `Navbar.jsx`: Thêm nút đỏ "🚨 Phát Cảnh Báo Khẩn Cấp" (kiểm tra `role === 'admin'`) và nút "📜 Lịch Sử Lệnh".
  - [ ] 4.2 Cập nhật `EmergencyAlertPrompt.jsx`: Nối hàm `onOpenBroadcast` truyền trực tiếp sự cố vừa duyệt vào `BroadcastModal`.
  - [ ] 4.3 Cập nhật `DashboardPage.jsx`: Điều phối state mở/đóng modal, nạp lại lịch sử và thông báo kết quả.
- [ ] Task 5: Kiểm Thử Nghiệm Thu & Tối Ưu Bản Build
  - [ ] 5.1 Kiểm tra toàn bộ luồng phát cảnh báo từ Navbar và từ nút Phê duyệt sự cố.
  - [ ] 5.2 Kiểm tra phân quyền: Vai trò `admin` phát được lệnh, vai trò `officer` bị vô hiệu hóa an toàn.
  - [ ] 5.3 Chạy `npm run build` đảm bảo 100% build thành công 0 lỗi.

---

## Dev Notes & Learnings from Stories 4.2 & 4.3
- **Preserve Existing Components:** Giữ nguyên các chức năng thẩm định của Story 4.2 và bản đồ 3D Terrain của Story 4.3.
- **Defensive Data Handling:** Tọa độ sự cố và dữ liệu số lượng dân cư luôn kiểm tra `undefined`/`NaN` trước khi render hoặc tính toán bán kính.
- **Role Awareness:** Sử dụng `useAuth()` để lấy `role` hiện tại (`admin` hoặc `officer`).
