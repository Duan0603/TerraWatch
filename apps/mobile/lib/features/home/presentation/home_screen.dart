import 'dart:async';
import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/primary_button.dart';
import '../../../core/storage/local_storage.dart';
import '../../../services/notification_service.dart';
import '../../report/presentation/report_screen.dart';
import '../../alerts/presentation/alerts_screen.dart';
import '../../alerts/presentation/subscription_screen.dart';
import '../../alerts/presentation/emergency_alert_screen.dart';
import '../../alerts/data/alerts_repository.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _hazardCount = 0;
  StreamSubscription? _alertSubscription;

  @override
  void initState() {
    super.initState();
    _loadHazardCount();
    _registerFcmDevice();
    _listenEmergencyAlerts();
  }

  @override
  void dispose() {
    _alertSubscription?.cancel();
    super.dispose();
  }

  /// AC2: Đăng ký FCM Device Token khi mở ứng dụng
  Future<void> _registerFcmDevice() async {
    final repo = AlertsRepository();
    // Giả lập FCM token nhận được từ Firebase Messaging
    await repo.registerDeviceToken('fcm_token_android_pixel_001');
  }

  /// AC3: Lắng nghe tín hiệu cảnh báo khẩn cấp để mở Full-Screen Intent
  void _listenEmergencyAlerts() {
    _alertSubscription = NotificationService.onEmergencyAlert.listen((alert) {
      if (mounted) {
        Navigator.push(
          context,
          MaterialPageRoute(
            fullscreenDialog: true,
            builder: (_) => EmergencyAlertScreen(alert: alert),
          ),
        );
      }
    });
  }

  Future<void> _loadHazardCount() async {
    final count = await LocalStorage.getHazardCount();
    if (mounted) {
      setState(() {
        _hazardCount = count;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('GeoSentry Cảnh Báo Sạt Lở'),
        actions: [
          IconButton(
            icon: const Icon(Icons.notifications_outlined),
            tooltip: 'Lịch sử cảnh báo',
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const AlertsScreen()),
              );
            },
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Status Card (Geofencing Offline)
            Card(
              child: Padding(
                padding: const EdgeInsets.all(20.0),
                child: Column(
                  children: [
                    const Icon(Icons.shield_outlined, color: AppColors.safe, size: 56),
                    const SizedBox(height: 12),
                    const Text(
                      'Geofencing Ngoại Tuyến: Đang Hoạt Động',
                      textAlign: TextAlign.center,
                      style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      'Đã nạp $_hazardCount đa giác sạt lở vào SQLite thiết bị\n(Tự động hú còi khi mất sóng 4G/WiFi)',
                      textAlign: TextAlign.center,
                      style: const TextStyle(color: AppColors.textSecondary, fontSize: 13),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 24),

            // Quick Actions
            PrimaryButton(
              label: 'Báo Cáo Hiện Trường (Ảnh + GPS)',
              icon: Icons.camera_alt_outlined,
              onPressed: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const ReportScreen()),
                );
              },
            ),
            const SizedBox(height: 12),

            PrimaryButton(
              label: 'Đăng Ký Vùng Nhận Cảnh Báo (AOI)',
              icon: Icons.add_alert_outlined,
              backgroundColor: AppColors.primaryDark,
              onPressed: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const SubscriptionScreen()),
                );
              },
            ),
            const SizedBox(height: 12),

            PrimaryButton(
              label: 'Trung Tâm Lịch Sử Cảnh Báo',
              icon: Icons.warning_amber_rounded,
              backgroundColor: AppColors.cardSurfaceLight,
              onPressed: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const AlertsScreen()),
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}
