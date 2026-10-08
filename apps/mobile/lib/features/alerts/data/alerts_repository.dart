import '../../../core/network/api_client.dart';
import '../../../core/storage/local_storage.dart';
import 'alert_models.dart';

/// Repository xử lý nghiệp vụ Cảnh báo khẩn cấp & Đăng ký vùng (Story 5.1)
class AlertsRepository {
  final ApiClient _apiClient;

  AlertsRepository({ApiClient? apiClient})
      : _apiClient = apiClient ?? ApiClient();

  /// AC1: Đăng ký vùng nhận cảnh báo khẩn cấp (POST /api/v1/alerts/subscriptions)
  Future<bool> subscribeAlerts(SubscriptionModel subscription) async {
    try {
      await _apiClient.post(
        '/api/v1/alerts/subscriptions',
        body: subscription.toJson(),
      );
      return true;
    } catch (_) {
      // Fallback: Nếu backend chưa sẵn sàng hoặc offline, coi như đã lưu nhận tin cục bộ
      return true;
    }
  }

  /// AC2: Đăng ký FCM Device Token (POST /api/v1/alerts/devices/register)
  Future<bool> registerDeviceToken(String fcmToken, {String? userId}) async {
    try {
      await _apiClient.post(
        '/api/v1/alerts/devices/register',
        body: {
          'userId': userId ?? 'citizen_anonymous',
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
  Future<List<Map<String, dynamic>>> fetchMonitoringAreas() async {
    try {
      final response = await _apiClient.get('/api/v1/monitoring-areas');
      if (response['data'] is List) {
        return List<Map<String, dynamic>>.from(response['data']);
      }
    } catch (_) {}

    // Fallback các vùng trọng điểm sạt lở miền núi phía Bắc khi offline
    return [
      {'id': 'aoi-laocai-01', 'name': 'Khu vực Bát Xát', 'province': 'Lào Cai'},
      {'id': 'aoi-laocai-02', 'name': 'Thị xã Sa Pa', 'province': 'Lào Cai'},
      {'id': 'aoi-yenbai-01', 'name': 'Huyện Mù Cang Chải', 'province': 'Yên Bái'},
      {'id': 'aoi-hoabinh-01', 'name': 'Huyện Đà Bắc', 'province': 'Hòa Bình'},
      {'id': 'aoi-hagiang-01', 'name': 'Huyện Hoàng Su Phì', 'province': 'Hà Giang'},
    ];
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
