import 'package:flutter_test/flutter_test.dart';
import 'package:geosentry_mobile/features/alerts/data/alert_models.dart';

// Target: lib/features/alerts/data/alert_models.dart.
// Covers MD-ALR-001, MD-ALR-002, MD-ALR-003. alert_models_test and push_alerts_test already assert the happy FCM payload
// and the stateAt rules; this file asserts the defaults for missing values and the rejection of wrongly typed values.

void main() {
  group('valid data (MD-ALR-001)', () {
    test('toMap -> fromMap keeps every column, including id, validity and status', () {
      final original = AlertModel(
        id: 9,
        broadcastId: 'b-9',
        title: 'Cảnh báo',
        message: 'Sơ tán',
        severity: 'extreme',
        areaName: 'Sa Pa',
        receivedAt: '2026-10-30T10:00:00Z',
        issuedAt: '2026-10-30T09:00:00Z',
        validUntil: '2026-10-31T09:00:00Z',
        status: 'revoked',
      );
      final back = AlertModel.fromMap(original.toMap());
      expect(back.toMap(), original.toMap());
      expect((back.id, back.status, back.issuedAt, back.validUntil), (9, 'revoked', '2026-10-30T09:00:00Z', '2026-10-31T09:00:00Z'));
    });

    test('toMap leaves out the id of an unsaved alert so SQLite assigns one', () {
      final map = AlertModel(broadcastId: 'x', title: '', message: '', severity: 'high', areaName: '', receivedAt: '').toMap();
      expect(map.containsKey('id'), isFalse);
    });

    test('SubscribedArea parses id, name and channels', () {
      final a = SubscribedArea.fromJson({'subscriptionId': 's-1', 'areaId': 3, 'areaName': 'Bát Xát', 'alertChannels': ['PUSH', 'SMS']});
      expect([a.subscriptionId, a.areaId, a.areaName, a.alertChannels], ['s-1', 3, 'Bát Xát', ['PUSH', 'SMS']]);
    });
  });

  group('missing fields and nulls (MD-ALR-002)', () {
    test('fromMap of an empty map or a map of nulls gives safe defaults and an alert that is active', () {
      for (final map in <Map<String, dynamic>>[
        {},
        {'broadcast_id': null, 'title': null, 'message': null, 'severity': null, 'area_name': null, 'received_at': null, 'status': null},
      ]) {
        final a = AlertModel.fromMap(map);
        expect([a.broadcastId, a.title, a.message, a.areaName, a.receivedAt], ['', '', '', '', '']);
        expect((a.severity, a.status), ('high', 'active'));
        expect([a.id, a.issuedAt, a.validUntil], [null, null, null]);
        expect(a.stateAt(DateTime.utc(2100)), AlertState.active, reason: 'no valid_until never expires');
      }
    });

    test('fromFcmPayload of an empty payload still produces a loud, extreme alert with generated id and a parsable time', () {
      final a = AlertModel.fromFcmPayload({});
      expect(a.severity, 'extreme');
      expect(a.title, isNotEmpty);
      expect(a.message, isNotEmpty);
      expect(a.areaName, 'Khu vực trọng điểm');
      expect(int.tryParse(a.broadcastId), isNotNull, reason: 'id is the arrival time in ms, so two payloads are not merged by accident');
      expect(DateTime.tryParse(a.receivedAt), isNotNull);
      expect((a.issuedAt, a.validUntil, a.status), (null, null, 'active'));
    });

    test('fromBroadcastJson with only broadcastId defaults the rest; receivedAt follows issuedAt when present', () {
      final bare = AlertModel.fromBroadcastJson({'broadcastId': 'b'});
      expect((bare.title, bare.message, bare.severity, bare.areaName, bare.status), ('', '', 'high', 'Khu vực trọng điểm', 'active'));
      expect(DateTime.tryParse(bare.receivedAt), isNotNull);
      final withTime = AlertModel.fromBroadcastJson({'broadcastId': 'b', 'issuedAt': '2026-10-30T08:00:00Z', 'title': null, 'status': null});
      expect((withTime.receivedAt, withTime.title, withTime.status), ('2026-10-30T08:00:00Z', '', 'active'));
    });

    test('SubscribedArea without areaName uses "Khu vực #id"; SubscriptionModel.fromJson of {} gives empty text and both channels', () {
      expect(SubscribedArea.fromJson({'subscriptionId': 's', 'areaId': 5, 'alertChannels': []}).areaName, 'Khu vực #5');
      final s = SubscriptionModel.fromJson({});
      expect([s.phoneNumber, s.areaId, s.areaName, s.alertChannels], ['', '', '', ['PUSH', 'SMS']]);
    });
  });

  group('wrong format (MD-ALR-003)', () {
    test('fromBroadcastJson rejects a missing or non-string broadcastId and a non-string title (TypeError, no partial model)', () {
      expect(() => AlertModel.fromBroadcastJson({'title': 't'}), throwsA(isA<TypeError>()));
      expect(() => AlertModel.fromBroadcastJson({'broadcastId': 5}), throwsA(isA<TypeError>()));
      expect(() => AlertModel.fromBroadcastJson({'broadcastId': 'b', 'title': 5}), throwsA(isA<TypeError>()));
    });

    test('fromMap rejects a column of the wrong type', () {
      expect(() => AlertModel.fromMap({'id': 'one'}), throwsA(isA<TypeError>()));
      expect(() => AlertModel.fromMap({'title': 5}), throwsA(isA<TypeError>()));
      expect(() => AlertModel.fromMap({'valid_until': 123}), throwsA(isA<TypeError>()));
    });

    test('SubscribedArea rejects a text areaId, a missing channel list and a missing subscriptionId', () {
      expect(() => SubscribedArea.fromJson({'subscriptionId': 's', 'areaId': '5', 'alertChannels': []}), throwsA(isA<TypeError>()));
      expect(() => SubscribedArea.fromJson({'subscriptionId': 's', 'areaId': 5}), throwsA(isA<TypeError>()));
      expect(() => SubscribedArea.fromJson({'areaId': 5, 'alertChannels': []}), throwsA(isA<TypeError>()));
    });

    test('a validUntil that is not a date is treated as no expiry, and a date-only text is read as local midnight (behaviour on main)', () {
      AlertModel at(String until) => AlertModel(broadcastId: 'b', title: '', message: '', severity: 'high', areaName: '', receivedAt: '', validUntil: until);
      expect(at('soon').stateAt(DateTime.utc(2100)), AlertState.active);
      expect(at('').stateAt(DateTime.utc(2100)), AlertState.active);
      expect(at('2026-10-30').stateAt(DateTime.utc(2027)), AlertState.expired);
      expect(at('2026-10-30').stateAt(DateTime.utc(2026, 10, 29)), AlertState.active);
    });
  });
}
