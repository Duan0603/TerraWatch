import '../../../core/network/api_client.dart';

/// Vùng sạt lở đã xác minh dạng GeoJSON FeatureCollection (GET /api/v1/landslides/active), giống bản web
class HazardRepository {
  final ApiClient _api;

  HazardRepository({ApiClient? apiClient}) : _api = apiClient ?? ApiClient();

  Future<Map<String, dynamic>> fetchActiveHazards() => _api.get('/api/v1/landslides/active');
}
