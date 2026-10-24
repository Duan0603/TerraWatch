import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:geosentry_mobile/core/network/api_client.dart';
import 'package:geosentry_mobile/core/network/api_exceptions.dart';
import 'package:geosentry_mobile/core/storage/session.dart';
import 'package:geosentry_mobile/features/alerts/data/alert_models.dart';
import 'package:geosentry_mobile/features/alerts/data/alerts_repository.dart';
import 'package:geosentry_mobile/features/auth/data/auth_models.dart';
import 'package:geosentry_mobile/features/auth/data/auth_repository.dart';
import 'package:geosentry_mobile/features/profile/presentation/edit_profile_screen.dart';

const _user = {
  'userId': 'u-1',
  'fullName': 'Nguyễn Văn An',
  'email': 'an@example.com',
  'role': 'citizen',
  'phoneNumber': null,
  'authProvider': 'email',
};

ApiClient _api(http.Response Function(http.Request) handler) =>
    ApiClient(client: MockClient((r) async => handler(r)), baseUrl: 'http://test');

http.Response _json(int status, Object body) =>
    http.Response(jsonEncode(body), status, headers: {'content-type': 'application/json'});

void main() {
  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    await Session.save('jwt-1', UserProfile.fromJson(_user));
  });

  group('Profile (Story 5.7)', () {
    test('authProvider is parsed and defaults to email', () {
      expect(UserProfile.fromJson(_user).authProvider, 'email');
      expect(UserProfile.fromJson({..._user, 'authProvider': 'google'}).authProvider, 'google');
      expect(UserProfile.fromJson({..._user}..remove('authProvider')).authProvider, 'email');
    });

    test('updateProfile PUTs name and phone and refreshes the stored profile', () async {
      late http.Request sent;
      final repo = AuthRepository(apiClient: _api((r) {
        sent = r;
        return _json(200, {..._user, 'fullName': 'Binh', 'phoneNumber': '0912345678'});
      }));
      await repo.updateProfile(fullName: ' Binh ', phoneNumber: '0912345678');
      expect(sent.method, 'PUT');
      expect(sent.url.path, '/api/v1/auth/me');
      final body = jsonDecode(sent.body) as Map<String, dynamic>;
      expect(body['fullName'], 'Binh');
      expect(body['phoneNumber'], '0912345678');
      expect(Session.user.value?.fullName, 'Binh');
      expect(Session.user.value?.phoneNumber, '0912345678');
    });

    test('changePassword sends both passwords; wrong current password is a 400 that keeps the session', () async {
      late http.Request sent;
      final ok = AuthRepository(apiClient: _api((r) {
        sent = r;
        return http.Response('', 204);
      }));
      await ok.changePassword(currentPassword: 'old-pass-1', newPassword: 'new-pass-1');
      expect(sent.url.path, '/api/v1/auth/password');
      expect(jsonDecode(sent.body), {'currentPassword': 'old-pass-1', 'newPassword': 'new-pass-1'});

      final bad = AuthRepository(apiClient: _api((_) => _json(400, {'message': 'Current password is incorrect'})));
      await expectLater(
        bad.changePassword(currentPassword: 'x', newPassword: 'new-pass-1'),
        throwsA(isA<ApiException>().having((e) => e.message, 'message', 'Mật khẩu hiện tại không đúng')),
      );
      expect(Session.token, 'jwt-1');
    });

    testWidgets('edit screen rejects an empty name and a malformed phone number', (tester) async {
      await tester.pumpWidget(const MaterialApp(home: EditProfileScreen()));
      await tester.enterText(find.byType(TextFormField).first, '');
      await tester.enterText(find.byType(TextFormField).at(1), 'abc');
      await tester.ensureVisible(find.text('Lưu'));
      await tester.tap(find.text('Lưu'));
      await tester.pump();
      expect(find.text('Nhập họ và tên'), findsOneWidget);
      expect(find.text('Số điện thoại không hợp lệ'), findsOneWidget);
    });
  });

  group('Alert subscriptions (Story 5.7)', () {
    test('fetchSubscriptions parses the server list', () async {
      final repo = AlertsRepository(apiClient: _api((_) => _json(200, [
            {
              'subscriptionId': 's-1',
              'areaId': 1,
              'areaName': 'Mù Cang Chải',
              'alertChannels': ['PUSH', 'SMS'],
              'subscribedAt': '2026-10-24T00:00:00Z',
            }
          ])));
      final list = await repo.fetchSubscriptions();
      expect(list.single.areaName, 'Mù Cang Chải');
      expect(list.single.alertChannels, ['PUSH', 'SMS']);
    });

    test('subscribe surfaces server errors instead of faking success', () async {
      final repo = AlertsRepository(apiClient: _api((_) => _json(404, {'message': 'Monitoring area not found'})));
      await expectLater(
        repo.subscribeAlerts(SubscriptionModel(phoneNumber: '0912345678', areaId: '99')),
        throwsA(isA<ApiException>()),
      );
    });

    test('deleteSubscription calls DELETE with the id', () async {
      late http.Request sent;
      final repo = AlertsRepository(apiClient: _api((r) {
        sent = r;
        return http.Response('', 204);
      }));
      await repo.deleteSubscription('s-1');
      expect(sent.method, 'DELETE');
      expect(sent.url.path, '/api/v1/alerts/subscriptions/s-1');
    });

    test('monitoring areas keep the server area_id key and network errors are not hidden', () async {
      final ok = AlertsRepository(apiClient: _api((_) => _json(200, [
            {'area_id': 1, 'name': 'Mù Cang Chải'}
          ])));
      expect((await ok.fetchMonitoringAreas()).single['area_id'], 1);

      final down = AlertsRepository(
        apiClient: ApiClient(client: MockClient((_) async => throw Exception('offline')), baseUrl: 'http://test'),
      );
      await expectLater(down.fetchMonitoringAreas(), throwsA(isA<ApiException>()));
    });
  });
}
