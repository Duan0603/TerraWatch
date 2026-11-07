# TerraWatch White / Teal Design System Specification

## 1. Triết Lý Thiết Kế (Design Philosophy)

Hệ thống thiết kế **White / Teal** của TerraWatch được xây dựng chuyên biệt cho các giải pháp cảnh báo sớm thiên tai và quan trắc viễn thám thực địa tại Việt Nam.

Mục tiêu cốt lõi:
1. **Rõ ràng và Tương phản cao (High Legibility):** Giúp người dân và cán bộ tác chiến dễ dàng đọc thông tin cảnh báo trong điều kiện thực địa chói nắng hoặc thời tiết mưa bão khắc nghiệt.
2. **Nhận diện Nguy cơ Tức thì (Instant Hazard Recognition):** Sử dụng hệ màu cảnh báo quốc tế chuẩn hóa (Đỏ - Cam - Vàng - Xanh) trên nền màu trung tính trắng/xám nhạt.
3. **Thân thiện & Đáng tin cậy (Authoritative & Calming):** Sắc xanh Teal chủ đạo (`#087B70`) đem lại cảm giác tin cậy, vững chãi của cơ quan phòng chống thiên tai quốc gia.

---

## 2. Bảng Màu Hệ Thống (Color Tokens)

### 2.1 Màu Thương Hiệu (Primary Brand)
| Tên Token | Mã Hex | RGB | Mô Tả & Mục Đích Sử Dụng |
|:---|:---|:---|:---|
| `primary` | `#087B70` | `rgb(8, 123, 112)` | Màu chủ đạo nút bấm, thanh điều hướng, icon chính |
| `primaryDark` | `#075F57` | `rgb(7, 95, 87)` | Trạng thái hover, active, tiêu đề quan trọng |
| `primaryLight` | `#E4F4F1` | `rgb(228, 244, 241)` | Màu nền chip, badge được chọn, highlight vùng |

### 2.2 Màu Cấp Độ Nguy Cơ Sạt Lở (Hazard Severity Tokens)
| Cấp Độ | Mã Hex | Nền Badge | Viền | Ý Nghĩa Điều Hành |
|:---|:---|:---|:---|:---|
| **CRITICAL / EXTREME** | `#EF4444` | `#FEE2E2` | `#FCA5A5` | Nguy cơ sạt trượt tức thì, sơ tán khẩn cấp |
| **HIGH** | `#F97316` | `#FFEDD5` | `#FDBA74` | Mưa vượt ngưỡng 110mm/24h, cấm phương tiện đèo dốc |
| **MODERATE** | `#EAB308` | `#FEF9C3` | `#FDE047` | Mưa cục bộ, theo dõi biến dạng ta-luy |
| **SAFE / LOW** | `#22C55E` | `#DCFCE7` | `#86EFAC` | Trạng thái ổn định, quan trắc thường quy |

### 2.3 Màu Nền & Bề Mặt (Surfaces & Backgrounds)
* `background`: `#F5F8F7` (Nền xám ngọc lam siêu nhạt, dịu mắt khi nhìn lâu)
* `cardSurface`: `#FFFFFF` (Bề mặt thẻ nổi bật)
* `border`: `#DCE5E2` (Đường phân cách mỏng thanh thoát)
* `textPrimary`: `#172524` (Màu chữ đen ánh xanh đậm, đạt tỷ lệ tương phản 13.8:1 trên nền trắng)
* `textSecondary`: `#687977` (Màu chữ phụ, phụ đề, thời gian)
* `textMuted`: `#9BB0AD` (Chữ gợi ý, placeholder)

---

## 3. Thang Đo Typography (Typography Scales)

Toàn bộ ứng dụng Mobile và WebGIS đồng bộ font chữ **Inter** (Google Fonts) hỗ trợ tiếng Việt có dấu đầy đủ và hiển thị sắc nét trên cả màn hình OLED và LCD.

```
Display Large    32px / Weight 800 (Boldest)  -> Chỉ số lượng mưa lớn
Headline Large   20px / Weight 700            -> Tiêu đề màn hình
Title Large      16px / Weight 700            -> Tên khu vực, trạm đo
Body Large       15px / Weight 400            -> Chi tiết tin nhắn cảnh báo
Body Medium      14px / Weight 400            -> Nội dung mô tả sự cố
Label Medium     12px / Weight 600            -> Nhãn nút bấm, trạng thái
Label Small      10px / Weight 700            -> Badge cấp độ nguy cơ
```

---

## 4. Quy Chuẩn Không Gian & Bo Góc (Spacing & Radius)

* **Hệ thống lưới (Spacing Grid):** Bội số 4pt / 8pt:
  - `xxs`: 2px, `xs`: 4px, `sm`: 8px, `md`: 12px, `lg`: 16px, `xl`: 20px, `xxl`: 24px, `hero`: 48px.
* **Quy chuẩn bo góc (BorderRadius):**
  - Thẻ Card: `12px` (Mobile), `16px` (WebGIS Modal)
  - Nút bấm: `10px`
  - Tag / Badge nguy cơ: `6px`
  - Nút khẩn cấp / Pill: `999px`

---

## 5. Quy Chuẩn Tiếp Cận (Accessibility & Safety Rules)

1. **Chuẩn WCAG 2.1 AA:** Tất cả văn bản đạt độ tương phản tối thiểu `4.5:1` đối với văn bản thường và `3.0:1` đối với văn bản lớn.
2. **Kích thước vùng bấm cảm ứng:** Tối thiểu `48x48 dp` trên màn hình cảm ứng di động, tránh việc bấm nhầm trong tình huống người dân hoảng loạn khi có thiên tai.
3. **Cơ chế âm thanh & rung khẩn cấp (Emergency Siren):**
   - Kênh thông báo độ ưu tiên tối đa (`Importance.max`, `Priority.high`).
   - Tần số âm thanh còi báo động `800Hz - 1200Hz` dạng xung nhịp liên tục để xuyên qua tiếng mưa bão.
   - Hỗ trợ đầy đủ cờ tắt chuông khi người dùng xác nhận đã đến nơi trú ẩn an toàn.

---

## 6. Thành Phần Giao Diện Chuẩn (Reusable Design Components)

### 6.1 Huy Hiệu Nguy Cơ (`HazardBadge`)
Widget chuẩn hóa hiển thị cấp độ rủi ro thiên tai trên Mobile:
```dart
// Cách dùng 1: Truyền trực tiếp Style
HazardBadge(style: HazardBadgeTheme.critical)

// Cách dùng 2: Tự động chuẩn hóa từ chuỗi dữ liệu Backend
HazardBadge.fromSeverity('CRITICAL', showEnglish: false)
```
- **Hỗ trợ song ngữ:** Tiếng Việt (`labelVi`) và Tiếng Anh (`labelEn`).
- **Hình dạng:** Pill bo tròn chuẩn (`AppRadius.rPill`), tích hợp icon cảnh báo nhận diện nhanh.
