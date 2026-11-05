import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:geosentry_mobile/core/theme/hazard_badge_theme.dart';
import 'package:geosentry_mobile/core/widgets/hazard_badge.dart';

void main() {
  group('HazardBadge Widget Tests', () {
    testWidgets('renders Critical badge with Vietnamese label by default', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: HazardBadge(style: HazardBadgeTheme.critical),
          ),
        ),
      );

      expect(find.text('ĐẶC BIỆT NGUY HIỂM'), findsOneWidget);
      expect(find.byIcon(Icons.warning_rounded), findsOneWidget);
    });

    testWidgets('renders Critical badge with English label when showEnglish is true', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: HazardBadge(
              style: HazardBadgeTheme.critical,
              showEnglish: true,
            ),
          ),
        ),
      );

      expect(find.text('CRITICAL'), findsOneWidget);
    });

    testWidgets('renders High badge via fromSeverity factory', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: HazardBadge.fromSeverity('HIGH'),
          ),
        ),
      );

      expect(find.text('NGUY CƠ CAO'), findsOneWidget);
      expect(find.byIcon(Icons.error_outline_rounded), findsOneWidget);
    });

    testWidgets('renders Safe badge for null or unknown severity', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: HazardBadge.fromSeverity(null),
          ),
        ),
      );

      expect(find.text('AN TOÀN'), findsOneWidget);
      expect(find.byIcon(Icons.check_circle_outline_rounded), findsOneWidget);
    });
  });
}
