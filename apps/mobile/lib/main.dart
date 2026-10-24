import 'package:flutter/material.dart';
import 'app.dart';
import 'services/notification_service.dart';
import 'core/storage/local_storage.dart';
import 'core/storage/session.dart';
import 'features/auth/data/auth_repository.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Khởi tạo các dịch vụ nền tảng cốt lõi
  await NotificationService.initialize();
  await LocalStorage.database; // Mở kết nối SQLite
  await Session.load();
  AuthRepository().refreshProfile(); // xác thực lại phiên ở nền, lỗi mạng thì giữ phiên đã lưu

  runApp(const GeoSentryApp());
}
