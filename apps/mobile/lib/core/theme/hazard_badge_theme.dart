import 'package:flutter/material.dart';
import 'app_colors.dart';

/// Dinh nghia mau sac, icon va nhan hien thi cho cac cap do nguy co sat lo
class HazardBadgeStyle {
  final Color backgroundColor;
  final Color borderColor;
  final Color textColor;
  final IconData icon;
  final String labelVi;
  final String labelEn;

  const HazardBadgeStyle({
    required this.backgroundColor,
    required this.borderColor,
    required this.textColor,
    required this.icon,
    required this.labelVi,
    required this.labelEn,
  });
}

class HazardBadgeTheme {
  HazardBadgeTheme._();

  static const HazardBadgeStyle critical = HazardBadgeStyle(
    backgroundColor: Color(0xFFFEE2E2),
    borderColor: Color(0xFFFCA5A5),
    textColor: Color(0xFFDC2626),
    icon: Icons.warning_rounded,
    labelVi: 'ĐẶC BIỆT NGUY HIỂM',
    labelEn: 'CRITICAL',
  );

  static const HazardBadgeStyle high = HazardBadgeStyle(
    backgroundColor: Color(0xFFFFEDD5),
    borderColor: Color(0xFFFDBA74),
    textColor: Color(0xFFEA580C),
    icon: Icons.error_outline_rounded,
    labelVi: 'NGUY CƠ CAO',
    labelEn: 'HIGH',
  );

  static const HazardBadgeStyle moderate = HazardBadgeStyle(
    backgroundColor: Color(0xFFFEF9C3),
    borderColor: Color(0xFFFDE047),
    textColor: Color(0xFFCA8A04),
    icon: Icons.info_outline_rounded,
    labelVi: 'TRUNG BÌNH',
    labelEn: 'MODERATE',
  );

  static const HazardBadgeStyle safe = HazardBadgeStyle(
    backgroundColor: Color(0xFFDCFCE7),
    borderColor: Color(0xFF86EFAC),
    textColor: Color(0xFF16A34A),
    icon: Icons.check_circle_outline_rounded,
    labelVi: 'AN TOÀN',
    labelEn: 'SAFE',
  );

  static HazardBadgeStyle fromSeverityString(String? severity) {
    if (severity == null) return safe;
    final normalized = severity.trim().toUpperCase();
    if (normalized.contains('CRITICAL') || normalized.contains('EXTREME')) {
      return critical;
    }
    if (normalized.contains('HIGH')) {
      return high;
    }
    if (normalized.contains('MODERATE') || normalized.contains('MEDIUM')) {
      return moderate;
    }
    return safe;
  }
}
