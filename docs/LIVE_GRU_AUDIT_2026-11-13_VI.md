# Điều tra GRU live — 13/11/2026

**Bản đang chạy đã đổi:** theo yêu cầu train demo khẩn, xem [bản GRU elevation v2 đã train và triển khai](GRU_DEMO_TRAINING_2026-11-13.md). Phần dưới giữ bằng chứng điều tra checkpoint v1 và các giới hạn official; không dùng bảng độ nhạy v1 để mô tả v2.

Sau khi Duẫn đồng ý chuẩn bị và chọn ưu tiên recall, xem [kế hoạch retrain/kiểm định](GRU_RETRAINING_PLAN_VI.md), [inventory dữ liệu](gru-training-readiness.json) và [tradeoff proxy validation](gru-proxy-validation-tradeoff.csv). Chưa train: kiểm tra mới xác nhận 0/2.693 mẫu qua điều kiện nhãn/clock và 0/299 mẫu âm verified. Đã lưu raw snapshot đủ 14 điểm bằng script archive riêng, không chỉ summary.

## Cập nhật sau khi mở Docker và lấy main

Đã fetch origin và fast-forward nhánh `demo/landslide-two-branch-model` tới `origin/main` commit `a43778b`. Giữ nguyên các thay đổi audit local; giải quyết xung đột file test bằng cách giữ cả test endpoint mới từ main và hai test audit. Không push hoặc rebuild container. Các đoạn bên dưới mô tả lần kiểm tra trước khi Docker sẵn; giới hạn không đọc được API đã được giải quyết như sau.

- Đọc API thật lúc khoảng **16:30 Việt Nam 13/11**, snapshot `as_of=2026-11-13T09:00:00+00:00` (**16:00 Việt Nam**).
- **Ô 002:** mưa 24h **13,0 mm**, 72h **48,1 mm**, 168h **112,9 mm**, forecast **0 mm**, temporal **0,0000104269**, spatial **0,59856055**. Đây là snapshot mới, không phải phép bổ sung chính xác cho dòng trước đó có 24h = 17,3 mm.
- Đã lưu summary của 14 điểm trong `live-gru-snapshot-summary-2026-11-13.json`. 13/14 có kết quả ready tại lần đọc; Khau Phạ ghi `MODEL_UNAVAILABLE_OR_INVALID_INPUT`. Chưa xác minh nguyên nhân lỗi riêng này, không quy nó cho static hay checkpoint.
- Phân bố snapshot Open-Meteo của 14 điểm: 24h min/median/max = **8,4/13,0/18,8 mm**; 72h = **34,1/48,0/51,4**; 168h = **54,7/112,9/125,5**; peak giờ = **2,9/5,8/8,4**; dry-hour fraction = **0,232/0,271/0,500**. Forecast cả 14 điểm đều **0 mm**, khác median **28,69 mm** của 116 dòng Tier A train bên dưới. Mưa 24h/168h hiện tại chồng lấp đáng kể với phần train đó; không có bằng chứng tổng mưa hiện tại quá lớn so với train. Một thời điểm và các điểm gần nhau không đủ kết luận độ lệch phân bố dài hạn hoặc chọn phép hiệu chỉnh nguồn.
- `LiveRainfallService().locations()` trong DB đang chạy vẫn chỉ trả **14 điểm** hiện có: bốn điểm cấu hình và mười ô Lào Cai. Không có các ô demo Mù Cang Chải hoặc Hoàng Su Phì trong danh sách active; chỉ chạy exporter lúc này sẽ không thêm được các điểm người dùng nhắc tới. Cần danh sách tọa độ/ô active tương ứng từ đúng môi trường demo. Không tự đăng ký tọa độ mới hoặc lấy tâm vùng thay thế.
- Chạy lại **7/7 tests GRU pass trong container AI**, gồm test endpoint mới từ main. Môi trường training local thiếu FastAPI nên không chạy được test endpoint ở đó; đã xác minh lại trong môi trường dịch vụ. `git diff --check` đạt.

Không thay đổi kết luận về checkpoint, không sửa normalization và không phát cảnh báo.

## Kết luận và mức độ chứng cứ

**Đã kiểm chứng:** không tìm thấy lỗi reshape, thứ tự summary, chuẩn hoá hoặc phương trình GRU trong bản NumPy. Bất thường bão hoà và không đơn điệu tái hiện trong checkpoint PyTorch gốc. Chưa có cơ sở sửa runtime hoặc thay chuẩn hoá để làm điểm đẹp hơn. Checkpoint hiện chưa đủ bằng chứng để dùng làm mô hình cảnh báo 24h với Open-Meteo.

**Chưa kiểm chứng:** mức đóng góp của lệch nguồn Open-Meteo/IMERG/GFS, lệch giờ phát hành, MIL, nhãn proxy hoặc overfitting vào từng điểm thực tế. Không thể suy ra nguyên nhân riêng của Bảo Yên hoặc Ô 002 từ vài tổng mưa: GRU còn nhận 168 giá trị theo giờ và peak. Không có chuỗi live thực tế trong phiên này để tái lập những dòng người dùng cung cấp.

## Đối chiếu code thật

- `gpu-training-kit/experiments/vietnam_1km_two_branch_gru/train.py` nhập `build_sequence_rain_tensor` và `build_summary_rain_matrix` từ `gpu-training-kit/train_two_branch_gru_option_b.py`.
- Hai hàm đó dùng `log1p(max(rain,0)).reshape(N,24,7)` và summary theo đúng thứ tự `[sum(last24), sum(last72), sum(all168), max(hour), forecast24]`, rồi `log1p`. Không chuyển vị 7 ngày × 24 giờ. Live từ chối mưa âm thay vì cắt về 0; với đầu vào hợp lệ hai cách tương đương.
- Train tính mean/std sequence trên trục `(0,1)`, giữ 7 kênh; summary trên trục `0`, giữ 5 cột; std có sàn `1e-6`. Live áp dụng trực tiếp các tham số đã lưu, sau đó cast float32 như train. Cả `seq_norm_b`, `sum_norm_b`, spatial trong `model.json` bằng chính xác checkpoint local.
- GIS tạo history từ `as_of-167h` tới `as_of`, theo thứ tự tăng dần; forecast là 24 giờ kế tiếp. `inference_demo.py` cũng ghi rõ `rain_h001..rain_h168` cũ → mới.
- Giới hạn kiểm tra provenance: module `prepare_next24h_windows.py` được train import không có trong checkout này; chưa xác minh độc lập hàm `clocks()` và timestamp band IMERG gốc. Mốc 00:00 Việt Nam của train được tài liệu thí nghiệm mô tả; live dùng cửa sổ lăn. Không kết luận đã audit hết quá trình tạo raster/dataset.
- Train dùng BCEWithLogits trên **max logit từng MIL bag**, không có ràng buộc đơn điệu. Đây là cơ chế có thể cho phép hành vi đã đo, chưa phải bằng chứng rằng MIL là nguyên nhân duy nhất.

## Độ nhạy trước/sau

Giữ static bằng mean train, spatial = 0,4712567. Forecast cố định **0 mm** để tách tác động mưa đã qua. `uniform_7d`: mức X mm/ngày trong cả 7 ngày; hai kiểu còn lại có 6 ngày trước khô và tổng X mm trong 24h cuối hoặc 6h cuối. Đây là dữ liệu tổng hợp, không phải quan trắc.

| Mưa 24h (mm) | Đều cả 7 ngày | Đều 24h cuối | Dồn 6h cuối |
|---:|---:|---:|---:|
| 0 | 0,000000049 | 0,000000049 | 0,000000049 |
| 10 | 0,0000671 | 0,0001000 | 0,0913903 |
| 30 | 0,0752905 | 0,9999989 | 0,8289379 |
| 60 | 0,8163636 | 0,9999949 | 0,4315987 |
| 100 | 0,8802007 | 0,9999336 | 0,1509318 |
| 150 | 0,8966089 | 0,9997173 | 0,0816185 |

**Sau = trước:** không sửa trọng số, preprocessing hay công thức điểm vì chưa tìm thấy lỗi triển khai. Không có cải thiện mô hình được tuyên bố. Với forecast cố định 30 mm, dồn 6h vẫn giảm từ 0,9953493 ở 30 mm xuống 0,6618647 ở 150 mm. Hiện tượng không chỉ do forecast cùng thay đổi.

48 ca đầy đủ, gồm forecast 0, 30 và X, nằm trong `live-gru-sensitivity.csv`. Đối chiếu checkpoint bằng `inference_demo.predict`: sai lệch tối đa temporal `7,1525574e-7`, spatial `0`, hazard `3,3706908e-7`. Sai lệch nhỏ này loại trừ sai khác runtime là lời giải cho các bước nhảy lớn. Parity chỉ kiểm tra triển khai; bằng chứng layout train ở phần trên là riêng biệt.

## Phân bố nguồn mưa

Gateway `http://localhost:8080/api/v1/gis/rainfall/live/map` trả connection refused. Docker, sau khi được cấp quyền đọc, chỉ có container `aiagent-pg`; không có GIS/PostGIS TerraWatch đang chạy. Không truy cập nhầm DB khác, không khởi động luồng tự lấy mưa. Vì vậy **chưa có phân bố Open-Meteo live**, chưa bổ sung được mưa 7 ngày Ô 002 ngày 13/11. Bảng snapshots dùng location_key làm primary key và upsert, nên đọc sau cũng không bảo đảm còn snapshot đúng thời điểm ngày 13/11.

Đã đọc được một phần dữ liệu train: **116 dòng Tier A train** trong `footprint_spatiotemporal_proxy_2693.csv`. Không coi đây là toàn bộ 2.652 MIL bags.

| Đặc trưng (mm) | P25 | Median | P75 | P95 |
|---|---:|---:|---:|---:|
| IMERG 24h, Tier A train | 7,46 | 12,41 | 19,41 | 26,57 |
| IMERG 72h, Tier A train | 26,04 | 49,35 | 65,74 | 70,03 |
| IMERG 168h, Tier A train | 73,46 | 109,28 | 117,67 | 122,00 |
| Peak giờ, Tier A train | 5,68 | 8,46 | 9,56 | 15,92 |
| GFS 24h, Tier A train | 13,44 | 28,69 | 28,69 | 33,30 |

Các mean chuẩn hoá log-summary của **toàn bộ tập dùng fit normalizer** tương ứng `expm1(mean)` = `[16,97; 59,76; 102,04; 11,17; 16,83]` mm. Đây là tâm hình học theo log1p, **không phải trung bình số học**, cũng không phải ngưỡng nguy cơ. Tổng mưa vừa phải trong ví dụ không tự chứng minh out-of-distribution; còn thiếu peak, dry fraction và phân bố toàn chuỗi.

Tập test lịch sử 2.521 dòng đã có 69 temporal ≥0,999 và 1.414 temporal ≤0,001. Bão hoà tồn tại ngoài nguồn Open-Meteo; chưa thể quy toàn bộ hiện tượng cho chuyển nguồn.

Đề xuất: giữ mô hình hiện tại ở chế độ thử nghiệm. Thu thập dữ liệu **cùng ô, cùng issue time**, Open-Meteo as-issued, IMERG và GFS; so các quantile, dry fraction, peak giờ, missingness/latency và z-score từng kênh, phân tầng vùng/mùa. Chỉ thử bias correction nguồn hoặc calibration trên tập validation độc lập; calibration đầu ra không tự sửa xếp hạng mưa cao hơn nhưng điểm thấp hơn. Không thay mean/std bằng thống kê Open-Meteo rồi dùng lại trọng số mà chưa backtest. Nếu cần fit lại, trình kế hoạch trước với dữ liệu, split storm/time/space, baseline, event recall và false alarms/diện tích/ngày; không retrain trong phiên này.

## Static ba vùng

Đã kiểm tra file quốc gia `gpu-training-kit/data/processed/grid_static_features_national/fixed_unit_static_features.csv` có thật và SHA256 khớp registry hiện tại. Registry có **14/14 điểm ready**, gồm hai điểm cấu hình tại Khau Phạ và Dế Xu Phình; điều này không chứng minh các tọa độ demo khác ở Mù Cang Chải đã có static.

Chưa xuất thêm điểm vì exporter lấy danh sách từ `docker exec terrawatch-gis-service`, container này không chạy. Cần **danh sách tọa độ đang hoạt động**: `LiveRainfallService().locations()` (JSON gồm `name`, `latitude`, `longitude`, `key`) hoặc bản xuất `gis_schema.spatial_assessment_units` đang active với centroid WGS84 của cả ba vùng. Cũng cần snapshot/API payload để ghép đúng điểm báo lỗi. Không dùng tâm vùng hoặc tọa độ đoán thay cho điểm thật.

Khi có GIS container và DB đúng môi trường, chạy từ root:

```powershell
gpu-training-kit/.venv/Scripts/python.exe scripts/export-live-gru.py
```

Script đã có logic tra ô UTM48N chứa từng tọa độ, lấy 4 cột `*_mean` và yêu cầu từng `*_valid_area_fraction >= 0.95`. Nếu điểm mới không có hàng tương ứng hoặc thiếu phủ, cần bổ sung extraction DEM/soil vào chính bảng national static; không điền mean train. Chưa chạy exporter vì bước Docker phụ thuộc không thể hoàn tất; không tuyên bố đã bổ sung Hoàng Su Phì.

## File và kiểm thử

- Thêm `scripts/audit-live-gru.py`: sweep 48 ca, assertions miền điểm/cờ an toàn, tùy chọn đối chiếu checkpoint PyTorch.
- Thêm `docs/live-gru-sensitivity.csv` và báo cáo này.
- Thêm 2 test vào `services/ai-service/tests/test_live_gru.py`: layout/summary/normalization với 168 giờ phân biệt và monotonicity cho riêng họ mưa đều cả tuần, forecast cố định. Test sau không chứng minh mọi họ mưa đơn điệu.
- Không đổi API, runtime, GIS, weights, registry hoặc `parity.json`. Không có sửa preprocessing nên không tái xuất parity cũ; kết quả đối chiếu mới ghi riêng bên trên.

Đã chạy thành công:

```powershell
gpu-training-kit/.venv/Scripts/python.exe scripts/audit-live-gru.py --pytorch
$env:PYTHONPATH='services/ai-service'
python -m unittest discover -s services/ai-service/tests -p test_live_gru.py -v
```

6/6 unit tests pass; 48/48 ca parity trong tolerance 1e-5. Không chạy toàn bộ integration stack vì TerraWatch không chạy.

## Mô hình chính thức /api/v1/forecasts

**Chưa thể chốt ngày phát hành hoặc ngưỡng mức nguy cơ.** `MODEL_NOT_RELEASED` vẫn phù hợp với bằng chứng. Đây là đề xuất lịch công việc, không phải cam kết của Duẫn: sau khi nhận đủ archive as-issued, nhãn sự kiện/không-sự-kiện kiểm chứng và danh sách ô, dành 2–3 ngày audit nguồn/thời gian, 5–10 ngày làm việc cho baseline/hiệu chỉnh hoặc retrain được duyệt, 3–5 ngày cho validation độc lập, chọn ngưỡng và kiểm thử vận hành. Ước lượng 2–4 tuần làm việc từ lúc dữ liệu đủ; nếu chưa có archive/nhãn thì chưa có ETA đáng tin.

Các ngưỡng **nghiên cứu** trong `outputs/metrics.json` là 0,26 / 0,50 / 0,65, không phải các ranh giới thấp/vừa/cao đã phát hành. Test proxy lịch sử:

| Ngưỡng | Recall | FP/(FP+TN) | Precision |
|---:|---:|---:|---:|
| 0,26 | 99,71% | 31,03% (675/2175) | 33,82% |
| 0,50 | 87,28% | 20,74% (451/2175) | 40,11% |
| 0,65 | 65,90% | 15,31% (333/2175) | 40,64% |

Các chỉ số này dùng nhãn proxy, `verified_next24h_forecast_evaluation=false`, chưa xác nhận forecast 24h vận hành. Cần thống nhất minimum event recall và maximum false-alarm burden với chủ vận hành **trước** chọn ngưỡng validation; đóng băng ngưỡng trước final test. Không tự đặt chỉ tiêu hoặc đổi chúng thành nhãn nguy cơ chính thức.

Giữ `experimental`, `calibrated_probability=false`, `operational_alert=false`; không gọi điểm là xác suất, không gửi thông báo hay đưa kết quả vào hàng đợi cảnh báo.
