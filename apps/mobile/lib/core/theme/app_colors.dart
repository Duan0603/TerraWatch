import 'package:flutter/material.dart';

/// Bảng màu chuẩn cho ứng dụng GeoSentry
class AppColors {
  AppColors._();

  // Primary Brands
  static const Color primary = Color(0xFF0EA5E9);       // Sky Blue (Hiện đại, nhận diện thương hiệu)
  static const Color primaryDark = Color(0xFF0284C7);

  // Status & Hazard Levels
  static const Color danger = Color(0xFFEF4444);        // Đỏ còi hú khẩn cấp / Mức Extreme
  static const Color warning = Color(0xFFF59E0B);       // Vàng cam cảnh báo / Mức High
  static const Color caution = Color(0xFFEAB308);       // Vàng nhạt / Mức Medium
  static const Color safe = Color(0xFF10B981);          // Xanh lá / An toàn

  // Background & Surfaces (Dark Theme)
  static const Color background = Color(0xFF0B0F19);    // Nền tối sâu
  static const Color cardSurface = Color(0xFF1F2937);   // Thẻ xám đậm
  static const Color cardSurfaceLight = Color(0xFF374151);

  // Text Colors
  static const Color textPrimary = Color(0xFFF9FAFB);
  static const Color textSecondary = Color(0xFF9CA3AF);
  static const Color textMuted = Color(0xFF6B7280);
}
