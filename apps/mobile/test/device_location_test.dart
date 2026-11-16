import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:geosentry_mobile/core/network/api_exceptions.dart';
import 'package:geosentry_mobile/features/geofence/data/device_location.dart';

// Target: lib/features/geofence/data/device_location.dart with the geolocator plugin channels faked.
// Covers MD-GEO-001, MD-GEO-002, MD-GEO-003 (and the permission / GPS-off / stale-fix cases of the same file).
// location_service_test covers LocationService itself; the fallback to the last known fix (10 minute limit) and the
// 25 m stream filter live in this file and had no test.

const _method = MethodChannel('flutter.baseflow.com/geolocator');
const _updates = EventChannel('flutter.baseflow.com/geolocator_updates');
const _denied = 0, _deniedForever = 1, _whileInUse = 2;

Map<String, dynamic> _fix(double lat, double lon, {DateTime? at}) => {
      'latitude': lat,
      'longitude': lon,
      'timestamp': (at ?? DateTime.now()).millisecondsSinceEpoch,
      'accuracy': 5.0,
      'altitude': 0.0,
      'heading': 0.0,
      'speed': 0.0,
      'speed_accuracy': 0.0,
    };

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  final messenger = TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger;
  late List<String> calls;
  late Map<String, Object?> args;

  /// [current] null -> getCurrentPosition fails like a GPS that cannot fix; [lastKnown] null -> no cached fix.
  void mock({bool serviceOn = true, int permission = _whileInUse, int? afterPrompt, Object? current, Object? lastKnown}) {
    messenger.setMockMethodCallHandler(_method, (call) async {
      calls.add(call.method);
      args[call.method] = call.arguments;
      switch (call.method) {
        case 'isLocationServiceEnabled':
          return serviceOn;
        case 'checkPermission':
          return permission;
        case 'requestPermission':
          return afterPrompt ?? permission;
        case 'getCurrentPosition':
          if (current == null) throw PlatformException(code: 'LOCATION_UPDATE_FAILURE', message: 'no fix');
          return current;
        case 'getLastKnownPosition':
          return lastKnown;
      }
      return null;
    });
  }

  setUp(() {
    calls = [];
    args = {};
  });

  tearDown(() {
    messenger.setMockMethodCallHandler(_method, null);
    messenger.setMockStreamHandler(_updates, null);
  });

  group('currentPosition: valid and missing data (MD-GEO-001, MD-GEO-002)', () {
    test('MD-GEO-001: a fresh fix becomes a (latitude, longitude) record', () async {
      mock(current: _fix(21.864, 104.113));
      final p = await currentPosition();
      expect((p.latitude, p.longitude), (21.864, 104.113));
      expect(calls, isNot(contains('getLastKnownPosition')), reason: 'the cached fix is only a fallback');
    });

    test('MD-GEO-002: no fresh fix but a cached fix 9 min 59 s old is used', () async {
      mock(lastKnown: _fix(22.0, 103.0, at: DateTime.now().subtract(const Duration(minutes: 9, seconds: 59))));
      final p = await currentPosition();
      expect((p.latitude, p.longitude), (22.0, 103.0));
    });

    test('MD-GEO-002: no fresh fix and no cached fix is a Vietnamese error, not a (0, 0) position', () async {
      mock();
      await expectLater(
        currentPosition(),
        throwsA(isA<ApiException>().having((e) => e.message, 'message', 'Không lấy được vị trí hiện tại. Hãy bật GPS và thử lại')),
      );
    });
  });

  group('currentPosition: stale or refused (MD-GEO-003)', () {
    test('a cached fix older than 10 minutes (here 11 min) is rejected rather than reported as the current place', () async {
      mock(lastKnown: _fix(22.0, 103.0, at: DateTime.now().subtract(const Duration(minutes: 11))));
      await expectLater(currentPosition(), throwsA(isA<ApiException>().having((e) => e.message, 'message', startsWith('Không lấy được vị trí'))));
    });

    test('permission refused, forever denied, or the location service off: the reminder message and the GPS is never read', () async {
      const reminder = 'Cần bật GPS và cấp quyền vị trí để kiểm tra vùng cảnh báo';
      for (final setup in <void Function()>[
        () => mock(permission: _denied, afterPrompt: _denied, current: _fix(1, 1)),
        () => mock(permission: _deniedForever, current: _fix(1, 1)),
        () => mock(serviceOn: false, current: _fix(1, 1)),
      ]) {
        calls.clear();
        setup();
        await expectLater(currentPosition(), throwsA(isA<ApiException>().having((e) => e.message, 'message', reminder)));
        expect(calls, isNot(contains('getCurrentPosition')));
        expect(calls, isNot(contains('getLastKnownPosition')), reason: 'no fallback without permission');
      }
    });

    test('permission denied at first, allowed on the prompt: the fix is read after exactly one request', () async {
      mock(permission: _denied, afterPrompt: _whileInUse, current: _fix(10.5, 106.7));
      final p = await currentPosition();
      expect((p.latitude, p.longitude), (10.5, 106.7));
      expect(calls.where((c) => c == 'requestPermission'), hasLength(1));
    });
  });

  group('positionUpdates', () {
    test('MD-GEO-001: asks for high accuracy with a 25 m distance filter and maps each fix to a record', () async {
      mock();
      late MockStreamHandlerEventSink sink;
      Object? listenArgs;
      messenger.setMockStreamHandler(
        _updates,
        MockStreamHandler.inline(onListen: (a, events) {
          listenArgs = a;
          sink = events;
        }),
      );
      final received = <DevicePosition>[];
      final sub = positionUpdates().listen(received.add);
      while (listenArgs == null) {
        await Future<void>.delayed(Duration.zero); // wait for the platform subscription itself
      }
      expect((listenArgs! as Map)['distanceFilter'], 25);
      sink.success(_fix(21.0, 105.8));
      sink.success(_fix(21.1, 105.9));
      while (received.length < 2) {
        await Future<void>.delayed(Duration.zero);
      }
      expect(received.map((p) => [p.latitude, p.longitude]), [
        [21.0, 105.8],
        [21.1, 105.9],
      ]);
      await sub.cancel();
    });

    test('MD-GEO-003: without permission the stream fails with the reminder and never subscribes to the platform', () async {
      mock(permission: _denied, afterPrompt: _denied);
      var subscribed = false;
      messenger.setMockStreamHandler(_updates, MockStreamHandler.inline(onListen: (a, e) => subscribed = true));
      await expectLater(
        positionUpdates(),
        emitsError(isA<ApiException>().having((e) => e.message, 'message', startsWith('Cần bật GPS'))),
      );
      expect(subscribed, isFalse);
    });
  });
}
