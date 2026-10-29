import 'dart:async';
import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/primary_button.dart';
import '../../../core/storage/local_storage.dart';
import '../../../services/notification_service.dart';
import '../../geofence/presentation/geofence_screen.dart';
import '../../report/presentation/report_screen.dart';
import '../../alerts/presentation/alerts_screen.dart';
import '../../alerts/presentation/subscription_screen.dart';
import '../../alerts/presentation/emergency_alert_screen.dart';

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
    _listenEmergencyAlerts();
  }

  @override
  void dispose() {
    _alertSubscription?.cancel();
    super.dispose();
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
        title: const Text('TerraWatch'),
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
            // Geofencing ngoại tuyến: số vùng dự báo đã lưu; bấm để kiểm tra vị trí (Story 5.3)
            Card(
              child: InkWell(
                borderRadius: BorderRadius.circular(12),
                onTap: () async {
                  await Navigator.push(context, MaterialPageRoute(builder: (_) => const GeofenceScreen()));
                  _loadHazardCount();
                },
                child: Padding(
                  padding: const EdgeInsets.all(20.0),
                  child: Column(
                    children: [
                      const Icon(Icons.my_location, color: AppColors.primary, size: 48),
                      const SizedBox(height: 12),
                      const Text(
                        'Cảnh báo vị trí ngoại tuyến',
                        textAlign: TextAlign.center,
                        style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        _hazardCount == 0
                            ? 'Chưa có vùng dự báo trên máy. Bấm để đồng bộ khi có mạng.'
                            : 'Đã lưu $_hazardCount vùng dự báo trên máy. Bấm để kiểm tra vị trí của bạn.',
                        textAlign: TextAlign.center,
                        style: const TextStyle(color: AppColors.textSecondary, fontSize: 13),
                      ),
                    ],
                  ),
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
