# Mục 5 SRS - đối chiếu nguồn

File này chỉ để bạn kiểm tra, **không dán vào SRS**. Mỗi dòng của mục 5 (5.1 đến 5.8) trong `GeoSentry_SRS_Section5_Requirement_Appendix.docx` đều có nguồn ở đây.

Ký hiệu trạng thái:

- **Code**: code hoặc migration đang làm đúng như câu trong SRS.
- **Một phần**: code làm được một phần, phần còn lại nêu ở cột nguồn.
- **Yêu cầu**: câu này là yêu cầu của PRD/epic, chưa có code thực hiện.

## 5.1 Business Rules

| ID | Nguồn | Trạng thái |
| --- | --- | --- |
| BR-01 | `AuthService.normalizeEmail`, `existsByEmail`; `users.email UNIQUE` (V1) | Code |
| BR-02 | `AuthService.register` và `GoogleAuthService.createCitizen` luôn tạo citizen. Chưa có API cấp quyền, officer/admin chỉ có từ seed V2 (PRD mục 2, Epic 1.1) | Một phần |
| BR-03 | `RegisterRequest` (`@Size` 8-72), `AuthService.validatePasswordLength`, BCrypt. Đăng nhập chỉ kiểm tối đa 72 | Code |
| BR-04 | `JwtTokenProvider` (mặc định 86 400 000 ms), `JwtAuthenticationFilter`, `SecurityConfig` (401/403). 403 theo role mới chỉ áp cho `POST /notifications/broadcast`, phần lớn route khác là `permitAll` | Một phần |
| BR-05 | `GoogleAuthService` (403 nếu không phải citizen), `FirebaseIdTokenVerifier` (`email_verified`, `google.com`) | Code |
| BR-06 | `AuthService.changePassword` (tài khoản Google trả 400, kiểm mật khẩu hiện tại) | Code |
| BR-07 | `apps/mobile/.../auth_repository.dart` (`role != citizen`); Story 5.5 | Code |
| BR-08 | `UpdateProfileRequest` không có trường email | Code |
| BR-09 | Chỉ có trong SRS mục 3.3.5. Seed V2 có 1 admin, không có code chặn | Yêu cầu |
| BR-10 | `UpdateProfileRequest` (regex SĐT, giới tính), `AuthService.MIN_BIRTH_DATE` | Code |
| BR-11 | `UserAvatarService.validate` (200 000 byte, chữ ký JPEG/PNG), `user_avatars` khóa chính `user_id` | Code |
| BR-12 | `rainfall_processor.py` (chỉ lưu giá trị khác None, tổng cửa sổ là None nếu thiếu); `test_rainfall.py` | Code |
| BR-13 | `rainfall_processor.py` (`len(fcst_items) >= 20`, không có None) | Code |
| BR-14 | V3 `uq_rainfall_obs`, `uq_rainfall_forecast`; `rainfall_repository.py` `ON CONFLICT DO UPDATE`; `test_idempotent_database_persistence` | Code |
| BR-15 | `terrain_processor.py` (mask NaN/no-data, kiểm 3x3, `ValueError` khi không có ô hợp lệ); `test_terrain.py` | Code |
| BR-16 | `terrain_repository.update_terrain_metrics` lưu `dem_source`, độ phân giải. DEM lỗi thì `terrain_client.py` dùng lưới giả và ghi `FALLBACK_SYNTHETIC` | Code |
| BR-17 | `snapshot_processor.py`, `snapshot_repository.get_observations_as_of` (`available_at <= as_of`); `test_snapshots.py` | Code |
| BR-18 | `snapshot_processor.sum_window` (tối thiểu 1 / 20 / 60 / 140 giá trị) | Code |
| BR-19 | V3 `uq_feature_snapshot` có. Câu "không sửa" **chưa đúng ở code**: `save_snapshot` dùng `ON CONFLICT DO UPDATE` nên chạy lại sẽ ghi đè (Epic 2.3 yêu cầu bất biến) | Một phần |
| BR-20 | `snapshot_processor.py` (`coverage_quality`: good / stale / missing) | Code |
| BR-21 | PRD mục 3; `forecast_runs.horizon_hours`, `valid_from`, `valid_until`. Chưa có service nào ghi `forecast_runs` (chỉ có `seed-demo-forecasts.sql`) | Yêu cầu |
| BR-22 | Story 3.3, `API_SPECIFICATION.md`. AI service chưa có endpoint dự báo 24h | Yêu cầu |
| BR-23 | PRD mục 3; cột `probability`, `experimental_score` | Yêu cầu |
| BR-24 | PRD mục 3; `availability` CHECK, `unavailability_reason` | Yêu cầu |
| BR-25 | PRD mục 3; enum `superseded`; `model_version`, `threshold_version` NOT NULL | Yêu cầu |
| BR-26 | PRD mục 3. Truy vấn Core lọc `valid_until > now` (`ForecastRepository`, view `v_active_forecast_hazards`), chưa có job đánh dấu inactive | Một phần |
| BR-27 | PRD mục 3, `architecture.md` mục 3 | Yêu cầu |
| BR-28 | PRD FR3, Epic 4.2, `AI_MODEL_CARD.md` mục 4 | Yêu cầu |
| BR-29 | PRD FR3, `API_SPECIFICATION.md` mục 6. Code hiện tại: `PATCH /landslides/{id}/verify` là `permitAll`, `officerId` lấy từ body (mặc định UUID officer demo) | Yêu cầu |
| BR-30 | `API_SPECIFICATION.md` mục 6 (409), Epic 4.2 | Yêu cầu |
| BR-31 | `ForecastRepository.listApprovedUnexpired`; Story 5.3 AC1; `ForecastApiTest` | Code |
| BR-32 | PRD FR3; enum `verification_status`; `SpatialRepository` (queue = pending, active = verified). Màn hàng đợi WebGIS đang chạy bằng dữ liệu mock trong localStorage, chưa gọi endpoint này | Một phần |
| BR-33 | `SecurityConfig` (`hasRole("ADMIN")` cho `POST /notifications/broadcast` và `/broadcast/**`) | Code |
| BR-34 | Core không có đường phát tự động; WebGIS `EmergencyAlertPrompt` chỉ mở form (PRD FR4, Epic 4.2) | Code |
| BR-35 | WebGIS `BroadcastModal` bắt gõ "XAC NHAN" (Story 4.4 AC6). Ước tính người nhận là số cố định trong `broadcastApi.getRecipientPreview`, Core chưa có endpoint preview | Một phần |
| BR-36 | WebGIS `BroadcastModal` (bộ đếm, cảnh báo, Story 4.4 AC4). Backend không giới hạn độ dài | Code |
| BR-37 | WebGIS `BroadcastModal.toggleChannel` (tối thiểu 1 kênh). Backend hiện luôn gửi FCM, bỏ qua lựa chọn kênh | Một phần |
| BR-38 | `BroadcastRepository.recipients` (subscription active + `channel_push` + `device_tokens`) | Code |
| BR-39 | `BroadcastRepository.insert`, `insertDelivery`, `updateCounts`; V3, V8 | Code |
| BR-40 | `NotificationService` (`VALID_HOURS = 24`, `revoke`); `BroadcastRepository.forUser`; Story 5.1 AC4. WebGIS chưa có nút thu hồi | Code |
| BR-41 | Có trạng thái `sent`/`failed` kèm lỗi, SMS trả `NOT_SENT` (`NotificationService`, `FcmConfig`). Trạng thái `delivered` có trong enum nhưng chưa có bước xác nhận từ thiết bị | Một phần |
| BR-42 | `NotificationService.broadcastAlert` không cần forecast; PRD FR4 | Code |
| BR-43 | PRD FR4. Cột `alert_broadcasts.idempotency_key UNIQUE` có nhưng Core không đọc/ghi | Yêu cầu |
| BR-44 | `BroadcastRepository.recipients`; `AlertSubscriptionService.subscribe` (area phải `is_active`) | Code |
| BR-45 | V5 `idx_uq_user_area_subscription`; `AlertSubscriptionService.subscribe` | Code |
| BR-46 | `SubscriptionRequest` (`@NotEmpty`), `AlertSubscriptionService.hasPhone` | Code |
| BR-47 | `DeviceTokenRepository` (`register` chuyển token, `remove`, `forget`), `DeviceController`, `PushService.stop`, `NotificationService` (`devices.forget`) | Code |
| BR-48 | `LocalStorage.insertAlert` (chống trùng theo `broadcast_id`); Story 5.1 AC6 | Code |
| BR-49 | `AlertModel.stateAt`; `LocalStorage.insertAlert` giữ trạng thái `revoked` | Code |
| BR-50 | `BroadcastRepository.forUser` (7 ngày); `AlertsRepository.resync`; Story 5.1 AC4, AC7 | Code |
| BR-51 | `CommunityReportController` lấy user từ token; Story 2.4 AC1 | Code |
| BR-52 | `CommunityReportRequest` (phạm vi tọa độ, `@NotNull observedAt`), `FieldReportService.submit` (lệch 5 phút, `observedUntil`) | Code |
| BR-53 | `FieldReportService.submit` (cần ảnh hoặc mô tả), `@Size(max = 2000)` | Code |
| BR-54 | V7 (`report_time` và `observed_at` là hai cột) | Code |
| BR-55 | V7 `idx_uq_report_client_id`; `FieldReportRepository.insertIfAbsent`; 201 lần đầu, 200 lần lặp | Code |
| BR-56 | `FieldReportService.uploadPhoto` (700 000 byte, chữ ký JPEG/PNG) và kiểm chủ sở hữu ảnh | Code |
| BR-57 | `apps/mobile/.../report_repository.dart` (`_send`, `_isPermanent`, `syncPending`, `retry`) | Code |
| BR-58 | `zone_store.dart` `replaceAll` (một transaction); `forecast_repository.dart`; Story 5.3 AC2 | Code |
| BR-59 | `forecast_zone.dart` (`isValidAt`, `isExpiredAt`); `GeoMath.isPointInOrOnPolygon` | Code |
| BR-60 | `geofence_evaluator.dart` (xếp theo `hazardRank` rồi `validUntil`; `GeofenceMonitor._alerted` theo `runId`) | Code |
| BR-61 | `geofence_evaluator.dart` (bốn điều kiện stale); Story 5.3 AC4 | Code |
| BR-62 | `geofence_evaluator.dart` và các dòng chữ trên `geofence_screen.dart` | Code |
| BR-63 | PRD FR5; `geofence_screen.dart` hiển thị lần đồng bộ cuối | Code |
| BR-64 | Trigger `fn_log_landslide_verification` (V1), `alert_broadcasts.sender_id` và `broadcast_time`. `forecast_reviews` có bảng nhưng chưa có API (PRD FR3, Epic 7.2) | Một phần |
| BR-65 | PRD mục 2. Code hiện tại: `POST /monitoring-areas` là `permitAll` | Yêu cầu |

## 5.2 Common Requirements

| ID | Nguồn |
| --- | --- |
| CR-01 | `SecurityConfig`; mobile `api_client.dart` (401 thì xóa phiên), hàng đợi báo cáo trong SQLite giữ nguyên |
| CR-02 | PRD mục 2 (ba role) |
| CR-03 | Bean Validation trong các DTO của Core; validator trong các màn hình mobile |
| CR-04 | `PrimaryButton(isLoading)` (mobile), `ReportRepository._syncing` |
| CR-05 | `ApiException` và thông báo lỗi trên mobile; nút "Thử lại" / "Gửi lại" |
| CR-06 | `clientReportId` (báo cáo), `device_tokens` khóa chính là token (upsert), subscription cập nhật thay vì tạo mới |
| CR-07 | PRD mục 3; `rainfall_processor.py` |
| CR-08 | PRD FR5; các dòng "Đây không phải xác nhận an toàn" trong mobile |
| CR-09 | `architecture.md` mục 3; `formatLocal` trong mobile |
| CR-10 | Toàn bộ chuỗi giao diện của WebGIS và mobile |
| CR-11 | PRD FR5; Story 5.1 AC9; Story 5.3 AC3 |
| CR-12 | Story 5.5 AC4; Story 5.3 AC6 |

## 5.3 Application Messages List

Tất cả chuỗi lấy nguyên văn từ code. Chuỗi nào chứa biến thì viết trong `{...}`.

| Mã | Nguồn |
| --- | --- |
| MSG01-MSG07, MSG09-MSG13 | `login_screen.dart`, `register_screen.dart`, `change_password_screen.dart`, `edit_profile_screen.dart`, `auth_repository.dart` |
| MSG08 | `change_password_screen.dart` |
| MSG14-MSG17 | `core/network/api_client.dart` |
| MSG18 | `auth_repository.dart` |
| MSG19-MSG21 | `edit_profile_screen.dart`, `subscription_screen.dart` |
| MSG22-MSG27 | `subscription_screen.dart`, `profile_screen.dart` |
| MSG28-MSG29 | `NotificationService.java` (Core) |
| MSG30-MSG36 | `emergency_alert_screen.dart`, `alert_models.dart`, `alerts_screen.dart` |
| MSG37-MSG54 | `geofence_screen.dart`, `device_location.dart`, `forecast_repository.dart`, `geofence_evaluator.dart`, `home_screen.dart` |
| MSG55-MSG65 | `report_screen.dart`, `my_reports_screen.dart`, `report_repository.dart` |
| MSG66-MSG78 | `LoginPage.jsx`, `Navbar.jsx`, `BroadcastModal.jsx`, `DashboardPage.jsx`, `EmergencyAlertPrompt.jsx`, `VerificationQueue.jsx`, `config/mapConfig.js` |

Không đưa vào danh sách: chuỗi của chế độ demo/mock (đăng nhập demo, OTP mô phỏng, nút "Mô Phỏng Cảnh Báo Đỏ"), chuỗi chỉ để debug, tên nút và nhãn menu.

## 5.4 đến 5.8 - nguồn

| Mục | Nguồn |
| --- | --- |
| 5.4 Bảng dịch vụ | `docker-compose.yml`, `services/core-api/pom.xml`, các `Dockerfile`, `apps/webgis/package.json`, `apps/mobile/pubspec.yaml`, `gateway/nginx.conf`, `EventPublisher.java`, `event_listener.py` |
| 5.4 Dịch vụ ngoài | `rainfall_client.py`, `terrain_client.py`, `FirebaseIdTokenVerifier.java`, `GoogleCertCache.java`, `GoogleFcmSender.java`, `apps/webgis/src/config/mapConfig.js`, `apps/mobile/lib/core/config/env.dart` |
| 5.4 Luồng dữ liệu | `_bmad-output/planning-artifacts/architecture.md` mục 1 và 5, đối chiếu với code để ghi hiện trạng từng bước |
| 5.5 Migration và bảng | `services/core-api/src/main/resources/db/migration/V1` đến `V8`, `application.yml` (Flyway), `docker-compose.yml` (init.sql, seed.sql), `README.md` |
| 5.5 SQLite trên máy | `apps/mobile/lib/core/storage/local_storage.dart` |
| 5.6 Core API, GIS, AI | các `*Controller.java`, `SecurityConfig.java`, `gis-service/app/main.py`, `ai-service/app/main.py`. Đã chạy script đối chiếu: 33 route Core API và 15 route GIS/AI trong bảng khớp đúng với code, không thiếu và không thừa |
| 5.6 Gateway | `gateway/nginx.conf` |
| 5.6 Endpoint dự kiến | `docs/API_SPECIFICATION.md` mục 2. Hai dòng "chưa định route" (xem trước người nhận, lịch sử phát lệnh) lấy từ Story 4.4 và SRS 3.8.1, 3.8.3 |
| 5.7 Container và cấu hình | `docker-compose.yml`, `services/core-api/Dockerfile`, `apps/webgis/Dockerfile`, `.gitignore`, `.github/workflows/*`, `README.md` (lệch `REDIS_URL` và `REDIS_HOST`) |
| 5.8 Trạng thái | `sprint-status.yaml`, story 5-1 (Task 9 chưa tick) và 5-3 (Task 7 chưa tick), cùng các kiểm tra trong code như ở bảng BR |

## Chỗ lệch giữa project và SRS của nhóm

Phần mục 3 và các lỗi code dưới đây tôi **không sửa**, chỉ báo để bạn quyết định.

### Đã đổi gì so với 5.4 đến 5.8 của nhóm

1. **5.5**: thêm V8 vào bảng migration, mô tả `alert_subscriptions` theo `area_id` và kênh, thêm bảng `device_tokens`, thêm bảng SQLite trên điện thoại.
2. **5.6**: viết lại theo code. Bỏ 4 route chưa có (đưa vào bảng "Planned Endpoints"), sửa route ảnh đại diện thành `/api/v1/auth/me/avatar`, thêm các route đã có mà bản cũ thiếu (`revoke`, `alerts/broadcasts`, `alerts/devices`). Cột Auth ghi quyền đang áp dụng, quyền dự kiến ghi trong phần mô tả. GIS và AI ghi "None" vì không có xác thực.
3. **AI Service**: ghi đúng 4 route thật và mô tả là phát hiện ứng viên vết sạt từ ảnh vệ tinh. Dự báo 24h ghi là kế hoạch.
4. **5.4**: mỗi dịch vụ nêu phần đã làm và phần dự kiến, luồng dữ liệu 7 bước có đánh dấu hiện trạng, thêm bảng dịch vụ ngoài (Open-Meteo, Firebase, bản đồ).
5. **5.7**: viết lại theo `docker-compose.yml`, nêu rõ lệch `REDIS_URL` / `REDIS_HOST`, thêm phần CI, không đưa mật khẩu hay khóa vào tài liệu.
6. **5.8**: viết lại 15 dòng theo code (bỏ câu "hàng đợi duyệt đã có", vì màn WebGIS chạy bằng dữ liệu mẫu), thêm backlog lấy từ `sprint-status.yaml` và 5 giới hạn.

### Vài chỗ ở mục 3 (chỉ kiểm lấy mẫu, chưa rà hết)

1. **3.9.1 Subscribe to Area** mô tả tỉnh/huyện/xã và kiểm tra "huyện thuộc tỉnh". Code đăng ký theo khu vực giám sát (`area_id`, V5), không có kiểm tra đó.
2. **3.10.1 Submit Field Report** ghi "Description is required". Code cho phép chỉ có ảnh (cần ảnh **hoặc** mô tả).
3. **3.2.1 Sign In** nhắc tài khoản bị vô hiệu hóa. Bảng `users` không có khái niệm đó.
4. Mục 3 chưa có dòng "Business Rules: BR-xx" ở từng chức năng như file HandiGo, nên mục 5 chưa được dẫn từ mục 3.

### Lỗi trong code ảnh hưởng đến câu chữ SRS

1. Snapshot bị ghi đè khi tạo lại cùng khóa (`ON CONFLICT DO UPDATE`), trái với yêu cầu bất biến (BR-19).
2. `PATCH /landslides/{id}/verify` không kiểm role và lấy `officerId` từ body (BR-29).
3. `forecast_runs.hazard_level` mặc định `'medium'` trong V3, nên một run `unavailable` sẽ mang mức "medium" nếu không ghi rõ (BR-24).
4. Khi DEM lỗi, `terrain_client.py` dùng lưới giả `FALLBACK_SYNTHETIC` và snapshot vẫn dùng (BR-16).
5. WebGIS hiện "PHÁT LỆNH BÁO ĐỘNG THÀNH CÔNG!" và đếm "đã nhận" bằng tổng người nhận kể cả khi Core trả `FAILED` (`broadcastApi.sendBroadcast`, MSG72).
