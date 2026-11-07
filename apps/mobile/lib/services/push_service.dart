import 'dart:async';
import 'package:firebase_messaging/firebase_messaging.dart';
import '../features/alerts/data/alert_models.dart';
import '../features/alerts/data/alerts_repository.dart';
import 'notification_service.dart';

/// Nhận cảnh báo đẩy (FCM) cho tài khoản đang đăng nhập (Story 5.1).
/// Mọi lỗi (chưa cấp quyền, Firebase không sẵn sàng, mất mạng) bị nuốt: app vẫn chạy và lần đồng bộ sau sẽ bù lại.
class PushService {
  PushService._();

  static const _emergencyType = 'EMERGENCY_ALERT';

  static final _repo = AlertsRepository();
  static final _subscriptions = <StreamSubscription<dynamic>>[];
  static String? _token;

  /// Gọi sau khi đăng nhập: xin quyền thông báo, đăng ký token lên máy chủ, lắng nghe push, rồi đồng bộ lại lịch sử
  static Future<void> start() async {
    try {
      final messaging = FirebaseMessaging.instance;
      await messaging.requestPermission(); // Android 13+ hỏi quyền; bản cũ hơn tự cho phép
      // shortcut: getToken/onTokenRefresh are deprecated in firebase_messaging 17 (register/onRegistered give a Firebase
      // Installation ID); the classic registration token is what the backend's FCM HTTP v1 sender targets. Switch after verifying FID direct send.
      // ignore: deprecated_member_use
      _token = await messaging.getToken();
      if (_token != null) await _repo.registerDeviceToken(_token!);
      if (_subscriptions.isEmpty) {
        _subscriptions.addAll([
          // ignore: deprecated_member_use
          messaging.onTokenRefresh.listen((token) {
            _token = token;
            _repo.registerDeviceToken(token);
          }),
          FirebaseMessaging.onMessage.listen(_onForeground),
          FirebaseMessaging.onMessageOpenedApp.listen(_onOpened),
        ]);
      }
      final launchedBy = await messaging.getInitialMessage(); // app đang đóng, người dùng bấm thông báo để mở
      if (launchedBy != null) await _onOpened(launchedBy);
    } catch (_) {}
    await resync();
  }

  /// Gỡ token của máy khỏi tài khoản, phải gọi trước khi xóa phiên đăng nhập; lỗi thì bỏ qua
  static Future<void> stop() async {
    final token = _token;
    for (final subscription in _subscriptions) {
      await subscription.cancel();
    }
    _subscriptions.clear();
    _token = null;
    if (token != null) await _repo.unregisterDeviceToken(token);
  }

  /// Bù các cảnh báo lỡ push và cập nhật thu hồi/hết hạn; không có mạng thì giữ nguyên lịch sử trên máy
  static Future<void> resync() async {
    try {
      await _repo.resync();
    } catch (_) {}
  }

  static Future<void> _onForeground(RemoteMessage message) async {
    final alert = _alertFrom(message);
    if (alert != null) await NotificationService.triggerEmergencyAlarm(alert);
  }

  static Future<void> _onOpened(RemoteMessage message) async {
    final alert = _alertFrom(message);
    if (alert != null) await NotificationService.openAlert(alert);
  }

  static AlertModel? _alertFrom(RemoteMessage message) {
    if (message.data['type'] != _emergencyType) return null;
    return AlertModel.fromFcmPayload(message.data);
  }
}
