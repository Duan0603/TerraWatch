import 'dart:math';

import 'package:flutter_test/flutter_test.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';
import 'package:geosentry_mobile/core/storage/local_storage.dart';
import 'package:geosentry_mobile/features/geofence/data/forecast_zone.dart';
import 'package:geosentry_mobile/features/geofence/data/geofence_evaluator.dart';
import 'package:geosentry_mobile/features/geofence/data/zone_store.dart';

// Target: lib/features/geofence/data/zone_store.dart (SqliteZoneStore on a private in-memory database per test).
// Covers MD-GEO-018, MD-GEO-019, BL-GEO-008, BL-GEO-009, BL-GEO-011, BL-GEO-012, BL-GEO-013, BL-GEO-014.
// Already asserted elsewhere: MD-GEO-017 and BL-GEO-010 (zone_store_sqlite_test), atomic replace on a duplicate key.

final _now = DateTime.utc(2026, 10, 14, 12);

ForecastZone _zone(String run, List<List<double>> ring, {Duration validFor = const Duration(hours: 23)}) => ForecastZone(
      runId: run,
      unitId: 'U-$run',
      unitVersion: 'v1',
      hazardLevel: 'high',
      probability: null,
      issuedAt: _now,
      validFrom: _now.subtract(const Duration(hours: 1)),
      validUntil: _now.add(validFor),
      modelVersion: 'm1',
      ring: ring,
    );

/// Ô vuông 0.01° trên lưới 100 cột, không chồng nhau
ForecastZone _cell(int i) {
  final lon = 104.0 + (i % 100) * 0.01;
  final lat = 21.0 + (i ~/ 100) * 0.01;
  return _zone('run-$i', [
    [lon, lat],
    [lon + 0.01, lat],
    [lon + 0.01, lat + 0.01],
    [lon, lat + 0.01],
    [lon, lat],
  ]);
}

void main() {
  sqfliteFfiInit();
  late Database db;
  late SqliteZoneStore store;
  late GeofenceEvaluator evaluator;

  setUp(() async {
    db = await databaseFactoryFfi.openDatabase(inMemoryDatabasePath);
    await LocalStorage.createTables(db);
    store = SqliteZoneStore(() async => db);
    evaluator = GeofenceEvaluator(store, clock: () => _now);
  });

  tearDown(() => db.close());

  group('empty and missing data (MD-GEO-018, BL-GEO-008, BL-GEO-009)', () {
    test('a store that was never written: zero counts, no sync time, no candidates, and the evaluator says neverSynced', () async {
      final summary = await store.summary(_now);
      expect((summary.count, summary.unexpiredCount), (0, 0));
      expect(summary.lastSyncAt, isNull);
      expect(await store.candidates(21.0, 104.0), isEmpty);
      final result = await evaluator.evaluate(21.0, 104.0);
      expect((result.status, result.staleReason), (GeofenceStatus.stale, StaleReason.neverSynced));
    });

    test('0 zones replaced in: a previous cache is emptied but the sync time still moves (empty is not "never synced")', () async {
      await store.replaceAll([_cell(0), _cell(1)], _now.subtract(const Duration(hours: 5)));
      await store.replaceAll([], _now);
      final summary = await store.summary(_now);
      expect((summary.count, summary.unexpiredCount, summary.lastSyncAt), (0, 0, _now));
      final result = await evaluator.evaluate(21.005, 104.005);
      expect(result.status, GeofenceStatus.none);
      expect(result.zoneCount, 0);
    });

    test('1 zone: stored, found in its box, and decided', () async {
      await store.replaceAll([_cell(0)], _now);
      expect((await store.summary(_now)).count, 1);
      expect((await store.candidates(21.005, 104.005)).single.runId, 'run-0');
      expect((await evaluator.evaluate(21.005, 104.005)).status, GeofenceStatus.warning);
    });

    test('a second replace swaps the whole cache and moves the sync time forward', () async {
      await store.replaceAll([_cell(0), _cell(1), _cell(2)], _now.subtract(const Duration(hours: 2)));
      await store.replaceAll([_cell(7)], _now);
      expect((await store.candidates(21.005, 104.005)), isEmpty, reason: 'cell 0 was dropped');
      expect((await store.candidates(21.005, 104.075)).single.runId, 'run-7');
      expect((await store.summary(_now)).lastSyncAt, _now);
    });
  });

  group('malformed stored data (MD-GEO-019)', () {
    Future<void> insertRaw(String run, {String polygon = '[]', int validUntil = 9999999999999}) => db.insert('forecast_zones', {
          'run_id': run,
          'unit_id': 'u',
          'unit_version': 'v',
          'hazard_level': 'high',
          'probability': null,
          'issued_at': 1,
          'valid_from': 1,
          'valid_until': validUntil,
          'model_version': 'm',
          'polygon': polygon,
          'min_lat': 0.0,
          'max_lat': 1.0,
          'min_lon': 0.0,
          'max_lon': 1.0,
        });

    test('a sync time that is not a number fails loudly instead of being read as "synced"', () async {
      await db.insert('cache_meta', {'key': 'forecast_synced_at', 'value': 'yesterday'});
      await expectLater(store.summary(_now), throwsFormatException);
    });

    test('a zone whose polygon text is corrupt throws on lookup inside its box and is invisible outside it', () async {
      await insertRaw('corrupt', polygon: 'not json');
      await expectLater(store.candidates(0.5, 0.5), throwsFormatException);
      expect(await store.candidates(5.0, 5.0), isEmpty);
    });

    test('BUG: one corrupt cached zone must not stop the check for a good zone covering the same point', () async {
      // Expected: the corrupt row is skipped and the valid zone still gives a warning (this is a safety check).
      // Actual: candidates() maps every row through ForecastZone.fromRow, so the FormatException escapes evaluate().
      await store.replaceAll([_zone('good', [[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]])], _now);
      await insertRaw('corrupt', polygon: 'not json');
      final result = await evaluator.evaluate(0.5, 0.5);
      expect(result.status, GeofenceStatus.warning);
    }, skip: 'BUG: expected a corrupt cached row to be skipped so a valid zone at the same point still warns; '
        'actual: SqliteZoneStore.candidates -> ForecastZone.fromRow throws FormatException and evaluate() fails (zone_store.dart candidates).');
  });

  group('capacity and polygon size (BL-GEO-011..014)', () {
    test('10,001 zones: one more than the planned capacity is stored and the last one is found (behaviour: no limit enforced)', () async {
      final zones = [for (var i = 0; i < 10001; i++) _cell(i)];
      await store.replaceAll(zones, _now);
      expect((await store.summary(_now)).count, 10001);
      // ô 10000: hàng 100, cột 0
      final last = await evaluator.evaluate(21.0 + 100 * 0.01 + 0.005, 104.005);
      expect(last.status, GeofenceStatus.warning);
      expect(last.activeZones.single.runId, 'run-10000');
    });

    test('a 3-vertex polygon (triangle) is stored and decided; a point in its bounding box but outside it is not a hit', () async {
      await store.replaceAll([_zone('tri', [[0, 0], [2, 0], [0, 2], [0, 0]])], _now);
      expect((await evaluator.evaluate(0.5, 0.5)).status, GeofenceStatus.warning);
      // (1.5, 1.5) nằm trong khung bao nhưng ngoài tam giác
      expect(await store.candidates(1.5, 1.5), hasLength(1));
      expect((await evaluator.evaluate(1.5, 1.5)).status, GeofenceStatus.none);
    });

    test('a 2-vertex ring never reaches the store: parsing rejects it', () {
      final json = {
        'runId': 'line',
        'unitId': 'U',
        'unitVersion': 'v',
        'hazardLevel': 'high',
        'issuedAt': _now.toIso8601String(),
        'validFrom': _now.toIso8601String(),
        'validUntil': _now.add(const Duration(hours: 1)).toIso8601String(),
        'modelVersion': 'm',
        'geometry': {
          'type': 'Polygon',
          'coordinates': [
            [
              [0, 0],
              [1, 1],
              [0, 0],
            ]
          ],
        },
      };
      expect(() => ForecastZone.fromJson(json), throwsFormatException);
    });

    test('a 1,000-vertex polygon survives the SQLite round trip and the ray-casting still separates inside from outside', () async {
      // Vòng tròn bán kính 1° tâm (0,0) với 999 đỉnh khác nhau + đỉnh đóng = 1,000 đỉnh
      const n = 999;
      final ring = [for (var k = 0; k < n; k++) [cos(2 * pi * k / n), sin(2 * pi * k / n)]];
      ring.add(List.of(ring.first));
      expect(ring.length, 1000);
      await store.replaceAll([_zone('circle', ring)], _now);
      final stored = (await store.candidates(0.0, 0.0)).single;
      expect(stored.ring.length, 1000);
      expect(stored.ring[500], ring[500], reason: 'JSON round trip keeps full double precision');
      expect((await evaluator.evaluate(0.0, 0.0)).status, GeofenceStatus.warning);
      expect((await evaluator.evaluate(0.7, 0.7)).status, GeofenceStatus.warning, reason: 'inside the circle (r=0.99)');
      // Góc khung bao (0.95, 0.95): trong khung bao nhưng ngoài vòng tròn
      expect(await store.candidates(0.95, 0.95), hasLength(1));
      expect((await evaluator.evaluate(0.95, 0.95)).status, GeofenceStatus.none);
    });
  });
}
