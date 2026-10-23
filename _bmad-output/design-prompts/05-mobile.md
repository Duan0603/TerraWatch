# Phase 5 — Mobile Citizen & Field Report (M01 → M17)

> Chạy theo thứ tự M01 → M04 → M05 → M08 → M09 → M13 → M14. Mỗi prompt = 1 lần generate.

---

## PROMPT 10 — M01/M02 Mobile Home + Map

```
Tiếp tục thiết kế TerraWatch theo đúng design system đã thiết lập:
Tone trắng. Primary teal #087B70. Background #F5F8F7.
Màu nguy cơ: Low #22C55E · Medium #EAB308 · High #F97316 · Extreme #EF4444.
Font Inter. Ngôn ngữ tiếng Việt. Thời gian 24h GMT+7.
Mobile: 393×852 px. Safe area đầy đủ. Bottom navigation 4 mục.

Tạo 2 frame Mobile Citizen:

FRAME M01 — Mobile Home (No Alert):
Trạng thái bình thường, không có cảnh báo.
- Status bar top (hệ thống).
- Top bar: Logo TerraWatch nhỏ bên trái · Heading "Xin chào, Minh" · Avatar "HM" bên phải.
- Location chip: Icon vị trí · "Bản Vược, Bát Xát" · dropdown.
- Bản đồ nhỏ preview: rộng full, cao ~180px, bo góc 12px, hiển thị polygon xanh lá (Low risk) vùng xung quanh.
- Status card nền xanh lá nhạt:
  - Chấm xanh + "Khu vực của bạn: An toàn".
  - Subtext: "Không có cảnh báo đang hoạt động tại Bản Vược".
  - Timestamp nhỏ: "Cập nhật lúc 06:00 · 15/08/2025".
- Section "Thời tiết & Dự báo":
  - Card ngang: Lượng mưa hôm nay: 12 mm · Dự báo 24h: 18 mm · Mức độ: Thấp.
- Section "Trú ẩn gần nhất":
  - Card: Trường THCS Bản Vược · 1.8 km · 24 phút đi bộ · còn 126 chỗ · Icon mũi tên.
- Quick actions row: Báo cáo hiện trường · Xem bản đồ · Đăng ký nhận cảnh báo.
- Bottom nav: Trang chủ (active) · Bản đồ · Cảnh báo · Hồ sơ.

FRAME M02 — Mobile Map View:
- Status bar.
- Top bar: Nút back · Heading "Bản đồ nguy cơ" · Icon lớp.
- Bản đồ toàn màn hình (full bleed đến bottom nav).
- Floating card ở top: "Huyện Bát Xát · 47 ô lưới theo dõi".
- Legend chip nổi dưới bản đồ: Thấp · Trung bình · Cao · Cực cao.
- Floating button: "Vị trí của tôi" góc dưới phải phía trên bottom nav.
- Bottom nav với "Bản đồ" active.
```

---

## PROMPT 11 — M03/M04 Alert Active + Alert Detail

```
Tiếp tục thiết kế TerraWatch (Mobile 393×852 px, tone trắng, teal #087B70, danger #EF4444).
Dữ liệu: Cảnh báo #TW-250815-004 · Bản Vược · CỰC CAO · hiệu lực đến 08:00 16/08.

Tạo 2 frame:

FRAME M03 — Alert Active State (Home Screen):
Khi có cảnh báo cực nguy hiểm đang hoạt động:
- Status bar thông thường.
- Top bar: Logo TerraWatch · "Xin chào, Minh" · Avatar "HM".
- Location chip: "Bản Vược, Bát Xát".
- Alert Banner (toàn width, nổi bật):
  - Nền đỏ đậm #EF4444.
  - Icon cảnh báo tam giác trắng lớn.
  - Text trắng đậm: "CẢNH BÁO KHẨN CẤP".
  - Sub-text trắng: "Nguy cơ sạt lở CỰC CAO tại khu vực của bạn".
  - Nút trắng outline nhỏ: "Xem chi tiết →".
- Card trú ẩn: Nền đỏ nhạt. Icon nhà. "Sơ tán đến: Trường THCS Bản Vược · 1.8 km". Nút "Chỉ đường" màu teal.
- Card thời tiết thu gọn: 186mm/24h · Dự báo 142mm tới.
- Nút action lớn: "Báo cáo tình hình hiện trường".
- Bottom nav: "Cảnh báo" có badge đỏ số 1.

FRAME M04 — Alert Detail:
Màn hình chi tiết cảnh báo:
- Back arrow + heading "Chi tiết cảnh báo".
- Alert ID: #TW-250815-004.
- Badge đỏ lớn: "CỰC KỲ NGUY HIỂM".
- Khu vực: "Bản Vược, Bát Xát, Lào Cai".
- Thời gian: Phát 08:35 · Hiệu lực đến 08:00 · 16/08/2025.
- Section mưa: 186mm/24h · 324mm/72h · 142mm dự báo.
- Section địa hình compact: Độ dốc 38.6° · Độ cao 1,246 m.
- Hành động được yêu cầu: "Sơ tán khỏi khu vực sườn dốc".
- Card điểm trú ẩn nổi bật: Trường THCS Bản Vược · 1.8 km · 24 phút · 126 chỗ · Nút "Chỉ đường".
- Nút primary: "Báo cáo tình hình của tôi".
- Link nhỏ: "Chia sẻ cảnh báo này".
```

---

## PROMPT 12 — M05/M06/M07/M08 Field Report Flow

```
Tiếp tục thiết kế TerraWatch (Mobile 393×852 px, tone trắng, teal #087B70).
Dữ liệu: Hoàng Văn Minh · GPS 22.6123, 103.8456 · #FR-250815-018.

Tạo flow gửi báo cáo hiện trường — 4 frame:

FRAME M05 — Field Report Form:
- Back arrow + heading "Báo cáo hiện trường".
- GPS auto-detect chip teal: "22.6123° N, 103.8456° E · ±5m" + "Làm mới vị trí".
- Photo section: 2 placeholder tap-to-photo dạng grid 2 cột + "Thêm ảnh".
- Select severity: "Mức độ nghiêm trọng" — options: Nhẹ · Trung bình · Nghiêm trọng · Khẩn cấp.
- Textarea: "Mô tả tình trạng..." với placeholder.
- Checkboxes: "Có người bị thương" · "Đường bị chắn" · "Nhà bị ảnh hưởng".
- Nút Primary full width: "Gửi báo cáo".
- Safe area bottom.

FRAME M06 — Photo Captured:
- Giống M05 nhưng 2 thumbnail ảnh đã chụp hiển thị thay placeholder.
- Badge nhỏ: "2 ảnh · Tap để xem".

FRAME M07 — Sending State:
- Loading spinner overlay nhẹ.
- Text: "Đang gửi báo cáo..." + progress indicator.
- Subtext nhỏ: "Đang tải ảnh (2/2)...".

FRAME M08 — Success:
- Icon check lớn màu teal.
- Heading: "Báo cáo đã gửi thành công".
- Subtext: "Cảm ơn bạn đã phản ánh. Cán bộ sẽ xem xét trong thời gian sớm nhất."
- Report ID: "#FR-250815-018".
- Card teal nhạt: "Vị trí của bạn đã được ghi nhận · 22.6123, 103.8456".
- Nút primary: "Về trang chủ".
- Link nhỏ: "Gửi thêm báo cáo".
```

---

## PROMPT 13 — M09/M10/M11 Offline Mode

```
Tiếp tục thiết kế TerraWatch (Mobile 393×852 px, tone trắng).
Offline mode — không có kết nối mạng. Màu offline: xám #6B7280.

Tạo 3 frame Offline States:

FRAME M09 — Offline Home:
Giống M03 nhưng ở trạng thái offline:
- Top bar thêm chip xám: "Ngoại tuyến · Lưu lúc 08:00".
- Alert Banner giữ nguyên từ cache.
- Card bản đồ: "Đang dùng bản đồ đã lưu · 15/08/2025 08:00".
- Card cảnh báo: badge "Từ cache" màu xám thay badge live.
- Card trú ẩn: vẫn hiển thị đầy đủ từ cache.
- Form báo cáo: vẫn hoạt động (lưu local).
- Offline banner mỏng ở bottom: "Đang ngoại tuyến — dữ liệu từ 08:00 · 15/08".

FRAME M10 — Offline Form Saved:
Sau khi gửi form lúc offline:
- Giống M08 nhưng thay check icon thành clock icon màu xám.
- Heading: "Báo cáo đã được lưu".
- Subtext: "Sẽ tự động gửi khi có kết nối mạng".
- Queue badge: "1 báo cáo đang chờ gửi".

FRAME M11 — Back Online + Sync:
Khi có kết nối trở lại:
- Toast green ở top: "Đã kết nối lại · Đang đồng bộ...".
- Progress bar nhỏ dưới toast.
- Sau sync: Toast "Đã gửi 1 báo cáo đang chờ · #FR-250815-018".
```

---

## PROMPT 14 — M12/M13/M14 Safe Zone + Evacuation Map

```
Tiếp tục thiết kế TerraWatch (Mobile 393×852 px, tone trắng, teal #087B70, danger #EF4444).
Dữ liệu: Trường THCS Bản Vược · 1.8 km · 24 phút · 126 chỗ · Bán kính nguy hiểm 2.5 km.

Tạo 3 frame:

FRAME M12 — Evacuation Map:
Bản đồ chỉ đường sơ tán:
- Full-screen map.
- Top floating card teal: "Đường sơ tán đến Trường THCS Bản Vược".
- Route line màu teal trên bản đồ.
- Vùng nguy hiểm: polygon đỏ opacity 30%.
- Vùng an toàn: polygon xanh lá opacity 20%.
- Pin vị trí user (pulse xanh dương).
- Pin điểm đến: icon nhà xanh.
- Bottom card trắng:
  - Distance: "1.8 km" (lớn) + "24 phút đi bộ".
  - Chỗ trống: "126/150 chỗ còn trống".
  - Nút primary full width: "Bắt đầu chỉ đường".

FRAME M13 — Safe Zone Detail:
Chi tiết điểm trú ẩn:
- Back + heading "Điểm trú ẩn".
- Tên: "Trường THCS Bản Vược".
- Địa chỉ: "Xã Bản Vược, Bát Xát, Lào Cai".
- Stats row: 150 sức chứa · 126 chỗ trống · Mở 24/7.
- Facilities chips: Nước sạch · Y tế · Điện dự phòng · Wifi.
- Map thumbnail nhỏ với pin.
- Nút primary: "Chỉ đường đến đây".
- Nút ghost: "Gọi ban quản lý".

FRAME M14 — Check-in at Safe Zone:
Khi người dùng đến điểm trú ẩn:
- Icon location check xanh lá lớn.
- Heading: "Bạn đã đến nơi an toàn".
- Subtext: "Trường THCS Bản Vược · 08:59 · 15/08".
- Card: "Đã thông báo cho cán bộ giám sát".
- Nút: "Cập nhật tình trạng của tôi".
```

---

## PROMPT 15 — M15/M16/M17 Alert History + Profile

```
Tiếp tục thiết kế TerraWatch (Mobile 393×852 px, tone trắng, teal #087B70).
Dữ liệu: Hoàng Văn Minh · Bản Vược · đã nhận 3 cảnh báo.

Tạo 3 frame cuối Mobile:

FRAME M15 — Alert History:
Tab Cảnh báo trong bottom nav:
- Heading: "Lịch sử cảnh báo".
- Filter tabs: Đang hoạt động (1) · Đã kết thúc · Tất cả.
- Alert active card (nền đỏ nhạt):
  - Badge đỏ "ĐANG HOẠT ĐỘNG".
  - #TW-250815-004 · "Nguy cơ CỰC CAO · Bản Vược".
  - "Phát 08:35 · Hiệu lực đến 08:00 16/08".
  - Nút nhỏ: "Xem chi tiết".
- Alert ended card (nền xám nhạt):
  - Badge xám "ĐÃ KẾT THÚC".
  - #TW-250815-002 · "Nguy cơ TRUNG BÌNH · Quang Kim".
  - "Phát 06:00 · Kết thúc 06:00 14/08".

FRAME M16 — User Profile:
Tab Hồ sơ:
- Avatar circle lớn "HM" + tên "Hoàng Văn Minh".
- Location chip: "Bản Vược, Bát Xát".
- Section "Cài đặt thông báo":
  - Toggle SMS (on): "Nhận cảnh báo qua SMS".
  - Toggle Push (on): "Nhận thông báo app".
  - Toggle bán kính: "2.5 km xung quanh vị trí của tôi".
- Section "Thống kê":
  - 3 cảnh báo đã nhận · 2 báo cáo đã gửi · 0 lần sơ tán.
- Section "Liên hệ khẩn cấp": số điện thoại ban PCTT huyện.
- Nút ghost đỏ: "Đăng xuất".

FRAME M17 — Notification Received:
Push notification khi có cảnh báo mới:
- Notification system banner tại top (iOS/Android style).
- App icon TerraWatch teal.
- Title: "⚠️ Cảnh báo khẩn cấp — TerraWatch".
- Body: "Nguy cơ sạt lở CỰC CAO tại Bản Vược. Xem chi tiết và hướng sơ tán."
- Timestamp: "vừa xong".
- Nút action: "Xem" · "Bỏ qua".
- Phía dưới: màn hình lock screen tối (gradient nhẹ).
```
