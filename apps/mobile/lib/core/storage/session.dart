import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../features/auth/data/auth_models.dart';

/// Phiên đăng nhập hiện tại (JWT + hồ sơ), lưu bền vững trên thiết bị.
/// shortcut: lưu SharedPreferences dạng thường, nâng lên flutter_secure_storage trước khi phát hành.
class Session {
  Session._();

  static const _tokenKey = 'auth_token';
  static const _userKey = 'auth_user';

  static String? token;
  static final ValueNotifier<UserProfile?> user = ValueNotifier(null);

  /// Ảnh đại diện đã tải (không lưu bền vững, tải lại khi mở tab Hồ sơ)
  static final ValueNotifier<Uint8List?> avatar = ValueNotifier(null);

  static Future<void> load() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final storedToken = prefs.getString(_tokenKey);
      final storedUser = prefs.getString(_userKey);
      if (storedToken == null || storedUser == null) return;
      token = storedToken;
      user.value = UserProfile.fromJson(jsonDecode(storedUser) as Map<String, dynamic>);
    } catch (_) {
      await clear(); // dữ liệu phiên hỏng -> đăng nhập lại
    }
  }

  static Future<void> save(String newToken, UserProfile profile) async {
    token = newToken;
    user.value = profile;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_tokenKey, newToken);
    await prefs.setString(_userKey, jsonEncode(profile.toJson()));
  }

  static Future<void> clear() async {
    token = null;
    user.value = null;
    avatar.value = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_tokenKey);
    await prefs.remove(_userKey);
  }
}
