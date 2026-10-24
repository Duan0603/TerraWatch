import 'package:flutter/material.dart';
import '../../../core/network/api_exceptions.dart';
import '../../../core/storage/session.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/primary_button.dart';
import '../../auth/data/auth_repository.dart';

/// Sửa họ tên và số điện thoại (số điện thoại dùng để nhận SMS cảnh báo)
class EditProfileScreen extends StatefulWidget {
  final AuthRepository? repository;
  const EditProfileScreen({super.key, this.repository});

  @override
  State<EditProfileScreen> createState() => _EditProfileScreenState();
}

class _EditProfileScreenState extends State<EditProfileScreen> {
  final _formKey = GlobalKey<FormState>();
  final _name = TextEditingController(text: Session.user.value?.fullName ?? '');
  final _phone = TextEditingController(text: Session.user.value?.phoneNumber ?? '');
  late final AuthRepository _repo = widget.repository ?? AuthRepository();
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _name.dispose();
    _phone.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await _repo.updateProfile(fullName: _name.text, phoneNumber: _phone.text);
      if (mounted) Navigator.pop(context);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Chỉnh sửa hồ sơ')),
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
                controller: _phone,
                keyboardType: TextInputType.phone,
                decoration: const InputDecoration(
                  labelText: 'Số điện thoại (nhận SMS cảnh báo)',
                  border: OutlineInputBorder(),
                ),
                validator: (v) {
                  final phone = v?.trim() ?? '';
                  if (phone.isEmpty) return null;
                  return RegExp(r'^\+?[0-9]{9,15}$').hasMatch(phone) ? null : 'Số điện thoại không hợp lệ';
                },
              ),
              if (_error != null) ...[
                const SizedBox(height: 12),
                Text(_error!, style: const TextStyle(color: AppColors.danger)),
              ],
              const SizedBox(height: 24),
              PrimaryButton(label: 'Lưu', isLoading: _saving, onPressed: _save),
            ],
          ),
        ),
      ),
    );
  }
}
