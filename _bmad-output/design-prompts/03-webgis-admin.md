# Phase 3 — WebGIS Admin Screens (W07 → W12)

> Chạy theo thứ tự W07 → W08 → W09 → W10. Mỗi prompt = 1 lần generate.

---

## PROMPT 6 — W07 Review Queue

```
Tiếp tục thiết kế TerraWatch theo đúng design system đã thiết lập:
Tone trắng. Primary teal #087B70. Background #F5F8F7. Surface #FFFFFF. Border #DCE5E2.
Font Inter. Màu nguy cơ: Low #22C55E · Medium #EAB308 · High #F97316 · Extreme #EF4444.
Ngôn ngữ tiếng Việt. Thời gian 24h GMT+7.

Thiết kế màn hình WebGIS desktop 1440×900 px cho vai trò Admin.
Tên frame: W07 — Admin Review Queue

Bố cục giống W01 nhưng Sidebar chứa danh sách đề xuất chờ phê duyệt.

Top navigation:
- Logo TerraWatch + GeoSentry Platform.
- Navigation: Phê duyệt cảnh báo (active, badge đỏ "3") · Lịch sử phát cảnh báo · Quản lý người nhận · Báo cáo hệ thống.
- Bên phải: Badge "Hệ thống trực tuyến" · Avatar "TL" · Trần Văn Lâm · "Lãnh đạo phê duyệt".

Sidebar — Review Queue:
- Eyebrow: "HÀNG CHỜ PHÊ DUYỆT".
- Heading: "3 đề xuất đang chờ".
- Subtext nhỏ: "Sắp xếp: Mức độ khẩn cấp".
- Card đề xuất 1 (selected, border teal):
  - Badge đỏ "CỰC CAO" · "#TW-250815-004".
  - Location: "Bản Vược, Bát Xát".
  - Score: "92/100 · 186mm/24h".
  - Time: "Gửi lúc 08:32 · Nguyễn Minh Anh".
  - Dot pulse đỏ.
- Card đề xuất 2:
  - Badge cam "CAO" · "#TW-250815-003".
  - "Mường Hum, Bát Xát · 74/100".
  - "Gửi lúc 07:15 · Trần Thị Bình".
- Card đề xuất 3:
  - Badge vàng "TRUNG BÌNH" · "#TW-250815-002".
  - "Quang Kim, Bát Xát · 61/100".
  - "Gửi lúc 06:50 · Lê Văn Cường".
- Divider + link: "Xem lịch sử đã xử lý (12)".

Bản đồ:
- Giống W01 nhưng highlight vùng Bản Vược với border đậm và marker nhấp nháy.
- Overlay nhẹ các vùng đang chờ xét duyệt.
```

---

## PROMPT 7 — W08 Review Detail

```
Dựa trên W07 Admin Review Queue đã thiết kế. Giữ nguyên Top Navigation, Sidebar, và bản đồ.
Chỉ thêm Review Panel từ bên phải rộng 480 px cho đề xuất #TW-250815-004.
Tone trắng. Primary teal #087B70. Danger #EF4444.

Tên frame: W08 — Review Detail

Review Panel (480 px từ phải):
Header:
- Eyebrow đỏ in hoa: "ĐỀ XUẤT #TW-250815-004".
- Heading: "Đề xuất cảnh báo cực kỳ nguy hiểm".
- Row metadata: Gửi bởi: Nguyễn Minh Anh · Lúc: 08:32 · 15/08/2025.
- Nút đóng góc trên phải.

Section Thông tin nguy cơ:
- Eyebrow: "THÔNG TIN ĐÁNH GIÁ".
- Card nền đỏ nhạt: Điểm rủi ro 92/100 · Tăng 18 điểm (+24%).
- Khu vực: Bản Vược, Bát Xát, Lào Cai · Ô: #LC-BX-042.
- Grid 2 cột:
  - Mưa 24h: 186 mm (badge đỏ "Cực cao").
  - Mưa 72h: 324 mm (badge đỏ).
  - Dự báo 24h: 142 mm (badge cam).
  - Độ dốc: 38.6° TB / 52.1° max.

Section Đề xuất hành động:
- Eyebrow: "ĐỀ XUẤT CỦA CÁN BỘ".
- Phạm vi: "03 thôn Nậm Chạc, Sơn Hà, Bản Vược · bán kính 2.5 km".
- Hành động: "Sơ tán khỏi khu vực sườn dốc".
- Hiệu lực: "24 giờ (08:00 15/08 → 08:00 16/08/2025)".
- Mức độ: Badge đỏ "Cực kỳ nguy hiểm".
- Ghi chú chuyên môn: italic text trong box nền xám nhạt.

Section Bằng chứng đính kèm:
- Thumbnail ảnh hiện trường nhỏ (nếu có).
- Link "Xem 2 phản ánh hiện trường liên quan".

Footer sticky 2 nút:
- Nút danger: "Phê duyệt và phát cảnh báo" (chiếm 60% width).
- Nút ghost đỏ: "Từ chối" (chiếm 35% width).
- Metadata: "Cần phê duyệt trước 10:00 để đảm bảo hiệu lực".
```

---

## PROMPT 8 — W09/W10 Phê duyệt Modal + Success

```
Dựa trên design system TerraWatch (tone trắng, teal #087B70, danger #EF4444).
Modal nằm giữa màn hình 1440×900 trên overlay blur.
Dùng dữ liệu: #TW-250815-004, 1248 người nhận, 1248 SMS + 837 FCM, Bản Vược.

Tạo 2 frame:

FRAME W09 — Approve Modal:
Modal phê duyệt và cấu hình phát cảnh báo:
- Tiêu đề: "Phê duyệt và phát cảnh báo".
- Subtext: "Đề xuất #TW-250815-004 · Bản Vược, Bát Xát".

Section Xác nhận thông tin:
- Read-only row: Mức độ: badge đỏ "Cực kỳ nguy hiểm".
- Read-only row: Hiệu lực: 08:00 15/08 → 08:00 16/08.
- Read-only row: Phạm vi: 03 thôn · bán kính 2.5 km.

Section Cấu hình phát:
- Heading: "Kênh thông báo".
- Toggle SMS (active, teal): "1,248 người nhận đã xác minh".
- Toggle App Push (active, teal): "837 người dùng có ứng dụng".
- Checkbox checked: "Phát ngay lập tức".

Section Nội dung tin nhắn:
- Label: "Nội dung SMS (preview)".
- Box preview nền xám nhạt, text nhỏ:
  "[TerraWatch] CẢNH BÁO KHẨN: Nguy cơ sạt lở CỰC CAO tại Bản Vược, Bát Xát. Hiệu lực 08:00 15/08 - 08:00 16/08/2025. Sơ tán khỏi khu vực sườn dốc. Điểm trú ẩn: Trường THCS Bản Vược (1.8km)."
- Character count: 198/160 — badge vàng cảnh báo dài.

Xác nhận phê duyệt:
- Checkbox: "Tôi xác nhận đã kiểm tra đầy đủ thông tin trước khi phê duyệt".
- Button danger full width: "Xác nhận phê duyệt và phát cảnh báo".
- Button ghost: "Quay lại xem xét".

FRAME W10 — Alert Broadcast Success:
Màn hình sau phê duyệt — overlay success phủ toàn màn hình hoặc modal lớn:
- Icon shield check màu teal, size lớn.
- Heading: "Cảnh báo đã được phát thành công".
- Sub-heading: "#TW-250815-004 · Bản Vược, Bát Xát".
- Stats card nền teal nhạt:
  - 1,248 SMS đã gửi.
  - 837 App Push notification đã gửi.
  - Tổng: 1,248 người nhận.
  - Thời gian phát: 08:35 · 15/08/2025.
- Thông tin điểm trú ẩn: "Trường THCS Bản Vược — 1.8 km, 126 chỗ còn trống".
- Button primary: "Theo dõi phản hồi".
- Button ghost: "Về trang chủ".
- Toast góc trên phải: "Cảnh báo #TW-250815-004 đã phát thành công".
```
