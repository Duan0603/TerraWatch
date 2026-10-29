import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/storage/local_storage.dart';
import '../../../services/notification_service.dart';
import '../data/alert_models.dart';
import '../data/alerts_repository.dart';
import 'subscription_screen.dart';
import 'emergency_alert_screen.dart';

/// Màn hình quản lý đăng ký & lịch sử cảnh báo khẩn cấp (Story 5.1 - AC4)
class AlertsScreen extends StatefulWidget {
  final AlertsRepository? repository;
  final Future<bool?> Function()? notificationsEnabled;
  final DateTime Function()? clock;

  const AlertsScreen({super.key, this.repository, this.notificationsEnabled, this.clock});

  @override
  State<AlertsScreen> createState() => _AlertsScreenState();
}

class _AlertsScreenState extends State<AlertsScreen> {
  late final AlertsRepository _alertsRepo = widget.repository ?? AlertsRepository();
  List<AlertModel> _alertHistory = [];
  bool _isLoading = true;
  bool _notificationsBlocked = false;
  String _currentSubscribedArea = 'Xã Bản Hồ, Sa Pa, Lào Cai';

  @override
  void initState() {
    super.initState();
    _loadAlertHistory();
    _resyncThenReload();
    _checkNotifications();
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

  /// Bù các cảnh báo lỡ push và cập nhật thu hồi/hết hạn từ máy chủ; không có mạng thì giữ lịch sử trên máy
  Future<void> _resyncThenReload() async {
    try {
      await _alertsRepo.resync();
    } catch (_) {}
    if (mounted) await _loadAlertHistory();
  }

  Future<void> _checkNotifications() async {
    final enabled = await (widget.notificationsEnabled ?? NotificationService.areEnabled)();
    if (mounted) setState(() => _notificationsBlocked = enabled == false);
  }

  Future<void> _enableNotifications() async {
    await NotificationService.requestPermission();
    await _checkNotifications();
    if (_notificationsBlocked) await Geolocator.openAppSettings(); // đã bị từ chối hẳn: chỉ bật được trong Cài đặt
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
        onRefresh: _resyncThenReload,
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (_notificationsBlocked)
                Card(
                  color: AppColors.cardSurface,
                  child: Padding(
                    padding: const EdgeInsets.all(14),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      const Row(children: [
                        Icon(Icons.notifications_off_outlined, color: AppColors.warning),
                        SizedBox(width: 10),
                        Expanded(
                          child: Text('Thông báo của TerraWatch đang bị tắt',
                              style: TextStyle(fontWeight: FontWeight.bold)),
                        ),
                      ]),
                      const SizedBox(height: 6),
                      const Text(
                        'Bạn sẽ không nghe còi và không thấy cảnh báo khi app đóng. Hãy bật thông báo cho TerraWatch.',
                        style: TextStyle(color: AppColors.textSecondary, fontSize: 13),
                      ),
                      const SizedBox(height: 8),
                      OutlinedButton(onPressed: _enableNotifications, child: const Text('Bật thông báo')),
                    ]),
                  ),
                ),
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
                      Icon(Icons.inbox_outlined, color: AppColors.textMuted, size: 48),
                      SizedBox(height: 12),
                      Text(
                        'Chưa có cảnh báo nào',
                        style: TextStyle(fontWeight: FontWeight.bold),
                      ),
                      SizedBox(height: 4),
                      Text(
                        'Chưa nhận bản tin nào. Việc chưa có cảnh báo không phải xác nhận an toàn.',
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
                    final state = item.stateAt((widget.clock ?? DateTime.now)());
                    final issued = formatAlertTime(item.issuedAt ?? item.receivedAt);
                    final until = formatAlertTime(item.validUntil);

                    return Opacity(
                      opacity: state == AlertState.active ? 1 : 0.6,
                      child: Card(
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
                                  const SizedBox(width: 8),
                                  _StateChip(state),
                                  const Spacer(),
                                  Text(
                                    issued ?? '',
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
                              if (until != null) ...[
                                const SizedBox(height: 6),
                                Text('Hiệu lực đến $until',
                                    style: const TextStyle(color: AppColors.textMuted, fontSize: 12)),
                              ],
                            ],
                          ),
                        ),
                      ),
                    ));
                  },
                ),
            ],
          ),
        ),
      ),
    );
  }
}

/// dd/MM HH:mm theo giờ địa phương; null nếu thiếu hoặc sai dạng
String? formatAlertTime(String? iso) {
  final t = iso == null ? null : DateTime.tryParse(iso)?.toLocal();
  if (t == null) return null;
  String two(int n) => n.toString().padLeft(2, '0');
  return '${two(t.day)}/${two(t.month)} ${two(t.hour)}:${two(t.minute)}';
}

class _StateChip extends StatelessWidget {
  final AlertState state;
  const _StateChip(this.state);

  @override
  Widget build(BuildContext context) {
    final (label, color) = switch (state) {
      AlertState.active => ('Còn hiệu lực', AppColors.primary),
      AlertState.expired => ('Đã hết hạn', AppColors.textMuted),
      AlertState.revoked => ('Đã thu hồi', AppColors.warning),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        border: Border.all(color: color),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(label, style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w600, color: color)),
    );
  }
}
