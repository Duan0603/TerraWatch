// ignore_for_file: depend_on_referenced_packages
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_auth_platform_interface/firebase_auth_platform_interface.dart';
import 'package:firebase_core_platform_interface/test.dart' show setupFirebaseCoreMocks;
import 'package:flutter_test/flutter_test.dart';
import 'package:geosentry_mobile/core/config/env.dart';
import 'package:geosentry_mobile/core/network/api_exceptions.dart';
import 'package:geosentry_mobile/features/auth/data/google_auth_service.dart';
import 'package:google_sign_in_platform_interface/google_sign_in_platform_interface.dart';

// auth_test.dart / auth_repository_test.dart inject a fake ID-token function, so GoogleAuthService itself was never run.
// Here the two platform interfaces (Google sign-in, Firebase auth) are replaced by fakes and the real service runs on them.

// The service's "initialised" flag is static, so init calls are counted across the whole file, whichever test signs in first.
final _allInits = <InitParameters>[];

class _FakeGoogle extends GoogleSignInPlatform {
  int authenticates = 0;
  int signOuts = 0;
  Object? initError;
  Object? authError;
  Object? signOutError;
  String? idToken = 'google-id-token';

  @override
  Future<void> init(InitParameters params) async {
    _allInits.add(params);
    if (initError != null) throw initError!;
  }

  @override
  Future<AuthenticationResults> authenticate(AuthenticateParameters params) async {
    authenticates++;
    if (authError != null) throw authError!;
    return AuthenticationResults(
      user: const GoogleSignInUserData(email: 'an@example.com', id: 'g-1'),
      authenticationTokens: AuthenticationTokenData(idToken: idToken),
    );
  }

  @override
  Future<void> signOut(SignOutParams params) async {
    signOuts++;
    if (signOutError != null) throw signOutError!;
  }

  @override
  Future<AuthenticationResults?>? attemptLightweightAuthentication(AttemptLightweightAuthenticationParameters params) => null;
  @override
  bool supportsAuthenticate() => true;
  @override
  bool authorizationRequiresUserInteraction() => false;
  @override
  Future<ClientAuthorizationTokenData?> clientAuthorizationTokensForScopes(ClientAuthorizationTokensForScopesParameters params) async => null;
  @override
  Future<ServerAuthorizationTokenData?> serverAuthorizationTokensForScopes(ServerAuthorizationTokensForScopesParameters params) async => null;
  @override
  Future<void> disconnect(DisconnectParams params) async {}
}

class _FakeMultiFactor extends MultiFactorPlatform {
  _FakeMultiFactor(super.auth);
}

class _FakeUser extends UserPlatform {
  _FakeUser(FirebaseAuthPlatform auth, this.firebaseToken)
      : super(auth, _FakeMultiFactor(auth), InternalUserDetails(userInfo: InternalUserInfo(uid: 'fb-1', isAnonymous: false, isEmailVerified: true), providerData: []));

  final String? firebaseToken;

  @override
  Future<String?> getIdToken(bool forceRefresh) async => firebaseToken;
}

class _FakeCredential extends UserCredentialPlatform {
  _FakeCredential(FirebaseAuthPlatform auth, UserPlatform? user) : super(auth: auth, user: user);
}

class _FakeFirebaseAuth extends FirebaseAuthPlatform {
  _FakeFirebaseAuth() : super();

  final credentials = <AuthCredential>[];
  int signOuts = 0;
  Object? signInError;
  Object? signOutError;
  String? firebaseToken = 'firebase-id-token';
  bool noUser = false;

  void reset() {
    credentials.clear();
    signOuts = 0;
    signInError = null;
    signOutError = null;
    firebaseToken = 'firebase-id-token';
    noUser = false;
  }

  @override
  FirebaseAuthPlatform delegateFor({required FirebaseApp app}) => this;

  @override
  FirebaseAuthPlatform setInitialValues({InternalUserDetails? currentUser, String? languageCode}) => this;

  @override
  Future<UserCredentialPlatform> signInWithCredential(AuthCredential credential) async {
    credentials.add(credential);
    if (signInError != null) throw signInError!;
    return _FakeCredential(this, noUser ? null : _FakeUser(this, firebaseToken));
  }

  @override
  Future<void> signOut() async {
    signOuts++;
    if (signOutError != null) throw signOutError!;
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  late _FakeGoogle google;
  // FirebaseAuth keeps the first platform delegate it sees, so one fake lives for the whole file and is reset per test.
  final firebase = _FakeFirebaseAuth();

  setUpAll(() async {
    setupFirebaseCoreMocks();
    await Firebase.initializeApp();
    FirebaseAuthPlatform.instance = firebase;
  });

  setUp(() {
    google = _FakeGoogle();
    GoogleSignInPlatform.instance = google;
    firebase.reset();
  });

  Matcher apiError(String message) => throwsA(isA<ApiException>().having((e) => e.message, 'message', message));

  group('signInForIdToken', () {
    test('Google sign-in is initialised once, with the web client id, however many sign-ins follow', () async {
      await GoogleAuthService.signInForIdToken();
      await GoogleAuthService.signInForIdToken();
      expect(google.authenticates, 2);
      expect(_allInits, hasLength(1));
      expect(_allInits.single.serverClientId, AppEnv.googleServerClientId);
      expect(_allInits.single.serverClientId, isNotEmpty);
    });

    test('success: the Google ID token goes to Firebase and the FIREBASE ID token (not the Google one) is returned', () async {
      final token = await GoogleAuthService.signInForIdToken();
      expect(token, 'firebase-id-token');
      expect(firebase.credentials, hasLength(1));
      expect(firebase.credentials.single.providerId, 'google.com');
      expect(firebase.credentials.single.token, isNull);
      expect(firebase.credentials.single.asMap()['idToken'], 'google-id-token');
    });

    test('the user closes the account picker: null, Firebase is never touched', () async {
      google.authError = const GoogleSignInException(code: GoogleSignInExceptionCode.canceled);
      expect(await GoogleAuthService.signInForIdToken(), isNull);
      expect(firebase.credentials, isEmpty);
    });

    test('any other Google error becomes the generic ApiException message', () async {
      for (final code in [GoogleSignInExceptionCode.unknownError, GoogleSignInExceptionCode.interrupted, GoogleSignInExceptionCode.clientConfigurationError]) {
        google.authError = GoogleSignInException(code: code, description: 'details that must not leak');
        await expectLater(GoogleAuthService.signInForIdToken(), apiError('Đăng nhập Google thất bại'), reason: '$code');
      }
      expect(firebase.credentials, isEmpty);
    });

    test('Firebase rejects the credential: generic ApiException message, no token', () async {
      firebase.signInError = FirebaseAuthException(code: 'invalid-credential', message: 'bad token');
      await expectLater(GoogleAuthService.signInForIdToken(), apiError('Đăng nhập Google thất bại'));
    });

    test('Firebase signs in but returns no user: null (the caller treats it as cancelled, no fake token)', () async {
      firebase.noUser = true;
      expect(await GoogleAuthService.signInForIdToken(), isNull);
    });

    test('Firebase user without an ID token: null', () async {
      firebase.firebaseToken = null;
      expect(await GoogleAuthService.signInForIdToken(), isNull);
    });
  });

  group('signOut', () {
    test('signs out of Google and of Firebase', () async {
      await GoogleAuthService.signOut();
      expect(google.signOuts, 1);
      expect(firebase.signOuts, 1);
    });

    test('a Google failure is swallowed (never signed in with Google / not initialised): logout must still finish', () async {
      google.signOutError = StateError('not initialised');
      await GoogleAuthService.signOut();
      expect(google.signOuts, 1);
    });

    test('a Firebase failure is swallowed too', () async {
      firebase.signOutError = FirebaseAuthException(code: 'no-current-user');
      await GoogleAuthService.signOut();
      expect(firebase.signOuts, 1);
    });
  });
}
