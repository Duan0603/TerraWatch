import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';
import 'package:geosentry_mobile/core/network/api_client.dart';
import 'package:geosentry_mobile/core/network/api_exceptions.dart';
import 'package:geosentry_mobile/core/storage/local_storage.dart';
import 'package:geosentry_mobile/core/storage/session.dart';
import 'package:geosentry_mobile/features/alerts/data/alert_models.dart';
import 'package:geosentry_mobile/features/alerts/data/alerts_repository.dart';
import 'package:geosentry_mobile/features/alerts/presentation/alerts_screen.dart';
import 'package:geosentry_mobile/features/auth/data/auth_models.dart';

final now = DateTime.utc(2026, 10, 30, 12);

AlertModel alert(String id, {String? validUntil, String status = 'active', String title = 'Cảnh báo'}) => AlertModel(
      broadcastId: id,
      title: title,
      message: 'Sơ tán ngay',
      severity: 'high',
      areaName: 'Mù Cang Chải',
      receivedAt: '2026-10-30T10:00:00Z',
      issuedAt: '2026-10-30T10:00:00Z',
      validUntil: validUntil,
      status: status,
    );

Map<String, dynamic> broadcastJson(String id, {String status = 'active', String validUntil = '2026-10-31T10:00:00Z'}) => {
      'broadcastId': id,
      'title': 'Cảnh báo $id',
      'message': 'Sơ tán ngay',
      'severity': 'extreme',
      'areaName': 'Mù Cang Chải',
      'issuedAt': '2026-10-30T10:00:00Z',
      'validUntil': validUntil,
      'status': status,
      'expired': false,
    };

class FakeAlertsRepository extends AlertsRepository {
  List<AlertModel> items;
  bool offline = false;
  FakeAlertsRepository(this.items);

  @override
  Future<List<AlertModel>> getAlertHistory() async => items;

  @override
  Future<int> resync() async {
    if (offline) throw const ApiException(message: 'offline');
    return 0;
  }
}

void main() {
  sqfliteFfiInit();
  databaseFactory = databaseFactoryFfi;

  group('alert state', () {
    test('revoked wins; expiry is exactly at valid_until; missing or broken validity stays active', () {
      expect(alert('a', validUntil: '2026-10-30T12:00:01Z').stateAt(now), AlertState.active);
      expect(alert('a', validUntil: '2026-10-30T12:00:00Z').stateAt(now), AlertState.expired);
      expect(alert('a', validUntil: '2026-10-30T11:00:00Z', status: 'revoked').stateAt(now), AlertState.revoked);
      expect(alert('a').stateAt(now), AlertState.active);
      expect(alert('a', validUntil: 'not a date').stateAt(now), AlertState.active);
      expect(alert('a', validUntil: '2026-10-30T19:00:00+07:00').stateAt(now), AlertState.expired);
    });

    test('push payload and resync item keep issue time, validity and status', () {
      final pushed = AlertModel.fromFcmPayload({
        'broadcastId': 'b1',
        'severity': 'extreme',
        'areaName': 'Sa Pa',
        'issuedAt': '2026-10-30T10:00:00Z',
        'validUntil': '2026-10-31T10:00:00Z',
      });
      expect((pushed.issuedAt, pushed.validUntil, pushed.status), ('2026-10-30T10:00:00Z', '2026-10-31T10:00:00Z', 'active'));
      final synced = AlertModel.fromBroadcastJson(broadcastJson('b2', status: 'revoked'));
      expect((synced.broadcastId, synced.status, synced.receivedAt), ('b2', 'revoked', '2026-10-30T10:00:00Z'));
      final roundTrip = AlertModel.fromMap(synced.toMap());
      expect((roundTrip.validUntil, roundTrip.status), (synced.validUntil, 'revoked'));
    });
  });

  group('history storage and resync', () {
    late List<Map<String, dynamic>> served;
    var online = true;
    late List<http.Request> requests;

    AlertsRepository build() => AlertsRepository(
          apiClient: ApiClient(
            baseUrl: 'http://test',
            client: MockClient((r) async {
              requests.add(r);
              if (!online) throw Exception('no route to host');
              if (r.method == 'GET') return http.Response(jsonEncode(served), 200, headers: {'content-type': 'application/json'});
              return http.Response('', 204);
            }),
          ),
        );

    setUp(() async {
      SharedPreferences.setMockInitialValues({});
      await Session.save('jwt-1', const UserProfile(userId: 'u-1', fullName: 'An', email: 'a@b.c', role: 'citizen'));
      await LocalStorage.clearAlertHistory();
      served = [];
      online = true;
      requests = [];
    });

    test('the same broadcast saved twice is one row, updated in place', () async {
      final repo = build();
      await repo.saveAlert(alert('dup', title: 'first'));
      await repo.saveAlert(alert('dup', title: 'second', validUntil: '2026-10-31T10:00:00Z'));
      final history = await repo.getAlertHistory();
      expect(history.length, 1);
      expect((history.single.title, history.single.validUntil), ('second', '2026-10-31T10:00:00Z'));
    });

    test('a revoked alert never goes back to active because a late push arrives', () async {
      final repo = build();
      await repo.saveAlert(alert('r1', status: 'revoked'));
      await repo.saveAlert(alert('r1', status: 'active'));
      expect((await repo.getAlertHistory()).single.status, 'revoked');
    });

    test('old rows without a broadcast id are kept, not merged', () async {
      final repo = build();
      await repo.saveAlert(alert(''));
      await repo.saveAlert(alert(''));
      expect((await repo.getAlertHistory()).length, 2);
    });

    test('resync brings missed alerts, revokes, and merges with what a push already stored', () async {
      final repo = build();
      await repo.saveAlert(alert('pushed')); // đã nhận bằng push
      served = [
        broadcastJson('pushed'),
        broadcastJson('missed'),
        broadcastJson('gone', status: 'revoked'),
      ];
      expect(await repo.resync(), 3);
      final byId = {for (final a in await repo.getAlertHistory()) a.broadcastId: a};
      expect(byId.keys.toSet(), {'pushed', 'missed', 'gone'});
      expect(byId['gone']!.stateAt(now), AlertState.revoked);
      expect(byId['missed']!.validUntil, '2026-10-31T10:00:00Z');

      served = [broadcastJson('pushed', status: 'revoked'), broadcastJson('missed'), broadcastJson('gone', status: 'revoked')];
      await repo.resync();
      final after = {for (final a in await repo.getAlertHistory()) a.broadcastId: a};
      expect(after.length, 3);
      expect(after['pushed']!.stateAt(now), AlertState.revoked);
      expect(requests.last.headers['Authorization'], 'Bearer jwt-1');
    });

    test('resync offline throws and leaves the history untouched', () async {
      final repo = build();
      await repo.saveAlert(alert('keep'));
      online = false;
      await expectLater(repo.resync(), throwsA(isA<ApiException>()));
      expect((await repo.getAlertHistory()).map((a) => a.broadcastId), ['keep']);
    });

    test('device token is registered for the signed-in account and unregistered with its token in the body', () async {
      final repo = build();
      expect(await repo.registerDeviceToken('fcm-1'), isTrue);
      final register = requests.last;
      expect((register.method, register.url.path), ('POST', '/api/v1/alerts/devices/register'));
      expect(jsonDecode(register.body), {'fcmToken': 'fcm-1', 'deviceType': 'android'});
      expect(register.headers['Authorization'], 'Bearer jwt-1');

      await repo.unregisterDeviceToken('fcm-1');
      final unregister = requests.last;
      expect((unregister.method, unregister.url.path), ('DELETE', '/api/v1/alerts/devices'));
      expect(jsonDecode(unregister.body), {'fcmToken': 'fcm-1'});

      online = false;
      expect(await repo.registerDeviceToken('fcm-2'), isFalse);
      await repo.unregisterDeviceToken('fcm-2'); // không ném lỗi khi mất mạng
    });
  });

  group('alerts screen', () {
    testWidgets('shows validity chips, issue and expiry times, and never calls an empty list safe', (tester) async {
      final repo = FakeAlertsRepository([
        alert('live', validUntil: '2026-10-31T10:00:00Z', title: 'Đang hiệu lực'),
        alert('old', validUntil: '2026-10-30T11:00:00Z', title: 'Đã quá hạn'),
        alert('revoked', validUntil: '2026-10-31T10:00:00Z', status: 'revoked', title: 'Bị thu hồi'),
      ]);
      await tester.pumpWidget(MaterialApp(
        home: AlertsScreen(repository: repo, clock: () => now, notificationsEnabled: () async => true),
      ));
      await tester.pumpAndSettle();
      expect(find.text('Còn hiệu lực'), findsOneWidget);
      expect(find.text('Đã hết hạn'), findsOneWidget);
      expect(find.text('Đã thu hồi'), findsOneWidget);
      expect(find.textContaining('Hiệu lực đến'), findsNWidgets(3));
      expect(find.text('Thông báo của TerraWatch đang bị tắt'), findsNothing);

      repo.items = [];
      await tester.drag(find.byType(Scrollable).first, const Offset(0, 300));
      await tester.pumpAndSettle();
      expect(find.textContaining('không phải xác nhận an toàn'), findsOneWidget);
    });

    testWidgets('warns when the system blocks notifications and keeps working offline', (tester) async {
      final repo = FakeAlertsRepository([alert('a', validUntil: '2026-10-31T10:00:00Z')])..offline = true;
      await tester.pumpWidget(MaterialApp(
        home: AlertsScreen(repository: repo, clock: () => now, notificationsEnabled: () async => false),
      ));
      await tester.pumpAndSettle();
      expect(find.text('Thông báo của TerraWatch đang bị tắt'), findsOneWidget);
      expect(find.text('Bật thông báo'), findsOneWidget);
      expect(find.text('Cảnh báo'), findsOneWidget); // lịch sử trên máy vẫn hiện dù resync lỗi
    });
  });
}
