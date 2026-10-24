import 'package:flutter/material.dart';
import '../../../core/network/api_exceptions.dart';
import '../../../core/storage/local_storage.dart';
import '../../../core/storage/session.dart';
import '../../../core/theme/app_colors.dart';
import '../../alerts/data/alert_models.dart';
import '../../alerts/data/alerts_repository.dart';
import '../../alerts/presentation/subscription_screen.dart';
import '../../auth/data/auth_models.dart';
import '../../auth/data/auth_repository.dart';
import 'change_password_screen.dart';
import 'edit_profile_screen.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  final _alerts = AlertsRepository();
  List<SubscribedArea>? _subscriptions;
  String? _subscriptionsError;
  int _alertCount = 0;

  @override
  void initState() {
    super.initState();
    _loadSubscriptions();
    _loadAlertCount();
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
              _Header(user: user),
              const SizedBox(height: 20),
              _SettingsSection(title: 'Tài khoản', children: [
                _ActionRow(
                  icon: Icons.edit_outlined,
                  label: 'Chỉnh sửa hồ sơ',
                  onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const EditProfileScreen())),
                ),
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
  const _Header({required this.user});

  @override
  Widget build(BuildContext context) {
    final phone = user?.phoneNumber;
    return Center(
      child: Column(children: [
        Container(
          width: 72,
          height: 72,
          decoration: const BoxDecoration(color: AppColors.primary, shape: BoxShape.circle),
          child: Center(
            child: Text(user?.initials ?? '?',
                style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w700, color: Colors.white)),
          ),
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
        const SizedBox(height: 4),
        Text(phone == null || phone.isEmpty ? 'Chưa có số điện thoại' : phone,
            style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
      ]),
    );
  }
}

class _SettingsSection extends StatelessWidget {
  final String title;
  final List<Widget> children;
  const _SettingsSection({required this.title, required this.children});

  @override
  Widget build(BuildContext context) => Container(
        decoration: BoxDecoration(
            color: AppColors.cardSurface,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppColors.border)),
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
