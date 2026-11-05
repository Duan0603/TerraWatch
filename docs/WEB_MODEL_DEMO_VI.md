# Demo mô hình sạt lở trên WebGIS

## Mở giao diện

```bash
cd apps/webgis
npm install
npm run dev
```

Mở `/model-demo` trên địa chỉ Vite đang hiển thị. Phiên làm việc này dùng `http://127.0.0.1:5174/model-demo` để tránh trùng cổng dịch vụ khác.

Có liên kết **Xem demo mô hình trên dữ liệu lịch sử** ở trang đăng nhập và **Demo mô hình** ở thanh điều hướng cán bộ/admin. Route demo chỉ đọc tập dữ liệu nghiên cứu đã xuất bản; các route vận hành vẫn giữ yêu cầu đăng nhập. Demo không gọi API thẩm định, không phát broadcast và không tải checkpoint bằng trình duyệt.

## Kịch bản trình bày

1. Chọn Hướng Hóa → 18/10/2020: xem 686 ô có dữ liệu, trong đó 298 ô dương theo kiểm kê nguồn.
2. Chọn ngưỡng 0,50, sau đó 0,26 hoặc 0,65 để minh họa thay đổi số ô báo dương và precision/recall trên ngày đang xem.
3. Bấm một ô hoặc chọn từ danh sách: xem điểm GRU, điểm địa hình/đất, điểm ghép và đầu vào của ô.
4. Bật/tắt đối chiếu kiểm kê; viền đậm biểu thị **ô chứa điểm kiểm kê**, không phải ranh vết trượt hoặc điểm hiện trường chính xác.
5. Chọn một ngày nền chọn mẫu để minh họa sự khác biệt. Không gọi các ngày này là những ngày đã xác minh không có sạt lở.
6. Tải CSV kết quả đang xem. CSV chứa điểm và nhãn proxy, không phải nhãn đã xác minh.

Đây là **phát lại kết quả thật đã xuất từ checkpoint**. Khi đổi ngưỡng, web chỉ tính lại phân loại theo điểm đã lưu. Khi đổi ngày, web chỉ tải kịch bản lịch sử có sẵn, không gọi dự báo thời tiết mới. Hiện chưa có chức năng suy luận tùy ý cho khu vực/ngày chưa chuẩn bị đầu vào.

## Bản đồ và chế độ ngoại tuyến

- Ô vuông từ `unit_id` EPSG:32648 được chuyển sang kinh/vĩ độ trong bước export; không dùng tọa độ mét làm longitude/latitude.
- Nền OSM cần kết nối mạng; lớp ô của mô hình nằm trong tài nguyên web.
- **Lưới ngoại tuyến** vẽ các ô theo tọa độ UTM thật, không cần WebGL hoặc dịch vụ bản đồ; có thể chọn ô và xem chi tiết.
- Màu dùng các mốc điểm 0,26 / 0,50 / 0,65 để so sánh. Không diễn giải màu thành cấp cảnh báo vận hành đã được chứng nhận.

## Dữ liệu và kiểm tra

`apps/webgis/public/model-demo/index.json` và chín GeoJSON chứa toàn bộ 2.577 dòng validation/test đã xuất: Nha Trang 56, Phong Điền và Hướng Hóa tổng 2.521. Chỉ số của riêng từng kịch bản khác với chỉ số toàn bộ test trong tài liệu mô hình.

Nguồn kết quả:

- `gpu-training-kit/experiments/vietnam_1km_two_branch_gru/outputs/test_predictions_2521.csv`
- `gpu-training-kit/experiments/vietnam_1km_two_branch_gru/outputs/validation_predictions_56.csv`
- Checkpoint SHA256: `71101b315e540f7cf292efea82c103236260d790a9a74b56cf469c30addcad8e`.

Tái xuất từ kết quả nguồn bằng môi trường Python có rasterio:

```bash
python scripts/export-model-demo.py
cd apps/webgis
npm run test:model-demo
npm run build
```

Exporter có thể bổ sung chuỗi tổng mưa bảy khoảng 24 giờ từ bảng nghiên cứu local nếu còn bảng đó; nếu không có, đồ thị này không xuất hiện, các chỉ số đầu vào tổng và điểm mô hình vẫn có. Không lấy dữ liệu ngẫu nhiên để lấp đồ thị.

Ba test kiểm tra mã băm tài nguyên, tọa độ và điểm ghép, đủ số dòng, thống kê toàn test (TP=302, FP=451, TN=1724, FN=44 tại 0,50), tính đơn điệu theo ngưỡng và trường hợp không có mẫu dương. Chưa kiểm tra được bằng ảnh chụp trình duyệt trong phiên này: công cụ Windows Computer Use dừng vì không xác định được URL Chrome đủ chắc chắn. Build/test đạt không thay thế kiểm tra hiển thị ở kích thước thật.
