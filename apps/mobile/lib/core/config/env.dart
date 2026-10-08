/// Cấu hình môi trường cho ứng dụng di động
class AppEnv {
  AppEnv._();

  /// Địa chỉ Nginx Gateway:
  /// - Máy ảo Android: 10.0.2.2:8080
  /// - Máy thật / iOS: localhost:8080 hoặc IP LAN
  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://10.0.2.2:8080',
  );

  static const String mapboxAccessToken = String.fromEnvironment(
    'MAPBOX_ACCESS_TOKEN',
    defaultValue: 'pk.placeholder_mapbox_token',
  );
}
