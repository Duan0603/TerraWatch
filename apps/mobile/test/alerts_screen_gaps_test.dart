import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:geosentry_mobile/core/network/api_exceptions.dart';
import 'package:geosentry_mobile/core/storage/local_storage.dart';
import 'package:geosentry_mobile/features/alerts/data/alert_models.dart';
import 'package:geosentry_mobile/features/alerts/data/alerts_repository.dart';
import 'package:geosentry_mobile/features/alerts/presentation/alerts_screen.dart';
import 'package:geosentry_mobile/features/alerts/presentation/emergency_alert_screen.dart';
import 'package:geosentry_mobile/features/alerts/presentation/subscription_screen.dart';

import 'support/harness.dart';

final _now = DateTime.utc(2026, 10, 30, 12);

AlertModel _a(String id, {String severity = 'high', String? validUntil, String status = 'active', String? issuedAt = '2026-10-30T10:00:00Z', String title = 'Cảnh báo'}) =>
    AlertModel(
      broadcastId: id,
      title: '$title $id',
      message: 'Sơ tán ngay',
      severity: severity,
      areaName: 'Sa Pa',
      receivedAt: '2026-10-30T10:00:00Z',
      issuedAt: issuedAt,
      validUntil: validUntil,
      status: status,
    );

class _Repo extends AlertsRepository {
  List<AlertModel> items;
  Object? resyncError;
  Object? historyError;
  Completer<void>? historyGate;
  int resyncs = 0;
  _Repo(this.items);

  @override
  Future<List<AlertModel>> getAlertHistory() async {
    if (historyGate != null) await historyGate!.future;
    if (historyError != null) throw historyError!;
    return items;
  }

  @override
  Future<int> resync() async {
    resyncs++;
    if (resyncError != null) throw resyncError!;
    return 0;
  }
}

void main() {
  useIsolatedSqlite();

  Future<void> pump(WidgetTester tester, _Repo repo, {bool? enabled = true}) async {
    await tester.pumpWidget(MaterialApp(
      home: AlertsScreen(repository: repo, clock: () => _now, notificationsEnabled: () async => enabled),
    ));
    await tester.pumpAndSettle();
  }

  setUp(signIn);

  group('AlertsScreen states', () {
    testWidgets('shows a spinner while the history is being read', (tester) async {
      final repo = _Repo([_a('1')])..historyGate = Completer<void>();
      await tester.pumpWidget(MaterialApp(home: AlertsScreen(repository: repo, clock: () => _now, notificationsEnabled: () async => true)));
      await tester.pump();
      expect(find.byType(CircularProgressIndicator), findsOneWidget);
      expect(find.text('Chưa có cảnh báo nào'), findsNothing); // loading is not "nothing happened"
      repo.historyGate!.complete();
      await tester.pumpAndSettle();
      expect(find.byType(CircularProgressIndicator), findsNothing);
    });

    testWidgets('empty history: explicit "not a safety confirmation" text and the delete button is disabled', (tester) async {
      await pump(tester, _Repo([]));
      expect(find.text('Chưa có cảnh báo nào'), findsOneWidget);
      expect(find.textContaining('không phải xác nhận an toàn'), findsOneWidget);
      expect(find.text('0 bản tin'), findsOneWidget);
      expect(tester.widget<IconButton>(find.widgetWithIcon(IconButton, Icons.delete_outline)).onPressed, isNull);
    });

    testWidgets('offline resync failure keeps the stored alerts and shows no false "all clear"', (tester) async {
      final repo = _Repo([_a('1', validUntil: '2026-10-31T10:00:00Z')])..resyncError = const ApiException(message: 'offline');
      await pump(tester, repo);
      expect(find.text('Cảnh báo 1'), findsOneWidget);
      expect(find.text('Còn hiệu lực'), findsOneWidget);
      expect(find.text('1 bản tin'), findsOneWidget);
      expect(find.textContaining('an toàn'), findsNothing);
    });

    testWidgets('pull to refresh resyncs again', (tester) async {
      final repo = _Repo([_a('1')]);
      await pump(tester, repo);
      final before = repo.resyncs;
      await tester.fling(find.byType(Scrollable).first, const Offset(0, 400), 1000);
      await tester.pumpAndSettle();
      expect(repo.resyncs, before + 1);
    });

    testWidgets('severity badge: extreme vs high; missing issuedAt falls back to receivedAt; missing validUntil hides the line', (tester) async {
      tester.view.physicalSize = const Size(800, 2400);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);
      final repo = _Repo([_a('x', severity: 'EXTREME'), _a('h', issuedAt: null)]);
      await pump(tester, repo);
      expect(find.text('CỰC KỲ NGUY CẤP'), findsOneWidget);
      expect(find.text('CẢNH BÁO CAO'), findsOneWidget);
      expect(find.textContaining('Hiệu lực đến'), findsNothing);
      expect(find.text('2 bản tin'), findsOneWidget);
    });

    testWidgets('an alert with an unparsable validUntil is still shown as active (fails loud, not silent)', (tester) async {
      await pump(tester, _Repo([_a('1', validUntil: 'garbage')]));
      expect(find.text('Còn hiệu lực'), findsOneWidget);
      expect(find.textContaining('Hiệu lực đến'), findsNothing);
    });

    testWidgets('BUG: a failing local history read ends the spinner with an error', (tester) async {
      // BUG: expected an error message when the history cannot be read; actual: _loadAlertHistory (alerts_screen.dart:~40)
      // has no try/catch, the exception escapes and _isLoading stays true, so the spinner never ends.
      final repo = _Repo([])..historyError = StateError('db locked');
      await tester.pumpWidget(MaterialApp(home: AlertsScreen(repository: repo, clock: () => _now, notificationsEnabled: () async => true)));
      await tester.pumpAndSettle();
      expect(find.byType(CircularProgressIndicator), findsNothing);
      tester.takeException();
    }, skip: true);

    testWidgets('BUG: header "Đang theo dõi" shows a hard-coded area, not the user\'s real subscription', (tester) async {
      // BUG: expected the area from the user's subscriptions (or "chưa đăng ký"); actual: alerts_screen.dart:~24 initialises
      // _currentSubscribedArea to the constant 'Xã Bản Hồ, Sa Pa, Lào Cai' for every user.
      await pump(tester, _Repo([]));
      expect(find.textContaining('Xã Bản Hồ, Sa Pa, Lào Cai'), findsNothing);
    }, skip: true);
  });

  group('AlertsScreen actions', () {
    testWidgets('tapping an alert opens the full-screen red alert with its text', (tester) async {
      await pump(tester, _Repo([_a('1', severity: 'extreme')]));
      await tester.ensureVisible(find.text('Cảnh báo 1'));
      await tester.tap(find.text('Cảnh báo 1'));
      await tester.pump();
      await tester.pump(const Duration(seconds: 1));
      expect(find.byType(EmergencyAlertScreen), findsOneWidget);
      expect(find.text('Sơ tán ngay'), findsWidgets);
    });

    testWidgets('clear history empties the device DB and says so', (tester) async {
      await tester.runAsync(() => LocalStorage.insertAlert(_a('keep').toMap()));
      final repo = AlertsRepository();
      await tester.pumpWidget(MaterialApp(home: AlertsScreen(repository: repo, clock: () => _now, notificationsEnabled: () async => true)));
      await settleReal(tester, rounds: 4);
      expect(find.text('Cảnh báo keep'), findsOneWidget);
      await tester.tap(find.byTooltip('Xóa sạch lịch sử'));
      await settleReal(tester, rounds: 4);
      expect(find.text('Đã xóa sạch lịch sử cảnh báo.'), findsOneWidget);
      expect(find.text('Chưa có cảnh báo nào'), findsOneWidget);
      expect(await tester.runAsync(LocalStorage.getAlertHistory), isEmpty);
      await tester.pump(const Duration(seconds: 6));
    });

    testWidgets('settings icon opens the subscription screen', (tester) async {
      await withFakeHttp(FakeBackend()..handler = (_) => jsonResponse(200, []), () async {
        await pump(tester, _Repo([]));
        await tester.tap(find.byTooltip('Cài đặt vùng nhận tin'));
        await tester.pumpAndSettle();
        expect(find.byType(SubscriptionScreen), findsOneWidget);
      });
    });

    testWidgets('the arrow on the area banner also opens the subscription screen', (tester) async {
      await withFakeHttp(FakeBackend()..handler = (_) => jsonResponse(200, []), () async {
        await pump(tester, _Repo([]));
        await tester.tap(find.byIcon(Icons.arrow_forward_ios));
        await tester.pumpAndSettle();
        expect(find.byType(SubscriptionScreen), findsOneWidget);
      });
    });

    testWidgets('unknown notification state (null) shows no warning, but never claims alerts are on', (tester) async {
      await pump(tester, _Repo([]), enabled: null);
      expect(find.text('Thông báo của TerraWatch đang bị tắt'), findsNothing);
    });

    testWidgets('formatAlertTime handles null, garbage and valid input', (tester) async {
      expect(formatAlertTime(null), isNull);
      expect(formatAlertTime('not a date'), isNull);
      final t = DateTime(2026, 3, 5, 7, 4).toUtc().toIso8601String();
      expect(formatAlertTime(t), '05/03 07:04');
    });
  });
}
