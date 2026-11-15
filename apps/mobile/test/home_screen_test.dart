import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:geosentry_mobile/core/storage/local_storage.dart';
import 'package:geosentry_mobile/features/alerts/data/alert_models.dart';
import 'package:geosentry_mobile/features/alerts/presentation/emergency_alert_screen.dart';
import 'package:geosentry_mobile/features/geofence/presentation/geofence_screen.dart';
import 'package:geosentry_mobile/features/home/presentation/home_screen.dart';
import 'package:geosentry_mobile/services/notification_service.dart';

import 'support/harness.dart';

// home_map_shell_test.dart already covers HomeScreen's labels, stored zone count, the five navigation
// targets and "stops listening after dispose". This file covers what it does not.

Future<void> _insertZone(String run) async => (await LocalStorage.database).insert('forecast_zones', {
      'run_id': run, 'unit_id': 'u', 'unit_version': 'v', 'hazard_level': 'high', 'probability': 0.5,
      'issued_at': 1, 'valid_from': 1, 'valid_until': 2, 'model_version': 'm', 'polygon': '[]',
      'min_lat': 0.0, 'max_lat': 1.0, 'min_lon': 0.0, 'max_lon': 1.0,
    });

AlertModel _alert(String id, String title) => AlertModel(
      broadcastId: id, title: title, message: 'Rời khỏi sườn đồi', severity: 'extreme', areaName: 'Sa Pa', receivedAt: '2026-10-30T10:00:00Z');

void main() {
  useIsolatedSqlite();
  late FakeBackend server;

  setUp(() async {
    server = FakeBackend()..handler = (_) => jsonResponse(404, {'message': 'nope'});
    await signIn();
  });

  Future<void> settleNav(WidgetTester tester) async {
    await settleReal(tester);
    await tester.pump(const Duration(seconds: 1));
  }

  Future<void> clean(WidgetTester tester) => tester.runAsync(() async {
        final db = await LocalStorage.database;
        await db.delete('forecast_zones');
        await db.delete('alert_history');
      });

  testScreen('the zone count is read again after coming back from the geofence screen', () => server, (tester) async {
    await clean(tester);
    await tester.pumpWidget(const MaterialApp(home: HomeScreen()));
    await settleReal(tester);
    expect(find.textContaining('Chưa có vùng dự báo trên máy'), findsOneWidget);

    await tester.tap(find.text('Cảnh báo vị trí ngoại tuyến'));
    await settleNav(tester);
    expect(find.byType(GeofenceScreen), findsOneWidget);
    await tester.runAsync(() => _insertZone('r1')); // e.g. a sync done on that screen
    await tester.pageBack();
    await settleNav(tester);
    expect(find.textContaining('Đã lưu 1 vùng dự báo trên máy'), findsOneWidget);
    expect(find.textContaining('Chưa có vùng dự báo'), findsNothing);
    await clean(tester);
  });

  testScreen('two emergency alerts in a row each open their own red screen', () => server, (tester) async {
    await clean(tester);
    await tester.pumpWidget(const MaterialApp(home: HomeScreen()));
    await settleReal(tester);

    await tester.runAsync(() => NotificationService.openAlert(_alert('b1', 'Cảnh báo thứ nhất')));
    await settleNav(tester);
    expect(find.text('Cảnh báo thứ nhất'), findsOneWidget);
    await tester.tap(find.text('Tôi Đã Nắm Rõ & Tắt Báo Động'));
    await settleNav(tester);
    expect(find.byType(EmergencyAlertScreen), findsNothing);

    await tester.runAsync(() => NotificationService.openAlert(_alert('b2', 'Cảnh báo thứ hai')));
    await settleNav(tester);
    expect(find.text('Cảnh báo thứ hai'), findsOneWidget);
    expect(find.text('Cảnh báo thứ nhất'), findsNothing);
    await clean(tester);
  });
}
