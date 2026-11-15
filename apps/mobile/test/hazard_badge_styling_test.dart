import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:geosentry_mobile/core/theme/hazard_badge_theme.dart';
import 'package:geosentry_mobile/core/widgets/hazard_badge.dart';

void main() {
  group('HazardBadge Custom Styling and Edge Cases', () {
    testWidgets('applies custom iconSize and fontSize parameters accurately', (tester) async {
      const customIconSize = 22.0;
      const customFontSize = 16.0;

      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: HazardBadge(
              style: HazardBadgeTheme.critical,
              iconSize: customIconSize,
              fontSize: customFontSize,
            ),
          ),
        ),
      );

      final iconWidget = tester.widget<Icon>(find.byIcon(Icons.warning_rounded));
      expect(iconWidget.size, customIconSize);

      final textWidget = tester.widget<Text>(find.text('ĐẶC BIỆT NGUY HIỂM'));
      expect(textWidget.style?.fontSize, customFontSize);
    });

    testWidgets('fromSeverity handles lowercase and invalid string inputs gracefully', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Column(
              children: [
                HazardBadge.fromSeverity('critical'),
                HazardBadge.fromSeverity('high'),
                HazardBadge.fromSeverity('unknown_hazard'),
                HazardBadge.fromSeverity(''),
              ],
            ),
          ),
        ),
      );

      // 'critical' -> maps to critical style
      expect(find.text('ĐẶC BIỆT NGUY HIỂM'), findsOneWidget);
      // 'high' -> maps to high style
      expect(find.text('NGUY CƠ CAO'), findsOneWidget);
      // Unknown and empty string fall back to safe style
      expect(find.text('AN TOÀN'), findsNWidgets(2));
    });

    testWidgets('renders correct border and background colors for Moderate badge', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: HazardBadge(style: HazardBadgeTheme.moderate),
          ),
        ),
      );

      final container = tester.widget<Container>(find.byType(Container));
      final decoration = container.decoration as BoxDecoration;

      expect(decoration.color, HazardBadgeTheme.moderate.backgroundColor);
      final border = decoration.border as Border;
      expect(border.top.color, HazardBadgeTheme.moderate.borderColor);
    });
  });
}
