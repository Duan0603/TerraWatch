import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:geosentry_mobile/core/storage/local_storage.dart';
import 'package:geosentry_mobile/features/alerts/data/alerts_repository.dart';
import 'package:geosentry_mobile/features/alerts/presentation/alerts_screen.dart';
import 'package:geosentry_mobile/features/alerts/presentation/emergency_alert_screen.dart';

import 'support/harness.dart';

// alerts_screen_gaps_test.dart / push_alerts_test.dart cover states, list, clear and navigation to settings.
// This file covers what they skip: "enable notifications", the test-alert button, and the area returned by
// the subscription screen.

const _geolocator = MethodChannel('flutter.baseflow.com/geolocator');

class _OfflineRepo extends AlertsRepository {
  @override
  Future<int> resync() async => throw StateError('offline');
}

http.Response _route(http.Request r) {
  if (r.url.path == '/api/v1/monitoring-areas') {
    return jsonResponse(200, [{'area_id': 7, 'name': 'Mù Cang Chải', 'province': 'Yên Bái'}]);
  }
  if (r.url.path == '/api/v1/alerts/subscriptions' && r.method == 'POST') return http.Response('', 201);
  return jsonResponse(404, {'message': 'nope'});
}

void main() {
  useIsolatedSqlite();
  late FakeBackend server;

  setUp(() async {
    server = FakeBackend()..handler = _route;
    await signIn();
  });

  tearDown(() => TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger.setMockMethodCallHandler(_geolocator, null));

  Future<void> pump(WidgetTester tester, {required Future<bool?> Function() enabled}) async {
    await tester.pumpWidget(MaterialApp(
      home: AlertsScreen(repository: _OfflineRepo(), notificationsEnabled: enabled),
    ));
    await settleReal(tester, rounds: 3);
  }

  group('enable notifications', () {
    testWidgets('still blocked after the prompt: opens the system settings (only place left to enable them)', (tester) async {
      final calls = <String>[];
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger.setMockMethodCallHandler(_geolocator, (c) async {
        calls.add(c.method);
        return true;
      });
      await pump(tester, enabled: () async => false);
      await tester.tap(find.text('Bật thông báo'));
      await settleReal(tester);
      expect(calls, ['openAppSettings']);
      expect(find.text('Thông báo của TerraWatch đang bị tắt'), findsOneWidget);
    });

    testWidgets('allowed from the prompt: warning card disappears and settings are not opened', (tester) async {
      final calls = <String>[];
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger.setMockMethodCallHandler(_geolocator, (c) async {
        calls.add(c.method);
        return true;
      });
      var enabled = false;
      await pump(tester, enabled: () async => enabled);
      expect(find.text('Thông báo của TerraWatch đang bị tắt'), findsOneWidget);
      enabled = true;
      await tester.tap(find.text('Bật thông báo'));
      await settleReal(tester);
      expect(find.text('Thông báo của TerraWatch đang bị tắt'), findsNothing);
      expect(calls, isEmpty);
    });
  });

  group('subscription area', () {
    testWidgets('after saving a subscription the banner shows the new area and a confirmation', (tester) async {
      await withFakeHttp(server, () async {
        await pump(tester, enabled: () async => true);
        await tester.tap(find.byTooltip('Cài đặt vùng nhận tin'));
        await tester.pumpAndSettle();
        await tester.enterText(find.byType(TextFormField), '0912345678');
        await tester.ensureVisible(find.text('Lưu Đăng Ký Cảnh Báo'));
        await tester.tap(find.text('Lưu Đăng Ký Cảnh Báo'));
        await tester.pumpAndSettle();
        // the subscription screen's own success snackbar is queued first (same ScaffoldMessenger); wait it out
        await tester.pump(const Duration(seconds: 5));
        await tester.pump(const Duration(seconds: 1));
        expect(find.text('Đang theo dõi: Mù Cang Chải'), findsOneWidget);
        expect(find.text('Đã cập nhật vùng nhận cảnh báo: Mù Cang Chải'), findsOneWidget);
        await tester.pump(const Duration(seconds: 6));
      });
    });

    testWidgets('leaving the subscription screen without saving keeps the banner and shows no confirmation', (tester) async {
      await withFakeHttp(server, () async {
        await pump(tester, enabled: () async => true);
        final before = tester.widget<Text>(find.textContaining('Đang theo dõi:')).data;
        await tester.tap(find.byTooltip('Cài đặt vùng nhận tin'));
        await tester.pumpAndSettle();
        await tester.pageBack();
        await tester.pumpAndSettle();
        expect(tester.widget<Text>(find.textContaining('Đang theo dõi:')).data, before);
        expect(find.textContaining('Đã cập nhật vùng nhận cảnh báo'), findsNothing);
      });
    });
  });

  group('test alert button', () {
    testWidgets('opens the red alert, saves it to history, and the list reloads when it is dismissed', (tester) async {
      tester.view.physicalSize = const Size(800, 1400); // the red screen is a non-scrolling column
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);
      await tester.runAsync(LocalStorage.clearAlertHistory);
      await pump(tester, enabled: () async => true);
      expect(find.text('Chưa có cảnh báo nào'), findsOneWidget);

      final button = find.textContaining('Mô Phỏng Cảnh Báo Đỏ Khẩn Cấp');
      await tester.ensureVisible(button);
      await tester.tap(button);
      await settleReal(tester, rounds: 4);
      await tester.pump(const Duration(seconds: 1));
      expect(find.byType(EmergencyAlertScreen), findsOneWidget);
      expect(find.textContaining('LỆNH SƠ TÁN KHẨN CẤP'), findsOneWidget);
      expect(find.textContaining('Khu vực:'), findsOneWidget);

      await tester.tap(find.text('Tôi Đã Nắm Rõ & Tắt Báo Động'));
      await settleReal(tester, rounds: 4);
      await tester.pump(const Duration(seconds: 1));
      expect(find.byType(EmergencyAlertScreen), findsNothing);
      expect(find.text('1 bản tin'), findsOneWidget);
      expect(find.textContaining('LỆNH SƠ TÁN KHẨN CẤP'), findsOneWidget);
      expect((await tester.runAsync(LocalStorage.getAlertHistory))!.length, 1);
      await tester.runAsync(LocalStorage.clearAlertHistory);
    });
  });
}
