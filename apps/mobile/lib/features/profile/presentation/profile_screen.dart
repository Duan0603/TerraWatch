import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import '../../../core/network/api_exceptions.dart';
import '../../../core/storage/local_storage.dart';
import '../../../core/storage/session.dart';
import '../../../core/theme/app_colors.dart';
import '../../alerts/data/alert_models.dart';
import '../../alerts/data/alerts_repository.dart';
import '../../alerts/presentation/subscription_screen.dart';
import '../../auth/data/auth_models.dart';
import '../../auth/data/auth_repository.dart';
import '../../report/data/report_repository.dart';
import '../../report/presentation/my_reports_screen.dart';
import 'change_password_screen.dart';
import 'edit_profile_screen.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  final _alerts = AlertsRepository();
  final _auth = AuthRepository();
  List<SubscribedArea>? _subscriptions;
  String? _subscriptionsError;
  int _alertCount = 0;
  int _reportCount = 0;

  @override
  void initState() {
    super.initState();
    _loadSubscriptions();
    _loadAlertCount();
    _loadAvatar();
  }

  /// Tải ảnh đại diện nếu hồ sơ có ảnh mà chưa có trong bộ nhớ
  Future<void> _loadAvatar() async {
    if (Session.user.value?.hasAvatar != true || Session.avatar.value != null) return;
    try {
      Session.avatar.value = await _auth.fetchAvatar();
    } on ApiException catch (_) {} // lỗi mạng: hiện chữ cái đầu thay cho ảnh
  }

  Future<void> _changeAvatar() async {
    final hasAvatar = Session.user.value?.hasAvatar == true;
    final action = await showModalBottomSheet<String>(
      context: context,
      builder: (sheetContext) => SafeArea(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          ListTile(
            leading: const Icon(Icons.photo_camera_outlined),
            title: const Text('Chụp ảnh'),
            onTap: () => Navigator.pop(sheetContext, 'camera'),
          ),
          ListTile(
            leading: const Icon(Icons.photo_library_outlined),
            title: const Text('Chọn từ thư viện'),
            onTap: () => Navigator.pop(sheetContext, 'gallery'),
          ),
          if (hasAvatar)
            ListTile(
              leading: const Icon(Icons.delete_outline, color: AppColors.danger),
              title: const Text('Xóa ảnh đại diện'),
              onTap: () => Navigator.pop(sheetContext, 'delete'),
            ),
        ]),
      ),
    );
    if (action == null) return;
    try {
      if (action == 'delete') {
        await _auth.deleteAvatar();
        return;
      }
      // Thu nhỏ ngay khi chọn để ảnh gửi lên nhẹ (server giới hạn 200 KB)
      final picked = await ImagePicker().pickImage(
        source: action == 'camera' ? ImageSource.camera : ImageSource.gallery,
        maxWidth: 256,
        maxHeight: 256,
        imageQuality: 80,
      );
      if (picked == null) return;
      await _auth.uploadAvatar(await picked.readAsBytes());
    } on ApiException catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  Future<void> _loadSubscriptions() async {
    try {
      final list = await _alerts.fetchSubscriptions();
      if (mounted) {
        setState(() {
          _subscriptions = list;
          _subscriptionsError = null;
        });
      }
    } on ApiException catch (e) {
      if (mounted) setState(() => _subscriptionsError = e.message);
    }
  }

  Future<void> _loadAlertCount() async {
    final history = await LocalStorage.getAlertHistory();
    if (mounted) setState(() => _alertCount = history.length);
    _loadReportCount();
  }

  Future<void> _loadReportCount() async {
    try {
      final count = await ReportRepository().sentCount();
      if (mounted) setState(() => _reportCount = count);
    } catch (_) {} // chưa có dữ liệu cục bộ: giữ số 0
  }

  Future<void> _openMyReports() async {
    await Navigator.push(context, MaterialPageRoute(builder: (_) => const MyReportsScreen()));
    _loadReportCount();
  }

  Future<void> _removeSubscription(SubscribedArea area) async {
    try {
      await _alerts.deleteSubscription(area.subscriptionId);
      await _loadSubscriptions();
    } on ApiException catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  Future<void> _addArea() async {
    await Navigator.push(context, MaterialPageRoute(builder: (_) => const SubscriptionScreen()));
    _loadSubscriptions();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Hồ sơ')),
      body: ValueListenableBuilder<UserProfile?>(
        valueListenable: Session.user,
        builder: (context, user, _) => SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            children: [
              _Header(user: user, onAvatarTap: _changeAvatar),
              const SizedBox(height: 20),
              _SettingsSection(title: 'Thông tin cá nhân', children: [
                _DetailRow(label: 'Ngày sinh', value: user?.dateOfBirthDisplay),
                _DetailRow(label: 'Giới tính', value: user?.genderLabel),
                _DetailRow(label: 'Số điện thoại', value: user?.phoneNumber),
              ]),
              const SizedBox(height: 12),
              _SettingsSection(title: 'Nơi ở', children: [
                _DetailRow(label: 'Địa chỉ', value: user?.fullAddress),
              ]),
              const SizedBox(height: 12),
              _SettingsSection(title: 'Liên hệ khẩn cấp', children: [
                _DetailRow(label: 'Người thân', value: user?.emergencyContactDisplay),
              ]),
              const SizedBox(height: 12),
              _SettingsSection(title: 'Tài khoản', children: [
                _ActionRow(
                  icon: Icons.edit_outlined,
                  label: 'Chỉnh sửa hồ sơ',
                  onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const EditProfileScreen())),
                ),
                _ActionRow(icon: Icons.assignment_outlined, label: 'Báo cáo của tôi', onTap: _openMyReports),
                if (user?.authProvider == 'email')
                  _ActionRow(
                    icon: Icons.lock_outline,
                    label: 'Đổi mật khẩu',
                    onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const ChangePasswordScreen())),
                  ),
              ]),
              const SizedBox(height: 12),
              _SettingsSection(title: 'Vùng nhận cảnh báo', children: [
                ..._subscriptionRows(),
                _ActionRow(icon: Icons.add_location_alt_outlined, label: 'Thêm vùng', onTap: _addArea),
              ]),
              const SizedBox(height: 12),
              _SettingsSection(title: 'Thống kê', children: [
                _InfoRow(label: 'Cảnh báo đã nhận', value: '$_alertCount'),
                _InfoRow(label: 'Báo cáo đã gửi', value: '$_reportCount'),
              ]),
              const SizedBox(height: 24),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton(
                  onPressed: () => AuthRepository().logout(),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppColors.danger,
                    side: const BorderSide(color: Color(0xFFFECACA)),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                  ),
                  child: const Text('Đăng xuất'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  List<Widget> _subscriptionRows() {
    if (_subscriptionsError != null) {
      return [_Note(_subscriptionsError!, color: AppColors.danger)];
    }
    final list = _subscriptions;
    if (list == null) return [const _Note('Đang tải...')];
    if (list.isEmpty) return [const _Note('Chưa đăng ký vùng nào. Thêm vùng để nhận cảnh báo.')];
    return [
      for (final area in list)
        ListTile(
          dense: true,
          title: Text(area.areaName, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
          subtitle: Text(area.alertChannels.map((c) => c == 'PUSH' ? 'Thông báo app' : 'SMS').join(' · '),
              style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
          trailing: IconButton(
            icon: const Icon(Icons.delete_outline, color: AppColors.danger),
            tooltip: 'Bỏ đăng ký',
            onPressed: () => _removeSubscription(area),
          ),
        ),
    ];
  }
}

class _Header extends StatelessWidget {
  final UserProfile? user;
  final VoidCallback onAvatarTap;
  const _Header({required this.user, required this.onAvatarTap});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(children: [
        GestureDetector(
          onTap: onAvatarTap,
          child: Stack(children: [
            ValueListenableBuilder<Uint8List?>(
              valueListenable: Session.avatar,
              builder: (_, bytes, __) => CircleAvatar(
                radius: 40,
                backgroundColor: AppColors.primary,
                backgroundImage: bytes == null ? null : MemoryImage(bytes),
                child: bytes == null
                    ? Text(user?.initials ?? '?',
                        style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w700, color: Colors.white))
                    : null,
              ),
            ),
            Positioned(
              right: 0,
              bottom: 0,
              child: Container(
                padding: const EdgeInsets.all(5),
                decoration: BoxDecoration(
                  color: AppColors.cardSurface,
                  shape: BoxShape.circle,
                  border: Border.all(color: AppColors.border),
                ),
                child: const Icon(Icons.photo_camera, size: 16, color: AppColors.primary),
              ),
            ),
          ]),
        ),
        const SizedBox(height: 12),
        Text(user?.fullName ?? '',
            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
        const SizedBox(height: 4),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
          decoration: BoxDecoration(color: AppColors.primaryLight, borderRadius: BorderRadius.circular(20)),
          child: Text(user?.email ?? '',
              style: const TextStyle(fontSize: 12, color: AppColors.primary, fontWeight: FontWeight.w500)),
        ),
      ]),
    );
  }
}

// Material (không phải Container có nền) để ListTile bên trong vẽ được hiệu ứng chạm
class _SettingsSection extends StatelessWidget {
  final String title;
  final List<Widget> children;
  const _SettingsSection({required this.title, required this.children});

  @override
  Widget build(BuildContext context) => Material(
        color: AppColors.cardSurface,
        clipBehavior: Clip.antiAlias,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: const BorderSide(color: AppColors.border),
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 12, 14, 6),
            child: Text(title.toUpperCase(),
                style: const TextStyle(
                    fontSize: 10, fontWeight: FontWeight.w700, color: AppColors.textMuted, letterSpacing: 0.6)),
          ),
          ...children.map((c) => Column(children: [Container(height: 1, color: AppColors.border), c])),
        ]),
      );
}

class _ActionRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  const _ActionRow({required this.icon, required this.label, required this.onTap});

  @override
  Widget build(BuildContext context) => ListTile(
        dense: true,
        leading: Icon(icon, size: 20, color: AppColors.primary),
        title: Text(label, style: const TextStyle(fontSize: 13)),
        trailing: const Icon(Icons.chevron_right, size: 18, color: AppColors.textMuted),
        onTap: onTap,
      );
}

class _Note extends StatelessWidget {
  final String text;
  final Color color;
  const _Note(this.text, {this.color = AppColors.textSecondary});

  @override
  Widget build(BuildContext context) =>
      Padding(padding: const EdgeInsets.all(14), child: Text(text, style: TextStyle(fontSize: 12, color: color)));
}

/// Một dòng thông tin chỉ để xem; chưa có dữ liệu thì hiện "Chưa cập nhật"
class _DetailRow extends StatelessWidget {
  final String label;
  final String? value;
  const _DetailRow({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    final hasValue = value != null && value!.isNotEmpty;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        SizedBox(width: 110, child: Text(label, style: const TextStyle(fontSize: 13, color: AppColors.textSecondary))),
        Expanded(
          child: Text(
            hasValue ? value! : 'Chưa cập nhật',
            style: TextStyle(fontSize: 13, color: hasValue ? AppColors.textPrimary : AppColors.textMuted),
          ),
        ),
      ]),
    );
  }
}

class _InfoRow extends StatelessWidget {
  final String label, value;
  const _InfoRow({required this.label, required this.value});

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        child: Row(children: [
          Expanded(child: Text(label, style: const TextStyle(fontSize: 13, color: AppColors.textPrimary))),
          Text(value, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.primary)),
        ]),
      );
}
