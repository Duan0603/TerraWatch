# Quy Chuẩn Đóng Góp & Phát Triển (Contribution & Engineering Guidelines)

Chào mừng các thành viên nhóm Capstone **GeoSentry (TerraWatch)**! Tài liệu này quy định các tiêu chuẩn kỹ thuật phần mềm cần tuân thủ để đảm bảo chất lượng đồ án đạt mức tối đa trước Hội đồng bảo vệ.

---

## 1. Quy Ước Nhánh (Branching Strategy)
- `main`: Nhánh sản phẩm chính thức, luôn trong trạng thái chạy ổn định (Production-ready). Không bao giờ commit trực tiếp lên `main`.
- `develop`: Nhánh tích hợp sprint. Mọi tính năng sau khi review xong sẽ merge vào đây.
- Nhánh tính năng cá nhân:
  - Cú pháp: `feature/<role>-<feature-name>`
  - Ví dụ:
    - `feature/ai-unet-onnx-export`
    - `feature/gis-sentinel2-cloudmask`
    - `feature/core-verification-api`
    - `feature/webgis-map-comparison`
    - `feature/mobile-offline-sqlite`

---

## 2. Quy Chuẩn Commit (Conventional Commits)
Mọi commit phải tuân theo định dạng chuẩn quốc tế:
`<loại>(<phân_hệ>): <mô tả ngắn bằng tiếng Anh hoặc tiếng Việt>`

### Các loại commit (Types):
- `feat`: Tính năng mới (ví dụ: `feat(ai): integrate DeepLabV3+ inference pipeline`)
- `fix`: Sửa lỗi (ví dụ: `fix(core): resolve PostGIS SRID transformation error`)
- `docs`: Cập nhật tài liệu (ví dụ: `docs(arch): update C4 container diagram`)
- `test`: Thêm hoặc sửa test case (ví dụ: `test(mobile): add offline point-in-polygon unit tests`)
- `refactor`: Tái cấu trúc mã nguồn không làm thay đổi tính năng
- `perf`: Cải tiến hiệu năng (ví dụ: `perf(gis): optimize spatial GIST index query`)
- `chore`: Cập nhật cấu hình, dependency hoặc build script

---

## 3. Triết Lý Thiết Kế Mã Nguồn (The Ponytail Way)
Hệ thống tích hợp quy tắc **Ponytail** dành cho nhà phát triển:
1. **YAGNI (You Aren't Gonna Need It)**: Không viết trước tính năng chưa có trong đặc tả yêu cầu.
2. **Ưu tiên thư viện chuẩn**: Sử dụng API chuẩn của nền tảng (PostGIS ST functions, Node/Python stdlib) trước khi cài đặt thêm thư viện thứ ba.
3. **Diff ngắn & rõ ràng**: Một hàm làm đúng một nhiệm vụ, tránh boilerplate không cần thiết.

---

## 4. Quy Trình Mở Pull Request
1. Đảm bảo code chạy không lỗi khi chạy `docker-compose up`.
2. Kiểm tra `git status` không để lọt file rác (`.env`, `*.log`, file tạm).
3. Mở PR vào nhánh `develop`, điền đầy đủ checklist theo [Pull Request Template](.github/pull_request_template.md).
4. Tag ít nhất 1 thành viên review và phê duyệt (Approve) trước khi merge.
