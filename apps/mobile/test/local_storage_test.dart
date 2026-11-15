import 'package:flutter_test/flutter_test.dart';
import 'package:path/path.dart' as p;
import 'package:sqflite_common_ffi/sqflite_ffi.dart';
import 'package:geosentry_mobile/core/constants/app_constants.dart';
import 'package:geosentry_mobile/core/storage/local_storage.dart';

import 'support/harness.dart';

Map<String, dynamic> _alert(String id, {String status = 'active', String title = 't'}) => {
      'broadcast_id': id,
      'title': title,
      'message': 'm',
      'severity': 'high',
      'area_name': 'Sa Pa',
      'received_at': '2026-10-30T10:00:00Z',
      'status': status,
    };

Future<Set<Object?>> _columns(String table) async {
  final db = await LocalStorage.database;
  return (await db.rawQuery('PRAGMA table_info($table)')).map((r) => r['name']).toSet();
}

void main() {
  useIsolatedSqlite();

  setUp(() async {
    await LocalStorage.clearAlertHistory();
    await (await LocalStorage.database).delete('forecast_zones');
  });

  group('schema', () {
    test('creates every table and the columns the app reads', () async {
      final db = await LocalStorage.database;
      final tables = (await db.rawQuery("SELECT name FROM sqlite_master WHERE type='table'")).map((r) => r['name']).toSet();
      expect(tables, containsAll(['hazard_polygons', 'offline_reports', 'alert_history', 'forecast_zones', 'cache_meta']));
      expect(await _columns('alert_history'), containsAll(['broadcast_id', 'issued_at', 'valid_until', 'status']));
      expect(await _columns('offline_reports'), containsAll(['client_report_id', 'user_id', 'image_bytes', 'server_report_id', 'last_error']));
    });

    test('the database getter returns the same open connection until it is closed, then reopens with data kept', () async {
      final a = await LocalStorage.database;
      expect(identical(await LocalStorage.database, a), isTrue);
      await LocalStorage.insertAlert(_alert('persist'));
      await a.close();
      final b = await LocalStorage.database;
      expect(identical(a, b), isFalse);
      expect(b.isOpen, isTrue);
      expect((await LocalStorage.getAlertHistory()).map((r) => r['broadcast_id']), ['persist']);
    });

    test('an old install is upgraded in place: new columns added, duplicate broadcasts merged, old rows kept', () async {
      final db = await LocalStorage.database;
      await db.close();
      final path = p.join(await databaseFactoryFfi.getDatabasesPath(), AppConstants.dbName);
      await databaseFactoryFfi.deleteDatabase(path);

      final old = await databaseFactoryFfi.openDatabase(path, options: OpenDatabaseOptions(version: 1, onCreate: (d, _) async {
        await d.execute('CREATE TABLE alert_history (id INTEGER PRIMARY KEY AUTOINCREMENT, broadcast_id TEXT, title TEXT, message TEXT, severity TEXT, area_name TEXT, received_at TEXT)');
        await d.execute('CREATE TABLE offline_reports (id INTEGER PRIMARY KEY AUTOINCREMENT, latitude REAL, longitude REAL, image_path TEXT, description TEXT, created_at TEXT, status TEXT DEFAULT \'pending\')');
        Future<void> row(String? b, String title) => d.insert('alert_history', {'broadcast_id': b, 'title': title, 'message': 'm', 'severity': 'high', 'area_name': 'a', 'received_at': 'r'});
        await row('dup', 'first');
        await row('dup', 'second'); // same broadcast stored twice by the old app
        await row('', 'no id 1');
        await row('', 'no id 2');
        await d.insert('offline_reports', {'latitude': 21.0, 'longitude': 104.0, 'description': 'old report', 'created_at': 'x'});
      }));
      await old.close();

      final rows = await LocalStorage.getAlertHistory();
      expect(rows.where((r) => r['broadcast_id'] == 'dup').map((r) => r['title']), ['second'], reason: 'newest duplicate wins');
      expect(rows.where((r) => r['broadcast_id'] == '').length, 2, reason: 'rows without an id are never merged');
      expect(rows.every((r) => r['status'] == 'active'), isTrue);
      expect(await _columns('alert_history'), containsAll(['issued_at', 'valid_until', 'status']));
      expect(await _columns('offline_reports'), containsAll(['client_report_id', 'user_id', 'observed_at', 'accuracy_m', 'image_bytes', 'photo_id', 'server_report_id', 'server_status', 'last_error']));
      final reports = await (await LocalStorage.database).query('offline_reports');
      expect(reports.single['description'], 'old report');

      // the unique index added by the upgrade now blocks raw duplicates
      await expectLater((await LocalStorage.database).insert('alert_history', _alert('dup')), throwsA(anything));
    });
  });

  group('alert history', () {
    test('insertAlert returns the row id; the same broadcast updates that row in place', () async {
      final id = await LocalStorage.insertAlert(_alert('b1', title: 'v1'));
      expect(id, greaterThan(0));
      expect(await LocalStorage.insertAlert(_alert('b1', title: 'v2')), id);
      final rows = await LocalStorage.getAlertHistory();
      expect(rows.length, 1);
      expect(rows.single['title'], 'v2');
    });

    test('an active broadcast can still be revoked afterwards', () async {
      await LocalStorage.insertAlert(_alert('b1'));
      await LocalStorage.insertAlert(_alert('b1', status: 'revoked'));
      expect((await LocalStorage.getAlertHistory()).single['status'], 'revoked');
    });

    test('empty broadcast ids are separate rows', () async {
      await LocalStorage.insertAlert(_alert(''));
      await LocalStorage.insertAlert(_alert(''));
      expect((await LocalStorage.getAlertHistory()).length, 2);
    });

    test('history is newest first', () async {
      for (final id in ['a', 'b', 'c']) {
        await LocalStorage.insertAlert(_alert(id));
      }
      expect((await LocalStorage.getAlertHistory()).map((r) => r['broadcast_id']), ['c', 'b', 'a']);
    });

    test('a row with an unknown column returns -1 instead of throwing, and stores nothing', () async {
      expect(await LocalStorage.insertAlert({'no_such_column': 1}), -1);
      expect(await LocalStorage.getAlertHistory(), isEmpty);
    });

    test('clearAlertHistory empties the table and is safe on an empty table', () async {
      await LocalStorage.insertAlert(_alert('x'));
      await LocalStorage.clearAlertHistory();
      expect(await LocalStorage.getAlertHistory(), isEmpty);
      await LocalStorage.clearAlertHistory();
      expect(await LocalStorage.getAlertHistory(), isEmpty);
    });
  });

  group('zone count', () {
    Map<String, Object> zone(String run) => {
          'run_id': run, 'unit_id': 'u', 'unit_version': 'v', 'hazard_level': 'high', 'probability': 0.5,
          'issued_at': 1, 'valid_from': 1, 'valid_until': 2, 'model_version': 'm', 'polygon': '[]',
          'min_lat': 0.0, 'max_lat': 1.0, 'min_lon': 0.0, 'max_lon': 1.0,
        };

    test('counts stored forecast zones, 0 when none', () async {
      expect(await LocalStorage.getZoneCount(), 0);
      final db = await LocalStorage.database;
      await db.insert('forecast_zones', zone('r1'));
      await db.insert('forecast_zones', zone('r2'));
      expect(await LocalStorage.getZoneCount(), 2);
    });
  });
}
