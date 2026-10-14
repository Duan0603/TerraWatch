import 'dart:math';
import '../constants/app_constants.dart';

/// Các thuật toán toán học hình học không gian chạy ngoại tuyến (Story 5.3 & NFR2)
class GeoMath {
  GeoMath._();

  /// Tính khoảng cách giữa 2 tọa độ (Haversine Formula) theo mét
  static double calculateDistanceMeters(
    double lat1,
    double lon1,
    double lat2,
    double lon2,
  ) {
    final dLat = _toRadians(lat2 - lat1);
    final dLon = _toRadians(lon2 - lon1);

    final a = sin(dLat / 2) * sin(dLat / 2) +
        cos(_toRadians(lat1)) *
            cos(_toRadians(lat2)) *
            sin(dLon / 2) *
            sin(dLon / 2);
    final c = 2 * atan2(sqrt(a), sqrt(1 - a));

    return AppConstants.earthRadiusMeters * c;
  }

  /// Thuật toán Ray-Casting (Point-in-Polygon)
  /// Kiểm tra xem điểm GPS có nằm lọt bên trong đa giác sạt lở hay không
  /// polygonCoords: Danh sách các đỉnh [[lon, lat], [lon, lat], ...]
  static bool isPointInPolygon(
    double pointLat,
    double pointLon,
    List<List<double>> polygonCoords,
  ) {
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
