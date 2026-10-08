import 'dart:async';
import 'dart:typed_data';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import '../core/storage/local_storage.dart';
import '../features/alerts/data/alert_models.dart';

/// Dịch vụ kích hoạt cảnh báo & thông báo khẩn cấp cục bộ trên máy (Story 5.1 & AC3)
class NotificationService {
  static final FlutterLocalNotificationsPlugin _notificationsPlugin =
      FlutterLocalNotificationsPlugin();

  static final StreamController<AlertModel> _alertStreamController =
      StreamController<AlertModel>.broadcast();

  /// Stream lắng nghe sự kiện cảnh báo khẩn cấp để mở EmergencyAlertScreen
  static Stream<AlertModel> get onEmergencyAlert => _alertStreamController.stream;

  static Future<void> initialize() async {
    const androidSettings = AndroidInitializationSettings('@mipmap/ic_launcher');
    const initSettings = InitializationSettings(android: androidSettings);

    await _notificationsPlugin.initialize(
      initSettings,
      onDidReceiveNotificationResponse: (NotificationResponse response) {
        // Có thể mở màn hình chi tiết khi bấm vào thông báo
      },
    );
  }

  /// Phát thông báo khẩn cấp với độ ưu tiên cao nhất, rung mạnh và còi hú (AC3)
  static Future<void> showEmergencyAlert({
    required String title,
    required String body,
  }) async {
    try {
      final vibrationPattern = Int64List.fromList([0, 1000, 500, 1000, 500, 1500]);
      final androidDetails = AndroidNotificationDetails(
        'emergency_channel',
        'Cảnh Báo Sạt Lở Khẩn Cấp',
        channelDescription: 'Kênh phát cảnh báo nguy hiểm sạt lở đất',
        importance: Importance.max,
        priority: Priority.high,
        fullScreenIntent: true,
        enableVibration: true,
        vibrationPattern: vibrationPattern,
        playSound: true,
      );

      final details = NotificationDetails(android: androidDetails);
      await _notificationsPlugin.show(
        DateTime.now().millisecondsSinceEpoch ~/ 1000,
        title,
        body,
        details,
      );
    } catch (_) {
      // Tránh crash nếu chưa cấp quyền POST_NOTIFICATIONS trên Android 13+
    }
  }

  /// Kích hoạt chuông còi báo động khẩn cấp, lưu vào SQLite và phát sự kiện mở màn hình đỏ
  static Future<void> triggerEmergencyAlarm(AlertModel alert) async {
    // 1. Lưu vào SQLite cục bộ (AC4)
    await LocalStorage.insertAlert(alert.toMap());

    // 2. Kích hoạt thông báo đẩy hệ điều hành
    await showEmergencyAlert(
      title: alert.title,
      body: '${alert.areaName}: ${alert.message}',
    );

    // 3. Bắn event vào Stream để UI hiển thị toàn màn hình khẩn cấp (AC3)
    _alertStreamController.add(alert);
  }
}
