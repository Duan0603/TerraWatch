# CẨM NANG PHÁT TRIỂN, KIỂM THỬ & TƯƠNG THÍCH HỆ THỐNG
**Dành riêng cho Role: Thuận (Backend Engineer / System Architect)**  
**Dự án:** TerraWatch (GeoSentry) — Hệ thống Cảnh báo Sớm Sạt lở Đất  
**Phạm vi phụ trách:** `services/core-api`, `gateway`, `docker-compose.yml`, `database/migrations`

---

## MỤC LỤC
1. [Setup môi trường bên ngoài máy tính](#1-setup-môi-trường-bên-ngoài-máy-tính)
2. [Chiến lược kiểm thử: Test ở đâu và Test như thế nào?](#2-chiến-lược-kiểm-thử-test-ở-đâu-và-test-như-thế-nào)
3. [Quy tắc vàng đảm bảo code tương thích 100% với cả team](#3-quy-tắc-vàng-đảm-bảo-code-tương-thích-100-với-cả-team)
4. [Quy trình Git và phối hợp hàng ngày (Workflow)](#4-quy-trình-git-và-phối-hợp-hàng-ngày-workflow)

---

## 1. SETUP MÔI TRƯỜNG BÊN NGOÀI MÁY TÍNH

Trước khi bắt tay vào code, bạn cần chuẩn bị các công cụ và dịch vụ sau trên máy cá nhân:

### 1.1. Công cụ & Phần mềm bắt buộc (Prerequisites)
1. **Docker Desktop:**
   - *Hiện trạng máy:* Đã cài Docker v29.1 nhưng service chưa bật.
   - *Hành động:* Khởi động ứng dụng **Docker Desktop** trên Windows và đảm bảo icon cá voi chuyển sang trạng thái xanh lá (Running). Docker dùng để chạy PostGIS 15 và Redis 7.
2. **Java Development Kit (JDK):**
   - *Hiện trạng máy:* Đã có Java 21 (tương thích hoàn hảo với Spring Boot 3 / Java 17).
3. **IDE đề xuất — IntelliJ IDEA (Community hoặc Ultimate):**
   - *Lý do:* IntelliJ đã tích hợp sẵn **Maven runtime**, công cụ chạy Spring Boot, Git client và Database Explorer. Bạn không cần phải cài đặt thủ công Maven vào biến môi trường PATH của Windows.
   - *Nếu dùng VS Code:* Cài đặt các extension: `Extension Pack for Java`, `Spring Boot Extension Pack`, `Lombok Annotations Support for VS Code`.
4. **Công cụ kiểm thử API:**
   - Sử dụng **Swagger UI** có sẵn tại `http://localhost:3000/swagger-ui.html` (hoặc cài thêm **Postman** / **Bruno**).

### 1.2. Cấu hình biến môi trường (`.env`)
1. Tạo file `.env` tại thư mục gốc dự án (`d:\CODE\TerraWatch_Đồ Án\.env`) bằng cách copy từ `.env.example`:
   ```bash
   cp .env.example .env
   ```
2. Đảm bảo cấu hình các giá trị cơ bản:
   ```properties
   JWT_SECRET=supersecretkey-terrawatch-capstone-project-2026-minimum-256-bits-length
   JWT_EXPIRATION_MS=86400000
   POSTGRES_USER=postgres
   POSTGRES_PASSWORD=postgrespassword
   POSTGRES_DB=terrawatch
   DATABASE_URL=jdbc:postgresql://localhost:5432/terrawatch
   REDIS_URL=redis://localhost:6379
   ```

### 1.3. Khởi động các dịch vụ phụ thuộc (Database & Cache)
Bạn không cần chạy cả hệ thống microservices lúc đang code backend. Chỉ cần bật Database và Redis qua Docker:
```powershell
# Chạy PostGIS và Redis ngầm
docker compose up -d postgres redis
```
*Lưu ý:* Khi khởi động lần đầu, PostGIS sẽ tự động chạy các script `init.sql` và `seed.sql` trong thư mục `database/`.

---

## 2. CHIẾN LƯỢC KIỂM THỬ: TEST Ở ĐÂU VÀ TEST NHƯ THẾ NÀO?

Để đảm bảo code chạy ổn định và không phát sinh lỗi bất ngờ, bạn áp dụng chiến lược kiểm thử theo **4 tầng (Test Pyramid)**:

```
          [Tầng 4: E2E với WebGIS & Mobile]       <-- Kiểm thử phối hợp người dùng
       [Tầng 3: Tích hợp Docker Compose & Gateway]  <-- Kiểm thử môi trường container
     [Tầng 2: Manual API qua Swagger & Postman]     <-- Kiểm thử endpoint & phân quyền
   [Tầng 1: Unit & Integration Tests (JUnit 5)]    <-- Kiểm thử logic code local
```

### Tầng 1: Test tự động cục bộ (Unit & Integration Tests)
- **Vị trí code test:** Thư mục `services/core-api/src/test/java/vn/terrawatch/core/`
- **Cách test:**
  - Trong IntelliJ: Click chuột phải vào thư mục `src/test/java` $\rightarrow$ chọn **Run 'All Tests'** (hoặc tổ hợp phím `Ctrl + Shift + F10`).
  - Viết test mới cho các task bạn làm:
    - *Controller:* Dùng `@WebMvcTest` hoặc `@SpringBootTest` kết hợp `MockMvc` để kiểm tra phân quyền (Admin truy cập được, Citizen bị 403 Forbidden).
    - *Service:* Dùng Mockito (`@Mock`, `@InjectMocks`) kiểm tra logic nghiệp vụ phê duyệt dự báo, tính toán danh sách thuê bao nhận tin.

### Tầng 2: Test API thủ công & Phân quyền RBAC (Swagger / Postman)
1. Chạy dịch vụ `core-api` từ IDE (chạy class `TerraWatchCoreApplication.java`).
2. Mở trình duyệt truy cập Swagger UI: **`http://localhost:3000/swagger-ui.html`**.
3. **Quy trình test có xác thực JWT:**
   - **Bước 1:** Gọi API đăng nhập `POST /api/v1/auth/login`:
     - *Admin:* `admin@geosentry.vn` / mật khẩu mặc định (xem `database/migrations/V4__set_demo_user_passwords.sql`)
     - *Cán bộ (Officer):* `officer@geosentry.vn`
     - *Người dân (Citizen):* `citizen@geosentry.vn`
   - **Bước 2:** Copy chuỗi `accessToken` từ kết quả trả về.
   - **Bước 3:** Trên Swagger UI, bấm nút xanh lá **Authorize** ở góc trên cùng bên phải, dán token vào theo định dạng: `Bearer <token>` và bấm Authorize.
   - **Bước 4:** Gọi các endpoint của bạn (Ví dụ: `GET /api/v1/forecasts/queue`, `PATCH /api/v1/forecasts/{id}/review`, `POST /api/v1/notifications/broadcast`) để xác nhận kết quả trả về đúng dữ liệu và mã HTTP status.

### Tầng 3: Test tích hợp toàn bộ hệ thống qua Docker Compose & Gateway
Khi đã code xong tính năng và test cục bộ pass:
1. Mở PowerShell tại thư mục gốc dự án:
   ```powershell
   docker compose up -d --build
   ```
2. Kiểm tra trạng thái các container:
   ```powershell
   docker compose ps
   docker compose logs -f core-api
   ```
3. Test gọi API thông qua **API Gateway Nginx (Port 8080)**:
   - Truy cập: `http://localhost:8080/api/v1/forecasts/queue`
   - Kiểm tra xem Nginx có định tuyến chính xác vào Core API hay không, có bị chặn bởi Rate Limiting hay CORS không.

### Tầng 4: Test phối hợp trực tiếp với UI (WebGIS & Mobile)
- **Phối hợp với Huy (WebGIS):**
  - Khởi động WebGIS:
    ```powershell
    cd apps/webgis
    npm run dev
    ```
  - Mở `http://localhost:5173`. Đăng nhập tài khoản Officer/Admin.
  - Kiểm tra giao diện:
    1. Bảng hàng đợi duyệt dự báo có hiển thị danh sách từ API `GET /api/v1/forecasts/queue` của bạn không?
    2. Khi Huy bấm nút **Phê duyệt** hoặc **Bác bỏ**, kiểm tra xem database `core_schema.forecast_reviews` có lưu đúng `officer_id` và lý do không.
    3. Mở Modal "🚨 Phát Cảnh Báo Khẩn Cấp", gõ "XAC NHAN", bấm phát lệnh $\rightarrow$ kiểm tra bảng `core_schema.alert_broadcasts` có tạo mã lệnh thành công không.
- **Phối hợp với Lâm (Mobile App):**
  - Mở mobile app hoặc gọi thử `GET /api/v1/forecasts/offline-sync`.
  - Xác nhận danh sách đa giác cảnh báo trả về đầy đủ các trường `unit_id`, `hazard_level`, `valid_until`, `geometry`.
  - Kiểm tra xem mobile có nạp được vào SQLite và thuật toán Geofencing có hú còi khi giả lập tọa độ lọt vào vùng sạt lở hay không.

---

## 3. QUY TẮC VÀNG ĐẢM BẢO CODE TƯƠNG THÍCH 100% VỚI CẢ TEAM

Để tránh việc "code chạy trên máy mình nhưng sang máy người khác bị lỗi" hoặc làm hỏng giao diện của Huy và app của Lâm, bạn **BẮT BUỘC TUÂN THỦ 4 NGUYÊN TẮC**:

### Nguyên tắc 1: Giữ vững hợp đồng API (API Contract & Data Types)
- Tham chiếu duy nhất: file [docs/API_SPECIFICATION.md](file:///d:/CODE/TerraWatch_Đồ%20Án/docs/API_SPECIFICATION.md).
- **Quy ước đặt tên trường:**
  - DTO Request/Response qua REST API sử dụng chuẩn **camelCase** (ví dụ: `hazardLevel`, `validUntil`, `unitId`, `officerNotes`) hoặc đúng theo định dạng đã được WebGIS/Mobile tiêu thụ (kiểm tra các file DTO có sẵn trong `vn.terrawatch.core.dto`).
  - Tuyệt đối **không tự ý đổi tên trường, kiểu dữ liệu, hoặc URL endpoint** mà không họp thống nhất trước với Huy và Lâm.
- **Quy chuẩn mã lỗi HTTP:**
  - `200 OK` / `201 Created`: Thành công.
  - `400 Bad Request`: Sai định dạng dữ liệu truyền lên (bắt lỗi qua Bean Validation `@Valid`).
  - `401 Unauthorized`: Chưa truyền token hoặc token hết hạn/không hợp lệ.
  - `403 Forbidden`: Token hợp lệ nhưng không đủ quyền (ví dụ: Citizen cố gọi duyệt sự cố).
  - `404 Not Found`: Không tìm thấy bản ghi (ví dụ: `run_id` không tồn tại).
  - `409 Conflict`: Vi phạm ràng buộc dữ liệu (ví dụ: dự báo đã được người khác duyệt rồi).

### Nguyên tắc 2: Phân định ranh giới Database (Logical Schema-per-Service)
- Database PostGIS chia làm 2 schema:
  - `core_schema`: Do **Thuận toàn quyền quản lý** (`users`, `forecast_runs`, `forecast_reviews`, `alert_broadcasts`, `alert_deliveries`, `community_reports`).
  - `gis_schema`: Do **Tú phụ trách** (`spatial_assessment_units`, `rainfall_observations`, `rainfall_forecasts`, `feature_snapshots`).
- **Quy tắc thao tác:**
  - Core API chỉ thực hiện **SELECT** (đọc) từ `gis_schema` để lấy hình học và thông số địa hình. **Tuyệt đối không chạy UPDATE / DELETE / ALTER TABLE lên `gis_schema`**.
  - **Mọi thay đổi cấu trúc bảng:** Phải tạo file Migration mới theo thứ tự số: `database/migrations/V8__ten_thay_doi.sql`. Tuyệt đối không sửa tay trực tiếp vào database local rồi bỏ qua file migration.

### Nguyên tắc 3: Chuẩn hóa Bất biến về Thời gian & Không gian (Time & Spatial Invariants)
- **Chuẩn thời gian:**
  - Mọi mốc thời gian lưu trong CSDL và trả về qua API phải dùng chuẩn **UTC ISO-8601** (kết thúc bằng ký tự `Z`), ví dụ: `2026-10-30T09:00:00Z`.
  - Trong Java, sử dụng `java.time.Instant` hoặc `java.time.OffsetDateTime`. Không dùng `java.util.Date` hoặc chuỗi thời gian không có múi giờ.
- **Chuẩn không gian (GeoJSON & Hệ tọa độ):**
  - Mọi tọa độ bản đồ trao đổi với WebGIS và Mobile phải ở hệ tọa độ **WGS84 (EPSG:4326)**.
  - Thứ tự tọa độ chuẩn quốc tế của GeoJSON là: `[Kinh độ (Longitude), Vĩ độ (Latitude)]`. Rất nhiều lập trình viên nhầm lẫn thứ tự này dẫn đến vẽ điểm cảnh báo bay ra giữa biển.

### Nguyên tắc 4: Tách bạch rõ ràng giữa "Dự Báo Nguy Cơ" và "Sự Cố Thực Tế"
- Theo quyết định Pivot ngày 2026-10-13:
  - Một lượt dự báo nguy cơ cao được cán bộ duyệt (`Forecast Approval`) **KHÔNG PHẢI** là một điểm sạt lở đã xảy ra trên thực tế (`Observed Landslide Event`).
  - Không tái sử dụng các bảng `landslide_events` để lưu kết quả dự báo 24h. Lưu dự báo vào `core_schema.forecast_runs` và sự cố thực tế/báo cáo thực địa vào `core_schema.community_reports`.

---

## 4. QUY TRÌNH GIT VÀ PHỐI HỢP HÀNG NGÀY (WORKFLOW)

Để không bị xung đột mã nguồn (git conflict) với 4 thành viên còn lại:

```
[origin/main] ───────┬───────────────────────────────────┬──────> [origin/main]
                     │ (git checkout -b feature/...)     ▲
                     ▼                                   │ (Pull Request & Code Review)
             [feature branch] ─── (commit & push) ───────┘
```

1. **Trước khi bắt đầu code task mới:**
   ```powershell
   git checkout main
   git pull origin main
   git checkout -b feature/core-forecast-review-queue
   ```
2. **Trong khi code:**
   - Commit thường xuyên với message rõ ràng theo chuẩn Conventional Commits:
     - `feat(core): implement forecast review queue endpoints (Story 4.2)`
     - `fix(core): correct cors configuration in SecurityConfig`
   - Tuyệt đối **không thêm file `.env`, file `.class`, thư mục `target/` hoặc private keys** vào git (kiểm tra lại bằng `git status` trước khi commit).
3. **Khi hoàn thành task:**
   - Đảm bảo toàn bộ test case chạy pass: `mvn test` (hoặc test pass trên IntelliJ).
   - Đẩy nhánh lên GitHub:
     ```powershell
     git push -u origin feature/core-forecast-review-queue
     ```
   - Tạo **Pull Request (PR)** trên GitHub vào nhánh `main` và thông báo cho nhóm.
   - Cập nhật tiến độ task trong file `_bmad-output/implementation-artifacts/sprint-status.yaml` từ `ready-for-dev` $\rightarrow$ `review` $\rightarrow$ `done`.

---
*Tài liệu này là kim chỉ nam kỹ thuật cho Thuận trong suốt quá trình hoàn thiện Đồ án Tốt nghiệp TerraWatch.*

