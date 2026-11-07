# Rà soát toàn dự án 2026-11-07 và hướng đi tiếp theo

Phạm vi: nhánh `feature/security-review-round2` (chồng lên `main` a0525dd). Căn cứ: PRD v5.0, architecture v2.0, epics, sprint-status, mã nguồn, chạy test thật và thử API qua gateway.

## 1. Kết quả test (đã chạy)
| Phần | Kết quả |
| --- | --- |
| Core API (Maven, cả bộ) | 113 test, qua |
| AI (unittest) | 14 test, qua (1 lỗi Windows-path đã sửa) |
| GIS (run_tests.py) | 11 test, 3 lỗi vì DB trống không có dữ liệu mẫu `database/seed_v3_fixtures.sql` (không phải lỗi mã) |
| WebGIS | `npm test` qua, `vite build` qua; chưa có test giao diện hoặc e2e |
| Mobile | `flutter test` 102/102, `flutter analyze` 3 cảnh báo nhẹ |
| CI GitHub | chỉ biên dịch/build; đã thêm `npm test` cho web; Core, AI, Mobile vẫn chưa chạy test trên CI |

## 2. Đánh giá theo mảng (thang 10)
| Mảng | Điểm | Nhận xét ngắn |
| --- | --- | --- |
| Kiến trúc và phân lớp | 8 | Tách Core/AI/GIS/gateway rõ, Flyway, sự kiện Redis, circuit breaker, job bền vững. Ghi chú "Core ghi cả hai schema" vẫn đúng. |
| Bảo mật | 7 (trước vòng này 5) | Đã đóng: quyền theo DB mỗi request, danh sách báo cáo/ảnh chỉ nhân viên, duyệt sự cố chỉ nhân viên, diagnostic chỉ admin, DB/Redis chỉ localhost. Còn: mặc định mở `/api/v1/**`, JWT không thu hồi, CORS `*`. |
| Trung thực dữ liệu (PRD mục 3) | 9 | Mô hình chưa phát hành nên dự báo là `unavailable`, giao diện ghi "điểm thử nghiệm", không bịa. |
| Chất lượng Core API | 8 | Test dày (113), mã gọn. Điểm yếu lặp lại: lỗi 4xx thành 401 (đã sửa tận gốc). |
| WebGIS | 7 | Nhiều tính năng cán bộ/admin, đăng nhập mới đẹp. Một số file rất dài (LoginPage 700+, MapViewer 700, các Modal 600+), ít test. |
| Mobile | 7 | Đủ luồng chính, 102 test; chưa có quên mật khẩu, chưa kiểm trên máy thật phần push. |
| AI/dữ liệu | 4 | Điểm nghẽn lớn nhất: chưa có mô hình phát hành, chưa có snapshot đặc trưng thật. Mọi dự báo hiện "không khả dụng". |
| Quy trình BMAD | 7 | Có story cho gần như mọi việc, sprint-status cập nhật. Nhưng gần như tất cả đang ở "review", chưa có story nào chốt "done" sau code review/retro. |
| Tài liệu | 6 | Đã bổ sung bảng API mới; vẫn còn tài liệu cũ nói theo bản prototype ảnh vệ tinh. |

## 3. Lỗi tìm thấy vòng này (đã sửa, Story 4.23)
1. P0: ai cũng duyệt/bác bỏ được sự cố (`PATCH /landslides/{id}/verify`, không cần đăng nhập, người duyệt do client tự khai).
2. P1: hàng đợi sự cố cũ công khai; mọi công dân phát được sự kiện lên Redis (`/diagnostic`); Postgres/Redis mở ra mạng.
3. P2: duyệt không kèm `riskLevel` luôn 500; id lạ/sai trạng thái cũng 500; lỗi 4xx thành 401 lần thứ ba; đường dẫn Windows lọt qua kiểm tra tên file AI; test bị hỏng bởi Story 4.9; tài liệu API lỗi thời.

## 4. Việc kỹ thuật nên làm tiếp (không đổi giao diện)
1. Đổi mặc định bảo mật sang "từ chối", mọi route công khai phải liệt kê rõ (hiện route mới nào quên khai báo là công khai).
2. CI chạy test thật: Core (cần Postgres service), AI, Mobile.
3. Thu hồi phiên: đổi mật khẩu/khóa tài khoản làm token cũ mất hiệu lực ngay (đã có kiểm tra DB mỗi request; thêm `password_changed_at` cho đổi mật khẩu).
4. Tách file lớn (LoginPage, các Modal), thêm test giao diện (Vitest + Testing Library) và 1 kịch bản e2e (Playwright) cho đăng nhập, duyệt dự báo, phát cảnh báo.
5. Chốt story: chạy `bmad-code-review` cho các story đang "review", chuyển "done", chạy retro Epic 4.
6. Nạp dữ liệu mẫu GIS khi chạy test; đưa Blaze/SMS provider vào kế hoạch hoặc ghi rõ chỉ demo bằng số thử.

## 5. Gợi ý chức năng WebGIS tiếp theo (bám PRD FR1-FR4)
Xếp theo giá trị cho buổi bảo vệ và cho dự án thật.
| # | Chức năng | Vì sao | Cần gì từ backend |
| --- | --- | --- | --- |
| 1 | **Bảng sức khỏe hệ thống và độ tươi dữ liệu** (admin): trạng thái AI/GIS/Core/Redis, lần lấy mưa gần nhất, tuổi dữ liệu từng nguồn, hàng đợi job | PRD yêu cầu hiển thị chất lượng/độ tươi; làm demo thuyết phục | endpoint tổng hợp `/admin/health` (Core gọi AI/GIS) |
| 2 | **Bảng KPI thẩm định và cảnh báo**: số đề xuất, tỷ lệ duyệt, thời gian từ phát hành đến duyệt, cảnh báo đã gửi, tỷ lệ gửi thành công theo kênh | Đo hiệu quả quy trình; có số liệu cho luận văn | truy vấn tổng hợp trên `forecast_reviews`, `alert_deliveries` |
| 3 | **Thông báo thời gian thực** (SSE/WebSocket): đề xuất mới, báo cáo hiện trường mới, kết quả gửi cảnh báo | Cán bộ không phải bấm "Làm mới"; hợp sự kiện Redis có sẵn | cầu nối Redis → SSE ở Core |
| 4 | **Thanh trượt thời gian 24 giờ** trên bản đồ: xem mưa quan trắc, mưa dự báo và mức nguy cơ theo giờ | Đúng ngữ nghĩa dự báo 24h (PRD mục 3) | API chuỗi giờ theo ô đánh giá |
| 5 | **Nhật ký thao tác quản trị**: ai khóa/đổi quyền/duyệt cán bộ/phát và thu hồi cảnh báo | Mở rộng nhật ký thẩm định; truy vết đầy đủ (Story 7.2) | bảng `admin_audit` + ghi log |
| 6 | **Bản tin cảnh báo hằng ngày** xuất PDF/CSV (kèm bằng chứng, người duyệt) | Gửi chính quyền; tiện nộp báo cáo | tạo báo cáo từ dữ liệu đã duyệt |
| 7 | **Trang minh bạch mô hình** (model card): chỉ số recall/precision/báo động nhầm, phiên bản ngưỡng, dữ liệu huấn luyện | PRD yêu cầu công bố chất lượng; hỗ trợ Duẫn trình bày | đọc `model_card.json` qua AI service |
| 8 | **Mẫu tin cảnh báo, hẹn giờ và gửi lại tin lỗi** | Phát cảnh báo nhanh và nhất quán (FR4) | bảng mẫu, job gửi lại bị lỗi |
| 9 | **Cổng công dân trên web**: đăng ký vùng nhận tin, xem lịch sử cảnh báo đã nhận, gửi báo cáo hiện trường có ảnh | Cho người dân không cài app | dùng API subscriptions và community-reports có sẵn |
| 10 | **Lớp bản đồ sự cố thật so với dự báo** và đánh dấu "đã xảy ra" từ báo cáo hiện trường (không tự tạo nhãn huấn luyện, theo PRD) | Đánh giá sau sự kiện; chuẩn bị tập nhãn | liên kết báo cáo với ô và khung giờ |

## 6. Hướng đi theo đội
- **Duẫn (AI) và Tú (GIS):** đây là đường găng của cả dự án. Chốt AOI thí điểm, nguồn mưa quan trắc và dự báo, tập sự cố có thời gian; tạo snapshot đặc trưng thật rồi mới có điểm số thật (Epic 3, Story 5.4 chạy end-to-end).
- **Thuận (backend):** deny-by-default, thu hồi phiên, endpoint sức khỏe/KPI/audit, job gửi lại, kết nối nhà cung cấp SMS khi có kinh phí.
- **Huy (web):** làm các chức năng 1-4 ở mục 5, tách file lớn, thêm test giao diện.
- **Lâm (mobile):** quên mật khẩu bằng email, thử push trên máy thật, hoàn tất 5.1 và 5.3 rồi đóng story.
- **Cả nhóm:** chạy code review BMAD và chốt "done" các story đang "review"; retro Epic 4; chuẩn bị kịch bản demo có số thử Firebase và dữ liệu mẫu.
