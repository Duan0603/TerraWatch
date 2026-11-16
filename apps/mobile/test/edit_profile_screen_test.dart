import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:geosentry_mobile/core/network/api_client.dart';
import 'package:geosentry_mobile/core/storage/session.dart';
import 'package:geosentry_mobile/features/auth/data/auth_repository.dart';
import 'package:geosentry_mobile/features/profile/presentation/edit_profile_screen.dart';

import 'support/harness.dart';

// auth_forms_test.dart already covers name/phone/emergency validation, save success/errors, 401, spinner.
// This file covers what it does not: the date picker, the gender dropdown, the exact PUT body (trimming,
// blank clearing), prefill of every field, and that the form can be fixed and re-submitted.

void main() {
  late FakeBackend server;
  late AuthRepository repo;

  setUp(() async {
    server = FakeBackend()..handler = (_) => jsonResponse(200, citizenJson);
    repo = AuthRepository(apiClient: ApiClient(client: server.client, baseUrl: 'http://test'));
    await signIn();
  });

  final save = find.widgetWithText(ElevatedButton, 'Lưu');
  Finder field(String label) => find.widgetWithText(TextFormField, label);

  Future<void> pumpEdit(WidgetTester tester) async {
    tester.view.physicalSize = const Size(800, 3000); // whole form visible, no scrolling needed
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(MaterialApp(home: EditProfileScreen(repository: repo)));
  }

  Map<String, dynamic> sentBody() => jsonDecode(server.where('PUT', '/api/v1/auth/me').single.body) as Map<String, dynamic>;

  testWidgets('prefills every section from the stored profile', (tester) async {
    await signIn(citizen({
      'province': 'Lào Cai',
      'district': 'Sa Pa',
      'commune': 'Bản Hồ',
      'addressLine': 'Thôn 3',
      'emergencyContactName': 'Mẹ Lan',
      'emergencyContactPhone': '0987654321',
      'emergencyContactRelation': 'mẹ',
      'gender': 'male',
    }));
    await pumpEdit(tester);
    for (final v in ['Lào Cai', 'Sa Pa', 'Bản Hồ', 'Thôn 3', 'Mẹ Lan', '0987654321', 'mẹ', 'Nam']) {
      expect(find.text(v), findsOneWidget, reason: v);
    }
    for (final title in ['Thông tin cá nhân', 'Nơi ở', 'Liên hệ khẩn cấp']) {
      expect(find.text(title), findsOneWidget);
    }
  });

  testWidgets('no session user: form is empty and still renders', (tester) async {
    await signOutForTest();
    await pumpEdit(tester);
    expect(find.text('Chưa chọn'), findsOneWidget);
    expect(find.text('Không nêu'), findsOneWidget);
    expect(tester.widget<TextFormField>(field('Họ và tên')).controller!.text, '');
  });

  testWidgets('saving sends every field trimmed; untouched optional fields are sent as empty strings (server replaces the whole profile)', (tester) async {
    await pumpEdit(tester);
    await tester.enterText(field('Họ và tên'), '  Trần Bình  ');
    await tester.enterText(field('Tỉnh / Thành phố'), ' Yên Bái ');
    await tester.tap(save);
    await tester.pumpAndSettle();
    expect(sentBody(), {
      'fullName': 'Trần Bình',
      'phoneNumber': '',
      'dateOfBirth': null,
      'gender': '',
      'province': 'Yên Bái',
      'district': '',
      'commune': '',
      'addressLine': '',
      'emergencyContactName': '',
      'emergencyContactPhone': '',
      'emergencyContactRelation': '',
    });
  });

  testWidgets('emptying a prefilled field sends "" so the server clears it', (tester) async {
    await signIn(citizen({'province': 'Lào Cai', 'phoneNumber': '0912345678'}));
    await pumpEdit(tester);
    await tester.enterText(field('Tỉnh / Thành phố'), '');
    await tester.enterText(field('Số điện thoại (nhận SMS cảnh báo)'), '');
    await tester.tap(save);
    await tester.pumpAndSettle();
    expect(sentBody()['province'], '');
    expect(sentBody()['phoneNumber'], '');
  });

  Future<void> pickGender(WidgetTester tester, String label) async {
    await tester.tap(find.byType(DropdownButtonFormField<String?>));
    await tester.pumpAndSettle();
    await tester.tap(find.text(label).last);
    await tester.pumpAndSettle();
  }

  testWidgets('gender dropdown: the chosen value is shown and sent', (tester) async {
    await pumpEdit(tester);
    await pickGender(tester, 'Nữ');
    expect(find.text('Nữ'), findsOneWidget);
    await tester.tap(save);
    await tester.pumpAndSettle();
    expect(sentBody()['gender'], 'female');
  });

  testWidgets('gender dropdown: going back to "Không nêu" sends empty so the server clears it', (tester) async {
    await signIn(citizen({'gender': 'male'}));
    await pumpEdit(tester);
    expect(find.text('Nam'), findsOneWidget);
    await pickGender(tester, 'Không nêu');
    await tester.tap(save);
    await tester.pumpAndSettle();
    expect(sentBody()['gender'], '');
  });

  group('date of birth picker', () {
    testWidgets('picking a date shows it as dd/MM/yyyy and sends it as ISO yyyy-MM-dd', (tester) async {
      await signIn(citizen({'dateOfBirth': '1990-05-17'}));
      await pumpEdit(tester);
      await tester.tap(find.text('17/05/1990'));
      await tester.pumpAndSettle();
      expect(find.text('Chọn ngày sinh'), findsOneWidget);
      // the picker opens on the stored date; choose another day of the same month
      await tester.tap(find.text('20'));
      await tester.tap(find.text('OK'));
      await tester.pumpAndSettle();
      expect(find.text('20/05/1990'), findsOneWidget);
      await tester.tap(save);
      await tester.pumpAndSettle();
      expect(sentBody()['dateOfBirth'], '1990-05-20');
    });

    testWidgets('cancelling the picker keeps the previous value', (tester) async {
      await signIn(citizen({'dateOfBirth': '1990-05-17'}));
      await pumpEdit(tester);
      await tester.tap(find.text('17/05/1990'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Cancel'));
      await tester.pumpAndSettle();
      expect(find.text('17/05/1990'), findsOneWidget);
    });

    testWidgets('with no stored date the picker opens and the chosen date replaces "Chưa chọn"', (tester) async {
      await pumpEdit(tester);
      await tester.tap(find.text('Chưa chọn'));
      await tester.pumpAndSettle();
      expect(find.text('Chọn ngày sinh'), findsOneWidget);
      await tester.tap(find.text('OK'));
      await tester.pumpAndSettle();
      expect(find.text('Chưa chọn'), findsNothing);
      await tester.tap(save);
      await tester.pumpAndSettle();
      expect(sentBody()['dateOfBirth'], matches(RegExp(r'^\d{4}-\d{2}-\d{2}$')));
    });
  });

  testWidgets('fixing a validation error and saving again sends exactly one request and clears the error', (tester) async {
    await pumpEdit(tester);
    await tester.enterText(field('Họ và tên'), '   ');
    await tester.tap(save);
    await tester.pump();
    expect(find.text('Nhập họ và tên'), findsOneWidget);
    expect(server.requests, isEmpty);
    await tester.enterText(field('Họ và tên'), 'Bình');
    await tester.tap(save);
    await tester.pumpAndSettle();
    expect(find.text('Nhập họ và tên'), findsNothing);
    expect(server.where('PUT', '/api/v1/auth/me').length, 1);
  });

  testWidgets('after a failed save the server error disappears when the next save succeeds', (tester) async {
    server.handler = (_) => jsonResponse(500, {'message': 'boom'});
    await pumpEdit(tester);
    await tester.tap(save);
    await tester.pumpAndSettle();
    expect(find.text('boom'), findsOneWidget);
    server.handler = (_) => jsonResponse(200, {...citizenJson, 'fullName': 'Mới'});
    await tester.tap(save);
    await tester.pumpAndSettle();
    expect(find.text('boom'), findsNothing);
    expect(Session.user.value?.fullName, 'Mới');
  });
}
