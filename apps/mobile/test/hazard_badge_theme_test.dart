import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:geosentry_mobile/core/theme/hazard_badge_theme.dart';

void main() {
  group('HazardBadgeTheme & Severity Mapping Tests', () {
    test('Critical badge theme styling', () {
      const style = HazardBadgeTheme.critical;
      expect(style.labelVi, 'ĐẶC BIỆT NGUY HIỂM');
      expect(style.labelEn, 'CRITICAL');
      expect(style.backgroundColor, const Color(0xFFFEE2E2));
      expect(style.textColor, const Color(0xFFDC2626));
      expect(style.icon, Icons.warning_rounded);
    });

    test('High badge theme styling', () {
      const style = HazardBadgeTheme.high;
      expect(style.labelVi, 'NGUY CƠ CAO');
      expect(style.labelEn, 'HIGH');
      expect(style.backgroundColor, const Color(0xFFFFEDD5));
      expect(style.textColor, const Color(0xFFEA580C));
      expect(style.icon, Icons.error_outline_rounded);
    });

    test('Moderate badge theme styling', () {
      const style = HazardBadgeTheme.moderate;
      expect(style.labelVi, 'TRUNG BÌNH');
      expect(style.labelEn, 'MODERATE');
      expect(style.backgroundColor, const Color(0xFFFEF9C3));
      expect(style.textColor, const Color(0xFFCA8A04));
      expect(style.icon, Icons.info_outline_rounded);
    });

    test('Safe badge theme styling', () {
      const style = HazardBadgeTheme.safe;
      expect(style.labelVi, 'AN TOÀN');
      expect(style.labelEn, 'SAFE');
      expect(style.backgroundColor, const Color(0xFFDCFCE7));
      expect(style.textColor, const Color(0xFF16A34A));
      expect(style.icon, Icons.check_circle_outline_rounded);
    });

    test('fromSeverityString mapping normalization', () {
      expect(HazardBadgeTheme.fromSeverityString('CRITICAL'), HazardBadgeTheme.critical);
      expect(HazardBadgeTheme.fromSeverityString('extreme'), HazardBadgeTheme.critical);
      expect(HazardBadgeTheme.fromSeverityString('HIGH'), HazardBadgeTheme.high);
      expect(HazardBadgeTheme.fromSeverityString('High Risk'), HazardBadgeTheme.high);
      expect(HazardBadgeTheme.fromSeverityString('MODERATE'), HazardBadgeTheme.moderate);
      expect(HazardBadgeTheme.fromSeverityString('medium'), HazardBadgeTheme.moderate);
      expect(HazardBadgeTheme.fromSeverityString('low'), HazardBadgeTheme.safe);
      expect(HazardBadgeTheme.fromSeverityString('SAFE'), HazardBadgeTheme.safe);
      expect(HazardBadgeTheme.fromSeverityString(null), HazardBadgeTheme.safe);
      expect(HazardBadgeTheme.fromSeverityString('unknown'), HazardBadgeTheme.safe);
    });
  });
}
