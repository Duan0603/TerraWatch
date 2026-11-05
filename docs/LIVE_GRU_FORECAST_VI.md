# GRU tự dự báo trên dữ liệu cập nhật

## Luồng đang chạy

`Open-Meteo → cache thời tiết PostgreSQL → kiểm tra 168h + 24h + static → AI GRU → lưu kết quả → web`.

- GIS lấy thời tiết theo lịch 60 phút cho các tọa độ đã đăng ký; mặc định bật `LIVE_GRU_ENABLED=true`.
- Đất và độ dốc lấy từ `live_gru_static_features.json`, xuất từ bảng đặc trưng quốc gia theo ô UTM48N 1 km chứa tọa độ. Có sét %, cát %, khối lượng thể tích g/cm³ và độ dốc độ; mỗi biến phải đạt phủ ≥95%.
- 14/14 tọa độ hiện có đủ static. Không tự gán giá trị trung bình cho điểm mới chưa có static.
- GIS gửi đúng 168 giờ cũ → mới, tổng mưa 24h dự kiến và bốn biến static tới AI service. Dữ liệu thời tiết quá 90 phút hoặc thiếu giờ không chạy.
- AI dùng đúng trọng số checkpoint `71101b315e540f7cf292efea82c103236260d790a9a74b56cf469c30addcad8e`. GRU thực hiện bằng NumPy CPU; thứ tự cổng reset/update/new, các bước log1p, chuẩn hóa và hai nhánh giữ nguyên. Không retrain và không dùng công thức điểm thay cho GRU.
- Kết quả chứa `temporal_score`, `spatial_score`, `hazard_score`, `issue_time`, `valid_until`, mã ô, phiên bản mô hình và nguồn đầu vào.
- Nếu AI chưa sẵn sàng, thời tiết vẫn lưu bình thường; tác vụ thử riêng suy luận sau 5 phút. Thử lại không sửa `last_success_at` hoặc `last_attempt_at` của thời tiết.

## Giao diện

Mở bản đồ chính ở `http://localhost:5173`, chọn khu vực và xem **GRU · Dự báo tự động 24 giờ** trong bảng mưa. Trình duyệt đọc cache mỗi phút. Khoảng hiệu lực được hiển thị theo giờ máy người dùng; API giữ timezone UTC rõ ràng. Khi nguồn cũ/lỗi hoặc hết hiệu lực, giao diện đánh dấu kết quả cũ, không gọi nó là dự báo mới.

`/model-demo` vẫn là phát lại lịch sử 2018/2020; không trộn kết quả mới vào chỉ số test cũ.

## Điều kiện khoa học

Người dùng đã yêu cầu chạy thử với nguồn mưa cập nhật hiện có. Nguồn hiện tại là Open-Meteo model estimate, khác IMERG lịch sử và GFS khi train. Khoảng dự báo hiện tại là 24 giờ lăn từ đầu giờ cập nhật, khác mốc 00:00 Việt Nam của tập nghiên cứu. Vì vậy API luôn trả:

```json
{
  "experimental_source_shift": true,
  "experimental_rolling_clock": true,
  "calibrated_probability": false,
  "operational_alert": false
}
```

Điểm 0,8 không có nghĩa khả năng sạt lở 80%. Chưa xác nhận độ chính xác trên dữ liệu cập nhật; các chỉ số test proxy lịch sử không chứng minh chất lượng của luồng khác nguồn này. Điểm mô hình không tự đưa vào hàng đợi cảnh báo hoặc broadcast cho người dân.

## API và triển khai

```text
GET  /api/v1/models/gru/info          (AI service:8001)
POST /api/v1/inference/gru/live       (AI service:8001)
GET  /api/v1/gis/rainfall/live?latitude=...&longitude=...  (gateway:8080)
```

Trình duyệt không gọi suy luận trực tiếp; GIS gọi AI nội bộ theo lịch. Endpoint AI chỉ nhận 168 giá trị và bốn biến static hữu hạn, cùng issue time có timezone. `ready=true` trong kết quả cache nghĩa là đã tính được điểm thử nghiệm, không phải sẵn sàng cảnh báo vận hành.

```bash
docker compose up -d --build
```

Không cần cài PyTorch trong container AI, không cần GPU hoặc API key mới. Thư mục `services/ai-service/models/gru_live` được mount cùng các mô hình hiện có. Nginx route demo đã sửa để không mất cổng Docker.

Tái xuất trọng số/static bằng môi trường nghiên cứu có PyTorch/rasterio và GIS container đang chạy:

```bash
python scripts/export-live-gru.py
```

Script cần bảng static quốc gia local để thêm điểm mới; gói Git đã kèm static của 14 điểm hiện tại. Không cần tệp dữ liệu lớn đó chỉ để chạy 14 điểm đã xuất. Đổi artifact cần khởi động lại AI service để tải lại model cache.

## Kiểm chứng

- 24 trường hợp đối chiếu trực tiếp với PyTorch: sai lệch tối đa temporal `2,39e-7`, spatial `0`, hazard `1,47e-7`; xem `services/ai-service/models/gru_live/parity.json`.
- 4 test AI: tái lập checkpoint, đầu vào mưa thiếu/NaN/âm, static thiếu và chặn weights sai mã băm.
- 12 test GIS: các điều kiện dữ liệu/lịch/retry và các lỗi đã mô tả trong tài liệu mưa.
- Đã có dự báo lưu thật cho 14/14 điểm; không phải chỉ phản hồi giả lập.
- Web build đạt. Chưa xác nhận hiển thị bằng ảnh chụp trình duyệt trong phiên này.
