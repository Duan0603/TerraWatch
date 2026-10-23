# Phase 1 — Nền tảng & Design System

> Chạy 2 prompt này TRƯỚC TIÊN. Không cần prefix thêm vào.

---

## PROMPT 1 — Master Design System

```
Thiết kế một hệ thống cảnh báo sớm nguy cơ sạt lở đất có tên "TerraWatch", tên kỹ thuật "GeoSentry Platform".

Mục tiêu của hệ thống:
- Dự báo nguy cơ sạt lở đất trong 24 giờ tới.
- Trực quan hóa nguy cơ trên bản đồ WebGIS.
- Hỗ trợ cán bộ chuyên môn kiểm tra bằng chứng.
- Hỗ trợ lãnh đạo phê duyệt và phát cảnh báo SMS/App Push.
- Hỗ trợ người dân nhận cảnh báo, xem vùng nguy hiểm và gửi phản ánh hiện trường.
- Hỗ trợ hoạt động trong điều kiện mất kết nối mạng.

Đối tượng sử dụng:
1. Officer – cán bộ giám sát và phân tích nguy cơ.
2. Admin – lãnh đạo phê duyệt và phát cảnh báo.
3. Citizen – người dân nhận cảnh báo và xem bản đồ an toàn.
4. Field Officer/Citizen – người gửi báo cáo hiện trường.

Nền tảng:
- WebGIS desktop: 1440×900 px.
- Mobile application: 393×852 px.
- Thiết kế đồng nhất giữa WebGIS và Mobile.

Phong cách:
- Tone màu trắng.
- Hiện đại, sạch sẽ, chuyên nghiệp.
- Mang cảm giác Emergency Operation Center.
- Nhiều khoảng trắng nhưng vẫn có mật độ thông tin cao.
- Bản đồ là khu vực nội dung chính.
- Không sử dụng dark theme.
- Không sử dụng gradient trang trí quá mạnh.
- Hạn chế màu sắc ngoài bảng màu thương hiệu và bảng màu nguy cơ.
- Tránh cảm giác giống dashboard tài chính hoặc admin template phổ thông.
- Giao diện phải thể hiện độ tin cậy, khẩn cấp và tính vận hành thực tế.

Ngôn ngữ:
- Toàn bộ nội dung giao diện bằng tiếng Việt.
- Thời gian sử dụng định dạng 24 giờ.
- Múi giờ GMT+7.
- Dữ liệu demo tại huyện Bát Xát, tỉnh Lào Cai.

Typography:
- Sử dụng Inter hoặc SF Pro Display.
- Heading đậm, rõ ràng.
- Nội dung chính từ 13–14 px trên desktop.
- Label và metadata từ 10–12 px.
- Tiêu đề dashboard từ 20–24 px.
- Tiêu đề modal từ 22–24 px.
- Sử dụng chữ in hoa có letter spacing cho eyebrow label và trạng thái.

Màu thương hiệu:
- Primary teal: #087B70.
- Primary dark: #075F57.
- Primary light: #E4F4F1.
- Text primary: #172524.
- Text secondary: #687977.
- Background: #F5F8F7.
- Surface: #FFFFFF.
- Border: #DCE5E2.

Màu nguy cơ:
- Low: #22C55E.
- Medium: #EAB308.
- High: #F97316.
- Extreme: #EF4444.
- Danger dark: #C92F2F.
- Danger light: #FFF0F0.

Bo góc:
- Button: 8–10 px.
- Card: 10–12 px.
- Panel lớn và modal: 14–16 px.
- Status chip: 4–6 px.

Đổ bóng:
- Sử dụng shadow mềm, nhẹ.
- Card nổi trên bản đồ có shadow rõ hơn nhưng không quá đậm.
- Modal có shadow lớn và backdrop blur nhẹ.

Icon:
- Sử dụng icon outline đồng nhất.
- Stroke khoảng 1.75–2 px.
- Không sử dụng emoji.
- Icon cần có: bản đồ, cảnh báo, chuông, vị trí, lớp bản đồ, người dùng, báo cáo, lượng mưa, địa hình, đồng hồ, lịch, SMS, Push Notification, xác nhận.

Bố cục WebGIS:
- Top navigation cao khoảng 72 px.
- Sidebar trái rộng khoảng 292 px.
- Bản đồ chiếm toàn bộ không gian còn lại.
- Evidence panel xuất hiện từ bên phải, rộng khoảng 404 px.
- Floating control đặt trên bản đồ.
- Modal phê duyệt nằm giữa màn hình.

Bố cục Mobile:
- Safe area đầy đủ.
- Bản đồ chiếm phần lớn màn hình.
- Status card nổi phía trên bản đồ.
- Bottom navigation 4 mục.
- Primary action đủ lớn để thao tác bằng một tay.
- Cảnh báo nguy hiểm phải dễ nhận biết nhưng không gây rối mắt.

Tạo component system:
- Button: Primary, Secondary, Danger, Ghost, Disabled.
- Icon Button.
- Text Field.
- Textarea.
- Select Field.
- Toggle.
- Checkbox.
- Status Badge.
- Risk Badge.
- Toast.
- Modal.
- Bottom Sheet.
- Map Marker.
- Risk Polygon.
- Navigation Item.
- Mobile Bottom Navigation.
- Offline Status Chip.
- Empty State.
- Loading State.
- Error State.
```

---

## PROMPT 2 — File Structure + Demo Data Reference

```
Tạo các Page trong Figma theo cấu trúc:

00 — Cover & Documentation
01 — Foundations
02 — Components
03 — WebGIS Officer
04 — WebGIS Admin
05 — WebGIS Field Reports
06 — Mobile Citizen
07 — Mobile Field Report
08 — Prototype Flows
09 — Edge Cases & System States

Tạo component system đầy đủ trong page 02 — Components bao gồm tất cả components đã định nghĩa.

Sau khi tạo xong, tạo thêm một "Demo Data Reference" frame trong page 00 với toàn bộ dữ liệu demo sau để dùng nhất quán trong toàn bộ thiết kế:

Khu vực: Xã Bản Vược, huyện Bát Xát, tỉnh Lào Cai
Ô nguy cơ: #LC-BX-042
Điểm rủi ro: 92/100 — Cực kỳ nguy hiểm
Mưa 24h qua: 186 mm | Mưa 72h qua: 324 mm | Dự báo 24h tới: 142 mm
Độ dốc trung bình: 38.6° | Độ dốc tối đa: 52.1° | Độ cao: 1,246 m | Chênh địa hình: 428 m
Phạm vi: 03 thôn Nậm Chạc, Sơn Hà, Bản Vược — bán kính 2.5 km
Người nhận: 1,248 tổng | 1,248 SMS | 837 App Push
Thời gian phát: 08:00 ngày 15/08/2025 GMT+7
Hiệu lực đến: 08:00 ngày 16/08/2025 GMT+7
Officer: Nguyễn Minh Anh
Người gửi phản ánh: Hoàng Văn Minh — GPS: 22.6123, 103.8456
Alert ID: #TW-250815-004 | Report ID: #FR-250815-018
Điểm trú ẩn: Trường THCS Bản Vược — 1.8 km, 24 phút đi bộ, còn chỗ 126 người
```
