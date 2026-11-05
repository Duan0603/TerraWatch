import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/storage/local_storage.dart';
import '../../../services/notification_service.dart';
import '../data/alert_models.dart';
import '../data/alerts_repository.dart';
import 'subscription_screen.dart';
import 'emergency_alert_screen.dart';

/// Màn hình quản lý đăng ký & lịch sử cảnh báo khẩn cấp (Story 5.1 - AC4)
class AlertsScreen extends StatefulWidget {
  const AlertsScreen({super.key});

  @override
  State<AlertsScreen> createState() => _AlertsScreenState();
}

class _AlertsScreenState extends State<AlertsScreen> {
  final _alertsRepo = AlertsRepository();
  List<AlertModel> _alertHistory = [];
  bool _isLoading = true;
  String _currentSubscribedArea = 'Xã Bản Hồ, Sa Pa, Lào Cai';

  @override
  void initState() {
    super.initState();
    _loadAlertHistory();
  }

  Future<void> _loadAlertHistory() async {
    setState(() => _isLoading = true);
    final history = await _alertsRepo.getAlertHistory();
    if (mounted) {
      setState(() {
        _alertHistory = history;
        _isLoading = false;
      });
    }
  }

  Future<void> _openSubscription() async {
    final result = await Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => const SubscriptionScreen()),
    );
    if (result is String && result.isNotEmpty) {
      setState(() {
        _currentSubscribedArea = result;
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: AppColors.primary,
            content: Text('Đã cập nhật vùng nhận cảnh báo: $_currentSubscribedArea'),
          ),
        );
      }
    }
  }

  /// Mô phỏng nhận bản tin cảnh báo khẩn cấp từ FCM Push (Dành cho kiểm thử AC3 & AC4)
  Future<void> _simulateEmergencyAlert() async {
    final mockAlert = AlertModel.fromFcmPayload({
      'broadcastId': 'test-bc-${DateTime.now().millisecondsSinceEpoch}',
      'title': '🚨 LỆNH SƠ TÁN KHẨN CẤP: NGUY CƠ LŨ QUÉT & SẠT LỞ ĐẤT',
      'message': 'Cảnh báo mức độ đặc biệt nghiêm trọng tại sườn dốc phía Tây. Yêu cầu toàn bộ nhân dân sơ tán đến nhà văn hóa hoặc trường học kiên cố ngay lập tức!',
      'severity': 'extreme',
      'areaName': _currentSubscribedArea,
    });

    try {
      // 1. Kích hoạt còi hú & lưu SQLite
      await NotificationService.triggerEmergencyAlarm(mockAlert);
    } catch (_) {}

    // 2. Mở toàn màn hình đỏ khẩn cấp
    if (mounted) {
      await Navigator.push(
        context,
        MaterialPageRoute(
          fullscreenDialog: true,
          builder: (_) => EmergencyAlertScreen(alert: mockAlert),
        ),
      );

      // 3. Sau khi người dùng tắt báo động và đóng màn hình đỏ, tải lại danh sách SQLite
      if (mounted) {
        await _loadAlertHistory();
      }
    }
  }

  Future<void> _clearHistory() async {
    await LocalStorage.clearAlertHistory();
    await _loadAlertHistory();
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Đã xóa sạch lịch sử cảnh báo.')),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Trung Tâm Cảnh Báo'),
        actions: [
          IconButton(
            tooltip: 'Xóa sạch lịch sử',
            icon: const Icon(Icons.delete_outline),
            onPressed: _alertHistory.isEmpty ? null : _clearHistory,
          ),
          IconButton(
            tooltip: 'Cài đặt vùng nhận tin',
            icon: const Icon(Icons.settings_outlined),
            onPressed: _openSubscription,
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _loadAlertHistory,
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Banner Đăng Ký Vùng
              Card(
                color: AppColors.cardSurface,
                child: Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: Row(
                    children: [
                      const Icon(Icons.notifications_active, color: AppColors.primary, size: 36),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'Đăng Ký Vùng Nhận Tin',
                              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              'Đang theo dõi: $_currentSubscribedArea',
                              style: const TextStyle(fontSize: 12.5, color: AppColors.safe, fontWeight: FontWeight.w600),
                            ),
                          ],
                        ),
                      ),
                      IconButton(
                        icon: const Icon(Icons.arrow_forward_ios, size: 16),
                        onPressed: _openSubscription,
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 12),

              // Button Test Mô Phỏng Cảnh Báo
              OutlinedButton.icon(
                style: OutlinedButton.styleFrom(
                  foregroundColor: AppColors.danger,
                  side: const BorderSide(color: AppColors.danger),
                  padding: const EdgeInsets.symmetric(vertical: 12),
                ),
                icon: const Icon(Icons.volume_up_outlined),
                label: const Text('Mô Phỏng Cảnh Báo Đỏ Khẩn Cấp (Test Alert)'),
                onPressed: _simulateEmergencyAlert,
              ),
              const SizedBox(height: 24),

              // Header Lịch Sử Cảnh Báo
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Lịch Sử Cảnh Báo Đã Nhận',
                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                  ),
                  Text(
                    '${_alertHistory.length} bản tin',
                    style: const TextStyle(color: AppColors.textSecondary, fontSize: 13),
                  ),
                ],
              ),
              const SizedBox(height: 12),

              if (_isLoading)
                const Center(
                  child: Padding(
                    padding: EdgeInsets.all(32.0),
                    child: CircularProgressIndicator(strokeWidth: 2),
                  ),
                )
              else if (_alertHistory.isEmpty)
                Container(
                  padding: const EdgeInsets.all(32.0),
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: AppColors.cardSurface,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Column(
                    children: [
                      Icon(Icons.check_circle_outline, color: AppColors.safe, size: 48),
                      SizedBox(height: 12),
                      Text(
                        'Chưa có cảnh báo nguy hiểm nào',
                        style: TextStyle(fontWeight: FontWeight.bold),
                      ),
                      SizedBox(height: 4),
                      Text(
                        'Tất cả các khu vực theo dõi đang trong ngưỡng an toàn.',
                        textAlign: TextAlign.center,
                        style: TextStyle(color: AppColors.textSecondary, fontSize: 13),
                      ),
                    ],
                  ),
                )
              else
                ListView.separated(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  itemCount: _alertHistory.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 10),
                  itemBuilder: (context, index) {
                    final item = _alertHistory[index];
                    final isExtreme = item.severity.toLowerCase() == 'extreme';

                    return Card(
                      color: AppColors.cardSurface,
                      child: InkWell(
                        borderRadius: BorderRadius.circular(12),
                        onTap: () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(
                              fullscreenDialog: true,
                              builder: (_) => EmergencyAlertScreen(alert: item),
                            ),
                          );
                        },
                        child: Padding(
                          padding: const EdgeInsets.all(16.0),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                    decoration: BoxDecoration(
                                      color: isExtreme ? AppColors.danger : AppColors.warning,
                                      borderRadius: BorderRadius.circular(6),
                                    ),
                                    child: Text(
                                      isExtreme ? 'CỰC KỲ NGUY CẤP' : 'CẢNH BÁO CAO',
                                      style: const TextStyle(
                                        fontSize: 10.5,
                                        fontWeight: FontWeight.bold,
                                        color: Colors.white,
                                      ),
                                    ),
                                  ),
                                  const Spacer(),
                                  Text(
                                    item.receivedAt.length >= 16
                                        ? item.receivedAt.substring(0, 16).replaceAll('T', ' ')
                                        : item.receivedAt,
                                    style: const TextStyle(color: AppColors.textMuted, fontSize: 12),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 10),
                              Text(
                                item.title,
                                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                'Khu vực: ${item.areaName}',
                                style: const TextStyle(color: AppColors.primary, fontSize: 13),
                              ),
                              const SizedBox(height: 6),
                              Text(
                                item.message,
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(color: AppColors.textSecondary, fontSize: 13),
                              ),
                            ],
                          ),
                        ),
                      ),
                    );
                  },
                ),
            ],
          ),
        ),
      ),
    );
  }
}
