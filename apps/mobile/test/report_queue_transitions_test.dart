import 'dart:async';
import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:geosentry_mobile/core/network/api_client.dart';
import 'package:geosentry_mobile/core/storage/session.dart';
import 'package:geosentry_mobile/features/report/data/field_report.dart';
import 'package:geosentry_mobile/features/report/data/report_repository.dart';

import 'field_report_test.dart' show InMemoryReportStore;

// Target: offline report queue state machine (ReportRepository + store). Each test names the ST-RPT rows it covers.
// Already asserted by field_report_test / reports_screens_test, not repeated:
//   ST-RPT-019 (pending + server accepts), 020 (400 -> failed, no auto retry), 021 (500), 022 (401), 023 (offline, stop at first),
//   025 (other account), 034 (sent + refresh), 040 (failed + resend keeps the id).
// Here: the rejected transitions (sent and failed are never touched by the automatic sync) and the manual "resend" outcomes.

http.Response _json(int status, Object body) => http.Response(jsonEncode(body), status, headers: {'content-type': 'application/json'});

void main() {
  late InMemoryReportStore store;
  late List<http.Request> posts;
  late http.Response Function(http.Request) reply;
  var online = true;
  String? userId = 'u-1';

  ReportRepository build() => ReportRepository(
        store: store,
        apiClient: ApiClient(
          baseUrl: 'http://test',
          client: MockClient((r) async {
            if (r.method == 'POST' && r.url.path == '/api/v1/community-reports') posts.add(r);
            if (!online) throw http.ClientException('no route to host');
            return reply(r);
          }),
        ),
        currentUserId: () => userId,
      );

  Future<FieldReport> seed(String id, ReportStatus status, {String owner = 'u-1', String? error, int? serverId, String? serverStatus}) =>
      store.insert(FieldReport(
        clientReportId: id,
        userId: owner,
        latitude: 21.0,
        longitude: 104.0,
        description: 'seed $id',
        observedAt: DateTime.utc(2026, 10, 30, 8),
        createdAt: DateTime.utc(2026, 10, 30, 8, 1),
        status: status,
        lastError: error,
        serverReportId: serverId,
        serverStatus: serverStatus,
      ));

  FieldReport stored(String id) => store.rows.firstWhere((r) => r.clientReportId == id);

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    await Session.clear(); // no bearer token, so a 401 cannot touch another test's session
    store = InMemoryReportStore();
    posts = [];
    online = true;
    userId = 'u-1';
    reply = (_) => _json(201, {'reportId': 77, 'status': 'submitted'});
  });

  group('automatic sync never touches sent or failed reports', () {
    test('ST-RPT-027..031: a sent report with any server event is not sent again and stays sent', () async {
      await seed('s', ReportStatus.sent, serverId: 5, serverStatus: 'submitted');
      for (final r in <http.Response Function(http.Request)>[
        (_) => _json(201, {'reportId': 99, 'status': 'submitted'}),
        (_) => _json(400, {'message': 'bad'}),
        (_) => _json(500, {'message': 'boom'}),
        (_) => _json(401, {'message': 'expired'}),
      ]) {
        reply = r;
        expect(await build().syncPending(), 0);
      }
      online = false;
      expect(await build().syncPending(), 0);
      expect(posts, isEmpty, reason: 'no request at all for a sent report');
      expect((stored('s').status, stored('s').serverReportId, stored('s').serverStatus), (ReportStatus.sent, 5, 'submitted'));
    });

    test('ST-RPT-035..039: a failed report is not retried by the sync even when the server would now accept, and keeps its reason', () async {
      await seed('f', ReportStatus.failed, error: 'observedAt is in the future');
      for (var round = 0; round < 3; round++) {
        reply = round == 0 ? (_) => _json(201, {'reportId': 1, 'status': 'submitted'}) : (_) => _json(500, {'message': 'boom'});
        expect(await build().syncPending(), 0);
      }
      online = false;
      expect(await build().syncPending(), 0);
      expect(posts, isEmpty);
      expect((stored('f').status, stored('f').lastError), (ReportStatus.failed, 'observedAt is in the future'));
    });

    test('ST-RPT-033, ST-RPT-041: sent and failed reports of a previous account are neither sent nor listed for the new account', () async {
      await seed('old-sent', ReportStatus.sent, owner: 'u-1');
      await seed('old-failed', ReportStatus.failed, owner: 'u-1', error: 'x');
      userId = 'u-2';
      final repo = build();
      expect(await repo.list(), isEmpty);
      expect(await repo.syncPending(), 0);
      expect(await repo.sentCount(), 0);
      expect(posts, isEmpty);
      expect(store.rows.map((r) => r.status), [ReportStatus.sent, ReportStatus.failed], reason: 'the first account\'s queue is kept untouched');
    });
  });

  group('manual resend (retry) outcomes', () {
    test('ST-RPT-024: resend on a pending report posts once with the same id and ends sent', () async {
      final p = await seed('p', ReportStatus.pending, error: 'Không kết nối được máy chủ');
      final result = await build().retry(p);
      expect((result.status, result.clientReportId, result.serverReportId), (ReportStatus.sent, 'p', 77));
      expect(result.lastError, isNull, reason: 'the old error is cleared once it is sent');
      expect(posts, hasLength(1));
      expect(jsonDecode(posts.single.body)['clientReportId'], 'p');
    });

    test('ST-RPT-032: resend on a sent report re-posts the same client id (server dedupes) and it stays sent', () async {
      final s = await seed('s', ReportStatus.sent, serverId: 5, serverStatus: 'processed');
      final result = await build().retry(s);
      expect(posts, hasLength(1));
      expect(jsonDecode(posts.single.body)['clientReportId'], 's');
      expect((result.status, result.serverReportId, result.serverStatus), (ReportStatus.sent, 77, 'submitted'));
    });

    test('ST-RPT-036: failed + resend + 400 again: still failed, with the new reason replacing the old one', () async {
      final f = await seed('f', ReportStatus.failed, error: 'old reason');
      reply = (_) => _json(400, {'message': 'new reason'});
      final result = await build().retry(f);
      expect((result.status, result.lastError), (ReportStatus.failed, 'new reason'));
      expect((stored('f').status, stored('f').lastError), (ReportStatus.failed, 'new reason'));
    });

    test('ST-RPT-037, ST-RPT-038, ST-RPT-039: failed + resend + 500 / 401 / offline: back to pending with the reason, so the sync will retry it', () async {
      for (final (label, response, isOnline) in <(String, http.Response Function(http.Request), bool)>[
        ('500', (_) => _json(500, {'message': 'boom'}), true),
        ('401', (_) => _json(401, {'message': 'expired'}), true),
        ('offline', (_) => _json(200, {}), false),
      ]) {
        store.rows.clear();
        final f = await seed('f-$label', ReportStatus.failed, error: 'old');
        reply = response;
        online = isOnline;
        final result = await build().retry(f);
        expect(result.status, ReportStatus.pending, reason: label);
        expect(result.lastError, isNot('old'), reason: '$label: the new error replaces the old one');
        expect(result.lastError, isNotEmpty, reason: label);
      }
    });

    test('ST-RPT-035: failed + resend + server accepts: sent, error cleared, and the sync no longer lists it as pending', () async {
      final f = await seed('f', ReportStatus.failed, error: 'old reason');
      final result = await build().retry(f);
      expect((result.status, result.serverReportId), (ReportStatus.sent, 77));
      expect(result.lastError, isNull);
      posts.clear();
      expect(await build().syncPending(), 0);
      expect(posts, isEmpty);
    });
  });

  group('refresh from the server on non-sent reports', () {
    http.Response mine(String clientId, String status) => _json(200, [
          {'clientReportId': clientId, 'status': status}
        ]);

    test('ST-RPT-026, ST-RPT-042: refresh copies the server status but never flips a pending or failed report to sent', () async {
      await seed('p', ReportStatus.pending);
      await seed('f', ReportStatus.failed, error: 'x');
      reply = (_) => _json(200, [
            {'clientReportId': 'p', 'status': 'processed'},
            {'clientReportId': 'f', 'status': 'archived'},
          ]);
      await build().refreshStatuses();
      expect((stored('p').status, stored('p').serverStatus), (ReportStatus.pending, 'processed'));
      expect((stored('f').status, stored('f').serverStatus, stored('f').lastError), (ReportStatus.failed, 'archived', 'x'));
    });

    test('a report the server does not list keeps its state, and a sent report with the same server status is unchanged', () async {
      await seed('p', ReportStatus.pending);
      await seed('s', ReportStatus.sent, serverId: 1, serverStatus: 'submitted');
      reply = (_) => mine('s', 'submitted');
      await build().refreshStatuses();
      expect(stored('p').status, ReportStatus.pending);
      expect(stored('p').serverStatus, isNull);
      expect(stored('s').serverStatus, 'submitted');
    });

    test('a non-list answer changes nothing', () async {
      await seed('s', ReportStatus.sent, serverId: 1, serverStatus: 'submitted');
      reply = (_) => _json(200, {'message': 'maintenance'});
      await build().refreshStatuses();
      expect(stored('s').serverStatus, 'submitted');
    });
  });

  group('concurrent sync', () {
    test('a second syncPending while one is running is rejected (returns 0) and the report is posted once', () async {
      await seed('p', ReportStatus.pending);
      final release = Completer<void>();
      final repo = ReportRepository(
        store: store,
        apiClient: ApiClient(
          baseUrl: 'http://test',
          client: MockClient((r) async {
            posts.add(r);
            await release.future;
            return _json(201, {'reportId': 77, 'status': 'submitted'});
          }),
        ),
        currentUserId: () => userId,
      );
      final first = repo.syncPending();
      while (posts.isEmpty) {
        await Future<void>.delayed(Duration.zero); // wait for the request itself, not for a fixed time
      }
      expect(await repo.syncPending(), 0, reason: 'overlapping run is rejected while the first one is in flight');
      release.complete();
      expect(await first, 1);
      expect(posts, hasLength(1));
      expect(stored('p').status, ReportStatus.sent);
      expect(await build().syncPending(), 0, reason: 'the guard is released afterwards');
    });
  });
}
