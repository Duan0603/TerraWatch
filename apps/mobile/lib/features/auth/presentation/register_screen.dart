import 'package:flutter/material.dart';
import '../../../core/network/api_exceptions.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/primary_button.dart';
import '../data/auth_repository.dart';

/// Đăng ký tài khoản Người dân; thành công thì tự đăng nhập rồi đóng màn hình
class RegisterScreen extends StatefulWidget {
  final AuthRepository? repository;
  const RegisterScreen({super.key, this.repository});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final _formKey = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _email = TextEditingController();
  final _password = TextEditingController();
  late final AuthRepository _repo = widget.repository ?? AuthRepository();
  bool _loading = false;
  String? _error;

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await _repo.register(
        fullName: _name.text,
        email: _email.text,
        password: _password.text,
      );
      if (mounted) Navigator.pop(context);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Đăng ký')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              TextFormField(
                controller: _name,
                textCapitalization: TextCapitalization.words,
                decoration: const InputDecoration(labelText: 'Họ và tên', border: OutlineInputBorder()),
                validator: (v) => (v == null || v.trim().isEmpty) ? 'Nhập họ và tên' : null,
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: _email,
                keyboardType: TextInputType.emailAddress,
                decoration: const InputDecoration(labelText: 'Email', border: OutlineInputBorder()),
                validator: (v) => (v == null || !v.contains('@')) ? 'Nhập email hợp lệ' : null,
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: _password,
                obscureText: true,
                decoration: const InputDecoration(labelText: 'Mật khẩu (từ 8 ký tự)', border: OutlineInputBorder()),
                validator: (v) => (v == null || v.length < 8) ? 'Mật khẩu tối thiểu 8 ký tự' : null,
              ),
              // Máy chủ chỉ nhận số điện thoại đã xác minh OTP (Story 4.6); app chưa có bước OTP,
              // nên số điện thoại được thêm ở mục Hồ sơ sau khi đăng nhập.
              const SizedBox(height: 8),
              const Text(
                'Số điện thoại nhận SMS cảnh báo có thể thêm sau trong mục Hồ sơ.',
                style: TextStyle(fontSize: 12),
              ),
              if (_error != null) ...[
                const SizedBox(height: 12),
                Text(_error!, style: const TextStyle(color: AppColors.danger)),
              ],
              const SizedBox(height: 24),
              PrimaryButton(label: 'Tạo tài khoản', isLoading: _loading, onPressed: _submit),
            ],
          ),
        ),
      ),
    );
  }
}
