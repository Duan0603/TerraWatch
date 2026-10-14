import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/primary_button.dart';

/// Màn hình gửi báo cáo hiện trường từ cộng đồng (Story 5.2 - Crowdsourcing)
class ReportScreen extends StatelessWidget {
  const ReportScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Báo Cáo Hiện Trường'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Icon(Icons.add_a_photo_outlined, color: AppColors.primary, size: 64),
            const SizedBox(height: 16),
            const Text(
              'Gửi Báo Cáo Sạt Lở Đất',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            const Text(
              'Hệ thống tự động lưu vị trí GPS hiện tại và hỗ trợ lưu vào hàng đợi offline nếu mất kết nối Internet.',
              textAlign: TextAlign.center,
              style: TextStyle(color: AppColors.textSecondary, fontSize: 13),
            ),
            const SizedBox(height: 32),
            PrimaryButton(
              label: 'Chụp Ảnh Dấu Hiệu Sạt Lở',
              icon: Icons.camera_alt,
              onPressed: () {
                // Sẽ bổ sung theo Story 5.2
              },
            ),
          ],
        ),
      ),
    );
  }
}
