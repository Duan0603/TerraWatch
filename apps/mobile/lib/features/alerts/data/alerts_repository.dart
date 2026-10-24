import '../../../core/constants/api_endpoints.dart';
import '../../../core/network/api_client.dart';
import '../../../core/storage/session.dart';
import '../../../core/storage/local_storage.dart';
import 'alert_models.dart';

/// Repository xử lý nghiệp vụ Cảnh báo khẩn cấp & Đăng ký vùng (Story 5.1)
class AlertsRepository {
  final ApiClient _apiClient;

  AlertsRepository({ApiClient? apiClient})
      : _apiClient = apiClient ?? ApiClient();

  /// AC1: Đăng ký vùng nhận cảnh báo khẩn cấp (POST /api/v1/alerts/subscriptions). Lỗi được ném ra, không giả thành công.
  Future<void> subscribeAlerts(SubscriptionModel subscription) async {
    await _apiClient.post(ApiEndpoints.alertSubscriptions, body: subscription.toJson());
  }

  /// Danh sách vùng người dùng đã đăng ký (GET /api/v1/alerts/subscriptions)
  Future<List<SubscribedArea>> fetchSubscriptions() async {
    final response = await _apiClient.get(ApiEndpoints.alertSubscriptions);
    final data = response['data'];
    if (data is! List) return [];
    return data.map((e) => SubscribedArea.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<void> deleteSubscription(String subscriptionId) async {
    await _apiClient.delete('${ApiEndpoints.alertSubscriptions}/$subscriptionId');
  }

  /// AC2: Đăng ký FCM Device Token (POST /api/v1/alerts/devices/register)
  Future<bool> registerDeviceToken(String fcmToken, {String? userId}) async {
    try {
      await _apiClient.post(
        '/api/v1/alerts/devices/register',
        body: {
          'userId': userId ?? Session.user.value?.userId ?? 'citizen_anonymous',
          'fcmToken': fcmToken,
          'deviceType': 'ANDROID',
        },
      );
      return true;
    } catch (_) {
      return false;
    }
  }

  /// Lấy danh sách vùng giám sát trọng điểm (AOI) để người dân lựa chọn
  /// Mỗi vùng có `area_id` (số) và `name`. Lỗi mạng được ném ra để màn hình báo lỗi thật (không dùng danh sách giả).
  Future<List<Map<String, dynamic>>> fetchMonitoringAreas() async {
    final response = await _apiClient.get('/api/v1/monitoring-areas');
    final data = response['data'];
    return data is List ? List<Map<String, dynamic>>.from(data) : [];
  }

  /// AC4: Lưu bản tin cảnh báo khẩn cấp vào SQLite
  Future<int> saveAlert(AlertModel alert) async {
    return await LocalStorage.insertAlert(alert.toMap());
  }

  /// AC4: Đọc danh sách lịch sử cảnh báo từ SQLite
  Future<List<AlertModel>> getAlertHistory() async {
    final rows = await LocalStorage.getAlertHistory();
    return rows.map((r) => AlertModel.fromMap(r)).toList();
  }
}
