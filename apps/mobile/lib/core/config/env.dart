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

  /// Web client ID (client_type 3 trong google-services.json); không phải bí mật.
  static const String googleServerClientId = String.fromEnvironment(
    'GOOGLE_SERVER_CLIENT_ID',
    defaultValue: '484674000797-5dcns0a47mg8rk2mfanteocgeknfe9ii.apps.googleusercontent.com',
  );

  /// Khóa MapTiler Cloud cho nền bản đồ (truyền bằng --dart-define=MAPTILER_KEY=...; không ghi vào repo).
  static const String mapTilerKey = String.fromEnvironment('MAPTILER_KEY');

  /// Nền địa hình giống bản web (topo-v2); chưa có khóa thì dùng nền OpenFreeMap miễn phí.
  static String topoStyleUrl([String key = mapTilerKey]) => key.isEmpty
      ? 'https://tiles.openfreemap.org/styles/liberty'
      : 'https://api.maptiler.com/maps/topo-v2/style.json?key=$key';

  /// Nền vệ tinh giống bản web; null khi chưa có khóa MapTiler.
  static String? satelliteStyleUrl([String key = mapTilerKey]) =>
      key.isEmpty ? null : 'https://api.maptiler.com/maps/satellite/style.json?key=$key';

  static const String mapboxAccessToken = String.fromEnvironment(
    'MAPBOX_ACCESS_TOKEN',
    defaultValue: 'pk.placeholder_mapbox_token',
  );
}
