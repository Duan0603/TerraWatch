# Story 5.1: Citizen Alert Subscription & Emergency Alert Reception (Push + SMS)

Status: review

## Story Overview
**Story Key:** `5-1-citizen-alert-subscription-emergency-alert-reception-push-sms`  
**Epic:** Epic 5: Citizen Mobile App, Offline Geofencing & End-to-End Demo (Tuần 5)  
**Target Service:** Mobile App (`apps/mobile/`) | Phối hợp: Core API (`services/core-api/`)  
**Assigned Member:** Lâm (Mobile App Engineer) | Phối hợp: Thuận (Backend)

### User Story
As a Citizen (Người dân),  
I want to register my phone number and areas of interest in the mobile app and receive immediate emergency landslide warnings,  
So that I am warned to evacuate safely when authorities broadcast an evacuation alert for my registered area.

---

## Acceptance Criteria

- [x] **AC1 - Đăng ký Vùng Nhận Cảnh Báo (UC07):** Màn hình cho phép người dân xác nhận số điện thoại và chọn khu vực quan tâm (xã/huyện/AOI trọng điểm như Lào Cai, Yên Bái) -> Gửi request `POST /api/v1/alerts/subscriptions` (payload: `{ phoneNumber, areaId, alertChannels: ["SMS", "PUSH"] }`).
- [x] **AC2 - Đăng Ký Thiết Bị FCM (Device Registration):** Khi người dân đăng nhập hoặc mở app, ứng dụng tự động lấy FCM Device Token và gửi lên Backend qua `POST /api/v1/alerts/devices/register` (payload: `{ userId, fcmToken, deviceType: "ANDROID" }`).
- [x] **AC3 - Màn Hình Cảnh Báo Đỏ Toàn Màn Hình (Emergency Alert Screen):** Khi nhận FCM Push có type `EMERGENCY_ALERT`:
  - Bật màn hình cảnh báo đỏ toàn màn hình (Full-Screen Intent) ngay lập tức kể cả khi app đang chạy ngầm hoặc màn hình đang khóa.
  - Kích hoạt rung liên tục và phát còi hú báo động âm lượng tối đa (`assets/sounds/`).
  - Hiển thị rõ: Cấp độ nguy hiểm (`high`/`extreme`), Tên vùng sạt lở, Thông điệp cảnh báo và Chỉ dẫn sơ tán khẩn cấp.
  - Có nút "Tôi Đã Nắm Rõ & Tắt Báo Động" để dừng còi hú.
- [x] **AC4 - Lịch Sử Cảnh Báo Đã Nhận:** Lưu các bản tin cảnh báo nhận được vào SQLite cục bộ (`alert_history`) và hiển thị danh sách trên màn hình `alerts_screen.dart` (xem lại được cả khi mất mạng).
- [x] **AC5 - Bảo Mật Quyền Riêng Tư (NFR5):** Người nhận cảnh báo được lọc hoàn toàn dựa trên vùng đăng ký tĩnh (`alert_subscriptions`), tuyệt đối KHÔNG gửi vị trí GPS thời gian thực của người dân lên server để lọc tin.

---

## Technical Context & Guardrails (Ponytail Applied)

- **Framework:** Flutter 3.47.x (Dart 3.x).
- **Network & Gateway:** Sử dụng `ApiClient` (`apps/mobile/lib/core/network/api_client.dart`) kết nối qua API Gateway Nginx (`http://10.0.2.2:8080`).
- **Endpoints tích hợp:**
  - `POST /api/v1/alerts/subscriptions`: Đăng ký vùng nhận cảnh báo.
  - `POST /api/v1/alerts/devices/register`: Đăng ký token thiết bị.
  - `GET /api/v1/monitoring-areas`: Lấy danh sách vùng giám sát (AOI) để người dân lựa chọn.
- **Local Storage:** SQLite (`sqflite`) bọc trong `LocalStorage` (`lib/core/storage/local_storage.dart`) với bảng `alert_history`.
- **Local Notification & Sound:** `NotificationService` (`lib/services/notification_service.dart`) phát còi hú và rung với kênh ưu tiên cao nhất (`importance: Importance.max`, `priority: Priority.high`, `fullScreenIntent: true`).
- **Nguyên tắc Ponytail (Chống Bloat/Over-Engineering):**
  - Không tạo thêm tầng UseCase/Domain trừu tượng riêng lẻ (gọi trực tiếp `AlertsRepository` từ màn hình hoặc Controller).
  - Không viết DTO chuyển đổi đa tầng; parse JSON trực tiếp bằng Dart Factory constructors gọn nhẹ.

---

## Tasks & Subtasks

- [x] **Task 1: Cấu hình CSDL SQLite & Models (Data Layer Tinh Gọn)**
  - [x] 1.1 Tạo `AlertModel` và `SubscriptionModel` trong `lib/features/alerts/data/`.
  - [x] 1.2 Bổ sung bảng `alert_history` vào `LocalStorage` (`lib/core/storage/local_storage.dart`): `(id INTEGER PRIMARY KEY, title TEXT, message TEXT, severity TEXT, area_name TEXT, received_at TEXT)`.
  - [x] 1.3 Tạo `AlertsRepository` xử lý gọi API đăng ký vùng, đăng ký FCM token và đọc/ghi `alert_history` trong SQLite.

- [x] **Task 2: Lập trình Dịch vụ Xử lý Push & Còi Hú Báo Động**
  - [x] 2.1 Mở rộng `NotificationService` để tiếp nhận payload `EMERGENCY_ALERT` và phát âm thanh còi hú lặp.
  - [x] 2.2 Đăng ký channel thông báo Full-Screen Intent trong cấu hình Android native.

- [x] **Task 3: Xây dựng Giao diện Đăng Ký Vùng Nhận Tin (Subscription Screen)**
  - [x] 3.1 Tạo màn hình `subscription_screen.dart` cho phép người dân: nhập số điện thoại, chọn tỉnh/huyện/AOI cần theo dõi từ danh sách gợi ý.
  - [x] 3.2 Tích hợp nút "Lưu Đăng Ký Cảnh Báo" gọi `AlertsRepository.subscribeAlerts()`.

- [x] **Task 4: Xây dựng Màn hình Cảnh Báo Đỏ Toàn Màn Hình (Emergency Alert Screen)**
  - [x] 4.1 Tạo màn hình `emergency_alert_screen.dart`: Nền đỏ cảnh báo chớp nháy, icon còi hú, cấp độ nguy cơ, bản đồ/chỉ dẫn sơ tán.
  - [x] 4.2 Thêm nút "Xác Nhận Đã Nhận Tin & Tắt Báo Động" dừng còi hú và lưu bản ghi vào SQLite.

- [x] **Task 5: Xây dựng Màn hình Lịch Sử Cảnh Báo & Tích hợp Hoàn Chỉnh**
  - [x] 5.1 Cập nhật `alerts_screen.dart` hiển thị danh sách các đợt cảnh báo từ SQLite.
  - [x] 5.2 Nối luồng từ `home_screen.dart` sang `subscription_screen.dart` và `alerts_screen.dart`.
  - [x] 5.3 Chạy `flutter analyze` và `flutter test` đảm bảo 0 lỗi biên dịch.

---

## Dev Agent Record
### Debug Log
- Story spec được phân rã từ `epics.md` theo quy trình chuẩn BMAD kết hợp triết lý Ponytail.
- Kiến trúc đảm bảo độc lập Microservices, tận dụng tối đa `ApiClient`, `LocalStorage` và `NotificationService` đã dựng ở bước chuẩn bị.
- `flutter analyze` đạt 0 issues; `flutter test` vượt qua toàn bộ 5/5 test cases.

### Completion Notes
- Đã hoàn tất toàn bộ AC1 - AC5 và Task 1 -> Task 5.
- Trạng thái chuyển sang `review`.
