# Kế Hoạch Epics & Stories Chi Tiết — Thành Viên 1: DUẪN
## Vai trò: AI / Computer Vision Engineer
**Phân hệ đảm nhiệm:** `services/ai-service/`  
**Dự án:** GeoSentry (TerraWatch) - Hệ Thống Viễn Thám & AI Cảnh Báo Sớm Sạt Lở Đất  

---

### 1. Mục Tiêu & Trách Nhiệm Kỹ Thuật
- Xây dựng dataset (Landslide4Sense Benchmark / Bijie Dataset).
- Tiền xử lý dải phổ 8 kênh: `[B02, B03, B04, B08, B11, B12, NDVI, SLOPE]`.
- Huấn luyện, fine-tune và đánh giá mô hình Semantic Segmentation (DeepLabV3+, U-Net, ResU-Net) đạt $F_1 \ge 0.768$, $\text{IoU} \ge 0.642$.
- Xuất và đóng gói mô hình sang **ONNX Runtime** (`landslide_deeplabv3plus.onnx`) chạy suy luận siêu tốc ($< 300\text{ ms}$).
- Xây dựng thuật toán **xếp hạng mức nguy cơ sạt lở (Risk Scoring)** dựa trên độ dốc, diện tích, độ tin cậy và khoảng cách tới khu dân cư (`low` / `medium` / `high` / `extreme`).
- Tích hợp Redis Event Listener để tự động chạy suy luận ngầm (batch inference).

---

### 2. Lộ Trình 5 Tuần Tốc Lực Của Duẫn

```
Tuần 1: Setup ONNX Runtime, tải Landslide4Sense dataset, viết tiền xử lý chuẩn hóa 8 kênh tensor.
Tuần 2: Fine-tune DeepLabV3+ / U-Net, đo đạc F1-Score & IoU, export model sang ONNX format.
Tuần 3: Thay thế mock code trong inference.py bằng ONNX Runtime thật; viết thuật toán xếp hạng mức nguy cơ.
Tuần 4: Viết Redis event listener trong ai-service để tự động chạy batch inference ngầm.
Tuần 5: Benchmark độ trễ suy luận (< 300 ms), tối ưu Docker container ai-service, phối hợp thông luồng.
```

---

### 3. Danh Sách Epics & User Stories Đảm Nhiệm

#### Story 3.1: Pretrained DeepLabV3+ ONNX Model Loading (Tuần 3)
As an AI Engineer,  
I want `ai-service` to load a pretrained DeepLabV3+ ONNX model and preprocess raw input into an 8-channel normalized float tensor,  
So that inference executes efficiently on CPU with GPU fallback.  
**Acceptance Criteria:**
- Model weights (`models/landslide_deeplabv3plus.onnx`) loaded on service startup via ONNX Runtime.
- Input tensor shapes `[1, 8, 128, 128]` normalized per Landslide4Sense benchmark mean/std.
- Cold-start test verifies model passes dummy tensor inference in $< 300\text{ ms}$.

#### Story 3.2: 8-Channel Multi-Spectral Inference & Binary Mask Segmentation (Tuần 3)
As an AI Engineer,  
I want the AI engine to predict pixel-level landslide probabilities from the 8-channel tensor `[B2, B3, B4, B8, B11, B12, NDVI, SLOPE]`,  
So that scars of slipped earth are accurately segmented.  
**Acceptance Criteria:**
- Sigmoid activation outputs probability mask $[0.0, 1.0]$ per pixel.
- Thresholding ($\ge 0.5$) generates clean binary segmentation mask.
- Benchmark validation achieves $F_1 \ge 0.70$ và $\text{IoU} \ge 0.60$ on test patch set.

#### Story 3.3: Polygonization: Converting Raster Mask to PostGIS MultiPolygon GeoJSON (Tuần 3 - Phối hợp cùng Tú)
As a GIS Developer,  
I want the AI service to convert binary raster masks into smooth vector polygons (GeoJSON MultiPolygon) with coordinate georeferencing,  
So that detected landslide bodies can be rendered on WebGIS and stored in PostGIS.  
**Acceptance Criteria:**
- Raster-to-vector polygonization (using `rasterio.features.shapes` / `shapely`).
- Polygon coordinates correctly mapped to geographic WGS84 coordinates of the original patch.
- Polygons with area below a minimum noise threshold ($< 100\text{ m}^2$) are filtered out.

#### Story 3.4: Landslide Risk Level Scoring (Slope & Residential Proximity) (Tuần 3 - Phối hợp cùng Tú)
As a Disaster Officer,  
I want every detected landslide polygon to be automatically ranked by risk level,  
So that I can prioritize verifying and warning the most dangerous zones first.  
**Acceptance Criteria:**
- Risk score computed from mean slope, landslide area, model confidence and distance to the nearest residential area (PostGIS `ST_Distance` against a residential / OSM buildings layer).
- Score mapped to `risk_level`: `low`, `medium`, `high`, `extreme` (configurable thresholds).
- Result returned in the inference JSON and persisted to `core_schema.landslide_events.risk_level`.

---

### 4. Hợp Đồng Giao Tiếp Với Các Thành Viên Khác (Input/Output Contracts)
- **Nhận từ Tú (GIS):** Các patch ảnh vệ tinh $128 \times 128$ pixel (GeoTIFF / NumPy arrays gồm 8 kênh dải phổ) qua endpoint `/api/v1/gis/tiling`.
- **Bàn giao cho Thuận (Backend):** Kết quả suy luận qua API `/api/v1/ai/inference` trả về JSON:
  ```json
  {
    "risk_level": "extreme",
    "confidence_score": 0.892,
    "geometry": { "type": "MultiPolygon", "coordinates": [...] },
    "risk_factors": { "mean_slope_deg": 38.5, "area_m2": 12450, "distance_to_residential_m": 320 }
  }
  ```
- **Bàn giao cho Huy (WebGIS):** Đa giác sạt lở kèm `risk_level` để Huy tô màu theo mức nguy cơ trên bản đồ 3D.
