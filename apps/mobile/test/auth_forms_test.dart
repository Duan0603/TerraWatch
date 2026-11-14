import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:geosentry_mobile/core/network/api_client.dart';
import 'package:geosentry_mobile/core/storage/session.dart';
import 'package:geosentry_mobile/features/auth/data/auth_repository.dart';
import 'package:geosentry_mobile/features/auth/presentation/register_screen.dart';
import 'package:geosentry_mobile/features/profile/presentation/change_password_screen.dart';
import 'package:geosentry_mobile/features/profile/presentation/edit_profile_screen.dart';

import 'support/harness.dart';

void main() {
  late FakeBackend server;
  late AuthRepository repo;

  setUp(() async {
    server = FakeBackend();
    repo = AuthRepository(apiClient: ApiClient(client: server.client, baseUrl: 'http://test'));
    await signIn();
  });

  Future<void> tapVisible(WidgetTester tester, Finder f) async {
    await tester.ensureVisible(f);
    await tester.tap(f);
    await tester.pump();
  }

  /// Host with a route below so Navigator.pop is observable.
  Future<void> pumpOver(WidgetTester tester, Widget screen) async {
    await tester.pumpWidget(MaterialApp(
      home: Builder(
        builder: (context) => Scaffold(
          body: TextButton(
            onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => screen)),
            child: const Text('open'),
          ),
        ),
      ),
    ));
    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();
  }

  group('RegisterScreen', () {
    Future<void> fill(WidgetTester tester, {String name = 'Trần Thị Bình', String email = 'binh@example.com', String pass = '12345678'}) async {
      await tester.enterText(find.byType(TextFormField).at(0), name);
      await tester.enterText(find.byType(TextFormField).at(1), email);
      await tester.enterText(find.byType(TextFormField).at(2), pass);
    }

    testWidgets('renders Vietnamese labels and the phone-later hint', (tester) async {
      await tester.pumpWidget(MaterialApp(home: RegisterScreen(repository: repo)));
      expect(find.text('Đăng ký'), findsOneWidget);
      expect(find.text('Họ và tên'), findsOneWidget);
      expect(find.text('Email'), findsOneWidget);
      expect(find.text('Mật khẩu (từ 8 ký tự)'), findsOneWidget);
      expect(find.text('Tạo tài khoản'), findsOneWidget);
      expect(find.textContaining('thêm sau trong mục Hồ sơ'), findsOneWidget);
    });

    testWidgets('empty form shows every required-field message and calls no API', (tester) async {
      await tester.pumpWidget(MaterialApp(home: RegisterScreen(repository: repo)));
      await tapVisible(tester, find.text('Tạo tài khoản'));
      expect(find.text('Nhập họ và tên'), findsOneWidget);
      expect(find.text('Nhập email hợp lệ'), findsOneWidget);
      expect(find.text('Mật khẩu tối thiểu 8 ký tự'), findsOneWidget);
      expect(server.requests, isEmpty);
    });

    testWidgets('password of 7 chars is rejected, 8 chars is accepted (limit is 8)', (tester) async {
      await tester.pumpWidget(MaterialApp(home: RegisterScreen(repository: repo)));
      await fill(tester, pass: '1234567');
      await tapVisible(tester, find.text('Tạo tài khoản'));
      expect(find.text('Mật khẩu tối thiểu 8 ký tự'), findsOneWidget);
      expect(server.requests, isEmpty);
      await tester.enterText(find.byType(TextFormField).at(2), '12345678');
      server.handler = (_) => jsonResponse(200, {'token': 't', 'role': 'citizen', 'user': citizenJson});
      await tapVisible(tester, find.text('Tạo tài khoản'));
      await tester.pumpAndSettle();
      expect(server.requests.length, 1);
    });

    testWidgets('email without @ is rejected; whitespace-only name is rejected', (tester) async {
      await tester.pumpWidget(MaterialApp(home: RegisterScreen(repository: repo)));
      await fill(tester, name: '   ', email: 'not-an-email');
      await tapVisible(tester, find.text('Tạo tài khoản'));
      expect(find.text('Nhập họ và tên'), findsOneWidget);
      expect(find.text('Nhập email hợp lệ'), findsOneWidget);
    });

    testWidgets('success stores the session and closes the screen', (tester) async {
      await signOutForTest();
      server.handler = (_) => jsonResponse(200, {'token': 'jwt-new', 'role': 'citizen', 'user': citizenJson});
      await pumpOver(tester, RegisterScreen(repository: repo));
      await fill(tester);
      await tapVisible(tester, find.text('Tạo tài khoản'));
      await tester.pumpAndSettle();
      expect(Session.token, 'jwt-new');
      expect(find.byType(RegisterScreen), findsNothing);
    });

    testWidgets('duplicate email (409) shows the message, stays open, stores nothing', (tester) async {
      await signOutForTest();
      server.handler = (_) => jsonResponse(409, {'message': 'dup'});
      await tester.pumpWidget(MaterialApp(home: RegisterScreen(repository: repo)));
      await fill(tester);
      await tapVisible(tester, find.text('Tạo tài khoản'));
      await tester.pumpAndSettle();
      expect(find.text('Email đã được đăng ký'), findsOneWidget);
      expect(Session.token, isNull);
    });

    testWidgets('server error 500 shows a message and the button is usable again (retry)', (tester) async {
      await signOutForTest();
      server.handler = (_) => jsonResponse(500, {'message': 'boom'});
      await tester.pumpWidget(MaterialApp(home: RegisterScreen(repository: repo)));
      await fill(tester);
      await tapVisible(tester, find.text('Tạo tài khoản'));
      await tester.pumpAndSettle();
      expect(find.text('boom'), findsOneWidget);
      expect(find.byType(CircularProgressIndicator), findsNothing);
      server.handler = (_) => jsonResponse(200, {'token': 't2', 'role': 'citizen', 'user': citizenJson});
      await tapVisible(tester, find.text('Tạo tài khoản'));
      await tester.pumpAndSettle();
      expect(Session.token, 't2');
    });

    testWidgets('offline shows the connection message, not a success', (tester) async {
      await signOutForTest();
      server.online = false;
      await tester.pumpWidget(MaterialApp(home: RegisterScreen(repository: repo)));
      await fill(tester);
      await tapVisible(tester, find.text('Tạo tài khoản'));
      await tester.pumpAndSettle();
      expect(find.textContaining('Không kết nối được máy chủ'), findsOneWidget);
      expect(Session.token, isNull);
    });

    testWidgets('while submitting: spinner shown and a second tap sends nothing', (tester) async {
      await signOutForTest();
      final gateHolder = FakeBackend()..handler = (_) => jsonResponse(200, {'token': 't', 'role': 'citizen', 'user': citizenJson});
      final slowRepo = AuthRepository(apiClient: ApiClient(client: gateHolder.client, baseUrl: 'http://test'));
      await tester.pumpWidget(MaterialApp(home: RegisterScreen(repository: slowRepo)));
      await fill(tester);
      gateHolder.gate = Completer<void>();
      await tapVisible(tester, find.text('Tạo tài khoản'));
      expect(find.byType(CircularProgressIndicator), findsOneWidget);
      final button = tester.widget<ElevatedButton>(find.byType(ElevatedButton));
      expect(button.onPressed, isNull);
      await tester.tap(find.byType(ElevatedButton), warnIfMissed: false);
      await tester.pump();
      expect(gateHolder.requests.length, 1);
      gateHolder.gate!.complete();
      await tester.pumpAndSettle();
    });
  });

  group('ChangePasswordScreen', () {
    Future<void> fill(WidgetTester tester, {String cur = 'old-pass-1', String next = 'new-pass-1', String again = 'new-pass-1'}) async {
      await tester.enterText(find.byType(TextFormField).at(0), cur);
      await tester.enterText(find.byType(TextFormField).at(1), next);
      await tester.enterText(find.byType(TextFormField).at(2), again);
    }

    testWidgets('renders Vietnamese labels', (tester) async {
      await tester.pumpWidget(MaterialApp(home: ChangePasswordScreen(repository: repo)));
      expect(find.text('Mật khẩu hiện tại'), findsOneWidget);
      expect(find.text('Mật khẩu mới (từ 8 ký tự)'), findsOneWidget);
      expect(find.text('Nhập lại mật khẩu mới'), findsOneWidget);
      expect(find.widgetWithText(ElevatedButton, 'Đổi mật khẩu'), findsOneWidget);
    });

    testWidgets('empty form: required current password, min 8 chars; confirm "" equals new "" so no mismatch', (tester) async {
      await tester.pumpWidget(MaterialApp(home: ChangePasswordScreen(repository: repo)));
      await tapVisible(tester, find.widgetWithText(ElevatedButton, 'Đổi mật khẩu'));
      expect(find.text('Nhập mật khẩu hiện tại'), findsOneWidget);
      expect(find.text('Mật khẩu tối thiểu 8 ký tự'), findsOneWidget);
      expect(server.requests, isEmpty);
    });

    testWidgets('mismatch between new and confirmation is rejected', (tester) async {
      await tester.pumpWidget(MaterialApp(home: ChangePasswordScreen(repository: repo)));
      await fill(tester, again: 'different-1');
      await tapVisible(tester, find.widgetWithText(ElevatedButton, 'Đổi mật khẩu'));
      expect(find.text('Mật khẩu nhập lại không khớp'), findsOneWidget);
      expect(server.requests, isEmpty);
    });

    testWidgets('new password of 7 chars is rejected', (tester) async {
      await tester.pumpWidget(MaterialApp(home: ChangePasswordScreen(repository: repo)));
      await fill(tester, next: '1234567', again: '1234567');
      await tapVisible(tester, find.widgetWithText(ElevatedButton, 'Đổi mật khẩu'));
      expect(find.text('Mật khẩu tối thiểu 8 ký tự'), findsOneWidget);
      expect(server.requests, isEmpty);
    });

    testWidgets('success: snackbar, screen closes, session kept', (tester) async {
      server.handler = (_) => http.Response('', 204);
      await pumpOver(tester, ChangePasswordScreen(repository: repo));
      await fill(tester);
      await tapVisible(tester, find.widgetWithText(ElevatedButton, 'Đổi mật khẩu'));
      await tester.pumpAndSettle();
      expect(find.text('Đã đổi mật khẩu'), findsOneWidget);
      expect(find.byType(ChangePasswordScreen), findsNothing);
      expect(Session.token, 'jwt-1');
    });

    testWidgets('wrong current password (400) shows the message and keeps the session', (tester) async {
      server.handler = (_) => jsonResponse(400, {'message': 'x'});
      await tester.pumpWidget(MaterialApp(home: ChangePasswordScreen(repository: repo)));
      await fill(tester);
      await tapVisible(tester, find.widgetWithText(ElevatedButton, 'Đổi mật khẩu'));
      await tester.pumpAndSettle();
      expect(find.text('Mật khẩu hiện tại không đúng'), findsOneWidget);
      expect(Session.token, 'jwt-1');
    });

    testWidgets('session expired (401) shows the expiry message and clears the session', (tester) async {
      server.handler = (_) => jsonResponse(401, {'message': 'expired'});
      await tester.pumpWidget(MaterialApp(home: ChangePasswordScreen(repository: repo)));
      await fill(tester);
      await tapVisible(tester, find.widgetWithText(ElevatedButton, 'Đổi mật khẩu'));
      await tester.pumpAndSettle();
      expect(find.text('Hết phiên đăng nhập. Vui lòng đăng nhập lại.'), findsOneWidget);
      expect(Session.token, isNull);
    });

    testWidgets('5xx and offline show an error, never "Đã đổi mật khẩu"', (tester) async {
      server.handler = (_) => jsonResponse(503, {'message': 'down'});
      await tester.pumpWidget(MaterialApp(home: ChangePasswordScreen(repository: repo)));
      await fill(tester);
      await tapVisible(tester, find.widgetWithText(ElevatedButton, 'Đổi mật khẩu'));
      await tester.pumpAndSettle();
      expect(find.text('down'), findsOneWidget);
      server.online = false;
      await tapVisible(tester, find.widgetWithText(ElevatedButton, 'Đổi mật khẩu'));
      await tester.pumpAndSettle();
      expect(find.textContaining('Không kết nối được máy chủ'), findsOneWidget);
      expect(find.text('Đã đổi mật khẩu'), findsNothing);
    });

    testWidgets('while saving: spinner, button disabled, single request', (tester) async {
      server.handler = (_) => http.Response('', 204);
      server.gate = Completer<void>();
      await tester.pumpWidget(MaterialApp(home: ChangePasswordScreen(repository: repo)));
      await fill(tester);
      await tapVisible(tester, find.widgetWithText(ElevatedButton, 'Đổi mật khẩu'));
      expect(find.byType(CircularProgressIndicator), findsOneWidget);
      expect(tester.widget<ElevatedButton>(find.byType(ElevatedButton)).onPressed, isNull);
      expect(server.requests.length, 1);
      server.gate!.complete();
      await tester.pumpAndSettle();
    });
  });

  group('EditProfileScreen', () {
    Future<void> pumpEdit(WidgetTester tester) => tester.pumpWidget(MaterialApp(home: EditProfileScreen(repository: repo)));
    final save = find.widgetWithText(ElevatedButton, 'Lưu');

    testWidgets('prefills from the stored profile with Vietnamese labels', (tester) async {
      await signIn(citizen({
        'phoneNumber': '0912345678',
        'province': 'Lào Cai',
        'dateOfBirth': '1990-05-17',
        'gender': 'female',
      }));
      await pumpEdit(tester);
      expect(find.text('Chỉnh sửa hồ sơ'), findsOneWidget);
      expect(find.text('Nguyễn Văn An'), findsOneWidget);
      expect(find.text('0912345678'), findsOneWidget);
      expect(find.text('Lào Cai'), findsOneWidget);
      expect(find.text('17/05/1990'), findsOneWidget);
      expect(find.text('Nữ'), findsOneWidget);
    });

    testWidgets('no date of birth shows "Chưa chọn"', (tester) async {
      await pumpEdit(tester);
      expect(find.text('Chưa chọn'), findsOneWidget);
    });

    testWidgets('phone: accepts 9-15 digits with optional +, rejects 8 digits, 16 digits and letters', (tester) async {
      Future<bool> accepted(String phone) async {
        await tester.enterText(find.byType(TextFormField).at(1), phone);
        await tester.ensureVisible(save);
        server.requests.clear();
        server.handler = (_) => jsonResponse(200, citizenJson);
        await tester.tap(save);
        await tester.pump();
        final invalid = find.text('Số điện thoại không hợp lệ').evaluate().isNotEmpty;
        await tester.pumpAndSettle();
        return !invalid;
      }

      await pumpOver(tester, EditProfileScreen(repository: repo));
      expect(await accepted('12345678'), isFalse);
      expect(await accepted('1234567890123456'), isFalse);
      expect(await accepted('09123abc45'), isFalse);
      expect(await accepted('+84912345678'), isTrue);
    });

    testWidgets('emergency contact: phone without name, and name without phone, are both rejected', (tester) async {
      await pumpEdit(tester);
      final fields = find.byType(TextFormField);
      await tester.enterText(fields.at(7), '0912345678'); // emergency phone only
      await tapVisible(tester, save);
      expect(find.text('Nhập tên người liên hệ'), findsOneWidget);
      await tester.enterText(fields.at(7), '');
      await tester.enterText(fields.at(6), 'Mẹ Lan'); // emergency name only
      await tapVisible(tester, save);
      expect(find.text('Nhập số điện thoại người liên hệ'), findsOneWidget);
      expect(server.requests, isEmpty);
    });

    testWidgets('success sends the full profile, updates the session and closes', (tester) async {
      server.handler = (r) => jsonResponse(200, {...citizenJson, 'fullName': 'Bình', 'phoneNumber': '0912345678'});
      await pumpOver(tester, EditProfileScreen(repository: repo));
      await tester.enterText(find.byType(TextFormField).at(0), 'Bình');
      await tester.enterText(find.byType(TextFormField).at(1), '0912345678');
      await tapVisible(tester, save);
      await tester.pumpAndSettle();
      expect(server.where('PUT', '/api/v1/auth/me').length, 1);
      expect(Session.user.value?.fullName, 'Bình');
      expect(find.byType(EditProfileScreen), findsNothing);
    });

    testWidgets('server error 500 keeps the form open with the message; offline shows connection error', (tester) async {
      server.handler = (_) => jsonResponse(500, {'message': 'boom'});
      await pumpEdit(tester);
      await tapVisible(tester, save);
      await tester.pumpAndSettle();
      expect(find.text('boom'), findsOneWidget);
      expect(find.byType(EditProfileScreen), findsOneWidget);
      server.online = false;
      await tapVisible(tester, save);
      await tester.pumpAndSettle();
      expect(find.textContaining('Không kết nối được máy chủ'), findsOneWidget);
      expect(Session.user.value?.fullName, 'Nguyễn Văn An'); // local profile unchanged
    });

    testWidgets('401 shows expiry message and clears the session', (tester) async {
      server.handler = (_) => jsonResponse(401, {'message': 'expired'});
      await pumpEdit(tester);
      await tapVisible(tester, save);
      await tester.pumpAndSettle();
      expect(find.text('Hết phiên đăng nhập. Vui lòng đăng nhập lại.'), findsOneWidget);
      expect(Session.token, isNull);
    });

    testWidgets('malformed 200 body shows the invalid-response message', (tester) async {
      server.handler = (_) => jsonResponse(200, {'unexpected': true});
      await pumpEdit(tester);
      await tapVisible(tester, save);
      await tester.pumpAndSettle();
      expect(find.text('Phản hồi máy chủ không hợp lệ'), findsOneWidget);
    });

    testWidgets('while saving the button is disabled and only one PUT is sent', (tester) async {
      server.handler = (_) => jsonResponse(200, citizenJson);
      server.gate = Completer<void>();
      await pumpEdit(tester);
      await tapVisible(tester, save);
      expect(tester.widget<ElevatedButton>(find.byType(ElevatedButton)).onPressed, isNull);
      await tester.tap(find.byType(ElevatedButton), warnIfMissed: false);
      await tester.pump();
      expect(server.requests.length, 1);
      server.gate!.complete();
      await tester.pumpAndSettle();
    });
  });
}
