import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Hồ sơ')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            // Avatar + name
            Center(
              child: Column(children: [
                Container(
                  width: 72, height: 72,
                  decoration: const BoxDecoration(color: AppColors.primary, shape: BoxShape.circle),
                  child: const Center(child: Text('HM', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w700, color: Colors.white))),
                ),
                const SizedBox(height: 12),
                const Text('Hoàng Văn Minh', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
                const SizedBox(height: 4),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(color: AppColors.primaryLight, borderRadius: BorderRadius.circular(20)),
                  child: const Text('Bản Vược, Bát Xát', style: TextStyle(fontSize: 12, color: AppColors.primary, fontWeight: FontWeight.w500)),
                ),
              ]),
            ),
            const SizedBox(height: 24),
            // Notification settings
            const _SettingsSection(title: 'Cài đặt thông báo', children: [
              _ToggleRow(label: 'Nhận cảnh báo qua SMS'),
              _ToggleRow(label: 'Nhận thông báo app'),
              _ToggleRow(label: 'Bán kính 2.5 km'),
            ]),
            const SizedBox(height: 12),
            // Stats
            const _SettingsSection(title: 'Thống kê', children: [
              _InfoRow(label: 'Cảnh báo đã nhận', value: '3'),
              _InfoRow(label: 'Báo cáo đã gửi', value: '2'),
            ]),
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton(
                onPressed: () {},
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
    );
  }
}

// ── Shared widgets ─────────────────────────────────────────────────────────

class _SettingsSection extends StatelessWidget {
  final String title;
  final List<Widget> children;
  const _SettingsSection({required this.title, required this.children});

  @override
  Widget build(BuildContext context) => Container(
    decoration: BoxDecoration(color: AppColors.cardSurface, borderRadius: BorderRadius.circular(12), border: Border.all(color: AppColors.border)),
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Padding(
        padding: const EdgeInsets.fromLTRB(14, 12, 14, 6),
        child: Text(title.toUpperCase(), style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: AppColors.textMuted, letterSpacing: 0.6)),
      ),
      ...children.map((c) => Column(children: [Container(height: 1, color: AppColors.border), c])),
    ]),
  );
}

class _ToggleRow extends StatefulWidget {
  final String label;
  const _ToggleRow({required this.label});

  @override
  State<_ToggleRow> createState() => _ToggleRowState();
}

class _ToggleRowState extends State<_ToggleRow> {
  bool _value = true;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
    child: Row(children: [
      Expanded(child: Text(widget.label, style: const TextStyle(fontSize: 13, color: AppColors.textPrimary))),
      Switch(value: _value, onChanged: (v) => setState(() => _value = v), activeThumbColor: AppColors.primary),
    ]),
  );
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

