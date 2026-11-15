import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:geosentry_mobile/core/theme/app_colors.dart';
import 'package:geosentry_mobile/core/theme/app_typography.dart';

void main() {
  group('AppTypography Token Hierarchy Tests', () {
    test('fontFamily is consistently configured across text styles', () {
      expect(AppTypography.fontFamily, 'Inter');
      expect(AppTypography.displayLarge.fontFamily, 'Inter');
      expect(AppTypography.headlineLarge.fontFamily, 'Inter');
      expect(AppTypography.bodyMedium.fontFamily, 'Inter');
      expect(AppTypography.labelLarge.fontFamily, 'Inter');
    });

    test('display styles follow strictly descending scale', () {
      expect(AppTypography.displayLarge.fontSize, 32.0);
      expect(AppTypography.displayMedium.fontSize, 28.0);
      expect(AppTypography.displaySmall.fontSize, 24.0);

      expect(AppTypography.displayLarge.fontSize!, greaterThan(AppTypography.displayMedium.fontSize!));
      expect(AppTypography.displayMedium.fontSize!, greaterThan(AppTypography.displaySmall.fontSize!));
    });

    test('headline and title styles follow clear typographic hierarchy', () {
      expect(AppTypography.headlineLarge.fontSize, 20.0);
      expect(AppTypography.headlineMedium.fontSize, 18.0);
      expect(AppTypography.headlineSmall.fontSize, 16.0);

      expect(AppTypography.titleLarge.fontSize, 16.0);
      expect(AppTypography.titleLarge.fontWeight, FontWeight.w700);
      expect(AppTypography.titleMedium.fontSize, 14.0);
      expect(AppTypography.titleSmall.fontSize, 13.0);
    });

    test('body styles map to appropriate semantic text colors', () {
      expect(AppTypography.bodyLarge.color, AppColors.textPrimary);
      expect(AppTypography.bodyMedium.color, AppColors.textSecondary);
      expect(AppTypography.bodySmall.color, AppColors.textMuted);
    });

    test('alertBannerText is high-contrast bold white text', () {
      expect(AppTypography.alertBannerText.color, Colors.white);
      expect(AppTypography.alertBannerText.fontWeight, FontWeight.w700);
      expect(AppTypography.alertBannerText.fontSize, 15.0);
    });
  });
}
