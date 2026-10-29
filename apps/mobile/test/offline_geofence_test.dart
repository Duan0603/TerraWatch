import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:geosentry_mobile/core/network/api_client.dart';
import 'package:geosentry_mobile/core/network/api_exceptions.dart';
import 'package:geosentry_mobile/core/utils/geo_math.dart';
import 'package:geosentry_mobile/features/geofence/data/forecast_repository.dart';
import 'package:geosentry_mobile/features/geofence/data/forecast_zone.dart';
import 'package:geosentry_mobile/features/geofence/data/geofence_evaluator.dart';
import 'package:geosentry_mobile/features/geofence/data/zone_store.dart';
import 'package:geosentry_mobile/features/geofence/presentation/geofence_screen.dart';

class InMemoryZoneStore implements ZoneStore {
  var zones = <ForecastZone>[];
  DateTime? syncedAt;

  @override
  Future<void> replaceAll(List<ForecastZone> newZones, DateTime at) async {
    zones = List.of(newZones);
    syncedAt = at;
  }

  @override
  Future<List<ForecastZone>> candidates(double lat, double lon) async =>
      zones.where((z) => z.minLat <= lat && z.maxLat >= lat && z.minLon <= lon && z.maxLon >= lon).toList();

  @override
  Future<ZoneSummary> summary(DateTime now) async => ZoneSummary(
        count: zones.length,
        unexpiredCount: zones.where((z) => z.validUntil.isAfter(now)).length,
        lastSyncAt: syncedAt,
      );
}

final now = DateTime.utc(2026, 10, 14, 12);

/// Hình vuông 0.02° quanh (lon 104.1, lat 22.0) trừ khi chỉ định khác
Map<String, dynamic> zoneJson(String runId,
    {String hazard = 'high', DateTime? from, DateTime? until, double lon = 104.1, double lat = 22.0, String? fromText, String? untilText}) {
  final f = from ?? now.subtract(const Duration(hours: 1));
  final u = until ?? now.add(const Duration(hours: 23));
  return {
    'runId': runId,
    'unitId': 'U_$runId',
    'unitVersion': 'v1',
    'hazardLevel': hazard,
    'probability': 0.8,
    'issuedAt': f.toIso8601String(),
    'validFrom': fromText ?? f.toIso8601String(),
    'validUntil': untilText ?? u.toIso8601String(),
    'modelVersion': 'm1',
    'geometry': {
      'type': 'Polygon',
      'coordinates': [
        [
          [lon - 0.01, lat - 0.01],
          [lon + 0.01, lat - 0.01],
          [lon + 0.01, lat + 0.01],
          [lon - 0.01, lat + 0.01],
          [lon - 0.01, lat - 0.01],
        ]
      ],
    },
  };
}

ForecastZone zone(String runId, {String hazard = 'high', DateTime? from, DateTime? until, double lon = 104.1}) =>
    ForecastZone.fromJson(zoneJson(runId, hazard: hazard, from: from, until: until, lon: lon));

void main() {
  late InMemoryZoneStore store;
  DateTime clock = now;
  late GeofenceEvaluator evaluator;

  setUp(() {
    SharedPreferences.setMockInitialValues({});
    store = InMemoryZoneStore()..syncedAt = now.subtract(const Duration(hours: 1));
    clock = now;
    evaluator = GeofenceEvaluator(store, clock: () => clock);
  });

  group('point in polygon', () {
    final square = [
      [0.0, 0.0],
      [2.0, 0.0],
      [2.0, 2.0],
      [0.0, 2.0],
      [0.0, 0.0],
    ];
    test('inside, outside, on an edge and on a vertex', () {
      expect(GeoMath.isPointInOrOnPolygon(1, 1, square), isTrue);
      expect(GeoMath.isPointInOrOnPolygon(3, 1, square), isFalse);
      expect(GeoMath.isPointInOrOnPolygon(1, 0, square), isTrue); // cạnh dưới
      expect(GeoMath.isPointInOrOnPolygon(2, 2, square), isTrue); // đỉnh
      expect(GeoMath.isPointInOrOnPolygon(1, 2.000001, square), isFalse);
    });
  });

  group('zone parsing', () {
    test('instants are the same whatever offset the server writes (timezone)', () {
      final a = ForecastZone.fromJson(zoneJson('a', untilText: '2026-10-14T18:00:00Z'));
      final b = ForecastZone.fromJson(zoneJson('b', untilText: '2026-10-15T01:00:00+07:00'));
      expect(a.validUntil, b.validUntil);
      expect(b.validUntil.isUtc, isTrue);
    });

    test('bad data is rejected', () {
      final multi = zoneJson('x')..['geometry'] = {'type': 'MultiPolygon', 'coordinates': []};
      expect(() => ForecastZone.fromJson(multi), throwsFormatException);
      expect(() => ForecastZone.fromJson(zoneJson('x', hazard: 'catastrophic')), throwsFormatException);
      expect(() => ForecastZone.fromJson(zoneJson('x', from: now, until: now)), throwsFormatException);
      expect(() => ForecastZone.fromJson({'runId': 1}), throwsFormatException);
    });
  });

  group('evaluator', () {
    test('inside a valid zone: warning with the highest hazard and the soonest expiry', () async {
      store.zones = [
        zone('low-late', hazard: 'low', until: now.add(const Duration(hours: 20))),
        zone('extreme-soon', hazard: 'extreme', until: now.add(const Duration(hours: 5))),
        zone('extreme-later', hazard: 'extreme', until: now.add(const Duration(hours: 9))),
      ];
      final r = await evaluator.evaluate(22.0, 104.1);
      expect(r.status, GeofenceStatus.warning);
      expect(r.hazardLevel, 'extreme');
      expect(r.soonestValidUntil, now.add(const Duration(hours: 5)));
      expect(r.activeZones.length, 3);
    });

    test('expiry boundary: valid_until is expired, valid_from is valid, one millisecond earlier is not', () async {
      store.zones = [zone('z', from: now, until: now.add(const Duration(hours: 1)))];
      clock = now.subtract(const Duration(milliseconds: 1));
      expect((await evaluator.evaluate(22.0, 104.1)).status, isNot(GeofenceStatus.warning));
      clock = now;
      expect((await evaluator.evaluate(22.0, 104.1)).status, GeofenceStatus.warning);
      clock = now.add(const Duration(hours: 1)).subtract(const Duration(milliseconds: 1));
      expect((await evaluator.evaluate(22.0, 104.1)).status, GeofenceStatus.warning);
      clock = now.add(const Duration(hours: 1));
      final expired = await evaluator.evaluate(22.0, 104.1);
      expect(expired.status, GeofenceStatus.stale);
      expect(expired.staleReason, StaleReason.zoneExpired);
    });

    test('an expired zone is stale, never an alarm and never "none"', () async {
      store.zones = [zone('old', until: now.subtract(const Duration(minutes: 5)), from: now.subtract(const Duration(hours: 24)))];
      final r = await evaluator.evaluate(22.0, 104.1);
      expect(r.status, GeofenceStatus.stale);
      expect(r.staleReason, StaleReason.zoneExpired);
      expect(r.expiredZone!.runId, 'old');
      expect(r.activeZones, isEmpty);
    });

    test('outside every zone with fresh data: no current warning (not an all-clear)', () async {
      store.zones = [zone('z')];
      final r = await evaluator.evaluate(23.5, 105.5);
      expect(r.status, GeofenceStatus.none);
      expect(r.staleReason, isNull);
    });

    test('an empty cache that was synced recently is "none"; never synced is stale', () async {
      expect((await evaluator.evaluate(22.0, 104.1)).status, GeofenceStatus.none);
      store.syncedAt = null;
      final r = await evaluator.evaluate(22.0, 104.1);
      expect(r.status, GeofenceStatus.stale);
      expect(r.staleReason, StaleReason.neverSynced);
    });

    test('a sync older than 24 h makes outside points stale, but a valid zone still alarms', () async {
      store.syncedAt = now.subtract(const Duration(hours: 24, minutes: 1));
      store.zones = [zone('z')];
      final outside = await evaluator.evaluate(23.5, 105.5);
      expect(outside.status, GeofenceStatus.stale);
      expect(outside.staleReason, StaleReason.syncTooOld);
      expect((await evaluator.evaluate(22.0, 104.1)).status, GeofenceStatus.warning);
      store.syncedAt = now.subtract(const Duration(hours: 24)); // đúng 24 h vẫn còn mới
      expect((await evaluator.evaluate(23.5, 105.5)).status, GeofenceStatus.none);
    });

    test('when every cached zone has expired, outside points are stale', () async {
      store.zones = [zone('old', from: now.subtract(const Duration(hours: 30)), until: now.subtract(const Duration(hours: 6)), lon: 103.0)];
      final r = await evaluator.evaluate(23.5, 105.5);
      expect(r.status, GeofenceStatus.stale);
      expect(r.staleReason, StaleReason.allExpired);
    });

    test('a zone that has not started yet is neither an alarm nor "all expired"', () async {
      store.zones = [zone('later', from: now.add(const Duration(hours: 2)), until: now.add(const Duration(hours: 26)))];
      expect((await evaluator.evaluate(22.0, 104.1)).status, GeofenceStatus.none);
    });
  });

  group('monitor', () {
    test('rings once per run, not on every GPS fix, and again for a new run', () async {
      final rings = <String>[];
      final monitor = GeofenceMonitor(evaluator, alarm: ({required title, required body}) async => rings.add(body));
      store.zones = [zone('r1')];
      await monitor.check(22.0, 104.1);
      await monitor.check(22.001, 104.1);
      expect(rings.length, 1);
      store.zones = [zone('r1'), zone('r2', hazard: 'extreme')];
      await monitor.check(22.0, 104.1);
      expect(rings.length, 2);
      expect(rings.last, contains('rất cao'));
    });

    test('an expired zone never rings', () async {
      final rings = <String>[];
      final monitor = GeofenceMonitor(evaluator, alarm: ({required title, required body}) async => rings.add(body));
      store.zones = [zone('old', from: now.subtract(const Duration(hours: 30)), until: now.subtract(const Duration(hours: 6)))];
      await monitor.check(22.0, 104.1);
      expect(rings, isEmpty);
    });
  });

  group('sync', () {
    late List<Map<String, dynamic>> serverItems;
    var online = true;

    ForecastRepository build() => ForecastRepository(
          store: store,
          apiClient: ApiClient(
            baseUrl: 'http://test',
            client: MockClient((r) async {
              if (!online) throw Exception('no route to host');
              expect(r.url.path, '/api/v1/forecasts/offline-sync');
              return http.Response(jsonEncode({'serverTime': now.toIso8601String(), 'items': serverItems}), 200,
                  headers: {'content-type': 'application/json'});
            }),
          ),
          clock: () => now,
        );

    setUp(() {
      online = true;
      serverItems = [zoneJson('a'), zoneJson('b', lon: 105.0)];
    });

    test('replaces the cache and records the sync time', () async {
      store.syncedAt = null;
      expect(await build().sync(), 2);
      expect(store.zones.map((z) => z.runId), ['a', 'b']);
      expect(store.syncedAt, now);
    });

    test('a zone the server no longer lists (revoked or superseded) disappears locally', () async {
      await build().sync();
      serverItems = [zoneJson('b', lon: 105.0), zoneJson('c', lon: 106.0)];
      await build().sync();
      expect(store.zones.map((z) => z.runId), ['b', 'c']);
    });

    test('offline: nothing changes, the old cache and sync time stay', () async {
      await build().sync();
      final before = store.syncedAt;
      online = false;
      await expectLater(build().sync(), throwsA(isA<ApiException>()));
      expect(store.zones.length, 2);
      expect(store.syncedAt, before);
    });

    test('malformed data is rejected as a whole and leaves the cache untouched', () async {
      await build().sync();
      serverItems = [zoneJson('good', lon: 107.0), {'runId': 'broken'}];
      await expectLater(build().sync(), throwsA(isA<ApiException>()));
      expect(store.zones.map((z) => z.runId), ['a', 'b']);
    });

    test('the cache ages into "stale" after an offline sync window passes', () async {
      await build().sync();
      clock = now.add(const Duration(hours: 24, minutes: 1)); // hết hạn (23 h) và quá 24 h chưa đồng bộ
      final r = await GeofenceEvaluator(store, clock: () => clock).evaluate(22.0, 104.1);
      expect(r.status, GeofenceStatus.stale);
    });
  });

  group('screen', () {
    testWidgets('checking a position inside a zone shows the warning and rings once', (tester) async {
      store.zones = [zone('z', hazard: 'high')];
      final rings = <String>[];
      await tester.pumpWidget(MaterialApp(
        home: GeofenceScreen(
          store: store,
          clock: () => clock,
          notificationPermission: () async {},
          alarm: ({required title, required body}) async => rings.add(body),
          locationProvider: () async => (latitude: 22.0, longitude: 104.1),
        ),
      ));
      await tester.pumpAndSettle();
      expect(find.text('Chưa kiểm tra vị trí'), findsOneWidget);
      expect(find.textContaining('Vùng dự báo đã lưu trên máy: 1'), findsOneWidget);

      await tester.tap(find.text('Kiểm tra vị trí'));
      await tester.pumpAndSettle();
      expect(find.text('Bạn đang trong vùng cảnh báo'), findsOneWidget);
      expect(find.textContaining('Mức nguy cơ: Cao'), findsOneWidget);
      expect(rings.length, 1);
    });

    testWidgets('an expired zone shows stale data and never the word safe', (tester) async {
      store.zones = [zone('old', from: now.subtract(const Duration(hours: 30)), until: now.subtract(const Duration(hours: 6)))];
      await tester.pumpWidget(MaterialApp(
        home: GeofenceScreen(
          store: store,
          clock: () => clock,
          notificationPermission: () async {},
          alarm: ({required title, required body}) async => fail('must not ring'),
          locationProvider: () async => (latitude: 22.0, longitude: 104.1),
        ),
      ));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Kiểm tra vị trí'));
      await tester.pumpAndSettle();
      expect(find.text('Dữ liệu dự báo đã cũ'), findsOneWidget);
      expect(find.textContaining('đã hết hạn lúc'), findsOneWidget);
      expect(find.textContaining('không phải xác nhận an toàn'), findsWidgets);
      expect(find.text('An toàn'), findsNothing);
    });

    testWidgets('a location error is shown instead of crashing', (tester) async {
      await tester.pumpWidget(MaterialApp(
        home: GeofenceScreen(
          store: store,
          clock: () => clock,
          notificationPermission: () async {},
          locationProvider: () async => throw const ApiException(message: 'Không lấy được vị trí hiện tại'),
        ),
      ));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Kiểm tra vị trí'));
      await tester.pumpAndSettle();
      expect(find.text('Không lấy được vị trí hiện tại'), findsOneWidget);
    });
  });
}
