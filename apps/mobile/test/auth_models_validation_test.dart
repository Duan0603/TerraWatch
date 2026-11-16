import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:geosentry_mobile/core/network/api_client.dart';
import 'package:geosentry_mobile/core/network/api_exceptions.dart';
import 'package:geosentry_mobile/core/storage/session.dart';
import 'package:geosentry_mobile/features/auth/data/auth_models.dart';
import 'package:geosentry_mobile/features/auth/data/auth_repository.dart';

import 'support/harness.dart';

// Targets: lib/features/auth/data/auth_models.dart (MD-AUTH-001, 002, 003) and the malformed-answer paths of
// auth_repository.dart (MD-AUTH-005, 006).
// Already asserted by auth_test / auth_repository_test / profile_details_test: MD-AUTH-004 (login stores the session),
// 4xx and 5xx mapping (MD-AUTH-007, 008), offline (MD-AUTH-009), display getters on a full and an empty profile.
// MD-AUTH-011..017 (google_auth_service) are already asserted by google_auth_service_test (success, cancel, generic error,
// Firebase rejection, no user / no token, sign-out failures). MD-AUTH-010 does not apply: the repository never asks an OS permission.

void main() {
  group('UserProfile (MD-AUTH-001, 002, 003)', () {
    test('MD-AUTH-001: toJson -> fromJson keeps every field, including optional ones', () {
      final full = UserProfile.fromJson({
        ...citizenJson,
        'phoneNumber': '0912345678',
        'authProvider': 'google',
        'dateOfBirth': '1990-05-20',
        'gender': 'female',
        'province': 'Yên Bái',
        'district': 'Mù Cang Chải',
        'commune': 'Lìm Mông',
        'addressLine': 'Bản 3',
        'emergencyContactName': 'B',
        'emergencyContactPhone': '0987654321',
        'emergencyContactRelation': 'Mẹ',
        'hasAvatar': true,
      });
      final json = jsonDecode(jsonEncode(full.toJson())) as Map<String, dynamic>;
      expect(UserProfile.fromJson(json).toJson(), full.toJson());
      expect(json.length, 16, reason: 'the stored profile has all 16 fields');
    });

    test('MD-AUTH-002: only the four required fields given: everything else is null, authProvider is "email", hasAvatar false', () {
      final p = UserProfile.fromJson({'userId': 'u', 'fullName': 'An', 'email': 'a@b.c', 'role': 'citizen'});
      expect((p.authProvider, p.hasAvatar), ('email', false));
      expect([p.phoneNumber, p.dateOfBirth, p.gender, p.province, p.district, p.commune, p.addressLine], everyElement(isNull));
      expect([p.emergencyContactName, p.emergencyContactPhone, p.emergencyContactRelation], everyElement(isNull));
      final nulls = UserProfile.fromJson({...citizenJson, 'authProvider': null, 'hasAvatar': null});
      expect((nulls.authProvider, nulls.hasAvatar), ('email', false));
    });

    test('MD-AUTH-002: display getters treat blank parts as missing and keep the order of the address', () {
      final p = UserProfile.fromJson({...citizenJson, 'province': 'Lào Cai', 'district': '', 'commune': 'Bản Hồ', 'addressLine': null});
      expect(p.fullAddress, 'Bản Hồ, Lào Cai');
      expect(UserProfile.fromJson({...citizenJson, 'emergencyContactPhone': '0987'}).emergencyContactDisplay, '0987');
      expect(UserProfile.fromJson({...citizenJson, 'emergencyContactName': 'B', 'emergencyContactRelation': 'Mẹ'}).emergencyContactDisplay, 'B (Mẹ)');
      expect(UserProfile.fromJson({...citizenJson, 'gender': 'unknown'}).genderLabel, isNull);
    });

    test('MD-AUTH-002: initials use at most the last two words and survive blank and one-word names', () {
      String initials(String name) => UserProfile.fromJson({...citizenJson, 'fullName': name}).initials;
      expect(initials('Nguyễn Văn An'), 'VA');
      expect(initials('  an  '), 'A');
      expect(initials('   '), '?');
      expect(initials(''), '?');
    });

    test('MD-AUTH-002: a birth date that is not exactly 10 characters is not displayed', () {
      expect(UserProfile.fromJson({...citizenJson, 'dateOfBirth': '1990-5-2'}).dateOfBirthDisplay, isNull);
      expect(UserProfile.fromJson({...citizenJson, 'dateOfBirth': '1990-05-20'}).dateOfBirthDisplay, '20/05/1990');
    });

    test('MD-AUTH-003: a missing required field or a wrongly typed field is rejected with a TypeError, never a half-filled profile', () {
      for (final key in ['userId', 'fullName', 'email', 'role']) {
        final json = {...citizenJson}..remove(key);
        expect(() => UserProfile.fromJson(json), throwsA(isA<TypeError>()), reason: 'missing $key');
      }
      expect(() => UserProfile.fromJson({...citizenJson, 'userId': 7}), throwsA(isA<TypeError>()));
      expect(() => UserProfile.fromJson({...citizenJson, 'hasAvatar': 'yes'}), throwsA(isA<TypeError>()));
      expect(() => UserProfile.fromJson({...citizenJson, 'phoneNumber': 912345678}), throwsA(isA<TypeError>()));
    });

    test('MD-AUTH-003: AuthResult needs a token string and a user object', () {
      expect(AuthResult.fromJson({'token': 't', 'user': citizenJson}).user.userId, 'u-1');
      expect(() => AuthResult.fromJson({'user': citizenJson}), throwsA(isA<TypeError>()));
      expect(() => AuthResult.fromJson({'token': 't'}), throwsA(isA<TypeError>()));
      expect(() => AuthResult.fromJson({'token': 't', 'user': 'bob'}), throwsA(isA<TypeError>()));
      expect(() => AuthResult.fromJson({'token': 5, 'user': citizenJson}), throwsA(isA<TypeError>()));
    });
  });

  group('AuthRepository malformed answers (MD-AUTH-005, MD-AUTH-006)', () {
    late FakeBackend server;
    late AuthRepository repo;

    setUp(() async {
      server = FakeBackend();
      repo = AuthRepository(apiClient: ApiClient(client: server.client, baseUrl: 'http://test'), googleIdToken: () async => 'fb-token');
      await signOutForTest();
    });

    Matcher invalid() => throwsA(isA<ApiException>().having((e) => e.message, 'message', 'Phản hồi máy chủ không hợp lệ'));

    test('MD-AUTH-005, MD-AUTH-006: login / register / google answers with a missing or mistyped token or user store no session', () async {
      for (final body in <Object>[
        {'user': citizenJson},
        {'token': 't', 'user': {...citizenJson}..remove('role')},
        {'token': 12, 'user': citizenJson},
        {'token': 't', 'user': 'x'},
        <String, dynamic>{},
      ]) {
        server.handler = (_) => jsonResponse(200, body);
        await expectLater(repo.login('a@b.c', 'x'), invalid(), reason: '$body');
        await expectLater(repo.register(fullName: 'A', email: 'a@b.c', password: '12345678'), invalid(), reason: '$body');
        await expectLater(repo.loginWithGoogle(), invalid(), reason: '$body');
        expect(Session.token, isNull);
        expect(Session.user.value, isNull);
      }
    });

    test('MD-AUTH-006: a bad answer while signed in leaves the earlier session untouched', () async {
      await signIn();
      server.handler = (_) => jsonResponse(200, {'token': 'jwt-new'});
      await expectLater(repo.login('a@b.c', 'x'), invalid());
      expect((Session.token, Session.user.value?.userId), ('jwt-1', 'u-1'));
    });

    test('MD-AUTH-005: refreshProfile with a profile answer that lacks required fields keeps the stored profile, and throws', () async {
      await signIn();
      server.handler = (_) => jsonResponse(200, {'userId': 'u-1'});
      await expectLater(repo.refreshProfile(), throwsA(isA<TypeError>()));
      expect(Session.user.value?.fullName, 'Nguyễn Văn An');
    });

    test('MD-AUTH-006: updateProfile with a malformed answer is an ApiException and the stored profile is not changed', () async {
      await signIn();
      server.handler = (_) => jsonResponse(200, {'fullName': 'Hacker'});
      await expectLater(repo.updateProfile(fullName: 'Hacker'), invalid());
      expect(Session.user.value?.fullName, 'Nguyễn Văn An');
    });

    test('MD-AUTH-006: fetchAvatar with an answer that has no image text throws instead of returning empty bytes', () async {
      await signIn();
      server.handler = (_) => jsonResponse(200, {'other': 1});
      await expectLater(repo.fetchAvatar(), throwsA(isA<TypeError>()));
      server.handler = (_) => jsonResponse(200, {'imageBase64': '%%%not-base64'});
      await expectLater(repo.fetchAvatar(), throwsFormatException);
    });
  });
}
