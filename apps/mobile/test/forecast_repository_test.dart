import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';
import 'package:geosentry_mobile/core/network/api_client.dart';
import 'package:geosentry_mobile/core/network/api_exceptions.dart';
import 'package:geosentry_mobile/core/storage/local_storage.dart';
import 'package:geosentry_mobile/features/geofence/data/forecast_repository.dart';
import 'package:geosentry_mobile/features/geofence/data/zone_store.dart';

// Target: lib/features/geofence/data/forecast_repository.dart, against a real SqliteZoneStore (in-memory DB per test).
// Covers MD-GEO-005, MD-GEO-006, MD-GEO-007, MD-GEO-008 and the "nothing partial is written" part of MD-GEO-009.
// Already asserted by offline_geofence_test: MD-GEO-004 (valid sync), MD-GEO-009 (offline keeps cache), one malformed item.
// MD-GEO-010 (OS permission) does not apply: sync() never asks for a permission.

final _now = DateTime.utc(2026, 10, 14, 12);

Map<String, dynamic> _item(String run, {double lon = 104.1}) => {
      'runId': run,
      'unitId': 'U_$run',
      'unitVersion': 'v1',
      'hazardLevel': 'high',
      'probability': 0.8,
      'issuedAt': _now.toIso8601String(),
      'validFrom': _now.subtract(const Duration(hours: 1)).toIso8601String(),
      'validUntil': _now.add(const Duration(hours: 23)).toIso8601String(),
      'modelVersion': 'm1',
      'geometry': {
        'type': 'Polygon',
        'coordinates': [
          [
            [lon - 0.01, 21.99],
            [lon + 0.01, 21.99],
            [lon + 0.01, 22.01],
            [lon - 0.01, 22.01],
            [lon - 0.01, 21.99],
          ]
        ],
      },
    };

http.Response _json(int status, Object body) => http.Response(jsonEncode(body), status, headers: {'content-type': 'application/json'});

void main() {
  sqfliteFfiInit();
  late Database db;
  late SqliteZoneStore store;
  late http.Response Function(http.Request) reply;
  late List<http.Request> requests;
  late DateTime clock;

  ForecastRepository build() => ForecastRepository(
        store: store,
        apiClient: ApiClient(
          baseUrl: 'http://test',
          client: MockClient((r) async {
            requests.add(r);
            return reply(r);
          }),
        ),
        clock: () => clock,
      );

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    db = await databaseFactoryFfi.openDatabase(inMemoryDatabasePath);
    await LocalStorage.createTables(db);
    store = SqliteZoneStore(() async => db);
    requests = [];
    clock = _now;
    reply = (_) => _json(200, {'items': [_item('a'), _item('b', lon: 105.0)]});
    await build().sync(); // cache = a, b, synced at _now
    requests.clear();
  });

  tearDown(() => db.close());

  Future<List<String>> cachedRuns() async =>
      [for (final r in await db.query('forecast_zones', orderBy: 'run_id')) r['run_id'] as String];

  Future<void> expectCacheUntouched() async {
    expect(await cachedRuns(), ['a', 'b']);
    expect((await store.summary(_now)).lastSyncAt, _now);
  }

  test('MD-GEO-005: a body without "items", or with null / an object as "items", is rejected and the cache stays', () async {
    clock = _now.add(const Duration(hours: 3));
    for (final body in <Map<String, dynamic>>[
      {'serverTime': 'x'},
      {'items': null},
      {'items': {'a': 1}},
    ]) {
      reply = (_) => _json(200, body);
      await expectLater(
        build().sync(),
        throwsA(isA<ApiException>().having((e) => e.message, 'message', 'Dữ liệu dự báo từ máy chủ không hợp lệ')),
        reason: '$body',
      );
    }
    await expectCacheUntouched();
  });

  test('MD-GEO-005: an empty items list is a valid answer: the cache is emptied and the sync time moves', () async {
    clock = _now.add(const Duration(hours: 3));
    reply = (_) => _json(200, {'items': []});
    expect(await build().sync(), 0);
    expect(await cachedRuns(), isEmpty);
    expect((await store.summary(clock)).lastSyncAt, clock);
  });

  test('MD-GEO-006: items of the wrong shape (a string, a null, a missing geometry, a 2-point ring) reject the whole batch', () async {
    clock = _now.add(const Duration(hours: 3));
    final noGeometry = _item('nogeo')..remove('geometry');
    final shortRing = _item('short')
      ..['geometry'] = {
        'type': 'Polygon',
        'coordinates': [
          [
            [0, 0],
            [1, 1],
            [0, 0],
          ]
        ],
      };
    for (final bad in <Object?>['just a string', null, 42, noGeometry, shortRing]) {
      reply = (_) => _json(200, {'items': [_item('good', lon: 107.0), bad]});
      await expectLater(
        build().sync(),
        throwsA(isA<ApiException>().having((e) => e.message, 'message', startsWith('Dữ liệu dự báo từ máy chủ không hợp lệ'))),
        reason: 'bad item: $bad',
      );
    }
    await expectCacheUntouched(); // "good" was never written
  });

  test('MD-GEO-006: the FormatException reason of a bad item is passed on in the message', () async {
    reply = (_) => _json(200, {'items': [_item('x')..['hazardLevel'] = 'catastrophic']});
    await expectLater(
      build().sync(),
      throwsA(isA<ApiException>().having((e) => e.message, 'message', contains('unknown hazard level catastrophic'))),
    );
  });

  test('MD-GEO-007: a 4xx answer becomes the server message (400, 404) or a fixed Vietnamese text (401, 403), cache stays', () async {
    final cases = <int, String>{
      400: 'Bad request from server',
      404: 'No such endpoint',
    };
    for (final entry in cases.entries) {
      reply = (_) => _json(entry.key, {'message': entry.value});
      await expectLater(
        build().sync(),
        throwsA(isA<ApiException>().having((e) => (e.statusCode, e.message), 'status+message', (entry.key, entry.value))),
      );
    }
    reply = (_) => _json(403, {'message': 'ignored'});
    await expectLater(
      build().sync(),
      throwsA(isA<ApiException>().having((e) => (e.statusCode, e.message), 'status+message', (403, 'Không có quyền truy cập.'))),
    );
    reply = (_) => _json(401, {'message': 'ignored'});
    await expectLater(
      build().sync(),
      throwsA(isA<ApiException>().having((e) => (e.statusCode, e.message), 'status+message', (401, 'Hết phiên đăng nhập. Vui lòng đăng nhập lại.'))),
    );
    await expectCacheUntouched();
  });

  test('MD-GEO-008: a 5xx answer (JSON message, plain text, empty body) keeps the old cache and reports an error', () async {
    clock = _now.add(const Duration(hours: 3));
    for (final response in [
      http.Response('{"message":"db down"}', 500, headers: {'content-type': 'application/json'}),
      http.Response('<html>Bad gateway</html>', 502),
      http.Response('', 503),
    ]) {
      reply = (_) => response;
      await expectLater(
        build().sync(),
        throwsA(isA<ApiException>().having((e) => e.statusCode, 'statusCode', response.statusCode)),
      );
    }
    reply = (_) => http.Response('<html>Bad gateway</html>', 502);
    await expectLater(build().sync(), throwsA(isA<ApiException>().having((e) => e.message, 'message', 'Lỗi máy chủ (502)')));
    await expectCacheUntouched();
  });

  test('MD-GEO-008: a 200 answer whose body is not JSON is an error, not "0 zones synced"', () async {
    reply = (_) => http.Response('<html>captive portal</html>', 200);
    await expectLater(build().sync(), throwsA(isA<ApiException>()));
    await expectCacheUntouched();
  });

  test('MD-GEO-009: a transport failure writes nothing and the sync time is the old one', () async {
    clock = _now.add(const Duration(hours: 3));
    final offline = ForecastRepository(
      store: store,
      apiClient: ApiClient(baseUrl: 'http://test', client: MockClient((_) async => throw http.ClientException('no route'))),
      clock: () => clock,
    );
    await expectLater(offline.sync(), throwsA(isA<ApiException>().having((e) => e.message, 'message', contains('Không kết nối được máy chủ'))));
    await expectCacheUntouched();
  });

  test('a successful sync after failures stores the sync time from the injected clock in UTC milliseconds', () async {
    clock = DateTime.utc(2026, 10, 15, 1, 2, 3, 456);
    reply = (_) => _json(200, {'items': [_item('c', lon: 106.0)]});
    expect(await build().sync(), 1);
    expect(await cachedRuns(), ['c']);
    final meta = await db.query('cache_meta', where: 'key = ?', whereArgs: ['forecast_synced_at']);
    expect(meta.single['value'], clock.millisecondsSinceEpoch.toString());
    expect(requests.single.url.path, '/api/v1/forecasts/offline-sync');
    expect(requests.single.method, 'GET');
  });
}
