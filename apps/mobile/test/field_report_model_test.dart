import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:geosentry_mobile/features/report/data/field_report.dart';

FieldReport _full() => FieldReport(
      id: 7,
      clientReportId: 'c-1',
      userId: 'u-1',
      latitude: 21.864,
      longitude: 104.113,
      accuracyM: 6.5,
      description: 'Vết nứt',
      observedAt: DateTime.utc(2026, 10, 30, 8),
      createdAt: DateTime.utc(2026, 10, 30, 8, 5),
      imageBytes: Uint8List.fromList([1, 2, 3]),
      photoId: 'p-1',
      status: ReportStatus.sent,
      serverReportId: 42,
      serverStatus: 'processed',
      lastError: 'x',
    );

Map<String, Object?> _row([Map<String, Object?> override = const {}]) => {
      'id': 1,
      'client_report_id': 'c-1',
      'user_id': 'u-1',
      'latitude': 21.0,
      'longitude': 104.0,
      'observed_at': '2026-10-30T08:00:00.000Z',
      'created_at': '2026-10-30T08:05:00.000Z',
      'status': 'pending',
      ...override,
    };

void main() {
  group('FieldReport serialisation', () {
    test('toMap -> fromMap keeps every field (id lives in the table, not in the map)', () {
      final back = FieldReport.fromMap(_full().toMap());
      final original = _full();
      expect(back.id, isNull);
      expect(back.clientReportId, original.clientReportId);
      expect(back.userId, original.userId);
      expect((back.latitude, back.longitude, back.accuracyM), (21.864, 104.113, 6.5));
      expect(back.description, 'Vết nứt');
      expect(back.observedAt, original.observedAt);
      expect(back.createdAt, original.createdAt);
      expect(back.imageBytes, [1, 2, 3]);
      expect((back.photoId, back.status, back.serverReportId, back.serverStatus, back.lastError), ('p-1', ReportStatus.sent, 42, 'processed', 'x'));
    });

    test('times are written as UTC ISO strings even for local DateTimes', () {
      final local = DateTime(2026, 10, 30, 15, 0); // local wall clock
      final map = FieldReport(
        clientReportId: 'c',
        userId: 'u',
        latitude: 0,
        longitude: 0,
        observedAt: local,
        createdAt: local,
      ).toMap();
      expect((map['observed_at'] as String).endsWith('Z'), isTrue);
      expect(DateTime.parse(map['observed_at'] as String), local.toUtc());
    });

    test('minimal row: nullable fields stay null, status defaults to pending', () {
      final r = FieldReport.fromMap(_row({'status': null}));
      expect([r.accuracyM, r.description, r.imageBytes, r.photoId, r.serverReportId, r.serverStatus, r.lastError], everyElement(isNull));
      expect(r.status, ReportStatus.pending);
      expect(r.id, 1);
    });

    test('integer coordinates from SQLite (num) become doubles', () {
      final r = FieldReport.fromMap(_row({'latitude': 21, 'longitude': 104, 'accuracy_m': 5}));
      expect((r.latitude, r.longitude, r.accuracyM), (21.0, 104.0, 5.0));
    });

    test('unknown status text falls back to pending (so it is retried, not shown as sent)', () {
      expect(FieldReport.fromMap(_row({'status': 'archived-by-alien'})).status, ReportStatus.pending);
      expect(FieldReport.fromMap(_row({'status': 'sent'})).status, ReportStatus.sent);
      expect(FieldReport.fromMap(_row({'status': 'failed'})).status, ReportStatus.failed);
    });

    test('every ReportStatus survives a round trip', () {
      for (final s in ReportStatus.values) {
        expect(FieldReport.fromMap(_full().copyWith(status: s).toMap()).status, s);
      }
    });

    test('malformed rows throw instead of producing a half-valid report', () {
      expect(() => FieldReport.fromMap(_row({'observed_at': 'yesterday'})), throwsFormatException);
      expect(() => FieldReport.fromMap(_row({'created_at': null})), throwsA(isA<TypeError>()));
      expect(() => FieldReport.fromMap(_row({'latitude': null})), throwsA(isA<TypeError>()));
      expect(() => FieldReport.fromMap(_row({'latitude': 'abc'})), throwsA(isA<TypeError>()));
      expect(() => FieldReport.fromMap(_row({'client_report_id': null})), throwsA(isA<TypeError>()));
      expect(() => FieldReport.fromMap(_row({'user_id': 5})), throwsA(isA<TypeError>()));
    });

    test('BUG: one malformed stored row must not be able to hide the whole list', () {
      // BUG: expected a tolerant parser (skip/flag the bad row); actual: fromMap throws, and
      // SqliteReportStore.list() (report_store.dart:~37) maps all rows with it, so a single corrupt
      // row makes "Báo cáo của tôi" fail for every report.
      final rows = [_row(), _row({'observed_at': 'garbage'})];
      expect(() => rows.map(FieldReport.fromMap).toList(), returnsNormally);
    }, skip: true);
  });

  group('FieldReport.copyWith', () {
    test('changes only what is passed', () {
      final c = _full().copyWith(status: ReportStatus.failed, lastError: 'nope');
      expect((c.status, c.lastError, c.id, c.photoId, c.serverStatus), (ReportStatus.failed, 'nope', 7, 'p-1', 'processed'));
      expect((c.latitude, c.description, c.clientReportId), (21.864, 'Vết nứt', 'c-1'));
    });

    test('clearError removes the error even when a new one is passed', () {
      expect(_full().copyWith(clearError: true).lastError, isNull);
      expect(_full().copyWith(clearError: true, lastError: 'z').lastError, isNull);
    });

    test('a null argument keeps the old value (cannot clear photoId/serverStatus)', () {
      expect(_full().copyWith(photoId: null).photoId, 'p-1');
    });
  });

  group('newClientReportId', () {
    test('has the canonical 36-char shape', () {
      final id = newClientReportId();
      expect(id.length, 36);
      expect(RegExp(r'^[0-9a-f-]{36}$').hasMatch(id), isTrue);
    });
  });
}
