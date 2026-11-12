import 'package:flutter_test/flutter_test.dart';
import 'package:geosentry_mobile/core/utils/geo_math.dart';

void main() {
  group('GeoMath Offline Spatial Algorithms', () {
    test('calculateDistanceMeters handles identical, symmetric, and known degree distances', () {
      const saPaLat = 22.3364;
      const saPaLon = 103.8438;
      const fanSiPanLat = 22.3033;
      const fanSiPanLon = 103.7750;

      expect(GeoMath.calculateDistanceMeters(saPaLat, saPaLon, saPaLat, saPaLon), 0.0);

      final dForward = GeoMath.calculateDistanceMeters(saPaLat, saPaLon, fanSiPanLat, fanSiPanLon);
      final dReverse = GeoMath.calculateDistanceMeters(fanSiPanLat, fanSiPanLon, saPaLat, saPaLon);

      expect(dForward, closeTo(dReverse, 1e-6));
      // Sa Pa center to Fansipan peak is roughly 7.9 - 8.1 km
      expect(dForward, inInclusiveRange(7500.0, 8500.0));
    });

    test('isPointInPolygon classifies interior and exterior coordinates accurately', () {
      // Square polygon around Lao Cai: lon [103.9, 104.1], lat [22.4, 22.6]
      final square = <List<double>>[
        [103.9, 22.4],
        [104.1, 22.4],
        [104.1, 22.6],
        [103.9, 22.6],
      ];

      expect(GeoMath.isPointInPolygon(22.5, 104.0, square), isTrue);
      expect(GeoMath.isPointInPolygon(22.3, 104.0, square), isFalse);
      expect(GeoMath.isPointInPolygon(22.5, 104.2, square), isFalse);
    });

    test('isPointInOrOnPolygon includes edge boundaries and corner vertices', () {
      final zone = <List<double>>[
        [103.9, 22.4],
        [104.1, 22.4],
        [104.1, 22.6],
        [103.9, 22.6],
      ];

      // Boundary midpoint and exact vertex must evaluate inside
      expect(GeoMath.isPointInOrOnPolygon(22.4, 104.0, zone), isTrue);
      expect(GeoMath.isPointInOrOnPolygon(22.5, 104.1, zone), isTrue);
      expect(GeoMath.isPointInOrOnPolygon(22.4, 103.9, zone), isTrue);

      // Clearly outside point must stay false
      expect(GeoMath.isPointInOrOnPolygon(22.7, 104.0, zone), isFalse);
    });
  });
}
