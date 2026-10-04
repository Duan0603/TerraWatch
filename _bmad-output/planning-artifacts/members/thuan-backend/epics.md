# Kế Hoạch Epics & Stories Chi Tiết — Thành Viên 3: THUẬN
## Vai trò: Backend Engineer & System Architect
**Phân hệ đảm nhiệm:** `services/core-api/`, `gateway/`, `docker-compose.yml`  
**Dự án:** GeoSentry (TerraWatch) - Hệ Thống Viễn Thám & AI Cảnh Báo Sớm Sạt Lở Đất  

---

### 1. Mục Tiêu & Trách Nhiệm Kỹ Thuật
- Thiết kế kiến trúc tổng thể Microservices 8 thành phần, quản trị Docker Compose & Nginx Gateway (Port 8080).
- Xây dựng Core API Service bằng Java 17 + Spring Boot 3 (kết nối JPA, PostGIS, Redis).
- Triển khai bảo mật phân quyền Role-Based Access Control (RBAC 3 roles: `admin`, `officer`, `citizen`) bằng Spring Security 6 & JWT.
- Quản lý hàng đợi tác vụ nền và Message Broker qua **Redis Pub/Sub Event Bus** (channel: `terrawatch:events`).
- Bọc các cuộc gọi liên dịch vụ sang AI và GIS bằng **Resilience4j Circuit Breaker** chống sập dây chuyền.
- Xây dựng **dịch vụ phát cảnh báo khẩn cấp**: Firebase Cloud Messaging (FCM Push) + SMS Gateway (eSMS.vn / SpeedSMS / Twilio), và quản lý vết kiểm toán bất biến (Audit Trail).

---

### 2. Lộ Trình 5 Tuần Tốc Lực Của Thuận

```
Tuần 1: Cài đặt JWT (jjwt), viết AuthController (Register/Login/Me, 3 roles), băm BCrypt; cấu hình Nginx Gateway & Security.
Tuần 2: Viết REST API quản lý sự cố (/landslides), API báo cáo hiện trường (/reports); cấu hình Resilience4j Circuit Breaker.
Tuần 3: Dựng Redis Pub/Sub Event Bus kết nối 2 chiều giữa Spring Boot và Python FastAPI.
Tuần 4: API thẩm định sự cố (/verify) + audit trail; API phát cảnh báo khẩn cấp (/alerts/broadcast) tích hợp FCM + SMS Gateway.
Tuần 5: Điều phối tích hợp hệ thống, test kịch bản Circuit Breaker, Event Bus & gửi cảnh báo (make demo-*), đảm bảo 0 lỗi crash.
```

---

### 3. Danh Sách Epics & User Stories Đảm Nhiệm

#### Story 1.1: Multi-Role User Registration & Authentication (Register / Login / JWT) (Tuần 1 - BẮT TAY LÀM NGAY)
As a User (Citizen, Officer, or Admin),  
I want to register and log in securely to obtain a role-specific JWT access token,  
So that my identity and permissions are verified across WebGIS and Mobile applications.  
**Acceptance Criteria:**
- Endpoint `POST /api/v1/auth/register` tạo người dùng (mặc định role `citizen`, có trường `phone_number`). Mật khẩu băm bằng BCrypt.
- Chỉ `admin` mới được cấp/đổi role `officer` hoặc `admin`.
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

#### Story 2.4: Community Field Report API (GPS & Photo Upload) (Tuần 2)
As a Disaster Officer,  
I want an API endpoint to receive field reports of observed landslide signs from citizens, containing GPS coordinates and photos,  
So that ground-truth reports supplement satellite observations in the verification process.  
**Acceptance Criteria:**
- Endpoint `POST /api/v1/core/reports` tiếp nhận tọa độ GPS, nội dung mô tả và ảnh hiện trường.
- Tạo bản ghi trong `core_schema.community_reports` và bắn sự kiện `COMMUNITY_REPORT_SUBMITTED` lên Redis Event Bus.
- Endpoint `GET /api/v1/core/reports` (role `officer`/`admin`) trả danh sách báo cáo dạng GeoJSON.

#### Story 4.1: Redis Pub/Sub Event Bus & Resilience4j Circuit Breaker (Tuần 3 - 4)
As a Backend Engineer,  
I want bidirectional asynchronous communication via Redis channel `terrawatch:events` and Circuit Breaker isolation for AI/GIS calls,  
So that the Core API never crashes when dependent Python services are overloaded.  
**Acceptance Criteria:**
- Các sự kiện `LANDSLIDE_DETECTED`, `LANDSLIDE_VERIFIED`, `COMMUNITY_REPORT_SUBMITTED` và `EMERGENCY_ALERT_BROADCAST` được publish và consume ổn định.
- Resilience4j Circuit Breaker tự động chuyển sang `OPEN` khi tỷ lệ lỗi $\ge 50\%$, kích hoạt Fallback lưu vào hàng đợi ngầm mà không gây sập Core API.

#### Story 4.4 (Backend): Admin Emergency Alert Broadcast — SMS & App Push (Tuần 4 - Phối hợp cùng Huy & Lâm)
As an Admin,  
I want an API to broadcast an emergency landslide warning to citizens via SMS and mobile push notification,  
So that residents in the affected area are warned to evacuate immediately.  
**Acceptance Criteria:**
- `POST /api/v1/core/alerts/broadcast` chỉ cho phép `hasRole('ADMIN')` (role khác trả HTTP 403). Request gồm: phạm vi (`landslideEventId` + `radiusKm` | `areaIds[]` | `ALL`), `severity` (`high`/`extreme`), `message` ($\le 160$ ký tự), `channels` (`SMS`, `PUSH`).
- `POST /api/v1/core/alerts/preview` trả về số người nhận dự kiến (dùng cho hộp thoại xác nhận 2 bước).
- Lưu `core_schema.alert_broadcasts`, publish `EMERGENCY_ALERT_BROADCAST`; worker gửi theo lô (batch 500), retry tối đa 3 lần.
- `NotificationService` gồm 2 adapter: `FcmPushSender` (Firebase Admin SDK) và `SmsSender` (provider cấu hình qua `SMS_PROVIDER`, `SMS_API_KEY`, `SMS_SECRET_KEY`, `SMS_BRANDNAME`).
- Người nhận lấy từ `alert_subscriptions` (vùng quan tâm đã đăng ký) giao với phạm vi cảnh báo — không dùng vị trí GPS thời gian thực (NFR5).
- Ghi kết quả vào `core_schema.alert_deliveries` (`sent` / `failed`); `GET /api/v1/core/alerts` trả lịch sử + thống kê.
- Endpoint phụ trợ cho Mobile: `POST /api/v1/core/alerts/subscriptions`, `POST /api/v1/core/devices/register`.
- Mọi lần phát cảnh báo được ghi Audit Trail.

---

### 4. Hợp Đồng Giao Tiếp Với Các Thành Viên Khác (Input/Output Contracts)
- **Cung cấp cho Huy (WebGIS) & Lâm (Mobile):** Bộ API chuẩn REST/JSON:
  * `/api/v1/auth/register`, `/api/v1/auth/login`, `/api/v1/auth/me`
  * `/api/v1/core/landslides` (danh sách điểm sạt lở)
  * `/api/v1/core/landslides/{id}/verify` (duyệt cảnh báo)
  * `/api/v1/core/reports` (báo cáo hiện trường)
  * `/api/v1/core/alerts/preview`, `/api/v1/core/alerts/broadcast`, `/api/v1/core/alerts` (phát & lịch sử cảnh báo khẩn cấp — Admin)
  * `/api/v1/core/alerts/subscriptions`, `/api/v1/core/devices/register` (đăng ký nhận cảnh báo — Mobile)
- **Giao tiếp với Tú (GIS) & Duẫn (AI):** Gọi HTTP client qua Circuit Breaker và trao đổi qua Redis Pub/Sub (`terrawatch:events`).
