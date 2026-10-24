import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';

class MapScreen extends StatelessWidget {
  const MapScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Bản đồ nguy cơ'),
        actions: [
          IconButton(icon: const Icon(Icons.layers_outlined), onPressed: () {}),
        ],
      ),
      body: Stack(
        children: [
          Container(color: const Color(0xFFCFE8E3)),
          Center(child: Icon(Icons.map, size: 80, color: AppColors.primary.withValues(alpha: 0.12))),
          Positioned(
            top: 14, left: 14, right: 14,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: AppColors.cardSurface,
                borderRadius: BorderRadius.circular(10),
                boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.08), blurRadius: 8)],
              ),
              child: const Row(
                children: [
                  Icon(Icons.location_on_outlined, size: 16, color: AppColors.primary),
                  SizedBox(width: 8),
                  Text('Huyện Bát Xát · 47 ô lưới theo dõi',
                    style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
                ],
              ),
            ),
          ),
          // Legend
          Positioned(
            bottom: 20, left: 14,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: AppColors.cardSurface,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: AppColors.border),
              ),
              child: const Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  _LegendDot(color: AppColors.safe, label: 'Thấp'),
                  SizedBox(width: 10),
                  _LegendDot(color: AppColors.caution, label: 'TB'),
                  SizedBox(width: 10),
                  _LegendDot(color: AppColors.warning, label: 'Cao'),
                  SizedBox(width: 10),
                  _LegendDot(color: AppColors.danger, label: 'Cực cao'),
                ],
              ),
            ),
          ),
          // My location button
          Positioned(
            bottom: 20, right: 14,
            child: FloatingActionButton.small(
              backgroundColor: AppColors.cardSurface,
              foregroundColor: AppColors.primary,
              onPressed: () {},
              child: const Icon(Icons.my_location),
            ),
          ),
        ],
      ),
    );
  }
}


class _LegendDot extends StatelessWidget {
  final Color color;
  final String label;
  const _LegendDot({required this.color, required this.label});

  @override
  Widget build(BuildContext context) => Row(mainAxisSize: MainAxisSize.min, children: [
    Container(width: 8, height: 8, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
    const SizedBox(width: 4),
    Text(label, style: const TextStyle(fontSize: 10, color: AppColors.textSecondary)),
  ]);
}
