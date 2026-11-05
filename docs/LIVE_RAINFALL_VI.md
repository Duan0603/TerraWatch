# Mưa cập nhật tự động trong ứng dụng

## Chức năng hiện có

- GIS service tự khởi động tác vụ lấy Open-Meteo khi container chạy; mặc định cập nhật mỗi 3.600 giây, tối thiểu 900 giây.
- Phạm vi là các ô `is_active=true` trong `gis_schema.spatial_assessment_units` và bốn tọa độ sự cố hiện có trong `app/config/live_rainfall_locations.json`. Hiện có 14 tọa độ riêng biệt, **không phải phủ toàn Việt Nam**.
- Thống kê 24/72/168 giờ đã qua và 24 giờ tới, căn đầu giờ UTC; chỉ cộng khi đủ đúng số giờ. Thiếu giờ, giá trị null, âm hoặc không hữu hạn không được tự đổi thành 0.
- Lưu cả chuỗi giờ, chất lượng, thời gian lấy và lưới nguồn vào `gis_schema.live_rainfall_snapshots`. Khi nguồn lỗi, giữ payload thành công trước đó và ghi lỗi an toàn. Dữ liệu cũ hoặc lần cập nhật lỗi được đánh dấu trên web.
- Khóa advisory PostgreSQL tránh nhiều worker cùng lấy. Mỗi điểm có `last_attempt_at` để tránh gọi lặp trong khoảng cấu hình. GET từ trình duyệt chỉ đọc cache, không kích hoạt yêu cầu mới tới nhà cung cấp.
- Bảng mưa mới nằm trên bản đồ chính của cán bộ/admin và công dân, thay cho bảng số mẫu trước đây. Web đọc lại mỗi 60 giây, hiển thị nguồn và thời điểm lấy thành công.

## Khóa API

Demo/nghiên cứu phi thương mại dùng endpoint công khai Open-Meteo, hiện không cần khóa. Nếu có gói thương mại, thêm ở file `.env` cạnh `docker-compose.yml` tại thư mục gốc dự án để Docker Compose truyền cấu hình vào GIS service (hoặc đặt các biến môi trường tương ứng khi chạy GIS service trực tiếp):

```dotenv
RAINFALL_AUTO_ENABLED=true
RAINFALL_REFRESH_SECONDS=3600
OPEN_METEO_API_KEY=
```

Khi khóa được cung cấp, mã tự dùng `customer-api.open-meteo.com`. Không thêm khóa vào `VITE_*`, mã React hoặc GitHub. Không cần Google Maps API hay Earth Engine project cho luồng này.

Tham khảo nguồn chính thức: https://open-meteo.com/en/docs. `precipitation` là tổng trong giờ trước timestamp. `past_days` là dữ liệu mô hình đã qua, **không phải đo trực tiếp tại trạm**; `fetched_at` là thời gian ứng dụng lấy dữ liệu, không phải thời gian khởi tạo mô hình khí tượng. Vì API tổng hợp không xác nhận run time riêng, `provider_run_issued_at` được giữ null.

## API đọc

```text
GET /api/v1/gis/rainfall/live/status
GET /api/v1/gis/rainfall/live?latitude=21.845&longitude=104.085
```

Qua gateway local: `http://localhost:8080`. GET điểm chưa có cache trả 404; database chưa sẵn sàng trả 503. Không gọi mạng nguồn cho tọa độ tùy ý từ người dùng. Điểm mới cần đăng ký trong assessment units hoặc cấu hình GIS. Điểm được đối chiếu tọa độ làm tròn bốn chữ số, không lấy dữ liệu điểm gần khác rồi gắn tên điểm đang xem.

Schema bảng snapshot được tạo idempotent khi tác vụ bắt đầu, nằm trên volume PostgreSQL hiện có. Không cần xóa volume hoặc reset database. Các worker bị tắt có thể đọc cache; `enabled=false` trong status có nghĩa không có lịch lấy ở worker đó.

## Khởi động

```bash
docker compose up -d --build
```

Mở bản đồ chính ở `http://localhost:5173`; chọn khu vực để xem bảng mưa cập nhật. Nút đọc lại trong bảng chỉ đọc snapshot; không ép nhà cung cấp cập nhật. `/model-demo` vẫn phát lại dữ liệu lịch sử, không trộn mưa hiện tại vào thí nghiệm 2018/2020.

## Giới hạn với mô hình GRU

Checkpoint GRU được huấn luyện bằng IMERG 168h + GFS 24h. Open-Meteo không được âm thầm coi là nguồn tương đương. API trả `gru_inference.ready=false` với lý do khác nguồn; giao diện không tạo điểm dự báo sạt lở mới từ chuỗi này.

Để chạy GRU theo nguồn huấn luyện cần tích hợp IMERG và GFS đúng phiên bản/độ trễ, đồng bộ đất/độ dốc cho từng ô và kiểm tra dữ liệu có sẵn tại giờ phát hành. Nguồn NASA có thể yêu cầu tài khoản Earthdata/PPS; dữ liệu trạm Việt Nam cần API/quyền truy cập từ đơn vị sở hữu. Không yêu cầu gửi mật khẩu trong chat. Những tài khoản đó chưa phải điều kiện để dùng chức năng mưa Open-Meteo vừa thêm.

## Kiểm tra đã thực hiện

- 10 unittest cho ranh giờ, thiếu timestamp, thiếu dự báo, NaN, đơn vị, timestamp trùng, tọa độ, bỏ qua cache mới, khóa worker, lọc lỗi chứa bí mật và ô DB thiếu tên/tọa độ không chặn các điểm hợp lệ.
- Kiểm tra PostgreSQL thật: ghi một snapshot thử, mô phỏng lỗi nguồn, xác nhận payload và `last_success_at` trước đó còn nguyên; dọn đúng dòng thử sau kiểm tra.
- API thật: 14/14 điểm có payload thành công, không lỗi; mẫu Mù Cang Chải đủ 168 giờ lịch sử và 24 giờ dự báo.
- Web build đạt. Chưa xác nhận bố cục bằng ảnh chụp trình duyệt trong phiên này.
