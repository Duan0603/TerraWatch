import 'package:firebase_auth/firebase_auth.dart';
import 'package:google_sign_in/google_sign_in.dart';
import '../../../core/config/env.dart';
import '../../../core/network/api_exceptions.dart';

/// Đăng nhập Google qua Firebase, trả về Firebase ID token để backend xác minh (Story 5.6)
class GoogleAuthService {
  GoogleAuthService._();

  static bool _initialized = false;

  /// Trả về ID token, hoặc null nếu người dùng đóng hộp chọn tài khoản
  static Future<String?> signInForIdToken() async {
    try {
      if (!_initialized) {
        await GoogleSignIn.instance.initialize(serverClientId: AppEnv.googleServerClientId);
        _initialized = true;
      }
      final account = await GoogleSignIn.instance.authenticate();
      final credential = GoogleAuthProvider.credential(idToken: account.authentication.idToken);
      final result = await FirebaseAuth.instance.signInWithCredential(credential);
      return await result.user?.getIdToken();
    } on GoogleSignInException catch (e) {
      if (e.code == GoogleSignInExceptionCode.canceled) return null;
      throw const ApiException(message: 'Đăng nhập Google thất bại');
    } on FirebaseException catch (_) {
      throw const ApiException(message: 'Đăng nhập Google thất bại');
    }
  }

  static Future<void> signOut() async {
    try {
      await GoogleSignIn.instance.signOut();
      await FirebaseAuth.instance.signOut();
    } catch (_) {} // chưa đăng nhập Google hoặc Firebase chưa khởi tạo: bỏ qua
  }
}
