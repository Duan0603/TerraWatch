import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:geosentry_mobile/core/network/api_client.dart';
import 'package:geosentry_mobile/core/network/api_exceptions.dart';
import 'package:geosentry_mobile/core/storage/session.dart';
import 'package:geosentry_mobile/features/auth/data/auth_repository.dart';

import 'support/harness.dart';

Matcher _apiError(String message, [int? status]) => throwsA(isA<ApiException>()
    .having((e) => e.message, 'message', message)
    .having((e) => e.statusCode, 'statusCode', status));

void main() {
  late FakeBackend server;
  late AuthRepository repo;

  setUp(() async {
    server = FakeBackend();
    repo = AuthRepository(apiClient: ApiClient(client: server.client, baseUrl: 'http://test'), googleIdToken: () async => 'fb-token');
    await signOutForTest();
  });

  Map<String, dynamic> auth([Map<String, dynamic> user = const {}]) =>
      {'token': 'jwt-new', 'role': 'citizen', 'user': {...citizenJson, ...user}};

  group('register', () {
    test('trims name and email, sends the password untouched, and stores the session', () async {
      server.handler = (_) => jsonResponse(201, auth());
      final user = await repo.register(fullName: '  Trần Bình ', email: ' binh@example.com ', password: ' pw 12345 ');
      final body = jsonDecode(server.where('POST', '/api/v1/auth/register').single.body);
      expect(body, {'fullName': 'Trần Bình', 'email': 'binh@example.com', 'password': ' pw 12345 '});
      expect(user.userId, 'u-1');
      expect(Session.token, 'jwt-new');
    });

    test('other server errors keep the server message and status', () async {
      server.handler = (_) => jsonResponse(400, {'message': 'Mật khẩu quá yếu'});
      await expectLater(repo.register(fullName: 'A', email: 'a@b.c', password: '1'), _apiError('Mật khẩu quá yếu', 400));
      expect(Session.token, isNull);
    });

    test('offline: connection error, nothing stored', () async {
      server.online = false;
      await expectLater(
        repo.register(fullName: 'A', email: 'a@b.c', password: '12345678'),
        throwsA(isA<ApiException>().having((e) => e.message, 'message', contains('Không kết nối được máy chủ'))),
      );
      expect(Session.token, isNull);
    });
  });

  group('login', () {
    test('a 200 body without a user is reported as an invalid response, nothing stored', () async {
      server.handler = (_) => jsonResponse(200, {'token': 't'});
      await expectLater(repo.login('a@b.c', 'x'), _apiError('Phản hồi máy chủ không hợp lệ'));
      expect(Session.token, isNull);
    });

    test('500 keeps the server message; 401 is mapped but keeps its status code', () async {
      server.handler = (_) => jsonResponse(500, {'message': 'boom'});
      await expectLater(repo.login('a@b.c', 'x'), _apiError('boom', 500));
      server.handler = (_) => jsonResponse(401, {'message': 'bad'});
      await expectLater(repo.login('a@b.c', 'x'), _apiError('Email hoặc mật khẩu không đúng', 401));
    });

    test('a non-citizen gets 403 and the previous session is left alone', () async {
      await signIn();
      server.handler = (_) => jsonResponse(200, auth({'role': 'admin'}));
      await expectLater(repo.login('a@b.c', 'x'), _apiError('Ứng dụng dành cho người dân', 403));
      expect(Session.token, 'jwt-1');
    });
  });

  group('loginWithGoogle', () {
    test('401 maps to the invalid-Google message; 501 to the unsupported message', () async {
      server.handler = (_) => jsonResponse(401, {'message': 'x'});
      await expectLater(repo.loginWithGoogle(), _apiError('Đăng nhập Google không hợp lệ', 401));
      server.handler = (_) => jsonResponse(501, {'message': 'x'});
      await expectLater(repo.loginWithGoogle(), _apiError('Máy chủ chưa hỗ trợ đăng nhập Google', 501));
    });

    test('a token provider that throws is not swallowed and calls no API', () async {
      final bad = AuthRepository(apiClient: ApiClient(client: server.client, baseUrl: 'http://test'), googleIdToken: () async => throw StateError('no play services'));
      await expectLater(bad.loginWithGoogle(), throwsStateError);
      expect(server.requests, isEmpty);
    });
  });

  group('refreshProfile', () {
    test('without a stored token it calls nothing', () async {
      await repo.refreshProfile();
      expect(server.requests, isEmpty);
    });

    test('success replaces the stored profile with the server copy and keeps the token', () async {
      await signIn();
      server.handler = (_) => jsonResponse(200, {...citizenJson, 'fullName': 'Tên Mới'});
      await repo.refreshProfile();
      expect(Session.user.value?.fullName, 'Tên Mới');
      expect(Session.token, 'jwt-1');
    });

    test('a server error keeps the stored session', () async {
      await signIn();
      server.handler = (_) => jsonResponse(500, {'message': 'x'});
      await repo.refreshProfile();
      expect(Session.user.value?.fullName, 'Nguyễn Văn An');
    });

    test('logging out while the request is in flight does not sign the user back in', () async {
      await signIn();
      server.handler = (_) => jsonResponse(200, citizenJson);
      server.gate = Completer<void>();
      final pending = repo.refreshProfile();
      await Session.clear();
      server.gate!.complete();
      await pending;
      expect(Session.token, isNull);
      expect(Session.user.value, isNull);
    });
  });

  group('updateProfile', () {
    test('logging out while saving returns the profile but does not restore the session', () async {
      await signIn();
      server.handler = (_) => jsonResponse(200, {...citizenJson, 'fullName': 'Bình'});
      server.gate = Completer<void>();
      final pending = repo.updateProfile(fullName: 'Bình');
      await Session.clear();
      server.gate!.complete();
      expect((await pending).fullName, 'Bình');
      expect(Session.token, isNull);
    });

    test('a non-empty birth date is sent as given', () async {
      await signIn();
      server.handler = (_) => jsonResponse(200, citizenJson);
      await repo.updateProfile(fullName: 'A', dateOfBirth: '1990-05-17');
      expect(jsonDecode(server.where('PUT', '/api/v1/auth/me').single.body)['dateOfBirth'], '1990-05-17');
    });

    test('server rejection propagates and the stored profile is unchanged', () async {
      await signIn();
      server.handler = (_) => jsonResponse(400, {'message': 'Số điện thoại đã dùng'});
      await expectLater(repo.updateProfile(fullName: 'X'), _apiError('Số điện thoại đã dùng', 400));
      expect(Session.user.value?.fullName, 'Nguyễn Văn An');
    });
  });

  group('avatar', () {
    test('fetchAvatar rethrows errors other than 404', () async {
      await signIn();
      server.handler = (_) => jsonResponse(500, {'message': 'boom'});
      await expectLater(repo.fetchAvatar(), _apiError('boom', 500));
    });

    test('uploadAvatar sends base64 and puts the bytes in Session.avatar', () async {
      await signIn();
      final bytes = Uint8List.fromList([1, 2, 3, 4]);
      server.handler = (_) => jsonResponse(200, {...citizenJson, 'hasAvatar': true});
      await repo.uploadAvatar(bytes);
      expect(jsonDecode(server.where('PUT', '/api/v1/auth/me/avatar').single.body), {'imageBase64': base64Encode(bytes)});
      expect(Session.avatar.value, bytes);
    });

    test('uploadAvatar that fails keeps the previous avatar', () async {
      await signIn();
      Session.avatar.value = Uint8List.fromList([9]);
      server.handler = (_) => jsonResponse(413, {'message': 'Ảnh quá lớn'});
      await expectLater(repo.uploadAvatar(Uint8List.fromList([1])), _apiError('Ảnh quá lớn', 413));
      expect(Session.avatar.value, Uint8List.fromList([9]));
    });

    test('upload finishing after logout does not leak the avatar into the next session', () async {
      await signIn();
      server.handler = (_) => jsonResponse(200, {...citizenJson, 'hasAvatar': true});
      server.gate = Completer<void>();
      final pending = repo.uploadAvatar(Uint8List.fromList([1, 2]));
      await Session.clear();
      server.gate!.complete();
      await pending;
      expect(Session.avatar.value, isNull);
      expect(Session.token, isNull);
    });

    test('deleteAvatar failure keeps hasAvatar and the cached image', () async {
      await signIn(citizen({'hasAvatar': true}));
      Session.avatar.value = Uint8List.fromList([1]);
      server.handler = (_) => jsonResponse(500, {'message': 'x'});
      await expectLater(repo.deleteAvatar(), throwsA(isA<ApiException>()));
      expect(Session.user.value?.hasAvatar, isTrue);
      expect(Session.avatar.value, isNotNull);
    });
  });

  group('changePassword', () {
    test('a 400 becomes the wrong-current-password message', () async {
      await signIn();
      server.handler = (_) => jsonResponse(400, {'message': 'whatever'});
      await expectLater(repo.changePassword(currentPassword: 'a', newPassword: 'b'), _apiError('Mật khẩu hiện tại không đúng', 400));
    });

    test('other errors keep their own message', () async {
      await signIn();
      server.handler = (_) => jsonResponse(500, {'message': 'db down'});
      await expectLater(repo.changePassword(currentPassword: 'a', newPassword: 'b'), _apiError('db down', 500));
    });
  });

  group('logout', () {
    test('clears the session, the cached avatar and the stored profile', () async {
      await signIn(citizen({'hasAvatar': true}));
      Session.avatar.value = Uint8List.fromList([1]);
      await repo.logout();
      expect(Session.token, isNull);
      expect(Session.user.value, isNull);
      expect(Session.avatar.value, isNull);
      Session.token = null;
      await Session.load();
      expect(Session.token, isNull); // nothing left in storage either
    });
  });
}
