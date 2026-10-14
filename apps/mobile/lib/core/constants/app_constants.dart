/// Các hằng số vận hành của ứng dụng di động GeoSentry
class AppConstants {
  AppConstants._();

  static const String appName = 'GeoSentry';
  static const String appTagline = 'Cảnh Báo Sớm Sạt Lở Đất Ngoại Tuyến';

  // Geofencing Defaults (NFR2 & UC08)
  static const double defaultHazardRadiusMeters = 500.0;
  static const int locationIntervalSeconds = 10;
  static const double earthRadiusMeters = 6371000.0;

  // SQLite Config
  static const String dbName = 'geosentry_local.db';
  static const int dbVersion = 2;
}
