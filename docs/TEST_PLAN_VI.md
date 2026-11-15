# Kế hoạch kiểm thử toàn diện — GeoSentry (TerraWatch)

| | |
| --- | --- |
| Phiên bản | 1.1 (bản nháp để nhóm rà soát; bổ sung yêu cầu phi chức năng theo chuẩn ngành) |
| Ngày lập | 2026-11-13 |
| Căn cứ mã nguồn | `main` tại commit `c5e1a6d` (2026-11-13) |
| Cập nhật trạng thái tự động hóa | 2026-11-15, `main` tại `b182eae`: mục 4.1, GIS-12, SEC-01, SEC-02 và mục 12 (điểm 1–3). Các dòng khác giữ trạng thái ngày 2026-11-13 |
| Phạm vi | Core API, GIS service, AI service, Gateway, WebGIS, Mobile (Android), cơ sở dữ liệu |

Tài liệu này liệt kê **mọi chức năng đang có trong mã nguồn** và kịch bản kiểm thử tương ứng, kèm trạng thái tự động hóa hiện tại. Kỳ vọng lấy từ PRD v5, `SecurityConfig`, các DTO, migration và tên các test đang có. Những chỗ ghi **"cần xác minh"** là hành vi chưa có test nào khẳng định, hoặc tài liệu cũ từng ghi nhận lệch; người kiểm thử ghi lại hành vi thực tế rồi nhóm chốt kỳ vọng.

## 1. Mục tiêu

1. Xác nhận từng chức năng của ba vai trò (admin, officer, citizen) chạy đúng yêu cầu PRD FR1–FR5.
2. Xác nhận các nguyên tắc an toàn của sản phẩm: không bịa dự báo, thiếu dữ liệu không thành "nguy cơ thấp", hết hạn không thành "an toàn", AI không tự phát cảnh báo.
3. Xác nhận phân quyền, độ bền khi dịch vụ phụ thuộc lỗi, và hành vi offline của mobile.
4. Chỉ ra phần nào đã có test tự động, phần nào phải kiểm thủ công, và thứ tự nên tự động hóa.

## 2. Ngoài phạm vi

- **Độ chính xác mô hình dự báo 24h (Epic 3):** chưa có mô hình phát hành nên chỉ kiểm thử contract (trả `unavailable`, không bịa số). Khi có mô hình cần kế hoạch đánh giá riêng theo PRD mục 5.
- **Epic 6, 7, 8** (IoT, SAR, phân vùng dữ liệu, thí điểm thực địa): đang ở backlog.
- **iOS:** repo chỉ có `apps/mobile/android`.
- **Gửi SMS thật ra mạng viễn thông:** chỉ kiểm bằng sandbox/số thử của nhà cung cấp.

## 3. Tài liệu căn cứ

- `_bmad-output/planning-artifacts/prd.md` (PRD v5.0), `architecture.md`, `epics.md`
- `_bmad-output/implementation-artifacts/*.md` (tiêu chí chấp nhận từng story), `sprint-status.yaml`
- `docs/API_SPECIFICATION.md`, `docs/srs/GeoSentry_SRS_Section5_Traceability.md`
- `services/core-api/.../config/SecurityConfig.java`, các `*Controller.java`, DTO, migration V1–V15
- `gateway/nginx.conf`, `docker-compose.yml`

## 4. Chiến lược

### 4.1 Cấp độ kiểm thử và tài sản đang có

Số lớp/file đếm trên `main` tại `b182eae` (2026-11-15). Cột cuối là lần chạy CI gần nhất trên `main` của từng workflow, kèm commit của lần chạy đó.

| Ký hiệu | Cấp độ | Vị trí | Lệnh chạy | Kết quả |
| --- | --- | --- | --- | --- |
| C | Unit + API (JUnit, MockMvc) Core | `services/core-api/src/test` (40 lớp) | `mvn test` (JDK 17, cần PostGIS test) | CI `b182eae`: 1745 test, 0 lỗi, 22 bỏ qua |
| G | Unit GIS (pytest) | `services/gis-service/tests` (14 file) | `pytest` | CI `d1a9027`: 327 qua, 19 xfail; CI tự nạp schema và fixture vào PostGIS |
| A | Unit AI (pytest) | `services/ai-service/tests` (6 file) | `pytest` | CI `d1a9027`: **đỏ**, dừng khi thu thập `tests/test_api.py` (`starlette.testclient` thiếu gói HTTP client trên CI); chưa có lần chạy xanh nào trên CI |
| W | Unit WebGIS (node) | `apps/webgis/tests` (25 file) | `npm test`, `npm run test:model-demo` | CI `c22fe73`: `npm test` qua |
| E | E2E WebGIS (Playwright) | `apps/webgis/e2e` (10 spec) | `npm run e2e` (cần stack đang chạy) | chưa chạy trong đợt rà soát này |
| M | Unit + widget Mobile | `apps/mobile/test` (25 file) | `flutter analyze`, `flutter test` | CI `33b6e26`: 245 qua, 10 bỏ qua; `flutter analyze` báo 3 vấn đề (không chặn) |
| GW | Kiểm tra định tuyến gateway | `gateway/check-routes.sh` | `gateway/check-routes.sh [base-url]` | chưa chạy |
| — | Thủ công | theo danh mục ở mục 7–9 | — | chưa thực hiện |

CI chạy C, G, A, M, W trên pull request và khi push vào `main`. A đang đỏ (xem bảng). E và GW chưa chạy trên CI.

### 4.2 Loại kiểm thử

Chức năng, phân quyền, validation dữ liệu, tích hợp giữa các dịch vụ, E2E toàn hệ thống, bảo mật, hiệu năng, độ bền (dịch vụ phụ thuộc lỗi), offline/đồng bộ, trung thực dữ liệu, giao diện (responsive, khả năng truy cập), tương thích, di trú dữ liệu.

### 4.3 Mức ưu tiên

- **P0:** sai là gây hại hoặc chặn buổi demo: cảnh báo sai hoặc không gửi, bịa dự báo, lộ dữ liệu, sai phân quyền.
- **P1:** chức năng chính của từng vai trò.
- **P2:** chức năng phụ, hiển thị, tiện ích.

## 5. Môi trường và dữ liệu

### 5.1 Môi trường

| Thành phần | Cách dựng | Ghi chú |
| --- | --- | --- |
| Toàn hệ thống | `docker compose up -d --build` ở thư mục gốc, cần `.env` có `JWT_SECRET` | Gateway 8080, Core 3000, AI 8001, GIS 8002, WebGIS 5173, PostGIS 5432, Redis 6379. Máy đã dùng các cổng này thì đổi bằng `docker-compose.override.yml`. |
| Dữ liệu demo | `.\run.ps1 demo-seed` | Chỉ có bản PowerShell; `Makefile` chưa có lệnh tương đương cho macOS/Linux. |
| Test Core | PostGIS riêng cho test; đặt `AUTH_TEST_DATABASE_URL`, `AUTH_TEST_DB_USER`, `AUTH_TEST_DB_PASSWORD` | Mặc định trỏ `localhost:5433/auth_story_1_1_test`. Không dùng DB dev. Chạy bằng JDK 17. |
| Test GIS có DB | PostGIS đã chạy migration và nạp `database/seed_v3_fixtures.sql`; đặt `POSTGRES_*` hoặc `DATABASE_URL` | Mặc định trỏ DB dev `terrawatch` và ghi dữ liệu vào đó; nên trỏ sang DB test. |
| E2E WebGIS | Stack đang chạy; `E2E_API_BASE_URL`, `E2E_BROWSER=chromium` hoặc `chrome` | Mặc định dùng Edge. |
| Mobile | Thiết bị Android thật (API 23 trở lên) cho push, còi, GPS, offline; emulator cho phần còn lại | `--dart-define=API_BASE_URL=...` trỏ về gateway. |

### 5.2 Dịch vụ ngoài

| Dịch vụ | Dùng cho | Cách kiểm thử |
| --- | --- | --- |
| Firebase Auth | Đăng nhập Google, OTP điện thoại | Tài khoản Google thử; số điện thoại thử của Firebase |
| Firebase Cloud Messaging | Push | Thiết bị thật có token; token giả để kiểm nhánh `failed` / `unregistered` |
| Nhà cung cấp SMS (`SMS_PROVIDER`, eSMS hoặc Twilio) | SMS cảnh báo | Sandbox (`ESMS_SANDBOX=1`) hoặc số thử |
| SMTP Gmail (`MAIL_USERNAME`, `MAIL_PASSWORD`) | Mã quên mật khẩu | Hộp thư thử; để trống để kiểm nhánh 503 |
| Open-Meteo | Mưa quan trắc, dự báo, DEM | Mạng thật; ngắt mạng để kiểm nhánh lỗi |
| MapTiler | Nền bản đồ | Có khóa và không có khóa |

### 5.3 Tài khoản và dữ liệu thử

- Tài khoản demo từ migration V2: `admin@terrawatch.vn`, `officer.yenbai@terrawatch.vn`, `citizen.limmong@terrawatch.vn`. Mật khẩu do migration V4 đặt; không ghi vào tài liệu này.
- Cần tạo thêm: công dân thứ hai (kiểm truy cập chéo), tài khoản bị khóa, yêu cầu cán bộ đang chờ duyệt, tài khoản Google.
- Dữ liệu dự báo: sau `demo-seed` có 3 run 24h trên các đơn vị Lào Cai (2 đã duyệt, 1 chờ duyệt), `model_version = demo`.
- Ảnh thử: JPEG và PNG hợp lệ dưới giới hạn, ảnh vượt giới hạn, file không phải ảnh đổi đuôi.

## 6. Tiêu chí và quy trình

**Bắt đầu:** stack dựng được, migration chạy sạch, bộ smoke (mục 10) qua, có đủ tài khoản thử.

**Kết thúc:**
1. 100% kịch bản P0 qua.
2. Ít nhất 95% kịch bản P1 qua, không còn lỗi mức S1 hoặc S2 mở.
3. Mọi bộ test tự động ở mục 4.1 xanh.
4. E2E-01 đến E2E-04 qua trên môi trường demo.
5. Các mục "cần xác minh" đã có kết luận ghi lại.
6. Mọi yêu cầu phi chức năng nguồn PRD hoặc Chuẩn ở mục 8.1 đã được đo; chỗ chưa đạt có ghi nhận và quyết định của nhóm.

**Mức độ lỗi:** S1 gây hại hoặc mất an toàn (cảnh báo sai, không gửi, bịa số, lộ dữ liệu); S2 chức năng chính không dùng được; S3 sai lệch có cách vòng; S4 hiển thị, câu chữ.

**Ghi lỗi:** tạo GitHub issue theo `.github/ISSUE_TEMPLATE/bug_report.yml`, ghi mã kịch bản (ví dụ `BRD-07`), bước tái hiện, kết quả mong đợi và thực tế, ảnh hoặc log, mức độ.

**Phân công gợi ý:** chủ phân hệ sửa lỗi; một người điều phối kiểm thử giữ tài liệu này, chạy smoke và E2E, tổng hợp báo cáo.

## 7. Danh mục kịch bản chức năng

Cột **Tự động**: "Có" kèm nơi chứa test; "Một phần" là mới phủ logic hoặc API, chưa phủ giao diện hay thiết bị; "Chưa" là phải kiểm thủ công cho đến khi viết test.

### 7.1 AUTH — Đăng ký, đăng nhập, phiên

| ID | Kịch bản | Kết quả mong đợi | P | Tự động |
| --- | --- | --- | --- | --- |
| AUTH-01 | Đăng ký công dân hợp lệ, kể cả khi request cố xin vai trò officer | 201; vai trò luôn là citizen; đăng nhập và `GET /auth/me` trả đúng hồ sơ | P0 | Có (C: AuthControllerTest, AdminUserApiTest) |
| AUTH-02 | Đăng ký email đã tồn tại, khác hoa thường hoặc thừa khoảng trắng | 409 | P1 | Có (C: AuthControllerTest, AuthServiceTest; M: auth_test) |
| AUTH-03 | Đăng ký sai dữ liệu: mật khẩu dưới 8 hoặc trên 72 ký tự, email sai định dạng, tên trống hoặc quá 100 | 400; phản hồi không lặp lại mật khẩu | P1 | Có (C: AuthControllerTest) |
| AUTH-04 | Đăng ký kèm số điện thoại | Bắt buộc có OTP Firebase khớp số; thiếu hoặc lệch thì từ chối | P1 | Có (C: AuthControllerTest, FirebaseIdTokenVerifierTest) |
| AUTH-05 | Kiểm tra email khi đăng ký (`GET /auth/email-exists`) | Công khai; chuẩn hóa email; giao diện báo trùng trước khi gửi form | P2 | Một phần (C; W: test-register-errors; giao diện chưa) |
| AUTH-06 | Đăng nhập đúng với admin, officer, citizen | 200 kèm JWT; web đưa admin và officer về trung tâm điều hành, citizen về trang công dân | P0 | Có (C: AuthControllerTest; E: auth.spec) |
| AUTH-07 | Sai mật khẩu, hoặc email không tồn tại | 401 với thông báo giống hệt nhau; web ở lại `/login` và hiện lỗi | P0 | Có (C; E: auth.spec; M: auth_test) |
| AUTH-08 | Gọi API bằng token thiếu, sai định dạng, hết hạn, bị sửa, không ký | 401 | P0 | Có (C: AuthControllerTest, JwtTokenProviderTest) |
| AUTH-09 | Token hết hạn giữa phiên làm việc (mặc định 24 giờ) | Web và mobile đưa về đăng nhập, không kẹt màn hình; mobile xóa phiên | P1 | Một phần (M: auth_test; web chưa) |
| AUTH-10 | Đăng nhập Google: tài khoản mới, tài khoản đã có, tài khoản staff, tài khoản bị khóa | Mới thì tạo citizen; đã có thì không tạo trùng; staff bị từ chối 403; bị khóa bị từ chối | P1 | Có (C: GoogleAuthServiceTest; M: auth_test) |
| AUTH-11 | Token Google sai audience, issuer, hết hạn, email chưa xác minh, chữ ký giả; lỗi lấy khóa Google | Từ chối; lỗi lấy khóa trả 503 chứ không phải 401 | P0 | Có (C: FirebaseIdTokenVerifierTest) |
| AUTH-12 | Gửi yêu cầu tài khoản cán bộ | Cần OTP điện thoại; tạo ở trạng thái chờ duyệt; chưa duyệt thì không đăng nhập được; gửi trùng trả 409 | P1 | Một phần (C: AuthControllerTest; form web chưa) |
| AUTH-13 | Quên mật khẩu qua email | Phản hồi giống nhau cho email không tồn tại, bị khóa, tài khoản Google và không gửi thư; mã có hạn 10 phút; sai 5 lần thì khóa mã; tối đa 1 mã mỗi phút và 5 mã mỗi giờ; mã, token, mật khẩu mới không dùng lại được | P0 | Một phần (C: EmailResetApiTest, SmtpPasswordResetMailerTest; giao diện ForgotPasswordPanel chưa) |
| AUTH-14 | Quên mật khẩu khi SMTP chưa cấu hình | 503, giao diện báo rõ | P2 | Một phần (C: EmailResetApiTest) |
| AUTH-15 | Quên mật khẩu bằng số điện thoại và OTP | Chỉ chấp nhận đúng số đã đăng ký kèm OTP hợp lệ | P1 | Có (C: AuthControllerTest) |
| AUTH-16 | Đổi mật khẩu | Cần đúng mật khẩu hiện tại; sai trả 400 (không phải 401); tài khoản Google không đổi được | P1 | Có (C: ProfileAndSubscriptionServiceTest; M: profile_subscriptions_test) |
| AUTH-17 | Dùng token cũ sau khi đổi mật khẩu | **Cần xác minh:** chưa có cơ chế thu hồi phiên; ghi lại hành vi và chốt kỳ vọng | P1 | Chưa |
| AUTH-18 | Mobile: tài khoản không phải citizen đăng nhập app | Bị từ chối, không lưu phiên | P1 | Có (M: auth_test) |
| AUTH-19 | Mobile: mở lại app, mở app khi mất mạng, đăng xuất | Phiên còn sau khi mở lại; lỗi mạng không xóa phiên; đăng xuất xóa phiên | P1 | Có (M: auth_test) |
| AUTH-20 | Web: trang đăng nhập, hộp thoại đăng ký, hiệu ứng chuyển cảnh ở 360, 768, 1440 px | Không tràn, không che nút, bàn phím dùng được | P2 | Chưa |

### 7.2 PROF — Hồ sơ cá nhân

| ID | Kịch bản | Kết quả mong đợi | P | Tự động |
| --- | --- | --- | --- | --- |
| PROF-01 | Sửa họ tên, số điện thoại | Lưu đúng; để trống số điện thoại thì xóa; không sửa được email | P1 | Có (C: ProfileAndSubscription*; M: profile_subscriptions_test) |
| PROF-02 | Sửa chi tiết: ngày sinh, giới tính, địa chỉ, liên hệ khẩn cấp | Lưu và trả lại đúng; giá trị trống xóa trường; ngày sinh tương lai hoặc quá xa, giới tính lạ, số khẩn cấp sai bị 400 | P1 | Có (C: ProfileDetailsApiTest; M: profile_details_test) |
| PROF-03 | Ảnh đại diện: tải lên, xem, xóa | Chỉ JPEG/PNG tối đa 200.000 byte; sai loại hoặc quá cỡ 400; chỉ chủ tài khoản; xóa trả 204; chưa có ảnh trả 404 | P1 | Có (C: ProfileDetailsApiTest; M: profile_details_test) |
| PROF-04 | Lỗi 4xx của hồ sơ, đăng ký vùng, báo cáo, dự báo | Giữ đúng mã lỗi, không bị đổi thành 401 | P1 | Có (C: ErrorStatusOverHttpTest) |
| PROF-05 | Mobile: màn sửa hồ sơ | Tên trống hoặc số sai bị chặn; liên hệ khẩn cấp cần cả tên và số; đăng xuất xóa ảnh đã lưu đệm | P2 | Có (M) |

### 7.3 USR — Quản trị người dùng (admin)

| ID | Kịch bản | Kết quả mong đợi | P | Tự động |
| --- | --- | --- | --- | --- |
| USR-01 | Gọi `/admin/users` khi chưa đăng nhập, bằng citizen, bằng officer | 401, 403, 403 | P0 | Có (C: AdminUserApiTest) |
| USR-02 | Liệt kê và lọc theo vai trò, trạng thái | Kết quả đúng bộ lọc | P1 | Có (C) |
| USR-03 | Khóa rồi mở khóa tài khoản | Tài khoản bị khóa mất quyền ngay với token đang dùng (401); mở khóa thì dùng lại được | P0 | Có (C: AdminUserApiTest, AuthControllerTest) |
| USR-04 | Admin tự khóa mình, tự đổi vai trò của mình | 400 | P1 | Có (C) |
| USR-05 | Duyệt và từ chối yêu cầu cán bộ | Chỉ áp dụng cho tài khoản đang chờ; trạng thái khác trả 409; duyệt xong thì đăng nhập được | P1 | Có (C) |
| USR-06 | Đổi vai trò người dùng | Vai trò mới có hiệu lực ngay; token cũ của người bị hạ quyền mất quyền staff | P0 | Có (C) |
| USR-07 | Giao diện "Quản trị người dùng": số liệu tổng, bộ lọc, thao tác, thông báo lỗi | Số liệu khớp danh sách; lỗi API hiện rõ, không báo thành công giả | P2 | Chưa |

### 7.4 AOI — Vùng giám sát

| ID | Kịch bản | Kết quả mong đợi | P | Tự động |
| --- | --- | --- | --- | --- |
| AOI-01 | Xem danh sách vùng khi chưa đăng nhập; tạo hoặc sửa bằng citizen, officer | Xem được công khai; tạo và sửa trả 401 hoặc 403 nếu không phải admin | P0 | Có (C: BroadcastAdminApiTest) |
| AOI-02 | Tạo vùng trùng tên | 409 | P1 | Có (C) |
| AOI-03 | Ranh giới tự cắt; ranh giới không đọc được | 400 cả khi tạo và sửa; không trả 500 | P1 | Có (C) |
| AOI-04 | Sửa tên, ranh giới, trạng thái vùng | Lưu đúng | P1 | Có (C) |
| AOI-05 | Vẽ vùng trên bản đồ: thêm đỉnh, sửa, hủy, lưu | Đa giác đóng đúng; lưu xong hiện trên bản đồ | P1 | Một phần (W: test-aoi-csv-kpi; thao tác vẽ chưa) |
| AOI-06 | Đăng ký nhận tin cho vùng đã tắt hoạt động | Từ chối | P1 | Có (C: ProfileAndSubscriptionServiceTest) |

### 7.5 GIS — Mưa, địa hình, snapshot

| ID | Kịch bản | Kết quả mong đợi | P | Tự động |
| --- | --- | --- | --- | --- |
| GIS-01 | Tính tổng mưa các cửa sổ 1, 3, 6, 24, 72 giờ và 7 ngày | Đúng với chuỗi đầu vào | P0 | Có (G: test_rainfall) |
| GIS-02 | Chuỗi mưa thiếu giờ, rỗng, lệch độ dài, sai thứ tự | Cửa sổ thiếu trả "missing", không bao giờ thành 0 | P0 | Có (G: test_rainfall, test_rainfall_edge_cases) |
| GIS-03 | Dự báo mưa ngắn hơn 20 giờ | Không được báo là dự báo 24 giờ | P0 | Có (G) |
| GIS-04 | Ghi lại cùng quan trắc và dự báo hai lần | Không tạo bản ghi trùng | P1 | Có (G: test_rainfall, cần DB có seed) |
| GIS-05 | Mưa trực tiếp: ranh giới giờ, lịch Việt Nam, đơn vị hoặc giá trị sai, giờ trùng | Giá trị sai bị loại hoặc đánh dấu thiếu; giờ trùng bị từ chối | P1 | Có (G: test_live_rainfall) |
| GIS-06 | Mưa trực tiếp: gọi lại quá sớm, lỗi nhà cung cấp, nhiều worker | Bỏ qua lần gọi gần đây; lỗi thì thử lại sau 5 phút; chỉ worker chính gọi; lỗi không lưu thành dữ liệu mới | P1 | Có (G: test_live_rainfall) |
| GIS-07 | Trích địa hình: phẳng, nghiêng đều, vách, ô không có dữ liệu, vĩ độ khác nhau | Độ dốc, độ cao, chênh cao đúng; ô không dữ liệu bị loại; khoảng cách tính theo mét | P1 | Có (G: test_terrain, test_terrain_benchmarks) |
| GIS-08 | DEM lỗi khi trích địa hình | Ghi nguồn `FALLBACK_SYNTHETIC`. **Cần xác minh:** snapshot và giao diện có đánh dấu chất lượng thấp cho đơn vị này không | P0 | Chưa |
| GIS-09 | Tạo snapshot tại một thời điểm phát hành | Chỉ dùng dữ liệu có `available_at` không muộn hơn thời điểm đó; dự báo tương lai bị từ chối | P0 | Có (G: test_snapshots, test_snapshot_invariants) |
| GIS-10 | Snapshot khi thiếu địa hình hoặc quan trắc hỏng | Chất lượng "stale" hoặc "missing"; không điền 0 | P0 | Có (G) |
| GIS-11 | Tạo lại snapshot cùng khóa | **Cần xác minh:** yêu cầu là bất biến; tài liệu truy vết từng ghi nhận mã ghi đè | P1 | Chưa |
| GIS-12 | 17 route HTTP của GIS: tham số sai, đơn vị không tồn tại, snapshot không tồn tại | 4xx đúng nghĩa, không 500 | P1 | Một phần (G: test_api, test_api_terrain_snapshots; 4 route chưa có test: `rainfall/live/history`, `rainfall/warning/sites`, `rainfall/warning/replay/{id}`, `snapshots/latest/{unit_id}`) |
| GIS-13 | `/health`, tiling, vector tile | Trả đúng định dạng | P2 | Chưa |

### 7.6 AI — Dịch vụ suy luận

| ID | Kịch bản | Kết quả mong đợi | P | Tự động |
| --- | --- | --- | --- | --- |
| AI-01 | Gọi dự báo 24h khi chưa có mô hình hoặc thiếu snapshot | Trả `unavailable` kèm lý do; không có điểm số | P0 | Có (A: test_forecast_contract) |
| AI-02 | Sai schema, sai horizon, sai đơn vị; thời điểm phát hành không có múi giờ | Từ chối | P1 | Có (A) |
| AI-03 | GRU trực tiếp: so với checkpoint chuẩn; mưa thiếu hoặc sai; thiếu độ ẩm đất; trọng số bị đổi | Khớp checkpoint; đầu vào thiếu bị từ chối, không tự điền; sai digest thì không chạy | P0 | Có (A: test_live_gru) |
| AI-04 | Thông tin mô hình và thẻ mô hình | Nêu rõ trạng thái thử nghiệm và giới hạn của GRU | P1 | Có (A; C: ModelCardApiTest) |
| AI-05 | Tên scene cố thoát khỏi thư mục scene, kể cả đường dẫn kiểu Windows | Từ chối | P0 | Có (A: test_inference) |
| AI-06 | Suy luận ảnh cũ: chưa có file mô hình; pixel không hợp lệ | Báo chưa sẵn sàng; pixel không hợp lệ giữ NaN | P2 | Có (A) |
| AI-07 | Lắng nghe sự kiện Redis | Nhận sự kiện, lỗi không làm sập dịch vụ | P2 | Chưa |

### 7.7 FJOB — Điều phối job dự báo

| ID | Kịch bản | Kết quả mong đợi | P | Tự động |
| --- | --- | --- | --- | --- |
| FJOB-01 | Staff tạo job dự báo | 202; lưu ở trạng thái chờ | P1 | Có (C: ForecastJobApiTest) |
| FJOB-02 | Gửi lại cùng khóa idempotency | Trả cùng một run, không tạo thêm | P0 | Có (C) |
| FJOB-03 | AI không sẵn sàng khi chạy job | Run ở trạng thái `unavailable` kèm lý do; không có số liệu bịa | P0 | Có (C) |
| FJOB-04 | Citizen tạo job | 403 | P0 | Có (C) |
| FJOB-05 | Xem hàng đợi job | Chỉ có job đang chờ hoặc đang chạy | P2 | Có (C) |
| FJOB-06 | Job kẹt quá 5 phút; Core khởi động lại giữa chừng | Job được khôi phục, tối đa 3 lần thử; không mất job | P1 | Chưa |
| FJOB-07 | AI hoặc GIS lỗi liên tiếp | Circuit breaker mở (cửa sổ 10 lần gọi, ngưỡng 50%), thử lại sau 5 giây; trang chẩn đoán chỉ admin xem được | P1 | Một phần (C: phân quyền; hành vi ngắt mạch chưa) |

### 7.8 FREV — Thẩm định dự báo

| ID | Kịch bản | Kết quả mong đợi | P | Tự động |
| --- | --- | --- | --- | --- |
| FREV-01 | Officer mở hàng đợi thẩm định | Có run chờ duyệt kèm hình học, hạn hiệu lực, bằng chứng; citizen bị 403 | P0 | Có (C: ForecastReviewQueueApiTest) |
| FREV-02 | Lọc hàng đợi bằng trạng thái không hợp lệ | 400 | P2 | Có (C) |
| FREV-03 | Phê duyệt một đề xuất | Tạo bản ghi thẩm định; người duyệt lấy từ token; trạng thái đổi; giao diện cập nhật không cần tải lại | P0 | Có (C; E: review.spec) |
| FREV-04 | Từ chối không ghi lý do | API trả 400; giao diện bắt buộc nhập lý do | P0 | Có (C; E: review.spec) |
| FREV-05 | Duyệt run đã hết hạn; duyệt lần hai; phê duyệt run `unavailable` | 409 cả ba | P0 | Có (C) |
| FREV-06 | Sau khi duyệt, công dân lấy danh sách dự báo đang hiệu lực | Chỉ có run đã duyệt, còn hạn, khả dụng, kèm hình học và thời hạn; run bị thu hồi biến mất ở lần lấy sau | P0 | Có (C: ForecastApiTest) |
| FREV-07 | Nhật ký thẩm định | Có lịch sử kèm người duyệt; hộp thoại có tóm tắt và chuyển được khoảng 30 ngày | P1 | Có (C; E: reviewkpi.spec) |
| FREV-08 | KPI thẩm định | Đếm quyết định, thời gian ra quyết định, số hết hạn chưa duyệt; chưa có quyết định thì hiện gạch, không phải "0 phút"; chỉ staff | P1 | Có (C: ForecastReviewMetricsApiTest; W: test-review-kpi; E) |
| FREV-09 | KPI khi API lỗi | Dải KPI ẩn thẻ đó, hàng đợi vẫn dùng được | P2 | Có (E: reviewkpi.spec) |
| FREV-10 | So sánh các lần chạy dự báo của một đơn vị | Hiện đúng các run, đánh dấu run bị thay thế | P2 | Chưa |
| FREV-11 | Phê duyệt một đề xuất rồi kiểm tra tác dụng phụ | Không tự phát cảnh báo; không tự tạo sự cố đã xác nhận | P0 | Chưa |

### 7.9 DASH — Bảng điều hành WebGIS

| ID | Kịch bản | Kết quả mong đợi | P | Tự động |
| --- | --- | --- | --- | --- |
| DASH-01 | Mở bảng điều hành | Bản đồ và các đơn vị dự báo hiện đúng màu theo mức nguy cơ; lỗi bản đồ không làm trắng trang | P1 | Một phần (W: test-map-config-and-layers) |
| DASH-02 | Chọn một đơn vị | Bảng chi tiết và bằng chứng mưa hiện ở hai tab; trục giờ đọc được; ghi rõ nguồn mưa | P1 | Một phần (W: test-weather, test-time-formatting) |
| DASH-03 | Đơn vị có dự báo `unavailable`, hết hạn, bị thay thế | Đánh dấu rõ từng trạng thái; không hiện như nguy cơ thấp | P0 | Một phần (W: test-forecast-status) |
| DASH-04 | Bảng mưa trực tiếp và thời tiết 7 ngày | Số liệu khớp API GIS; dữ liệu cũ có ghi tuổi | P1 | Một phần (W: test-weather) |
| DASH-05 | Lớp GRU thử nghiệm | Chỉ staff thấy; có nhãn thử nghiệm; điểm cũ, hết hạn, thiếu số liệu không đọc như hiện tại | P0 | Một phần (W: test-experimental-risk) |
| DASH-06 | Lớp sạt lở đã xác nhận | Có dữ liệu thì có nút bật kèm số lượng; không có hoặc lỗi thì không có nút và trang vẫn chạy; hình học hỏng bị bỏ | P1 | Có (E: confirmed.spec; W) |
| DASH-07 | Có đề xuất mới khi đang mở trang | Hàng đợi tự tải lại, không chờ 60 giây; luồng bị 403 không làm hỏng trang; luồng chỉ staff nhận | P1 | Có (E: liveupdates.spec; C: LiveUpdatesApiTest) |
| DASH-08 | Thanh điều hướng theo vai trò | Officer không thấy menu "Quản trị" và nút "Phát cảnh báo"; menu "Công cụ" đủ 5 mục; không tràn ở 1440 px | P0 | Một phần (E: dialogs.spec) |
| DASH-09 | Mở từng hộp thoại rồi bấm Escape | Mở đúng, Escape đóng | P2 | Có (E: dialogs.spec) |
| DASH-10 | Xuất báo cáo CSV | Đủ cột dự báo, nhật ký, lịch sử; tọa độ đúng độ chính xác; tiếng Việt có dấu mở đúng trong Excel | P1 | Một phần (W: test-report-export; mở bằng Excel chưa) |
| DASH-11 | Thẻ mô hình | Có băng thử nghiệm, ngưỡng, ghi GRU chưa hiệu chuẩn; AI lỗi thì không hiện số | P1 | Có (E: modelcard.spec; C) |
| DASH-12 | Tình trạng hệ thống | Hiện đủ các thành phần và độ tươi dữ liệu; chỉ admin | P1 | Một phần (C: AdminSystemHealthApiTest; W: test-system-health) |
| DASH-13 | Bố cục ở nhiều bề rộng | Thẻ thông tin và nút bản đồ không chồng nhau | P2 | Có (E: maplayout.spec) |
| DASH-14 | Dùng trên điện thoại (360 px) và máy tính bảng (768 px) | Thanh tab di động hoạt động; không cuộn ngang | P2 | Một phần (W: test-responsive-utilities) |
| DASH-15 | Điều hướng chỉ bằng bàn phím; trình đọc màn hình | Vào được mọi nút chính; nhãn nút đọc được; tiêu điểm không thoát khỏi hộp thoại đang mở | P2 | Chưa |

### 7.10 INC — Sự cố sạt lở đã ghi nhận

| ID | Kịch bản | Kết quả mong đợi | P | Tự động |
| --- | --- | --- | --- | --- |
| INC-01 | Mở hàng đợi sự cố, xác minh sự cố khi chưa đăng nhập hoặc bằng citizen | 401 hoặc 403; người xác minh lấy từ token | P0 | Có (C: AuthControllerTest) |
| INC-02 | Lấy sự cố đang hiệu lực, kiểm tra geofence, đồng bộ offline | Công khai; trả GeoJSON hợp lệ | P1 | Chưa |
| INC-03 | Xác minh thiếu mức nguy cơ, id không tồn tại, sai trạng thái | 4xx, không 500 | P1 | Chưa |

### 7.11 SUB — Đăng ký nhận tin và thiết bị

| ID | Kịch bản | Kết quả mong đợi | P | Tự động |
| --- | --- | --- | --- | --- |
| SUB-01 | Đăng ký vùng với kênh PUSH, SMS, hoặc cả hai | Phải có ít nhất một kênh; chọn SMS thì cần số điện thoại hợp lệ | P1 | Có (C: ProfileAndSubscription*) |
| SUB-02 | Đăng ký lại cùng vùng | Cập nhật bản ghi cũ, không tạo trùng | P1 | Có (C) |
| SUB-03 | Xem và hủy đăng ký | Chỉ chủ sở hữu hủy được; người khác nhận 404; hủy trả 204 | P0 | Có (C) |
| SUB-04 | Đăng ký token thiết bị trên hai tài khoản lần lượt | Token thuộc tài khoản đăng ký sau cùng | P0 | Có (C: PushAlertsApiTest) |
| SUB-05 | Đăng xuất trên mobile | Gỡ token; không còn nhận push của tài khoản đó | P0 | Một phần (M: push_alerts_test; thiết bị thật chưa) |
| SUB-06 | Mobile: màn đăng ký vùng khi server lỗi | Hiện lỗi, không báo thành công giả | P1 | Có (M: profile_subscriptions_test) |

### 7.12 BRD — Phát cảnh báo khẩn cấp (admin)

| ID | Kịch bản | Kết quả mong đợi | P | Tự động |
| --- | --- | --- | --- | --- |
| BRD-01 | Phát, xem trước, xem lịch sử, thu hồi bằng officer, citizen, hoặc chưa đăng nhập | 403 hoặc 401 | P0 | Có (C: AuthControllerTest, BroadcastAdminApiTest, PushAlertsApiTest) |
| BRD-02 | Xem trước người nhận theo vùng | Đếm đúng thiết bị nhận push và số điện thoại nhận SMS | P0 | Có (C: BroadcastAdminApiTest, SmsBroadcastApiTest) |
| BRD-03 | Soạn tin dài quá 160 ký tự | Bộ đếm cảnh báo và không cho phát | P1 | Chưa |
| BRD-04 | Mức nguy cơ không hợp lệ | 400 | P1 | Có (C) |
| BRD-05 | Bước xác nhận: gõ sai cụm xác nhận; vùng không có thiết bị | Nút phát chỉ bật khi gõ đúng "XAC NHAN" và có ít nhất một thiết bị | P0 | Một phần (E: broadcast.spec đi tới bước xác nhận) |
| BRD-06 | Phát cho vùng có công dân đăng ký push | Lưu lệnh phát và kết quả từng người nhận; số thành công, thất bại đúng | P0 | Có (C: PushAlertsApiTest, GoogleFcmSenderTest) |
| BRD-07 | Phát cho vùng không có người nhận | Không tạo lệnh phát | P1 | Có (C) |
| BRD-08 | Phát dẫn chiếu một dự báo | Chỉ nhận dự báo đã duyệt còn hạn; chờ duyệt hoặc hết hạn trả 409; lưu run và thời hạn | P0 | Có (C) |
| BRD-09 | Gửi lại cùng mã sự kiện | 409; người dân không nhận hai lần | P0 | Có (C) |
| BRD-10 | Một thiết bị gửi lỗi; một token đã gỡ app | Ghi `failed`; token chết bị quên; người nhận vẫn lấy được cảnh báo khi đồng bộ lại | P0 | Có (C) |
| BRD-11 | Phát kèm giai đoạn sự cố: trước, trong, sau | SMS tới người đăng ký kênh SMS; giai đoạn lạ trả 400 | P1 | Có (C: SmsBroadcastApiTest) |
| BRD-12 | Nhà cung cấp SMS lỗi | Ghi nhận lỗi SMS; push vẫn gửi | P0 | Có (C) |
| BRD-13 | Lịch sử lệnh | Mới nhất trước; có số liệu, người gửi, trạng thái thu hồi | P1 | Có (C; W: test-broadcast-history) |
| BRD-14 | Thu hồi một cảnh báo | Có bước xác nhận; sau thu hồi mobile và web công dân hiện "đã thu hồi" | P0 | Một phần (C; giao diện chưa) |
| BRD-15 | Xem kết quả gửi theo người nhận và kênh | Khớp với kết quả thực | P1 | Chưa |
| BRD-16 | Core trả kết quả thất bại hoặc gửi được một phần | **Cần xác minh:** giao diện không được báo "thành công" khi có thất bại | P0 | Chưa |
| BRD-17 | Đo thời gian sau khi xác nhận | Push tới thiết bị trong 30 giây; SMS tới cổng nhà cung cấp trong 60 giây (PRD FR4) | P1 | Chưa |
| BRD-18 | SMS tiếng Việt có dấu qua sandbox | Nội dung không vỡ ký tự; ghi nhận số phân đoạn | P2 | Chưa |
| BRD-19 | Dự báo đang `unavailable` | Hệ thống không tự phát; admin vẫn phát thủ công được | P0 | Chưa |
| BRD-20 | Chọn kênh SMS trên giao diện phát | **Cần xác minh:** giao diện còn ghi chú SMS chưa kết nối trong khi Core đã có SMS | P1 | Chưa |

### 7.13 ALR — Nhận cảnh báo (mobile và web công dân)

| ID | Kịch bản | Kết quả mong đợi | P | Tự động |
| --- | --- | --- | --- | --- |
| ALR-01 | Nhận push khi app đang mở, chạy nền, đã tắt | Hiện màn cảnh báo khẩn cấp với nội dung, mức, thời hạn | P0 | Một phần (M: alert_screens_test; thiết bị thật chưa) |
| ALR-02 | Cùng một cảnh báo đến hai lần | Chỉ một dòng trong lịch sử | P1 | Có (M: push_alerts_test) |
| ALR-03 | Push đến muộn sau khi cảnh báo đã thu hồi | Vẫn là "đã thu hồi" | P0 | Có (M) |
| ALR-04 | Mở app sau thời gian mất mạng | Lấy cảnh báo bỏ lỡ trong 7 ngày và các lệnh thu hồi; gộp với cái đã có | P0 | Có (M; C: PushAlertsApiTest) |
| ALR-05 | Đồng bộ khi không có mạng | Báo lỗi; lịch sử giữ nguyên | P1 | Có (M) |
| ALR-06 | Cảnh báo tới đúng thời điểm hết hạn | Chuyển sang hết hạn đúng tại `valid_until`; không bao giờ ghi "an toàn" | P0 | Có (M) |
| ALR-07 | Hệ thống chặn thông báo của app | App cảnh báo người dùng và vẫn hoạt động | P1 | Có (M) |
| ALR-08 | Còi và rung ở chế độ im lặng, không làm phiền | Ghi lại hành vi trên từng thiết bị đích | P1 | Chưa |
| ALR-09 | Web công dân: lịch sử 7 ngày, trạng thái rỗng, hướng dẫn an toàn, vị trí của tôi, tab trên điện thoại | Hiện đúng; không có bảng chỉ dành cho staff | P1 | Một phần (E: auth.spec; W: test-zone-location) |

### 7.14 RPT — Báo cáo hiện trường

| ID | Kịch bản | Kết quả mong đợi | P | Tự động |
| --- | --- | --- | --- | --- |
| RPT-01 | Gửi báo cáo khi chưa đăng nhập | 401 | P0 | Có (C: FieldReportApiTest) |
| RPT-02 | Gửi báo cáo cố ghi danh tính người khác | Danh tính luôn lấy từ token | P0 | Có (C) |
| RPT-03 | Sai dữ liệu: tọa độ ngoài phạm vi, thiếu thời điểm quan sát, thời điểm ở tương lai quá 5 phút, khoảng thời gian ngược, không ảnh và không mô tả, mô tả quá 2000 ký tự | 400 | P1 | Có (C: FieldReportApiTest, FieldReportServiceTest) |
| RPT-04 | Gửi lại cùng mã báo cáo | Lần đầu 201, lần sau 200; chỉ một bản ghi; thời điểm quan sát tách khỏi thời điểm nhận | P0 | Có (C) |
| RPT-05 | Tải ảnh: hợp lệ, quá 700.000 byte, không phải ảnh, base64 hỏng | Hợp lệ thì lưu; còn lại 400 | P1 | Có (C) |
| RPT-06 | Dùng hoặc xem ảnh của người khác | Từ chối | P0 | Có (C) |
| RPT-07 | Công dân xem lại ảnh của chính mình | **Cần xác minh:** `SecurityConfig` chỉ cho staff xem ảnh; chốt kỳ vọng nghiệp vụ | P1 | Chưa |
| RPT-08 | Danh sách đầy đủ báo cáo | Chỉ staff, vì có số điện thoại và tọa độ; công dân chỉ xem báo cáo của mình | P0 | Có (C: AuthControllerTest, FieldReportApiTest) |
| RPT-09 | Staff đổi trạng thái: mới gửi, đã xử lý, lưu trữ; citizen thử đổi | Staff đổi được; citizen bị từ chối | P1 | Một phần (C: nhánh officer) |
| RPT-10 | Mobile có mạng: gửi ảnh rồi gửi báo cáo | Thành công; thời gian theo UTC | P1 | Có (M: field_report_test) |
| RPT-11 | Mobile mất mạng rồi có lại | Báo cáo nằm trong hàng đợi; gửi lại cùng mã; ảnh đã tải không tải lại | P0 | Có (M) |
| RPT-12 | Mobile: server trả 400; server lỗi; phiên hết hạn | 400 thì đánh dấu thất bại kèm lý do và không thử lại; hai trường hợp sau giữ chờ | P1 | Có (M) |
| RPT-13 | Mobile: đổi tài khoản khi còn báo cáo chờ | Chỉ gửi báo cáo của người đang đăng nhập | P0 | Có (M) |
| RPT-14 | Mobile: màn gửi báo cáo và "Báo cáo của tôi" | Cần vị trí, rồi ảnh hoặc mô tả; thông báo đúng khi có mạng và mất mạng; trạng thái cập nhật từ server | P1 | Có (M: report_screen_test, field_report_test) |
| RPT-15 | Web: danh sách báo cáo của staff | Lọc trạng thái, xem ảnh (cần đăng nhập), đổi trạng thái, làm mới | P1 | Chưa |

### 7.15 GEO — Geofencing ngoại tuyến (mobile)

| ID | Kịch bản | Kết quả mong đợi | P | Tự động |
| --- | --- | --- | --- | --- |
| GEO-01 | Đồng bộ vùng dự báo | Thay toàn bộ bộ nhớ đệm trong một giao dịch; ghi thời điểm đồng bộ | P0 | Có (M: offline_geofence_test, zone_store_sqlite_test) |
| GEO-02 | Đồng bộ lỗi giữa chừng; dữ liệu server hỏng | Giữ nguyên bộ nhớ đệm cũ; dữ liệu hỏng bị từ chối toàn bộ | P0 | Có (M) |
| GEO-03 | Vùng bị thu hồi hoặc thay thế trên server | Biến mất trên máy sau lần đồng bộ kế | P0 | Có (M) |
| GEO-04 | Đồng bộ khi mất mạng | Không đổi gì; hiện thời điểm đồng bộ cuối | P1 | Có (M) |
| GEO-05 | Đứng trong vùng còn hạn; trên cạnh; trên đỉnh | Báo động với mức cao nhất và hạn sớm nhất | P0 | Có (M: offline_geofence_test, geo_math_test) |
| GEO-06 | Thời điểm đúng bằng `valid_until`, đúng bằng `valid_from`, sớm hơn 1 ms | Hết hạn; hợp lệ; chưa hợp lệ | P0 | Có (M) |
| GEO-07 | Đứng trong vùng đã hết hạn | "Dữ liệu cũ"; không báo động; không có chữ "an toàn" | P0 | Có (M) |
| GEO-08 | Đứng ngoài mọi vùng, dữ liệu mới | "Không có cảnh báo hiện tại", kèm câu đây không phải xác nhận an toàn | P0 | Có (M) |
| GEO-09 | Đồng bộ đã quá 24 giờ; chưa từng đồng bộ | Điểm ngoài vùng là "dữ liệu cũ"; vùng còn hạn vẫn báo động | P0 | Có (M) |
| GEO-10 | Đi lại nhiều lần trong cùng một vùng; có run mới | Còi một lần cho mỗi run; run mới thì kêu lại | P1 | Có (M) |
| GEO-11 | Bộ nhớ đệm 10.000 vùng | Lưu, tra cứu, quyết định đúng | P1 | Có (M: zone_store_sqlite_test) |
| GEO-12 | Từ chối quyền vị trí; tắt GPS | Hiện thông báo, không văng app | P1 | Có (M) |
| GEO-13 | Server ghi thời gian ở múi giờ khác | Cùng một thời điểm | P1 | Có (M) |
| GEO-14 | Thiết bị thật: bật chế độ máy bay rồi đi vào và ra khỏi vùng; app chạy nền; pin yếu | Báo động đúng lúc; ghi lại độ trễ và hành vi nền | P0 | Chưa |

### 7.16 MAP — Bản đồ nguy cơ (mobile) và trang demo mô hình

| ID | Kịch bản | Kết quả mong đợi | P | Tự động |
| --- | --- | --- | --- | --- |
| MAP-01 | Tải vùng nguy cơ đang hiệu lực | Hiện đa giác và điểm đánh dấu; giá trị thiếu có mặc định an toàn | P1 | Có (M: map_test) |
| MAP-02 | Có và không có khóa MapTiler | Có khóa thì dùng nền như web; không có thì dùng nền miễn phí | P2 | Có (M) |
| MAP-03 | Thiết bị thật: phóng to, kéo, chạm vào vùng | Mượt; thông tin vùng đúng | P2 | Chưa |
| MAP-04 | Mở `/model-demo` khi chưa đăng nhập | Trang mở được, có nhãn demo, dữ liệu demo hiện đúng | P2 | Một phần (W: `npm run test:model-demo`) |

### 7.17 AUD — Nhật ký quản trị

| ID | Kịch bản | Kết quả mong đợi | P | Tự động |
| --- | --- | --- | --- | --- |
| AUD-01 | Khóa tài khoản, đổi vai trò, duyệt cán bộ, phát và thu hồi cảnh báo | Mỗi thao tác có một dòng nhật ký với người thực hiện và thời điểm | P0 | Có (C: AdminAuditApiTest) |
| AUD-02 | Đọc nhật ký bằng officer hoặc citizen | 403 | P0 | Có (C) |
| AUD-03 | Giao diện "Nhật ký quản trị" | Hiện và lọc đúng | P2 | Một phần (W: test-admin-audit) |

### 7.18 GW — Gateway

| ID | Kịch bản | Kết quả mong đợi | P | Tự động |
| --- | --- | --- | --- | --- |
| GW-01 | Gọi các route ghi dữ liệu của GIS và mọi route AI qua gateway | 403 | P0 | Có (GW: check-routes.sh) |
| GW-02 | Gọi từng nhóm route công khai qua gateway | Tới đúng dịch vụ | P1 | Một phần (GW) |
| GW-03 | Vượt 50 yêu cầu mỗi giây từ một IP | Bị giới hạn; dùng bình thường không bị chặn nhầm | P1 | Chưa |
| GW-04 | Trình duyệt gọi API khác nguồn | Chỉ một header `Access-Control-Allow-Origin`; preflight qua | P1 | Chưa |
| GW-05 | Giữ luồng cập nhật trực tiếp qua gateway trong 10 phút | Không bị cắt, sự kiện tới ngay | P1 | Chưa |
| GW-06 | Tải ảnh báo cáo cỡ sát giới hạn qua gateway | Không bị gateway chặn vì kích thước | P1 | Chưa |

## 8. Yêu cầu phi chức năng và kịch bản kiểm thử

PRD chỉ định lượng thời gian gửi cảnh báo; các ngưỡng còn lại do tài liệu này suy ra từ chuẩn ngành và nhóm chưa phê duyệt. Danh mục xếp theo mô hình chất lượng ISO/IEC 25010:2023, gồm chín đặc tính.[1] Bản 2023 thêm đặc tính an toàn và thay "usability", "portability" bằng "interaction capability", "flexibility".[2]

Cột **Nguồn** phân biệt ba loại:

- **PRD:** đã có trong PRD v5.
- **Chuẩn:** con số hoặc yêu cầu lấy nguyên từ tài liệu được dẫn.
- **Đề xuất:** ước lượng kỹ thuật của người lập kế hoạch; không chuẩn nào quy định con số này, nhóm có thể chỉnh.

Chưa ngưỡng nào được đo. Cột **Hiện trạng** chỉ ghi điều đã thấy trong mã nguồn hoặc kết quả build ngày 2026-11-13.

**Giả định tải thí điểm (Đề xuất):** 1 vùng giám sát, 20 cán bộ dùng đồng thời, 10.000 công dân đăng ký nhận tin, 10.000 vùng dự báo trong bộ nhớ đệm mobile (con số cuối lấy từ PRD FR5).

### 8.1 Danh mục yêu cầu phi chức năng

#### Hiệu năng

| ID | Yêu cầu | Nguồn | Hiện trạng | Kiểm bằng |
| --- | --- | --- | --- | --- |
| NFR-P01 | API đọc qua gateway: p95 không quá 500 ms, p99 không quá 1 giây ở tải giả định | Đề xuất, suy từ giới hạn 1 giây để người dùng không bị ngắt mạch thao tác [3] | Chưa đo | PERF-01, PERF-02 |
| NFR-P02 | Thao tác quá 1 giây phải có chỉ báo đang xử lý; quá 10 giây phải có tiến độ hoặc cho làm việc khác | Chuẩn [3] | Chưa kiểm | PERF-07 |
| NFR-P03 | WebGIS đạt LCP không quá 2,5 giây, INP không quá 200 ms, CLS không quá 0,1, tính ở phân vị 75 | Chuẩn [4] | Chưa đo | PERF-05 |
| NFR-P04 | Tổng dung lượng tải lần đầu của WebGIS dưới 1.600 KiB | Chuẩn [5] | JS và CSS sau nén khoảng 544 kB; chưa tính worker bản đồ 509 kB chưa nén và ảnh nền bản đồ | PERF-05 |
| NFR-P05 | Push tới thiết bị trong 30 giây, SMS tới cổng nhà cung cấp trong 60 giây sau khi admin xác nhận | PRD FR4 | Chưa đo | BRD-17 |
| NFR-P06 | Phát tới 10.000 người nhận: giao hết cho FCM trong 5 phút, yêu cầu HTTP của admin không hết thời gian chờ | Đề xuất | Chưa đo | PERF-03 |
| NFR-P07 | Sự kiện mới hiện trên bảng điều hành trong 5 giây | Đề xuất | Chưa đo | PERF-08 |
| NFR-P08 | Mobile khởi động nguội dưới 5 giây, khởi động ấm dưới 2 giây | Chuẩn [6] | Chưa đo | PERF-09 |
| NFR-P09 | Mobile quyết định geofence trong 1 giây mỗi lần định vị với 10.000 vùng | Đề xuất (dung lượng theo PRD FR5) | Có test dung lượng; chưa đo thời gian trên máy thật | PERF-04 |
| NFR-P10 | Gateway không giới hạn nhầm 20 cán bộ dùng đồng thời | Đề xuất | Giới hạn 50 yêu cầu mỗi giây mỗi IP, burst 20 | PERF-06 |

#### Độ tin cậy

| ID | Yêu cầu | Nguồn | Hiện trạng | Kiểm bằng |
| --- | --- | --- | --- | --- |
| NFR-R01 | Luồng cảnh báo (gateway, Core, cơ sở dữ liệu) sẵn sàng ít nhất 99,5% mỗi tháng trong mùa mưa | Đề xuất | Không đo được trên môi trường demo; kiểm gián tiếp bằng kịch bản lỗi | REL-01 đến REL-04 |
| NFR-R02 | Một dịch vụ chết thì tự chạy lại trong 2 phút, không cần thao tác tay | Đề xuất | Mọi container có `restart: always`; chưa có healthcheck | REL-04, REL-09 |
| NFR-R03 | Sao lưu cơ sở dữ liệu hằng ngày; mất tối đa 24 giờ dữ liệu; khôi phục trong 4 giờ; có diễn tập khôi phục | Đề xuất | Chưa có script sao lưu trong repo | REL-10 |
| NFR-R04 | Cảnh báo đi qua ít nhất hai kênh; một kênh lỗi không chặn kênh còn lại | Chuẩn [32], PRD FR4 | Có push và SMS, đã có test | BRD-12 |
| NFR-R05 | Mobile: dưới 1,09% người dùng mỗi ngày gặp crash, dưới 0,47% gặp ANR | Chuẩn [6] | Chỉ đo được sau khi phát hành; trước đó dùng tiêu chí không crash trong toàn bộ E2E | REL-11 |
| NFR-R06 | Không mất và không lặp: job dự báo, báo cáo hiện trường, lệnh phát | PRD mục 5 | Đã có test | FJOB-02, RPT-04, BRD-09 |

#### Bảo mật

| ID | Yêu cầu | Nguồn | Hiện trạng | Kiểm bằng |
| --- | --- | --- | --- | --- |
| NFR-S01 | Mật khẩu tối thiểu 8 ký tự, khuyến nghị 15; cho phép ít nhất 64 ký tự | Chuẩn [15][14] | 8 đến 72 ký tự. Đạt mức tối thiểu của ASVS; NIST yêu cầu 15 ký tự khi mật khẩu là yếu tố xác thực duy nhất [14] | SEC-13 |
| NFR-S02 | Từ chối mật khẩu nằm trong danh sách phổ biến (ít nhất 3.000 mật khẩu hàng đầu) | Chuẩn [15] | Chưa thấy trong mã; cần xác minh | SEC-13 |
| NFR-S03 | Giới hạn số lần đăng nhập sai liên tiếp trên một tài khoản, trần là 100 lần | Chuẩn [14][15] | Chỉ có giới hạn tần suất chung ở gateway | SEC-08 |
| NFR-S04 | Mọi kết nối từ bên ngoài dùng TLS 1.2 hoặc 1.3, có HSTS | Chuẩn [21][16] | Gateway chỉ nghe HTTP cổng 80 | SEC-14 |
| NFR-S05 | CORS chỉ cho nguồn trong danh sách tin cậy | Chuẩn [16] | Đang cho mọi nguồn kèm credentials | SEC-09 |
| NFR-S06 | Phản hồi có `Content-Security-Policy` (kèm `frame-ancestors`) và `X-Content-Type-Options: nosniff` | Chuẩn [16] | Chưa có trong cấu hình nginx | SEC-15 |
| NFR-S07 | Phân quyền theo chức năng và theo từng bản ghi, thực thi ở server | Chuẩn [19] | Có; route chưa khai báo còn mở mặc định | SEC-01, SEC-02, SEC-04 |
| NFR-S08 | Token tự chứa được kiểm chữ ký và thời hạn trước khi dùng | Chuẩn [20] | Đã có test | AUTH-08 |
| NFR-S09 | Admin chấm dứt được phiên của một người dùng | Chuẩn [18] | Khóa tài khoản có hiệu lực ngay | USR-03 |
| NFR-S10 | Đổi mật khẩu làm mọi token cũ hết hiệu lực | Đề xuất | Chưa có | AUTH-17 |
| NFR-S11 | Bí mật do kho bí mật quản lý, không nằm trong repo; khóa ký JWT ngẫu nhiên từ 256 bit | Chuẩn [22] cho kho bí mật; độ dài khóa là Đề xuất | `.env.example` chứa giá trị dùng được | SEC-03 |
| NFR-S12 | Tệp tải lên bị giới hạn kích thước và được kiểm nội dung khớp loại tệp | Chuẩn [17] | Đã có test | SEC-06 |
| NFR-S13 | Ghi log mọi lần xác thực (thành công và thất bại) và mọi lần bị từ chối quyền; lỗi trả thông báo chung, không lộ chi tiết nội bộ | Chuẩn [24] | Cần xác minh | SEC-16 |
| NFR-S14 | Dữ liệu nhạy cảm không nằm trên URL | Chuẩn [23] | Cần xác minh: `GET /auth/email-exists` nhận email | SEC-16 |
| NFR-S15 | Mobile được đánh giá theo các nhóm MASVS: lưu trữ, mạng, xác thực, nền tảng | Chuẩn [25] | Chưa đánh giá | SEC-17 |
| NFR-S16 | Không còn lỗ hổng mức cao trong thư viện phụ thuộc | Đề xuất | `npm audit` của WebGIS báo 8 mục | SEC-12 |

#### Quyền riêng tư

Nghị định 13/2023/NĐ-CP đã hết hiệu lực từ 2026-01-01 và được thay bằng Nghị định 356/2025/NĐ-CP, nên căn cứ hiện hành là Luật 91/2025/QH15 và nghị định này.[27]

| ID | Yêu cầu | Nguồn | Hiện trạng | Kiểm bằng |
| --- | --- | --- | --- | --- |
| NFR-V01 | App thông báo cho người dùng việc sử dụng dữ liệu vị trí và cho họ tùy chọn theo dõi vị trí | Chuẩn [26] | Cần xác minh | PRIV-01 |
| NFR-V02 | Người dùng được biết, đồng ý hoặc rút đồng ý, xem, sửa và yêu cầu xóa dữ liệu cá nhân | Chuẩn [26] | Xem và sửa hồ sơ đã có; chưa có chức năng xóa tài khoản | PRIV-02 |
| NFR-V03 | Có quy trình thông báo vi phạm dữ liệu cho cơ quan chuyên trách trong 72 giờ; với dữ liệu vị trí còn phải báo chủ thể dữ liệu trong 72 giờ | Chuẩn [26][28] | Chưa có quy trình | PRIV-03 |
| NFR-V04 | Vị trí liên tục chỉ xử lý trên thiết bị; tọa độ chỉ gửi đi khi người dùng chủ động gửi báo cáo | PRD FR5 | Cần xác minh bằng bắt gói tin | PRIV-04 |
| NFR-V05 | Có thời hạn lưu giữ cho báo cáo hiện trường, số điện thoại, lịch sử gửi tin; dữ liệu quá hạn được xóa | Đề xuất, theo hướng của ASVS về lưu giữ dữ liệu nhạy cảm [23] | Chưa có | PRIV-02 |

#### Khả năng tương tác và truy cập

| ID | Yêu cầu | Nguồn | Hiện trạng | Kiểm bằng |
| --- | --- | --- | --- | --- |
| NFR-U01 | Chữ có độ tương phản ít nhất 4,5:1; thành phần giao diện và đồ họa ít nhất 3:1 | Chuẩn [7][8] | Tài liệu thiết kế của dự án đã đặt mục tiêu 4,5:1; chưa đo | A11Y-01 |
| NFR-U02 | Mục tiêu bấm trên web ít nhất 24 x 24 CSS pixel; trên mobile ít nhất 48 x 48 dp | Chuẩn [9][13] | Tài liệu thiết kế của dự án đặt 44 x 44 px; chưa đo | A11Y-02 |
| NFR-U03 | Dùng được ở bề rộng 320 CSS pixel không cuộn ngang; phóng chữ 200% không mất nội dung | Chuẩn [10][11] | Chưa kiểm; bản đồ là ngoại lệ hợp lý | A11Y-03 |
| NFR-U04 | Mức nguy cơ không chỉ phân biệt bằng màu | Chuẩn [12] | Cần xác minh trên bản đồ và huy hiệu mức nguy cơ | A11Y-04 |
| NFR-U05 | Mọi chức năng dùng được bằng bàn phím và trình đọc màn hình | Đề xuất, theo WCAG 2.2 mức AA | Chưa kiểm | A11Y-05, DASH-15 |
| NFR-U06 | Thao tác không hoàn tác được phải xác nhận hai bước | PRD FR4 | Phát cảnh báo và thu hồi đã có | BRD-05, BRD-14 |

#### Tương thích và liên thông

| ID | Yêu cầu | Nguồn | Hiện trạng | Kiểm bằng |
| --- | --- | --- | --- | --- |
| NFR-C01 | Mọi GeoJSON dùng hệ WGS 84, kinh độ trước vĩ độ, đơn vị độ thập phân | Chuẩn [35] | Chưa kiểm tự động | INT-01 |
| NFR-C02 | Bản ghi cảnh báo ánh xạ được sang CAP 1.2: có mã định danh, người gửi, mức khẩn cấp, mức nghiêm trọng, độ chắc chắn và thời điểm hết hạn | Chuẩn [31] | Có mức nguy cơ, người gửi, thời hạn; chưa có trường khẩn cấp và độ chắc chắn riêng | INT-02 |
| NFR-C03 | Tin cảnh báo sạt lở nêu đủ: khu vực, tình hình mưa, cảnh báo mưa tiếp theo, vùng có nguy cơ, cấp độ rủi ro, thời gian ban hành, người chịu trách nhiệm | Chuẩn [29] | Cần đối chiếu mẫu tin | INT-03 |
| NFR-C04 | Giao diện không trình bày mức nguy cơ của hệ thống như "cấp độ rủi ro thiên tai" chính thức | Chuẩn [29][30] | Hệ thống dùng 4 mức riêng; WebGIS đã ghi chú cấp mưa theo QĐ 18 không phải mức nguy cơ sạt lở | INT-03 |
| NFR-C05 | WebGIS chạy trên hai bản mới nhất của Chrome, Edge, Firefox, Safari; mobile từ Android API 23 | Đề xuất; API 23 theo cấu hình build | Chưa kiểm | COMPAT-01, COMPAT-02 |

Về NFR-C04: theo QĐ 18/2021/QĐ-TTg, bản tin do cơ quan có thẩm quyền ban hành mới là bản tin chính thức, và cấp độ rủi ro được phân tối đa 5 cấp với màu quy định sẵn.[29] Cấp độ rủi ro sạt lở trong quyết định này xác định theo lượng mưa 24 giờ, mưa trước đó và vùng nguy cơ.[30] Nhóm nên kiểm tra quyết định còn hiệu lực hay đã sửa đổi tại thời điểm bảo vệ.

#### Bảo trì, triển khai, giám sát

| ID | Yêu cầu | Nguồn | Hiện trạng | Kiểm bằng |
| --- | --- | --- | --- | --- |
| NFR-M01 | Mã mới có độ phủ test từ 80%, trùng lặp không quá 3% | Chuẩn [36] | Độ phủ toàn bộ: AI 62%, GIS 52%; Core chưa cấu hình đo | MNT-01 |
| NFR-M02 | Phân tích tĩnh không còn cảnh báo | Đề xuất | WebGIS chưa có ESLint; `flutter analyze` còn 3 mục | MNT-02 |
| NFR-M03 | CI chạy toàn bộ test cho mỗi PR, xong trong 10 phút | Đề xuất | CI mới chạy test WebGIS | MNT-03 |
| NFR-F01 | Cấu hình tách khỏi mã, đưa qua biến môi trường | Chuẩn [34] | Phần lớn đã theo | MNT-04 |
| NFR-F02 | Dựng toàn hệ thống trên máy sạch bằng một lệnh, trong 15 phút | Đề xuất | Có `docker compose up`; `demo-seed` chỉ có bản PowerShell | MNT-04 |
| NFR-O01 | Giám sát được bốn tín hiệu: độ trễ, lưu lượng, lỗi, mức bão hòa | Chuẩn [33] | Có trang tình trạng hệ thống; chưa có số liệu đo | OBS-01 |
| NFR-O02 | Mỗi dịch vụ có endpoint sức khỏe và healthcheck ở container | Đề xuất | AI và GIS có `/health`; compose chưa khai báo healthcheck | OBS-02 |

#### An toàn

Đặc tính an toàn của ISO/IEC 25010:2023 gồm các khía cạnh như "fail safe" và "hazard warning".[2] Với hệ thống này, đó chính là các nguyên tắc ở PRD mục 3; kịch bản nằm ở nhóm HON (mục 8.6).

### 8.2 SEC — Bảo mật

**Ma trận quyền** (theo `SecurityConfig` và `@PreAuthorize`; SEC-01 kiểm từng ô):

| Nhóm route | Chưa đăng nhập | Citizen | Officer | Admin |
| --- | --- | --- | --- | --- |
| `auth/register`, `login`, `google`, `officer-requests`, `email-exists`, `password-reset/**` | Được | Được | Được | Được |
| `GET monitoring-areas`; `GET landslides/active`, `geofence`, `offline-sync` | Được | Được | Được | Được |
| `auth/me/**`, `auth/password`; `alerts/**`; `GET forecasts/active`, `forecasts/offline-sync` | 401 | Được | Được | Được |
| `POST community-reports`, `community-reports/photos`; `GET community-reports/mine` | 401 | Được | Được | Được |
| `GET community-reports`, ảnh báo cáo; `PATCH community-reports/{id}/status` | 401 | 403 | Được | Được |
| `POST forecasts`; hàng đợi, thẩm định, nhật ký, KPI dự báo; `stream`; `model-card`; hàng đợi và xác minh sự cố | 401 | 403 | Được | Được |
| `notifications/**`; `POST`, `PUT monitoring-areas`; `admin/**`; `diagnostic/**` | 401 | 403 | 403 | Được |

| ID | Kịch bản | Kết quả mong đợi | P | Tự động |
| --- | --- | --- | --- | --- |
| SEC-01 | Gọi mọi route với bốn loại người dùng theo ma trận trên | Đúng từng ô | P0 | Có (C: AuthorizationMatrixTest) |
| SEC-02 | Thêm một route mới mà không khai báo quyền | Phải bị từ chối. Hiện `/api/v1/**` còn lại đang mở mặc định; kiểm mỗi khi thêm controller | P0 | Một phần (C: `AuthorizationMatrixTest.routeTableMatchesMappedRoutes` báo đỏ khi có route chưa khai báo; `SecurityConfig` vẫn `permitAll` cho `/api/v1/**`) |
| SEC-03 | Ký token bằng giá trị `JWT_SECRET` trong `.env.example` rồi gọi API trên môi trường demo | Bị từ chối, tức môi trường demo không dùng giá trị mẫu (NFR-S11) | P0 | Chưa |
| SEC-04 | Truy cập chéo: ảnh đại diện, ảnh báo cáo, đăng ký vùng, báo cáo của người khác | Từ chối | P0 | Có (C) |
| SEC-05 | Chèn ký tự đặc biệt vào bộ lọc người dùng, trạng thái, ranh giới GeoJSON, tên scene | 400, không lỗi SQL, không 500 | P0 | Một phần (C, A) |
| SEC-06 | Tải file không phải ảnh đổi đuôi; file quá cỡ | Từ chối (NFR-S12) | P1 | Có (C) |
| SEC-07 | Soát phản hồi API và log | Không có mật khẩu, mã băm, token | P0 | Một phần (C: AuthControllerTest) |
| SEC-08 | Đăng nhập sai 100 lần liên tiếp vào một tài khoản; dò email qua `email-exists` | Tài khoản bị chặn đăng nhập trước lần thứ 100 (NFR-S03); ghi lại hành vi hiện tại | P0 | Chưa |
| SEC-09 | Trang ở nguồn lạ gọi API kèm thông tin đăng nhập | Trình duyệt chặn vì nguồn không nằm trong danh sách (NFR-S05) | P1 | Chưa |
| SEC-10 | Quét cổng từ máy khác trong mạng | PostGIS, Redis, Core, AI, GIS không truy cập được; chỉ gateway mở | P0 | Chưa |
| SEC-11 | Nhập thẻ script vào tên, mô tả báo cáo, nội dung cảnh báo | Web, mobile, email hiển thị dạng chữ, không chạy | P0 | Một phần (C: SmtpPasswordResetMailerTest) |
| SEC-12 | Quét thư viện phụ thuộc của WebGIS, Core, AI, GIS, mobile | Không còn mục mức cao (NFR-S16) | P1 | Chưa |
| SEC-13 | Đặt mật khẩu 7, 8, 64 ký tự; đặt mật khẩu phổ biến như `password123` | 7 bị từ chối; 8 và 64 được nhận; mật khẩu phổ biến bị từ chối (NFR-S01, NFR-S02) | P1 | Một phần (C: giới hạn độ dài) |
| SEC-14 | Truy cập bản triển khai qua HTTP; kiểm phiên bản TLS và header HSTS | HTTP chuyển sang HTTPS; chỉ TLS 1.2 và 1.3; có HSTS (NFR-S04) | P0 | Chưa |
| SEC-15 | Đọc header phản hồi của WebGIS và API; thử nhúng WebGIS vào iframe ở trang khác | Có CSP và `nosniff`; không nhúng được (NFR-S06) | P1 | Chưa |
| SEC-16 | Đăng nhập đúng, sai, gọi route không đủ quyền, gây lỗi 500 có chủ ý; rồi đọc log và access log | Mỗi sự kiện có một dòng log với thời điểm và người thực hiện; phản hồi lỗi không có stack trace; URL trong log không chứa dữ liệu nhạy cảm (NFR-S13, NFR-S14) | P1 | Chưa |
| SEC-17 | Mobile: soát nơi lưu token, lưu lượng mạng, quyền ứng dụng xin | Token không nằm ở nơi lưu trữ dạng rõ; không gọi HTTP thường ngoài môi trường dev; chỉ xin quyền cần dùng (NFR-S15) | P1 | Chưa |

### 8.3 PERF — Hiệu năng

Đo trên máy có cấu hình ghi rõ trong biên bản, với tải giả định ở đầu mục 8.

| ID | Kịch bản | Tiêu chí đạt | P | Tự động |
| --- | --- | --- | --- | --- |
| PERF-01 | 20 người dùng ảo gọi liên tục dự báo đang hiệu lực và đồng bộ offline với 100, 1.000, 10.000 đơn vị trong 5 phút | p95 không quá 500 ms, p99 không quá 1 giây, không có lỗi 5xx (NFR-P01) | P1 | Chưa |
| PERF-02 | Hàng đợi thẩm định với 1.000 run | p95 không quá 500 ms; danh sách hiển thị trong 1 giây (NFR-P01) | P2 | Chưa |
| PERF-03 | Phát cảnh báo tới 1.000 và 10.000 người nhận, FCM giả lập | 1.000 người trong 30 giây; 10.000 người trong 5 phút; yêu cầu của admin không hết thời gian chờ (NFR-P05, NFR-P06) | P1 | Chưa |
| PERF-04 | Mobile tra cứu trong 10.000 vùng trên thiết bị thật tầm trung | Mỗi lần định vị ra quyết định trong 1 giây (NFR-P09) | P1 | Một phần (M: kiểm dung lượng) |
| PERF-05 | Lighthouse cho trang đăng nhập và bảng điều hành, cấu hình mobile | LCP không quá 2,5 giây, CLS không quá 0,1, tổng dung lượng dưới 1.600 KiB; đo INP khi thao tác bản đồ, không quá 200 ms (NFR-P03, NFR-P04) | P1 | Chưa |
| PERF-06 | 20 cán bộ cùng mở bảng điều hành và làm mới | Không yêu cầu nào bị gateway từ chối (NFR-P10) | P1 | Chưa |
| PERF-07 | Bấm từng nút chính (duyệt, phát, lưu vùng, gửi báo cáo) trên mạng chậm | Sau 1 giây có chỉ báo đang xử lý; nút không bấm lại được khi đang gửi (NFR-P02) | P1 | Một phần (M: primary_button_test) |
| PERF-08 | Tạo một đề xuất mới khi bảng điều hành đang mở | Hiện trong 5 giây (NFR-P07) | P2 | Một phần (E: liveupdates.spec, chưa đo thời gian) |
| PERF-09 | Mobile: đo khởi động nguội và ấm 10 lần trên thiết bị tầm trung | Nguội dưới 5 giây, ấm dưới 2 giây ở mọi lần (NFR-P08) | P2 | Chưa |

### 8.4 REL — Độ bền

| ID | Kịch bản | Kết quả mong đợi | P | Tự động |
| --- | --- | --- | --- | --- |
| REL-01 | Tắt AI service khi đang dùng | Dự báo mới là `unavailable`; bảng điều hành và phát cảnh báo thủ công vẫn chạy | P0 | Một phần (C, E: modelcard.spec) |
| REL-02 | Tắt GIS service | Bảng mưa báo lỗi rõ; phần còn lại vẫn chạy | P0 | Chưa |
| REL-03 | Tắt Redis | Mất cập nhật trực tiếp nhưng làm mới thủ công vẫn được; không lỗi 500 dây chuyền | P1 | Chưa |
| REL-04 | Khởi động lại PostGIS, rồi Core | Hệ thống tự hồi phục trong 2 phút; job dở được xử lý lại (NFR-R02) | P1 | Chưa |
| REL-05 | Nhà cung cấp mưa lỗi hoặc chậm | Dữ liệu cũ được ghi tuổi; không ghi 0 | P0 | Có (G: test_live_rainfall) |
| REL-06 | FCM, SMS, SMTP lỗi | Ghi nhận thất bại, báo rõ cho admin; không báo thành công | P0 | Một phần (C) |
| REL-07 | Mobile mất mạng giữa lúc gửi báo cáo hoặc đồng bộ | Không mất dữ liệu, không gửi trùng | P0 | Có (M) |
| REL-08 | Đồng hồ thiết bị lệch 1 giờ | Ghi lại ảnh hưởng tới hết hạn và geofence | P2 | Chưa |
| REL-09 | Dừng đột ngột từng container (`docker kill`) | Container tự chạy lại; dịch vụ trả lời bình thường trong 2 phút (NFR-R02) | P1 | Chưa |
| REL-10 | Sao lưu cơ sở dữ liệu, xóa volume, khôi phục | Dữ liệu trở lại đúng thời điểm sao lưu; cả quá trình trong 4 giờ (NFR-R03) | P1 | Chưa |
| REL-11 | Theo dõi crash và ANR của mobile trong toàn bộ đợt E2E | Không có crash, không có ANR (NFR-R05) | P1 | Chưa |

### 8.5 A11Y, PRIV, INT — Truy cập, quyền riêng tư, liên thông

| ID | Kịch bản | Kết quả mong đợi | P | Tự động |
| --- | --- | --- | --- | --- |
| A11Y-01 | Chạy công cụ kiểm tương phản (axe hoặc Lighthouse) trên đăng nhập, bảng điều hành, trang công dân | Không còn lỗi tương phản; chữ từ 4,5:1, thành phần giao diện từ 3:1 (NFR-U01) | P1 | Chưa |
| A11Y-02 | Đo kích thước nút trên thanh điều hướng, nút bản đồ, nút trong hộp thoại; trên mobile đo nút chính | Web từ 24 x 24 CSS pixel; mobile từ 48 x 48 dp (NFR-U02) | P2 | Chưa |
| A11Y-03 | Thu trình duyệt về 320 pixel; phóng chữ 200% | Không cuộn ngang ngoài bản đồ; không mất nội dung hay nút (NFR-U03) | P2 | Chưa |
| A11Y-04 | Xem bản đồ và danh sách ở chế độ giả lập mù màu | Vẫn phân biệt được mức nguy cơ nhờ chữ hoặc ký hiệu (NFR-U04) | P1 | Chưa |
| A11Y-05 | Hoàn thành luồng duyệt đề xuất và phát cảnh báo chỉ bằng bàn phím; thử TalkBack trên màn cảnh báo khẩn cấp của mobile | Làm được trọn luồng; nội dung cảnh báo được đọc đúng (NFR-U05) | P1 | Chưa |
| PRIV-01 | Cài mới app, vào màn geofence và gửi báo cáo | Có giải thích việc dùng vị trí trước khi xin quyền; từ chối quyền thì app vẫn dùng được phần còn lại (NFR-V01) | P0 | Một phần (M: nhánh lỗi vị trí) |
| PRIV-02 | Người dùng tìm cách xem, sửa, xóa dữ liệu của mình và xóa tài khoản | Có đường làm từng việc, hoặc ghi nhận là thiếu (NFR-V02, NFR-V05) | P1 | Chưa |
| PRIV-03 | Soát tài liệu vận hành | Có quy trình thông báo vi phạm dữ liệu với mốc 72 giờ và người chịu trách nhiệm (NFR-V03) | P1 | Chưa |
| PRIV-04 | Bắt gói tin của mobile khi geofence chạy 30 phút và không gửi báo cáo | Không có yêu cầu nào mang tọa độ của người dùng (NFR-V04) | P0 | Chưa |
| INT-01 | Kiểm mọi GeoJSON API trả về bằng bộ kiểm RFC 7946 | Hợp lệ; kinh độ trước vĩ độ; tọa độ nằm trong lãnh thổ Việt Nam (NFR-C01) | P1 | Một phần (M: vietnam_mountain_zones_test) |
| INT-02 | Xuất một lệnh phát đã gửi và ánh xạ sang các trường bắt buộc của CAP 1.2 | Điền được mọi trường bắt buộc, hoặc liệt kê trường thiếu (NFR-C02) | P2 | Chưa |
| INT-03 | Đối chiếu mẫu tin cảnh báo và mọi nhãn mức nguy cơ trên web, mobile với QĐ 18/2021 | Tin có đủ các mục ở NFR-C03; không chỗ nào gọi mức của hệ thống là cấp độ rủi ro thiên tai chính thức (NFR-C04) | P1 | Chưa |

### 8.6 HON — Trung thực dữ liệu và an toàn (PRD mục 3)

| ID | Kịch bản | Kết quả mong đợi | P | Tự động |
| --- | --- | --- | --- | --- |
| HON-01 | Đơn vị thiếu mưa | Mọi màn hình ghi "thiếu dữ liệu"; không hiện 0 mm hay nguy cơ thấp | P0 | Một phần (G, W) |
| HON-02 | Run `unavailable` | Có lý do; xác suất và mức để trống. **Cần xác minh:** cột `hazard_level` có mặc định `medium` trong migration V3 | P0 | Một phần (C, A) |
| HON-03 | Điểm số chưa hiệu chuẩn | Luôn có nhãn "thử nghiệm"; không gọi là xác suất | P0 | Một phần (W, E) |
| HON-04 | Dữ liệu demo | Mang `model_version = demo` và được ghi rõ là demo trên giao diện | P0 | Chưa |
| HON-05 | Soát mọi câu chữ trên web và mobile | Không có chữ "an toàn" cho trạng thái hết hạn, ngoài vùng, hay thiếu dữ liệu | P0 | Một phần (M) |

### 8.7 MNT, OBS, DATA, COMPAT — Bảo trì, giám sát, dữ liệu, tương thích

| ID | Kịch bản | Kết quả mong đợi | P | Tự động |
| --- | --- | --- | --- | --- |
| MNT-01 | Bật đo độ phủ cho Core, AI, GIS, mobile và báo cáo theo PR | Mã mới từ 80%; trùng lặp không quá 3% (NFR-M01) | P2 | Chưa |
| MNT-02 | Chạy phân tích tĩnh cho từng phân hệ | Không còn cảnh báo (NFR-M02) | P2 | Một phần (`flutter analyze`) |
| MNT-03 | Mở một PR thử chạm vào cả năm phân hệ | CI chạy đủ các bộ test và xong trong 10 phút (NFR-M03) | P1 | Chưa |
| MNT-04 | Clone repo trên máy sạch, làm theo README | Hệ thống chạy trong 15 phút, không phải sửa mã; mọi cấu hình đi qua biến môi trường (NFR-F01, NFR-F02) | P1 | Chưa |
| OBS-01 | Trong lúc chạy PERF-01, đọc số liệu giám sát | Thấy được độ trễ, lưu lượng, tỷ lệ lỗi, mức dùng tài nguyên của từng dịch vụ (NFR-O01) | P2 | Chưa |
| OBS-02 | Gọi endpoint sức khỏe của từng dịch vụ; xem trạng thái container | Mỗi dịch vụ có endpoint; `docker compose ps` hiện trạng thái healthy (NFR-O02) | P2 | Chưa |
| DATA-01 | Chạy Flyway V1 đến V15 trên DB trống | Sạch, không lỗi | P0 | Có (C: chạy khi khởi tạo test) |
| DATA-02 | Nâng cấp DB đang có dữ liệu demo lên bản mới nhất | Không mất dữ liệu | P1 | Chưa |
| DATA-03 | So `database/migrations` với thư mục migration của Core | Giống nhau. Hiện thiếu V15 và V3 khác nội dung | P2 | Chưa |
| DATA-04 | Chạy `demo-seed` hai lần liên tiếp | Không lỗi, không trùng dữ liệu | P1 | Chưa |
| COMPAT-01 | WebGIS trên hai bản mới nhất của Chrome, Edge, Firefox, Safari | Bản đồ và mọi hộp thoại chạy (NFR-C05) | P1 | Chưa |
| COMPAT-02 | Mobile trên Android 6 (API 23), một bản giữa, bản mới nhất | Cài được; đăng nhập, push, geofence chạy (NFR-C05) | P1 | Chưa |

## 9. Kịch bản E2E toàn hệ thống

Chạy trên stack đầy đủ sau `demo-seed`, với một thiết bị Android thật. Chưa kịch bản nào được tự động hóa (Story 5.4 đang ở backlog).

| ID | Kịch bản | Các bước chính | Kết quả mong đợi | P |
| --- | --- | --- | --- | --- |
| E2E-01 | Luồng cảnh báo 24 giờ | Nạp mưa và địa hình; tạo snapshot; có run chờ duyệt; officer xem bằng chứng và phê duyệt; admin xem trước rồi phát qua push và SMS; công dân nhận trên mobile; công dân đi vào vùng khi mất mạng; chờ tới hết hạn | Mỗi bước để lại dữ liệu đúng; mobile báo động trong vùng; sau hạn chuyển "dữ liệu cũ"; nhật ký và KPI có đủ | P0 |
| E2E-02 | Từ chối đề xuất | Officer từ chối kèm lý do | Công dân không thấy run đó; nhật ký thẩm định và KPI cập nhật | P0 |
| E2E-03 | Thu hồi cảnh báo | Admin thu hồi cảnh báo đã phát; mobile mở lại khi có mạng | Mobile và web công dân hiện "đã thu hồi"; geofence không còn báo động cho run đó | P0 |
| E2E-04 | Báo cáo hiện trường | Công dân gửi báo cáo có ảnh khi mất mạng; có mạng lại; officer mở danh sách trên web, xem ảnh, đổi trạng thái | Một báo cáo duy nhất; công dân thấy trạng thái mới | P0 |
| E2E-05 | Vòng đời cán bộ | Gửi yêu cầu; admin duyệt; cán bộ đăng nhập và thẩm định; admin khóa | Mất quyền ngay khi bị khóa; nhật ký quản trị đủ các bước | P1 |
| E2E-06 | Vòng đời công dân | Đăng ký; đăng ký vùng; nhận cảnh báo; quên mật khẩu; đăng xuất | Sau đăng xuất thiết bị không còn nhận push | P1 |
| E2E-07 | Sự cố khi đang vận hành | Tắt AI và ngắt nguồn mưa; admin phát cảnh báo thủ công | Hệ thống không bịa dự báo; cảnh báo thủ công vẫn tới người dân | P0 |

## 10. Bộ smoke và hồi quy

**Smoke (khoảng 15 phút, trước mỗi buổi demo và sau mỗi lần triển khai):** AUTH-06, AUTH-07, USR-01, FREV-01, FREV-03, BRD-02, BRD-05, DASH-01, DASH-03, RPT-08, GW-01, và trên mobile: AUTH-19, ALR-04, GEO-05.

**Hồi quy trước khi merge vào `main`:** toàn bộ test tự động ở mục 4.1.

**Hồi quy trước buổi bảo vệ:** toàn bộ P0, E2E-01 đến E2E-04 và E2E-07.

## 11. Truy vết yêu cầu

| Yêu cầu PRD | Nhóm kịch bản |
| --- | --- |
| FR1 Mưa và địa hình | AOI, GIS, HON-01 |
| FR2 Mô hình và đánh giá | AI, FJOB (chỉ contract; đánh giá mô hình ngoài phạm vi) |
| FR3 Thẩm định trên WebGIS | FREV, DASH, INC, AUD |
| FR4 Cảnh báo khẩn cấp | BRD, SUB, ALR, AUD-01 |
| FR5 Mobile và offline | AUTH-18, AUTH-19, SUB, ALR, RPT, GEO, MAP |
| Mục 2 Vai trò | AUTH, USR, SEC-01 |
| Mục 3 Ngữ nghĩa dự báo | HON, FREV-05, FREV-06, GEO-06 đến GEO-09 |
| Mục 5 Độ tin cậy | REL, SEC, DATA |
| Yêu cầu phi chức năng suy từ chuẩn ngành (mục 8.1) | SEC, PERF, REL, A11Y, PRIV, INT, MNT, OBS, COMPAT |

## 12. Khoảng trống tự động hóa, theo thứ tự nên làm

1. Core kèm PostGIS, GIS, AI, Mobile đã chạy trên CI. Còn lại: sửa CI của AI đang đỏ, và đưa `check-routes.sh` lên CI.
2. Test HTTP cho 4 route GIS còn thiếu (GIS-12). 13 route còn lại và việc nạp dữ liệu mẫu trên CI đã có.
3. Ma trận quyền đã có (SEC-01). Còn lại: đổi mặc định `/api/v1/**` sang từ chối (SEC-02).
4. Chạy Playwright trên CI bằng Chromium, rồi thêm kịch bản: quản trị người dùng, vẽ vùng giám sát, danh sách báo cáo, lịch sử và thu hồi lệnh, trang công dân, quên mật khẩu (USR-07, AOI-05, RPT-15, BRD-14, BRD-15, ALR-09, AUTH-13).
5. Test giao diện mức component cho hộp thoại phát cảnh báo (BRD-03, BRD-05, BRD-16).
6. Script E2E-01 chạy trên stack docker sau `demo-seed`, kèm bản `demo-seed` cho macOS và Linux.
7. Danh sách kiểm trên thiết bị thật cho push, còi, geofence nền (ALR-01, ALR-08, GEO-14).
8. Script tải cho PERF-01, PERF-03, PERF-06.
9. Kiểm tự động header bảo mật, tương phản và Lighthouse trên CI (SEC-15, A11Y-01, PERF-05).

## 13. Trình tự thực hiện gợi ý

| Đợt | Nội dung | Đầu ra |
| --- | --- | --- |
| 1 | Dựng môi trường, tạo tài khoản thử, chạy smoke và toàn bộ test tự động | Biên bản môi trường, kết quả test tự động |
| 2 | Kiểm thủ công các kịch bản "Chưa" và "Một phần" ở mục 7, ưu tiên P0 | Danh sách lỗi, kết luận các mục "cần xác minh" |
| 3 | Đo các yêu cầu phi chức năng và chạy kịch bản mục 8 | Báo cáo phi chức năng: từng NFR đạt hay chưa |
| 4 | E2E toàn hệ thống trên thiết bị thật (mục 9) | Biên bản E2E kèm ảnh, video |
| 5 | Sửa lỗi, hồi quy, tổng hợp | Báo cáo kiểm thử cuối |

## 14. Mẫu ghi kết quả

| ID | Ngày | Người chạy | Bản build (commit) | Kết quả (Đạt / Không đạt / Bị chặn) | Issue | Ghi chú |
| --- | --- | --- | --- | --- | --- | --- |
| | | | | | | |

## Sources

[1] https://www.iso.org/standard/78176.html — ISO/IEC 25010:2023 Product quality model
[2] https://cdn.standards.iteh.ai/samples/78176/13ff8ea97048443f99318920757df124/ISO-IEC-25010-2023.pdf — ISO/IEC 25010:2023 (sample, foreword)
[3] https://www.nngroup.com/articles/response-times-3-important-limits — NN/g Response Times: The 3 Important Limits
[4] https://web.dev/articles/vitals — web.dev Web Vitals
[5] https://developer.chrome.com/docs/lighthouse/performance/total-byte-weight — Lighthouse: Avoid enormous network payloads
[6] https://support.google.com/googleplay/android-developer/answer/9844486 — Google Play Android vitals
[7] https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html — WCAG 2.2 SC 1.4.3 Contrast (Minimum)
[8] https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html — WCAG 2.2 SC 1.4.11 Non-text Contrast
[9] https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html — WCAG 2.2 SC 2.5.8 Target Size (Minimum)
[10] https://www.w3.org/WAI/WCAG22/Understanding/reflow.html — WCAG 2.2 SC 1.4.10 Reflow
[11] https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html — WCAG 2.2 SC 1.4.4 Resize Text
[12] https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html — WCAG 2.2 SC 1.4.1 Use of Color
[13] https://support.google.com/accessibility/android/answer/7101858 — Android Accessibility Help: touch target size
[14] https://pages.nist.gov/800-63-4/sp800-63b/authenticators — NIST SP 800-63B-4 Authenticators
[15] https://raw.githubusercontent.com/OWASP/ASVS/master/5.0/en/0x15-V6-Authentication.md — OWASP ASVS 5.0 V6 Authentication
[16] https://raw.githubusercontent.com/OWASP/ASVS/master/5.0/en/0x12-V3-Web-Frontend-Security.md — OWASP ASVS 5.0 V3 Web Frontend Security
[17] https://raw.githubusercontent.com/OWASP/ASVS/master/5.0/en/0x14-V5-File-Handling.md — OWASP ASVS 5.0 V5 File Handling
[18] https://raw.githubusercontent.com/OWASP/ASVS/master/5.0/en/0x16-V7-Session-Management.md — OWASP ASVS 5.0 V7 Session Management
[19] https://raw.githubusercontent.com/OWASP/ASVS/master/5.0/en/0x17-V8-Authorization.md — OWASP ASVS 5.0 V8 Authorization
[20] https://raw.githubusercontent.com/OWASP/ASVS/master/5.0/en/0x18-V9-Self-contained-Tokens.md — OWASP ASVS 5.0 V9 Self-contained Tokens
[21] https://raw.githubusercontent.com/OWASP/ASVS/master/5.0/en/0x21-V12-Secure-Communication.md — OWASP ASVS 5.0 V12 Secure Communication
[22] https://raw.githubusercontent.com/OWASP/ASVS/master/5.0/en/0x22-V13-Configuration.md — OWASP ASVS 5.0 V13 Configuration
[23] https://raw.githubusercontent.com/OWASP/ASVS/master/5.0/en/0x23-V14-Data-Protection.md — OWASP ASVS 5.0 V14 Data Protection
[24] https://raw.githubusercontent.com/OWASP/ASVS/master/5.0/en/0x25-V16-Security-Logging-and-Error-Handling.md — OWASP ASVS 5.0 V16 Security Logging and Error Handling
[25] https://mas.owasp.org/MASVS — OWASP MASVS
[26] https://luatvietnam.vn/dan-su/luat-bao-ve-du-lieu-ca-nhan-2025-so-91-2025-qh15-405135-d1.html — Luật Bảo vệ dữ liệu cá nhân 91/2025/QH15
[27] https://luatvietnam.vn/dan-su/nghi-dinh-356-2025-nd-cp-quy-dinh-chi-tiet-luat-bao-ve-du-lieu-ca-nhan-422896-d1.html — Nghị định 356/2025/NĐ-CP
[28] https://www.ey.com/content/dam/ey-unified-site/ey-com/vi-vn/technical/tax/documents/ey-vietnam-legal-alert-march-2026-decree-no356-2025-nd-cp-providing-detailed-guidance-for-implementation-of-personal-data-protection-law-viet.pdf — EY Legal Alert 3/2026 về Nghị định 356/2025/NĐ-CP
[29] https://luatminhkhue.vn/van-ban/quyet-dinh-18-2021-qd-ttg.aspx — Quyết định 18/2021/QĐ-TTg
[30] https://thuvienphapluat.vn/chinh-sach-phap-luat-moi/vn/ho-tro-phap-luat/tu-van-phap-luat/70923/cac-cap-do-rui-ro-thien-tai-do-lu-quet-sat-lo-dat-sut-lun-dat-do-mua-lu-hoac-dong-chay — Cấp độ rủi ro thiên tai do lũ quét, sạt lở đất (QĐ 18/2021)
[31] https://docs.oasis-open.org/emergency/cap/v1.2/CAP-v1.2-os.html — OASIS Common Alerting Protocol v1.2
[32] https://www.cdema.org/ews/jdownloads/Risk%20Knowledge/Multi-hazard%20Early%20Warning%20Systems:%20A%20Checklist/Multi-Hazard%20Early%20Warning%20Sistems_v6.pdf — WMO Multi-hazard Early Warning Systems: A Checklist
[33] https://sre.google/sre-book/monitoring-distributed-systems — Google SRE Book: Monitoring Distributed Systems
[34] https://12factor.net/config — The Twelve-Factor App: Config
[35] https://www.rfc-editor.org/rfc/rfc7946 — RFC 7946 The GeoJSON Format
[36] https://docs.sonarsource.com/sonarqube-community-build/quality-standards-administration/managing-quality-gates/introduction-to-quality-gates — SonarQube: Sonar way quality gate
