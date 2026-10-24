import 'package:flutter_test/flutter_test.dart';
import 'package:geosentry_mobile/app.dart';

void main() {
  testWidgets('Signed-out app shows login and validates empty form', (WidgetTester tester) async {
    await tester.pumpWidget(const GeoSentryApp());
    expect(find.text('Đăng nhập'), findsOneWidget);

    await tester.tap(find.text('Đăng nhập'));
    await tester.pump();
    expect(find.text('Nhập email hợp lệ'), findsOneWidget);
    expect(find.text('Nhập mật khẩu'), findsOneWidget);
  });
}
