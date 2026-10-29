import 'dart:convert';
import 'dart:typed_data';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:geosentry_mobile/core/network/api_client.dart';
import 'package:geosentry_mobile/core/storage/session.dart';
import 'package:geosentry_mobile/features/auth/data/auth_models.dart';
import 'package:geosentry_mobile/features/report/data/field_report.dart';
import 'package:geosentry_mobile/features/report/data/report_repository.dart';
import 'package:geosentry_mobile/features/report/data/report_store.dart';

class InMemoryReportStore implements ReportStore {
  final rows = <FieldReport>[];
  var _nextId = 1;

  @override
  Future<FieldReport> insert(FieldReport report) async {
    final saved = report.copyWith(id: _nextId++);
    rows.add(saved);
    return saved;
  }

  @override
  Future<void> update(FieldReport report) async {
    rows[rows.indexWhere((r) => r.id == report.id)] = report;
  }

  @override
  Future<List<FieldReport>> list(String userId) async =>
      rows.where((r) => r.userId == userId).toList().reversed.toList();
}

/// Máy chủ giả: ghi lại các yêu cầu và trả kết quả theo kịch bản
class FakeServer {
  final requests = <http.Request>[];
  var online = true;
  http.Response Function(http.Request)? reportReply;

  http.Client get client => MockClient((r) async {
        requests.add(r);
        if (!online) throw Exception('no route to host');
        if (r.url.path.endsWith('/photos')) return _json(200, {'photoId': 'photo-1', 'imageUrl': '/p/photo-1'});
        if (r.url.path.endsWith('/mine')) return _json(200, [{'clientReportId': _lastClientId, 'status': 'processed'}]);
        if (reportReply != null) return reportReply!(r);
        return _json(201, {'reportId': 42, 'status': 'submitted'});
      });

  String get _lastClientId =>
      jsonDecode(requests.lastWhere((r) => r.url.path == '/api/v1/community-reports' && r.method == 'POST').body)['clientReportId'] as String;

  List<http.Request> get posts => requests.where((r) => r.url.path == '/api/v1/community-reports').toList();
  List<http.Request> get uploads => requests.where((r) => r.url.path.endsWith('/photos')).toList();
}

http.Response _json(int status, Object body) =>
    http.Response(jsonEncode(body), status, headers: {'content-type': 'application/json'});

void main() {
  late InMemoryReportStore store;
  late FakeServer server;
  late ReportRepository repo;
  String? userId = 'u-1';

  ReportRepository build() => ReportRepository(
        store: store,
        apiClient: ApiClient(client: server.client, baseUrl: 'http://test'),
        currentUserId: () => userId,
      );

  Future<FieldReport> submit({Uint8List? image}) => repo.submit(
        latitude: 21.864,
        longitude: 104.113,
        accuracyM: 8,
        description: ' Đất đá tràn xuống đường ',
        observedAt: DateTime.utc(2026, 10, 30, 8),
        imageBytes: image,
      );

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    await Session.save('jwt-1', const UserProfile(userId: 'u-1', fullName: 'An', email: 'a@b.c', role: 'citizen'));
    store = InMemoryReportStore();
    server = FakeServer();
    userId = 'u-1';
    repo = build();
  });

  test('client report ids are valid, unique version-4 UUIDs', () {
    final ids = {for (var i = 0; i < 50; i++) newClientReportId()};
    expect(ids.length, 50);
    final v4 = RegExp(r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$');
    expect(ids.every(v4.hasMatch), isTrue);
  });

  test('online: uploads the photo then posts the report with event time in UTC and marks it sent', () async {
    final result = await submit(image: Uint8List.fromList([0xFF, 0xD8, 0xFF, 1, 2]));
    expect(result.status, ReportStatus.sent);
    expect(result.serverReportId, 42);
    expect(server.uploads.length, 1);
    final body = jsonDecode(server.posts.single.body) as Map<String, dynamic>;
    expect(body['clientReportId'], result.clientReportId);
    expect(body['photoId'], 'photo-1');
    expect(body['description'], 'Đất đá tràn xuống đường'); // đã cắt khoảng trắng
    expect(body['observedAt'], '2026-10-30T08:00:00.000Z');
    expect(body['accuracyM'], 8);
    expect(server.posts.single.headers['Authorization'], 'Bearer jwt-1');
  });

  test('offline: nothing is lost, and the retry reuses the same id and does not duplicate', () async {
    server.online = false;
    final queued = await submit(image: Uint8List.fromList([0xFF, 0xD8, 0xFF, 1]));
    expect(queued.status, ReportStatus.pending);
    expect((await repo.list()).single.imageBytes, isNotNull);

    server.online = true;
    expect(await repo.syncPending(), 1);
    final sent = (await repo.list()).single;
    expect(sent.status, ReportStatus.sent);
    expect(sent.clientReportId, queued.clientReportId); // cùng ID: server không tạo bản trùng
    expect(await repo.syncPending(), 0); // đã gửi thì không gửi lại
  });

  test('a photo that was already uploaded is not uploaded again on retry', () async {
    // lần 1: tải ảnh được nhưng tạo báo cáo thì mất mạng giữa chừng
    var calls = 0;
    server.reportReply = (r) => ++calls == 1 ? _json(503, {'message': 'down'}) : _json(201, {'reportId': 7, 'status': 'submitted'});
    final first = await submit(image: Uint8List.fromList([0xFF, 0xD8, 0xFF, 1]));
    expect(first.status, ReportStatus.pending);
    expect(first.photoId, 'photo-1');
    await repo.syncPending();
    expect(server.uploads.length, 1);
    expect((await repo.list()).single.status, ReportStatus.sent);
  });

  test('a rejected report (400) becomes failed with the reason and is not retried automatically', () async {
    server.reportReply = (_) => _json(400, {'message': 'observedAt is in the future'});
    final result = await submit();
    expect(result.status, ReportStatus.failed);
    expect(result.lastError, 'observedAt is in the future');
    final before = server.posts.length;
    expect(await repo.syncPending(), 0);
    expect(server.posts.length, before);

    server.reportReply = null;
    final retried = await repo.retry(result);
    expect(retried.status, ReportStatus.sent);
    expect(retried.clientReportId, result.clientReportId);
  });

  test('server errors and an expired session keep the report pending', () async {
    server.reportReply = (_) => _json(500, {'message': 'boom'});
    expect((await submit()).status, ReportStatus.pending);
    server.reportReply = (_) => _json(401, {'message': 'expired'});
    final r = await submit();
    expect(r.status, ReportStatus.pending);
  });

  test('syncing stops at the first network failure instead of timing out on every report', () async {
    server.online = false;
    await submit();
    await submit();
    await submit();
    server.requests.clear();
    expect(await repo.syncPending(), 0);
    expect(server.requests.length, 1);
  });

  test('only the signed-in user\'s reports are sent', () async {
    server.online = false;
    await submit();
    server.online = true;
    server.requests.clear();
    userId = 'someone-else';
    repo = build();
    expect(await repo.syncPending(), 0);
    expect(server.posts, isEmpty);
    userId = null;
    expect(await build().syncPending(), 0);
  });

  test('refreshStatuses copies the server status onto sent reports', () async {
    final sent = await submit();
    expect(sent.serverStatus, 'submitted');
    await repo.refreshStatuses();
    expect((await repo.list()).single.serverStatus, 'processed');
    expect(await repo.sentCount(), 1);
  });
}
