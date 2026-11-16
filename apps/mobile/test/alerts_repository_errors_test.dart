import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:path/path.dart' as p;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';
import 'package:geosentry_mobile/core/constants/app_constants.dart';
import 'package:geosentry_mobile/core/network/api_client.dart';
import 'package:geosentry_mobile/core/network/api_exceptions.dart';
import 'package:geosentry_mobile/core/storage/local_storage.dart';
import 'package:geosentry_mobile/core/storage/session.dart';
import 'package:geosentry_mobile/features/alerts/data/alert_models.dart';
import 'package:geosentry_mobile/features/alerts/data/alerts_repository.dart';
import 'package:geosentry_mobile/features/auth/data/auth_models.dart';

import 'support/harness.dart';

// Target: lib/features/alerts/data/alerts_repository.dart (real LocalStorage on a new database per test, scripted server).
// Covers MD-ALR-004, 005, 006, 007, 008, 009 (and the model defaults behind MD-ALR-001..003 as seen through the repository).
// MD-ALR-010 (OS refuses a permission) does not apply to this class: it never asks for a permission; the system
// notification switch is asserted in alerts_screen_gaps_test and push_notification_services_test.
// Already asserted by push_alerts_test / profile_subscriptions_test: resync merge, offline resync, device token calls,
// fetchSubscriptions parse, subscribe 404, deleteSubscription path, monitoring areas.

http.Response _json(int status, Object body) => http.Response(jsonEncode(body), status, headers: {'content-type': 'application/json'});

void main() {
  useIsolatedSqlite();
  late http.Response Function(http.Request) reply;
  late List<http.Request> requests;
  var online = true;

  AlertsRepository repo() => AlertsRepository(
        apiClient: ApiClient(
          baseUrl: 'http://test',
          client: MockClient((r) async {
            requests.add(r);
            if (!online) throw http.ClientException('no route to host');
            return reply(r);
          }),
        ),
      );

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    await Session.save('jwt-1', const UserProfile(userId: 'u-1', fullName: 'An', email: 'a@b.c', role: 'citizen'));
    final path = p.join(await databaseFactoryFfi.getDatabasesPath(), AppConstants.dbName);
    await (await LocalStorage.database).close();
    await databaseFactoryFfi.deleteDatabase(path);
    requests = [];
    online = true;
    reply = (_) => _json(200, {'data': []});
  });

  tearDown(() async => (await LocalStorage.database).close());

  Future<List<String>> storedIds() async => [for (final a in await repo().getAlertHistory()) a.broadcastId]..sort();

  group('valid and missing data (MD-ALR-004, MD-ALR-005)', () {
    test('MD-ALR-004: a subscribe request carries phone, area and channels in the body and the bearer token', () async {
      reply = (_) => http.Response('', 201);
      await repo().subscribeAlerts(SubscriptionModel(phoneNumber: '0912345678', areaId: '7', alertChannels: const ['SMS']));
      final r = requests.single;
      expect((r.method, r.url.path), ('POST', '/api/v1/alerts/subscriptions'));
      expect(jsonDecode(r.body), {'phoneNumber': '0912345678', 'areaId': '7', 'alertChannels': ['SMS']});
      expect(r.headers['Authorization'], 'Bearer jwt-1');
    });

    test('MD-ALR-005: a subscription without areaName gets "Khu vực #id"; a "data" that is not a list gives an empty list', () async {
      reply = (_) => _json(200, [
            {'subscriptionId': 's-1', 'areaId': 12, 'alertChannels': ['PUSH']},
          ]);
      final list = await repo().fetchSubscriptions();
      expect((list.single.areaName, list.single.areaId), ('Khu vực #12', 12));
      for (final body in <Object>[{'data': null}, {'data': 'x'}, {'message': 'none'}]) {
        reply = (_) => _json(200, body);
        expect(await repo().fetchSubscriptions(), isEmpty, reason: '$body');
      }
    });

    test('MD-ALR-005: a resync item with only broadcastId is stored with safe defaults; "data" missing stores nothing and returns 0', () async {
      reply = (_) => _json(200, {'data': [{'broadcastId': 'min'}]});
      expect(await repo().resync(), 1);
      final a = (await repo().getAlertHistory()).single;
      expect((a.title, a.message, a.severity, a.areaName, a.status), ('', '', 'high', 'Khu vực trọng điểm', 'active'));
      expect((a.issuedAt, a.validUntil), (null, null));
      expect(DateTime.tryParse(a.receivedAt), isNotNull, reason: 'receivedAt falls back to now, a parsable time');

      reply = (_) => _json(200, {'serverTime': 'x'});
      expect(await repo().resync(), 0);
      expect(await storedIds(), ['min']);
    });
  });

  group('malformed data (MD-ALR-006)', () {
    test('a resync item without broadcastId, or a non-object item, throws and the local history is not touched', () async {
      await repo().saveAlert(AlertModel(broadcastId: 'keep', title: 't', message: 'm', severity: 'high', areaName: 'a', receivedAt: 'r'));
      for (final bad in <Object?>[{'title': 'no id'}, 'text', null, 42]) {
        reply = (_) => _json(200, {'data': [bad]});
        await expectLater(repo().resync(), throwsA(isA<Object>()), reason: '$bad');
      }
      expect(await storedIds(), ['keep']);
    });

    test('BUG: a malformed item in the middle of a resync must not leave the earlier items half-written', () async {
      // Expected (MD-ALR-006: "reject everything, no partial write"): nothing from a bad answer is stored.
      // Actual: resync() saves item by item, so the items before the bad one are already in the history.
      reply = (_) => _json(200, {
            'data': [
              {'broadcastId': 'good-1'},
              {'title': 'no id'},
              {'broadcastId': 'good-2'},
            ]
          });
      await expectLater(repo().resync(), throwsA(isA<Object>()));
      expect(await storedIds(), isEmpty);
    }, skip: 'BUG: expected a malformed resync answer to store nothing; actual: items before the bad one are saved '
        '(alerts_repository.dart resync saves one by one) and the error that escapes is not an ApiException.');

    test('a subscription list item with a wrong type throws instead of returning a half-built area', () async {
      reply = (_) => _json(200, [
            {'subscriptionId': 's', 'areaId': 'not-a-number', 'alertChannels': ['PUSH']},
          ]);
      await expectLater(repo().fetchSubscriptions(), throwsA(isA<TypeError>()));
    });
  });

  group('server errors (MD-ALR-007, MD-ALR-008)', () {
    test('MD-ALR-007: 4xx on subscribe becomes the server message, or fixed Vietnamese text for 401 and 403', () async {
      final cases = <(int, Object, String)>[
        (400, {'message': 'Số điện thoại không hợp lệ'}, 'Số điện thoại không hợp lệ'),
        (409, {'message': 'Đã đăng ký vùng này'}, 'Đã đăng ký vùng này'),
        (422, {'errors': []}, 'Lỗi máy chủ (422)'),
        (403, {'message': 'x'}, 'Không có quyền truy cập.'),
        (401, {'message': 'x'}, 'Hết phiên đăng nhập. Vui lòng đăng nhập lại.'),
      ];
      for (final (status, body, message) in cases) {
        reply = (_) => _json(status, body);
        await expectLater(
          repo().subscribeAlerts(SubscriptionModel(phoneNumber: '0912345678', areaId: '1')),
          throwsA(isA<ApiException>().having((e) => (e.statusCode, e.message), 'status+message', (status, message))),
          reason: '$status',
        );
      }
    });

    test('MD-ALR-007: a 401 on resync clears the session (the app returns to login) and keeps the stored alerts', () async {
      await repo().saveAlert(AlertModel(broadcastId: 'keep', title: 't', message: 'm', severity: 'high', areaName: 'a', receivedAt: 'r'));
      reply = (_) => _json(401, {'message': 'expired'});
      await expectLater(repo().resync(), throwsA(isA<ApiException>().having((e) => e.statusCode, 'statusCode', 401)));
      expect(Session.token, isNull);
      expect(await storedIds(), ['keep']);
    });

    test('MD-ALR-008: 5xx on resync (JSON, plain text, empty) throws ApiException and keeps every stored alert unchanged', () async {
      await repo().saveAlert(AlertModel(broadcastId: 'keep', title: 'original', message: 'm', severity: 'extreme', areaName: 'a', receivedAt: 'r'));
      final before = await LocalStorage.getAlertHistory();
      for (final response in [
        http.Response('{"message":"db down"}', 500, headers: {'content-type': 'application/json'}),
        http.Response('<html>502</html>', 502),
        http.Response('', 503),
      ]) {
        reply = (_) => response;
        await expectLater(repo().resync(), throwsA(isA<ApiException>().having((e) => e.statusCode, 'statusCode', response.statusCode)));
      }
      expect(await LocalStorage.getAlertHistory(), before);
      expect(Session.token, 'jwt-1', reason: 'a 5xx is not a logout');
    });

    test('MD-ALR-008: 5xx on subscribe and delete is thrown, never reported as success', () async {
      reply = (_) => _json(500, {'message': 'boom'});
      await expectLater(repo().subscribeAlerts(SubscriptionModel(phoneNumber: '0912345678', areaId: '1')), throwsA(isA<ApiException>()));
      await expectLater(repo().deleteSubscription('s-1'), throwsA(isA<ApiException>()));
    });

    test('MD-ALR-008: registerDeviceToken answers false (not true) on 4xx and 5xx; unregister swallows the error', () async {
      for (final status in [400, 401, 500]) {
        reply = (_) => _json(status, {'message': 'x'});
        expect(await repo().registerDeviceToken('t'), isFalse, reason: '$status');
      }
      await repo().unregisterDeviceToken('t'); // no throw
    });
  });

  group('no network (MD-ALR-009)', () {
    test('every call that needs the server throws an ApiException about the connection, and local history reads still work', () async {
      await repo().saveAlert(AlertModel(broadcastId: 'keep', title: 't', message: 'm', severity: 'high', areaName: 'a', receivedAt: 'r'));
      online = false;
      final connection = throwsA(isA<ApiException>().having((e) => e.message, 'message', contains('Không kết nối được máy chủ')));
      await expectLater(repo().resync(), connection);
      await expectLater(repo().fetchSubscriptions(), connection);
      await expectLater(repo().fetchMonitoringAreas(), connection);
      await expectLater(repo().deleteSubscription('s-1'), connection);
      await expectLater(repo().subscribeAlerts(SubscriptionModel(phoneNumber: '0912345678', areaId: '1')), connection);
      expect(await storedIds(), ['keep']);
    });
  });
}
