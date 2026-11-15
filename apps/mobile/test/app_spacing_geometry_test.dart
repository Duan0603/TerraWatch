import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:geosentry_mobile/core/theme/app_spacing.dart';

void main() {
  group('AppSpacing and AppRadius Geometric Invariant Tests', () {
    test('verifies strictly ascending spacing scale', () {
      expect(AppSpacing.xxs, lessThan(AppSpacing.xs));
      expect(AppSpacing.xs, lessThan(AppSpacing.sm));
      expect(AppSpacing.sm, lessThan(AppSpacing.md));
      expect(AppSpacing.md, lessThan(AppSpacing.lg));
      expect(AppSpacing.lg, lessThan(AppSpacing.xl));
      expect(AppSpacing.xl, lessThan(AppSpacing.xxl));
      expect(AppSpacing.xxl, lessThan(AppSpacing.xxxl));
      expect(AppSpacing.xxxl, lessThan(AppSpacing.hero));
    });

    test('verifies EdgeInsets padding helpers match token constants', () {
      expect(AppSpacing.p4, const EdgeInsets.all(AppSpacing.xs));
      expect(AppSpacing.p8, const EdgeInsets.all(AppSpacing.sm));
      expect(AppSpacing.p12, const EdgeInsets.all(AppSpacing.md));
      expect(AppSpacing.p16, const EdgeInsets.all(AppSpacing.lg));
      expect(AppSpacing.p20, const EdgeInsets.all(AppSpacing.xl));
      expect(AppSpacing.p24, const EdgeInsets.all(AppSpacing.xxl));

      expect(AppSpacing.px16.horizontal, AppSpacing.lg * 2);
      expect(AppSpacing.py12.vertical, AppSpacing.md * 2);
      expect(AppSpacing.py16.vertical, AppSpacing.lg * 2);
      expect(
        AppSpacing.screenPadding,
        const EdgeInsets.symmetric(horizontal: AppSpacing.lg, vertical: AppSpacing.md),
      );
    });

    test('verifies strictly ascending radius scale and pill geometry', () {
      expect(AppRadius.xs, lessThan(AppRadius.sm));
      expect(AppRadius.sm, lessThan(AppRadius.md));
      expect(AppRadius.md, lessThan(AppRadius.lg));
      expect(AppRadius.lg, lessThan(AppRadius.xl));
      expect(AppRadius.xl, lessThan(AppRadius.xxl));
      expect(AppRadius.xxl, lessThan(AppRadius.pill));

      expect(AppRadius.r4, BorderRadius.circular(AppRadius.xs));
      expect(AppRadius.rPill, BorderRadius.circular(AppRadius.pill));
    });
  });
}
