import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../data/alert_models.dart';

/// Màn hình Cảnh Báo Đỏ Toàn Màn Hình khẩn cấp (Story 5.1 - AC3)
class EmergencyAlertScreen extends StatefulWidget {
  final AlertModel alert;

  const EmergencyAlertScreen({super.key, required this.alert});

  @override
  State<EmergencyAlertScreen> createState() => _EmergencyAlertScreenState();
}

class _EmergencyAlertScreenState extends State<EmergencyAlertScreen>
    with SingleTickerProviderStateMixin {
  late AnimationController _animController;
  late Animation<double> _scaleAnimation;

  @override
  void initState() {
    super.initState();
    // Hiệu ứng nhịp đập cảnh báo khẩn cấp
    _animController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 700),
    )..repeat(reverse: true);

    _scaleAnimation = Tween<double>(begin: 0.95, end: 1.08).animate(
      CurvedAnimation(parent: _animController, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _animController.dispose();
    super.dispose();
  }

  void _dismissAlarm() {
    // Tắt cảnh báo và đóng màn hình
    Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    final alert = widget.alert;
    final isExtreme = alert.severity.toLowerCase() == 'extreme';

    return PopScope(
      canPop: false, // Không cho phép back bằng nút vật lý khi chưa bấm xác nhận
      child: Scaffold(
        backgroundColor: const Color(0xFF7F1D1D), // Đỏ sẫm khẩn cấp
        body: SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 20.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Spacer(flex: 1),

                // Pulsing Icon
                ScaleTransition(
                  scale: _scaleAnimation,
                  child: Container(
                    width: 110,
                    height: 110,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: AppColors.danger,
                      boxShadow: [
                        BoxShadow(
                          color: AppColors.danger.withValues(alpha: 0.6),
                          blurRadius: 30,
                          spreadRadius: 8,
                        ),
                      ],
                    ),
                    child: const Icon(
                      Icons.warning_rounded,
                      size: 65,
                      color: Colors.white,
                    ),
                  ),
                ),
                const SizedBox(height: 24),

                // Danger Level Badge
                Center(
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                    decoration: BoxDecoration(
                      color: isExtreme ? Colors.black.withValues(alpha: 0.4) : AppColors.warning.withValues(alpha: 0.3),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: Colors.white, width: 1.5),
                    ),
                    child: Text(
                      isExtreme ? 'CẤP ĐỘ NGUY HIỂM: CỰC KỲ NGUY CẤP (EXTREME)' : 'CẤP ĐỘ NGUY HIỂM: CAO (HIGH)',
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.bold,
                        fontSize: 12,
                        letterSpacing: 1.1,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 16),

                // Alert Title & Area
                Text(
                  alert.title,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 22,
                    fontWeight: FontWeight.w900,
                    height: 1.2,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  'Khu vực: ${alert.areaName}',
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    color: Color(0xFFFCA5A5),
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 20),

                // Warning Message Box
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.black.withValues(alpha: 0.35),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: Colors.white24),
                  ),
                  child: Column(
                    children: [
                      Text(
                        alert.message,
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 15,
                          height: 1.4,
                        ),
                      ),
                      const Divider(color: Colors.white24, height: 24),
                      const Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Icon(Icons.directions_run, color: Colors.amberAccent, size: 24),
                          SizedBox(width: 10),
                          Expanded(
                            child: Text(
                              'HƯỚNG DẪN SƠ TÁN KHẨN CẤP:\n'
                              '1. Di chuyển ngay tới vị trí cao hơn, tránh xa chân đồi, sườn dốc và lòng khe suối.\n'
                              '2. Mang theo giấy tờ quan trọng và đèn pin.\n'
                              '3. Tuyệt đối không nán lại vớt tài sản ven suối.',
                              style: TextStyle(
                                color: Colors.white,
                                fontSize: 13,
                                height: 1.4,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),

                const Spacer(flex: 2),

                // Acknowledge & Silence Button
                ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.white,
                    foregroundColor: const Color(0xFF991B1B),
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(30),
                    ),
                    elevation: 6,
                  ),
                  onPressed: _dismissAlarm,
                  child: const Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.volume_off, size: 22, color: Color(0xFF991B1B)),
                      SizedBox(width: 8),
                      Text(
                        'Tôi Đã Nắm Rõ & Tắt Báo Động',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFF991B1B),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 10),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
