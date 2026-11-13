# Bản GRU demo đã train và triển khai — 13/11/2026

**Model đang dùng:** `terrawatch-gru-mil-elevation-demo-v2`.

Đã train thật trên CPU, 40 epoch, seed 42, 2.652 MIL bags và 7.060 ô spatial. Giữ nguyên nhãn proxy/MIL và split nghiên cứu; không tạo nhãn 24h giả. Nhánh temporal dùng 168 giờ mưa + các tổng/peak và forecast 24h; spatial dùng slope, **elevation**, clay, sand, bulk density. Đã phục hồi các phương trình helper thành `training_support.py` tự chứa, dùng cache 432 mẫu âm có sẵn; không tải thêm dữ liệu.

## File model

- Checkpoint PyTorch mới: `gpu-training-kit/experiments/vietnam_1km_two_branch_gru/outputs_with_elevation/two_branch_gru_1km.pt`
- Trọng số website/API đang dùng: `services/ai-service/models/gru_live/weights.npz`
- Kiến trúc/chuẩn hoá/feature/hash: `services/ai-service/models/gru_live/model.json`
- Parity: `services/ai-service/models/gru_live/parity.json`
- Dữ liệu, tham số train và metrics: `services/ai-service/models/gru_live/training.json`
- Checkpoint SHA256: `23e3e90d582e7aa8194cf00b47760b3ef31eaea7ad4a307576751de87cc0f6c0`

Checkpoint cũ vẫn còn tại `outputs/two_branch_gru_1km.pt`. Backup runtime cũ, fixture và static registry ở `gpu-training-kit/experiments/vietnam_1km_two_branch_gru/deployment_backup_20261113T101308Z/`.

## Kết quả nghiên cứu, không phải nghiệm thu vận hành

| Trên 2.521 test proxy rows | Bản cũ | Bản mới |
|---|---:|---:|
| Recall @0,50 | 87,28% | 94,51% |
| Precision @0,50 | 40,11% | 39,40% |
| F1 @0,50 | 0,5496 | 0,5561 |
| TP / FN @0,50 | 302 / 44 | 327 / 19 |
| FP / TN @0,50 | 451 / 1724 | 503 / 1672 |
| ROC-AUC | 0,8702 | 0,8842 |
| PR-AUC | 0,3604 | 0,4059 |

Validation proxy @0,26: TP37/FN1/FP1/TN17, recall 97,37%. @0,26 trên test proxy: TP346/FN0/FP669/TN1506. Không chọn ngưỡng theo test, không gọi đây là ngưỡng nguy cơ chính thức. Test cũ đã được dùng phân tích trước đó, nên kết quả mới là so sánh demo trên benchmark đã biết, không phải final holdout độc lập.

## Độ nhạy trước/sau

Giữ forecast=0, static cố định. Temporal trên mưa dồn 6h cuối:

| Mưa 24h (mm) | Cũ | Mới |
|---:|---:|---:|
| 0 | 0,000000049 | 0,000011975 |
| 10 | 0,091390 | 0,008869 |
| 30 | 0,828938 | 0,207214 |
| 60 | 0,431599 | 0,424789 |
| 100 | 0,150932 | 0,553688 |
| 150 | 0,081619 | 0,619968 |

Họ burst này đã hết đảo thứ tự trong sweep đã kiểm tra. **Không khẳng định toàn mô hình đơn điệu**: họ mưa đều riêng 24h cuối vẫn giảm nhẹ từ 0,987296 tại 60mm xuống 0,974621 tại 150mm, forecast=0. Chi tiết 48 ca sau train ở `live-gru-sensitivity-after-training.csv`; bảng trước ở `live-gru-sensitivity.csv`. Không tuyên bố đã giải quyết mọi bất thường.

## Tích hợp website và kiểm tra

- API vẫn `POST /api/v1/inference/gru/live`; thêm `static.elevation_m`. Schema cho phép request cũ khi dùng checkpoint cũ, nhưng model mới thiếu elevation trả HTTP422, không điền giá trị mặc định.
- Registry GIS đã xuất lại từ bảng national static: **14/14 điểm đủ cả 5 biến**, mỗi biến coverage ≥95%. GIS gửi toàn bộ `static.values` nên không cần đổi endpoint hoặc cách gọi.
- Đã restart AI, tính lại và lưu **14/14 điểm** trong cache thử nghiệm bằng model mới. Không đẩy vào hàng đợi cảnh báo, không gửi thông báo.
- WebGIS bổ sung độ cao trong mục chi tiết đất/địa hình. Build production và build/recreate riêng container webgis.
- 9 tests AI đạt; 18 tests GIS live-rainfall đạt.
- 51 fixture cases khớp PyTorch: max temporal error `1,1920929e-7`, spatial `1,11e-16`, hazard `5,6184120e-8`. Sweep 48 ca độc lập cũng khớp.
- API thật xác nhận model ID/hash mới; Làng Nủ nhận elevation **444,84m**, temporal **0,067029**, spatial **0,530792**, hazard **0,035579** trên snapshot as_of 09:00UTC ngày 13/11. Đây là kết quả của snapshot đó, không phải điểm cố định của địa điểm.

## Phạm vi có thể trình bày với giảng viên

“Đã huấn luyện bản GRU–MIL thử nghiệm dự báo nguy cơ trong 24h, kết hợp mưa với đất, độ dốc và độ cao; xuất sang NumPy CPU, kiểm tra parity và tích hợp vào WebGIS. Đã so sánh benchmark proxy và kiểm tra API live. Bước tiếp theo là xác minh nhãn 24h, kiểm định lệch nguồn Open-Meteo và chọn ngưỡng theo recall/báo động giả.”

Giữ `experimental=true`, `calibrated_probability=false`, `operational_alert=false`. `/api/v1/forecasts` vẫn `MODEL_NOT_RELEASED` vì chưa đủ evidence cho model official. Chưa có kiểm chứng hiển thị bằng thao tác trình duyệt trong đợt triển khai này; đã kiểm tra build và HTTP/API. Chưa đẩy Git.
