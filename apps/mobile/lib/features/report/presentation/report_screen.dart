import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:image_picker/image_picker.dart';
import '../../../core/network/api_exceptions.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/primary_button.dart';
import '../data/field_report.dart';
import '../data/report_repository.dart';
import 'my_reports_screen.dart';

typedef LocationFix = ({double latitude, double longitude, double accuracy});

/// Lấy vị trí hiện tại sau khi người dùng chủ động bấm; ném ApiException với lời nhắc nếu không lấy được
Future<LocationFix> currentLocation() async {
  var permission = await Geolocator.checkPermission();
  if (permission == LocationPermission.denied) permission = await Geolocator.requestPermission();
  if (permission == LocationPermission.denied || permission == LocationPermission.deniedForever) {
    throw const ApiException(message: 'Cần cấp quyền vị trí để đính kèm vị trí vào báo cáo');
  }
  try {
    final p = await Geolocator.getCurrentPosition(timeLimit: const Duration(seconds: 15));
    return (latitude: p.latitude, longitude: p.longitude, accuracy: p.accuracy);
  } catch (_) {
    throw const ApiException(message: 'Không lấy được vị trí hiện tại. Hãy bật GPS và thử lại');
  }
}

String formatDateTime(DateTime utc) {
  final t = utc.toLocal();
  String two(int n) => n.toString().padLeft(2, '0');
  return '${two(t.day)}/${two(t.month)}/${t.year} ${two(t.hour)}:${two(t.minute)}';
}

/// Gửi báo cáo hiện trường (Story 5.2): ảnh + vị trí + thời điểm thấy; mất mạng thì lưu trong máy và gửi sau
class ReportScreen extends StatefulWidget {
  final ReportRepository? repository;
  final Future<LocationFix> Function()? locationProvider;
  const ReportScreen({super.key, this.repository, this.locationProvider});

  @override
  State<ReportScreen> createState() => _ReportScreenState();
}

class _ReportScreenState extends State<ReportScreen> {
  late final ReportRepository _repo = widget.repository ?? ReportRepository();
  final _description = TextEditingController();
  Uint8List? _photo;
  LocationFix? _location;
  DateTime _observedAt = DateTime.now();
  bool _locating = false;
  bool _sending = false;
  String? _error;
  FieldReport? _result;

  @override
  void dispose() {
    _description.dispose();
    super.dispose();
  }

  Future<void> _pickPhoto(ImageSource source) async {
    // Thu nhỏ ngay khi chọn để ảnh gửi lên nhẹ (server giới hạn 700 KB)
    final picked = await ImagePicker().pickImage(source: source, maxWidth: 1280, maxHeight: 1280, imageQuality: 70);
    if (picked == null) return;
    final bytes = await picked.readAsBytes();
    if (!mounted) return;
    if (bytes.length > ReportRepository.photoLimitBytes) {
      setState(() => _error = 'Ảnh quá lớn, hãy chọn hoặc chụp ảnh khác');
      return;
    }
    setState(() {
      _photo = bytes;
      _error = null;
    });
  }

  Future<void> _getLocation() async {
    setState(() {
      _locating = true;
      _error = null;
    });
    try {
      final fix = await (widget.locationProvider ?? currentLocation)();
      if (mounted) setState(() => _location = fix);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _locating = false);
    }
  }

  Future<void> _pickObservedAt() async {
    final now = DateTime.now();
    final date = await showDatePicker(
      context: context,
      initialDate: _observedAt,
      firstDate: now.subtract(const Duration(days: 30)),
      lastDate: now,
      helpText: 'Ngày bạn thấy sự việc',
    );
    if (date == null || !mounted) return;
    final time = await showTimePicker(context: context, initialTime: TimeOfDay.fromDateTime(_observedAt));
    if (time == null) return;
    final picked = DateTime(date.year, date.month, date.day, time.hour, time.minute);
    setState(() => _observedAt = picked.isAfter(now) ? now : picked); // không cho chọn giờ ở tương lai
  }

  Future<void> _submit() async {
    final location = _location;
    if (location == null) {
      setState(() => _error = 'Hãy bấm "Lấy vị trí" để đính kèm vị trí');
      return;
    }
    if (_photo == null && _description.text.trim().isEmpty) {
      setState(() => _error = 'Cần có ảnh hoặc mô tả');
      return;
    }
    setState(() {
      _sending = true;
      _error = null;
    });
    try {
      final result = await _repo.submit(
        latitude: location.latitude,
        longitude: location.longitude,
        accuracyM: location.accuracy,
        description: _description.text,
        observedAt: _observedAt,
        imageBytes: _photo,
      );
      if (mounted) setState(() => _result = result);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final result = _result;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Báo Cáo Hiện Trường'),
        actions: [
          IconButton(
            icon: const Icon(Icons.history),
            tooltip: 'Báo cáo của tôi',
            onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const MyReportsScreen())),
          ),
        ],
      ),
      body: result != null ? _ResultView(result: result) : _form(),
    );
  }

  Widget _form() {
    final location = _location;
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        const Text(
          'Vị trí của bạn chỉ được gửi đi khi bạn bấm "Gửi báo cáo". Không có theo dõi vị trí liên tục.',
          style: TextStyle(color: AppColors.textSecondary, fontSize: 12.5),
        ),
        const SizedBox(height: 16),
        if (_photo != null)
          ClipRRect(borderRadius: BorderRadius.circular(12), child: Image.memory(_photo!, height: 200, fit: BoxFit.cover)),
        const SizedBox(height: 8),
        Row(children: [
          Expanded(
            child: OutlinedButton.icon(
              onPressed: () => _pickPhoto(ImageSource.camera),
              icon: const Icon(Icons.photo_camera_outlined),
              label: const Text('Chụp ảnh'),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: OutlinedButton.icon(
              onPressed: () => _pickPhoto(ImageSource.gallery),
              icon: const Icon(Icons.photo_library_outlined),
              label: const Text('Thư viện'),
            ),
          ),
        ]),
        const SizedBox(height: 16),
        OutlinedButton.icon(
          onPressed: _locating ? null : _getLocation,
          icon: _locating
              ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
              : const Icon(Icons.my_location),
          label: Text(location == null
              ? 'Lấy vị trí'
              : '${location.latitude.toStringAsFixed(5)}, ${location.longitude.toStringAsFixed(5)} (±${location.accuracy.round()} m)'),
        ),
        const SizedBox(height: 16),
        InkWell(
          onTap: _pickObservedAt,
          child: InputDecorator(
            decoration: const InputDecoration(
              labelText: 'Thời điểm bạn thấy sự việc',
              border: OutlineInputBorder(),
              suffixIcon: Icon(Icons.schedule),
            ),
            child: Text(formatDateTime(_observedAt.toUtc())),
          ),
        ),
        const SizedBox(height: 16),
        TextField(
          controller: _description,
          maxLines: 4,
          maxLength: 2000,
          decoration: const InputDecoration(
            labelText: 'Mô tả (đất đá, vết nứt, nhà cửa bị ảnh hưởng...)',
            border: OutlineInputBorder(),
            alignLabelWithHint: true,
          ),
        ),
        if (_error != null) ...[
          const SizedBox(height: 8),
          Text(_error!, style: const TextStyle(color: AppColors.danger)),
        ],
        const SizedBox(height: 16),
        PrimaryButton(label: 'Gửi báo cáo', icon: Icons.send, isLoading: _sending, onPressed: _submit),
      ]),
    );
  }
}

/// Kết quả sau khi gửi: đã gửi, đang chờ mạng, hoặc bị từ chối
class _ResultView extends StatelessWidget {
  final FieldReport result;
  const _ResultView({required this.result});

  @override
  Widget build(BuildContext context) {
    final (icon, color, title, detail) = switch (result.status) {
      ReportStatus.sent => (Icons.check_circle, AppColors.safe, 'Đã gửi báo cáo', 'Cảm ơn bạn. Cán bộ sẽ xem xét báo cáo này.'),
      ReportStatus.pending => (
          Icons.cloud_off,
          AppColors.warning,
          'Đã lưu trên máy',
          'Chưa gửi được (${result.lastError ?? 'mất kết nối'}). Báo cáo sẽ tự gửi khi có mạng, bạn không cần làm lại.'
        ),
      ReportStatus.failed => (Icons.error_outline, AppColors.danger, 'Báo cáo bị từ chối', result.lastError ?? 'Dữ liệu không hợp lệ'),
    };
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Icon(icon, color: color, size: 72),
        const SizedBox(height: 16),
        Text(title, textAlign: TextAlign.center, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700)),
        const SizedBox(height: 8),
        Text(detail, textAlign: TextAlign.center, style: const TextStyle(color: AppColors.textSecondary)),
        const SizedBox(height: 24),
        PrimaryButton(
          label: 'Báo cáo của tôi',
          onPressed: () => Navigator.pushReplacement(context, MaterialPageRoute(builder: (_) => const MyReportsScreen())),
        ),
        TextButton(onPressed: () => Navigator.pop(context), child: const Text('Xong')),
      ]),
    );
  }
}
