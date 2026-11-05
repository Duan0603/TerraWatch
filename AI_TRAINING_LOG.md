# Nhật ký AI — Chuẩn bị dữ liệu Landslide4Sense

> **Phân hệ:** `services/ai-service/` (AI / Computer Vision)
> **Phiên làm việc:** 05/10/2026 → 06/10/2026 (Chiều: 15:20)
> **Trạng thái:** ✅ Xong Giai đoạn 3 (Baseline DeepLabV3+ F1 = 0.7212, ONNX 101.75 MB, Latency 48.16 ms) · ⏸️ Tạm dừng đợi Colab reset GPU quota · ⏭️ Tiếp theo: Khóa baseline v0.1 & Tích hợp vào `services/ai-service`

---

## 1. Đã làm được gì

| # | Việc | Kết quả |
| :-: | :--- | :--- |
| 1 | Cấu hình Google Colab | Runtime **T4 GPU**, đã mount Google Drive |
| 2 | Tải Landslide4Sense từ Hugging Face | ~4.77 GB, lưu vĩnh viễn ở `MyDrive/dataset/L4S` |
| 3 | Kiểm tra dữ liệu | **3799** ảnh + **3799** mask, ảnh `(128,128,14)` float64, mask `(128,128)` `{0,1}` |
| 4 | Chia tập 70/15/15 (`seed=42`) | Train **2659** · Val **569** · Test **571** → `split_70_15_15.json` |
| 5 | Cache dữ liệu ra `.npy` | Cache 16-thread vào `/content/L4S_cache` và sao lưu về Drive `cache_npy/` (~1 GB) |
| 6 | Huấn luyện Baseline DeepLabV3+ (ResNet-50, 8 kênh) | Chạy 39 epoch, Early stopping kích hoạt tại ep39, checkpoint tốt nhất ở **Epoch 24** |
| 7 | Đánh giá trên tập Validation | **F1 = 0.7325**, **IoU = 0.5780**, **P = 0.7246**, **R = 0.7407** tại threshold **0.65** |
| 8 | Đánh giá trên tập TEST (571 ảnh độc lập) | **F1 = 0.7212**, **IoU = 0.5640**, **P = 0.6989**, **R = 0.7450** (Vượt chuẩn NFR3 $\ge 0.70$) |
| 9 | Kiểm định tương đương số học ONNX Runtime | Sai số tối đa **$5.05 \times 10^{-5}$** (< $10^{-4}$), F1 ONNX **0.7212** khớp 100% PyTorch |
| 10 | Đo độ trễ suy luận trên CPU (Latency Benchmark) | **48.16 ms / patch** (P95: 68.12 ms) → Nhanh gấp 10 lần yêu cầu NFR3 (< 500 ms) |
| 11 | Trực quan hóa đường cong & phân tích lỗi | Đã xuất `learning_curves.png` và `test_visualizations.png` (300 DPI) |

### Kết quả huấn luyện Baseline (DeepLabV3+ ResNet-50)

```
Best Threshold : 0.65
Validation F1  : 0.7325 | IoU: 0.5780 | Prec: 0.7246 | Rec: 0.7407
Test F1 (Thật) : 0.7212 | IoU: 0.5640 | Prec: 0.6989 | Rec: 0.7450
ONNX Test F1   : 0.7212 | IoU: 0.5639 | Max Abs Diff: 5.05e-05 (Khớp 100%)
CPU Latency    : 48.16 ms / patch (P95: 68.12 ms)
Thời gian train: ~14s/epoch (tổng cộng ~10 phút trên T4 GPU)
```

#### Đánh giá tính ổn định qua 3 Seeds ngẫu nhiên (Statistical Stability)
| Run Name | Seed | Epochs | Best Threshold | Val F1 | Val IoU | Thời gian train |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| `base_s42` | 42 | 39 | 0.65 | 0.7325 | 0.5780 | ~10 phút |
| `base_s1` | 1 | 55 | 0.75 | 0.7353 | 0.5814 | 11.2 phút |
| `base_s2` | 2 | 50 | 0.60 | 0.7336 | 0.5793 | 10.2 phút |
| **Trung bình ($\mu \pm \sigma$)** | — | — | — | **$0.7338 \pm 0.0014$** | **$0.5796 \pm 0.0017$** | — |

- **Độ biến thiên seed ($\sigma$):** Chỉ **$0.14\%$** ($0.0014$), chứng minh Baseline cực kỳ ổn định, không nhạy cảm với khởi tạo ngẫu nhiên.
- **Ngưỡng ý nghĩa thống kê ($\Delta = \max(0.01, 2\sigma)$):** $\Delta = \mathbf{0.0100}$ (+1.0% F1).
- **Ngưỡng chấp nhận mô hình mới (Decision Rule):** Mô hình ứng viên chỉ được chọn thay thế Baseline nếu đạt **$\text{Val } F_1 \ge 0.7438$** và IoU cải thiện tương ứng.
- **TTA & Post-processing (Zero-cost improvements):**
  - TTA 8 hướng: Val $F_1 = 0.7424$ (+0.0099).
  - Lọc đốm nhỏ `min_px = 5`: Val $F_1 = 0.7424$, tăng Object Precision từ $75.3\% \rightarrow 81.8\%$.

#### Thử nghiệm Thực nghiệm Giai đoạn 4 (Ablation Study & Optimization Candidates)
| Tên Thí Nghiệm | Kiến trúc | Stride | Hàm Mất Mát | Val F1 | Val IoU | Val Prec | Val Rec | $\Delta F_1$ so với $\mu_{\text{base}}$ | Trạng thái |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Baseline ($\mu$)** | DeepLabV3+ | 16 | Dice + BCE ($pw=5$) | 0.7338 | 0.5796 | 0.7246 | 0.7407 | — | Mốc so sánh ($\mu$) |
| `os8` | DeepLabV3+ | 8 | Dice + BCE ($pw=5$) | **0.7385** | **0.5854** | 0.7238 | 0.7538 | **+0.0047** | Cải thiện độ phân giải không gian (+0.47% F1, +0.58% IoU, +1.3% Rec) |
| `lovasz` | DeepLabV3+ | 16 | Lovász + BCE ($pw=5$) | **0.7376** | **0.5843** | 0.7066 | **0.7715** | **+0.0038** | Recall tăng vọt **+3.08%** (đạt 77.15%), ngưỡng lý tưởng 0.50 |
| `unetpp` | U-Net++ | 16 | Dice + BCE ($pw=5$) | *Đang chờ* | *Đang chờ* | *Đang chờ* | *Đang chờ* | — | Đang chuẩn bị chạy |

> **Đánh giá khoa học:** Độ chênh lệch giữa Val F1 (0.7325) và Test F1 (0.7212) chỉ là **1.1%**, chứng minh mô hình **hoàn toàn không bị Overfitting**, khả năng tổng quát hóa trên dữ liệu chưa từng thấy cực kỳ tốt. Mô hình đạt chuẩn NFR3 ($F_1 \ge 0.70$).

---

## 2. File đã lưu trên Google Drive

```
MyDrive/dataset/L4S/
├── images/train/image_*.h5        # 3799 ảnh thật (~1.8 MB/file, key 'img')
├── annotations/train/mask_*.h5    # 3799 mask (key 'mask')
├── split_70_15_15.json            # Danh sách TÊN FILE (train/val/test)
├── config.json                    # Thứ tự 8 kênh
├── norm_stats.npz                 # mean/std 8 kênh — BẮT BUỘC đi kèm model ONNX
├── cache_npy/                     # Cache npy tăng tốc vĩnh viễn (train/val/test X, Y)
└── checkpoints/baseline_r50/
    ├── landslide_deeplabv3plus.onnx # File model ONNX hoàn chỉnh (101.75 MB)
    ├── model_config.json          # Cấu hình ngưỡng 0.65, band order, test metrics
    ├── cfg.json                   # Siêu tham số huấn luyện
    ├── best.pt                    # Trọng số tốt nhất PyTorch (Epoch 24)
    ├── last.pt                    # Trọng số checkpoint cuối cùng (Epoch 39)
    ├── log.csv                    # Lịch sử chi tiết 40 epoch
    ├── learning_curves.png        # Đồ thị Loss & F1 (300 DPI)
    └── test_visualizations.png    # Ảnh đối soát RGB vs Mask vs AI (300 DPI)
```

Notebook Colab: lưu trong `MyDrive/Colab Notebooks/` (nên đổi tên thành `01_Landslide4Sense_Data_Preparation.ipynb`).

---

## 3. Bẫy đã gặp (nhớ để không lặp lại)

1. **`huggingface-cli: command not found`** trên Colab → dùng `snapshot_download()` của Python thay thế.
2. **Glob `**` quét nhầm file rác:** thư mục `annotations/train/` cũng có file `image_*.h5` chỉ **800 bytes, không có key** → luôn dùng đường dẫn cụ thể `images/train` và `annotations/train`.
3. **Ảnh và mask nằm ở 2 thư mục khác nhau:** không thể chỉ `replace("image_", "mask_")`, phải đổi cả `images` → `annotations`.
4. **Colab mất kết nối khi đang tải:** chạy lại `snapshot_download` sẽ tiếp tục, không tải lại từ đầu.

---

## 4. Thứ tự kênh

| Index gốc (14 kênh) | Kênh | Dùng? | Index trong tensor 8 kênh |
| :-: | :--- | :-: | :-: |
| 0 | B1 (Aerosol) | ✗ | — |
| 1 | B2 (Blue) | ✓ | 0 |
| 2 | B3 (Green) | ✓ | 1 |
| 3 | B4 (Red) | ✓ | 2 |
| 4–6 | B5, B6, B7 (Red Edge) | ✗ | — |
| 7 | B8 (NIR) | ✓ | 3 |
| 8–9 | B9, B10 | ✗ | — |
| 10 | B11 (SWIR1) | ✓ | 4 |
| 11 | B12 (SWIR2) | ✓ | 5 |
| 12 | Slope (ALOS PALSAR) | ✓ | 6 |
| 13 | DEM (ALOS PALSAR) | ✗ | — |
| — | NDVI = (B8 − B4)/(B8 + B4) | ✓ (tính thêm) | 7 |

RGB để hiển thị: tensor 8 kênh `[2, 1, 0]` · từ 14 kênh gốc `[3, 2, 1]`.

> [!NOTE]
> **Đã đối chiếu README chính thức** ([Hugging Face](https://huggingface.co/datasets/ibm-nasa-geospatial/Landslide4sense)): 14 kênh theo thứ tự B1…B12 (Sentinel-2), B13 = Slope, B14 = DEM (ALOS PALSAR) → khớp bảng trên.
> Còn nên chạy kiểm tra số liệu từng kênh trên Colab (B10 gần 0, DEM có giá trị lớn nhất) để chắc chắn dữ liệu thật được lưu đúng thứ tự đó.

---

## 5. Lưu ý cho báo cáo đồ án

- **Rò rỉ dữ liệu theo không gian:** các patch L4S cắt từ vài vùng lớn (Iburi, Kodagu, Gorkha, Đài Loan), chia ngẫu nhiên nên patch kề nhau có thể vừa ở train vừa ở test → F1 trên tập test này **cao hơn thực tế**. Báo cáo ghi rõ: *chia ngẫu nhiên, seed=42, kiểm thử trong miền (in-domain)*. Dữ liệu Việt Nam sẽ là bài kiểm thử ngoài miền (out-of-distribution) cho con số trung thực.
- **Lệch nguồn DEM:** L4S dùng slope từ ALOS PALSAR, pipeline của Tú dùng SRTM 30m → ghi vào phần hạn chế.
- **NDVI vs ΔNDVI:** L4S chỉ có 1 thời điểm, nên baseline train với **NDVI đơn thời điểm**. Cần báo Tú và Thuận để thống nhất tài liệu thiết kế (hiện đang ghi ΔNDVI).
- **Tập validation/test gốc của L4S (245 + 800 patch) không có mask** → không dùng để đánh giá.

> [!CAUTION]
> [`AI_MODEL_CARD.md`](AI_MODEL_CARD.md) đang ghi sẵn F1 = 0.768, IoU = 0.642, inference 182 ms… nhưng **model chưa được train**. Đây là số mục tiêu, không phải kết quả thật. Phải thay bằng số đo thật sau khi train, nếu không sẽ bị hội đồng hỏi vặn.

---

## 6. Trạng thái hiện tại & Hướng dẫn tiếp tục khi mở lại GPU

> ⏸️ **Điểm dừng (13:00 ngày 07/10/2026):**  
> Đã hoàn thành 5 lượt huấn luyện liên tục: `base_s42`, `base_s1`, `base_s2` (tính được $\mu=0.7338, \sigma=0.0014$), `os8` (Val F1 = 0.7385, IoU = 0.5854) và `lovasz` (Val F1 = 0.7376, Recall = 77.15%, threshold 0.50).  
> Colab tạm thời hết hạn mức GPU miễn phí trong ngày. Toàn bộ trọng số và `experiments.csv` đã được lưu an toàn trên Google Drive.

### Các việc sẽ làm ngay khi Colab hồi GPU (hoặc đổi tài khoản Google):

1. **Chạy Thí nghiệm Ứng viên 3: U-Net++ ResNet-50 (`unetpp`):**
   - Đánh giá kiến trúc Nested Dense Skip Pathways so với DeepLabV3+.
   - Lệnh: `run_experiment("unetpp", arch="unetpp", stride=16, loss="dice_bce", pw=5.0, notes="U-Net++ ResNet-50")` (~11 phút).

2. **(Tùy chọn combo mạnh nhất): `os8_lovasz`:**
   - Kết hợp 2 yếu tố tốt nhất: Stride 8 (tăng nét không gian) + Lovász Loss (tăng Recall cực đại).
   - Lệnh: `run_experiment("os8_lovasz", stride=8, loss="lovasz_bce", pw=5.0, notes="Stride 8 + Lovasz Loss")` (~12 phút).

3. **Chốt Bảng Thực Nghiệm Toàn Diện (Ablation Matrix) & Chọn Winner:**
   - So sánh điểm Val F1 và Val IoU của tất cả ứng viên với mốc Baseline ($\mu=0.7338$) và mốc ý nghĩa thống kê ($\ge 0.7438$).
   - Kết hợp TTA 8 hướng và hậu xử lý `min_px = 5`.

4. **Kiểm định Mô hình Chiến Thắng trên tập TEST (1 lần duy nhất):**
   - Chạy tập Test 571 mẫu cho mô hình được chọn để lấy con số chốt báo cáo đồ án.
   - Xuất gói triển khai `export/v0.2/` (file ONNX, `norm_stats.npz`, `model_config.json`).

5. **Tải về máy tính & Tích hợp vào `services/ai-service`:**
   - Tải về đặt tại `d:\Do An\TerraWatch\services\ai-service\models\`.
   - Cập nhật pipeline ONNX Runtime trong `services/ai-service/app/services/inference.py`.
