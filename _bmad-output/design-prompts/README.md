# TerraWatch — Figma Make Design Prompts

Folder này chứa toàn bộ prompt đã được tổng hợp, sắp xếp và merge prefix sẵn sàng paste vào Figma Make.

## Thứ tự thực thi

| File | Phase | Frames | Prompt gốc |
|------|-------|--------|------------|
| `01-foundation.md` | Nền tảng | Design System + Components | 1, 2 |
| `02-webgis-officer.md` | WebGIS Officer | W01 → W06 | 3, 4, 5 |
| `03-webgis-admin.md` | WebGIS Admin | W07 → W12 | 6, 7, 8 |
| `04-field-reports.md` | Field Reports | W13 → W16 | 9 |
| `05-mobile.md` | Mobile Citizen | M01 → M17 | 10 → 16 |
| `06-prototype-qa.md` | Prototype + QA | Flows + Edge Cases | 17, 18, 20 |

## Quy tắc sử dụng

1. **Chạy theo thứ tự file** — không nhảy cóc
2. **Mỗi prompt = 1 lần generate** trong Figma Make
3. **Nhấn Keep sau mỗi lần** trước khi chạy prompt tiếp
4. **Prefix đã merge sẵn** — copy nguyên block prompt, không cần thêm gì
5. Chạy `06-prototype-qa.md` sau khi **tất cả screens** đã xong

## Dữ liệu demo dùng xuyên suốt

```
Khu vực:      Xã Bản Vược, huyện Bát Xát, tỉnh Lào Cai
Ô nguy cơ:   #LC-BX-042
Điểm rủi ro: 92/100 — Cực kỳ nguy hiểm
Mưa 24h:     186 mm | Mưa 72h: 324 mm | Dự báo 24h: 142 mm
Độ dốc TB:   38.6° | Độ dốc max: 52.1° | Độ cao: 1,246 m
Người nhận:  1,248 SMS + 837 FCM Push
Officer:     Nguyễn Minh Anh
Alert ID:    #TW-250815-004 | Report ID: #FR-250815-018
Thời gian:   08:00 15/08/2025 → 08:00 16/08/2025 GMT+7
```
