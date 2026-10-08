import 'package:flutter_test/flutter_test.dart';
import 'package:geosentry_mobile/features/alerts/data/alert_models.dart';
import 'package:geosentry_mobile/features/alerts/data/alerts_repository.dart';

void main() {
  group('Alert Models & Subscription Tests (Story 5.1)', () {
    test('SubscriptionModel serializes correctly to JSON', () {
      final sub = SubscriptionModel(
        phoneNumber: '0987654321',
        areaId: 'aoi-laocai-01',
        areaName: 'Bát Xát',
        alertChannels: ['PUSH', 'SMS'],
      );

      final json = sub.toJson();
      expect(json['phoneNumber'], '0987654321');
      expect(json['areaId'], 'aoi-laocai-01');
      expect(json['alertChannels'], ['PUSH', 'SMS']);

      final fromJson = SubscriptionModel.fromJson(json);
      expect(fromJson.phoneNumber, sub.phoneNumber);
      expect(fromJson.areaId, sub.areaId);
      expect(fromJson.alertChannels.length, 2);
    });

    test('AlertModel parses from FCM Payload and converts to SQLite Map', () {
      final payload = {
        'broadcastId': 'bc-12345',
        'title': '🚨 CẢNH BÁO SẠT LỞ',
        'message': 'Sơ tán khẩn cấp',
        'severity': 'extreme',
        'areaName': 'Xã Bản Hồ',
      };

      final alert = AlertModel.fromFcmPayload(payload);
      expect(alert.broadcastId, 'bc-12345');
      expect(alert.title, '🚨 CẢNH BÁO SẠT LỞ');
      expect(alert.severity, 'extreme');
      expect(alert.areaName, 'Xã Bản Hồ');

      final map = alert.toMap();
      expect(map['broadcast_id'], 'bc-12345');
      expect(map['severity'], 'extreme');

      final fromMap = AlertModel.fromMap(map);
      expect(fromMap.broadcastId, alert.broadcastId);
      expect(fromMap.message, alert.message);
    });

    test('AlertsRepository fallback returns non-empty areas', () async {
      final repo = AlertsRepository();
      final areas = await repo.fetchMonitoringAreas();
      expect(areas.isNotEmpty, isTrue);
      expect(areas.any((a) => a['name']?.toString().contains('Bát Xát') ?? false), isTrue);
    });
  });
}
