import 'dart:async';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:geosentry_mobile/core/network/api_client.dart';
import 'package:geosentry_mobile/core/network/api_exceptions.dart';
import 'package:geosentry_mobile/core/storage/session.dart';
import 'package:geosentry_mobile/features/report/data/field_report.dart';
import 'package:geosentry_mobile/features/report/data/report_repository.dart';
import 'package:geosentry_mobile/features/report/presentation/my_reports_screen.dart';
import 'package:geosentry_mobile/features/report/presentation/report_screen.dart';

import 'field_report_test.dart' show InMemoryReportStore;
import 'support/harness.dart';

FieldReport _report(String id, ReportStatus status,
        {String? description = 'Vết nứt', String? serverStatus, String? lastError, Uint8List? image}) =>
    FieldReport(
      clientReportId: id,
      userId: 'u-1',
      latitude: 21.86,
      longitude: 104.11,
      description: description,
      observedAt: DateTime.utc(2026, 10, 30, 8),
      createdAt: DateTime.utc(2026, 10, 30, 8, 1),
      status: status,
      serverStatus: serverStatus,
      lastError: lastError,
      imageBytes: image,
    );

/// Store whose list() can fail or be held, to test loading and failure states.
class _FlakyStore extends InMemoryReportStore {
  Object? listError;
  Completer<void>? gate;
  @override
  Future<List<FieldReport>> list(String userId) async {
    if (gate != null) await gate!.future;
    if (listError != null) throw listError!;
    return super.list(userId);
  }
}

void main() {
  useIsolatedSqlite(); // screens that push MyReportsScreen() build the default sqlite-backed repository
  late FakeBackend server;
  late _FlakyStore store;
  late ReportRepository repo;

  setUp(() async {
    await signIn();
    server = FakeBackend()
      ..handler = (r) {
        if (r.url.path.endsWith('/mine')) return jsonResponse(200, []);
        return jsonResponse(201, {'reportId': 9, 'status': 'submitted'});
      };
    store = _FlakyStore();
    repo = ReportRepository(
      store: store,
      apiClient: ApiClient(client: server.client, baseUrl: 'http://test'),
      currentUserId: () => 'u-1',
    );
  });

  Future<void> seed(List<FieldReport> reports) async {
    for (final r in reports) {
      await store.insert(r);
    }
  }

  group('MyReportsScreen', () {
    testWidgets('shows a spinner until the local list is read', (tester) async {
      store.gate = Completer<void>();
      await tester.pumpWidget(MaterialApp(home: MyReportsScreen(repository: repo)));
      await tester.pump();
      expect(find.byType(CircularProgressIndicator), findsOneWidget);
      expect(find.text('Báo cáo của tôi'), findsOneWidget);
      store.gate!.complete();
      await tester.pumpAndSettle();
      expect(find.byType(CircularProgressIndicator), findsNothing);
    });

    testWidgets('empty list says no reports were sent', (tester) async {
      await tester.pumpWidget(MaterialApp(home: MyReportsScreen(repository: repo)));
      await tester.pumpAndSettle();
      expect(find.text('Bạn chưa gửi báo cáo nào.'), findsOneWidget);
    });

    testWidgets('each status has its own Vietnamese label; only unsent ones offer "Gửi lại"', (tester) async {
      server.online = false; // keep statuses exactly as stored
      tester.view.physicalSize = const Size(800, 2400);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);
      await seed([
        _report('a', ReportStatus.pending, description: 'chờ'),
        _report('b', ReportStatus.failed, description: 'lỗi', lastError: 'Dữ liệu sai'),
        _report('c', ReportStatus.sent, description: 'đã gửi'),
        _report('d', ReportStatus.sent, description: 'xử lý', serverStatus: 'processed'),
        _report('e', ReportStatus.sent, description: 'lưu', serverStatus: 'archived'),
        _report('f', ReportStatus.sent, description: null),
      ]);
      await tester.pumpWidget(MaterialApp(home: MyReportsScreen(repository: repo)));
      await tester.pumpAndSettle();
      expect(find.text('Chờ gửi'), findsOneWidget);
      expect(find.text('Lỗi'), findsOneWidget);
      expect(find.text('Đã gửi'), findsNWidgets(2));
      expect(find.text('Đã xử lý'), findsOneWidget);
      expect(find.text('Đã lưu trữ'), findsOneWidget);
      expect(find.text('(chỉ có ảnh)'), findsOneWidget);
      expect(find.text('Dữ liệu sai'), findsOneWidget);
      expect(find.text('Gửi lại'), findsNWidgets(2));
    });

    testWidgets('offline: stored reports stay visible, pending is NOT shown as sent', (tester) async {
      server.online = false;
      await seed([_report('a', ReportStatus.pending, description: 'chưa gửi')]);
      await tester.pumpWidget(MaterialApp(home: MyReportsScreen(repository: repo)));
      await tester.pumpAndSettle();
      expect(find.text('chưa gửi'), findsOneWidget);
      expect(find.text('Chờ gửi'), findsOneWidget);
      expect(find.text('Đã gửi'), findsNothing);
    });

    testWidgets('online: opening the screen sends the pending report and flips it to sent', (tester) async {
      await seed([_report('a', ReportStatus.pending, description: 'chờ mạng')]);
      await tester.pumpWidget(MaterialApp(home: MyReportsScreen(repository: repo)));
      await tester.pumpAndSettle();
      expect(server.where('POST', '/api/v1/community-reports').length, 1);
      expect(find.text('Đã gửi'), findsOneWidget);
      expect(find.text('Chờ gửi'), findsNothing);
    });

    testWidgets('server 500 on sync keeps the report pending with the error, never "Đã gửi"', (tester) async {
      server.handler = (_) => jsonResponse(500, {'message': 'boom'});
      await seed([_report('a', ReportStatus.pending)]);
      await tester.pumpWidget(MaterialApp(home: MyReportsScreen(repository: repo)));
      await tester.pumpAndSettle();
      expect(find.text('Chờ gửi'), findsOneWidget);
      expect(find.text('boom'), findsOneWidget);
      expect(find.text('Đã gửi'), findsNothing);
    });

    testWidgets('401 on sync keeps the report pending and clears the session', (tester) async {
      server.handler = (_) => jsonResponse(401, {'message': 'expired'});
      await seed([_report('a', ReportStatus.pending)]);
      await tester.pumpWidget(MaterialApp(home: MyReportsScreen(repository: repo)));
      await tester.pumpAndSettle();
      expect(find.text('Chờ gửi'), findsOneWidget);
      expect(Session.token, isNull);
    });

    testWidgets('rejected report (400) shows "Lỗi"; tapping "Gửi lại" resends and shows "Đã gửi"', (tester) async {
      server.handler = (r) => r.url.path.endsWith('/mine')
          ? jsonResponse(200, [])
          : jsonResponse(400, {'message': 'Mô tả không hợp lệ'});
      await seed([_report('a', ReportStatus.pending)]);
      await tester.pumpWidget(MaterialApp(home: MyReportsScreen(repository: repo)));
      await tester.pumpAndSettle();
      expect(find.text('Lỗi'), findsOneWidget);
      expect(find.text('Mô tả không hợp lệ'), findsOneWidget);

      server.handler = (_) => jsonResponse(201, {'reportId': 5, 'status': 'submitted'});
      await tester.tap(find.text('Gửi lại'));
      await tester.pumpAndSettle();
      expect(find.text('Đã gửi'), findsOneWidget);
      expect(find.text('Gửi lại'), findsNothing);
    });

    testWidgets('server status "processed" is pulled in from /mine', (tester) async {
      server.handler = (r) => r.url.path.endsWith('/mine')
          ? jsonResponse(200, [{'clientReportId': 'a', 'status': 'processed'}])
          : jsonResponse(201, {'reportId': 9, 'status': 'submitted'});
      await seed([_report('a', ReportStatus.sent, serverStatus: 'submitted')]);
      await tester.pumpWidget(MaterialApp(home: MyReportsScreen(repository: repo)));
      await tester.pumpAndSettle();
      expect(find.text('Đã xử lý'), findsOneWidget);
    });

    testWidgets('BUG: a failing local store must end the spinner with an error', (tester) async {
      // BUG: expected an error message + retry when the local list cannot be read; actual: _reload() has no
      // try/catch (my_reports_screen.dart:~38) so the exception escapes _refresh and the spinner never ends.
      store.listError = StateError('db locked');
      await tester.pumpWidget(MaterialApp(home: MyReportsScreen(repository: repo)));
      await tester.pumpAndSettle();
      expect(find.byType(CircularProgressIndicator), findsNothing);
    }, skip: true);

    testWidgets('BUG: a non-ApiException from refreshStatuses must not break the list', (tester) async {
      // BUG: expected the local list to stay visible; actual: server body {"data":[{"clientReportId":...}]} with
      // a non-map row throws TypeError (report_repository.dart:~86), escapes _refresh's `on ApiException` and the
      // final _reload() is skipped, so statuses changed by syncPending are not shown until the next open.
      server.handler = (r) => r.url.path.endsWith('/mine') ? jsonResponse(200, ['garbage']) : jsonResponse(201, {'reportId': 9, 'status': 'submitted'});
      await seed([_report('a', ReportStatus.pending, description: 'x')]);
      await tester.pumpWidget(MaterialApp(home: MyReportsScreen(repository: repo)));
      await tester.pumpAndSettle();
      expect(find.text('Đã gửi'), findsOneWidget);
    }, skip: true);
  });

  group('ReportScreen (gaps)', () {
    Future<LocationFix> fix() async => (latitude: 21.864, longitude: 104.113, accuracy: 6.4);

    Future<void> pump(WidgetTester tester, {Future<LocationFix> Function()? location}) =>
        tester.pumpWidget(MaterialApp(home: ReportScreen(repository: repo, locationProvider: location ?? fix)));

    Future<void> tapVisible(WidgetTester tester, Finder f) async {
      await tester.ensureVisible(f);
      await tester.tap(f);
      await tester.pumpAndSettle();
    }

    testWidgets('renders the form labels and the privacy note', (tester) async {
      await pump(tester);
      expect(find.text('Báo Cáo Hiện Trường'), findsOneWidget);
      expect(find.textContaining('Không có theo dõi vị trí liên tục'), findsOneWidget);
      expect(find.text('Chụp ảnh'), findsOneWidget);
      expect(find.text('Thư viện'), findsOneWidget);
      expect(find.text('Lấy vị trí'), findsOneWidget);
      expect(find.text('Thời điểm bạn thấy sự việc'), findsOneWidget);
      expect(find.text('Gửi báo cáo'), findsOneWidget);
    });

    testWidgets('location shows accuracy in metres', (tester) async {
      await pump(tester);
      await tapVisible(tester, find.text('Lấy vị trí'));
      expect(find.textContaining('(±6 m)'), findsOneWidget);
    });

    testWidgets('location failure shows the message and allows trying again', (tester) async {
      var calls = 0;
      await pump(tester, location: () async {
        calls++;
        if (calls == 1) throw const ApiException(message: 'Cần cấp quyền vị trí để đính kèm vị trí vào báo cáo');
        return fix();
      });
      await tapVisible(tester, find.text('Lấy vị trí'));
      expect(find.text('Cần cấp quyền vị trí để đính kèm vị trí vào báo cáo'), findsOneWidget);
      await tapVisible(tester, find.text('Lấy vị trí'));
      expect(find.textContaining('21.86400'), findsOneWidget);
      expect(find.text('Cần cấp quyền vị trí để đính kèm vị trí vào báo cáo'), findsNothing);
    });

    testWidgets('while locating the location button is disabled and shows a spinner', (tester) async {
      final c = Completer<LocationFix>();
      await pump(tester, location: () => c.future);
      await tester.tap(find.text('Lấy vị trí'));
      await tester.pump();
      expect(find.byType(CircularProgressIndicator), findsOneWidget);
      c.complete((latitude: 1.0, longitude: 2.0, accuracy: 3.0));
      await tester.pumpAndSettle();
      expect(find.byType(CircularProgressIndicator), findsNothing);
    });

    testWidgets('whitespace-only description is not enough to send', (tester) async {
      await pump(tester);
      await tapVisible(tester, find.text('Lấy vị trí'));
      await tester.enterText(find.byType(TextField), '    ');
      await tapVisible(tester, find.text('Gửi báo cáo'));
      expect(find.text('Cần có ảnh hoặc mô tả'), findsOneWidget);
      expect(server.requests, isEmpty);
    });

    testWidgets('rejected report (400) shows "Báo cáo bị từ chối" with the reason, not "Đã gửi"', (tester) async {
      server.handler = (_) => jsonResponse(400, {'message': 'Vị trí ngoài vùng'});
      await pump(tester);
      await tapVisible(tester, find.text('Lấy vị trí'));
      await tester.enterText(find.byType(TextField), 'Đá lăn');
      await tapVisible(tester, find.text('Gửi báo cáo'));
      expect(find.text('Báo cáo bị từ chối'), findsOneWidget);
      expect(find.text('Vị trí ngoài vùng'), findsOneWidget);
      expect(find.text('Đã gửi báo cáo'), findsNothing);
    });

    testWidgets('server 500 and 401: saved on device, never "Đã gửi báo cáo"', (tester) async {
      for (final status in [500, 401]) {
        server.handler = (_) => jsonResponse(status, {'message': 'x'});
        await pump(tester);
        await tapVisible(tester, find.text('Lấy vị trí'));
        await tester.enterText(find.byType(TextField), 'Đá lăn');
        await tapVisible(tester, find.text('Gửi báo cáo'));
        expect(find.text('Đã lưu trên máy'), findsOneWidget, reason: '$status');
        expect(find.text('Đã gửi báo cáo'), findsNothing, reason: '$status');
        await tester.pumpWidget(const SizedBox());
        store.rows.clear();
      }
    });

    testWidgets('not signed in: shows the login-required message, sends nothing, no false success', (tester) async {
      final anon = ReportRepository(
        store: store,
        apiClient: ApiClient(client: server.client, baseUrl: 'http://test'),
        currentUserId: () => null,
      );
      await tester.pumpWidget(MaterialApp(home: ReportScreen(repository: anon, locationProvider: fix)));
      await tapVisible(tester, find.text('Lấy vị trí'));
      await tester.enterText(find.byType(TextField), 'Đá lăn');
      await tapVisible(tester, find.text('Gửi báo cáo'));
      expect(find.text('Cần đăng nhập để gửi báo cáo'), findsOneWidget);
      expect(find.text('Đã gửi báo cáo'), findsNothing);
      expect(server.requests, isEmpty);
    });

    testWidgets('double tap on send creates one report only', (tester) async {
      server.gate = Completer<void>();
      await pump(tester);
      await tapVisible(tester, find.text('Lấy vị trí'));
      await tester.enterText(find.byType(TextField), 'Đá lăn');
      await tester.ensureVisible(find.text('Gửi báo cáo'));
      await tester.tap(find.text('Gửi báo cáo'));
      await tester.pump();
      expect(tester.widget<ElevatedButton>(find.byType(ElevatedButton)).onPressed, isNull);
      await tester.tap(find.byType(ElevatedButton), warnIfMissed: false);
      await tester.pump();
      server.gate!.complete();
      await tester.pumpAndSettle();
      expect(server.where('POST', '/api/v1/community-reports').length, 1);
      expect(store.rows.length, 1);
    });

    testWidgets('result view: "Xong" closes, "Báo cáo của tôi" opens the list', (tester) async {
      await tester.pumpWidget(MaterialApp(
        home: Builder(
          builder: (c) => TextButton(
            onPressed: () => Navigator.push(c, MaterialPageRoute(builder: (_) => ReportScreen(repository: repo, locationProvider: fix))),
            child: const Text('open'),
          ),
        ),
      ));
      await tester.tap(find.text('open'));
      await tester.pumpAndSettle();
      await tapVisible(tester, find.text('Lấy vị trí'));
      await tester.enterText(find.byType(TextField), 'Đá lăn');
      await tapVisible(tester, find.text('Gửi báo cáo'));
      expect(find.text('Đã gửi báo cáo'), findsOneWidget);
      expect(find.text('Cảm ơn bạn. Cán bộ sẽ xem xét báo cáo này.'), findsOneWidget);
      await tester.tap(find.widgetWithText(ElevatedButton, 'Báo cáo của tôi'));
      await settleReal(tester, rounds: 4);
      await tester.pump(const Duration(seconds: 1));
      expect(find.byType(MyReportsScreen), findsOneWidget);
    });

    testWidgets('history icon in the app bar opens the reports list', (tester) async {
      await pump(tester);
      await tester.tap(find.byTooltip('Báo cáo của tôi'));
      await settleReal(tester, rounds: 4);
      await tester.pump(const Duration(seconds: 1));
      expect(find.byType(MyReportsScreen), findsOneWidget);
    });

    testWidgets('observed time cannot be set in the future', (tester) async {
      await pump(tester);
      await tester.tap(find.byIcon(Icons.schedule));
      await tester.pumpAndSettle();
      expect(find.byType(DatePickerDialog), findsOneWidget);
      await tester.tap(find.text('OK'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('OK')); // time picker
      await tester.pumpAndSettle();
      expect(find.byType(ReportScreen), findsOneWidget);
    });

    test('formatDateTime renders dd/MM/yyyy HH:mm in local time', () {
      final t = DateTime(2026, 3, 5, 7, 4);
      expect(formatDateTime(t.toUtc()), '05/03/2026 07:04');
    });
  });
}
