import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/primary_button.dart';
import '../data/alert_models.dart';
import '../data/alerts_repository.dart';

/// Màn hình đăng ký số điện thoại và vùng nhận cảnh báo khẩn cấp (Story 5.1 - AC1 & AC5)
class SubscriptionScreen extends StatefulWidget {
  const SubscriptionScreen({super.key});

  @override
  State<SubscriptionScreen> createState() => _SubscriptionScreenState();
}

class _SubscriptionScreenState extends State<SubscriptionScreen> {
  final _formKey = GlobalKey<FormState>();
  final _phoneController = TextEditingController(text: '0912345678');
  final _alertsRepo = AlertsRepository();

  List<Map<String, dynamic>> _areas = [];
  String? _selectedAreaId;
  String? _selectedAreaName;
  bool _receivePush = true;
  bool _receiveSms = true;
  bool _isLoadingAreas = true;
  bool _isSubmitting = false;

  @override
  void initState() {
    super.initState();
    _loadAreas();
  }

  @override
  void dispose() {
    _phoneController.dispose();
    super.dispose();
  }

  Future<void> _loadAreas() async {
    final areas = await _alertsRepo.fetchMonitoringAreas();
    if (mounted) {
      setState(() {
        _areas = areas;
        if (areas.isNotEmpty) {
          _selectedAreaId = areas.first['id']?.toString();
          _selectedAreaName = areas.first['name']?.toString();
        }
        _isLoadingAreas = false;
      });
    }
  }

  Future<void> _submitSubscription() async {
    if (!_formKey.currentState!.validate()) return;
    if (_selectedAreaId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Vui lòng chọn khu vực theo dõi')),
      );
      return;
    }

    final channels = <String>[];
    if (_receivePush) channels.add('PUSH');
    if (_receiveSms) channels.add('SMS');

    if (channels.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Vui lòng chọn ít nhất một kênh nhận tin (Push hoặc SMS)')),
      );
      return;
    }

    setState(() => _isSubmitting = true);

    final model = SubscriptionModel(
      phoneNumber: _phoneController.text.trim(),
      areaId: _selectedAreaId!,
      areaName: _selectedAreaName ?? '',
      alertChannels: channels,
    );

    final success = await _alertsRepo.subscribeAlerts(model);

    if (mounted) {
      setState(() => _isSubmitting = false);
      if (success) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            backgroundColor: AppColors.safe,
            content: Text('✅ Đăng ký nhận cảnh báo thành công!'),
          ),
        );
        Navigator.pop(context, _selectedAreaName ?? 'Vùng vừa đăng ký');
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            backgroundColor: AppColors.danger,
            content: Text('Không thể kết nối máy chủ. Đã lưu cấu hình dự phòng.'),
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Đăng Ký Vùng Cảnh Báo'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Privacy protection banner (NFR5)
              Container(
                padding: const EdgeInsets.all(14.0),
                decoration: BoxDecoration(
                  color: AppColors.cardSurface,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: AppColors.safe.withValues(alpha: 0.4)),
                ),
                child: const Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(Icons.privacy_tip_outlined, color: AppColors.safe, size: 24),
                    SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        'Bảo mật danh tính (NFR5): Hệ thống chỉ phát cảnh báo theo vùng đăng ký tĩnh bạn chọn. Tuyệt đối KHÔNG theo dõi hay gửi vị trí GPS thời gian thực của bạn lên máy chủ.',
                        style: TextStyle(fontSize: 12.5, color: AppColors.textSecondary, height: 1.4),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),

              // Phone number input
              const Text(
                'Số Điện Thoại Nhận Cảnh Báo',
                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
              ),
              const SizedBox(height: 8),
              TextFormField(
                controller: _phoneController,
                keyboardType: TextInputType.phone,
                decoration: const InputDecoration(
                  hintText: 'Nhập số điện thoại (ví dụ: 0912345678)',
                  prefixIcon: Icon(Icons.phone_android),
                  filled: true,
                  fillColor: AppColors.cardSurface,
                ),
                validator: (val) {
                  if (val == null || val.trim().isEmpty) return 'Vui lòng nhập số điện thoại';
                  if (val.trim().length < 9) return 'Số điện thoại không hợp lệ';
                  return null;
                },
              ),
              const SizedBox(height: 20),

              // Area selection dropdown
              const Text(
                'Khu Vực / Vùng Giám Sát Cần Theo Dõi (AOI)',
                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
              ),
              const SizedBox(height: 8),
              if (_isLoadingAreas)
                const Center(child: Padding(
                  padding: EdgeInsets.all(16.0),
                  child: CircularProgressIndicator(strokeWidth: 2),
                ))
              else
                DropdownButtonFormField<String>(
                  initialValue: _selectedAreaId,
                  dropdownColor: AppColors.cardSurface,
                  decoration: const InputDecoration(
                    prefixIcon: Icon(Icons.location_city_outlined),
                    filled: true,
                    fillColor: AppColors.cardSurface,
                  ),
                  items: _areas.map((area) {
                    final id = area['id']?.toString() ?? '';
                    final name = area['name']?.toString() ?? 'Khu vực';
                    final prov = area['province']?.toString() ?? '';
                    final title = prov.isNotEmpty ? '$name ($prov)' : name;
                    return DropdownMenuItem<String>(
                      value: id,
                      child: Text(title, overflow: TextOverflow.ellipsis),
                    );
                  }).toList(),
                  onChanged: (val) {
                    setState(() {
                      _selectedAreaId = val;
                      final selected = _areas.firstWhere(
                        (a) => a['id']?.toString() == val,
                        orElse: () => {},
                      );
                      _selectedAreaName = selected['name']?.toString() ?? '';
                    });
                  },
                ),
              const SizedBox(height: 20),

              // Channel switches
              const Text(
                'Kênh Tiếp Nhận Cảnh Báo Khẩn Cấp',
                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
              ),
              const SizedBox(height: 8),
              Card(
                color: AppColors.cardSurface,
                child: Column(
                  children: [
                    SwitchListTile(
                      activeThumbColor: AppColors.primary,
                      title: const Text('Thông báo đẩy ứng dụng (FCM Push)'),
                      subtitle: const Text('Bật còi hú và hiển thị màn hình đỏ khẩn cấp'),
                      value: _receivePush,
                      onChanged: (v) => setState(() => _receivePush = v),
                    ),
                    const Divider(height: 1),
                    SwitchListTile(
                      activeThumbColor: AppColors.primary,
                      title: const Text('Tin nhắn SMS Khẩn cấp'),
                      subtitle: const Text('Hữu ích khi điện thoại ở vùng mất 4G/WiFi'),
                      value: _receiveSms,
                      onChanged: (v) => setState(() => _receiveSms = v),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 28),

              // Submit button
              PrimaryButton(
                label: 'Lưu Đăng Ký Cảnh Báo',
                icon: Icons.check_circle_outline,
                isLoading: _isSubmitting,
                onPressed: _submitSubscription,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
