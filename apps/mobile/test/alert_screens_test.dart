import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:geosentry_mobile/features/alerts/data/alert_models.dart';
import 'package:geosentry_mobile/features/alerts/presentation/emergency_alert_screen.dart';

void main() {
  testWidgets('EmergencyAlertScreen renders alert information and dismiss button', (tester) async {
    final alert = AlertModel(
      broadcastId: 'test-1',
      title: '🚨 NGUY CƠ SẠT LỞ CỰC KỲ NGUY HIỂM',
      message: 'Người dân di chuyển ngay lập tức đến vùng an toàn',
      severity: 'extreme',
      areaName: 'Sa Pa',
      receivedAt: '2026-10-09T00:00:00Z',
    );

    await tester.pumpWidget(
      MaterialApp(
        home: EmergencyAlertScreen(alert: alert),
      ),
    );

    expect(find.text('🚨 NGUY CƠ SẠT LỞ CỰC KỲ NGUY HIỂM'), findsOneWidget);
    expect(find.text('Khu vực: Sa Pa'), findsOneWidget);
    expect(find.text('Tôi Đã Nắm Rõ & Tắt Báo Động'), findsOneWidget);
    expect(find.byIcon(Icons.warning_rounded), findsOneWidget);
  });
}
