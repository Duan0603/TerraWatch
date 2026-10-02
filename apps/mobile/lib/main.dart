import 'package:flutter/material.dart';

void main() {
  runApp(const GeoSentryApp());
}

class GeoSentryApp extends StatelessWidget {
  const GeoSentryApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'GeoSentry Mobile',
      theme: ThemeData.dark().copyWith(
        primaryColor: const Color(0xFF0EA5E9),
        scaffoldBackgroundColor: const Color(0xFF0B0F19),
      ),
      home: const HomeScreen(),
    );
  }
}

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('GeoSentry Cảnh Báo Sạt Lở'),
        backgroundColor: const Color(0xFF111827),
        elevation: 0,
      ),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Status Card
            Card(
              color: const Color(0xFF1F2937),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              child: const Padding(
                padding: EdgeInsets.all(16.0),
                child: Column(
                  children: [
                    Icon(Icons.shield_outlined, color: Colors.green, size: 48),
                    SizedBox(height: 8),
                    Text(
                      'Geofencing Ngoại Tuyến: Đang hoạt động',
                      style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                    ),
                    SizedBox(height: 4),
                    Text(
                      'Đã lưu 10,240 điểm nguy cơ sạt lở vào SQLite thiết bị',
                      style: TextStyle(color: Colors.grey, fontSize: 12),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 20),
            // Actions
            ElevatedButton.icon(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF0EA5E9),
                padding: const EdgeInsets.symmetric(vertical: 14),
              ),
              onPressed: () {
                // Navigate to Crowdsourcing report
              },
              icon: const Icon(Icons.camera_alt),
              label: const Text('Báo Cáo Hiện Trường (Crowdsourcing)'),
            ),
          ],
        ),
      ),
    );
  }
}
