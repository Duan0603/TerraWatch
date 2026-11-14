import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';
import 'package:geosentry_mobile/core/storage/session.dart';
import 'package:geosentry_mobile/features/auth/data/auth_models.dart';

/// Shared fakes for the screen tests. No test here may reach the real network:
/// every `http.Client()` created inside [withFakeHttp] is a [MockClient].

const citizenJson = {
  'userId': 'u-1',
  'fullName': 'Nguyễn Văn An',
  'email': 'an@example.com',
  'role': 'citizen',
  'phoneNumber': null,
  'authProvider': 'email',
};

UserProfile citizen([Map<String, dynamic> extra = const {}]) => UserProfile.fromJson({...citizenJson, ...extra});

http.Response jsonResponse(int status, Object body) =>
    http.Response(jsonEncode(body), status, headers: {'content-type': 'application/json'});

/// Scripted server. Set [handler]; set [online] false to simulate no route to host.
class FakeBackend {
  bool online = true;
  final requests = <http.Request>[];
  http.Response Function(http.Request request) handler = (_) => http.Response('', 404);
  Completer<void>? gate; // when set, responses wait until it completes

  http.Client get client => MockClient((r) async {
        requests.add(r);
        if (gate != null) await gate!.future;
        if (!online) throw const SocketException('no route to host');
        return handler(r);
      });

  Iterable<http.Request> where(String method, String path) =>
      requests.where((r) => r.method == method && r.url.path == path);
}

/// Runs [body] so that any `http.Client()` built in it (default ApiClient) talks to [backend].
Future<T> withFakeHttp<T>(FakeBackend backend, Future<T> Function() body) =>
    http.runWithClient(body, () => backend.client);

/// testWidgets whose body runs inside [withFakeHttp]. [skip] is bool in flutter_test: put the BUG text in the name/comment.
void testScreen(String name, FakeBackend Function() backend, Future<void> Function(WidgetTester tester) body,
    {bool skip = false}) {
  testWidgets(name, (tester) => withFakeHttp(backend(), () => body(tester)), skip: skip);
}

/// Let real async work (sqflite ffi isolate) finish, then rebuild. Fake-async pump alone never sees it.
Future<void> settleReal(WidgetTester tester, {int rounds = 3}) async {
  for (var i = 0; i < rounds; i++) {
    await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 30)));
    await tester.pump();
  }
}

String? _dbDir;

/// SQLite via ffi in a private temp directory so parallel test files never share a database file.
void useIsolatedSqlite() {
  sqfliteFfiInit();
  databaseFactory = databaseFactoryFfi;
  setUpAll(() async {
    _dbDir = Directory.systemTemp.createTempSync('terrawatch_db_').path;
    await databaseFactoryFfi.setDatabasesPath(_dbDir!);
  });
  tearDownAll(() {
    try {
      Directory(_dbDir!).deleteSync(recursive: true);
    } catch (_) {}
  });
}

Future<void> signIn([UserProfile? user]) async {
  SharedPreferences.setMockInitialValues({});
  await Session.save('jwt-1', user ?? citizen());
}

Future<void> signOutForTest() async {
  SharedPreferences.setMockInitialValues({});
  await Session.clear();
}
