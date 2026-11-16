import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:geosentry_mobile/features/alerts/data/alert_models.dart';
import 'package:geosentry_mobile/features/alerts/presentation/emergency_alert_screen.dart';

AlertModel _alert({String severity = 'extreme', String message = 'Rời khỏi sườn đồi ngay'}) => AlertModel(
      broadcastId: 'b-1',
      title: 'Sạt lở khẩn cấp',
      message: message,
      severity: severity,
      areaName: 'Mù Cang Chải',
      receivedAt: '2026-10-30T10:00:00Z',
    );

void main() {
  // The icon pulses forever, so pumpAndSettle would never return: use bounded pumps.
  Future<void> openOver(WidgetTester tester, AlertModel alert) async {
    await tester.pumpWidget(MaterialApp(
      key: UniqueKey(),
      home: Builder(
        builder: (context) => Scaffold(
          body: TextButton(
            onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => EmergencyAlertScreen(alert: alert))),
            child: const Text('open'),
          ),
        ),
      ),
    ));
    await tester.tap(find.text('open'));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));
  }

  testWidgets('shows the alert message and the evacuation instructions', (tester) async {
    await openOver(tester, _alert());
    expect(find.text('Rời khỏi sườn đồi ngay'), findsOneWidget);
    expect(find.textContaining('HƯỚNG DẪN SƠ TÁN KHẨN CẤP'), findsOneWidget);
    expect(find.textContaining('Mang theo giấy tờ quan trọng và đèn pin'), findsOneWidget);
  });

  testWidgets('severity badge: extreme (any case) vs high; unknown severity is not shown as extreme', (tester) async {
    await openOver(tester, _alert(severity: 'EXTREME'));
    expect(find.text('CẤP ĐỘ NGUY HIỂM: CỰC KỲ NGUY CẤP (EXTREME)'), findsOneWidget);

    await openOver(tester, _alert(severity: 'high'));
    expect(find.text('CẤP ĐỘ NGUY HIỂM: CAO (HIGH)'), findsOneWidget);
    expect(find.textContaining('CỰC KỲ'), findsNothing);

    await openOver(tester, _alert(severity: 'unknown'));
    expect(find.textContaining('CỰC KỲ'), findsNothing);
  });

  testWidgets('system back does not dismiss the alarm; only the acknowledge button closes it', (tester) async {
    await openOver(tester, _alert());
    expect(find.byType(EmergencyAlertScreen), findsOneWidget);

    await tester.binding.handlePopRoute(); // Android back button
    await tester.pump(const Duration(seconds: 1));
    expect(find.byType(EmergencyAlertScreen), findsOneWidget);

    await tester.tap(find.text('Tôi Đã Nắm Rõ & Tắt Báo Động'));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));
    expect(find.byType(EmergencyAlertScreen), findsNothing);
    expect(find.text('open'), findsOneWidget);
  });
}
