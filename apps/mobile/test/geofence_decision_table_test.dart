import 'package:flutter_test/flutter_test.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';
import 'package:geosentry_mobile/core/storage/local_storage.dart';
import 'package:geosentry_mobile/features/geofence/data/forecast_zone.dart';
import 'package:geosentry_mobile/features/geofence/data/geofence_evaluator.dart';
import 'package:geosentry_mobile/features/geofence/data/zone_store.dart';

// Target: geofence decision table (position x zone validity x cache freshness), run through the real
// GeofenceEvaluator + SqliteZoneStore on a private in-memory database per test.
// Each test below names the ST-GEO row it covers.
// Already asserted by offline_geofence_test / geofence_screen_test, so not repeated here:
//   ST-GEO-001, 002, 011, 016, 021, 026, 027, 028, 029, 030.
// Combinations that cannot exist (the position cannot be inside/on a cached zone when the cache is empty, a
// not-yet-valid or valid zone cannot coexist with "every zone expired") have no test:
//   ST-GEO-004, 005, 009, 010, 014, 019, 020, 024, 025.

final _now = DateTime.utc(2026, 10, 14, 12);
const _h = Duration(hours: 1);
Duration _hrs(int n) => Duration(hours: n);

// Hình vuông lon 104.0..104.5, lat 21.0..21.5
List<List<double>> _square([double shift = 0]) => [
      [104.0 + shift, 21.0 + shift],
      [104.5 + shift, 21.0 + shift],
      [104.5 + shift, 21.5 + shift],
      [104.0 + shift, 21.5 + shift],
      [104.0 + shift, 21.0 + shift],
    ];

ForecastZone _zone(String run, {required Duration from, required Duration until, String hazard = 'high', double shift = 0}) => ForecastZone(
      runId: run,
      unitId: 'U-$run',
      unitVersion: 'v1',
      hazardLevel: hazard,
      probability: 0.5,
      issuedAt: _now.subtract(const Duration(days: 3)),
      validFrom: _now.add(from),
      validUntil: _now.add(until),
      modelVersion: 'm1',
      ring: _square(shift),
    );

// Điểm kiểm tra
const _inside = (21.25, 104.25);
const _onEdge = (21.25, 104.0); // đúng cạnh trái
const _onVertex = (21.0, 104.0);
const _outside = (30.0, 110.0);

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

  Future<GeofenceResult> check(List<ForecastZone> zones, {required Duration? syncAge, (double, double) at = _inside}) async {
    await store.replaceAll(zones, _now.subtract(syncAge ?? Duration.zero));
    if (syncAge == null) await db.delete('cache_meta'); // chưa từng đồng bộ
    return evaluator.evaluate(at.$1, at.$2);
  }

  final valid = _zone('valid', from: -_h, until: _hrs(5));
  final expired = _zone('expired', from: -_hrs(30), until: -_hrs(6));
  final notYet = _zone('notyet', from: _hrs(2), until: _hrs(26));
  const stale24 = Duration(hours: 24, minutes: 1);

  group('inside a valid zone: the alarm wins over every cache state', () {
    test('ST-GEO-003: never synced (no sync time) still warns', () async {
      final r = await check([valid], syncAge: null);
      expect(r.status, GeofenceStatus.warning);
      expect([r.staleReason, r.lastSyncAt], [null, null]);
      expect(r.activeZones.map((z) => z.runId), ['valid']);
    });
  });

  group('on the edge or a vertex of a valid zone', () {
    test('ST-GEO-006: on the edge with a fresh cache: warning', () async {
      final r = await check([valid], syncAge: _h, at: _onEdge);
      expect(r.status, GeofenceStatus.warning);
      expect(r.hazardLevel, 'high');
    });

    test('ST-GEO-007: on the edge with a cache older than 24 h: still warning, not stale', () async {
      final r = await check([valid], syncAge: stale24, at: _onEdge);
      expect(r.status, GeofenceStatus.warning);
      expect(r.staleReason, isNull);
    });

    test('ST-GEO-008: on the edge and never synced: still warning', () async {
      final r = await check([valid], syncAge: null, at: _onEdge);
      expect(r.status, GeofenceStatus.warning);
    });

    test('a vertex counts as inside like an edge', () async {
      expect((await check([valid], syncAge: _h, at: _onVertex)).status, GeofenceStatus.warning);
    });

    test('just outside the edge (1e-6 degree) is not a hit', () async {
      final r = await check([valid], syncAge: _h, at: (21.25, 103.999999));
      expect(r.status, GeofenceStatus.none);
    });
  });

  group('inside an expired zone: the reason follows a fixed priority', () {
    test('ST-GEO-012: cache older than 24 h: syncTooOld takes priority over zoneExpired', () async {
      final r = await check([expired], syncAge: stale24);
      expect((r.status, r.staleReason), (GeofenceStatus.stale, StaleReason.syncTooOld));
      expect(r.expiredZone, isNull, reason: 'no expired zone is reported when the sync age is the reason');
      expect(r.activeZones, isEmpty);
    });

    test('ST-GEO-013: never synced: neverSynced takes priority over zoneExpired', () async {
      final r = await check([expired], syncAge: null);
      expect((r.status, r.staleReason), (GeofenceStatus.stale, StaleReason.neverSynced));
      expect(r.lastSyncAt, isNull);
    });

    test('ST-GEO-015: every cached zone expired and the position is inside one: zoneExpired (not allExpired), newest expiry reported', () async {
      final older = _zone('older', from: -_hrs(80), until: -_hrs(50));
      final r = await check([older, expired], syncAge: _h);
      expect((r.status, r.staleReason), (GeofenceStatus.stale, StaleReason.zoneExpired));
      expect(r.expiredZone!.runId, 'expired', reason: 'the zone that expired most recently');
      expect(r.zoneCount, 2);
    });
  });

  group('inside a zone that has not started yet', () {
    test('ST-GEO-017: cache older than 24 h: stale for syncTooOld (a future zone cannot vouch for freshness)', () async {
      final r = await check([notYet], syncAge: stale24);
      expect((r.status, r.staleReason), (GeofenceStatus.stale, StaleReason.syncTooOld));
      expect(r.activeZones, isEmpty);
    });

    test('ST-GEO-018: never synced: stale for neverSynced', () async {
      final r = await check([notYet], syncAge: null);
      expect((r.status, r.staleReason), (GeofenceStatus.stale, StaleReason.neverSynced));
    });
  });

  group('inside two overlapping zones of different levels', () {
    final low = _zone('low', from: -_h, until: _hrs(2), hazard: 'low');
    final extreme = _zone('extreme', from: -_h, until: _hrs(9), hazard: 'extreme');
    final highSoon = _zone('high-soon', from: -_h, until: _h, hazard: 'high');

    test('ST-GEO-022: cache older than 24 h: still a warning, ordered by level, with the earliest expiry', () async {
      final r = await check([low, extreme, highSoon], syncAge: stale24);
      expect(r.status, GeofenceStatus.warning);
      expect(r.activeZones.map((z) => z.runId), ['extreme', 'high-soon', 'low']);
      expect(r.hazardLevel, 'extreme');
      expect(r.soonestValidUntil, _now.add(_h));
    });

    test('ST-GEO-023: never synced: still a warning', () async {
      final r = await check([low, extreme], syncAge: null);
      expect((r.status, r.hazardLevel), (GeofenceStatus.warning, 'extreme'));
    });

    test('an expired zone overlapping a valid one is not listed among the active zones', () async {
      final r = await check([expired, low], syncAge: _h);
      expect(r.activeZones.map((z) => z.runId), ['low']);
      expect(r.expiredZone, isNull, reason: 'expiredZone is only reported when the status is zoneExpired');
    });
  });

  group('GeofenceMonitor over the decision table (ring once per run)', () {
    test('a stale result never rings and a later warning for the same run rings exactly once', () async {
      final rings = <String>[];
      final monitor = GeofenceMonitor(evaluator, alarm: ({required title, required body}) async => rings.add(body));

      await store.replaceAll([expired], _now.subtract(_h));
      expect((await monitor.check(_inside.$1, _inside.$2)).status, GeofenceStatus.stale);
      expect(rings, isEmpty);

      await store.replaceAll([valid], _now.subtract(stale24)); // cache cũ nhưng vùng còn hạn
      await monitor.check(_onEdge.$1, _onEdge.$2);
      await monitor.check(_inside.$1, _inside.$2);
      expect(rings, hasLength(1));
    });

    test('outside every zone with a stale cache is stale and silent', () async {
      final rings = <String>[];
      final monitor = GeofenceMonitor(evaluator, alarm: ({required title, required body}) async => rings.add(body));
      await store.replaceAll([valid], _now.subtract(stale24));
      final r = await monitor.check(_outside.$1, _outside.$2);
      expect((r.status, r.staleReason), (GeofenceStatus.stale, StaleReason.syncTooOld));
      expect(rings, isEmpty);
    });
  });
}
