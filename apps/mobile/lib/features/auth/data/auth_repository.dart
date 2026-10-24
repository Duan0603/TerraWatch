import '../../../core/constants/api_endpoints.dart';
import '../../../core/network/api_client.dart';
import '../../../core/network/api_exceptions.dart';
import '../../../core/storage/session.dart';
import 'auth_models.dart';
import 'google_auth_service.dart';

/// Đăng nhập / đăng ký / xác thực phiên (Story 5.5)
class AuthRepository {
  final ApiClient _api;

  /// Cung cấp Firebase ID token (inject giả khi test)
  final Future<String?> Function() _googleIdToken;

  AuthRepository({ApiClient? apiClient, Future<String?> Function()? googleIdToken})
      : _api = apiClient ?? ApiClient(),
        _googleIdToken = googleIdToken ?? GoogleAuthService.signInForIdToken;

  Future<UserProfile> login(String email, String password) => _authenticate(
        ApiEndpoints.login,
        {'email': email.trim(), 'password': password},
        {401: 'Email hoặc mật khẩu không đúng'},
      );

  /// Trả về null nếu người dùng hủy hộp chọn tài khoản Google
  Future<UserProfile?> loginWithGoogle() async {
    final idToken = await _googleIdToken();
    if (idToken == null) return null;
    return _authenticate(
      ApiEndpoints.googleLogin,
      {'idToken': idToken},
      {401: 'Đăng nhập Google không hợp lệ', 404: 'Máy chủ chưa hỗ trợ đăng nhập Google', 501: 'Máy chủ chưa hỗ trợ đăng nhập Google'},
    );
  }

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
      if (Session.token == token) await Session.save(token, profile); // đã đăng xuất trong lúc chờ thì không đăng nhập lại
    } on ApiException catch (_) {}
  }

  /// PUT /auth/me; cập nhật hồ sơ lưu trên máy bằng bản server trả về
  Future<UserProfile> updateProfile({required String fullName, String? phoneNumber}) async {
    final token = Session.token;
    try {
      final profile = UserProfile.fromJson(await _api.put(ApiEndpoints.me, body: {
        'fullName': fullName.trim(),
        'phoneNumber': phoneNumber?.trim() ?? '',
      }));
      if (token != null && Session.token == token) await Session.save(token, profile);
      return profile;
    } on TypeError catch (_) {
      throw const ApiException(message: 'Phản hồi máy chủ không hợp lệ');
    }
  }

  /// PUT /auth/password; sai mật khẩu hiện tại trả 400 (không phải 401 nên không bị đăng xuất)
  Future<void> changePassword({required String currentPassword, required String newPassword}) async {
    try {
      await _api.put(ApiEndpoints.password, body: {'currentPassword': currentPassword, 'newPassword': newPassword});
    } on ApiException catch (e) {
      if (e.statusCode == 400) {
        throw const ApiException(message: 'Mật khẩu hiện tại không đúng', statusCode: 400);
      }
      rethrow;
    }
  }

  /// Xóa phiên trước để đăng xuất luôn thành công; đăng xuất Google/Firebase chỉ là bước phụ, có giới hạn thời gian
  Future<void> logout() async {
    await Session.clear();
    await GoogleAuthService.signOut().timeout(const Duration(seconds: 3), onTimeout: () {});
  }
}
