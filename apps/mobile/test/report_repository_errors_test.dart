import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:geosentry_mobile/core/network/api_client.dart';
import 'package:geosentry_mobile/core/network/api_exceptions.dart';
import 'package:geosentry_mobile/core/storage/session.dart';
import 'package:geosentry_mobile/features/auth/data/auth_models.dart';
import 'package:geosentry_mobile/features/report/data/field_report.dart';
import 'package:geosentry_mobile/features/report/data/report_repository.dart';

import 'field_report_test.dart' show InMemoryReportStore;

// Target: lib/features/report/data/report_repository.dart error mapping, on an in-memory store.
// Covers MD-RPT-004, 005, 006, 007, 008, 009. MD-RPT-010 (OS permission) does not apply: the repository never asks one;
// the location permission lives in report_screen and is asserted in reports_screens_test.
// Already asserted by field_report_test / reports_screens_test: online happy path with photo, 400 -> failed, 500 and 401 -> pending,
// offline queue + same id on retry, photo uploaded once.

http.Response _json(int status, Object body) => http.Response(jsonEncode(body), status, headers: {'content-type': 'application/json'});

void main() {
  late InMemoryReportStore store;
  late List<http.Request> requests;
  late http.Response Function(http.Request) reply;
  var online = true;
  String? userId = 'u-1';
  final image = Uint8List.fromList([0xFF, 0xD8, 0xFF, 1, 2, 3]);

  ReportRepository repo() => ReportRepository(
        store: store,
        apiClient: ApiClient(
          baseUrl: 'http://test',
          client: MockClient((r) async {
            requests.add(r);
            if (!online) throw http.ClientException('no route to host');
            return reply(r);
          }),
        ),
        currentUserId: () => userId,
      );

  Future<FieldReport> submit({String? description = 'Đá lăn', double? accuracy, Uint8List? img, DateTime? observed}) => repo().submit(
        latitude: 21.5,
        longitude: 104.5,
        accuracyM: accuracy,
        description: description,
        observedAt: observed ?? DateTime.utc(2026, 10, 30, 8),
        imageBytes: img,
      );

  Map<String, dynamic> body(http.Request r) => jsonDecode(r.body) as Map<String, dynamic>;

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    await Session.save('jwt-1', const UserProfile(userId: 'u-1', fullName: 'An', email: 'a@b.c', role: 'citizen'));
    store = InMemoryReportStore();
    requests = [];
    online = true;
    userId = 'u-1';
    reply = (r) => r.url.path.endsWith('/photos') ? _json(200, {'photoId': 'photo-1'}) : _json(201, {'reportId': 42, 'status': 'submitted'});
  });

  group('valid and missing data (MD-RPT-004, MD-RPT-005)', () {
    test('MD-RPT-004: the stored row and the request agree: trimmed text, UTC time, owner, coordinates; the id is a UUID v4', () async {
      final result = await submit(description: '  Vết nứt rộng  ', accuracy: 12.5, observed: DateTime.parse('2026-10-30T15:00:00+07:00'));
      final sent = body(requests.single);
      expect(sent['description'], 'Vết nứt rộng');
      expect(sent['observedAt'], '2026-10-30T08:00:00.000Z');
      expect((sent['latitude'], sent['longitude'], sent['accuracyM']), (21.5, 104.5, 12.5));
      expect(sent['clientReportId'], result.clientReportId);
      expect(RegExp(r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$').hasMatch(result.clientReportId), isTrue);
      expect((store.rows.single.userId, store.rows.single.status, store.rows.single.serverStatus), ('u-1', ReportStatus.sent, 'submitted'));
    });

    test('MD-RPT-005: a blank or null description is stored as null and left out of the request; so are a missing accuracy and photo', () async {
      for (final d in <String?>[null, '', '   \n\t']) {
        requests.clear();
        await submit(description: d, img: image);
        final sent = body(requests.last);
        expect(sent.containsKey('description'), isFalse, reason: 'description "$d"');
        expect(sent.containsKey('accuracyM'), isFalse);
      }
      expect(store.rows.every((r) => r.description == null), isTrue);
      requests.clear();
      await submit(description: 'x');
      expect(body(requests.single).containsKey('photoId'), isFalse, reason: 'no photo, no upload, no photoId');
    });

    test('MD-RPT-005: the server answer without reportId or status still marks the report sent, with null server fields', () async {
      reply = (_) => _json(201, {});
      final r = await submit();
      expect((r.status, r.serverReportId, r.serverStatus), (ReportStatus.sent, null, null));
    });

    test('MD-RPT-005: not signed in: submit throws the login message and stores nothing, requests nothing', () async {
      userId = null;
      await expectLater(submit(), throwsA(isA<ApiException>().having((e) => e.message, 'message', 'Cần đăng nhập để gửi báo cáo')));
      expect(store.rows, isEmpty);
      expect(requests, isEmpty);
      expect(() => repo().list(), throwsA(isA<ApiException>())); // list() throws synchronously when signed out
    });
  });

  group('malformed server answers (MD-RPT-006)', () {
    test('BUG: a created-report answer of the wrong type must leave the report queued, not throw out of submit', () async {
      // Expected: the report stays pending (or failed) in the queue and submit returns it.
      // Actual: created['reportId'] as int? throws a TypeError out of submit(); the caller sees a crash although the row is saved.
      reply = (_) => _json(201, {'reportId': 'forty-two', 'status': 'submitted'});
      final r = await submit();
      expect(r.status, isIn([ReportStatus.pending, ReportStatus.failed]));
    }, skip: 'BUG: expected a malformed 201 answer to keep the report queued and return it; '
        'actual: submit() throws TypeError (report_repository.dart _send: created[\'reportId\'] as int?) and the row stays pending with no error text.');

    test('BUG: a photo upload answer without photoId must leave the report queued, not throw out of submit', () async {
      reply = (r) => r.url.path.endsWith('/photos') ? _json(200, {'imageUrl': '/p/1'}) : _json(201, {'reportId': 1, 'status': 'submitted'});
      final r = await submit(img: image);
      expect(r.status, isIn([ReportStatus.pending, ReportStatus.failed]));
    }, skip: 'BUG: expected a photo answer without photoId to keep the report queued; '
        'actual: submit() throws TypeError (report_repository.dart _send: upload[\'photoId\'] as String).');

    test('a 200 answer that is not JSON keeps the report pending with the connection message (not sent)', () async {
      reply = (_) => http.Response('<html>captive portal</html>', 200);
      final r = await submit();
      expect(r.status, ReportStatus.pending);
      expect(r.lastError, contains('Không kết nối được máy chủ'));
      expect(store.rows.single.status, ReportStatus.pending);
    });
  });

  group('4xx classification (MD-RPT-007)', () {
    test('content errors fail the report for good, with the server message; 401, 408, 429 stay pending', () async {
      final cases = <(int, ReportStatus)>[
        (400, ReportStatus.failed),
        (404, ReportStatus.failed),
        (409, ReportStatus.failed),
        (413, ReportStatus.failed),
        (422, ReportStatus.failed),
        (403, ReportStatus.failed),
        (408, ReportStatus.pending),
        (429, ReportStatus.pending),
        (401, ReportStatus.pending),
      ];
      for (final (status, expected) in cases) {
        reply = (_) => _json(status, {'message': 'm$status'});
        final r = await submit();
        expect(r.status, expected, reason: '$status');
        if (status != 401 && status != 403) expect(r.lastError, 'm$status', reason: '$status');
        expect(store.rows.last.status, expected, reason: 'stored row for $status');
      }
    });

    test('401 and 403 keep their fixed Vietnamese messages as the reason; a 401 also clears the session', () async {
      reply = (_) => _json(403, {'message': 'x'});
      expect((await submit()).lastError, 'Không có quyền truy cập.');
      reply = (_) => _json(401, {'message': 'x'});
      expect((await submit()).lastError, 'Hết phiên đăng nhập. Vui lòng đăng nhập lại.');
      expect(Session.token, isNull);
    });

    test('a photo that the server refuses (413) fails the report without posting it, and the photo id stays unset', () async {
      reply = (r) => r.url.path.endsWith('/photos') ? _json(413, {'message': 'Ảnh quá lớn'}) : _json(201, {'reportId': 1, 'status': 'submitted'});
      final r = await submit(img: image);
      expect((r.status, r.lastError, r.photoId), (ReportStatus.failed, 'Ảnh quá lớn', null));
      expect(requests.where((q) => q.url.path == '/api/v1/community-reports'), isEmpty);
      expect(store.rows.single.imageBytes, image, reason: 'the photo stays on the device');
    });
  });

  group('5xx and no network (MD-RPT-008, MD-RPT-009)', () {
    test('MD-RPT-008: 500, 502 and 503 keep the report pending and the row (with its photo) in the store', () async {
      for (final status in [500, 502, 503]) {
        reply = (_) => _json(status, {'message': 'down $status'});
        final r = await submit(img: image);
        expect(r.status, ReportStatus.pending, reason: '$status');
        expect(r.lastError, isNotEmpty);
        expect(store.rows.last.imageBytes, image);
      }
      expect(store.rows, hasLength(3));
      expect(store.rows.map((r) => r.clientReportId).toSet(), hasLength(3), reason: 'one id per report');
    });

    test('MD-RPT-009: offline submit is pending with the connection message and is never reported as sent; the queue lists it', () async {
      online = false;
      final r = await submit();
      expect(r.status, ReportStatus.pending);
      expect(r.lastError, contains('Không kết nối được máy chủ'));
      expect(await repo().sentCount(), 0);
      expect((await repo().list()).single.status, ReportStatus.pending);
    });

    test('MD-RPT-009: refreshStatuses offline throws ApiException and leaves sent reports as they were', () async {
      final sent = await submit();
      online = false;
      await expectLater(repo().refreshStatuses(), throwsA(isA<ApiException>()));
      expect((await repo().list()).single.serverStatus, sent.serverStatus);
    });
  });
}
