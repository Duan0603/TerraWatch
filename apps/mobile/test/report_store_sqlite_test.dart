import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:path/path.dart' as p;
import 'package:sqflite_common_ffi/sqflite_ffi.dart';
import 'package:geosentry_mobile/core/constants/app_constants.dart';
import 'package:geosentry_mobile/core/storage/local_storage.dart';
import 'package:geosentry_mobile/features/report/data/field_report.dart';
import 'package:geosentry_mobile/features/report/data/report_store.dart';

import 'support/harness.dart';

// Target: lib/features/report/data/report_store.dart (SqliteReportStore on a brand-new database file per test).
// Covers MD-RPT-011, MD-RPT-012, MD-RPT-013.
// Already asserted elsewhere: the toMap/fromMap mapping itself (field_report_model_test) and the queue logic on an
// in-memory store (field_report_test). The BUG "one corrupt row hides the whole list" is already a skipped test in
// field_report_model_test; here only the per-account isolation of a corrupt row is asserted.

FieldReport _report(String id, {String user = 'u-1', ReportStatus status = ReportStatus.pending, Uint8List? image, String? description = 'Vết nứt'}) =>
    FieldReport(
      clientReportId: id,
      userId: user,
      latitude: 21.864,
      longitude: 104.113,
      accuracyM: 6.5,
      description: description,
      observedAt: DateTime.utc(2026, 10, 30, 8),
      createdAt: DateTime.utc(2026, 10, 30, 8, 5),
      imageBytes: image,
      status: status,
    );

Future<void> _freshDatabase() async {
  final path = p.join(await databaseFactoryFfi.getDatabasesPath(), AppConstants.dbName);
  await (await LocalStorage.database).close();
  await databaseFactoryFfi.deleteDatabase(path);
}

void main() {
  useIsolatedSqlite();
  final store = SqliteReportStore();

  setUp(_freshDatabase);
  tearDown(() async => (await LocalStorage.database).close());

  group('valid data (MD-RPT-011)', () {
    test('insert returns the row with an id; a reload gives back every column, including the photo bytes and UTC times', () async {
      final image = Uint8List.fromList([0xFF, 0xD8, 0xFF, 0, 1, 2, 255]);
      final saved = await store.insert(_report('c-1', image: image));
      expect(saved.id, isNotNull);

      final back = (await store.list('u-1')).single;
      expect(back.id, saved.id);
      expect((back.clientReportId, back.userId, back.status), ('c-1', 'u-1', ReportStatus.pending));
      expect((back.latitude, back.longitude, back.accuracyM, back.description), (21.864, 104.113, 6.5, 'Vết nứt'));
      expect(back.imageBytes, image);
      expect(back.observedAt, DateTime.utc(2026, 10, 30, 8));
      expect(back.createdAt, DateTime.utc(2026, 10, 30, 8, 5));
    });

    test('update rewrites only the row with that id and a reload shows the new status, error and server fields', () async {
      final a = await store.insert(_report('a'));
      final b = await store.insert(_report('b'));
      await store.update(a.copyWith(status: ReportStatus.sent, serverReportId: 42, serverStatus: 'submitted', photoId: 'p-1'));
      await store.update(b.copyWith(status: ReportStatus.failed, lastError: 'quá lớn'));

      final byId = {for (final r in await store.list('u-1')) r.clientReportId: r};
      expect((byId['a']!.status, byId['a']!.serverReportId, byId['a']!.serverStatus, byId['a']!.photoId), (ReportStatus.sent, 42, 'submitted', 'p-1'));
      expect((byId['b']!.status, byId['b']!.lastError), (ReportStatus.failed, 'quá lớn'));
      expect(byId['b']!.serverReportId, isNull);
    });

    test('list is newest first and only holds the asked account', () async {
      await store.insert(_report('first'));
      await store.insert(_report('mine-2'));
      await store.insert(_report('theirs', user: 'u-2'));
      await store.insert(_report('mine-3'));
      expect((await store.list('u-1')).map((r) => r.clientReportId), ['mine-3', 'mine-2', 'first']);
      expect((await store.list('u-2')).map((r) => r.clientReportId), ['theirs']);
      expect(await store.list('nobody'), isEmpty);
    });
  });

  group('missing or null data (MD-RPT-012)', () {
    test('a report with no description, accuracy or photo is stored and reloaded with nulls', () async {
      await store.insert(FieldReport(
        clientReportId: 'bare',
        userId: 'u-1',
        latitude: 0,
        longitude: 0,
        observedAt: DateTime.utc(2026, 10, 30),
        createdAt: DateTime.utc(2026, 10, 30),
      ));
      final r = (await store.list('u-1')).single;
      expect([r.description, r.accuracyM, r.imageBytes, r.photoId, r.serverReportId, r.serverStatus, r.lastError], everyElement(isNull));
      expect((r.latitude, r.longitude), (0.0, 0.0), reason: 'zero is a coordinate, not "missing"');
    });

    test('a row from before the upgrade (no client_report_id, no owner) is left out of every list', () async {
      final db = await LocalStorage.database;
      await db.insert('offline_reports', {'latitude': 21.0, 'longitude': 104.0, 'description': 'old', 'created_at': 'x'});
      await store.insert(_report('new'));
      expect((await store.list('u-1')).map((r) => r.clientReportId), ['new']);
      expect(await db.query('offline_reports'), hasLength(2), reason: 'the old row is skipped, not deleted');
    });

    test('a row whose status column is NULL is read back as pending (it will be retried, not shown as sent)', () async {
      final db = await LocalStorage.database;
      final saved = await store.insert(_report('s'));
      await db.update('offline_reports', {'status': null}, where: 'id = ?', whereArgs: [saved.id]);
      expect((await store.list('u-1')).single.status, ReportStatus.pending);
    });
  });

  group('malformed data (MD-RPT-013)', () {
    test('the same client_report_id cannot be stored twice: the second insert throws and nothing is added or changed', () async {
      await store.insert(_report('dup', description: 'original'));
      await expectLater(store.insert(_report('dup', description: 'copy')), throwsA(anything));
      final rows = await store.list('u-1');
      expect(rows, hasLength(1));
      expect(rows.single.description, 'original');
    });

    test('the unique id is global: another account cannot take over an existing client_report_id', () async {
      await store.insert(_report('shared', user: 'u-1'));
      await expectLater(store.insert(_report('shared', user: 'u-2')), throwsA(anything));
      expect(await store.list('u-2'), isEmpty);
    });

    test('update of an id that does not exist changes nothing and does not throw', () async {
      await store.insert(_report('keep'));
      await store.update(_report('ghost').copyWith(id: 9999, status: ReportStatus.sent));
      final rows = await store.list('u-1');
      expect((rows.single.clientReportId, rows.single.status), ('keep', ReportStatus.pending));
    });

    test('a corrupt row of one account does not break the list of another account', () async {
      final db = await LocalStorage.database;
      await store.insert(_report('ok', user: 'u-2'));
      await db.insert('offline_reports', {
        'client_report_id': 'broken',
        'user_id': 'u-1',
        'latitude': 21.0,
        'longitude': 104.0,
        'observed_at': 'not a date',
        'created_at': '2026-10-30T08:00:00Z',
        'status': 'pending',
      });
      await expectLater(store.list('u-1'), throwsFormatException);
      expect((await store.list('u-2')).single.clientReportId, 'ok');
    });
  });
}
