import 'dart:async';

import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:geolocator/geolocator.dart';
import 'package:geosentry_mobile/services/location_service.dart';

// Target: lib/services/location_service.dart, the part location_service_test.dart does not assert: what the service
// does with the PAYLOAD the platform plugin hands back (MD-GEO-020, 021, 022) and with an OS refusal that arrives AFTER
// the permission check passed (MD-GEO-026). Permission branches, the 10 m filter and the time limit are already in
// location_service_test.
// Not applicable (recorded in the PR): MD-GEO-023 / 024 / 025. LocationService never talks to a server and GPS needs
// no network, so there is no 4xx / 5xx / offline branch in this file.

const _method = MethodChannel('flutter.baseflow.com/geolocator');
const _updates = EventChannel('flutter.baseflow.com/geolocator_updates');

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  final messenger = TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger;

  void answerCurrentPosition(Object? Function() answer) {
    messenger.setMockMethodCallHandler(_method, (call) async {
      switch (call.method) {
        case 'isLocationServiceEnabled':
          return true;
        case 'checkPermission':
          return 2; // while in use
        case 'getCurrentPosition':
          return answer();
      }
      return null;
    });
  }

  tearDown(() {
    messenger.setMockMethodCallHandler(_method, null);
    messenger.setMockStreamHandler(_updates, null);
  });

  group('getCurrentLocation: what the plugin returns', () {
    test('MD-GEO-020: every field of a full fix reaches the Position model', () async {
      final at = DateTime.utc(2026, 10, 30, 8, 15, 30);
      answerCurrentPosition(() => {
            'latitude': 22.3364,
            'longitude': 103.8438,
            'timestamp': at.millisecondsSinceEpoch,
            'accuracy': 4.5,
            'altitude': 1523.0,
            'heading': 270.0,
            'speed': 1.25,
            'speed_accuracy': 0.5,
            'is_mocked': true,
          });
      final p = (await LocationService.getCurrentLocation())!;
      expect((p.latitude, p.longitude), (22.3364, 103.8438));
      expect(p.timestamp, at);
      expect(p.timestamp.isUtc, isTrue);
      expect((p.accuracy, p.altitude, p.heading, p.speed, p.speedAccuracy), (4.5, 1523.0, 270.0, 1.25, 0.5));
      expect(p.isMocked, isTrue);
    });

    test('MD-GEO-021: only latitude and longitude given: other measures default to 0 and the time to "now", no throw', () async {
      final before = DateTime.now();
      answerCurrentPosition(() => {'latitude': 21.0, 'longitude': 105.8});
      final p = (await LocationService.getCurrentLocation())!;
      expect((p.latitude, p.longitude), (21.0, 105.8));
      expect((p.accuracy, p.altitude, p.heading, p.speed, p.speedAccuracy), (0.0, 0.0, 0.0, 0.0, 0.0));
      expect(p.isMocked, isFalse);
      expect(p.timestamp.isBefore(before), isFalse, reason: 'a missing timestamp must not become 1970');
    });

    test('MD-GEO-022: an answer without latitude or longitude is an error, never a (0, 0) position', () async {
      for (final broken in [
        {'longitude': 105.8},
        {'latitude': 21.0},
        <String, Object>{},
      ]) {
        answerCurrentPosition(() => broken);
        await expectLater(LocationService.getCurrentLocation(), throwsA(isA<ArgumentError>()), reason: '$broken');
      }
    });

    test('MD-GEO-026: the OS revokes the permission between the check and the read: the typed exception reaches the caller', () async {
      answerCurrentPosition(() => throw PlatformException(code: 'PERMISSION_DENIED', message: 'revoked'));
      await expectLater(LocationService.getCurrentLocation(), throwsA(isA<PermissionDeniedException>()));
    });
  });

  group('getPositionStream: what the plugin sends', () {
    test('MD-GEO-022: one malformed event becomes an error and the stream keeps delivering later good fixes', () async {
      late MockStreamHandlerEventSink sink;
      messenger.setMockStreamHandler(_updates, MockStreamHandler.inline(onListen: (_, events) => sink = events));

      final fixes = <double>[];
      final errors = <Object>[];
      final seen = Completer<void>();
      final sub = LocationService.getPositionStream().listen(
        (p) {
          fixes.add(p.latitude);
          if (fixes.length == 2) seen.complete();
        },
        onError: errors.add,
      );
      await Future<void>.delayed(Duration.zero);
      sink.success({'latitude': 21.0, 'longitude': 105.0});
      sink.success({'longitude': 105.0}); // no latitude
      sink.success({'latitude': 21.5, 'longitude': 105.5});
      await seen.future.timeout(const Duration(seconds: 5));
      expect(fixes, [21.0, 21.5]);
      expect(errors.single, isA<ArgumentError>());
      await sub.cancel();
    });

    test('MD-GEO-026: the OS denies the permission while watching: typed PermissionDeniedException on the stream', () async {
      late MockStreamHandlerEventSink sink;
      messenger.setMockStreamHandler(_updates, MockStreamHandler.inline(onListen: (_, events) => sink = events));
      final errors = <Object>[];
      final seen = Completer<void>();
      final sub = LocationService.getPositionStream().listen((_) {}, onError: (Object e) {
        errors.add(e);
        seen.complete();
      });
      await Future<void>.delayed(Duration.zero);
      sink.error(code: 'PERMISSION_DENIED', message: 'revoked');
      await seen.future.timeout(const Duration(seconds: 5));
      expect(errors.single, isA<PermissionDeniedException>());
      await sub.cancel();
    });
  });
}
