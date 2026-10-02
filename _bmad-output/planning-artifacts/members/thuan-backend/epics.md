# Kế Hoạch Epics & Stories Chi Tiết — Thành Viên 3: THUẬN
## Vai trò: Backend Engineer & System Architect
**Phân hệ đảm nhiệm:** `services/core-api/`, `gateway/`, `docker-compose.yml`  
**Dự án:** GeoSentry (TerraWatch) - Hệ Thống Viễn Thám, AI & Mô Hình 3D Cảnh Báo & Hỗ Trợ Cứu Hộ Sạt Lở Đất  

---

### 1. Mục Tiêu & Trách Nhiệm Kỹ Thuật
- Thiết kế kiến trúc tổng thể Microservices 8 thành phần, quản trị Docker Compose & Nginx Gateway (Port 8080).
- Xây dựng Core API Service bằng Java 17 + Spring Boot 3 (kết nối JPA, PostGIS, Redis).
- Triển khai bảo mật phân quyền Role-Based Access Control (RBAC 4 roles: `citizen`, `rescue_team`, `officer`, `admin`) bằng Spring Security 6 & JWT.
- Quản lý hàng đợi tác vụ nền và Message Broker qua **Redis Pub/Sub Event Bus** (channel: `terrawatch:events`).
- Bọc các cuộc gọi liên dịch vụ sang AI và GIS bằng **Resilience4j Circuit Breaker** chống sập dây chuyền.
- Tích hợp thông báo đẩy khẩn cấp Firebase Cloud Messaging (FCM) và quản lý vết kiểm toán bất biến (Audit Trail).

---

### 2. Lộ Trình 5 Tuần Tốc Lực Của Thuận

```
Tuần 1: Cài đặt JWT (jjwt), viết AuthController (Register/Login/Me 4 roles), băm BCrypt; cấu hình Nginx Gateway & Security.
Tuần 2: Viết REST API quản lý sự cố (/landslides), API tiếp nhận SOS (/sos/send); cấu hình Resilience4j Circuit Breaker.
Tuần 3: Dựng Redis Pub/Sub Event Bus kết nối 2 chiều giữa Spring Boot và Python FastAPI.
Tuần 4: Viết API thẩm định sự cố (/verify), ghi vết kiểm toán landslide_event_history; tích hợp FCM Push Notification.
Tuần 5: Điều phối tích hợp hệ thống, test kịch bản Circuit Breaker & Event Bus (make demo-*), đảm bảo 0 lỗi crash.
```

---

### 3. Danh Sách Epics & User Stories Đảm Nhiệm

#### Story 1.1: Multi-Role User Registration & Authentication (Register / Login / JWT) (Tuần 1 - BẮT TAY LÀM NGAY)
As a User (Citizen, Rescue Team Member, Disaster Officer, or Admin),  
I want to register and log in securely to obtain a role-specific JWT access token,  
So that my identity and permissions are verified across WebGIS and Mobile applications.  
**Acceptance Criteria:**
- Endpoint `POST /api/v1/auth/register` tạo người dùng với 4 roles: `citizen`, `rescue_team`, `officer`, `admin`. Mật khẩu băm bằng BCrypt.
- Endpoint `POST /api/v1/auth/login` kiểm tra email/mật khẩu và trả về JWT token chứa `userId`, `email`, và `role`.
- Endpoint `GET /api/v1/auth/me` trả về thông tin profile người dùng khi gửi kèm header `Authorization: Bearer <token>`.
- Các endpoint bảo vệ từ chối truy cập không có token hợp lệ với mã HTTP 401.

#### Story 1.3: API Gateway Reverse Proxy & Rate Limiting (Tuần 1)
As a DevOps Engineer,  
I want Nginx reverse proxy configured as the single entry point (Port 8080) with rate limiting (50 req/s) and unified CORS,  
So that internal microservice ports are protected and traffic routed seamlessly.  
**Acceptance Criteria:**
- Gateway định tuyến trong suốt: `/api/v1/auth/*`, `/api/v1/core/*`, `/api/v1/ai/*`, `/api/v1/gis/*`, và `/` (WebGIS SPA).
- CORS headers cấu hình chuẩn cho cả WebGIS (Port 5173/8080) và Flutter Mobile.

#### Story 2.4: Emergency Landslide SOS Ingestion API with GPS & Photo Upload (Tuần 2)
As a Disaster Officer,  
I want an API endpoint to receive emergency SOS reports from citizens trapped in landslide zones containing GPS coordinates and field photos,  
So that ground-truth reports can immediately supplement satellite observations.  
**Acceptance Criteria:**
- Endpoint `POST /api/v1/sos/send` tiếp nhận tọa độ GPS, nội dung mô tả và file ảnh/video hiện trường.
- Tạo bản ghi trong `core_schema.sos_requests` và bắn sự kiện `LANDSLIDE_SOS_TRIGGERED` lên Redis Event Bus.

#### Story 4.1: Redis Pub/Sub Event Bus & Resilience4j Circuit Breaker (Tuần 3 - 4)
As a Backend Engineer,  
I want bidirectional asynchronous communication via Redis channel `terrawatch:events` and Circuit Breaker isolation for AI/GIS calls,  
So that the Core API never crashes when dependent Python services are overloaded.  
**Acceptance Criteria:**
- Các sự kiện `LANDSLIDE_DETECTED`, `LANDSLIDE_VERIFIED`, và `SOS_TRIGGERED` được publish và consume ổn định.
- Resilience4j Circuit Breaker tự động chuyển sang `OPEN` khi tỷ lệ lỗi $\ge 50\%$, kích hoạt Fallback lưu vào hàng đợi ngầm mà không gây sập Core API.

---

### 4. Hợp Đồng Giao Tiếp Với Các Thành Viên Khác (Input/Output Contracts)
- **Cung cấp cho Huy (WebGIS) & Lâm (Mobile):** Bộ API chuẩn REST/JSON:
  * `/api/v1/auth/register`, `/api/v1/auth/login`, `/api/v1/auth/me`
  * `/api/v1/core/landslides` (danh sách điểm sạt lở)
  * `/api/v1/core/landslides/{id}/verify` (duyệt cảnh báo)
  * `/api/v1/sos/send` (tiếp nhận SOS)
- **Giao tiếp với Tú (GIS) & Duẫn (AI):** Gọi HTTP client qua Circuit Breaker và trao đổi qua Redis Pub/Sub (`terrawatch:events`).
