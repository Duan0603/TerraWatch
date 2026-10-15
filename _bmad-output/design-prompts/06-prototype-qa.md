# Phase 6 — Prototype Flows & QA (Chạy sau cùng)

> Chỉ chạy sau khi TẤT CẢ screens W01–W10 và M01–M17 đã hoàn thành.

---

## PROMPT 17 — WebGIS Prototype Flows (A + B + C)

```
Tiếp tục thiết kế TerraWatch. Tất cả screens WebGIS đã hoàn thành.
Thiết lập Prototype connections trong Figma cho page 08 — Prototype Flows.

Tạo flow diagrams và prototype connections cho 3 WebGIS flows:

FLOW A — Officer Risk Assessment Flow:
Tên: "Flow A: Cán bộ đánh giá và đề xuất cảnh báo"
Nodes:
W01 Dashboard → (click marker Bản Vược) → W02 Risk Cell Selected → (click "Tạo đề xuất") → W04 Create Proposal → (click "Gửi") → W05 Proposal Created → (auto/back) → W01

Annotations cho mỗi bước:
- W01→W02: "Officer phát hiện nguy cơ cao trên bản đồ"
- W02→W04: "Kiểm tra evidence panel, xác nhận nguy cơ"
- W04→W05: "Điền form và gửi đề xuất lên lãnh đạo"
- W05→W01: "Quay về dashboard, ô nguy cơ đổi trạng thái"

FLOW B — Admin Approval Flow:
Tên: "Flow B: Lãnh đạo phê duyệt và phát cảnh báo"
Nodes:
W07 Review Queue → (click card #TW-250815-004) → W08 Review Detail → (click "Phê duyệt") → W09 Approve Modal → (confirm) → W10 Broadcast Success → W07

Annotations:
- W07→W08: "Lãnh đạo xem hàng chờ, chọn đề xuất khẩn"
- W08→W09: "Xem đầy đủ thông tin, quyết định phê duyệt"
- W09→W10: "Xác nhận và phát cảnh báo đến 1,248 người"
- W10→W07: "Theo dõi phản hồi, xử lý đề xuất tiếp theo"

FLOW C — Field Report Integration:
Tên: "Flow C: Tích hợp phản ánh hiện trường"
Nodes:
W01 Dashboard → (click tab Reports) → W13 Field Reports → (click #FR-250815-018) → W14 Linked State → W02

Annotations:
- "Officer kiểm tra phản ánh từ hiện trường"
- "Liên kết phản ánh với ô nguy cơ đang đánh giá"
```

---

## PROMPT 18 — Mobile Prototype Flows (D + E)

```
Tiếp tục thiết kế TerraWatch. Tất cả screens Mobile đã hoàn thành.
Thiết lập prototype connections cho 2 Mobile flows.

FLOW D — Citizen Alert Response Flow:
Tên: "Flow D: Người dân nhận và phản hồi cảnh báo"
Nodes:
M17 Push Notification → (tap Xem) → M03 Alert Active → (tap Xem chi tiết) → M04 Alert Detail → (tap Chỉ đường) → M12 Evacuation Map → (tap Bắt đầu) → M13 Safe Zone → M14 Check-in

Annotations:
- "Nhận push notification khẩn cấp"
- "Xem trạng thái cảnh báo tại home"
- "Đọc chi tiết nguy cơ và hành động"
- "Xem route sơ tán đến điểm trú ẩn"
- "Check-in khi đến nơi an toàn"

FLOW E — Field Report Submission:
Tên: "Flow E: Gửi báo cáo hiện trường"
Nodes:
M03 Alert Active → (tap Báo cáo) → M05 Field Report Form → (chụp ảnh) → M06 Photo Captured → (tap Gửi — online) → M07 Sending → M08 Success → M03
Offline branch: M05 → (tap Gửi — offline) → M10 Saved Offline → (restored) → M11 Back Online → M03

Annotations:
- "Người dân mở form từ alert screen"
- "Chụp ảnh và mô tả tình trạng"
- "Gửi ngay (online) hoặc lưu chờ (offline)"
```

---

## PROMPT 20 — Edge Cases & QA Review

```
Tiếp tục thiết kế TerraWatch. Tất cả screens và flows đã hoàn thành.
Tạo các edge case frames trong page 09 — Edge Cases & System States.

Tạo frame grid 4 cột cho các trạng thái đặc biệt:

ROW 1 — Loading States:
- WebGIS map loading: skeleton loader cho bản đồ + spinner.
- Sidebar data loading: skeleton cards.
- Mobile home loading: shimmer effect.
- Evidence panel loading: skeleton cho chart và metrics.

ROW 2 — Empty States:
- WebGIS no alerts: illustration nhỏ + "Không có cảnh báo đang hoạt động" + subtext.
- Admin no proposals: "Hàng chờ trống · Tất cả đề xuất đã được xử lý".
- Mobile no reports: "Chưa có phản ánh trong khu vực của bạn".
- Field reports empty: "Chưa có báo cáo hôm nay".

ROW 3 — Error States:
- API error: toast đỏ "Lỗi kết nối server · Thử lại".
- GPS unavailable (mobile): "Không thể xác định vị trí · Nhập thủ công".
- Photo upload failed: inline error dưới photo section.
- Forecast data unavailable: badge xám "Dữ liệu dự báo không khả dụng".

ROW 4 — Boundary / Extreme Cases:
- Score 100/100: Extreme đỏ + pulse animation.
- 0 rainfall: hiển thị "-" thay vì "0 mm" để tránh nhầm lẫn.
- Long place name: truncation với tooltip.
- Many recipients (10,000+): format "10.2K người nhận".

ROW 5 — System States:
- Maintenance mode: overlay banner "Hệ thống bảo trì · 02:00 - 04:00".
- Partial degraded (AI offline): badge vàng "AI tạm thời không khả dụng · Dùng ngưỡng thủ công".
- Data stale >1 hour: warning chip vàng "Dữ liệu cũ hơn 1 giờ".
- Session expired: modal "Phiên đăng nhập hết hạn · Đăng nhập lại".

Sau đó tạo 1 frame QA Checklist trong page 00:
- Title: "QA Checklist — TerraWatch Design".
- Checklist nhóm theo: Màu sắc · Typography · Spacing · Responsive · Accessibility · Data consistency · Flow completeness.
- Mỗi item: checkbox · mô tả ngắn.
```
