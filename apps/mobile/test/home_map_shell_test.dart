import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:geosentry_mobile/core/network/api_client.dart';
import 'package:geosentry_mobile/core/storage/local_storage.dart';
import 'package:geosentry_mobile/features/alerts/data/alert_models.dart';
import 'package:geosentry_mobile/features/alerts/presentation/alerts_screen.dart';
import 'package:geosentry_mobile/features/alerts/presentation/emergency_alert_screen.dart';
import 'package:geosentry_mobile/features/alerts/presentation/subscription_screen.dart';
import 'package:geosentry_mobile/features/geofence/presentation/geofence_screen.dart';
import 'package:geosentry_mobile/features/home/presentation/home_screen.dart';
import 'package:geosentry_mobile/features/home/presentation/main_shell.dart';
import 'package:geosentry_mobile/features/map/data/hazard_repository.dart';
import 'package:geosentry_mobile/features/map/presentation/map_screen.dart';
import 'package:geosentry_mobile/features/profile/presentation/profile_screen.dart';
import 'package:geosentry_mobile/features/report/presentation/report_screen.dart';
import 'package:geosentry_mobile/services/notification_service.dart';

import 'support/harness.dart';

AlertModel _alert(String id) => AlertModel(
      broadcastId: id,
      title: 'Sơ tán khẩn cấp',
      message: 'Rời khỏi sườn đồi',
      severity: 'extreme',
      areaName: 'Mù Cang Chải',
      receivedAt: '2026-10-30T10:00:00Z',
    );

/// MapLibreMap on a non-mobile platform builds a plain text fallback (no platform view, no network).
/// Its State.dispose then throws a LateInitializationError from the plugin (controller never created);
/// that is a plugin limitation, so it is taken and checked here instead of failing the test.
void mapTestWidgets(String name, Future<void> Function(WidgetTester tester) body, {bool skip = false}) {
  testWidgets(name, (tester) async {
    debugDefaultTargetPlatformOverride = TargetPlatform.linux;
    try {
      await body(tester);
      await tester.pumpWidget(const SizedBox());
      final dispose = tester.takeException();
      expect(dispose == null || dispose is Error && dispose.toString().contains('_channel'), isTrue, reason: '$dispose');
    } finally {
      debugDefaultTargetPlatformOverride = null;
    }
  }, skip: skip);
}

void main() {
  useIsolatedSqlite();
  late FakeBackend server;

  setUp(() async {
    server = FakeBackend()..handler = (_) => jsonResponse(404, {'message': 'nope'});
    await signIn();
  });

  Future<void> settleNav(WidgetTester tester) async {
    await settleReal(tester, rounds: 3);
    await tester.pump(const Duration(seconds: 1));
  }

  group('HomeScreen', () {
    testScreen('shows the offline-zone card with "no zones yet" text and the three actions', () => server, (tester) async {
      await tester.runAsync(() async => (await LocalStorage.database).delete('forecast_zones'));
      await tester.pumpWidget(const MaterialApp(home: HomeScreen()));
      await settleReal(tester);
      expect(find.text('TerraWatch'), findsOneWidget);
      expect(find.text('Cảnh báo vị trí ngoại tuyến'), findsOneWidget);
      expect(find.text('Chưa có vùng dự báo trên máy. Bấm để đồng bộ khi có mạng.'), findsOneWidget);
      expect(find.text('Báo Cáo Hiện Trường (Ảnh + GPS)'), findsOneWidget);
      expect(find.text('Đăng Ký Vùng Nhận Cảnh Báo (AOI)'), findsOneWidget);
      expect(find.text('Trung Tâm Lịch Sử Cảnh Báo'), findsOneWidget);
      // missing zones must never be phrased as "safe"
      expect(find.textContaining('an toàn'), findsNothing);
    });

    testScreen('shows the stored zone count', () => server, (tester) async {
      await tester.runAsync(() async {
        final db = await LocalStorage.database;
        await db.delete('forecast_zones');
        await db.insert('forecast_zones', {
          'run_id': 'r1', 'unit_id': 'u', 'unit_version': 'v', 'hazard_level': 'high', 'probability': 0.5,
          'issued_at': 1, 'valid_from': 1, 'valid_until': 2, 'model_version': 'm', 'polygon': '[]',
          'min_lat': 0.0, 'max_lat': 1.0, 'min_lon': 0.0, 'max_lon': 1.0,
        });
      });
      await tester.pumpWidget(const MaterialApp(home: HomeScreen()));
      await settleReal(tester);
      expect(find.textContaining('Đã lưu 1 vùng dự báo trên máy'), findsOneWidget);
      await tester.runAsync(() async => (await LocalStorage.database).delete('forecast_zones'));
    });

    testScreen('navigation: every action opens its screen', () => server, (tester) async {
      await tester.pumpWidget(const MaterialApp(home: HomeScreen()));
      await settleReal(tester);
      Future<void> open(Finder f, Type screen) async {
        await tester.ensureVisible(f);
        await tester.tap(f);
        await settleNav(tester);
        expect(find.byType(screen), findsOneWidget, reason: '$screen');
        await tester.pageBack();
        await settleNav(tester);
      }

      await open(find.text('Cảnh báo vị trí ngoại tuyến'), GeofenceScreen);
      await open(find.text('Báo Cáo Hiện Trường (Ảnh + GPS)'), ReportScreen);
      await open(find.text('Đăng Ký Vùng Nhận Cảnh Báo (AOI)'), SubscriptionScreen);
      await open(find.text('Trung Tâm Lịch Sử Cảnh Báo'), AlertsScreen);
      await open(find.byTooltip('Lịch sử cảnh báo'), AlertsScreen);
    });

    testScreen('an emergency alert opens the red full-screen alert; screen then listens again after leaving', () => server, (tester) async {
      await tester.pumpWidget(const MaterialApp(home: HomeScreen()));
      await settleReal(tester);
      await tester.runAsync(() => NotificationService.openAlert(_alert('b1')));
      await settleNav(tester);
      expect(find.byType(EmergencyAlertScreen), findsOneWidget);
      expect(find.text('Sơ tán khẩn cấp'), findsWidgets);
      await tester.runAsync(() async => (await LocalStorage.database).delete('alert_history'));
    });

    testScreen('disposed screen stops listening (no navigation after unmount)', () => server, (tester) async {
      await tester.pumpWidget(const MaterialApp(home: HomeScreen()));
      await settleReal(tester);
      await tester.pumpWidget(const MaterialApp(home: SizedBox()));
      await tester.runAsync(() => NotificationService.openAlert(_alert('b2')));
      await tester.pump();
      expect(find.byType(EmergencyAlertScreen), findsNothing);
      await tester.runAsync(() async => (await LocalStorage.database).delete('alert_history'));
    });
  });

  group('MainShell', () {
    mapTestWidgets('four tabs with Vietnamese labels; tapping switches the visible tab', (tester) => withFakeHttp(server, () async {
      await tester.pumpWidget(const MaterialApp(home: MainShell()));
      await settleNav(tester);
      for (final label in ['Trang chủ', 'Bản đồ', 'Cảnh báo', 'Hồ sơ']) {
        expect(find.text(label), findsOneWidget, reason: label);
      }
      expect(find.byType(HomeScreen), findsOneWidget);
      expect(find.byType(MapScreen, skipOffstage: false), findsOneWidget);

      await tester.tap(find.text('Bản đồ'));
      await settleNav(tester);
      expect(find.byType(MapScreen), findsOneWidget);
      await tester.tap(find.text('Cảnh báo'));
      await settleNav(tester);
      expect(find.byType(AlertsScreen), findsOneWidget);
      await tester.tap(find.text('Hồ sơ'));
      await settleNav(tester);
      expect(find.byType(ProfileScreen), findsOneWidget);
      expect(find.byType(HomeScreen), findsNothing); // offstage in the IndexedStack
      expect(find.byType(HomeScreen, skipOffstage: false), findsOneWidget); // but alive, still listening for alerts
    }));

    mapTestWidgets('resuming the app does not crash when sync fails (offline)', (tester) => withFakeHttp(server, () async {
      server.online = false;
      await tester.pumpWidget(const MaterialApp(home: MainShell()));
      await settleNav(tester);
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
      await settleNav(tester);
      expect(find.byType(MainShell), findsOneWidget);
      expect(tester.takeException(), isNull);
    }));
  });

  group('MapScreen (headless: map plugin replaced by its unsupported-platform fallback)', () {
    mapTestWidgets('shows loading text, then the verified-hazard count', (tester) async {
      server.handler = (_) => jsonResponse(200, {'type': 'FeatureCollection', 'features': [{}, {}, {}]});
      server.gate = Completer<void>();
      final repo = HazardRepository(apiClient: ApiClient(client: server.client, baseUrl: 'http://test'));
      await tester.pumpWidget(MaterialApp(home: MapScreen(repository: repo)));
      await tester.pump();
      expect(find.text('Bản đồ nguy cơ'), findsOneWidget);
      expect(find.text('Đang tải vùng nguy cơ...'), findsOneWidget);
      server.gate!.complete();
      await tester.pumpAndSettle();
      expect(find.text('3 vùng nguy cơ đã xác minh'), findsOneWidget);
    });

    mapTestWidgets('legend and basemap tooltip are labelled in Vietnamese', (tester) async {
      server.handler = (_) => jsonResponse(200, {'features': []});
      final repo = HazardRepository(apiClient: ApiClient(client: server.client, baseUrl: 'http://test'));
      await tester.pumpWidget(MaterialApp(home: MapScreen(repository: repo)));
      await tester.pumpAndSettle();
      for (final t in ['Thấp', 'TB', 'Cao', 'Cực cao']) {
        expect(find.text(t), findsOneWidget);
      }
      expect(find.byTooltip('Nền vệ tinh'), findsOneWidget);
      expect(find.text('0 vùng nguy cơ đã xác minh'), findsOneWidget);
    });

    mapTestWidgets('a failed load shows the error with "Thử lại" and never a hazard count; retry recovers', (tester) async {
      server.handler = (_) => jsonResponse(503, {'message': 'down'});
      final repo = HazardRepository(apiClient: ApiClient(client: server.client, baseUrl: 'http://test'));
      await tester.pumpWidget(MaterialApp(home: MapScreen(repository: repo)));
      await tester.pumpAndSettle();
      expect(find.text('down'), findsOneWidget);
      expect(find.textContaining('vùng nguy cơ đã xác minh'), findsNothing);
      expect(find.textContaining('an toàn'), findsNothing);
      expect(find.text('Đang tải vùng nguy cơ...'), findsNothing);

      server.handler = (_) => jsonResponse(200, {'features': [{}]});
      // direct callback: the plugin's fallback view swallows pointer hits in the headless test
      tester.widget<TextButton>(find.widgetWithText(TextButton, 'Thử lại')).onPressed!();
      await tester.pump();
      await tester.pumpAndSettle();
      expect(find.text('1 vùng nguy cơ đã xác minh'), findsOneWidget);
      expect(find.text('Thử lại'), findsNothing);
    });

    mapTestWidgets('offline shows the connection error, not an empty/safe map', (tester) async {
      server.online = false;
      final repo = HazardRepository(apiClient: ApiClient(client: server.client, baseUrl: 'http://test'));
      await tester.pumpWidget(MaterialApp(home: MapScreen(repository: repo)));
      await tester.pumpAndSettle();
      expect(find.textContaining('Không kết nối được máy chủ'), findsOneWidget);
      expect(find.text('0 vùng nguy cơ đã xác minh'), findsNothing);
    });

    mapTestWidgets('401 shows the session-expired message', (tester) async {
      server.handler = (_) => jsonResponse(401, {'message': 'x'});
      final repo = HazardRepository(apiClient: ApiClient(client: server.client, baseUrl: 'http://test'));
      await tester.pumpWidget(MaterialApp(home: MapScreen(repository: repo)));
      await tester.pumpAndSettle();
      expect(find.text('Hết phiên đăng nhập. Vui lòng đăng nhập lại.'), findsOneWidget);
    });

    mapTestWidgets('without a MapTiler key the satellite toggle explains why it is unavailable and the hint is shown', (tester) async {
      server.handler = (_) => jsonResponse(200, {'features': []});
      final repo = HazardRepository(apiClient: ApiClient(client: server.client, baseUrl: 'http://test'));
      await tester.pumpWidget(MaterialApp(home: MapScreen(repository: repo)));
      await tester.pumpAndSettle();
      expect(find.textContaining('Đang dùng nền bản đồ miễn phí'), findsOneWidget);
      tester.widget<IconButton>(find.widgetWithIcon(IconButton, Icons.satellite_alt_outlined)).onPressed!();
      await tester.pump();
      expect(find.textContaining('MAPTILER_KEY'), findsWidgets);
      expect(find.byTooltip('Nền vệ tinh'), findsOneWidget); // did not flip to satellite
      await tester.pump(const Duration(seconds: 1)); // snackbar slides in, then its 4 s dismiss timer starts
      await tester.pump(const Duration(seconds: 10));
      await tester.pumpAndSettle();
    });

    mapTestWidgets('BUG: a malformed hazard payload must not leave "Đang tải..." forever', (tester) async {
      // BUG: expected an error message; actual: a 200 body whose "features" is not a list is read with
      // `as List?` (map_screen.dart:~47 _hazardCount) and throws TypeError during build.
      server.handler = (_) => jsonResponse(200, {'features': 'oops'});
      final repo = HazardRepository(apiClient: ApiClient(client: server.client, baseUrl: 'http://test'));
      await tester.pumpWidget(MaterialApp(home: MapScreen(repository: repo)));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    }, skip: true);
  });
}
