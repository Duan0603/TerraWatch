import 'dart:async';

import 'package:firebase_core/firebase_core.dart';
// ignore: depend_on_referenced_packages
import 'package:firebase_core_platform_interface/test.dart' show setupFirebaseCoreMocks;
// ignore: depend_on_referenced_packages
import 'package:firebase_messaging_platform_interface/firebase_messaging_platform_interface.dart' show FirebaseMessagingPlatform, RemoteMessage;
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:geosentry_mobile/core/storage/local_storage.dart';
import 'package:geosentry_mobile/features/alerts/data/alert_models.dart';
import 'package:geosentry_mobile/services/notification_service.dart';
import 'package:geosentry_mobile/services/push_service.dart';

import 'support/harness.dart';

const _localNotifications = MethodChannel('dexterous.com/flutter/local_notifications');
const _messaging = MethodChannel('plugins.flutter.io/firebase_messaging');

AlertModel _alert(String id) => AlertModel(
      broadcastId: id,
      title: 'Cảnh báo $id',
      message: 'Sơ tán ngay',
      severity: 'extreme',
      areaName: 'Sa Pa',
      receivedAt: '2026-10-30T10:00:00Z',
    );

RemoteMessage _push(Map<String, dynamic> data) => RemoteMessage(data: data);

Map<String, dynamic> _emergency(String id) => {
      'type': 'EMERGENCY_ALERT',
      'broadcastId': id,
      'severity': 'extreme',
      'areaName': 'Sa Pa',
      'title': 'Cảnh báo $id',
      'message': 'Sơ tán ngay',
      'issuedAt': '2026-10-30T10:00:00Z',
      'validUntil': '2026-10-31T10:00:00Z',
    };

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  useIsolatedSqlite();

  final backend = FakeBackend();
  final localCalls = <MethodCall>[];
  final messagingCalls = <MethodCall>[];
  var notificationsEnabled = true;
  String? fcmToken = 'fcm-token-1';
  Map<String, dynamic>? initialMessage;
  Object? permissionError;
  Object? tokenError;
  final emitted = <AlertModel>[];
  StreamSubscription<AlertModel>? alertSub;

  Future<Map<String, dynamic>> alerts() async => {for (final r in await LocalStorage.getAlertHistory()) r['broadcast_id'] as String: r};

  setUpAll(() async {
    setupFirebaseCoreMocks();
    await Firebase.initializeApp();
    // The plugin picks its platform implementation when NotificationService's static field is first
    // touched, so touch it once while pretending to be Android (production target).
    debugDefaultTargetPlatformOverride = TargetPlatform.android;
    await NotificationService.areEnabled();
    debugDefaultTargetPlatformOverride = null;
  });

  setUp(() async {
    await signIn();
    backend
      ..online = true
      ..requests.clear()
      ..handler = (r) {
        if (r.url.path.endsWith('/alerts/broadcasts')) return jsonResponse(200, []);
        return jsonResponse(200, {});
      };
    localCalls.clear();
    messagingCalls.clear();
    notificationsEnabled = true;
    fcmToken = 'fcm-token-1';
    initialMessage = null;
    permissionError = null;
    tokenError = null;
    emitted.clear();
    await LocalStorage.clearAlertHistory();
    final messenger = TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger;
    messenger.setMockMethodCallHandler(_localNotifications, (call) async {
      localCalls.add(call);
      return switch (call.method) {
        'areNotificationsEnabled' => notificationsEnabled,
        'initialize' => true,
        _ => null,
      };
    });
    messenger.setMockMethodCallHandler(_messaging, (call) async {
      messagingCalls.add(call);
      switch (call.method) {
        case 'Messaging#requestPermission':
          if (permissionError != null) throw permissionError!;
          return {'authorizationStatus': notificationsEnabled ? 1 : 0};
        case 'Messaging#getToken':
          if (tokenError != null) throw tokenError!;
          return {'token': fcmToken};
        case 'Messaging#getInitialMessage':
          return initialMessage;
        default:
          return null;
      }
    });
    alertSub = NotificationService.onEmergencyAlert.listen(emitted.add);
  });

  tearDown(() async {
    await alertSub?.cancel();
    await PushService.stop();
    final messenger = TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger;
    messenger.setMockMethodCallHandler(_localNotifications, null);
    messenger.setMockMethodCallHandler(_messaging, null);
    debugDefaultTargetPlatformOverride = null;
  });

  Future<void> flush() => Future<void>.delayed(const Duration(milliseconds: 50));

  group('NotificationService', () {
    test('areEnabled reflects the system setting; false means the siren will not be heard', () async {
      debugDefaultTargetPlatformOverride = TargetPlatform.android;
      expect(await NotificationService.areEnabled(), isTrue);
      notificationsEnabled = false;
      expect(await NotificationService.areEnabled(), isFalse);
    });

    test('initialize registers the plugin and creates the alarm channel', () async {
      debugDefaultTargetPlatformOverride = TargetPlatform.android;
      await NotificationService.initialize();
      expect(localCalls.map((c) => c.method), containsAll(['initialize', 'createNotificationChannel']));
      final channel = localCalls.firstWhere((c) => c.method == 'createNotificationChannel').arguments as Map;
      expect(channel['id'], NotificationService.alarmChannelId);
      expect(channel['importance'], 5); // Importance.max
    });

    test('initialize survives a plugin failure when creating the channel', () async {
      debugDefaultTargetPlatformOverride = TargetPlatform.android;
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger.setMockMethodCallHandler(_localNotifications, (call) async {
        if (call.method == 'createNotificationChannel') throw PlatformException(code: 'boom');
        return true;
      });
      await NotificationService.initialize(); // must not throw
    });

    test('requestPermission asks Android and swallows a denial or plugin failure', () async {
      debugDefaultTargetPlatformOverride = TargetPlatform.android;
      await NotificationService.requestPermission();
      expect(localCalls.map((c) => c.method), contains('requestNotificationsPermission'));
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(_localNotifications, (call) async => throw PlatformException(code: 'denied'));
      await NotificationService.requestPermission(); // must not throw
    });

    test('showEmergencyAlert shows a max-priority alarm notification; a plugin failure is swallowed', () async {
      debugDefaultTargetPlatformOverride = TargetPlatform.android;
      await NotificationService.showEmergencyAlert(title: 'T', body: 'B');
      final show = localCalls.firstWhere((c) => c.method == 'show');
      final args = show.arguments as Map;
      expect((args['title'], args['body']), ('T', 'B'));
      final platform = args['platformSpecifics'] as Map;
      expect(platform['channelId'], NotificationService.alarmChannelId);
      expect(platform['fullScreenIntent'], isTrue);
      expect(platform['playSound'], isTrue);

      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(_localNotifications, (call) async => throw PlatformException(code: 'POST_NOTIFICATIONS denied'));
      await NotificationService.showEmergencyAlert(title: 'T', body: 'B'); // must not throw
    });

    test('triggerEmergencyAlarm stores the alert, rings, and emits it to the UI', () async {
      debugDefaultTargetPlatformOverride = TargetPlatform.android;
      await NotificationService.triggerEmergencyAlarm(_alert('t1'));
      await flush();
      expect((await alerts()).keys, contains('t1'));
      expect(localCalls.where((c) => c.method == 'show').length, 1);
      expect(emitted.single.broadcastId, 't1');
      final show = localCalls.firstWhere((c) => c.method == 'show').arguments as Map;
      expect(show['body'], 'Sa Pa: Sơ tán ngay');
    });

    test('triggerEmergencyAlarm still opens the red screen when the OS notification is blocked', () async {
      debugDefaultTargetPlatformOverride = TargetPlatform.android;
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(_localNotifications, (call) async => throw PlatformException(code: 'denied'));
      await NotificationService.triggerEmergencyAlarm(_alert('t2'));
      await flush();
      expect(emitted.single.broadcastId, 't2');
      expect((await alerts()).keys, contains('t2'));
    });

    test('openAlert (tap on a system notification) stores and emits but does not ring again', () async {
      debugDefaultTargetPlatformOverride = TargetPlatform.android;
      await NotificationService.openAlert(_alert('t3'));
      await flush();
      expect(localCalls.where((c) => c.method == 'show'), isEmpty);
      expect(emitted.single.broadcastId, 't3');
      expect((await alerts()).keys, contains('t3'));
    });

    test('the same alert delivered twice is stored once', () async {
      await NotificationService.openAlert(_alert('dup'));
      await NotificationService.openAlert(_alert('dup'));
      expect((await LocalStorage.getAlertHistory()).where((r) => r['broadcast_id'] == 'dup').length, 1);
    });
  });

  group('PushService', () {
    // Everything here runs through the real FirebaseMessaging with its method channel faked.
    Future<void> start() async {
      debugDefaultTargetPlatformOverride = TargetPlatform.android;
      await withFakeHttp(backend, PushService.start);
      await flush();
    }

    Iterable<String> tokenRegistrations() => backend.requests
        .where((r) => r.url.path == '/api/v1/alerts/devices/register')
        .map((r) => r.body);

    test('start asks permission, registers the token for the signed-in account, then resyncs', () async {
      await start();
      expect(messagingCalls.map((c) => c.method), containsAllInOrder(['Messaging#requestPermission', 'Messaging#getToken']));
      expect(tokenRegistrations().single, contains('fcm-token-1'));
      expect(backend.requests.where((r) => r.url.path == '/api/v1/alerts/devices/register').single.headers['Authorization'], 'Bearer jwt-1');
      expect(backend.requests.any((r) => r.url.path == '/api/v1/alerts/broadcasts'), isTrue);
    });

    test('permission denied: the app keeps running and the history is still resynced', () async {
      notificationsEnabled = false;
      permissionError = PlatformException(code: 'permission-denied');
      await start();
      expect(tokenRegistrations(), isEmpty);
      expect(backend.requests.any((r) => r.url.path == '/api/v1/alerts/broadcasts'), isTrue);
    });

    test('a null token registers nothing', () async {
      fcmToken = null;
      await start();
      expect(tokenRegistrations(), isEmpty);
    });

    test('token fetch failure is swallowed', () async {
      tokenError = PlatformException(code: 'unavailable');
      await start();
      expect(tokenRegistrations(), isEmpty);
    });

    test('server down at start: no crash and no stored token claim', () async {
      backend.online = false;
      await start();
      expect(tokenRegistrations().length, 1); // attempted once, failure swallowed by the repository
    });

    test('foreground emergency push stores the alert, rings and opens the red screen', () async {
      debugDefaultTargetPlatformOverride = TargetPlatform.android;
      await start();
      FirebaseMessagingPlatform.onMessage.add(_push(_emergency('fg1')));
      await flush();
      expect(emitted.single.broadcastId, 'fg1');
      expect(emitted.single.validUntil, '2026-10-31T10:00:00Z');
      expect((await alerts()).keys, contains('fg1'));
      expect(localCalls.where((c) => c.method == 'show').length, 1);
    });

    test('a push of another type is ignored', () async {
      await start();
      FirebaseMessagingPlatform.onMessage.add(_push({'type': 'PROMO', 'broadcastId': 'x'}));
      FirebaseMessagingPlatform.onMessage.add(_push({}));
      await flush();
      expect(emitted, isEmpty);
      expect(await alerts(), isEmpty);
    });

    test('emergency push with missing fields still alerts, with safe defaults (never silent)', () async {
      await start();
      FirebaseMessagingPlatform.onMessage.add(_push({'type': 'EMERGENCY_ALERT'}));
      await flush();
      expect(emitted.single.severity, 'extreme');
      expect(emitted.single.areaName, 'Khu vực trọng điểm');
      expect(emitted.single.message, isNotEmpty);
    });

    test('tapping a notification while the app is in the background opens the alert without ringing', () async {
      await start();
      FirebaseMessagingPlatform.onMessageOpenedApp.add(_push(_emergency('tap1')));
      await flush();
      expect(emitted.single.broadcastId, 'tap1');
      expect(localCalls.where((c) => c.method == 'show'), isEmpty);
      expect((await alerts()).keys, contains('tap1'));
    });

    test('app launched from a notification (terminated state) opens that alert', () async {
      initialMessage = {'data': _emergency('cold1')};
      await start();
      expect(emitted.single.broadcastId, 'cold1');
      expect(localCalls.where((c) => c.method == 'show'), isEmpty);
    });

    test('launch message of another type is ignored', () async {
      initialMessage = {'data': {'type': 'PROMO'}};
      await start();
      expect(emitted, isEmpty);
    });

    test('token refresh re-registers the new token', () async {
      await start();
      backend.requests.clear();
      await TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger.handlePlatformMessage(
        _messaging.name,
        const StandardMethodCodec().encodeMethodCall(const MethodCall('Messaging#onTokenRefresh', 'fcm-token-2')),
        (_) {},
      );
      await flush();
      expect(tokenRegistrations().single, contains('fcm-token-2'));
    });

    test('calling start twice does not double-deliver a push', () async {
      await start();
      await start();
      FirebaseMessagingPlatform.onMessage.add(_push(_emergency('once')));
      await flush();
      expect(emitted.length, 1);
    });

    test('stop unregisters the token with DELETE and stops listening', () async {
      await start();
      backend.requests.clear();
      await withFakeHttp(backend, PushService.stop);
      final del = backend.requests.single;
      expect((del.method, del.url.path), ('DELETE', '/api/v1/alerts/devices'));
      expect(del.body, contains('fcm-token-1'));
      FirebaseMessagingPlatform.onMessage.add(_push(_emergency('after-stop')));
      await flush();
      expect(emitted, isEmpty);
    });

    test('stop without a prior start sends nothing', () async {
      await withFakeHttp(backend, PushService.stop);
      expect(backend.requests, isEmpty);
    });

    test('resync merges missed alerts and revocations from the server; offline keeps what is stored', () async {
      await NotificationService.openAlert(_alert('local'));
      backend.handler = (_) => jsonResponse(200, [
            {
              'broadcastId': 'missed',
              'title': 'Bị lỡ',
              'message': 'm',
              'severity': 'high',
              'areaName': 'a',
              'issuedAt': '2026-10-30T10:00:00Z',
              'validUntil': '2026-10-31T10:00:00Z',
              'status': 'active',
            }
          ]);
      await withFakeHttp(backend, PushService.resync);
      expect((await alerts()).keys, containsAll(['local', 'missed']));

      backend.online = false;
      await withFakeHttp(backend, PushService.resync); // must not throw
      expect((await alerts()).keys, containsAll(['local', 'missed']));
    });
  });
}
