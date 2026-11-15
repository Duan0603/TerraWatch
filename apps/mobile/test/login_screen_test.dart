import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:geosentry_mobile/core/network/api_client.dart';
import 'package:geosentry_mobile/core/storage/session.dart';
import 'package:geosentry_mobile/features/auth/data/auth_repository.dart';
import 'package:geosentry_mobile/features/auth/presentation/login_screen.dart';
import 'package:geosentry_mobile/features/auth/presentation/register_screen.dart';

import 'support/harness.dart';

// auth_forms_test.dart covers RegisterScreen / ChangePasswordScreen / EditProfileScreen, auth_test.dart covers
// AuthRepository, widget_test.dart only taps "Đăng nhập" on an empty form. This file covers LoginScreen itself.

void main() {
  late FakeBackend server;
  late AuthRepository repo;
  late Future<String?> Function() googleToken;

  Map<String, dynamic> ok({String role = 'citizen', String token = 'jwt-new'}) =>
      {'token': token, 'role': role, 'user': {...citizenJson, 'role': role}};

  setUp(() async {
    await signOutForTest();
    server = FakeBackend()..handler = (_) => jsonResponse(200, ok());
    googleToken = () async => 'firebase-id-token';
    repo = AuthRepository(
      apiClient: ApiClient(client: server.client, baseUrl: 'http://test'),
      googleIdToken: () => googleToken(),
    );
  });

  Future<void> pumpLogin(WidgetTester tester) => tester.pumpWidget(MaterialApp(home: LoginScreen(repository: repo)));

  Future<void> tapVisible(WidgetTester tester, Finder f) async {
    await tester.ensureVisible(f);
    await tester.tap(f);
    await tester.pump();
  }

  Future<void> fill(WidgetTester tester, {String email = 'an@example.com', String password = 'secret123'}) async {
    await tester.enterText(find.byType(TextFormField).at(0), email);
    await tester.enterText(find.byType(TextFormField).at(1), password);
  }

  final loginButton = find.widgetWithText(ElevatedButton, 'Đăng nhập');
  final googleButton = find.widgetWithText(OutlinedButton, 'Đăng nhập bằng Google');
  final registerLink = find.widgetWithText(TextButton, 'Chưa có tài khoản? Đăng ký');

  group('form', () {
    testWidgets('shows the app name, both fields, the login button, Google button and register link', (tester) async {
      await pumpLogin(tester);
      expect(find.text('TerraWatch'), findsOneWidget);
      expect(find.text('Cổng thông tin người dân'), findsOneWidget);
      expect(find.widgetWithText(TextFormField, 'Email'), findsOneWidget);
      expect(find.widgetWithText(TextFormField, 'Mật khẩu'), findsOneWidget);
      expect(loginButton, findsOneWidget);
      expect(googleButton, findsOneWidget);
      expect(registerLink, findsOneWidget);
      expect(find.byType(CircularProgressIndicator), findsNothing);
    });

    testWidgets('empty form: both required messages, nothing is sent', (tester) async {
      await pumpLogin(tester);
      await tapVisible(tester, loginButton);
      expect(find.text('Nhập email hợp lệ'), findsOneWidget);
      expect(find.text('Nhập mật khẩu'), findsOneWidget);
      expect(server.requests, isEmpty);
    });

    testWidgets('email without @ is rejected even with a password; fixing it lets the request through', (tester) async {
      await pumpLogin(tester);
      await fill(tester, email: 'an.example.com');
      await tapVisible(tester, loginButton);
      expect(find.text('Nhập email hợp lệ'), findsOneWidget);
      expect(find.text('Nhập mật khẩu'), findsNothing);
      expect(server.requests, isEmpty);

      await tester.enterText(find.byType(TextFormField).at(0), 'an@example.com');
      await tapVisible(tester, loginButton);
      await tester.pumpAndSettle();
      expect(server.requests, hasLength(1));
      expect(find.text('Nhập email hợp lệ'), findsNothing);
    });

    testWidgets('password is hidden by default and the eye icon toggles it', (tester) async {
      await pumpLogin(tester);
      bool obscured() => tester.widget<TextField>(find.byType(TextField).at(1)).obscureText;
      expect(obscured(), isTrue);
      expect(find.byIcon(Icons.visibility_off), findsOneWidget);
      await tester.tap(find.byIcon(Icons.visibility_off));
      await tester.pump();
      expect(obscured(), isFalse);
      expect(find.byIcon(Icons.visibility), findsOneWidget);
      await tester.tap(find.byIcon(Icons.visibility));
      await tester.pump();
      expect(obscured(), isTrue);
    });
  });

  group('email login', () {
    testWidgets('sends the trimmed email and the password untouched to /auth/login, then stores the session', (tester) async {
      await pumpLogin(tester);
      await fill(tester, email: '  an@example.com ', password: ' secret123 ');
      await tapVisible(tester, loginButton);
      await tester.pumpAndSettle();

      final sent = server.where('POST', '/api/v1/auth/login').single;
      expect(jsonDecode(sent.body), {'email': 'an@example.com', 'password': ' secret123 '});
      expect(Session.token, 'jwt-new');
      expect(Session.user.value?.email, 'an@example.com');
      expect(find.byType(CircularProgressIndicator), findsNothing);
    });

    testWidgets('submitting from the keyboard on the password field logs in too', (tester) async {
      await pumpLogin(tester);
      await fill(tester);
      await tester.tap(find.byType(TextFormField).at(1));
      await tester.testTextInput.receiveAction(TextInputAction.done);
      await tester.pumpAndSettle();
      expect(server.where('POST', '/api/v1/auth/login'), hasLength(1));
      expect(Session.token, 'jwt-new');
    });

    testWidgets('wrong credentials (401): generic message, no session, form keeps what was typed', (tester) async {
      server.handler = (_) => jsonResponse(401, {'message': 'Invalid credentials'});
      await pumpLogin(tester);
      await fill(tester);
      await tapVisible(tester, loginButton);
      await tester.pumpAndSettle();
      expect(find.text('Email hoặc mật khẩu không đúng'), findsOneWidget);
      expect(Session.token, isNull);
      expect(find.text('an@example.com'), findsOneWidget);
      expect(find.byType(CircularProgressIndicator), findsNothing);
    });

    testWidgets('server error 500 shows the server message', (tester) async {
      server.handler = (_) => jsonResponse(500, {'message': 'boom'});
      await pumpLogin(tester);
      await fill(tester);
      await tapVisible(tester, loginButton);
      await tester.pumpAndSettle();
      expect(find.text('boom'), findsOneWidget);
      expect(Session.token, isNull);
    });

    testWidgets('offline shows the connection message, never a success', (tester) async {
      server.online = false;
      await pumpLogin(tester);
      await fill(tester);
      await tapVisible(tester, loginButton);
      await tester.pumpAndSettle();
      expect(find.textContaining('Không kết nối được máy chủ'), findsOneWidget);
      expect(Session.token, isNull);
    });

    testWidgets('an account that is not a citizen is rejected and no session is stored', (tester) async {
      server.handler = (_) => jsonResponse(200, ok(role: 'admin'));
      await pumpLogin(tester);
      await fill(tester);
      await tapVisible(tester, loginButton);
      await tester.pumpAndSettle();
      expect(find.text('Ứng dụng dành cho người dân'), findsOneWidget);
      expect(Session.token, isNull);
    });

    testWidgets('the error disappears when the next attempt starts and a retry can succeed', (tester) async {
      server.handler = (_) => jsonResponse(401, {'message': 'x'});
      await pumpLogin(tester);
      await fill(tester);
      await tapVisible(tester, loginButton);
      await tester.pumpAndSettle();
      expect(find.text('Email hoặc mật khẩu không đúng'), findsOneWidget);

      final gate = Completer<void>();
      server
        ..gate = gate
        ..handler = (_) => jsonResponse(200, ok());
      await tapVisible(tester, loginButton);
      expect(find.text('Email hoặc mật khẩu không đúng'), findsNothing); // stale error not shown while retrying
      gate.complete();
      await tester.pumpAndSettle();
      expect(Session.token, 'jwt-new');
      expect(find.text('Email hoặc mật khẩu không đúng'), findsNothing);
    });

    testWidgets('while waiting: spinner, login/Google/register disabled, a second tap sends nothing', (tester) async {
      server.gate = Completer<void>();
      await pumpLogin(tester);
      await fill(tester);
      await tapVisible(tester, loginButton);

      expect(find.byType(CircularProgressIndicator), findsOneWidget);
      expect(tester.widget<ElevatedButton>(find.byType(ElevatedButton)).onPressed, isNull);
      expect(tester.widget<OutlinedButton>(googleButton).onPressed, isNull);
      expect(tester.widget<TextButton>(registerLink).onPressed, isNull);

      await tester.tap(find.byType(ElevatedButton), warnIfMissed: false);
      await tester.tap(googleButton, warnIfMissed: false);
      await tester.pump();
      expect(server.requests, hasLength(1));

      server.gate!.complete();
      await tester.pumpAndSettle();
      expect(tester.widget<OutlinedButton>(googleButton).onPressed, isNotNull);
    });

    testWidgets('the screen can be replaced by the auth gate while the request is in flight (no setState after dispose)', (tester) async {
      server.gate = Completer<void>();
      // Same shape as app.dart: a signed-in user swaps LoginScreen out.
      await tester.pumpWidget(MaterialApp(
        home: ValueListenableBuilder(
          valueListenable: Session.user,
          builder: (_, user, __) => user == null ? LoginScreen(repository: repo) : const Text('home'),
        ),
      ));
      await fill(tester);
      await tapVisible(tester, loginButton);
      server.gate!.complete();
      await tester.pumpAndSettle();
      expect(find.text('home'), findsOneWidget);
      expect(find.byType(LoginScreen), findsNothing);
      expect(tester.takeException(), isNull);
    });
  });

  group('Google login', () {
    testWidgets('works with an empty form: sends only the ID token to /auth/google and stores the session', (tester) async {
      await pumpLogin(tester);
      await tapVisible(tester, googleButton);
      await tester.pumpAndSettle();
      expect(find.text('Nhập email hợp lệ'), findsNothing);
      final sent = server.where('POST', '/api/v1/auth/google').single;
      expect(jsonDecode(sent.body), {'idToken': 'firebase-id-token'});
      expect(Session.token, 'jwt-new');
    });

    testWidgets('closing the account picker: no request, no error, buttons usable again', (tester) async {
      googleToken = () async => null;
      await pumpLogin(tester);
      await tapVisible(tester, googleButton);
      await tester.pumpAndSettle();
      expect(server.requests, isEmpty);
      expect(Session.token, isNull);
      expect(find.byType(CircularProgressIndicator), findsNothing);
      expect(tester.widget<OutlinedButton>(googleButton).onPressed, isNotNull);
      expect(find.textContaining('thất bại'), findsNothing);
    });

    testWidgets('while the account picker is open: spinner shown and Google button disabled', (tester) async {
      final picker = Completer<String?>();
      googleToken = () => picker.future;
      await pumpLogin(tester);
      await tapVisible(tester, googleButton);
      expect(tester.widget<OutlinedButton>(googleButton).onPressed, isNull);
      expect(find.byType(CircularProgressIndicator), findsOneWidget);
      picker.complete(null);
      await tester.pumpAndSettle();
      expect(tester.widget<OutlinedButton>(googleButton).onPressed, isNotNull);
    });

    testWidgets('server without Google support (404) and invalid token (401) show their own messages', (tester) async {
      await pumpLogin(tester);
      server.handler = (_) => jsonResponse(404, {'message': 'nope'});
      await tapVisible(tester, googleButton);
      await tester.pumpAndSettle();
      expect(find.text('Máy chủ chưa hỗ trợ đăng nhập Google'), findsOneWidget);

      server.handler = (_) => jsonResponse(401, {'message': 'bad'});
      await tapVisible(tester, googleButton);
      await tester.pumpAndSettle();
      expect(find.text('Máy chủ chưa hỗ trợ đăng nhập Google'), findsNothing);
      expect(find.text('Đăng nhập Google không hợp lệ'), findsOneWidget);
      expect(Session.token, isNull);
    });

    testWidgets('a non-citizen Google account is rejected and no session is stored', (tester) async {
      server.handler = (_) => jsonResponse(200, ok(role: 'admin'));
      await pumpLogin(tester);
      await tapVisible(tester, googleButton);
      await tester.pumpAndSettle();
      expect(find.text('Ứng dụng dành cho người dân'), findsOneWidget);
      expect(Session.token, isNull);
    });
  });

  group('register link', () {
    testWidgets('opens RegisterScreen on top and back returns to login', (tester) async {
      await pumpLogin(tester);
      await tapVisible(tester, registerLink);
      await tester.pumpAndSettle();
      expect(find.byType(RegisterScreen), findsOneWidget);
      expect(find.text('Tạo tài khoản'), findsOneWidget);

      await tester.pageBack();
      await tester.pumpAndSettle();
      expect(find.byType(RegisterScreen), findsNothing);
      expect(find.byType(LoginScreen), findsOneWidget);
    });

    testWidgets('RegisterScreen opened from login uses the same repository', (tester) async {
      await pumpLogin(tester);
      await tapVisible(tester, registerLink);
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextFormField).at(0), 'Trần Thị Bình');
      await tester.enterText(find.byType(TextFormField).at(1), 'binh@example.com');
      await tester.enterText(find.byType(TextFormField).at(2), '12345678');
      await tapVisible(tester, find.text('Tạo tài khoản'));
      await tester.pumpAndSettle();
      expect(server.where('POST', '/api/v1/auth/register'), hasLength(1));
      expect(Session.token, 'jwt-new');
    });
  });
}
