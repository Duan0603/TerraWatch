import 'dart:convert';
import 'package:http/http.dart' as http;
import '../config/env.dart';
import '../storage/session.dart';
import 'api_exceptions.dart';

/// Client mạng chuẩn hóa bọc quanh HTTP package để gọi API Gateway Nginx
class ApiClient {
  final http.Client _client;
  final String _baseUrl;

  ApiClient({http.Client? client, String? baseUrl})
      : _client = client ?? http.Client(),
        _baseUrl = baseUrl ?? AppEnv.apiBaseUrl;

  Future<Map<String, dynamic>> get(
    String endpoint, {
    Map<String, String>? headers,
    Map<String, dynamic>? queryParameters,
  }) async {
    final uri = _buildUri(endpoint, queryParameters);
    try {
      final response = await _client.get(uri, headers: _buildHeaders(headers));
      return _handleResponse(response);
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException(message: 'Lỗi kết nối mạng: $e');
    }
  }

  Future<Map<String, dynamic>> post(
    String endpoint, {
    dynamic body,
    Map<String, String>? headers,
  }) async {
    final uri = _buildUri(endpoint);
    try {
      final response = await _client.post(
        uri,
        headers: _buildHeaders(headers),
        body: body != null ? jsonEncode(body) : null,
      );
      return _handleResponse(response);
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException(message: 'Lỗi kết nối mạng: $e');
    }
  }

  Uri _buildUri(String endpoint, [Map<String, dynamic>? queryParameters]) {
    final url = '$_baseUrl$endpoint';
    final uri = Uri.parse(url);
    if (queryParameters != null && queryParameters.isNotEmpty) {
      return uri.replace(
        queryParameters: queryParameters
            .map((k, v) => MapEntry(k, v.toString())),
      );
    }
    return uri;
  }

  Map<String, String> _buildHeaders(Map<String, String>? customHeaders) {
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      if (Session.token != null) 'Authorization': 'Bearer ${Session.token}',
      if (customHeaders != null) ...customHeaders,
    };
  }

  Map<String, dynamic> _handleResponse(http.Response response) {
    final statusCode = response.statusCode;
    if (statusCode >= 200 && statusCode < 300) {
      if (response.body.isEmpty) return {};
      final decoded = jsonDecode(response.body);
      if (decoded is Map<String, dynamic>) return decoded;
      return {'data': decoded};
    } else if (statusCode == 401) {
      // Có token mà bị 401 = phiên hết hạn -> xóa phiên để app quay về màn đăng nhập
      if (Session.token != null) Session.clear();
      throw const ApiException(message: 'Hết phiên đăng nhập. Vui lòng đăng nhập lại.', statusCode: 401);
    } else if (statusCode == 403) {
      throw const ApiException(message: 'Không có quyền truy cập.', statusCode: 403);
    } else {
      throw ApiException(message: _errorMessage(response), statusCode: statusCode);
    }
  }

  /// Backend trả lỗi dạng {"message": "..."}; không phải JSON thì dùng mã trạng thái
  String _errorMessage(http.Response response) {
    try {
      final decoded = jsonDecode(response.body);
      if (decoded is Map && decoded['message'] is String) return decoded['message'] as String;
    } catch (_) {}
    return 'Lỗi máy chủ (${response.statusCode})';
  }
}
