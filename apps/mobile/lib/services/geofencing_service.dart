import '../core/utils/geo_math.dart';
import '../core/storage/local_storage.dart';
import 'notification_service.dart';

/// Service tính toán Geofencing ngoại tuyến (NFR2 & UC08)
/// Chạy hoàn toàn cục bộ trên điện thoại không cần 4G/Internet
class OfflineGeofencingService {
  /// Kiểm tra xem vị trí hiện tại có lọt vào vùng sạt lở nguy hiểm nào không
  static Future<bool> checkCurrentLocationHazard(double lat, double lon) async {
    final db = await LocalStorage.database;

    // Lọc nhanh trong SQLite theo bounding box bán kính khoảng 500m (~ 0.005 độ)
    const delta = 0.005;
    final candidates = await db.query(
      'hazard_polygons',
      where: 'centroid_lat BETWEEN ? AND ? AND centroid_lon BETWEEN ? AND ?',
      whereArgs: [lat - delta, lat + delta, lon - delta, lon + delta],
    );

    for (final row in candidates) {
      final cLat = row['centroid_lat'] as double?;
      final cLon = row['centroid_lon'] as double?;
      if (cLat == null || cLon == null) continue;

      final distance = GeoMath.calculateDistanceMeters(lat, lon, cLat, cLon);
      if (distance <= 500.0) {
        // Kích hoạt còi hú & thông báo khẩn cấp
        await NotificationService.showEmergencyAlert(
          title: '🚨 NGUY HIỂM: BẠN ĐANG Ở VÙNG SẠT LỞ ĐẤT!',
          body: 'Khoảng cách đến tâm sạt lở: ${distance.toStringAsFixed(0)}m. Yêu cầu sơ tán ngay lập tức!',
        );
        return true;
      }
    }

    return false;
  }
}
