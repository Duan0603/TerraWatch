import 'package:flutter_test/flutter_test.dart';
import 'package:geosentry_mobile/features/geofence/data/forecast_zone.dart';

// Target: lib/features/geofence/data/forecast_zone.dart
// Covers MD-GEO-011, MD-GEO-012, MD-GEO-013 and BL-GEO-005.
// BL-GEO-001..004 are already asserted by offline_geofence_test ("expiry boundary"); here the model methods are checked
// directly, including the 1 ms after valid_until case that no older test has.

final _from = DateTime.utc(2026, 10, 14, 12);
final _until = DateTime.utc(2026, 10, 15, 12);

Map<String, dynamic> _json({
  Object? geometry,
  Map<String, Object?> override = const {},
  List<String> drop = const [],
}) {
  final base = <String, dynamic>{
    'runId': 'run-1',
    'unitId': 'U1',
    'unitVersion': 'v7',
    'hazardLevel': 'extreme',
    'probability': 0.65,
    'issuedAt': '2026-10-14T11:00:00Z',
    'validFrom': _from.toIso8601String(),
    'validUntil': _until.toIso8601String(),
    'modelVersion': 'm3',
    'geometry': geometry ??
        {
          'type': 'Polygon',
          'coordinates': [
            [
              [104.0, 21.0],
              [104.5, 21.0],
              [104.2, 21.8],
              [104.0, 21.0],
            ]
          ],
        },
    ...override,
  };
  for (final key in drop) {
    base.remove(key);
  }
  return base;
}

Object _polygon(List<List<num>> ring) => {
      'type': 'Polygon',
      'coordinates': [ring],
    };

void main() {
  group('valid data (MD-GEO-011)', () {
    test('fromJson -> toRow -> fromRow keeps every field, UTC instants and the bounding box', () {
      final zone = ForecastZone.fromJson(_json());
      expect((zone.minLat, zone.maxLat, zone.minLon, zone.maxLon), (21.0, 21.8, 104.0, 104.5));

      final row = zone.toRow();
      expect(row['valid_from'], _from.millisecondsSinceEpoch);
      expect(row['valid_until'], _until.millisecondsSinceEpoch);
      expect((row['min_lat'], row['max_lat'], row['min_lon'], row['max_lon']), (21.0, 21.8, 104.0, 104.5));

      final back = ForecastZone.fromRow(row);
      expect((back.runId, back.unitId, back.unitVersion, back.hazardLevel, back.modelVersion), ('run-1', 'U1', 'v7', 'extreme', 'm3'));
      expect(back.probability, 0.65);
      expect((back.issuedAt, back.validFrom, back.validUntil), (zone.issuedAt, _from, _until));
      expect(back.validFrom.isUtc && back.validUntil.isUtc && back.issuedAt.isUtc, isTrue);
      expect(back.ring, zone.ring);
    });

    test('integer coordinates and a minimal closed triangle (3 vertices + closing point) are accepted as doubles', () {
      final zone = ForecastZone.fromJson(_json(geometry: _polygon([
        [0, 0],
        [2, 0],
        [1, 2],
        [0, 0],
      ])));
      expect(zone.ring, [
        [0.0, 0.0],
        [2.0, 0.0],
        [1.0, 2.0],
        [0.0, 0.0],
      ]);
      expect((zone.minLat, zone.maxLat, zone.minLon, zone.maxLon), (0.0, 2.0, 0.0, 2.0));
    });

    test('hazardRank orders low < medium < high < extreme', () {
      final ranks = [
        for (final level in ['low', 'medium', 'high', 'extreme']) ForecastZone.fromJson(_json(override: {'hazardLevel': level})).hazardRank
      ];
      expect(ranks, [0, 1, 2, 3]);
    });
  });

  group('missing fields and nulls (MD-GEO-012)', () {
    test('optional fields missing or null get safe defaults', () {
      final zone = ForecastZone.fromJson(_json(drop: ['unitVersion', 'modelVersion', 'probability']));
      expect([zone.unitVersion, zone.modelVersion], ['', '']);
      expect(zone.probability, isNull);

      final nulls = ForecastZone.fromJson(_json(override: {'unitVersion': null, 'modelVersion': null, 'probability': null}));
      expect([nulls.unitVersion, nulls.modelVersion], ['', '']);
      expect(nulls.probability, isNull);

      // a null probability survives the SQLite round trip as null, not as 0
      expect(ForecastZone.fromRow(zone.toRow()).probability, isNull);
    });

    test('each required field missing is rejected as FormatException, never a raw TypeError', () {
      for (final key in ['runId', 'unitId', 'hazardLevel', 'issuedAt', 'validFrom', 'validUntil', 'geometry']) {
        expect(() => ForecastZone.fromJson(_json(drop: [key])), throwsFormatException, reason: 'missing $key');
      }
      expect(() => ForecastZone.fromJson(_json(override: {'runId': null})), throwsFormatException);
    });
  });

  group('malformed data (MD-GEO-013)', () {
    test('rings that are too short, empty, or hold non-numeric points are rejected', () {
      final tooShort = _polygon([
        [0, 0],
        [1, 0],
        [0, 0],
      ]); // 2 distinct vertices
      expect(() => ForecastZone.fromJson(_json(geometry: tooShort)), throwsFormatException);
      expect(() => ForecastZone.fromJson(_json(geometry: {'type': 'Polygon', 'coordinates': []})), throwsFormatException);
      expect(() => ForecastZone.fromJson(_json(geometry: {'type': 'Polygon', 'coordinates': [[]]})), throwsFormatException);
      final text = {
        'type': 'Polygon',
        'coordinates': [
          [
            ['a', 'b'],
            [1, 0],
            [1, 1],
            [0, 0],
          ]
        ],
      };
      expect(() => ForecastZone.fromJson(_json(geometry: text)), throwsFormatException);
      expect(() => ForecastZone.fromJson(_json(geometry: 'POLYGON((0 0))')), throwsFormatException);
    });

    test('bad dates, a reversed validity window and a wrong hazard type are rejected', () {
      expect(() => ForecastZone.fromJson(_json(override: {'validFrom': 'yesterday'})), throwsFormatException);
      expect(() => ForecastZone.fromJson(_json(override: {'issuedAt': 12345})), throwsFormatException);
      expect(() => ForecastZone.fromJson(_json(override: {'validFrom': _until.toIso8601String(), 'validUntil': _from.toIso8601String()})),
          throwsFormatException);
      expect(() => ForecastZone.fromJson(_json(override: {'hazardLevel': 3})), throwsFormatException);
      expect(() => ForecastZone.fromJson(_json(override: {'hazardLevel': 'HIGH'})), throwsFormatException, reason: 'level names are case sensitive');
    });

    test('a corrupt SQLite row does not produce a half-valid zone', () {
      final row = ForecastZone.fromJson(_json()).toRow();
      expect(() => ForecastZone.fromRow({...row, 'polygon': 'not json'}), throwsFormatException);
      expect(() => ForecastZone.fromRow({...row, 'valid_until': null}), throwsA(isA<TypeError>()));
    });
  });

  group('validity window boundaries (BL-GEO-005, complements BL-GEO-001..004)', () {
    test('1 ms around valid_from and valid_until: valid and expired never overlap', () {
      final zone = ForecastZone.fromJson(_json());
      const ms = Duration(milliseconds: 1);
      final cases = <(DateTime, bool valid, bool expired)>[
        (_from.subtract(ms), false, false), // not started yet: neither valid nor expired
        (_from, true, false),
        (_until.subtract(ms), true, false),
        (_until, false, true), // exactly valid_until is already expired
        (_until.add(ms), false, true), // BL-GEO-005
      ];
      for (final (at, valid, expired) in cases) {
        expect(zone.isValidAt(at), valid, reason: 'isValidAt $at');
        expect(zone.isExpiredAt(at), expired, reason: 'isExpiredAt $at');
      }
    });

    test('the same instant written with another UTC offset gives the same boundary', () {
      final plus7 = ForecastZone.fromJson(_json(override: {'validUntil': '2026-10-15T19:00:00+07:00'}));
      expect(plus7.isExpiredAt(_until), isTrue);
      expect(plus7.isValidAt(_until.subtract(const Duration(milliseconds: 1))), isTrue);
    });
  });
}
