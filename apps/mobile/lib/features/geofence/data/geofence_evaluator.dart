import '../../../services/notification_service.dart';
import 'forecast_zone.dart';
import 'zone_store.dart';

enum GeofenceStatus { warning, stale, none }

enum StaleReason { neverSynced, syncTooOld, zoneExpired, allExpired }

class GeofenceResult {
  final GeofenceStatus status;

  /// Các vùng đang hiệu lực chứa vị trí, nguy cơ cao nhất trước (chỉ khi [status] là warning)
  final List<ForecastZone> activeZones;

  /// Vùng đã hết hạn chứa vị trí, hết hạn gần nhất (khi [staleReason] là zoneExpired)
  final ForecastZone? expiredZone;
  final StaleReason? staleReason;
  final DateTime? lastSyncAt;
  final int zoneCount;

  const GeofenceResult({
    required this.status,
    this.activeZones = const [],
    this.expiredZone,
    this.staleReason,
    required this.lastSyncAt,
    required this.zoneCount,
  });

  String? get hazardLevel => activeZones.isEmpty ? null : activeZones.first.hazardLevel;

  /// Giờ hết hạn sớm nhất trong các vùng đang cảnh báo
  DateTime? get soonestValidUntil =>
      activeZones.isEmpty ? null : activeZones.map((z) => z.validUntil).reduce((a, b) => a.isBefore(b) ? a : b);
}

/// Quyết định trạng thái cảnh báo tại một vị trí hoàn toàn trên máy (Story 5.3).
/// Kết quả không bao giờ là "an toàn": dữ liệu cũ hoặc thiếu thì báo "dữ liệu đã cũ".
class GeofenceEvaluator {
  /// Lần đồng bộ cũ hơn mức này thì coi dữ liệu là cũ (có thể đã có vùng bị thu hồi mà máy chưa biết)
  static const maxSyncAge = Duration(hours: 24);

  final ZoneStore _store;
  final DateTime Function() _clock;

  GeofenceEvaluator(this._store, {DateTime Function()? clock}) : _clock = clock ?? DateTime.now;

  Future<GeofenceResult> evaluate(double lat, double lon) async {
    final now = _clock().toUtc();
    final summary = await _store.summary(now);
    final inside = (await _store.candidates(lat, lon)).where((z) => z.contains(lat, lon)).toList();

    final active = inside.where((z) => z.isValidAt(now)).toList()
      ..sort((a, b) {
        final byHazard = b.hazardRank.compareTo(a.hazardRank);
        return byHazard != 0 ? byHazard : a.validUntil.compareTo(b.validUntil);
      });
    GeofenceResult result(GeofenceStatus status, {StaleReason? reason, ForecastZone? expired}) => GeofenceResult(
          status: status,
          activeZones: status == GeofenceStatus.warning ? active : const [],
          expiredZone: expired,
          staleReason: reason,
          lastSyncAt: summary.lastSyncAt,
          zoneCount: summary.count,
        );

    // Báo động ưu tiên hơn cảnh báo "dữ liệu cũ": thà báo thừa còn hơn bỏ sót một vùng còn hiệu lực
    if (active.isNotEmpty) return result(GeofenceStatus.warning);

    final expired = inside.where((z) => z.isExpiredAt(now)).toList()
      ..sort((a, b) => b.validUntil.compareTo(a.validUntil));
    final lastSync = summary.lastSyncAt;
    if (lastSync == null) return result(GeofenceStatus.stale, reason: StaleReason.neverSynced);
    if (now.difference(lastSync) > maxSyncAge) return result(GeofenceStatus.stale, reason: StaleReason.syncTooOld);
    if (expired.isNotEmpty) {
      return result(GeofenceStatus.stale, reason: StaleReason.zoneExpired, expired: expired.first);
    }
    if (summary.count > 0 && summary.unexpiredCount == 0) {
      return result(GeofenceStatus.stale, reason: StaleReason.allExpired);
    }
    return result(GeofenceStatus.none);
  }
}

typedef EmergencyAlarm = Future<void> Function({required String title, required String body});

/// Kiểm tra từng vị trí GPS và phát còi một lần cho mỗi vùng dự báo (mỗi lần chạy), không lặp theo từng điểm GPS
class GeofenceMonitor {
  final GeofenceEvaluator _evaluator;
  final EmergencyAlarm _alarm;
  final _alerted = <String>{};

  GeofenceMonitor(this._evaluator, {EmergencyAlarm? alarm}) : _alarm = alarm ?? NotificationService.showEmergencyAlert;

  Future<GeofenceResult> check(double lat, double lon) async {
    final result = await _evaluator.evaluate(lat, lon);
    final fresh = result.activeZones.where((z) => _alerted.add(z.runId)).toList();
    if (fresh.isNotEmpty) {
      await _alarm(
        title: 'NGUY HIỂM: BẠN ĐANG Ở VÙNG CẢNH BÁO SẠT LỞ',
        body: 'Mức nguy cơ ${hazardLabels[result.hazardLevel]!.toLowerCase()}. Hãy rời khỏi khu vực nguy hiểm.',
      );
    }
    return result;
  }
}
