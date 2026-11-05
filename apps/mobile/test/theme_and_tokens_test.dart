import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:geosentry_mobile/core/theme/app_colors.dart';
import 'package:geosentry_mobile/core/theme/app_spacing.dart';
import 'package:geosentry_mobile/core/theme/app_typography.dart';

void main() {
  group('White/Teal Design System Tokens & Typography Tests', () {
    test('AppColors brand and hazard color integrity', () {
      expect(AppColors.primary, const Color(0xFF087B70));
      expect(AppColors.primaryDark, const Color(0xFF075F57));
      expect(AppColors.primaryLight, const Color(0xFFE4F4F1));

      expect(AppColors.danger, const Color(0xFFEF4444));
      expect(AppColors.warning, const Color(0xFFF97316));
      expect(AppColors.caution, const Color(0xFFEAB308));
      expect(AppColors.safe, const Color(0xFF22C55E));

      expect(AppColors.background, const Color(0xFFF5F8F7));
      expect(AppColors.cardSurface, Colors.white);
      expect(AppColors.border, const Color(0xFFDCE5E2));
    });

    test('AppSpacing & AppRadius scale hierarchy', () {
      expect(AppSpacing.xxs, 2.0);
      expect(AppSpacing.xs, 4.0);
      expect(AppSpacing.sm, 8.0);
      expect(AppSpacing.md, 12.0);
      expect(AppSpacing.lg, 16.0);
      expect(AppSpacing.xl, 20.0);
      expect(AppSpacing.xxl, 24.0);
      expect(AppSpacing.hero, 48.0);

      expect(AppRadius.xs, 4.0);
      expect(AppRadius.sm, 6.0);
      expect(AppRadius.md, 10.0);
      expect(AppRadius.lg, 14.0);
      expect(AppRadius.xl, 18.0);
      expect(AppRadius.pill, 999.0);

      expect(AppShadows.card.length, 1);
      expect(AppShadows.emergencyGlow.length, 1);
    });

    test('AppTypography scales hierarchy', () {
      expect(AppTypography.displayLarge.fontSize, 32);
      expect(AppTypography.displayLarge.fontWeight, FontWeight.w800);
      expect(AppTypography.displayLarge.fontFamily, 'Inter');

      expect(AppTypography.displayMedium.fontSize, 28);
      expect(AppTypography.headlineLarge.fontSize, 20);
      expect(AppTypography.titleLarge.fontSize, 16);
      expect(AppTypography.bodyLarge.fontSize, 15);
      expect(AppTypography.bodyMedium.fontSize, 14);
      expect(AppTypography.bodySmall.fontSize, 12);
      expect(AppTypography.labelMedium.fontSize, 12);
      expect(AppTypography.labelSmall.fontSize, 10);
    });
  });
}
