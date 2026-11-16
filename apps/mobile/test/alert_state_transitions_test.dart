import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:path/path.dart' as p;
import 'package:sqflite_common_ffi/sqflite_ffi.dart';
import 'package:geosentry_mobile/core/constants/app_constants.dart';
import 'package:geosentry_mobile/core/network/api_client.dart';
import 'package:geosentry_mobile/core/network/api_exceptions.dart';
import 'package:geosentry_mobile/core/storage/local_storage.dart';
import 'package:geosentry_mobile/features/alerts/data/alert_models.dart';
import 'package:geosentry_mobile/features/alerts/data/alerts_repository.dart';
import 'package:geosentry_mobile/services/notification_service.dart';

import 'support/harness.dart';

// Target: alert lifecycle on the phone (active / expired / revoked / not on the device) driven by the real
// AlertsRepository + LocalStorage on a brand-new database per test and by NotificationService.openAlert.
// "expired" is derived from valid_until by AlertModel.stateAt, never stored.
// Already asserted by push_alerts_test, push_notification_services_test, alerts_screen_gaps_test: ST-ALR-001, 002, 003,
// 004, 005, 006 (open stores/emits, no ring), 013, 014, 019, 024.
// Combinations that cannot happen (time cannot act on a row that does not exist): ST-ALR-022.

final _now = DateTime.utc(2026, 10, 30, 12);
const _past = '2026-10-30T09:00:00Z';
const _future = '2026-10-31T09:00:00Z';

AlertModel _alert(String id, {String? validUntil, String status = 'active', String title = 't'}) => AlertModel(
      broadcastId: id,
      title: title,
      message: 'm',
      severity: 'high',
      areaName: 'Sa Pa',
      receivedAt: '2026-10-30T08:00:00Z',
      issuedAt: '2026-10-30T08:00:00Z',
      validUntil: validUntil,
      status: status,
    );

Map<String, dynamic> _broadcast(String id, {String status = 'active', String validUntil = _future}) => {
      'broadcastId': id,
      'title': 'server $id',
      'message': 'm',
      'severity': 'extreme',
      'areaName': 'Sa Pa',
      'issuedAt': '2026-10-30T08:00:00Z',
      'validUntil': validUntil,
      'status': status,
    };

void main() {
  useIsolatedSqlite();
  late List<Map<String, dynamic>> served;
  var online = true;

  AlertsRepository repo() => AlertsRepository(
        apiClient: ApiClient(
          baseUrl: 'http://test',
          client: MockClient((r) async {
            if (!online) throw http.ClientException('no route to host');
            return http.Response(jsonEncode(served), 200, headers: {'content-type': 'application/json'});
          }),
        ),
      );

  Future<Map<String, AlertModel>> history() async => {for (final a in await repo().getAlertHistory()) a.broadcastId: a};

  setUp(() async {
    final path = p.join(await databaseFactoryFfi.getDatabasesPath(), AppConstants.dbName);
    await (await LocalStorage.database).close();
    await databaseFactoryFfi.deleteDatabase(path);
    served = [];
    online = true;
  });

  tearDown(() async => (await LocalStorage.database).close());

  group('expired alert (valid_until passed)', () {
    test('ST-ALR-007: a first push that arrives after its valid_until is stored once and shown as expired, never active', () async {
      await repo().saveAlert(_alert('late', validUntil: _past));
      final a = (await history())['late']!;
      expect((a.status, a.stateAt(_now)), ('active', AlertState.expired));
      expect((await history()).length, 1);
    });

    test('ST-ALR-008: a duplicate push with the same valid_until updates the row in place and it stays expired', () async {
      await repo().saveAlert(_alert('e', validUntil: _past, title: 'first'));
      await repo().saveAlert(_alert('e', validUntil: _past, title: 'again'));
      final all = await history();
      expect((all.length, all['e']!.title, all['e']!.stateAt(_now)), (1, 'again', AlertState.expired));
    });

    test('ST-ALR-008 (behaviour): a duplicate push that carries a later valid_until extends the alert back to active', () async {
      await repo().saveAlert(_alert('ext', validUntil: _past));
      await repo().saveAlert(_alert('ext', validUntil: _future));
      expect((await history())['ext']!.stateAt(_now), AlertState.active);
    });

    test('ST-ALR-009: resync reporting the alert revoked turns an expired row into revoked (revoked wins over expired)', () async {
      await repo().saveAlert(_alert('e', validUntil: _past));
      served = [_broadcast('e', status: 'revoked', validUntil: _past)];
      await repo().resync();
      final a = (await history())['e']!;
      expect((a.status, a.stateAt(_now)), ('revoked', AlertState.revoked));
    });

    test('ST-ALR-010, ST-ALR-016: time moving on never brings an expired or revoked alert back', () async {
      await repo().saveAlert(_alert('e', validUntil: _past));
      await repo().saveAlert(_alert('r', validUntil: _future, status: 'revoked'));
      final all = await history();
      for (final at in [_now, _now.add(const Duration(days: 2)), DateTime.utc(2100)]) {
        expect(all['e']!.stateAt(at), AlertState.expired, reason: '$at');
        expect(all['r']!.stateAt(at), AlertState.revoked, reason: '$at');
      }
      expect(all['r']!.stateAt(_now.subtract(const Duration(days: 30))), AlertState.revoked, reason: 'revoked even before valid_until');
    });

    test('ST-ALR-011, ST-ALR-017: offline resync throws and leaves expired and revoked rows exactly as they were', () async {
      await repo().saveAlert(_alert('e', validUntil: _past));
      await repo().saveAlert(_alert('r', validUntil: _future, status: 'revoked'));
      final before = await LocalStorage.getAlertHistory();
      online = false;
      await expectLater(repo().resync(), throwsA(isA<ApiException>()));
      expect(await LocalStorage.getAlertHistory(), before);
    });

    test('ST-ALR-012: opening an expired alert from a system notification updates that row in place (still expired, one row) and emits it', () async {
      await repo().saveAlert(_alert('e', validUntil: _past, title: 'old'));
      final events = <AlertModel>[];
      final sub = NotificationService.onEmergencyAlert.listen(events.add);
      await NotificationService.openAlert(_alert('e', validUntil: _past, title: 'from notification'));
      while (events.isEmpty) {
        await Future<void>.delayed(Duration.zero); // the broadcast stream delivers on a later microtask
      }
      await sub.cancel();
      final all = await history();
      expect((all.length, all['e']!.title, all['e']!.stateAt(_now)), (1, 'from notification', AlertState.expired));
      expect(events.single.broadcastId, 'e');
    });
  });

  group('revoked alert', () {
    test('ST-ALR-015: resync reporting it revoked again changes nothing; resync saying it is active again does not revive it', () async {
      await repo().saveAlert(_alert('r', validUntil: _future, status: 'revoked'));
      served = [_broadcast('r', status: 'revoked')];
      await repo().resync();
      expect((await history())['r']!.status, 'revoked');
      served = [_broadcast('r', status: 'active')]; // a stale server answer must not undo a revoke
      await repo().resync();
      final all = await history();
      expect((all.length, all['r']!.status), (1, 'revoked'));
    });

    test('ST-ALR-018: opening a revoked alert from a notification keeps the stored row revoked (the event still reaches the UI)', () async {
      await repo().saveAlert(_alert('r', validUntil: _future, status: 'revoked'));
      final events = <AlertModel>[];
      final sub = NotificationService.onEmergencyAlert.listen(events.add);
      await NotificationService.openAlert(_alert('r', validUntil: _future)); // an FCM payload is always "active"
      while (events.isEmpty) {
        await Future<void>.delayed(Duration.zero);
      }
      await sub.cancel();
      expect((await history())['r']!.stateAt(_now), AlertState.revoked);
      expect(events.single.status, 'active', reason: 'behaviour on main: the red screen is opened from the payload, not from the stored row');
    });
  });

  group('alert not on the device yet', () {
    test('ST-ALR-021: resync listing a revoked broadcast that was never received stores it as revoked (it appears in history, not as active)', () async {
      served = [_broadcast('never-seen', status: 'revoked')];
      expect(await repo().resync(), 1);
      final a = (await history())['never-seen']!;
      expect((a.status, a.stateAt(_now)), ('revoked', AlertState.revoked));
    });

    test('ST-ALR-021: resync listing an already-past broadcast stores it as expired', () async {
      served = [_broadcast('old', validUntil: _past)];
      await repo().resync();
      expect((await history())['old']!.stateAt(_now), AlertState.expired);
    });

    test('ST-ALR-020: the same broadcast arriving twice before anything is stored (push + resync) ends as one active row', () async {
      served = [_broadcast('b')];
      await Future.wait([repo().saveAlert(_alert('b', validUntil: _future)), repo().resync()]);
      await repo().saveAlert(_alert('b', validUntil: _future));
      final all = await history();
      expect((all.length, all['b']!.stateAt(_now)), (1, AlertState.active));
    });

    test('ST-ALR-023: offline resync with nothing stored throws and stores nothing (no invented rows)', () async {
      online = false;
      await expectLater(repo().resync(), throwsA(isA<ApiException>()));
      expect(await history(), isEmpty);
    });
  });
}
