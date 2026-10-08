import 'package:flutter_test/flutter_test.dart';
import 'package:geosentry_mobile/app.dart';

void main() {
  testWidgets('App smoke test', (WidgetTester tester) async {
    await tester.pumpWidget(const GeoSentryApp());
    expect(find.text('GeoSentry Cảnh Báo Sạt Lở'), findsOneWidget);
  });
}
