import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:geosentry_mobile/core/network/api_client.dart';
import 'package:geosentry_mobile/features/map/data/hazard_repository.dart';
import 'package:geosentry_mobile/features/map/presentation/map_screen.dart';

import 'support/harness.dart';

// home_map_shell_test.dart already covers MapScreen loading / error / retry / legend / satellite toggle.
// This file only covers the "my location" button, which talks to the geolocator plugin channel.

const _channel = MethodChannel('flutter.baseflow.com/geolocator');
// geolocator permission codes: 0 denied, 1 deniedForever, 2 whileInUse, 3 always
const _denied = 0, _deniedForever = 1, _whileInUse = 2;

void main() {
  late FakeBackend server;
  late List<String> calls;

  setUp(() {
    server = FakeBackend()..handler = (_) => jsonResponse(200, {'features': []});
    calls = [];
  });

  tearDown(() => TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger.setMockMethodCallHandler(_channel, null));

  void mockGeolocator({required int check, int? request, Object? position}) {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger.setMockMethodCallHandler(_channel, (call) async {
      calls.add(call.method);
      switch (call.method) {
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

  // The map plugin shows a plain text fallback on non-mobile platforms and throws a LateInitializationError
  // (from its `_channel`) on dispose; that plugin limitation is tolerated, anything else fails the test.
  void mapTest(String name, Future<void> Function(WidgetTester tester) body) {
    testWidgets(name, (tester) async {
      debugDefaultTargetPlatformOverride = TargetPlatform.linux;
      try {
        await body(tester);
        await tester.pumpWidget(const SizedBox());
        final dispose = tester.takeException();
        expect(dispose == null || dispose is Error && dispose.toString().contains('_channel'), isTrue, reason: '$dispose');
      } finally {
        debugDefaultTargetPlatformOverride = null;
      }
    });
  }

  Future<void> pumpMap(WidgetTester tester) async {
    final repo = HazardRepository(apiClient: ApiClient(client: server.client, baseUrl: 'http://test'));
    await tester.pumpWidget(MaterialApp(home: MapScreen(repository: repo)));
    await tester.pumpAndSettle();
  }

  // direct callback: the plugin fallback view swallows pointer hits in the headless test
  Future<void> pressMyLocation(WidgetTester tester) async {
    tester.widget<FloatingActionButton>(find.byType(FloatingActionButton)).onPressed!();
    await tester.pump();
    await tester.pump();
  }

  Future<void> dismissSnack(WidgetTester tester) async {
    await tester.pump(const Duration(seconds: 1));
    await tester.pump(const Duration(seconds: 10));
    await tester.pumpAndSettle();
  }

  mapTest('permission denied, then refused again: asks once and explains why the location is not shown', (tester) async {
    mockGeolocator(check: _denied, request: _denied);
    await pumpMap(tester);
    await pressMyLocation(tester);
    expect(calls, ['checkPermission', 'requestPermission']);
    expect(find.text('Cần cấp quyền vị trí để xem vị trí của bạn'), findsOneWidget);
    await dismissSnack(tester);
  });

  mapTest('permission denied forever: no new prompt, message shown, GPS never read', (tester) async {
    mockGeolocator(check: _deniedForever);
    await pumpMap(tester);
    await pressMyLocation(tester);
    expect(calls, ['checkPermission']);
    expect(find.text('Cần cấp quyền vị trí để xem vị trí của bạn'), findsOneWidget);
    await dismissSnack(tester);
  });

  mapTest('denied then granted on the prompt: reads the position without any error message', (tester) async {
    mockGeolocator(check: _denied, request: _whileInUse, position: {
      'latitude': 22.3, 'longitude': 103.8, 'timestamp': DateTime.now().millisecondsSinceEpoch,
      'accuracy': 5.0, 'altitude': 0.0, 'heading': 0.0, 'speed': 0.0, 'speed_accuracy': 0.0,
    });
    await pumpMap(tester);
    await pressMyLocation(tester);
    expect(calls, ['checkPermission', 'requestPermission', 'getCurrentPosition']);
    expect(find.textContaining('Cần cấp quyền vị trí'), findsNothing);
    expect(find.text('Không lấy được vị trí hiện tại'), findsNothing);
  });

  mapTest('permission granted but GPS off: shows "cannot get current location" and the map stays usable', (tester) async {
    mockGeolocator(check: _whileInUse);
    await pumpMap(tester);
    await pressMyLocation(tester);
    expect(calls, ['checkPermission', 'getCurrentPosition']);
    expect(find.text('Không lấy được vị trí hiện tại'), findsOneWidget);
    expect(find.text('0 vùng nguy cơ đã xác minh'), findsOneWidget);
    await dismissSnack(tester);
  });
}
