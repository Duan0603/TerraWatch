# Gói mô hình và tài liệu demo TerraWatch

Mở [kịch bản thuyết trình](THUYET_TRINH_MO_HINH_VI.md) để xem lời nói 8–10 phút, sơ đồ kiến trúc, thuật toán và câu hỏi mentor.

Gói xuất bản này gồm checkpoint hai nhánh, bộ nạp suy luận độc lập, tám mẫu đầu vào lịch sử, kết quả thử nghiệm và hình minh họa. Không cần tải dữ liệu raster toàn quốc để chạy tám mẫu demo. Gói không chứa toàn bộ dữ liệu và công cụ để huấn luyện lại.

## Chạy sau khi clone repo

Từ thư mục `gpu-training-kit/experiments/vietnam_1km_two_branch_gru`:

```bash
python -m pip install -r requirements-demo.txt
python inference_demo.py --input demo_input_8.csv --output demo_scores.csv
python -m unittest test_inference_demo -v
```

CPU đã được kiểm tra với Python 3.11, NumPy trong môi trường dự án và PyTorch 2.15.0+cpu. Khoảng phiên bản trong requirements là ràng buộc cài đặt, không phải tuyên bố mọi phiên bản đã kiểm thử. Máy CUDA cần bản PyTorch tương thích riêng; kết quả gói hiện tại chỉ được xác minh CPU.

## Các tệp chính

| Tệp | Nội dung |
|---|---|
| `outputs/two_branch_gru_1km.pt` | Checkpoint GRU, chuẩn hóa, Logistic Regression spatial và ngưỡng thử |
| `inference_demo.py` | Nạp hai nhánh, kiểm tra đầu vào và xuất điểm nguy cơ |
| `demo_input_8.csv` | Tám mẫu lịch sử được chọn để kiểm tra chạy; không phải tập đánh giá mới |
| `demo_expected_8.csv` | Điểm tham chiếu từ bảng dự đoán đã xuất |
| `outputs/metrics.json` | Chỉ số thí nghiệm trên nhãn proxy |
| `outputs/test_predictions_2521.csv` | Bảng điểm phục vụ phát lại lịch sử trong app |
| `verification.json` | Kiểm tra nạp checkpoint hai nhánh trên toàn bộ 2.521 dòng test |
| `assets/` | PNG/SVG kiến trúc, MIL, kết quả; mã tạo hình cần matplotlib nếu muốn chạy lại |

Checkpoint giữ nguyên SHA256 `71101b315e540f7cf292efea82c103236260d790a9a74b56cf469c30addcad8e`. Hệ số nhánh spatial trong checkpoint đã làm tròn bốn chữ số từ trước. Loader tái tạo đầu ra với sai số tuyệt đối dưới `1e-4` so với bảng CSV sáu chữ số, không đổi cờ ở ngưỡng 0,50 trên 2.521 dòng đã kiểm tra. Kiểm tra này là kiểm tra tái lập số học, không phải xác nhận chất lượng cảnh báo.

## Dùng trong app demo

Có thể đọc bảng dự đoán đã xuất để hiển thị bản đồ theo `unit_id` và `target_local_date`, hoặc truyền bộ đặc trưng đúng schema vào loader. `unit_id` có dạng `UTM48N_1km_x_y`, trong đó `x,y` là góc dưới trái theo mét EPSG:32648; ô rộng/cao 1.000 m. Muốn vẽ trên bản đồ kinh/vĩ độ phải chuyển hệ tọa độ đúng. Không dùng các con số mét này trực tiếp như longitude/latitude.

Loader không thu thập dữ liệu mới, không kiểm chứng độ phủ raster/thời điểm sẵn có của nguồn và chưa phải API backend. Thời gian, đơn vị đo, nguồn và chất lượng đầu vào do pipeline cung cấp phải đúng trước khi gọi mô hình.

Điểm xuất ra là **điểm nguy cơ nghiên cứu chưa hiệu chỉnh xác suất**. Nhãn là proxy từ kiểm kê; ngày nền không phải các ngày không sạt lở đã xác minh. Chưa đánh giá chuỗi vận hành liên tục hoặc toàn quốc. Trên giao diện cần ghi “Mô hình thử nghiệm nghiên cứu — chưa dùng để cảnh báo thực tế”.
