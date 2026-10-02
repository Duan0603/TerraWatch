<!-- ======================================================== -->
<!-- GeoSentry / TerraWatch - Pull Request Template           -->
<!-- ======================================================== -->

## 📌 Tóm Tắt Thay Đổi (Summary)
<!-- Mô tả ngắn gọn tính năng, bản sửa lỗi hoặc cải tiến trong PR này -->

## 🎯 Phân Hệ & Vai Trò (WBS Component)
- [ ] **AI Service** (`services/ai-service`) - *AI Engineer*
- [ ] **GIS Pipeline** (`services/gis-service`) - *GIS Data Engineer*
- [ ] **Core API & DB** (`services/core-api`, `database/`) - *Backend Engineer*
- [ ] **WebGIS Dashboard** (`apps/webgis`) - *Frontend Engineer*
- [ ] **Mobile App** (`apps/mobile`) - *Mobile Engineer*
- [ ] **DevOps & Docs** (`.github/`, `docs/`, `docker-compose.yml`)

## 📋 Yêu Cầu Nghiệp Vụ Liên Quan (SRS / Use Cases)
<!-- Đánh dấu các Use Case / Functional Requirement liên quan -->
- [ ] **UC01 / FR1.1**: Thiết lập & quản lý vùng giám sát (AOI)
- [ ] **UC02 / FR1.2-4**: Thu thập ảnh Sentinel-2/Landsat-8 & Tiling
- [ ] **UC03 / FR2.1-3**: Nhận diện sạt lở bằng AI (U-Net/DeepLabV3+)
- [ ] **UC04 / FR3.1-2**: Thẩm định & phê duyệt điểm nguy cơ (Officer Review)
- [ ] **UC05**: Hiển thị bản đồ WebGIS & Vector Tiles (MVT)
- [ ] **UC08 / NFR2**: Geofencing ngoại tuyến trên thiết bị di động
- [ ] **UC09**: Báo cáo hiện trường từ cộng đồng (Crowdsourcing)

## 🧪 Kết Quả Kiểm Thử (Testing & Quality Assurance)
- [ ] Đã chạy linter và không có lỗi (`npm run lint` / `flake8`)
- [ ] Đã chạy unit test / integration test thành công
- [ ] Đã kiểm tra tương thích Docker Compose (`docker-compose up`)
- [ ] Đã áp dụng nguyên lý **Ponytail** (không code thừa, không thêm dependency không cần thiết)

## 📸 Ảnh Chụp Màn Hình / Minh Chứng (Screenshots / Logs)
<!-- Đính kèm ảnh giao diện, kết quả test hoặc log thực thi nếu có -->

## 👥 Người Đánh Giá (Reviewers)
<!-- Tag ít nhất 1 thành viên cùng nhóm để review chéo trước khi merge -->
- Reviewer 1: @
