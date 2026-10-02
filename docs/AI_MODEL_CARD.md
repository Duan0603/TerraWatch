# AI Model Card: GeoSentry Landslide Segmentation

> **Mô tả kỹ thuật mô hình trí tuệ nhân tạo phát hiện sạt lở đất**  
> Tuân theo chuẩn **Model Cards for Model Reporting (Mitchell et al.)**.

---

## 1. Tổng Quan Mô Hình (Model Overview)

- **Tên mô hình**: `GeoSentry-DeepLabV3+-Landslide4Sense`
- **Kiến trúc mạng**: DeepLabV3+ với Backbone ResNet-50 / EfficientNet, kết hợp Atrous Spatial Pyramid Pooling (ASPP).
- **Nhiệm vụ (Task)**: Semantic Segmentation (Phân đoạn điểm sạt lở nhị phân: Nền vs Điểm sạt lở).
- **Framework đóng gói**: PyTorch 2.2 -> Xuất ONNX (Open Neural Network Exchange) -> Thực thi tối ưu qua ONNX Runtime C++/Python.

---

## 2. Dữ Liệu Huấn Luyện (Dataset & Inputs)

### A. Bộ dữ liệu chuẩn: **Landslide4Sense Benchmark**
- **Quy mô**: Hơn 3,799 mẫu ảnh vệ tinh đa phổ Sentinel-2 kích thước $128 \times 128$ pixel.
- **Phân bổ địa lý**: Các vùng núi có nguy cơ sạt lở cao toàn cầu.
- **Nhãn chuẩn**: Mặt nạ Ground Truth (Binary Mask) được các chuyên gia viễn thám dán nhãn thủ công.

### B. Cấu hình kênh đầu vào (8-Channel Tensor):
| Kênh | Tên dải phổ | Bước sóng / Bản chất | Ý nghĩa nhận diện sạt lở |
| :---: | :--- | :--- | :--- |
| **Ch 0** | B02 (Blue) | 490 nm | Phản xạ quang học nền |
| **Ch 1** | B03 (Green) | 560 nm | Phản xạ thảm thực vật khỏe |
| **Ch 2** | B04 (Red) | 665 nm | Hấp thụ chlorophyll mạnh |
| **Ch 3** | B08 (NIR) | 842 nm | Cực kỳ nhạy với sinh khối thực vật |
| **Ch 4** | B11 (SWIR 1) | 1610 nm | Độ ẩm của đất và thảm phủ |
| **Ch 5** | B12 (SWIR 2) | 2190 nm | Nhận diện khoáng vật và đất trống |
| **Ch 6** | NDVI | Chỉ số thực vật chuẩn hóa | Phát hiện sự suy giảm đột ngột thảm phủ |
| **Ch 7** | SLOPE | Độ dốc địa hình (từ SRTM DEM) | Đánh giá nguy cơ trọng lực trượt lở đất |

---

## 3. Độ Chính Xác & Chỉ Số Đánh Giá (Performance Metrics)

Mô hình được đánh giá trên tập kiểm thử độc lập (Independent Test Set):

| Chỉ số (Metric) | Yêu cầu phi chức năng (NFR3) | Kết quả đạt được | Trạng thái |
| :--- | :---: | :---: | :---: |
| **F1-Score** | $\ge 0.70$ | **$0.768$** | ✅ Vượt chỉ tiêu |
| **Intersection over Union (IoU)** | - | **$0.642$** | ✅ Đạt chuẩn |
| **Precision** | - | **$0.795$** | ✅ Giảm cảnh báo giả |
| **Recall** | - | **$0.743$** | ✅ Hạn chế bỏ sót |
| **Tốc độ Inference (CPU Intel i7)** | $< 500$ ms / patch | **$182$ ms** | ✅ Tối ưu |
| **Tốc độ Inference (GPU RTX 3060)** | $< 100$ ms / patch | **$26$ ms** | ✅ Siêu tốc |

---

## 4. Hàm Mất Mát & Huấn Luyện (Loss Function & Training)

Để giải quyết vấn đề mất cân bằng mẫu nghiêm trọng (diện tích sạt lở chiếm $< 2\%$ diện tích toàn ảnh):
$$\mathcal{L}_{\text{total}} = \mathcal{L}_{\text{Focal}} + \lambda \mathcal{L}_{\text{Dice}}$$
- **Focal Loss** ($\gamma=2, \alpha=0.25$): Tập trung học các điểm biên khó phân loại.
- **Dice Loss**: Tối ưu trực tiếp chỉ số F1/IoU trên hình học mặt nạ.
- **Bộ tối ưu**: AdamW, Learning rate ban đầu $1 \times 10^{-4}$, Cosine Annealing scheduler.
