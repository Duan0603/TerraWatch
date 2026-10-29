import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:geosentry_mobile/core/network/api_client.dart';
import 'package:geosentry_mobile/core/storage/session.dart';
import 'package:geosentry_mobile/features/auth/data/auth_models.dart';
import 'package:geosentry_mobile/features/report/data/report_repository.dart';
import 'package:geosentry_mobile/features/report/presentation/report_screen.dart';
import 'field_report_test.dart' show FakeServer, InMemoryReportStore;

void main() {
  late FakeServer server;
  late ReportRepository repo;

  Future<LocationFix> fakeLocation() async => (latitude: 21.864, longitude: 104.113, accuracy: 6.0);

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    await Session.save('jwt-1', const UserProfile(userId: 'u-1', fullName: 'An', email: 'a@b.c', role: 'citizen'));
    server = FakeServer();
    repo = ReportRepository(
      store: InMemoryReportStore(),
      apiClient: ApiClient(client: server.client, baseUrl: 'http://test'),
      currentUserId: () => 'u-1',
    );
  });

  Future<void> pumpScreen(WidgetTester tester) async {
    await tester.pumpWidget(MaterialApp(home: ReportScreen(repository: repo, locationProvider: fakeLocation)));
  }

  Future<void> tapVisible(WidgetTester tester, Finder finder) async {
    await tester.ensureVisible(finder);
    await tester.tap(finder);
    await tester.pumpAndSettle();
  }

  testWidgets('needs a location, then a photo or a description, before anything is sent', (tester) async {
    await pumpScreen(tester);
    await tapVisible(tester, find.text('Gửi báo cáo'));
    expect(find.text('Hãy bấm "Lấy vị trí" để đính kèm vị trí'), findsOneWidget);

    await tapVisible(tester, find.text('Lấy vị trí'));
    expect(find.textContaining('21.86400, 104.11300'), findsOneWidget);
    await tapVisible(tester, find.text('Gửi báo cáo'));
    expect(find.text('Cần có ảnh hoặc mô tả'), findsOneWidget);
    expect(server.posts, isEmpty);
  });

  testWidgets('online: shows that the report was sent', (tester) async {
    await pumpScreen(tester);
    await tapVisible(tester, find.text('Lấy vị trí'));
    await tester.enterText(find.byType(TextField), 'Đất đá tràn xuống đường');
    await tapVisible(tester, find.text('Gửi báo cáo'));
    expect(find.text('Đã gửi báo cáo'), findsOneWidget);
    expect(server.posts.length, 1);
  });

  testWidgets('offline: tells the citizen the report is saved and will be sent later', (tester) async {
    server.online = false;
    await pumpScreen(tester);
    await tapVisible(tester, find.text('Lấy vị trí'));
    await tester.enterText(find.byType(TextField), 'Vết nứt dài trên sườn đồi');
    await tapVisible(tester, find.text('Gửi báo cáo'));
    expect(find.text('Đã lưu trên máy'), findsOneWidget);
    expect(find.textContaining('tự gửi khi có mạng'), findsOneWidget);
  });
}
