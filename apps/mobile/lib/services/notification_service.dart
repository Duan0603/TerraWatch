import 'dart:async';
import 'dart:typed_data';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import '../core/storage/local_storage.dart';
import '../features/alerts/data/alert_models.dart';

/// Dịch vụ kích hoạt cảnh báo & thông báo khẩn cấp cục bộ trên máy (Story 5.1 & AC3)
class NotificationService {
  static const alarmChannelId = 'emergency_alarm';

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
    await _createAlarmChannel();
  }

  /// Tạo sẵn kênh còi hú: thông báo FCM khi app đóng chỉ phát đúng còi nếu kênh `emergency_alarm` đã tồn tại
  static Future<void> _createAlarmChannel() async {
    try {
      await _notificationsPlugin
          .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()
          ?.createNotificationChannel(AndroidNotificationChannel(
            alarmChannelId,
            'Cảnh Báo Sạt Lở Khẩn Cấp',
            description: 'Kênh phát cảnh báo nguy hiểm sạt lở đất',
            importance: Importance.max,
            playSound: true,
            sound: const RawResourceAndroidNotificationSound('emergency_siren'),
            audioAttributesUsage: AudioAttributesUsage.alarm,
            enableVibration: true,
            vibrationPattern: Int64List.fromList([0, 1000, 500, 1000, 500, 1500]),
          ));
    } catch (_) {}
  }

  /// Hệ thống có đang cho phép app hiện thông báo không (false thì sẽ không nghe còi); null nếu không xác định được
  static Future<bool?> areEnabled() async {
    try {
      return await _notificationsPlugin
          .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()
          ?.areNotificationsEnabled();
    } catch (_) {
      return null;
    }
  }

  /// Android 13+ chặn thông báo cho tới khi người dùng cho phép; gọi trước khi cần phát còi.
  /// Lỗi (thiết bị không hỗ trợ, môi trường kiểm thử) thì bỏ qua: còi sẽ không phát nhưng ứng dụng vẫn chạy.
  static Future<void> requestPermission() async {
    try {
      await _notificationsPlugin
          .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()
          ?.requestNotificationsPermission();
    } catch (_) {}
  }

  /// Phát thông báo khẩn cấp với độ ưu tiên cao nhất, rung mạnh và còi hú (AC3)
  static Future<void> showEmergencyAlert({
    required String title,
    required String body,
  }) async {
    try {
      final vibrationPattern = Int64List.fromList([0, 1000, 500, 1000, 500, 1500]);
      // Kênh Android không đổi được âm sau khi tạo, nên đổi ID khi đổi âm (kênh cũ 'emergency_channel' chỉ có tiếng "ting")
      final androidDetails = AndroidNotificationDetails(
        alarmChannelId,
        'Cảnh Báo Sạt Lở Khẩn Cấp',
        channelDescription: 'Kênh phát cảnh báo nguy hiểm sạt lở đất',
        importance: Importance.max,
        priority: Priority.high,
        category: AndroidNotificationCategory.alarm,
        fullScreenIntent: true,
        enableVibration: true,
        vibrationPattern: vibrationPattern,
        playSound: true,
        // Còi hú 8 giây (res/raw/emergency_siren.wav) phát trên luồng báo thức, to hơn tiếng thông báo thường
        sound: const RawResourceAndroidNotificationSound('emergency_siren'),
        audioAttributesUsage: AudioAttributesUsage.alarm,
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

  /// Mở màn hình đỏ cho một cảnh báo đã được hệ thống hiện sẵn (người dùng bấm thông báo FCM): chỉ lưu và mở, không phát còi lần nữa
  static Future<void> openAlert(AlertModel alert) async {
    await LocalStorage.insertAlert(alert.toMap());
    _alertStreamController.add(alert);
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
