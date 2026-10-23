import '../../../core/constants/api_endpoints.dart';
import '../../../core/network/api_client.dart';
import '../../../core/network/api_exceptions.dart';
import '../../../core/storage/session.dart';
import 'auth_models.dart';

/// Đăng nhập / đăng ký / xác thực phiên (Story 5.5)
class AuthRepository {
  final ApiClient _api;

  AuthRepository({ApiClient? apiClient}) : _api = apiClient ?? ApiClient();

  Future<UserProfile> login(String email, String password) => _authenticate(
        ApiEndpoints.login,
        {'email': email.trim(), 'password': password},
        {401: 'Email hoặc mật khẩu không đúng'},
      );

  Future<UserProfile> register({
    required String fullName,
    required String email,
    required String password,
    String? phoneNumber,
  }) =>
      _authenticate(
        ApiEndpoints.register,
        {
          'fullName': fullName.trim(),
          'email': email.trim(),
          'password': password,
          if (phoneNumber != null && phoneNumber.trim().isNotEmpty) 'phoneNumber': phoneNumber.trim(),
        },
        {409: 'Email đã được đăng ký'},
      );

  Future<UserProfile> _authenticate(
    String endpoint,
    Map<String, dynamic> body,
    Map<int, String> messages,
  ) async {
    final AuthResult result;
    try {
      result = AuthResult.fromJson(await _api.post(endpoint, body: body));
    } on ApiException catch (e) {
      throw ApiException(message: messages[e.statusCode] ?? e.message, statusCode: e.statusCode);
    } on TypeError catch (_) {
      throw const ApiException(message: 'Phản hồi máy chủ không hợp lệ');
    }
    if (result.user.role != 'citizen') {
      throw const ApiException(message: 'Ứng dụng dành cho người dân', statusCode: 403);
    }
    await Session.save(result.token, result.user);
    return result.user;
  }

  /// Làm mới hồ sơ bằng /auth/me. 401 -> ApiClient tự xóa phiên; lỗi mạng -> giữ phiên đã lưu (offline).
  Future<void> refreshProfile() async {
    final token = Session.token;
    if (token == null) return;
    try {
      final profile = UserProfile.fromJson(await _api.get(ApiEndpoints.me));
      await Session.save(token, profile);
    } on ApiException catch (_) {}
  }

  Future<void> logout() => Session.clear();
}
