# Phase 4 — Field Reports WebGIS (W13 → W16)

> Chạy theo thứ tự W13 → W14. Mỗi prompt = 1 lần generate.

---

## PROMPT 9 — W13/W14/W15/W16 Field Reports

```
Tiếp tục thiết kế TerraWatch theo đúng design system đã thiết lập:
Tone trắng. Primary teal #087B70. Background #F5F8F7. Surface #FFFFFF. Border #DCE5E2.
Font Inter. Ngôn ngữ tiếng Việt. Thời gian 24h GMT+7.
Dữ liệu demo: Hoàng Văn Minh · GPS 22.6123, 103.8456 · Report #FR-250815-018.

Thiết kế Field Reports screens cho WebGIS desktop 1440×900 px. Tạo 2 frame:

FRAME W13 — Field Reports Panel (Officer View):
Màn hình W01 Dashboard nhưng Sidebar hiển thị danh sách phản ánh hiện trường.

Sidebar — Reports Feed:
- Eyebrow: "PHẢN ÁNH HIỆN TRƯỜNG".
- Heading: "8 báo cáo hôm nay".
- Filter tabs: Tất cả · Chưa xử lý (3 — badge đỏ) · Đã xử lý.
- Report card 1 (selected, border teal):
  - Avatar circle "HM" xanh dương.
  - Tên: "Hoàng Văn Minh".
  - ID: "#FR-250815-018 · 08:15".
  - Location tag: "Bản Vược · 22.6123, 103.8456".
  - Preview text nhỏ: "Đất đá bắt đầu sụt lún tại sườn đồi phía...".
  - Badge: "Có 2 ảnh đính kèm".
  - Badge trạng thái vàng: "Chưa xử lý".
- Report card 2:
  - "#FR-250815-017 · Mường Hum · 07:43".
  - Badge xanh: "Đã xử lý".
- Report card 3:
  - "#FR-250815-016 · Trịnh Tường · 07:12".
  - Badge vàng: "Chưa xử lý".

Bản đồ:
- Pin xanh dương tại các vị trí báo cáo.
- Pin selected (#FR-250815-018) có ring ngoài, popup nhỏ: "HM · 08:15".

Report Detail Panel (404 px từ phải):
- Header: "Phản ánh #FR-250815-018".
- Người gửi: "Hoàng Văn Minh · 08:15 · 15/08/2025".
- GPS: "22.6123° N, 103.8456° E · Độ chính xác ±5m".
- Link nhỏ: "Xem trên bản đồ".
- Ảnh đính kèm: 2 thumbnail ảnh hiện trường cạnh nhau.
- Nội dung báo cáo: Text box nền xám nhạt, tiếng Việt mô tả tình trạng sạt lở.
- AI Analysis card teal nhạt: "Vị trí nằm trong ô #LC-BX-042 — Nguy cơ Cực cao. Phù hợp với dự báo hiện tại."
- Footer: Nút ghost "Liên kết với cảnh báo" + Nút primary "Đánh dấu đã xử lý".

FRAME W14 — Linked to Alert State:
Trạng thái sau khi Officer liên kết report với alert:
- Report card trong sidebar đổi badge thành "Đã liên kết — #TW-250815-004".
- Detail panel hiển thị connection: Icon link · "Đã liên kết với cảnh báo #TW-250815-004".
- Toast: "Phản ánh đã được liên kết thành công".
```
