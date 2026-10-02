import 'dart:math';

/// Service tính toán Geofencing ngoại tuyến (NFR2 & UC08)
/// Chạy hoàn toàn cục bộ trên điện thoại không cần 4G/Internet
class OfflineGeofencingService {
  static const double earthRadiusMeters = 6371000.0;

  /// Haversine Distance (Khoảng cách giữa vị trí GPS hiện tại và tâm sạt lở)
  static double calculateDistanceMeters(
      double lat1, double lon1, double lat2, double lon2) {
    final dLat = _toRadians(lat2 - lat1);
    final dLon = _toRadians(lon2 - lon1);

    final a = sin(dLat / 2) * sin(dLat / 2) +
        cos(_toRadians(lat1)) *
            cos(_toRadians(lat2)) *
            sin(dLon / 2) *
            sin(dLon / 2);
    final c = 2 * atan2(sqrt(a), sqrt(1 - a));

    return earthRadiusMeters * c;
  }

  /// Thuật toán Point-in-Polygon (Ray Casting)
  /// Kiểm tra xem điểm GPS hiện tại có nằm trong vùng đa giác sạt lở hay không
  static bool isPointInPolygon(
      double pointLat, double pointLon, List<List<double>> polygonCoords) {
    bool inside = false;
    int j = polygonCoords.length - 1;

    for (int i = 0; i < polygonCoords.length; i++) {
      final xi = polygonCoords[i][0]; // lon
      final yi = polygonCoords[i][1]; // lat
      final xj = polygonCoords[j][0];
      final yj = polygonCoords[j][1];

      final intersect = ((yi > pointLat) != (yj > pointLat)) &&
          (pointLon < (xj - xi) * (pointLat - yi) / (yj - yi) + xi);

      if (intersect) inside = !inside;
      j = i;
    }

    return inside;
  }

  static double _toRadians(double degree) => degree * pi / 180.0;
}
