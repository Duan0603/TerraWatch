import 'package:flutter/material.dart';
import '../../../core/network/api_exceptions.dart';
import '../../../core/storage/session.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/primary_button.dart';
import '../../auth/data/auth_repository.dart';

final _phonePattern = RegExp(r'^\+?[0-9]{9,15}$');

/// Sửa thông tin cá nhân, địa chỉ và liên hệ khẩn cấp. Mọi trường trừ họ tên đều tùy chọn.
class EditProfileScreen extends StatefulWidget {
  final AuthRepository? repository;
  const EditProfileScreen({super.key, this.repository});

  @override
  State<EditProfileScreen> createState() => _EditProfileScreenState();
}

class _EditProfileScreenState extends State<EditProfileScreen> {
  final _formKey = GlobalKey<FormState>();
  final _user = Session.user.value;
  late final _name = TextEditingController(text: _user?.fullName ?? '');
  late final _phone = TextEditingController(text: _user?.phoneNumber ?? '');
  late final _province = TextEditingController(text: _user?.province ?? '');
  late final _district = TextEditingController(text: _user?.district ?? '');
  late final _commune = TextEditingController(text: _user?.commune ?? '');
  late final _addressLine = TextEditingController(text: _user?.addressLine ?? '');
  late final _emergencyName = TextEditingController(text: _user?.emergencyContactName ?? '');
  late final _emergencyPhone = TextEditingController(text: _user?.emergencyContactPhone ?? '');
  late final _emergencyRelation = TextEditingController(text: _user?.emergencyContactRelation ?? '');
  late String? _gender = _user?.gender;
  late String? _dateOfBirth = _user?.dateOfBirth; // ISO yyyy-MM-dd
  late final AuthRepository _repo = widget.repository ?? AuthRepository();
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    for (final c in [_name, _phone, _province, _district, _commune, _addressLine, _emergencyName, _emergencyPhone, _emergencyRelation]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _pickDate() async {
    final now = DateTime.now();
    final initial = DateTime.tryParse(_dateOfBirth ?? '') ?? DateTime(now.year - 30);
    final picked = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: DateTime(1900),
      lastDate: now,
      helpText: 'Chọn ngày sinh',
    );
    if (picked != null) {
      setState(() => _dateOfBirth = picked.toIso8601String().substring(0, 10));
    }
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await _repo.updateProfile(
        fullName: _name.text,
        phoneNumber: _phone.text,
        dateOfBirth: _dateOfBirth,
        gender: _gender,
        province: _province.text,
        district: _district.text,
        commune: _commune.text,
        addressLine: _addressLine.text,
        emergencyContactName: _emergencyName.text,
        emergencyContactPhone: _emergencyPhone.text,
        emergencyContactRelation: _emergencyRelation.text,
      );
      if (mounted) Navigator.pop(context);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  InputDecoration _decoration(String label) => InputDecoration(labelText: label, border: const OutlineInputBorder());

  Widget _title(String text) => Padding(
        padding: const EdgeInsets.only(top: 8, bottom: 12),
        child: Text(text, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.primary)),
      );

  Widget _gap() => const SizedBox(height: 16);

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
              _title('Thông tin cá nhân'),
              TextFormField(
                controller: _name,
                textCapitalization: TextCapitalization.words,
                decoration: _decoration('Họ và tên'),
                validator: (v) => (v == null || v.trim().isEmpty) ? 'Nhập họ và tên' : null,
              ),
              _gap(),
              TextFormField(
                controller: _phone,
                keyboardType: TextInputType.phone,
                decoration: _decoration('Số điện thoại (nhận SMS cảnh báo)'),
                validator: (v) {
                  final phone = v?.trim() ?? '';
                  return phone.isEmpty || _phonePattern.hasMatch(phone) ? null : 'Số điện thoại không hợp lệ';
                },
              ),
              _gap(),
              InkWell(
                onTap: _pickDate,
                child: InputDecorator(
                  decoration: _decoration('Ngày sinh').copyWith(suffixIcon: const Icon(Icons.calendar_today_outlined, size: 18)),
                  child: Text(
                    _dateOfBirth == null
                        ? 'Chưa chọn'
                        : '${_dateOfBirth!.substring(8, 10)}/${_dateOfBirth!.substring(5, 7)}/${_dateOfBirth!.substring(0, 4)}',
                    style: TextStyle(color: _dateOfBirth == null ? AppColors.textMuted : AppColors.textPrimary),
                  ),
                ),
              ),
              _gap(),
              DropdownButtonFormField<String?>(
                initialValue: _gender,
                decoration: _decoration('Giới tính'),
                items: const [
                  DropdownMenuItem(value: null, child: Text('Không nêu')),
                  DropdownMenuItem(value: 'male', child: Text('Nam')),
                  DropdownMenuItem(value: 'female', child: Text('Nữ')),
                  DropdownMenuItem(value: 'other', child: Text('Khác')),
                ],
                onChanged: (v) => setState(() => _gender = v),
              ),
              const SizedBox(height: 24),
              _title('Nơi ở'),
              TextFormField(controller: _province, decoration: _decoration('Tỉnh / Thành phố')),
              _gap(),
              TextFormField(controller: _district, decoration: _decoration('Quận / Huyện')),
              _gap(),
              TextFormField(controller: _commune, decoration: _decoration('Xã / Phường')),
              _gap(),
              TextFormField(controller: _addressLine, decoration: _decoration('Thôn / Bản / Số nhà')),
              const SizedBox(height: 24),
              _title('Liên hệ khẩn cấp'),
              TextFormField(
                controller: _emergencyName,
                textCapitalization: TextCapitalization.words,
                decoration: _decoration('Họ tên người thân'),
                validator: (v) => (v?.trim().isEmpty ?? true) && _emergencyPhone.text.trim().isNotEmpty
                    ? 'Nhập tên người liên hệ'
                    : null,
              ),
              _gap(),
              TextFormField(
                controller: _emergencyPhone,
                keyboardType: TextInputType.phone,
                decoration: _decoration('Số điện thoại người thân'),
                validator: (v) {
                  final phone = v?.trim() ?? '';
                  if (phone.isEmpty) return _emergencyName.text.trim().isNotEmpty ? 'Nhập số điện thoại người liên hệ' : null;
                  return _phonePattern.hasMatch(phone) ? null : 'Số điện thoại không hợp lệ';
                },
              ),
              _gap(),
              TextFormField(controller: _emergencyRelation, decoration: _decoration('Quan hệ (vợ, chồng, con, bố, mẹ...)')),
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
