import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:geosentry_mobile/core/storage/local_storage.dart';
import 'package:geosentry_mobile/core/storage/session.dart';
import 'package:geosentry_mobile/features/alerts/presentation/subscription_screen.dart';
import 'package:geosentry_mobile/features/profile/presentation/change_password_screen.dart';
import 'package:geosentry_mobile/features/profile/presentation/edit_profile_screen.dart';
import 'package:geosentry_mobile/features/profile/presentation/profile_screen.dart';
import 'package:geosentry_mobile/features/report/presentation/my_reports_screen.dart';

import 'support/harness.dart';

const _areas = [
  {'area_id': 1, 'name': 'Mù Cang Chải', 'province': 'Yên Bái'},
  {'area_id': 2, 'name': 'Sa Pa'},
];

http.Response _route(http.Request r, {Object? areas = _areas, Object? subs, int subsStatus = 200}) {
  final path = r.url.path;
  if (path == '/api/v1/monitoring-areas') return jsonResponse(200, areas!);
  if (path == '/api/v1/alerts/subscriptions' && r.method == 'GET') return jsonResponse(subsStatus, subs ?? []);
  if (path == '/api/v1/alerts/subscriptions' && r.method == 'POST') return http.Response('', 201);
  if (path.startsWith('/api/v1/alerts/subscriptions/') && r.method == 'DELETE') return http.Response('', 204);
  if (path.endsWith('/avatar') && r.method == 'GET') return jsonResponse(404, {'message': 'none'});
  if (path.endsWith('/community-reports/mine')) return jsonResponse(200, []);
  if (path.endsWith('/alerts/broadcasts')) return jsonResponse(200, []);
  return jsonResponse(404, {'message': 'nope'});
}

Map<String, Object> _sub(String id, String name, [List<String> ch = const ['PUSH', 'SMS']]) =>
    {'subscriptionId': id, 'areaId': 1, 'areaName': name, 'alertChannels': ch, 'subscribedAt': '2026-10-24T00:00:00Z'};

// 1x1 transparent PNG
final _png = base64Encode(base64Decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='));

void main() {
  useIsolatedSqlite();
  late FakeBackend server;

  setUp(() async {
    server = FakeBackend()..handler = _route;
    await signIn();
  });

  Future<void> tapVisible(WidgetTester tester, Finder f) async {
    await tester.ensureVisible(f);
    await tester.tap(f);
    await tester.pump();
  }

  Future<void> clearAlerts(WidgetTester tester) => tester.runAsync(LocalStorage.clearAlertHistory);

  /// Screen opened from a host route so Navigator.pop returns a value we can read.
  Future<void> pumpSubscriptionOver(WidgetTester tester, void Function(Object?) onResult) async {
    await tester.pumpWidget(MaterialApp(
      home: Builder(
        builder: (context) => TextButton(
          onPressed: () async => onResult(await Navigator.push(context, MaterialPageRoute(builder: (_) => const SubscriptionScreen()))),
          child: const Text('open'),
        ),
      ),
    ));
    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();
  }

  group('SubscriptionScreen', () {
    testScreen('shows a spinner while areas load, then the area list with province', () => server, (tester) async {
      server.gate = Completer<void>();
      await tester.pumpWidget(const MaterialApp(home: SubscriptionScreen()));
      await tester.pump();
      expect(find.byType(CircularProgressIndicator), findsOneWidget);
      server.gate!.complete();
      await tester.pumpAndSettle();
      expect(find.byType(CircularProgressIndicator), findsNothing);
      expect(find.text('Đăng Ký Vùng Cảnh Báo'), findsOneWidget);
      expect(find.text('Mù Cang Chải (Yên Bái)'), findsOneWidget); // first area preselected
      expect(find.text('Số Điện Thoại Nhận Cảnh Báo'), findsOneWidget);
      expect(find.text('Lưu Đăng Ký Cảnh Báo'), findsOneWidget);
      expect(find.textContaining('KHÔNG theo dõi hay gửi vị trí GPS'), findsOneWidget);
    });

    testScreen('phone is prefilled from the profile', () => server, (tester) async {
      await signIn(citizen({'phoneNumber': '0912345678'}));
      await tester.pumpWidget(const MaterialApp(home: SubscriptionScreen()));
      await tester.pumpAndSettle();
      expect(find.text('0912345678'), findsOneWidget);
    });

    testScreen('empty phone with SMS on is required; invalid phone rejected; empty phone ok when SMS off', () => server, (tester) async {
      await tester.pumpWidget(const MaterialApp(home: SubscriptionScreen()));
      await tester.pumpAndSettle();
      await tapVisible(tester, find.text('Lưu Đăng Ký Cảnh Báo'));
      expect(find.text('Cần số điện thoại để nhận SMS'), findsOneWidget);
      await tester.enterText(find.byType(TextFormField), '123');
      await tapVisible(tester, find.text('Lưu Đăng Ký Cảnh Báo'));
      expect(find.text('Số điện thoại không hợp lệ'), findsOneWidget);
      expect(server.where('POST', '/api/v1/alerts/subscriptions'), isEmpty);

      await tester.enterText(find.byType(TextFormField), '');
      await tester.tap(find.widgetWithText(SwitchListTile, 'Tin nhắn SMS Khẩn cấp'));
      await tester.pump();
      await tapVisible(tester, find.text('Lưu Đăng Ký Cảnh Báo'));
      await tester.pumpAndSettle();
      expect(find.text('Cần số điện thoại để nhận SMS'), findsNothing);
      expect(server.where('POST', '/api/v1/alerts/subscriptions').length, 1);
    });

    testScreen('both channels off is refused with a message and nothing is sent', () => server, (tester) async {
      await tester.pumpWidget(const MaterialApp(home: SubscriptionScreen()));
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextFormField), '0912345678');
      await tester.tap(find.widgetWithText(SwitchListTile, 'Tin nhắn SMS Khẩn cấp'));
      await tester.tap(find.widgetWithText(SwitchListTile, 'Thông báo đẩy ứng dụng (FCM Push)'));
      await tester.pump();
      await tapVisible(tester, find.text('Lưu Đăng Ký Cảnh Báo'));
      expect(find.text('Vui lòng chọn ít nhất một kênh nhận tin (Push hoặc SMS)'), findsOneWidget);
      expect(server.where('POST', '/api/v1/alerts/subscriptions'), isEmpty);
    });

    testScreen('success posts phone, area and channels, then closes with the area name', () => server, (tester) async {
      Object? result;
      await pumpSubscriptionOver(tester, (v) => result = v);
      await tester.enterText(find.byType(TextFormField), ' 0912345678 ');
      await tapVisible(tester, find.text('Lưu Đăng Ký Cảnh Báo'));
      await tester.pumpAndSettle();
      final body = jsonDecode(server.where('POST', '/api/v1/alerts/subscriptions').single.body) as Map<String, dynamic>;
      expect(body, {'phoneNumber': '0912345678', 'areaId': '1', 'alertChannels': ['PUSH', 'SMS']});
      expect(result, 'Mù Cang Chải');
      expect(find.byType(SubscriptionScreen), findsNothing);
    });

    testScreen('selecting another area sends that area', () => server, (tester) async {
      await tester.pumpWidget(const MaterialApp(home: SubscriptionScreen()));
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextFormField), '0912345678');
      await tester.tap(find.byType(DropdownButtonFormField<String>));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Sa Pa').last);
      await tester.pumpAndSettle();
      await tapVisible(tester, find.text('Lưu Đăng Ký Cảnh Báo'));
      await tester.pumpAndSettle();
      expect(jsonDecode(server.where('POST', '/api/v1/alerts/subscriptions').single.body)['areaId'], '2');
    });

    testScreen('server rejects the subscription: error snackbar, screen stays, button usable again', () => server, (tester) async {
      server.handler = (r) => r.method == 'POST' ? jsonResponse(500, {'message': 'boom'}) : _route(r);
      await tester.pumpWidget(const MaterialApp(home: SubscriptionScreen()));
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextFormField), '0912345678');
      await tapVisible(tester, find.text('Lưu Đăng Ký Cảnh Báo'));
      await tester.pumpAndSettle();
      expect(find.text('boom'), findsOneWidget);
      expect(find.text('Đăng ký nhận cảnh báo thành công!'), findsNothing);
      expect(find.byType(SubscriptionScreen), findsOneWidget);
      expect(tester.widget<ElevatedButton>(find.byType(ElevatedButton)).onPressed, isNotNull);
    });

    testScreen('offline on save shows the connection error, never success', () => server, (tester) async {
      await tester.pumpWidget(const MaterialApp(home: SubscriptionScreen()));
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextFormField), '0912345678');
      server.online = false;
      await tapVisible(tester, find.text('Lưu Đăng Ký Cảnh Báo'));
      await tester.pumpAndSettle();
      expect(find.textContaining('Không kết nối được máy chủ'), findsOneWidget);
      expect(find.text('Đăng ký nhận cảnh báo thành công!'), findsNothing);
    });

    testScreen('while saving: spinner and exactly one POST on repeated taps', () => server, (tester) async {
      await tester.pumpWidget(const MaterialApp(home: SubscriptionScreen()));
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextFormField), '0912345678');
      server.gate = Completer<void>();
      await tapVisible(tester, find.byType(ElevatedButton));
      expect(tester.widget<ElevatedButton>(find.byType(ElevatedButton)).onPressed, isNull);
      await tester.tap(find.byType(ElevatedButton), warnIfMissed: false);
      await tester.pump();
      expect(server.where('POST', '/api/v1/alerts/subscriptions').length, 1);
      server.gate!.complete();
      await tester.pumpAndSettle();
    });

    testScreen('areas load fails (5xx): message shown instead of a list; no area means no save', () => server, (tester) async {
      server.handler = (_) => jsonResponse(503, {'message': 'down'});
      await tester.pumpWidget(const MaterialApp(home: SubscriptionScreen()));
      await tester.pumpAndSettle();
      expect(find.text('down'), findsOneWidget);
      expect(find.byType(CircularProgressIndicator), findsNothing);
      await tester.enterText(find.byType(TextFormField), '0912345678');
      await tapVisible(tester, find.text('Lưu Đăng Ký Cảnh Báo'));
      expect(find.text('Vui lòng chọn khu vực theo dõi'), findsOneWidget);
      expect(server.where('POST', '/api/v1/alerts/subscriptions'), isEmpty);
    });

    testScreen('areas load fails (offline): connection error is shown', () => server, (tester) async {
      server.online = false;
      await tester.pumpWidget(const MaterialApp(home: SubscriptionScreen()));
      await tester.pumpAndSettle();
      expect(find.textContaining('Không kết nối được máy chủ'), findsOneWidget);
    });

    testScreen('areas load returns 401: expiry message and the session is cleared', () => server, (tester) async {
      server.handler = (_) => jsonResponse(401, {'message': 'expired'});
      await tester.pumpWidget(const MaterialApp(home: SubscriptionScreen()));
      await tester.pumpAndSettle();
      expect(find.text('Hết phiên đăng nhập. Vui lòng đăng nhập lại.'), findsOneWidget);
      expect(Session.token, isNull);
    });

    testScreen('BUG: area load failure has a retry action', () => server, (tester) async {
      // BUG: expected a "Thử lại" button after the area list fails to load; actual: only the error text,
      // the user must leave and reopen the screen (subscription_screen.dart:~190, _areasError branch).
      server.handler = (_) => jsonResponse(503, {'message': 'down'});
      await tester.pumpWidget(const MaterialApp(home: SubscriptionScreen()));
      await tester.pumpAndSettle();
      expect(find.text('Thử lại'), findsOneWidget);
    }, skip: true);

    testScreen('BUG: empty area list is not left as a silent empty dropdown', () => server, (tester) async {
      // BUG: expected an explicit "no area available" message; actual: an empty dropdown with no explanation
      // (subscription_screen.dart:~195, _areas.isEmpty not handled).
      server.handler = (r) => r.url.path == '/api/v1/monitoring-areas' ? jsonResponse(200, []) : _route(r);
      await tester.pumpWidget(const MaterialApp(home: SubscriptionScreen()));
      await tester.pumpAndSettle();
      expect(find.textContaining('Chưa có vùng'), findsOneWidget);
    }, skip: true);
  });

  group('ProfileScreen', () {
    Future<void> pumpProfile(WidgetTester tester) async {
      await tester.pumpWidget(const SizedBox()); // fresh State so initState runs again
      await tester.pumpWidget(const MaterialApp(home: ProfileScreen()));
      await settleReal(tester);
    }

    testScreen('renders account details with Vietnamese labels and "Chưa cập nhật" for missing data', () => server, (tester) async {
      await clearAlerts(tester);
      await pumpProfile(tester);
      expect(find.text('Hồ sơ'), findsOneWidget);
      expect(find.text('Nguyễn Văn An'), findsOneWidget);
      expect(find.text('an@example.com'), findsOneWidget);
      expect(find.text('VA'), findsOneWidget);
      expect(find.text('THÔNG TIN CÁ NHÂN'), findsOneWidget);
      expect(find.text('Chưa cập nhật'), findsNWidgets(5)); // dob, gender, phone, address, emergency contact
      expect(find.text('Đăng xuất'), findsOneWidget);
    });

    testScreen('renders full profile values', () => server, (tester) async {
      await signIn(citizen({
        'phoneNumber': '0912345678',
        'dateOfBirth': '1990-05-17',
        'gender': 'male',
        'province': 'Lào Cai',
        'commune': 'Bản Hồ',
        'emergencyContactName': 'Lan',
        'emergencyContactRelation': 'vợ',
        'emergencyContactPhone': '0987654321',
      }));
      await clearAlerts(tester);
      await pumpProfile(tester);
      expect(find.text('17/05/1990'), findsOneWidget);
      expect(find.text('Nam'), findsOneWidget);
      expect(find.text('0912345678'), findsOneWidget);
      expect(find.text('Bản Hồ, Lào Cai'), findsOneWidget);
      expect(find.text('Lan (vợ) · 0987654321'), findsOneWidget);
      expect(find.text('Chưa cập nhật'), findsNothing);
    });

    testScreen('shows loading note, then the empty-subscription note', () => server, (tester) async {
      await clearAlerts(tester);
      server.gate = Completer<void>();
      await tester.pumpWidget(const MaterialApp(home: ProfileScreen()));
      await tester.pump();
      expect(find.text('Đang tải...'), findsOneWidget);
      server.gate!.complete();
      await settleReal(tester);
      expect(find.text('Đang tải...'), findsNothing);
      expect(find.text('Chưa đăng ký vùng nào. Thêm vùng để nhận cảnh báo.'), findsOneWidget);
    });

    testScreen('lists subscriptions with channel labels', () => server, (tester) async {
      server.handler = (r) => _route(r, subs: [_sub('s-1', 'Mù Cang Chải'), _sub('s-2', 'Sa Pa', ['PUSH'])]);
      await clearAlerts(tester);
      await pumpProfile(tester);
      expect(find.text('Mù Cang Chải'), findsOneWidget);
      expect(find.text('Thông báo app · SMS'), findsOneWidget);
      expect(find.text('Thông báo app'), findsOneWidget);
    });

    testScreen('subscription load error (5xx) shows the error, not the "no area" text', () => server, (tester) async {
      server.handler = (_) => jsonResponse(500, {'message': 'boom'});
      await clearAlerts(tester);
      await pumpProfile(tester);
      expect(find.text('boom'), findsOneWidget);
      expect(find.text('Đang tải...'), findsNothing);
      expect(find.textContaining('Chưa đăng ký vùng nào'), findsNothing);
    });

    testScreen('offline: connection error is shown instead of an empty list; stored counts remain', () => server, (tester) async {
      server.online = false;
      await clearAlerts(tester);
      await tester.runAsync(() => LocalStorage.insertAlert({'broadcast_id': 'b1', 'title': 't', 'message': 'm', 'severity': 'high', 'area_name': 'a', 'received_at': '2026-10-30T10:00:00Z', 'status': 'active'}));
      await pumpProfile(tester);
      expect(find.textContaining('Không kết nối được máy chủ'), findsOneWidget);
      expect(find.textContaining('Chưa đăng ký vùng nào'), findsNothing);
      expect(find.text('1'), findsOneWidget); // Cảnh báo đã nhận comes from the device
    });

    testScreen('401 on subscriptions shows the expiry message and clears the session', () => server, (tester) async {
      server.handler = (_) => jsonResponse(401, {'message': 'expired'});
      await clearAlerts(tester);
      await pumpProfile(tester);
      expect(find.text('Hết phiên đăng nhập. Vui lòng đăng nhập lại.'), findsOneWidget);
      expect(Session.token, isNull);
    });

    testScreen('stats show counts of received alerts and 0 reports when none were sent', () => server, (tester) async {
      await clearAlerts(tester);
      await tester.runAsync(() async {
        for (final id in ['a', 'b']) {
          await LocalStorage.insertAlert({'broadcast_id': id, 'title': 't', 'message': 'm', 'severity': 'high', 'area_name': 'a', 'received_at': '2026-10-30T10:00:00Z', 'status': 'active'});
        }
      });
      await pumpProfile(tester);
      expect(find.text('Cảnh báo đã nhận'), findsOneWidget);
      expect(find.text('2'), findsOneWidget);
      expect(find.text('Báo cáo đã gửi'), findsOneWidget);
      expect(find.text('0'), findsOneWidget);
      await clearAlerts(tester);
    });

    testScreen('removing a subscription calls DELETE and reloads the list', () => server, (tester) async {
      var subs = [_sub('s-1', 'Mù Cang Chải')];
      server.handler = (r) {
        if (r.method == 'DELETE') {
          subs = [];
          return http.Response('', 204);
        }
        return _route(r, subs: subs);
      };
      await clearAlerts(tester);
      await pumpProfile(tester);
      await tester.ensureVisible(find.byTooltip('Bỏ đăng ký'));
      await tester.tap(find.byTooltip('Bỏ đăng ký'));
      await settleReal(tester);
      expect(server.where('DELETE', '/api/v1/alerts/subscriptions/s-1').length, 1);
      expect(find.text('Mù Cang Chải'), findsNothing);
      expect(find.textContaining('Chưa đăng ký vùng nào'), findsOneWidget);
    });

    testScreen('failed delete shows the error and keeps the subscription listed', () => server, (tester) async {
      server.handler = (r) => r.method == 'DELETE' ? jsonResponse(500, {'message': 'cannot delete'}) : _route(r, subs: [_sub('s-1', 'Sa Pa')]);
      await clearAlerts(tester);
      await pumpProfile(tester);
      await tester.ensureVisible(find.byTooltip('Bỏ đăng ký'));
      await tester.tap(find.byTooltip('Bỏ đăng ký'));
      await settleReal(tester);
      expect(find.text('cannot delete'), findsOneWidget);
      expect(find.text('Sa Pa'), findsOneWidget);
    });

    testScreen('email account sees the change-password row; Google account does not', () => server, (tester) async {
      await clearAlerts(tester);
      await pumpProfile(tester);
      expect(find.text('Đổi mật khẩu'), findsOneWidget);
      await signIn(citizen({'authProvider': 'google'}));
      await pumpProfile(tester);
      expect(find.text('Đổi mật khẩu'), findsNothing);
    });

    testScreen('navigation: edit profile, change password, add area, my reports', () => server, (tester) async {
      await clearAlerts(tester);
      await pumpProfile(tester);
      Future<void> open(String label, Type screen) async {
        await tester.ensureVisible(find.text(label));
        await tester.tap(find.text(label));
        await settleReal(tester, rounds: 4);
        await tester.pump(const Duration(seconds: 1));
        expect(find.byType(screen), findsOneWidget, reason: label);
        await tester.pageBack();
        await settleReal(tester);
        await tester.pump(const Duration(seconds: 1));
      }

      await open('Chỉnh sửa hồ sơ', EditProfileScreen);
      await open('Đổi mật khẩu', ChangePasswordScreen);
      await open('Thêm vùng', SubscriptionScreen);
      await open('Báo cáo của tôi', MyReportsScreen);
    });

    testScreen('logout clears the session', () => server, (tester) async {
      await clearAlerts(tester);
      await pumpProfile(tester);
      await tester.ensureVisible(find.text('Đăng xuất'));
      await tester.tap(find.text('Đăng xuất'));
      await settleReal(tester, rounds: 5);
      expect(Session.token, isNull);
      expect(Session.user.value, isNull);
      expect(find.text('Nguyễn Văn An'), findsNothing); // header follows Session.user
    });

    testScreen('avatar sheet: delete option only when an avatar exists; delete calls the API', () => server, (tester) async {
      await clearAlerts(tester);
      await pumpProfile(tester);
      await tester.tap(find.byIcon(Icons.photo_camera));
      await tester.pumpAndSettle();
      expect(find.text('Chụp ảnh'), findsOneWidget);
      expect(find.text('Chọn từ thư viện'), findsOneWidget);
      expect(find.text('Xóa ảnh đại diện'), findsNothing);
      await tester.tapAt(const Offset(5, 5)); // dismiss
      await tester.pumpAndSettle();

      await signIn(citizen({'hasAvatar': true}));
      Session.avatar.value = null;
      server.handler = (r) {
        if (r.url.path.endsWith('/avatar') && r.method == 'GET') return jsonResponse(200, {'imageBase64': _png});
        if (r.url.path.endsWith('/avatar') && r.method == 'DELETE') return http.Response('', 204);
        return _route(r);
      };
      await pumpProfile(tester);
      expect(Session.avatar.value, isNotNull); // fetched because the profile says there is one
      await tester.tap(find.byIcon(Icons.photo_camera));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Xóa ảnh đại diện'));
      await settleReal(tester);
      expect(server.where('DELETE', '/api/v1/auth/me/avatar').length, 1);
      expect(Session.avatar.value, isNull);
      expect(Session.user.value?.hasAvatar, isFalse);
    });

    testScreen('avatar fetch failure falls back to initials without an error', () => server, (tester) async {
      await signIn(citizen({'hasAvatar': true}));
      Session.avatar.value = null;
      server.handler = (r) => r.url.path.endsWith('/avatar') ? jsonResponse(500, {'message': 'x'}) : _route(r);
      await clearAlerts(tester);
      await pumpProfile(tester);
      expect(find.text('VA'), findsOneWidget);
    });

    testScreen('BUG: malformed subscription entry must not leave "Đang tải..." forever', () => server, (tester) async {
      // BUG: expected an error message when the server returns a subscription without subscriptionId;
      // actual: TypeError is not an ApiException, escapes _loadSubscriptions (profile_screen.dart:~95) and the
      // section stays at "Đang tải..." with an unhandled exception.
      server.handler = (r) => _route(r, subs: [{'areaId': 1}]);
      await clearAlerts(tester);
      await pumpProfile(tester);
      expect(find.text('Đang tải...'), findsNothing);
    }, skip: true);

    testScreen('BUG: subscription load failure has a retry action', () => server, (tester) async {
      // BUG: expected "Thử lại" next to the subscription error; actual: error text only, user must leave and reopen the tab.
      server.handler = (_) => jsonResponse(500, {'message': 'boom'});
      await clearAlerts(tester);
      await pumpProfile(tester);
      expect(find.text('Thử lại'), findsOneWidget);
    }, skip: true);
  });
}
