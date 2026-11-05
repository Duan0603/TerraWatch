import 'package:flutter_test/flutter_test.dart';
import 'package:geosentry_mobile/core/data/vietnam_mountain_zones.dart';

void main() {
  group('Vietnam Mountain Landslide Dataset Tests', () {
    test('Dataset completeness and zone uniqueness', () {
      final zones = VietnamMountainDataset.zones;
      expect(zones.length, greaterThanOrEqualTo(100));

      final ids = zones.map((z) => z.zoneId).toSet();
      expect(ids.length, zones.length, reason: 'All zone IDs must be unique');
    });

    test('All zone coordinates are within Vietnam territorial bounds', () {
      for (final zone in VietnamMountainDataset.zones) {
        expect(zone.nameVi.isNotEmpty, true);
        expect(zone.provinceVi.isNotEmpty, true);

        // Vietnam mainland coordinates: Lng [102.0, 110.0], Lat [8.0, 24.0]
        expect(zone.center.longitude, greaterThanOrEqualTo(101.5));
        expect(zone.center.longitude, lessThanOrEqualTo(110.5));
        expect(zone.center.latitude, greaterThanOrEqualTo(8.0));
        expect(zone.center.latitude, lessThanOrEqualTo(24.0));

        // Topography validation
        expect(zone.topography.meanElevationM, greaterThan(0));
        expect(zone.topography.meanSlopeDegrees, greaterThan(15.0));
        expect(zone.topography.meanSlopeDegrees, lessThan(60.0));

        // Station code validation
        expect(zone.stationCode.startsWith('TW-'), true);
      }
    });

    test('Query zone by ID returns exact match', () {
      final sapa = VietnamMountainDataset.getZoneById('LC-SP');
      expect(sapa, isNotNull);
      expect(sapa!.nameVi, 'Sa Pa');
      expect(sapa.provinceVi, 'Lào Cai');
      expect(sapa.tier, SusceptibilityTier.CRITICAL);
      expect(sapa.topography.peakElevationM, 3143.0);

      final mucangchai = VietnamMountainDataset.getZoneById('YB-MC');
      expect(mucangchai, isNotNull);
      expect(mucangchai!.nameVi, 'Mù Cang Chải');
      expect(mucangchai.tier, SusceptibilityTier.CRITICAL);
    });

    test('Query zones by province', () {
      final laoCaiZones = VietnamMountainDataset.getZonesByProvince('Lào Cai');
      expect(laoCaiZones.length, greaterThanOrEqualTo(8));
      expect(laoCaiZones.any((z) => z.nameVi == 'Bát Xát'), true);
      expect(laoCaiZones.any((z) => z.nameVi == 'Bắc Hà'), true);

      final yenBaiZones = VietnamMountainDataset.getZonesByProvince('Yên Bái');
      expect(yenBaiZones.length, greaterThanOrEqualTo(6));
    });

    test('Query critical zones returns only critical tier', () {
      final criticals = VietnamMountainDataset.getCriticalZones();
      expect(criticals.isNotEmpty, true);
      for (final z in criticals) {
        expect(z.tier, SusceptibilityTier.CRITICAL);
      }
    });

    test('Available provinces list is sorted and unique', () {
      final provinces = VietnamMountainDataset.getAvailableProvinces();
      expect(provinces.length, greaterThanOrEqualTo(15));
      expect(provinces.contains('Lào Cai'), true);
      expect(provinces.contains('Hà Giang'), true);
      expect(provinces.contains('Yên Bái'), true);
      expect(provinces.contains('Lâm Đồng'), true);
    });
  });
}
