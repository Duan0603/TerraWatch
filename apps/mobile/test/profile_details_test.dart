import 'dart:convert';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:geosentry_mobile/core/network/api_client.dart';
import 'package:geosentry_mobile/core/storage/session.dart';
import 'package:geosentry_mobile/features/auth/data/auth_models.dart';
import 'package:geosentry_mobile/features/auth/data/auth_repository.dart';
import 'package:geosentry_mobile/features/profile/presentation/edit_profile_screen.dart';

const _user = {
  'userId': 'u-1',
  'fullName': 'Nguyễn Văn An',
  'email': 'an@example.com',
  'role': 'citizen',
  'phoneNumber': '0912345678',
  'authProvider': 'email',
  'dateOfBirth': '1990-05-20',
  'gender': 'female',
  'province': 'Yên Bái',
  'district': 'Mù Cang Chải',
  'commune': 'Lìm Mông',
  'addressLine': 'Bản Lìm Mông 3',
  'emergencyContactName': 'Trần Thị B',
  'emergencyContactPhone': '0987654321',
  'emergencyContactRelation': 'Mẹ',
  'hasAvatar': false,
};

ApiClient _api(http.Response Function(http.Request) handler) =>
    ApiClient(client: MockClient((r) async => handler(r)), baseUrl: 'http://test');

http.Response _json(int status, Object body) =>
    http.Response(jsonEncode(body), status, headers: {'content-type': 'application/json'});

void main() {
  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    await Session.save('jwt-1', UserProfile.fromJson(_user));
  });

  group('Profile details (Story 5.8)', () {
    test('parses the new fields and builds display strings', () {
      final u = UserProfile.fromJson(_user);
      expect(u.dateOfBirthDisplay, '20/05/1990');
      expect(u.genderLabel, 'Nữ');
      expect(u.fullAddress, 'Bản Lìm Mông 3, Lìm Mông, Mù Cang Chải, Yên Bái');
      expect(u.emergencyContactDisplay, 'Trần Thị B (Mẹ) · 0987654321');
    });

    test('old servers without the new fields still parse, and empty values show nothing', () {
      final u = UserProfile.fromJson({
        'userId': 'u-2',
        'fullName': 'An',
        'email': 'a@b.c',
        'role': 'citizen',
      });
      expect(u.dateOfBirthDisplay, isNull);
      expect(u.genderLabel, isNull);
      expect(u.fullAddress, isNull);
      expect(u.emergencyContactDisplay, isNull);
      expect(u.hasAvatar, isFalse);
    });

    test('updateProfile sends every field (blank clears) with a null birth date when empty', () async {
      late Map<String, dynamic> sent;
      final repo = AuthRepository(apiClient: _api((r) {
        sent = jsonDecode(r.body) as Map<String, dynamic>;
        return _json(200, _user);
      }));
      await repo.updateProfile(fullName: ' An ', province: ' Yên Bái ');
      expect(sent['fullName'], 'An');
      expect(sent['province'], 'Yên Bái');
      expect(sent['district'], '');
      expect(sent['dateOfBirth'], isNull);
      expect(sent.keys, containsAll(['phoneNumber', 'gender', 'commune', 'addressLine', 'emergencyContactName']));
    });

    test('avatar: fetch decodes base64, 404 means none, upload and delete update the session', () async {
      final png = Uint8List.fromList([0x89, 0x50, 0x4E, 0x47, 1, 2, 3]);
      final repo = AuthRepository(apiClient: _api((r) {
        if (r.method == 'GET') return _json(200, {'imageBase64': base64Encode(png)});
        if (r.method == 'PUT') {
          expect(jsonDecode(r.body)['imageBase64'], base64Encode(png));
          return _json(200, {..._user, 'hasAvatar': true});
        }
        return http.Response('', 204);
      }));
      expect(await repo.fetchAvatar(), png);

      await repo.uploadAvatar(png);
      expect(Session.user.value?.hasAvatar, isTrue);
      expect(Session.avatar.value, png);

      await repo.deleteAvatar();
      expect(Session.user.value?.hasAvatar, isFalse);
      expect(Session.avatar.value, isNull);

      final none = AuthRepository(apiClient: _api((_) => _json(404, {'message': 'No avatar'})));
      expect(await none.fetchAvatar(), isNull);
    });

    test('logging out drops the cached avatar', () async {
      Session.avatar.value = Uint8List.fromList([1, 2, 3]);
      await Session.clear();
      expect(Session.avatar.value, isNull);
    });

    testWidgets('edit screen needs both name and phone for the emergency contact', (tester) async {
      await Session.save('jwt-1', UserProfile.fromJson({..._user, 'emergencyContactName': null, 'emergencyContactPhone': null}));
      await tester.pumpWidget(const MaterialApp(home: EditProfileScreen()));
      final emergencyPhone = find.widgetWithText(TextFormField, 'Số điện thoại người thân');
      await tester.ensureVisible(emergencyPhone);
      await tester.enterText(emergencyPhone, '0987654321');
      await tester.ensureVisible(find.text('Lưu'));
      await tester.tap(find.text('Lưu'));
      await tester.pump();
      expect(find.text('Nhập tên người liên hệ'), findsOneWidget);
    });
  });
}
