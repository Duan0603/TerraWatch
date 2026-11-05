import 'package:flutter/material.dart';

/// Bảng màu trắng/teal của TerraWatch (đồng bộ với WebGIS & thiết kế của Tú)
class AppColors {
  AppColors._();

  // Primary Brands
  static const Color primary = Color(0xFF087B70);
  static const Color primaryDark = Color(0xFF075F57);
  static const Color primaryLight = Color(0xFFE4F4F1);

  // Status & Hazard Levels
  static const Color danger = Color(0xFFEF4444);        // Extreme
  static const Color warning = Color(0xFFF97316);       // High
  static const Color caution = Color(0xFFEAB308);       // Medium
  static const Color safe = Color(0xFF22C55E);          // Low / an toàn

  // Background & Surfaces (Light Theme)
  static const Color background = Color(0xFFF5F8F7);
  static const Color cardSurface = Colors.white;
  static const Color cardSurfaceLight = Color(0xFFE4F4F1);
  static const Color border = Color(0xFFDCE5E2);

  // Text Colors
  static const Color textPrimary = Color(0xFF172524);
  static const Color textSecondary = Color(0xFF687977);
  static const Color textMuted = Color(0xFF9BB0AD);
}
