import 'package:flutter/material.dart';
import 'app.dart';
import 'services/notification_service.dart';
import 'core/storage/local_storage.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Khởi tạo các dịch vụ nền tảng cốt lõi
  await NotificationService.initialize();
  await LocalStorage.database; // Mở kết nối SQLite

  runApp(const GeoSentryApp());
}
