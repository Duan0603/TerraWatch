import 'package:flutter/material.dart';
import '../../../core/network/api_exceptions.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/primary_button.dart';
import '../../auth/data/auth_repository.dart';

/// Đổi mật khẩu cho tài khoản đăng ký bằng email (tài khoản Google không có mục này)
class ChangePasswordScreen extends StatefulWidget {
  final AuthRepository? repository;
  const ChangePasswordScreen({super.key, this.repository});

  @override
  State<ChangePasswordScreen> createState() => _ChangePasswordScreenState();
}

class _ChangePasswordScreenState extends State<ChangePasswordScreen> {
  final _formKey = GlobalKey<FormState>();
  final _current = TextEditingController();
  final _next = TextEditingController();
  final _confirm = TextEditingController();
  late final AuthRepository _repo = widget.repository ?? AuthRepository();
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _current.dispose();
    _next.dispose();
    _confirm.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await _repo.changePassword(currentPassword: _current.text, newPassword: _next.text);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Đã đổi mật khẩu')));
      Navigator.pop(context);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Đổi mật khẩu')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              TextFormField(
                controller: _current,
                obscureText: true,
                decoration: const InputDecoration(labelText: 'Mật khẩu hiện tại', border: OutlineInputBorder()),
                validator: (v) => (v == null || v.isEmpty) ? 'Nhập mật khẩu hiện tại' : null,
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: _next,
                obscureText: true,
                decoration: const InputDecoration(labelText: 'Mật khẩu mới (từ 8 ký tự)', border: OutlineInputBorder()),
                validator: (v) => (v == null || v.length < 8) ? 'Mật khẩu tối thiểu 8 ký tự' : null,
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: _confirm,
                obscureText: true,
                decoration: const InputDecoration(labelText: 'Nhập lại mật khẩu mới', border: OutlineInputBorder()),
                validator: (v) => v != _next.text ? 'Mật khẩu nhập lại không khớp' : null,
              ),
              if (_error != null) ...[
                const SizedBox(height: 12),
                Text(_error!, style: const TextStyle(color: AppColors.danger)),
              ],
              const SizedBox(height: 24),
              PrimaryButton(label: 'Đổi mật khẩu', isLoading: _saving, onPressed: _save),
            ],
          ),
        ),
      ),
    );
  }
}
