# Phase 2 — WebGIS Officer Screens (W01 → W06)

> Chạy theo thứ tự W01 → W02 → W04. Mỗi prompt = 1 lần generate.

---

## PROMPT 3 — W01 Dashboard Default

```
Tiếp tục thiết kế TerraWatch theo đúng design system đã thiết lập:
Tone trắng. Primary teal #087B70. Background #F5F8F7. Surface #FFFFFF. Border #DCE5E2.
Font Inter. Màu nguy cơ: Low #22C55E · Medium #EAB308 · High #F97316 · Extreme #EF4444.
Ngôn ngữ tiếng Việt. Thời gian 24h GMT+7. Dữ liệu demo: Bát Xát, Lào Cai.

Thiết kế màn hình WebGIS desktop TerraWatch kích thước 1440×900 px, tone màu trắng.
Tên frame: W01 — Dashboard Default

Bố cục:
1. Top navigation cao 72 px.
2. Sidebar trái rộng 292 px.
3. Bản đồ chiếm toàn bộ phần còn lại.
4. Không mở evidence panel ở trạng thái mặc định.

Top navigation:
- Logo TerraWatch bên trái.
- Logo gồm biểu tượng địa hình màu teal.
- Dưới tên TerraWatch có dòng "GeoSentry Platform".
- Navigation: Giám sát nguy cơ (active) · Cảnh báo (badge đỏ số 1) · Người nhận.
- Bên phải: Badge "Hệ thống trực tuyến" có chấm xanh · Icon chuông có notification dot đỏ · Avatar "NA" · Nguyễn Minh Anh · Vai trò "Cán bộ giám sát".

Sidebar:
- Eyebrow: "TRUNG TÂM ĐIỀU HÀNH".
- Heading: "Giám sát nguy cơ 24h".
- Ô tìm kiếm: "Tìm xã, huyện hoặc tọa độ..." với shortcut "⌘ K".
- Select khu vực: "Huyện Bát Xát, Lào Cai".
- Bộ lọc mức độ rủi ro: Cực kỳ nguy hiểm: 3 · Cao: 8 · Trung bình: 12 · Thấp: 24.
- Filter thời gian: "24 giờ tới".
- Card tổng quan: 47 ô lưới theo dõi · 11 ô cần chú ý · Mưa lớn đang diễn ra · 6 trạm vượt ngưỡng.
- Cuối sidebar: Cài đặt hiển thị · TerraWatch v2.4.0.

Bản đồ:
- Bản đồ địa hình sáng, màu nền xanh xám rất nhạt.
- Hiển thị đường giao thông màu trắng, ranh giới hành chính mảnh.
- Địa danh: Bản Vược · Mường Hum · Quang Kim · Trịnh Tường · Thị trấn Bát Xát.
- Polygon nguy cơ: Extreme đỏ · High cam · Medium vàng · Low xanh lá — opacity 25–35%.
- Border polygon đậm hơn phần fill.

Floating controls:
- Góc trên trái: "Dự báo nguy cơ 24 giờ" · "08:00 15/08 — 08:00 16/08" · GMT+7.
- Góc trên phải: Segmented control "Địa hình / Vệ tinh".
- Bên phải: Zoom in · Zoom out · Định vị.
- Góc dưới trái: Lớp bản đồ · Chú giải nguy cơ (Thấp · Trung bình · Cao · Cực cao).

Marker chính:
- Marker tròn màu đỏ, điểm "92", label "CỰC CAO", icon cảnh báo, pulse animation nhẹ.
- Đặt tại vùng đỏ Bản Vược.
- Thêm 2 marker phản ánh hiện trường màu xanh dương.
```

---

## PROMPT 4 — W02/W03 Risk Cell Selected + Evidence Panel

```
Dựa trên W01 Dashboard Default đã thiết kế. Giữ nguyên Top Navigation, Sidebar, và bản đồ.
Chỉ thêm Evidence Panel 404px slide từ phải. Dùng đúng dữ liệu: ô #LC-BX-042, điểm 92/100, Bản Vược, Bát Xát.
Tone trắng. Primary teal #087B70. Màu nguy cơ Extreme #EF4444.

Tên frame: W02 — Risk Cell Selected

Từ màn hình W01, khi click vào marker nguy cơ 92:
- Mở panel bên phải rộng 404 px, cách mép bản đồ 14 px, bo góc 14 px, nền trắng, shadow mềm.

Header panel:
- Eyebrow đỏ: "Ô lưới #LC-BX-042".
- Heading: "Nguy cơ cực cao".
- Địa điểm: "Bản Vược, Bát Xát, Lào Cai".
- Nút đóng góc trên phải.

Risk Score Card:
- Nền đỏ rất nhạt. Circular progress 92/100. Text "Điểm rủi ro AI".
- Secondary text: "Tăng 18 điểm trong 6 giờ qua". Badge "↑ 24%".

Section lượng mưa:
- Heading: "Lượng mưa tích lũy & dự báo". Unit badge: "mm".
- Biểu đồ cột: 72h trước (màu teal) + vạch "Hiện tại" + dự báo 24h tới (màu đỏ nhạt/pattern chéo).
- Metrics: 24h qua: 186 mm · 72h qua: 324 mm · Dự báo 24h: 142 mm (nền đỏ nhạt).

Section địa hình:
- Heading: "Địa hình & độ dốc". Badge: "DEM 30m".
- Grid 2×2: Độ dốc TB 38.6° (Rất dốc) · Độ dốc max 52.1° (Nguy hiểm) · Độ cao 1,246 m · Chênh địa hình 428 m.

AI Recommendation:
- Nền teal rất nhạt. Icon shield.
- Heading: "Khuyến nghị từ hệ thống".
- Nội dung: "Độ dốc lớn kết hợp mưa kéo dài vượt ngưỡng. Cần thẩm định và phát cảnh báo sơ tán sớm."

Footer sticky:
- Nút danger full width: "Tạo đề xuất cảnh báo khẩn cấp".
- Metadata: "Dữ liệu cập nhật lúc 08:30 · 15/08/2025".
```

---

## PROMPT 5 — W04/W05 Tạo đề xuất + Success State

```
Dựa trên design system TerraWatch (tone trắng, teal #087B70, danger #EF4444).
Modal nằm giữa màn hình 1440×900 trên overlay tối nhẹ có blur.
Dùng dữ liệu: Bản Vược, 03 thôn, 24h, #TW-250815-004.

Tạo flow Officer từ W02, 2 frame:

FRAME W04 — Create Proposal:
Modal tạo đề xuất cảnh báo:
- Tiêu đề: "Tạo đề xuất cảnh báo".
- Phạm vi: 03 thôn tại xã Bản Vược. Thời gian hiệu lực: 24 giờ.
- Mức độ: Cực kỳ nguy hiểm (badge đỏ đã chọn).
- Đề xuất hành động: "Sơ tán khỏi khu vực sườn dốc".
- Textarea ghi chú chuyên môn.
- Checkbox: "Đã đối chiếu dữ liệu mưa và địa hình".
- Checkbox: "Đã kiểm tra phản ánh hiện trường".
- Button Primary: "Gửi đề xuất đến lãnh đạo".
- Button Ghost: "Hủy".

FRAME W05 — Proposal Created:
Success state sau khi gửi:
- Modal success: Icon check màu xanh.
- Title: "Đã gửi đề xuất".
- Message: "Đề xuất #TW-250815-004 đã được chuyển đến lãnh đạo phê duyệt."
- Toast nhỏ góc trên phải màn hình: "Đề xuất đã gửi thành công".
- Trạng thái ô nguy cơ trên bản đồ đổi badge thành: "Đang chờ phê duyệt".
```
