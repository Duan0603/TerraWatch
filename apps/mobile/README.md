# geosentry_mobile

A new Flutter project.

## Getting Started

This project is a starting point for a Flutter application.

A few resources to get you started if this is your first Flutter project:

- [Learn Flutter](https://docs.flutter.dev/get-started/learn-flutter)
- [Write your first Flutter app](https://docs.flutter.dev/get-started/codelab)
- [Flutter learning resources](https://docs.flutter.dev/reference/learning-resources)

For help getting started with Flutter development, view the
[online documentation](https://docs.flutter.dev/), which offers tutorials,
samples, guidance on mobile development, and a full API reference.

## Cấu hình chạy app

- **API:** mặc định `http://127.0.0.1:8080` (gateway). Máy thật qua USB: `adb reverse tcp:8080 tcp:8080`. Ghi đè bằng `--dart-define=API_BASE_URL=...`.
- **Đăng nhập Google (Story 5.6):** cần `android/app/google-services.json` (không commit). Lấy ở Firebase console → project `terrawatch-defense` → Project settings → app `terrawatch-mobile`. Mỗi máy dev phải thêm SHA-1 debug của mình vào app đó (`./gradlew signingReport` trong `android/`). Thiếu file thì app vẫn build, chỉ nút Google không dùng được.
- Backend phải có `POST /api/v1/auth/google` thì nút Google mới đăng nhập được.
