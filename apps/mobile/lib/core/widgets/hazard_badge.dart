import 'package:flutter/material.dart';
import '../theme/hazard_badge_theme.dart';
import '../theme/app_spacing.dart';

/// Widget hien thi huy hieu muc do nguy co sat lo dat theo Design System
class HazardBadge extends StatelessWidget {
  final HazardBadgeStyle style;
  final bool showEnglish;
  final double iconSize;
  final double fontSize;

  const HazardBadge({
    super.key,
    required this.style,
    this.showEnglish = false,
    this.iconSize = 14.0,
    this.fontSize = 11.0,
  });

  /// Factory constructor tu chuoi severity (e.g. "CRITICAL", "HIGH", "MODERATE", "SAFE")
  factory HazardBadge.fromSeverity(
    String? severity, {
    Key? key,
    bool showEnglish = false,
    double iconSize = 14.0,
    double fontSize = 11.0,
  }) {
    return HazardBadge(
      key: key,
      style: HazardBadgeTheme.fromSeverityString(severity),
      showEnglish: showEnglish,
      iconSize: iconSize,
      fontSize: fontSize,
    );
  }

  @override
  Widget build(BuildContext context) {
    final label = showEnglish ? style.labelEn : style.labelVi;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm, vertical: AppSpacing.xs),
      decoration: BoxDecoration(
        color: style.backgroundColor,
        borderRadius: AppRadius.rPill,
        border: Border.all(color: style.borderColor, width: 1.0),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(style.icon, size: iconSize, color: style.textColor),
          const SizedBox(width: AppSpacing.xs),
          Text(
            label,
            style: TextStyle(
              color: style.textColor,
              fontSize: fontSize,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.3,
            ),
          ),
        ],
      ),
    );
  }
}
