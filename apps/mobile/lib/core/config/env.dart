/// Cấu hình môi trường cho ứng dụng di động
class AppEnv {
  AppEnv._();

  /// Địa chỉ Nginx Gateway:
  /// Mặc định 127.0.0.1:8080, dùng với `adb reverse tcp:8080 tcp:8080` (máy thật qua USB hoặc máy ảo).
  /// Ghi đè bằng --dart-define=API_BASE_URL=... (vd. IP LAN hoặc http://10.0.2.2:8080 cho máy ảo không reverse).
  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://127.0.0.1:8080',
  );

  static const String mapboxAccessToken = String.fromEnvironment(
    'MAPBOX_ACCESS_TOKEN',
    defaultValue: 'pk.placeholder_mapbox_token',
  );
}
