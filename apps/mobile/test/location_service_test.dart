import 'dart:async';

import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:geolocator/geolocator.dart';
import 'package:geosentry_mobile/services/location_service.dart';

// Other tests (map_test, geofence tests) reach LocationService only through screens. This file tests the
// service itself with the geolocator plugin channels faked: every permission branch and the stream settings.

const _method = MethodChannel('flutter.baseflow.com/geolocator');
const _updates = EventChannel('flutter.baseflow.com/geolocator_updates');
// geolocator permission codes: 0 denied, 1 deniedForever, 2 whileInUse, 3 always
const _denied = 0, _deniedForever = 1, _whileInUse = 2, _always = 3;

Map<String, dynamic> _position(double lat, double lng) => {
      'latitude': lat,
      'longitude': lng,
      'timestamp': DateTime(2026, 10, 30).millisecondsSinceEpoch,
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
  late Map<String, Object?> lastArgs;

  void mock({bool serviceOn = true, int check = _whileInUse, int? request, Object? position}) {
    messenger.setMockMethodCallHandler(_method, (call) async {
      calls.add(call.method);
      lastArgs[call.method] = call.arguments;
      switch (call.method) {
        case 'isLocationServiceEnabled':
          return serviceOn;
        case 'checkPermission':
          return check;
        case 'requestPermission':
          return request ?? check;
        case 'getCurrentPosition':
          if (position == null) throw PlatformException(code: 'LOCATION_SERVICES_DISABLED');
          return position;
      }
      return null;
    });
  }

  setUp(() {
    calls = [];
    lastArgs = {};
  });

  tearDown(() {
    messenger.setMockMethodCallHandler(_method, null);
    messenger.setMockStreamHandler(_updates, null);
  });

  group('checkAndRequestPermission', () {
    test('location service switched off: false, and the user is not even asked for permission', () async {
      mock(serviceOn: false);
      expect(await LocationService.checkAndRequestPermission(), isFalse);
      expect(calls, ['isLocationServiceEnabled']);
    });

    test('already allowed (while in use or always): true without prompting', () async {
      for (final granted in [_whileInUse, _always]) {
        calls.clear();
        mock(check: granted);
        expect(await LocationService.checkAndRequestPermission(), isTrue, reason: 'code $granted');
        expect(calls, ['isLocationServiceEnabled', 'checkPermission'], reason: 'code $granted');
      }
    });

    test('denied, then the user allows on the prompt: true after exactly one request', () async {
      mock(check: _denied, request: _whileInUse);
      expect(await LocationService.checkAndRequestPermission(), isTrue);
      expect(calls, ['isLocationServiceEnabled', 'checkPermission', 'requestPermission']);
    });

    test('denied, then refused on the prompt: false', () async {
      mock(check: _denied, request: _denied);
      expect(await LocationService.checkAndRequestPermission(), isFalse);
      expect(calls, ['isLocationServiceEnabled', 'checkPermission', 'requestPermission']);
    });

    test('denied, then the prompt answers "denied forever": false', () async {
      mock(check: _denied, request: _deniedForever);
      expect(await LocationService.checkAndRequestPermission(), isFalse);
    });

    test('denied forever: false, and no prompt is shown (the system would ignore it)', () async {
      mock(check: _deniedForever);
      expect(await LocationService.checkAndRequestPermission(), isFalse);
      expect(calls, ['isLocationServiceEnabled', 'checkPermission']);
    });
  });

  group('getCurrentLocation', () {
    test('permission granted: returns the device position with high accuracy requested', () async {
      mock(position: _position(22.3, 103.8));
      final p = await LocationService.getCurrentLocation();
      expect(p, isNotNull);
      expect(p!.latitude, 22.3);
      expect(p.longitude, 103.8);
      expect((lastArgs['getCurrentPosition']! as Map)['accuracy'], LocationAccuracy.high.index);
    });

    test('permission refused: null and the GPS is never read', () async {
      mock(check: _denied, request: _denied, position: _position(1, 1));
      expect(await LocationService.getCurrentLocation(), isNull);
      expect(calls, isNot(contains('getCurrentPosition')));
    });

    test('location service off: null and the GPS is never read', () async {
      mock(serviceOn: false, position: _position(1, 1));
      expect(await LocationService.getCurrentLocation(), isNull);
      expect(calls, isNot(contains('getCurrentPosition')));
    });

    test('permission granted but the plugin cannot read a fix: the error reaches the caller (not a fake position)', () async {
      mock(); // no position -> LOCATION_SERVICES_DISABLED from the platform
      await expectLater(LocationService.getCurrentLocation(), throwsA(isA<LocationServiceDisabledException>()));
    });
  });

  group('getPositionStream', () {
    test('asks for high accuracy, a 10 m distance filter, and emits the positions it is sent', () async {
      Object? listenArgs;
      late MockStreamHandlerEventSink sink;
      messenger.setMockStreamHandler(
        _updates,
        MockStreamHandler.inline(onListen: (args, events) {
          listenArgs = args;
          sink = events;
        }),
      );

      final received = <Position>[];
      final sub = LocationService.getPositionStream().listen(received.add);
      await Future<void>.delayed(Duration.zero);
      expect((listenArgs! as Map)['accuracy'], LocationAccuracy.high.index);
      expect((listenArgs! as Map)['distanceFilter'], 10);

      sink.success(_position(21.0, 105.8));
      sink.success(_position(21.1, 105.9));
      await Future<void>.delayed(Duration.zero);
      expect(received.map((p) => [p.latitude, p.longitude]), [
        [21.0, 105.8],
        [21.1, 105.9],
      ]);
      await sub.cancel();
    });

    test('a platform failure (GPS switched off while watching) arrives as a typed error', () async {
      late MockStreamHandlerEventSink sink;
      messenger.setMockStreamHandler(_updates, MockStreamHandler.inline(onListen: (_, events) => sink = events));

      final errors = <Object>[];
      final sub = LocationService.getPositionStream().listen((_) {}, onError: errors.add);
      await Future<void>.delayed(Duration.zero);
      sink.error(code: 'LOCATION_SERVICES_DISABLED', message: 'off');
      await Future<void>.delayed(Duration.zero);
      expect(errors.single, isA<LocationServiceDisabledException>());
      await sub.cancel();
    });

    test('the interval becomes the time limit: no update within it ends with a TimeoutException', () async {
      messenger.setMockStreamHandler(_updates, MockStreamHandler.inline(onListen: (_, __) {}));
      final errors = <Object>[];
      final sub = LocationService.getPositionStream(intervalSeconds: 1).listen((_) {}, onError: errors.add);
      await Future<void>.delayed(const Duration(milliseconds: 500));
      expect(errors, isEmpty);
      await Future<void>.delayed(const Duration(milliseconds: 900));
      expect(errors.single, isA<TimeoutException>());
      await sub.cancel();
    });
  });
}
