# Đặc Tả Giao Diện Lập Trình Ứng Dụng (API Specification) - GeoSentry

> **GeoSentry / TerraWatch Polyglot Microservices REST & Spatial Endpoints**

---

## 1. Core API Service (Java Spring Boot 3 - Port 3000)
Tài liệu Swagger UI trực tiếp: `http://localhost:3000/swagger-ui.html`

### A. Quản Lý Sự Kiện Sạt Lở (Landslide Events)
*   **`GET /api/v1/landslides/queue`**
    *   **Mô tả**: FR3.1 - Lấy danh sách sự kiện do AI phát hiện đang chờ cán bộ thẩm định.
    *   **Response (200 OK)**:
        ```json
        [
          {
            "event_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
            "detection_date": "2026-10-02T08:30:15Z",
            "risk_level": "high",
            "status": "pending",
            "confidence_score": 0.89,
            "slope_degrees": 37.2,
            "ndvi_drop": -0.48,
            "affected_area_m2": 1850.0,
            "satellite_scene_id": "S2A_MSIL2A_20261001T033531",
            "geometry_geojson": "{\"type\":\"MultiPolygon\",\"coordinates\":[...]}",
            "centroid_geojson": "{\"type\":\"Point\",\"coordinates\":[104.085, 21.845]}"
          }
        ]
        ```

*   **`PATCH /api/v1/landslides/{id}/verify`**
    *   **Mô tả**: FR3.2 / UC04 - Cán bộ phê duyệt hoặc bác bỏ sự kiện sạt lở.
    *   **Request Body**:
        ```json
        {
          "status": "verified",
          "risk_level": "extreme",
          "officer_note": "Sạt trượt ta-luy dương chia cắt đường QL32, phát lệnh sơ tán khẩn cấp",
          "officer_id": "22222222-2222-2222-2222-222222222222"
        }
        ```

*   **`GET /api/v1/landslides/active`**
    *   **Mô tả**: UC05 - Lấy chuẩn GeoJSON FeatureCollection các điểm sạt lở đã thẩm định để hiển thị lên bản đồ WebGIS.

*   **`GET /api/v1/landslides/geofence?lon=104.112&lat=21.862&radius=500`**
    *   **Mô tả**: UC08 / NFR2 - Truy vấn không gian tìm các điểm sạt lở nằm trong bán kính người dân đang di chuyển (`ST_DWithin`).

*   **`GET /api/v1/landslides/offline-sync`**
    *   **Mô tả**: UC08 - Xuất gói dữ liệu GeoJSON nén để app Mobile tải về lưu vào SQLite nội bộ phục vụ cảnh báo khi mất sóng 4G.

---

## 2. AI Inference Service (Python FastAPI - Port 8001)
Tài liệu Swagger UI trực tiếp: `http://localhost:8001/docs`

*   **`POST /api/v1/inference`**
    *   **Request Body**:
        ```json
        {
          "satellite_scene_id": "S2A_MSIL2A_20261001T033531",
          "bbox": [104.08, 21.84, 104.09, 21.85],
          "slope_avg": 37.2,
          "ndvi_drop": -0.48
        }
        ```
    *   **Response (200 OK)**:
        ```json
        {
          "success": true,
          "satellite_scene_id": "S2A_MSIL2A_20261001T033531",
          "detection": {
            "risk_level": "high",
            "confidence_score": 0.89,
            "slope_degrees": 37.2,
            "ndvi_drop": -0.48,
            "geometry": { "type": "MultiPolygon", "coordinates": [...] },
            "metrics": {
              "f1_score": 0.768,
              "iou": 0.642,
              "dataset": "Landslide4Sense"
            }
          }
        }
        ```

*   **`GET /api/v1/models/info`**
    *   **Mô tả**: Trả về thông tin kiến trúc DeepLabV3+ / U-Net, 8 kênh đầu vào và phiên bản ONNX runtime.

---

## 3. GIS Data Service (Python FastAPI - Port 8002)
Tài liệu Swagger UI trực tiếp: `http://localhost:8002/docs`

*   **`POST /api/v1/gis/query-satellite`**: Truy vấn ảnh Sentinel-2 / Landsat-8 có mây $< 20\%$ trên vùng AOI.
*   **`POST /api/v1/gis/tiling`**: Cắt vùng diện rộng thành các patch kích thước $2 \times 2\text{ km}$ để đưa vào AI.
*   **`GET /api/v1/gis/mvt/{z}/{x}/{y}.pbf`**: Cung cấp Vector Tile chuẩn Mapbox Vector Tile (MVT) cho WebGIS.
