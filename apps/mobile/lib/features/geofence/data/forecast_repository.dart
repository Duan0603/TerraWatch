import '../../../core/constants/api_endpoints.dart';
import '../../../core/network/api_client.dart';
import '../../../core/network/api_exceptions.dart';
import 'forecast_zone.dart';
import 'zone_store.dart';

/// Đồng bộ các vùng dự báo đã duyệt từ máy chủ về bộ đệm trên máy (Story 5.3)
class ForecastRepository {
  final ZoneStore _store;
  final ApiClient _api;
  final DateTime Function() _clock;

  ForecastRepository({ZoneStore? store, ApiClient? apiClient, DateTime Function()? clock})
      : _store = store ?? SqliteZoneStore(),
        _api = apiClient ?? ApiClient(),
        _clock = clock ?? DateTime.now;

  /// Thay toàn bộ bộ đệm bằng danh sách máy chủ trả về, nên vùng bị thu hồi hoặc thay thế biến mất.
  /// Mất mạng hoặc dữ liệu sai dạng thì ném [ApiException] và bộ đệm cũ giữ nguyên. Trả về số vùng đã lưu.
  /// shortcut: tải toàn bộ danh sách mỗi lần (~1 KB/vùng); dùng If-None-Match hoặc bản delta khi danh sách lớn
  Future<int> sync() async {
    final body = await _api.get(ApiEndpoints.forecastsOfflineSync);
    final items = body['items'];
    if (items is! List) throw const ApiException(message: 'Dữ liệu dự báo từ máy chủ không hợp lệ');
    final List<ForecastZone> zones;
    try {
      zones = items.map((item) => ForecastZone.fromJson(item as Map<String, dynamic>)).toList();
    } on FormatException catch (e) {
      throw ApiException(message: 'Dữ liệu dự báo từ máy chủ không hợp lệ (${e.message})');
    } on TypeError {
      throw const ApiException(message: 'Dữ liệu dự báo từ máy chủ không hợp lệ');
    }
    await _store.replaceAll(zones, _clock().toUtc());
    return zones.length;
  }
}
