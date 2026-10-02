# Hướng Dẫn Thiết Lập & Quản Trị Hệ Thống Microservices (GeoSentry / TerraWatch)

Tài liệu này hướng dẫn chi tiết cách tổ chức, vận hành, kiểm thử các thành phần kiến trúc nâng cao (**API Gateway**, **Circuit Breaker**, **Message Broker Event Bus**, **Database Schema-per-Service**) và quản trị GitHub repository cho dự án Capstone **GeoSentry**.

---

## 1. Bản Đồ 8 Thành Phần Cốt Lõi Microservices

Hệ thống được thiết kế đầy đủ 8 thành phần theo chuẩn kiến trúc vi dịch vụ công nghiệp:

```
[WebGIS Client (React 18)]         [Mobile Client (Flutter)]
           │                                   │
           └─────────────────┬─────────────────┘
                             ▼
     ┌──────────────────────────────────────────────────┐
     │ 🚪 API Gateway (Nginx Reverse Proxy - Port 8080) │
     │  - Single Entry Point                            │
     │  - Rate Limiting: 50 req/s                       │
     │  - Global CORS & Gzip Compression                │
     └───────────────────────┬──────────────────────────┘
                             │
            ┌────────────────┼────────────────┐
            ▼                ▼                ▼
     ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
     │ ⚙️ Core API   │ │ 🧠 AI Service │ │ 🗺️ GIS Service│
     │ (Java 17 /   │ │ (Python /    │ │ (Python /    │
     │ Spring Boot3)│ │  FastAPI)    │ │  FastAPI)    │
     │ Port 3000    │ │  Port 8001   │ │  Port 8002   │
     └──────┬───────┘ └──────┬───────┘ └──────┬───────┘
            │                │                │
            │ (Resilience4j) │                │
            ├───────────────>│ (Circuit Break)│
            │                │                │
            │ (Pub/Sub)      │ (Subscribe)    │
            ├───────────────>│ (Async Tasks)  │
            │                ▼                │
     ┌──────┴─────────────────────────────────┴───────┐
     │ ⚡ Message Broker & Event Bus (Redis 7: 6379)   │
     │  Channel: "terrawatch:events"                  │
     └────────────────────────────────────────────────┘
            │
            ▼
     ┌────────────────────────────────────────────────┐
     │ 🐘 PostGIS Database (Schema-per-Service: 5432) │
     │  ├── public: PostGIS native engine ST_*        │
     │  ├── core_schema: users, events, audit trail   │
     │  └── gis_schema: monitoring_areas AOIs, tiles  │
     └────────────────────────────────────────────────┘
```

---

## 2. API Gateway (Nginx Reverse Proxy)

* **Vị trí thư mục:** `gateway/` (`gateway/nginx.conf`, `gateway/Dockerfile`)
* **Cổng lắng nghe công khai:** `http://localhost:8080` (hoặc cổng 80 trong container)
* **Bảng định tuyến (Routing Table):**

| Đường dẫn (Route) | Đích chuyển tiếp (Upstream) | Mục đích nghiệp vụ |
| :--- | :--- | :--- |
| `/` | `http://webgis:80` | Phục vụ Single Page Application WebGIS Dashboard |
| `/api/v1/core/*` | `http://core-api:3000/*` | Các API nghiệp vụ, xác thực, thẩm định |
| `/api/v1/landslides/*`| `http://core-api:3000/api/v1/landslides/*` | Quản lý điểm sạt lở, hàng đợi, geofencing |
| `/api/v1/areas/*` | `http://core-api:3000/api/v1/areas/*` | Khu vực giám sát trọng điểm (AOI) |
| `/api/v1/reports/*` | `http://core-api:3000/api/v1/reports/*` | Báo cáo cộng đồng (Crowdsourcing) |
| `/api/v1/alerts/*` | `http://core-api:3000/api/v1/alerts/*` | Cảnh báo khẩn cấp |
| `/api/v1/ai/*` | `http://ai-service:8001/api/v1/*` | Suy luận mô hình DeepLabV3+ ONNX |
| `/api/v1/gis/*` | `http://gis-service:8002/api/v1/gis/*` | Truy vấn ảnh vệ tinh Sentinel-2/Landsat-8 |
| `/api/v1/tiles/*` | `http://gis-service:8002/api/v1/tiles/*`| Cung cấp Mapbox Vector Tiles (MVT Protobuf) |
| `/swagger-ui/*` | `http://core-api:3000/swagger-ui/*` | Tài liệu API tương tác trực quan |
| `/health` | Nội bộ Gateway | Kiểm tra sức khỏe API Gateway |

---

## 3. Circuit Breaker & Khả Năng Chịu Lỗi (Resilience4j)

Hệ thống tích hợp thư viện **Resilience4j** vào Core API (`services/core-api`) nhằm bảo vệ hệ thống khỏi lỗi lan truyền khi các service tính toán nặng (AI / GIS) bị treo hoặc cạn kiệt tài nguyên.

### Cách thức hoạt động:
* **Cơ chế:** Đếm tỷ lệ lỗi trên cửa sổ trượt 10 requests gần nhất.
* **Ngưỡng ngắt:** Nếu $\ge 50\%$ requests bị lỗi hoặc timeout $\ge 2000\text{ms}$, mạch chuyển sang trạng thái **OPEN**.
* **Xử lý Fallback:** Khi mạch **OPEN**, Core API không tiếp tục gọi sang AI Service mà lập tức kích hoạt hàm `fallbackPredict()` trả về thông báo lỗi thân thiện, đưa tác vụ vào hàng đợi ngầm.
* **Tự hồi phục (Half-Open):** Sau thời gian chờ 5 giây (`waitDurationInOpenState: 5000ms`), mạch chuyển sang trạng thái **HALF-OPEN** để thử nghiệm 3 requests. Nếu thành công, mạch tự động đóng lại (**CLOSED**).

### Kiểm thử Circuit Breaker:
```bash
# Gọi endpoint chẩn đoán Circuit Breaker
make demo-circuit-breaker
# Hoặc truy cập: http://localhost:8080/api/v1/diagnostic/circuit-breaker/ai
```

---

## 4. Message Broker & Event Bus (Redis Pub/Sub)

Nhằm chuyển đổi kiến trúc sang **Event-Driven Microservices**, hệ thống kích hoạt kênh truyền thông điệp qua Redis Pub/Sub:
* **Kênh trao đổi:** `terrawatch:events`
* **Mẫu thông điệp sự kiện (`TerraWatchEvent`):**
  ```json
  {
    "eventId": "e93f6c12-3211-4f10-b9df-a0418c39d891",
    "eventType": "LANDSLIDE_VERIFIED",
    "timestamp": "2026-10-02T14:05:00Z",
    "sourceService": "core-api",
    "payload": {
      "eventId": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
      "status": "verified",
      "riskLevel": "extreme",
      "officerId": "22222222-2222-2222-2222-222222222222"
    }
  }
  ```
* **Luồng xử lý:**
  1. Khi cán bộ thẩm định duyệt điểm sạt lở (`PATCH /api/v1/landslides/{id}/verify`), Core API phát sự kiện `LANDSLIDE_VERIFIED` lên Redis Event Bus.
  2. Background worker của `ai-service` lắng nghe kênh `terrawatch:events`, tự động cập nhật cache và kích hoạt huấn luyện/suy luận phân mảnh mới bất đồng bộ.

### Kiểm thử Event Bus:
```bash
# Bắn một sự kiện mẫu lên Redis Event Bus
make demo-event-bus
# Hoặc POST: http://localhost:8080/api/v1/diagnostic/event-bus/publish?eventType=TEST_EVENT&message=Hello
```

---

## 5. Service Discovery & Container Networking

Hệ thống sử dụng **Docker Container Internal DNS** kết hợp `bridge network` (`terrawatch-net`):
* Các service tìm thấy nhau hoàn toàn động thông qua tên host container:
  - `http://core-api:3000`
  - `http://ai-service:8001`
  - `http://gis-service:8002`
  - `terrawatch-postgis:5432`
  - `terrawatch-redis:6379`
* *Lợi thế học thuật khi bảo vệ:* Cơ chế này tương đương với **CoreDNS trong Kubernetes**, nhẹ hơn và hiện đại hơn việc chạy thêm 1 cụm Java Netflix Eureka cồng kềnh tiêu tốn hàng trăm MB RAM vô ích.

---

## 6. Kiến Trúc CSDL: Logical Schema-per-Service (Phương Án A)

* **`public`**: PostGIS extension (`ST_*`, `GIST`), UUID, `schema_migrations`.
* **`core_schema`**: `users`, `landslide_events`, `landslide_event_history`, `community_reports`.
* **`gis_schema`**: `monitoring_areas` (AOIs), siêu dữ liệu mảnh ảnh.

### Lệnh chạy Database Migration:
```bash
# 1. Chạy tất cả các bản migration mới nhất (giống npx prisma migrate dev)
make migrate
# hoặc: python scripts/migrate.py up

# 2. Xem trạng thái các bản migration (Đã chạy hay đang chờ)
make db-status

# 3. Nạp lại dữ liệu mẫu kiểm thử
make seed
```

---

## 7. Quy Ước Nhánh & Quản Trị Git (GitFlow)

* `main`: Nhánh production ổn định.
* `develop`: Nhánh tích hợp sprint.
* `feature/<nhóm>-<tên_tính_năng>`: Nhánh con của từng thành viên.
