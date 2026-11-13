# Chuẩn bị huấn luyện và kiểm định GRU 24h — 13/11/2026

**Cập nhật sau yêu cầu train demo khẩn:** đã train 40 epoch và triển khai bản thử nghiệm có elevation. Xem [kết quả và đường dẫn model](GRU_DEMO_TRAINING_2026-11-13.md). Các điều kiện chưa đạt cho mô hình official bên dưới vẫn giữ nguyên; chúng không ngăn người dùng chạy nghiên cứu/demo khi đã chấp nhận giới hạn.

## Cập nhật: đã thêm độ cao vào đầu vào training

Theo yêu cầu mới của Duẫn, `experiments/vietnam_1km_two_branch_gru/train.py` đã chọn 5 biến spatial theo thứ tự: **slope_deg, elevation_m, clay_pct, sand_pct, bulk_density_g_cm3**. Mưa vẫn đi qua nhánh temporal như trước. Trainer đọc elevation từ dữ liệu thật, từ chối thiếu/nonfinite thay vì impute, fit mean/std trên spatial train và xuất elevation cùng prediction rows. Đầu ra mặc định đổi thành `outputs_with_elevation` để không ghi đè artifact cũ. File trainer trước đây bị gitignore; đã thêm ngoại lệ cho đúng file này để thay đổi có thể review/đưa vào Git.

Inventory vừa chạy xác nhận đủ 5 biến hữu hạn trên 2.693 temporal-cohort rows và 7.060 spatial-training rows. Độ cao lần lượt trong khoảng 2,27–2.430,01 m và 85,08–2.770,88 m. Đây là kiểm tra giá trị, chưa tự chứng nhận coverage DEM hay chất lượng nhãn. Công cụ readiness đối chiếu trực tiếp danh sách feature trong source trainer với inventory.

**Chưa train và chưa triển khai mô hình có độ cao.** Checkpoint live vẫn dùng 4 biến static. Artifact mới có 5 biến không được xuất vào live cho tới khi đã train/kiểm định và cập nhật đồng bộ nguồn elevation GIS + schema AI; không được tự gán trọng số elevation bằng 0 hoặc dùng mean thay thế. API hiện tại chưa đổi.

Kiểm tra sau thay đổi: 13 readiness self-checks đạt; inventory/danh sách feature trainer khớp; source trainer biên dịch Python đạt. Chưa chạy full training vì nhãn/availability và các module nguồn vẫn thiếu như liệt kê bên dưới.

## Quyết định và bằng chứng

Duẫn chọn **ưu tiên recall**, sẽ cung cấp chỉ tiêu cụ thể. Chưa đặt minimum event recall, giới hạn báo động giả hoặc ngưỡng các mức nguy cơ. **Chưa train/fine-tune/calibrate**, chưa thay normalizer hay checkpoint live.

Đã chạy `scripts/check-gru-training-readiness.py` trên dữ liệu thật, lưu hash nguồn trong `gru-training-readiness.json`:

| Kiểm tra | Kết quả |
|---|---|
| Cohort proxy | 2.693 mẫu; 0 nhãn `verified_next24h_label` |
| Qua điều kiện nhãn và thời điểm | 0 mẫu |
| Availability timestamps của history/forecast trong cohort | Thiếu cả 2.693 mẫu |
| Xác minh nhãn và gán ô | Không có bằng chứng True trong cohort; thiếu cột không chứng minh gán sai |
| Metadata khoảng history/forecast | Không phát hiện lệch 168h/24h; chưa xác minh provenance từng band raster |
| GFS local-day | 23 ngày, 0 `historical_available_at`; initialization trước target cả 23 ngày |
| GFS background | 6 ngày, 0 `historical_available_at`; initialization trước target cả 6 ngày |
| Queue mẫu âm hiện có | 299 hàng; 0 `verified_non_event=True` |
| Nhóm phụ thuộc provisional vượt split của cohort này | 0; chưa chứng minh độc lập mọi storm/spatial block của toàn bộ MIL bags |
| Code tái lập training | Thiếu `prepare_next24h_windows.py`, `prepare_grid_rain.py`, `join_local_day_gfs.py` |

Audit sẵn có cũng ghi 449 source-positive unit-days nhưng 0 verified next24h labels. 12.963 occurrence-time estimates không phải nhãn thời gian được xác minh. Không tự chuyển proxy hoặc estimate thành ground truth.

Trong `experiments/vietnam_1km_two_branch_gru/train.py`, 116 Tier A train rows dùng target temporal **`is_storm_day_window`**, không dùng `proxy_binary_label`. Do đó 25 ô nền ngày bão cũng có temporal target 1; nhánh spatial tách susceptibility. Đây là thiết kế đã đọc trong code, chưa chứng minh nguyên nhân duy nhất của bão hoà/đảo thứ tự theo mưa. Temporal không phải nhãn sạt lở từng ô.

Kết luận **HOLD_OFFICIAL_TRAINING**: thiếu bằng chứng dữ liệu, không phải thiếu GPU. Công cụ readiness là inventory nhãn/clock, không tự chứng nhận đủ điều kiện phát hành.

## 1. Chuẩn hoá nhãn và lịch phát hành

Mẫu official là `(unit_id, issue_time)`, target **[issue_time, issue_time+24h)**. Phân biệt occurrence time với publication/report time; giữ evidence, reviewer, uncertainty thời gian và hình học.

- Nhãn chỉ biết ngày Việt Nam chỉ dùng khi target trùng ngày đó (00:00 Việt Nam → 00:00 hôm sau), đồng thời có evidence sự kiện/gán ô. Không nhân nhãn ngày vào mọi rolling hourly window.
- Official rolling hourly cần occurrence interval đủ hẹp. Khoảng bất định cắt biên target giữ UNKNOWN hoặc xử lý theo protocol interval riêng; không lấy giờ/ngày mưa lớn nhất làm giờ/ngày sự kiện.
- Nhãn âm cần observation coverage cả ô và cả target, detection limit, reviewer và nguồn. Không có báo cáo không thành nhãn 0. Tái sử dụng `data/processed/non_event_review/review_queue.csv`, không tạo queue trùng.
- Nhãn đa-ngày giữ riêng cho nghiên cứu MIL, không đưa vào official validation/test như nhãn supervised đơn-ngày.

Bảng official cần các trường và evidence sau:

| Nhóm | Dữ liệu bắt buộc |
|---|---|
| Định danh | sample_id, unit_id, grid_version, issue_time, target_start/end |
| Nhãn | verified_next24h_label, target_label_verified, source evidence, reviewer, occurrence interval, mechanism |
| Gán ô | source_unit_assignment_verified, hình học/coordinate uncertainty và evidence |
| Mẫu âm | verified_negative_observation, observation_start/end, coverage/detection evidence |
| History | 168 timestamp/giá trị mm, provider/product/version, available_at và evidence |
| Forecast | run_initialization, forecast_available_at và evidence, valid_start/end, 24 giá trị hourly precipitation |
| Static | 4 biến, grid_version, từng coverage fraction, hash nguồn |
| Split | storm/dependence_group, spatial_block, split, lý do loại/purge |

Điền cờ True không thay thế review bằng chứng. Công cụ hiện tại không kiểm định đầy đủ toàn bộ hợp đồng dữ liệu trên.

## 2. Chuẩn bị mưa nguồn vận hành

Đã thêm/chạy `scripts/snapshot-live-gru.py`: lưu **14/14 raw payload**, kiểm tra 168h+24h, tổng mưa, số hữu hạn, timestamp nhận và SHA256. Bản đầu:

`gpu-training-kit/data/forecast_archive/open_meteo_live/20261113T093743410873Z/manifest.json`

Raw payload nằm trong thư mục nghiên cứu local đã gitignore. Script chỉ GET API; không chạy inference, không ghi DB, không cài lịch nền. Có thể gọi lại theo giờ:

```powershell
python scripts/snapshot-live-gru.py
```

**Clock cần xử lý trước backtest:** live làm tròn `as_of` đầu giờ nhưng `fetched_at` nằm sau đó. Receipt nhận lúc 16:28 không chứng minh input đã có lúc 16:00. Cache hiện `provider_run_issued_at=null`, `model_selection=best_match`. Cần ghi decision time thực, available time và nguồn/run đã chọn; không giả định initialization = publish time. Chưa sửa clock hoặc API live trong đợt chuẩn bị này.

Không backfill forecast bằng mưa thực tế/reanalysis. IMERG backtest cần đúng product/version và latency vận hành; không dùng bản hiệu chỉnh về sau như thể đã có tại issue time. Đuôi history chưa có vì latency cần protocol thiếu/lag được kiểm định, không điền 0.

Đã đọc tài liệu hiện hành:

- [Historical Forecast API](https://open-meteo.com/en/docs/historical-forecast-api): archive khoảng từ 2022, ghép các giờ đầu của nhiều run. Không tự coi là trọn forecast 24h từ cùng issue.
- [Single Runs API](https://open-meteo.com/en/docs/single-runs-api): trọn run theo initialization; hiện ghi ECMWF IFS từ 03/2024, đa số model khác từ 02/04/2026. Ví dụ `run=2025-09-01...` trên trang không bảo đảm mọi model có archive từ ngày đó.

Vì vậy không thể thay trực tiếp forecast cho cohort 2017–2020 bằng các API này. Cần cohort mới có archive và nhãn tương ứng, hoặc nguồn archive khác có provenance/availability cho giai đoạn cũ. Chưa tải hàng loạt hay dùng dịch vụ trả phí.

## 3. Split và nghiệm thu ưu tiên recall

Áp dụng khi có cohort verified; không random split từng dòng:

1. Nhóm cùng storm/đợt mưa và các source inventories liên quan. Mọi ô/ngày của một nhóm chỉ thuộc một split.
2. Giữ temporal test ở giai đoạn tương lai và một spatial holdout; công bố số storm/events/coverage từng vùng. Chưa chọn cutoff hoặc tỷ lệ split khi chưa đủ nhóm độc lập.
3. Purge các mẫu quanh biên để history 168h + target 24h không giao nhau; kiểm tra interval thật, không chỉ khoảng cách ngày/hằng số 8 ngày. Kiểm tra cả MIL bags nếu dùng pretraining.
4. Fit normalizer và bias correction trên train. Chọn hyperparameters/calibration/threshold trên validation; freeze trước final test. Test proxy cũ đã được xem nên không phải final holdout độc lập cho mô hình mới.
5. Đánh giá rainfall/terrain baseline trước; so checkpoint hiện tại và GRU mới nếu retrain có cơ sở. Calibration đầu ra không sửa được xếp hạng đảo, fine-tune không mặc nhiên là đủ.

Sau khi Duẫn cung cấp **minimum event recall** và **maximum false-alarm burden**, trên validation chọn ngưỡng có burden thấp nhất trong số đạt cả hai yêu cầu. Không có ngưỡng đạt thì báo không đạt, không hạ yêu cầu sau khi xem test.

Các chỉ số bắt buộc:

- Event recall theo event IDs, tránh đếm một event nhiều lần vì nhiều ô/giờ. Freeze quy tắc match không gian/thời gian, uncertainty và lead time.
- Cell-window recall, precision, PR-AUC và confusion matrix là chỉ số phụ, không thay event recall.
- False alerts / 100 km² / ngày, chỉ trong vùng/thời gian giám sát đầy đủ. Báo thêm FPR = FP/(FP+TN) và false-alarm ratio = FP/(TP+FP); ba đại lượng khác nhau.
- Confidence intervals theo storm/event-group resampling, không coi các ô gần nhau độc lập. Công bố missed events, latency và lỗi nguồn.
- Stress tests nhiều kiểu phân bố giờ, forecast cố định, tuần mưa và burst; báo mọi vi phạm đơn điệu đáng kể. Không chỉ chọn họ uniform đang pass.
- Brier/reliability chỉ khi đánh giá calibrated output phù hợp. Hiện giữ cách gọi **điểm**, `calibrated_probability=false`.

### Đường đánh đổi có sẵn, chỉ proxy validation

Đã tạo `gru-proxy-validation-tradeoff.csv` từ đúng **56 hàng validation**; không chọn ngưỡng từ test và không chọn ngưỡng official.

| Ngưỡng nghiên cứu | Proxy recall | Proxy FPR | TP/FN | FP/TN |
|---:|---:|---:|---:|---:|
| 0,26 | 97,37% | 5,56% | 37/1 | 1/17 |
| 0,50 | 73,68% | 5,56% | 28/10 | 1/17 |
| 0,65 | 63,16% | 5,56% | 24/14 | 1/17 |

38 ô dương proxy không phải 38 sự kiện độc lập; chỉ một storm-day validation ở Nha Trang. Không dùng các số này để bảo đảm recall ở ba vùng phía Bắc hoặc chọn ngưỡng official.

## 4. Huấn luyện và phát hành khi đủ dữ liệu

Hiện 0 mẫu qua điều kiện nhãn/clock nên chưa train. Khi đã có nhãn/nguồn hợp lệ và chỉ tiêu recall/burden:

1. Freeze manifest/split, kiểm tra provenance, khôi phục ba module thiếu và pin môi trường. Checkpoint cũ không lưu input hashes bên trong; thí nghiệm mới phải lưu manifest đầy đủ.
2. Chạy baseline rồi quyết định bias correction/calibration hay GRU retrain. Ghi dữ liệu, epochs/budget và output directory riêng trước khi chạy; không ghi đè `models/gru_live`.
3. So validation/stress tests; nếu đạt thì freeze model/threshold và đánh giá final holdout mới. Ranh giới nhiều mức nguy cơ dựa trên nhu cầu hành động/burden từng mức, không mặc định ba ngưỡng 0,26/0,50/0,65.
4. Chỉ xuất artifact/parity mới và tích hợp `/api/v1/forecasts` khi đủ evidence release. Không tự gửi thông báo hoặc thay luồng phê duyệt.

**Chưa có ETA phát hành đáng tin khi nhãn/archive chưa đủ.** Ước lượng 2–4 tuần làm việc trước đó chỉ tính từ lúc dữ liệu phù hợp đã đủ. Giữ `MODEL_NOT_RELEASED` và các cờ experimental/calibrated_probability=false/operational_alert=false.

## Tái lập và phần còn thiếu

```powershell
python scripts/check-gru-training-readiness.py --self-test
python scripts/check-gru-training-readiness.py --output docs/gru-training-readiness.json --proxy-curve docs/gru-proxy-validation-tradeoff.csv
python scripts/snapshot-live-gru.py --self-test
python scripts/snapshot-live-gru.py
```

13 readiness self-checks và 5 archive self-checks đạt. Đây là kiểm tra công cụ, không xác minh nhãn thay chủ dữ liệu.

Cần từ chủ dữ liệu/đơn vị vận hành: chỉ tiêu recall và burden; review nhãn/mẫu âm; archive availability; tọa độ active của các ô Mù Cang Chải/Hoàng Su Phì thiếu. Retrain lại nhãn proxy không tạo ra các bằng chứng còn thiếu này.
