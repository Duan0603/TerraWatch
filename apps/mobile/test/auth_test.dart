import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:geosentry_mobile/core/network/api_client.dart';
import 'package:geosentry_mobile/core/network/api_exceptions.dart';
import 'package:geosentry_mobile/core/storage/session.dart';
import 'package:geosentry_mobile/features/auth/data/auth_models.dart';
import 'package:geosentry_mobile/features/auth/data/auth_repository.dart';

const _user = {
  'userId': 'u-1',
  'fullName': 'Nguyễn Văn An',
  'email': 'an@example.com',
  'role': 'citizen',
  'phoneNumber': null,
};

AuthRepository _repo(http.Response Function(http.Request) handler) => AuthRepository(
      apiClient: ApiClient(client: MockClient((r) async => handler(r)), baseUrl: 'http://test'),
    );

http.Response _json(int status, Object body) =>
    http.Response(jsonEncode(body), status, headers: {'content-type': 'application/json'});

void main() {
  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    await Session.clear();
  });

  test('UserProfile parses backend JSON and builds initials', () {
    final u = UserProfile.fromJson(_user);
    expect(u.initials, 'VA');
    expect(u.phoneNumber, isNull);
  });

  test('login success stores session and sends credentials', () async {
    late http.Request sent;
    final repo = _repo((r) {
      sent = r;
      return _json(200, {'token': 'jwt-1', 'role': 'citizen', 'user': _user});
    });
    await repo.login(' an@example.com ', 'secret123');
    expect(sent.url.path, '/api/v1/auth/login');
    expect(jsonDecode(sent.body)['email'], 'an@example.com');
    expect(Session.token, 'jwt-1');
    expect(Session.user.value?.fullName, 'Nguyễn Văn An');
  });

  test('login 401 maps to generic message and stores nothing', () async {
    final repo = _repo((_) => _json(401, {'message': 'Invalid credentials'}));
    await expectLater(
      repo.login('a@b.c', 'x'),
      throwsA(isA<ApiException>().having((e) => e.message, 'message', 'Email hoặc mật khẩu không đúng')),
    );
    expect(Session.token, isNull);
  });

  test('register 409 maps to duplicate-email message', () async {
    final repo = _repo((_) => _json(409, {'message': 'Email already registered'}));
    await expectLater(
      repo.register(fullName: 'A', email: 'a@b.c', password: '12345678'),
      throwsA(isA<ApiException>().having((e) => e.message, 'message', 'Email đã được đăng ký')),
    );
  });

  test('non-citizen role is rejected and not stored', () async {
    final repo = _repo((_) => _json(200, {
          'token': 't',
          'role': 'admin',
          'user': {..._user, 'role': 'admin'},
        }));
    await expectLater(repo.login('a@b.c', 'x'), throwsA(isA<ApiException>()));
    expect(Session.token, isNull);
  });

  test('401 on a call with a token clears the session; Bearer header is sent', () async {
    await Session.save('jwt-1', UserProfile.fromJson(_user));
    String? auth;
    final repo = _repo((r) {
      auth = r.headers['Authorization'];
      return _json(401, {'message': 'expired'});
    });
    await repo.refreshProfile();
    expect(auth, 'Bearer jwt-1');
    expect(Session.token, isNull);
    expect(Session.user.value, isNull);
  });

  test('network error on refresh keeps the stored session (offline start)', () async {
    await Session.save('jwt-1', UserProfile.fromJson(_user));
    final repo = AuthRepository(
      apiClient: ApiClient(client: MockClient((_) async => throw Exception('offline')), baseUrl: 'http://test'),
    );
    await repo.refreshProfile();
    expect(Session.token, 'jwt-1');
  });

  test('session survives reload from storage and logout clears it', () async {
    await Session.save('jwt-1', UserProfile.fromJson(_user));
    Session.token = null;
    Session.user.value = null;
    await Session.load();
    expect(Session.user.value?.email, 'an@example.com');
    await AuthRepository().logout();
    expect(Session.token, isNull);
  });
}
