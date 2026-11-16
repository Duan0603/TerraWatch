import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:geosentry_mobile/core/network/api_client.dart';
import 'package:geosentry_mobile/core/network/api_exceptions.dart';
import 'package:geosentry_mobile/features/geofence/data/device_location.dart';
import 'package:geosentry_mobile/features/geofence/data/forecast_repository.dart';
import 'package:geosentry_mobile/features/geofence/data/forecast_zone.dart';
import 'package:geosentry_mobile/features/geofence/data/zone_store.dart';
import 'package:geosentry_mobile/features/geofence/presentation/geofence_screen.dart';

import 'support/harness.dart';

// Covers the parts of GeofenceScreen that offline_geofence_test.dart does not: sync button, live watch
// switch, every status card, busy state and formatLocal. (check inside zone / expired zone / location error
// are already there.)

class _Store implements ZoneStore {
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
  Future<ZoneSummary> summary(DateTime now) async =>
      ZoneSummary(count: zones.length, unexpiredCount: zones.where((z) => z.validUntil.isAfter(now)).length, lastSyncAt: syncedAt);
}

final _now = DateTime.utc(2026, 10, 14, 12);

Map<String, dynamic> _zoneJson(String run, {double lon = 104.1, String hazard = 'high'}) => {
      'runId': run,
      'unitId': 'U_$run',
      'unitVersion': 'v1',
      'hazardLevel': hazard,
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

void main() {
  late _Store store;
  late FakeBackend server;
  late List<String> rings;

  setUp(() {
    store = _Store();
    server = FakeBackend()..handler = (_) => jsonResponse(200, {'items': [_zoneJson('a'), _zoneJson('b', lon: 104.5)]});
    rings = [];
  });

  Widget screen({Future<DevicePosition> Function()? location, Stream<DevicePosition> Function()? stream}) => MaterialApp(
        home: GeofenceScreen(
          store: store,
          repository: ForecastRepository(store: store, apiClient: ApiClient(client: server.client, baseUrl: 'http://test'), clock: () => _now),
          clock: () => _now,
          notificationPermission: () async {},
          alarm: ({required title, required body}) async => rings.add(body),
          locationProvider: location ?? () async => (latitude: 22.0, longitude: 104.1),
          positionStream: stream,
        ),
      );

  final sync = find.widgetWithText(OutlinedButton, 'Đồng bộ (cần mạng)');

  test('formatLocal pads day, month, hour and minute and converts UTC to local time', () {
    final utc = DateTime.utc(2026, 3, 5, 7, 4);
    final l = utc.toLocal();
    String two(int n) => n.toString().padLeft(2, '0');
    expect(formatLocal(utc), '${two(l.day)}/${two(l.month)} ${two(l.hour)}:${two(l.minute)}');
    expect(formatLocal(DateTime(2026, 3, 5, 7, 4)), '05/03 07:04');
  });

  group('initial state', () {
    testWidgets('empty device: placeholder status, 0 zones, "never synced"', (tester) async {
      await tester.pumpWidget(screen());
      await tester.pumpAndSettle();
      expect(find.text('Chưa kiểm tra vị trí'), findsOneWidget);
      expect(find.text('Vùng dự báo đã lưu trên máy: 0'), findsOneWidget);
      expect(find.text('Chưa đồng bộ lần nào'), findsOneWidget);
      expect(find.textContaining('chỉ được xử lý trên điện thoại'), findsOneWidget);
    });

    testWidgets('shows the stored zone count and last sync time', (tester) async {
      store.zones = [ForecastZone.fromJson(_zoneJson('a'))];
      store.syncedAt = _now.subtract(const Duration(hours: 2));
      await tester.pumpWidget(screen());
      await tester.pumpAndSettle();
      expect(find.text('Vùng dự báo đã lưu trên máy: 1'), findsOneWidget);
      expect(find.text('Đồng bộ lần cuối: ${formatLocal(_now.subtract(const Duration(hours: 2)))}'), findsOneWidget);
      expect(find.text('Chưa đồng bộ lần nào'), findsNothing);
    });
  });

  group('sync', () {
    testWidgets('success stores the zones, refreshes count and sync time, and says how many', (tester) async {
      await tester.pumpWidget(screen());
      await tester.pumpAndSettle();
      await tester.tap(sync);
      await tester.pumpAndSettle();
      expect(server.where('GET', '/api/v1/forecasts/offline-sync').length, 1);
      expect(find.text('Đã đồng bộ 2 vùng dự báo'), findsOneWidget);
      expect(find.text('Vùng dự báo đã lưu trên máy: 2'), findsOneWidget);
      expect(find.text('Đồng bộ lần cuối: ${formatLocal(_now)}'), findsOneWidget);
      expect(store.zones.length, 2);
    });

    testWidgets('offline: connection error shown, old cache and sync time kept, no "synced" text', (tester) async {
      store.zones = [ForecastZone.fromJson(_zoneJson('keep'))];
      store.syncedAt = _now.subtract(const Duration(hours: 5));
      server.online = false;
      await tester.pumpWidget(screen());
      await tester.pumpAndSettle();
      await tester.tap(sync);
      await tester.pumpAndSettle();
      expect(find.textContaining('Không kết nối được máy chủ'), findsOneWidget);
      expect(find.textContaining('Đã đồng bộ'), findsNothing);
      expect(find.text('Vùng dự báo đã lưu trên máy: 1'), findsOneWidget);
      expect(store.syncedAt, _now.subtract(const Duration(hours: 5)));
    });

    testWidgets('malformed server data is rejected with a message and leaves the cache untouched', (tester) async {
      store.zones = [ForecastZone.fromJson(_zoneJson('keep'))];
      server.handler = (_) => jsonResponse(200, {'items': 'oops'});
      await tester.pumpWidget(screen());
      await tester.pumpAndSettle();
      await tester.tap(sync);
      await tester.pumpAndSettle();
      expect(find.text('Dữ liệu dự báo từ máy chủ không hợp lệ'), findsOneWidget);
      expect(store.zones.single.runId, 'keep');
    });

    testWidgets('401 shows the session-expired message', (tester) async {
      server.handler = (_) => jsonResponse(401, {'message': 'x'});
      await tester.pumpWidget(screen());
      await tester.pumpAndSettle();
      await tester.tap(sync);
      await tester.pumpAndSettle();
      expect(find.text('Hết phiên đăng nhập. Vui lòng đăng nhập lại.'), findsOneWidget);
    });

    testWidgets('while syncing the sync button is disabled, the check button shows a spinner, and one request is sent', (tester) async {
      server.gate = Completer<void>();
      await tester.pumpWidget(screen());
      await tester.pumpAndSettle();
      await tester.tap(sync);
      await tester.pump();
      expect(tester.widget<OutlinedButton>(sync).onPressed, isNull);
      expect(find.byType(CircularProgressIndicator), findsOneWidget);
      await tester.tap(sync, warnIfMissed: false);
      await tester.pump();
      expect(server.requests.length, 1);
      server.gate!.complete();
      await tester.pumpAndSettle();
      expect(tester.widget<OutlinedButton>(sync).onPressed, isNotNull);
      expect(find.byType(CircularProgressIndicator), findsNothing);
    });

    testWidgets('a stale message is replaced by the next action\'s message', (tester) async {
      server.online = false;
      await tester.pumpWidget(screen());
      await tester.pumpAndSettle();
      await tester.tap(sync);
      await tester.pumpAndSettle();
      expect(find.textContaining('Không kết nối được máy chủ'), findsOneWidget);
      server.online = true;
      await tester.tap(sync);
      await tester.pumpAndSettle();
      expect(find.textContaining('Không kết nối được máy chủ'), findsNothing);
      expect(find.text('Đã đồng bộ 2 vùng dự báo'), findsOneWidget);
    });
  });

  group('check position status cards', () {
    testWidgets('never synced and no zones: stale card, never "safe"', (tester) async {
      await tester.pumpWidget(screen());
      await tester.pumpAndSettle();
      await tester.tap(find.text('Kiểm tra vị trí'));
      await tester.pumpAndSettle();
      expect(find.text('Dữ liệu dự báo đã cũ'), findsOneWidget);
      expect(find.textContaining('Chưa tải dự báo về máy'), findsOneWidget);
      expect(find.text('Chưa có cảnh báo hiện hành'), findsNothing);
    });

    testWidgets('synced recently, outside every zone: "no current warning" card says it is not a safety confirmation', (tester) async {
      store.zones = [ForecastZone.fromJson(_zoneJson('far', lon: 105.5))];
      store.syncedAt = _now.subtract(const Duration(hours: 1));
      await tester.pumpWidget(screen());
      await tester.pumpAndSettle();
      await tester.tap(find.text('Kiểm tra vị trí'));
      await tester.pumpAndSettle();
      expect(find.text('Chưa có cảnh báo hiện hành'), findsOneWidget);
      expect(find.textContaining('Đây không phải xác nhận an toàn'), findsOneWidget);
      expect(rings, isEmpty);
    });

    testWidgets('sync older than 24 h and outside zones: stale card with the sync time', (tester) async {
      store.zones = [ForecastZone.fromJson(_zoneJson('far', lon: 105.5))];
      store.syncedAt = _now.subtract(const Duration(hours: 30));
      await tester.pumpWidget(screen());
      await tester.pumpAndSettle();
      await tester.tap(find.text('Kiểm tra vị trí'));
      await tester.pumpAndSettle();
      expect(find.text('Dữ liệu dự báo đã cũ'), findsOneWidget);
      expect(find.textContaining('đã quá 24 giờ'), findsOneWidget);
      expect(find.textContaining(formatLocal(_now.subtract(const Duration(hours: 30)))), findsWidgets);
    });

    testWidgets('inside a zone: warning card shows hazard label and expiry; a second check does not ring again', (tester) async {
      store.zones = [ForecastZone.fromJson(_zoneJson('a', hazard: 'extreme'))];
      store.syncedAt = _now;
      await tester.pumpWidget(screen());
      await tester.pumpAndSettle();
      await tester.tap(find.text('Kiểm tra vị trí'));
      await tester.pumpAndSettle();
      expect(find.text('Bạn đang trong vùng cảnh báo'), findsOneWidget);
      expect(find.textContaining('Mức nguy cơ: Rất cao'), findsOneWidget);
      expect(find.textContaining('Hiệu lực đến ${formatLocal(_now.add(const Duration(hours: 23)))}'), findsOneWidget);
      await tester.tap(find.text('Kiểm tra vị trí'));
      await tester.pumpAndSettle();
      expect(rings.length, 1);
    });

    testWidgets('an unexpected (non-API) error becomes the generic local-data message', (tester) async {
      await tester.pumpWidget(screen(location: () async => throw StateError('boom')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Kiểm tra vị trí'));
      await tester.pumpAndSettle();
      expect(find.text('Không đọc được dữ liệu dự báo trên máy'), findsOneWidget);
      expect(find.text('Chưa kiểm tra vị trí'), findsOneWidget);
    });
  });

  group('live watch switch', () {
    testWidgets('on: each position from the stream updates the card and rings once; off: the stream is cancelled', (tester) async {
      store.zones = [ForecastZone.fromJson(_zoneJson('a'))];
      store.syncedAt = _now;
      final controller = StreamController<DevicePosition>();
      addTearDown(controller.close);
      await tester.pumpWidget(screen(stream: () => controller.stream));
      await tester.pumpAndSettle();
      await tester.tap(find.byType(Switch));
      await tester.pumpAndSettle();
      expect(controller.hasListener, isTrue);
      expect(tester.widget<Switch>(find.byType(Switch)).value, isTrue);

      controller.add((latitude: 23.0, longitude: 104.1)); // outside
      await tester.pumpAndSettle();
      expect(find.text('Bạn đang trong vùng cảnh báo'), findsNothing);
      controller.add((latitude: 22.0, longitude: 104.1)); // inside
      await tester.pumpAndSettle();
      expect(find.text('Bạn đang trong vùng cảnh báo'), findsOneWidget);
      controller.add((latitude: 22.0, longitude: 104.1)); // same zone again
      await tester.pumpAndSettle();
      expect(rings.length, 1);

      await tester.tap(find.byType(Switch));
      await tester.pumpAndSettle();
      expect(controller.hasListener, isFalse);
      expect(tester.widget<Switch>(find.byType(Switch)).value, isFalse);
    });

    testWidgets('a stream error (GPS off) switches watching off and shows the ApiException message', (tester) async {
      final controller = StreamController<DevicePosition>();
      addTearDown(controller.close);
      await tester.pumpWidget(screen(stream: () => controller.stream));
      await tester.pumpAndSettle();
      await tester.tap(find.byType(Switch));
      await tester.pumpAndSettle();
      controller.addError(const ApiException(message: 'Cần bật GPS'));
      await tester.pumpAndSettle();
      expect(tester.widget<Switch>(find.byType(Switch)).value, isFalse);
      expect(find.text('Cần bật GPS'), findsOneWidget);
      expect(controller.hasListener, isFalse);
    });

    testWidgets('any other stream error shows the generic GPS/permission hint', (tester) async {
      final controller = StreamController<DevicePosition>();
      addTearDown(controller.close);
      await tester.pumpWidget(screen(stream: () => controller.stream));
      await tester.pumpAndSettle();
      await tester.tap(find.byType(Switch));
      await tester.pumpAndSettle();
      controller.addError(StateError('x'));
      await tester.pumpAndSettle();
      expect(find.textContaining('Không theo dõi được vị trí'), findsOneWidget);
    });

    testWidgets('leaving the screen cancels the position stream', (tester) async {
      final controller = StreamController<DevicePosition>();
      addTearDown(controller.close);
      await tester.pumpWidget(screen(stream: () => controller.stream));
      await tester.pumpAndSettle();
      await tester.tap(find.byType(Switch));
      await tester.pumpAndSettle();
      expect(controller.hasListener, isTrue);
      await tester.pumpWidget(const MaterialApp(home: SizedBox()));
      expect(controller.hasListener, isFalse);
    });
  });
}
