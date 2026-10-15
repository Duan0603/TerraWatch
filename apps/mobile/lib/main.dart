import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
    statusBarColor: Colors.transparent,
    statusBarIconBrightness: Brightness.dark,
  ));
  runApp(const TerraWatchApp());
}

// ── Design Tokens ──────────────────────────────────────────────────────────

class TW {
  static const primary = Color(0xFF087B70);
  static const primaryDark = Color(0xFF075F57);
  static const primaryLight = Color(0xFFE4F4F1);
  static const bg = Color(0xFFF5F8F7);
  static const surface = Colors.white;
  static const border = Color(0xFFDCE5E2);
  static const text1 = Color(0xFF172524);
  static const text2 = Color(0xFF687977);
  static const text3 = Color(0xFF9BB0AD);

  static const extreme = Color(0xFFEF4444);
  static const extremeBg = Color(0xFFFFF0F0);
  static const high = Color(0xFFF97316);
  static const highBg = Color(0xFFFFF4ED);
  static const medium = Color(0xFFEAB308);
  static const mediumBg = Color(0xFFFEFCE8);
  static const low = Color(0xFF22C55E);
  static const lowBg = Color(0xFFF0FDF4);
}

// ── App ────────────────────────────────────────────────────────────────────

class TerraWatchApp extends StatelessWidget {
  const TerraWatchApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'TerraWatch',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        textTheme: GoogleFonts.interTextTheme(),
        colorScheme: ColorScheme.fromSeed(
          seedColor: TW.primary,
          background: TW.bg,
          surface: TW.surface,
        ),
        scaffoldBackgroundColor: TW.bg,
        appBarTheme: const AppBarTheme(
          backgroundColor: TW.surface,
          foregroundColor: TW.text1,
          elevation: 0,
          centerTitle: false,
          titleTextStyle: TextStyle(
            fontFamily: 'Inter',
            fontSize: 17,
            fontWeight: FontWeight.w700,
            color: TW.text1,
          ),
          systemOverlayStyle: SystemUiOverlayStyle(
            statusBarColor: Colors.transparent,
            statusBarIconBrightness: Brightness.dark,
          ),
        ),
        elevatedButtonTheme: ElevatedButtonThemeData(
          style: ElevatedButton.styleFrom(
            backgroundColor: TW.primary,
            foregroundColor: Colors.white,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            textStyle: const TextStyle(fontFamily: 'Inter', fontWeight: FontWeight.w600),
          ),
        ),
        useMaterial3: true,
      ),
      home: const MainShell(),
    );
  }
}

// ── Main Shell with Bottom Nav ─────────────────────────────────────────────

class MainShell extends StatefulWidget {
  const MainShell({super.key});

  @override
  State<MainShell> createState() => _MainShellState();
}

class _MainShellState extends State<MainShell> {
  int _currentIndex = 0;

  final _pages = const [
    HomeScreen(),
    MapScreen(),
    AlertsScreen(),
    ProfileScreen(),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: _pages[_currentIndex],
      bottomNavigationBar: Container(
        decoration: const BoxDecoration(
          border: Border(top: BorderSide(color: TW.border)),
          color: TW.surface,
        ),
        child: BottomNavigationBar(
          currentIndex: _currentIndex,
          onTap: (i) => setState(() => _currentIndex = i),
          backgroundColor: TW.surface,
          selectedItemColor: TW.primary,
          unselectedItemColor: TW.text3,
          selectedLabelStyle: const TextStyle(fontFamily: 'Inter', fontSize: 10, fontWeight: FontWeight.w600),
          unselectedLabelStyle: const TextStyle(fontFamily: 'Inter', fontSize: 10),
          type: BottomNavigationBarType.fixed,
          elevation: 0,
          items: const [
            BottomNavigationBarItem(icon: Icon(Icons.home_outlined), activeIcon: Icon(Icons.home), label: 'Trang chủ'),
            BottomNavigationBarItem(icon: Icon(Icons.map_outlined), activeIcon: Icon(Icons.map), label: 'Bản đồ'),
            BottomNavigationBarItem(icon: Icon(Icons.notifications_outlined), activeIcon: Icon(Icons.notifications), label: 'Cảnh báo'),
            BottomNavigationBarItem(icon: Icon(Icons.person_outline), activeIcon: Icon(Icons.person), label: 'Hồ sơ'),
          ],
        ),
      ),
    );
  }
}

// ── Home Screen (M01 / M03) ────────────────────────────────────────────────

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  static const bool _hasAlert = true; // toggle to test both states

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: TW.bg,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SizedBox(height: 16),
              // Top bar
              Row(
                children: [
                  Container(
                    width: 36, height: 36,
                    decoration: BoxDecoration(color: TW.primary, borderRadius: BorderRadius.circular(10)),
                    child: const Icon(Icons.shield_outlined, color: Colors.white, size: 20),
                  ),
                  const SizedBox(width: 10),
                  const Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('TerraWatch', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: TW.text1)),
                        Text('GeoSentry Platform', style: TextStyle(fontSize: 10, color: TW.text2)),
                      ],
                    ),
                  ),
                  _AvatarBadge(initials: 'HM'),
                ],
              ),
              const SizedBox(height: 16),

              // Location chip
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: TW.surface,
                  border: Border.all(color: TW.border),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: const Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.location_on_outlined, size: 14, color: TW.primary),
                    SizedBox(width: 4),
                    Text('Bản Vược, Bát Xát', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: TW.text1)),
                    SizedBox(width: 4),
                    Icon(Icons.keyboard_arrow_down, size: 14, color: TW.text2),
                  ],
                ),
              ),
              const SizedBox(height: 16),

              // Map preview
              ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: Container(
                  height: 160,
                  color: const Color(0xFFD1E8E4),
                  child: Stack(
                    children: [
                      Center(
                        child: Icon(Icons.map, size: 64, color: TW.primary.withOpacity(0.15)),
                      ),
                      if (_hasAlert)
                        Positioned(
                          top: 16, left: 16,
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                            decoration: BoxDecoration(
                              color: TW.extreme,
                              borderRadius: BorderRadius.circular(20),
                            ),
                            child: const Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(Icons.warning_amber_rounded, size: 12, color: Colors.white),
                                SizedBox(width: 4),
                                Text('CỰC CAO · 92/100', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Colors.white)),
                              ],
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 12),

              // Status / alert card
              if (_hasAlert) ...[
                _AlertBanner(
                  onTap: () => Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => const AlertDetailScreen()),
                  ),
                ),
              ] else ...[
                _StatusCard(
                  color: TW.lowBg,
                  borderColor: const Color(0xFFBBF7D0),
                  icon: Icons.check_circle_outline,
                  iconColor: TW.low,
                  title: 'Khu vực của bạn: An toàn',
                  subtitle: 'Không có cảnh báo đang hoạt động tại Bản Vược',
                ),
              ],
              const SizedBox(height: 12),

              // Rainfall summary
              _SectionCard(
                title: 'Thời tiết & Dự báo',
                child: Row(
                  children: [
                    _MetricChip(label: 'Mưa hôm nay', value: '12 mm', color: TW.primary),
                    const SizedBox(width: 8),
                    _MetricChip(label: 'Dự báo 24h', value: '18 mm', color: TW.text2),
                    const SizedBox(width: 8),
                    _MetricChip(label: 'Mức độ', value: 'Thấp', color: TW.low),
                  ],
                ),
              ),
              const SizedBox(height: 12),

              // Shelter card
              _SectionCard(
                title: 'Điểm trú ẩn gần nhất',
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(color: TW.primaryLight, borderRadius: BorderRadius.circular(8)),
                      child: const Icon(Icons.school_outlined, color: TW.primary, size: 20),
                    ),
                    const SizedBox(width: 12),
                    const Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Trường THCS Bản Vược', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: TW.text1)),
                          Text('1.8 km · 24 phút đi bộ · 126 chỗ trống', style: TextStyle(fontSize: 11, color: TW.text2)),
                        ],
                      ),
                    ),
                    const Icon(Icons.chevron_right, color: TW.text3),
                  ],
                ),
              ),
              const SizedBox(height: 16),

              // Quick actions
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: () => Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => const FieldReportScreen()),
                  ),
                  icon: const Icon(Icons.camera_alt_outlined, size: 16),
                  label: const Text('Báo cáo hiện trường'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: TW.primary,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                  ),
                ),
              ),
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Map Screen (M02) ───────────────────────────────────────────────────────

class MapScreen extends StatelessWidget {
  const MapScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Bản đồ nguy cơ'),
        actions: [
          IconButton(icon: const Icon(Icons.layers_outlined), onPressed: () {}),
        ],
      ),
      body: Stack(
        children: [
          Container(color: const Color(0xFFCFE8E3)),
          Center(child: Icon(Icons.map, size: 80, color: TW.primary.withOpacity(0.12))),
          Positioned(
            top: 14, left: 14, right: 14,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: TW.surface,
                borderRadius: BorderRadius.circular(10),
                boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.08), blurRadius: 8)],
              ),
              child: const Row(
                children: [
                  Icon(Icons.location_on_outlined, size: 16, color: TW.primary),
                  SizedBox(width: 8),
                  Text('Huyện Bát Xát · 47 ô lưới theo dõi',
                    style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: TW.text1)),
                ],
              ),
            ),
          ),
          // Legend
          Positioned(
            bottom: 20, left: 14,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: TW.surface,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: TW.border),
              ),
              child: const Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  _LegendDot(color: TW.low, label: 'Thấp'),
                  SizedBox(width: 10),
                  _LegendDot(color: TW.medium, label: 'TB'),
                  SizedBox(width: 10),
                  _LegendDot(color: TW.high, label: 'Cao'),
                  SizedBox(width: 10),
                  _LegendDot(color: TW.extreme, label: 'Cực cao'),
                ],
              ),
            ),
          ),
          // My location button
          Positioned(
            bottom: 20, right: 14,
            child: FloatingActionButton.small(
              backgroundColor: TW.surface,
              foregroundColor: TW.primary,
              onPressed: () {},
              child: const Icon(Icons.my_location),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Alert Detail Screen (M04) ──────────────────────────────────────────────

class AlertDetailScreen extends StatelessWidget {
  const AlertDetailScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Chi tiết cảnh báo'),
        leading: BackButton(onPressed: () => Navigator.pop(context)),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(1),
          child: Container(color: TW.border, height: 1),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ID + badge
            Row(
              children: [
                const Text('#TW-250815-004', style: TextStyle(fontSize: 12, color: TW.text2)),
                const Spacer(),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(color: TW.extremeBg, borderRadius: BorderRadius.circular(6), border: Border.all(color: const Color(0xFFFECACA))),
                  child: const Text('CỰC KỲ NGUY HIỂM', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: TW.extreme, letterSpacing: 0.5)),
                ),
              ],
            ),
            const SizedBox(height: 12),
            const Text('Bản Vược, Bát Xát, Lào Cai', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: TW.text1)),
            const SizedBox(height: 4),
            const Text('Phát 08:35 · Hiệu lực đến 08:00 · 16/08/2025', style: TextStyle(fontSize: 12, color: TW.text2)),
            const SizedBox(height: 16),
            // Rainfall
            _DetailSection(
              title: 'Lượng mưa',
              child: Row(
                children: [
                  _MetricChip(label: '24h qua', value: '186 mm', color: TW.extreme),
                  const SizedBox(width: 8),
                  _MetricChip(label: '72h qua', value: '324 mm', color: TW.extreme),
                  const SizedBox(width: 8),
                  _MetricChip(label: 'Dự báo', value: '142 mm', color: TW.high),
                ],
              ),
            ),
            const SizedBox(height: 12),
            // Terrain
            _DetailSection(
              title: 'Địa hình',
              child: Row(
                children: [
                  _MetricChip(label: 'Độ dốc TB', value: '38.6°', color: TW.text1),
                  const SizedBox(width: 8),
                  _MetricChip(label: 'Độ cao', value: '1,246 m', color: TW.text1),
                ],
              ),
            ),
            const SizedBox(height: 12),
            // Action required
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: TW.extremeBg,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: const Color(0xFFFECACA)),
              ),
              child: const Row(
                children: [
                  Icon(Icons.warning_amber_rounded, color: TW.extreme, size: 18),
                  SizedBox(width: 10),
                  Expanded(child: Text('Sơ tán khỏi khu vực sườn dốc', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: TW.extreme))),
                ],
              ),
            ),
            const SizedBox(height: 12),
            // Shelter
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: TW.primaryLight,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: const Color(0xFFB2E0DA)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Row(children: [
                    Icon(Icons.school_outlined, color: TW.primary, size: 16),
                    SizedBox(width: 6),
                    Text('Điểm trú ẩn', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: TW.primary, letterSpacing: 0.5)),
                  ]),
                  const SizedBox(height: 6),
                  const Text('Trường THCS Bản Vược', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: TW.text1)),
                  const SizedBox(height: 2),
                  const Text('1.8 km · 24 phút đi bộ · 126 chỗ trống', style: TextStyle(fontSize: 12, color: TW.text2)),
                  const SizedBox(height: 10),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton.icon(
                      onPressed: () {},
                      icon: const Icon(Icons.directions, size: 15),
                      label: const Text('Chỉ đường đến đây'),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const FieldReportScreen())),
                icon: const Icon(Icons.camera_alt_outlined, size: 16),
                label: const Text('Báo cáo tình hình của tôi'),
              ),
            ),
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }
}

// ── Field Report Screen (M05 → M08) ───────────────────────────────────────

class FieldReportScreen extends StatefulWidget {
  const FieldReportScreen({super.key});

  @override
  State<FieldReportScreen> createState() => _FieldReportScreenState();
}

class _FieldReportScreenState extends State<FieldReportScreen> {
  String _severity = 'Nghiêm trọng';
  bool _submitted = false;

  static const _severities = ['Nhẹ', 'Trung bình', 'Nghiêm trọng', 'Khẩn cấp'];

  @override
  Widget build(BuildContext context) {
    if (_submitted) return _SuccessView(onBack: () => Navigator.pop(context));

    return Scaffold(
      appBar: AppBar(
        title: const Text('Báo cáo hiện trường'),
        leading: BackButton(onPressed: () => Navigator.pop(context)),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // GPS
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: TW.primaryLight,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: const Color(0xFFB2E0DA)),
              ),
              child: const Row(children: [
                Icon(Icons.gps_fixed, color: TW.primary, size: 15),
                SizedBox(width: 8),
                Expanded(child: Text('22.6123° N, 103.8456° E · ±5m', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: TW.primary))),
                Text('Làm mới', style: TextStyle(fontSize: 11, color: TW.primary)),
              ]),
            ),
            const SizedBox(height: 16),

            // Photo grid
            const Text('Ảnh đính kèm', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: TW.text2)),
            const SizedBox(height: 8),
            Row(
              children: List.generate(3, (i) => Expanded(
                child: Container(
                  height: 80,
                  margin: EdgeInsets.only(right: i < 2 ? 8 : 0),
                  decoration: BoxDecoration(
                    color: TW.surface,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: TW.border),
                  ),
                  child: const Icon(Icons.add_a_photo_outlined, color: TW.text3, size: 24),
                ),
              )),
            ),
            const SizedBox(height: 16),

            // Severity
            const Text('Mức độ nghiêm trọng', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: TW.text2)),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8, runSpacing: 8,
              children: _severities.map((s) {
                final active = s == _severity;
                return GestureDetector(
                  onTap: () => setState(() => _severity = s),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
                    decoration: BoxDecoration(
                      color: active ? TW.primary : TW.surface,
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: active ? TW.primary : TW.border),
                    ),
                    child: Text(s, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: active ? Colors.white : TW.text2)),
                  ),
                );
              }).toList(),
            ),
            const SizedBox(height: 16),

            // Description
            const Text('Mô tả tình trạng', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: TW.text2)),
            const SizedBox(height: 8),
            TextField(
              maxLines: 4,
              style: const TextStyle(fontSize: 13, color: TW.text1),
              decoration: InputDecoration(
                hintText: 'Mô tả tình trạng hiện trường...',
                hintStyle: const TextStyle(color: TW.text3, fontSize: 13),
                filled: true,
                fillColor: TW.surface,
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: TW.border)),
                enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: TW.border)),
                focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: TW.primary, width: 1.5)),
              ),
            ),
            const SizedBox(height: 16),

            // Checkboxes
            _CheckboxRow(label: 'Có người bị thương'),
            _CheckboxRow(label: 'Đường bị chắn'),
            _CheckboxRow(label: 'Nhà bị ảnh hưởng'),
            const SizedBox(height: 20),

            // Submit
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () => setState(() => _submitted = true),
                style: ElevatedButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 14)),
                child: const Text('Gửi báo cáo'),
              ),
            ),
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }
}

class _SuccessView extends StatelessWidget {
  final VoidCallback onBack;
  const _SuccessView({required this.onBack});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 80, height: 80,
                decoration: BoxDecoration(color: TW.primaryLight, shape: BoxShape.circle),
                child: const Icon(Icons.check_circle_outline, color: TW.primary, size: 44),
              ),
              const SizedBox(height: 20),
              const Text('Báo cáo đã gửi thành công', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700, color: TW.text1)),
              const SizedBox(height: 8),
              const Text('Cảm ơn bạn đã phản ánh. Cán bộ sẽ xem xét trong thời gian sớm nhất.',
                textAlign: TextAlign.center, style: TextStyle(fontSize: 13, color: TW.text2)),
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                decoration: BoxDecoration(color: TW.bg, borderRadius: BorderRadius.circular(8), border: Border.all(color: TW.border)),
                child: const Text('#FR-250815-018', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: TW.text2)),
              ),
              const SizedBox(height: 32),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: onBack,
                  child: const Text('Về trang chủ'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Alerts Screen (M15) ────────────────────────────────────────────────────

class AlertsScreen extends StatelessWidget {
  const AlertsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Lịch sử cảnh báo')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Active alert
          _AlertListCard(
            id: '#TW-250815-004',
            title: 'Nguy cơ CỰC CAO · Bản Vược',
            time: 'Phát 08:35 · Hiệu lực đến 08:00 16/08',
            active: true,
            onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const AlertDetailScreen())),
          ),
          const SizedBox(height: 8),
          // Past alert
          _AlertListCard(
            id: '#TW-250815-002',
            title: 'Nguy cơ TRUNG BÌNH · Quang Kim',
            time: 'Phát 06:00 · Kết thúc 06:00 14/08',
            active: false,
            onTap: () {},
          ),
        ],
      ),
    );
  }
}

// ── Profile Screen (M16) ───────────────────────────────────────────────────

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Hồ sơ')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            // Avatar + name
            Center(
              child: Column(children: [
                Container(
                  width: 72, height: 72,
                  decoration: const BoxDecoration(color: TW.primary, shape: BoxShape.circle),
                  child: const Center(child: Text('HM', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w700, color: Colors.white))),
                ),
                const SizedBox(height: 12),
                const Text('Hoàng Văn Minh', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: TW.text1)),
                const SizedBox(height: 4),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(color: TW.primaryLight, borderRadius: BorderRadius.circular(20)),
                  child: const Text('Bản Vược, Bát Xát', style: TextStyle(fontSize: 12, color: TW.primary, fontWeight: FontWeight.w500)),
                ),
              ]),
            ),
            const SizedBox(height: 24),
            // Notification settings
            _SettingsSection(title: 'Cài đặt thông báo', children: [
              _ToggleRow(label: 'Nhận cảnh báo qua SMS'),
              _ToggleRow(label: 'Nhận thông báo app'),
              _ToggleRow(label: 'Bán kính 2.5 km'),
            ]),
            const SizedBox(height: 12),
            // Stats
            _SettingsSection(title: 'Thống kê', children: [
              _InfoRow(label: 'Cảnh báo đã nhận', value: '3'),
              _InfoRow(label: 'Báo cáo đã gửi', value: '2'),
            ]),
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton(
                onPressed: () {},
                style: OutlinedButton.styleFrom(
                  foregroundColor: TW.extreme,
                  side: const BorderSide(color: Color(0xFFFECACA)),
                  padding: const EdgeInsets.symmetric(vertical: 12),
                ),
                child: const Text('Đăng xuất'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Shared widgets ─────────────────────────────────────────────────────────

class _AvatarBadge extends StatelessWidget {
  final String initials;
  const _AvatarBadge({required this.initials});

  @override
  Widget build(BuildContext context) => Container(
    width: 36, height: 36,
    decoration: const BoxDecoration(color: TW.primary, shape: BoxShape.circle),
    child: Center(child: Text(initials, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Colors.white))),
  );
}

class _AlertBanner extends StatelessWidget {
  final VoidCallback onTap;
  const _AlertBanner({required this.onTap});

  @override
  Widget build(BuildContext context) => GestureDetector(
    onTap: onTap,
    child: Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: TW.extremeBg,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFFECACA)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(children: [
            Icon(Icons.warning_amber_rounded, color: TW.extreme, size: 18),
            SizedBox(width: 6),
            Text('CẢNH BÁO KHẨN CẤP', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: TW.extreme, letterSpacing: 0.5)),
          ]),
          const SizedBox(height: 4),
          const Text('Nguy cơ sạt lở CỰC CAO tại khu vực của bạn',
            style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: TW.text1)),
          const SizedBox(height: 8),
          Row(children: [
            const Spacer(),
            Text('Xem chi tiết', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: TW.extreme)),
            const Icon(Icons.chevron_right, size: 16, color: TW.extreme),
          ]),
        ],
      ),
    ),
  );
}

class _StatusCard extends StatelessWidget {
  final Color color, borderColor, iconColor;
  final IconData icon;
  final String title, subtitle;
  const _StatusCard({required this.color, required this.borderColor, required this.icon, required this.iconColor, required this.title, required this.subtitle});

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(14),
    decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(12), border: Border.all(color: borderColor)),
    child: Row(children: [
      Icon(icon, color: iconColor, size: 22),
      const SizedBox(width: 12),
      Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(title, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: TW.text1)),
        Text(subtitle, style: const TextStyle(fontSize: 11, color: TW.text2)),
      ]),
    ]),
  );
}

class _SectionCard extends StatelessWidget {
  final String title;
  final Widget child;
  const _SectionCard({required this.title, required this.child});

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(14),
    decoration: BoxDecoration(color: TW.surface, borderRadius: BorderRadius.circular(12), border: Border.all(color: TW.border)),
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(title, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: TW.text2)),
      const SizedBox(height: 10),
      child,
    ]),
  );
}

class _MetricChip extends StatelessWidget {
  final String label, value;
  final Color color;
  const _MetricChip({required this.label, required this.value, required this.color});

  @override
  Widget build(BuildContext context) => Expanded(
    child: Column(children: [
      Text(value, style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: color)),
      Text(label, style: const TextStyle(fontSize: 10, color: TW.text2)),
    ]),
  );
}

class _DetailSection extends StatelessWidget {
  final String title;
  final Widget child;
  const _DetailSection({required this.title, required this.child});

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(14),
    decoration: BoxDecoration(color: TW.surface, borderRadius: BorderRadius.circular(10), border: Border.all(color: TW.border)),
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(title.toUpperCase(), style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: TW.text3, letterSpacing: 0.6)),
      const SizedBox(height: 10),
      child,
    ]),
  );
}

class _AlertListCard extends StatelessWidget {
  final String id, title, time;
  final bool active;
  final VoidCallback onTap;
  const _AlertListCard({required this.id, required this.title, required this.time, required this.active, required this.onTap});

  @override
  Widget build(BuildContext context) => GestureDetector(
    onTap: onTap,
    child: Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: active ? TW.extremeBg : TW.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: active ? const Color(0xFFFECACA) : TW.border),
      ),
      child: Row(children: [
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: active ? TW.extreme : TW.border,
                borderRadius: BorderRadius.circular(4),
              ),
              child: Text(active ? 'ĐANG HOẠT ĐỘNG' : 'ĐÃ KẾT THÚC',
                style: TextStyle(fontSize: 9, fontWeight: FontWeight.w700, color: active ? Colors.white : TW.text2, letterSpacing: 0.5)),
            ),
            const SizedBox(width: 8),
            Text(id, style: const TextStyle(fontSize: 11, color: TW.text2)),
          ]),
          const SizedBox(height: 6),
          Text(title, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: TW.text1)),
          const SizedBox(height: 2),
          Text(time, style: const TextStyle(fontSize: 11, color: TW.text2)),
        ])),
        const Icon(Icons.chevron_right, color: TW.text3),
      ]),
    ),
  );
}

class _CheckboxRow extends StatefulWidget {
  final String label;
  const _CheckboxRow({required this.label});

  @override
  State<_CheckboxRow> createState() => _CheckboxRowState();
}

class _CheckboxRowState extends State<_CheckboxRow> {
  bool _value = false;

  @override
  Widget build(BuildContext context) => Row(children: [
    Checkbox(
      value: _value,
      onChanged: (v) => setState(() => _value = v ?? false),
      activeColor: TW.primary,
      materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
    ),
    Text(widget.label, style: const TextStyle(fontSize: 13, color: TW.text1)),
  ]);
}

class _SettingsSection extends StatelessWidget {
  final String title;
  final List<Widget> children;
  const _SettingsSection({required this.title, required this.children});

  @override
  Widget build(BuildContext context) => Container(
    decoration: BoxDecoration(color: TW.surface, borderRadius: BorderRadius.circular(12), border: Border.all(color: TW.border)),
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Padding(
        padding: const EdgeInsets.fromLTRB(14, 12, 14, 6),
        child: Text(title.toUpperCase(), style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: TW.text3, letterSpacing: 0.6)),
      ),
      ...children.map((c) => Column(children: [Container(height: 1, color: TW.border), c])),
    ]),
  );
}

class _ToggleRow extends StatefulWidget {
  final String label;
  const _ToggleRow({required this.label});

  @override
  State<_ToggleRow> createState() => _ToggleRowState();
}

class _ToggleRowState extends State<_ToggleRow> {
  bool _value = true;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
    child: Row(children: [
      Expanded(child: Text(widget.label, style: const TextStyle(fontSize: 13, color: TW.text1))),
      Switch(value: _value, onChanged: (v) => setState(() => _value = v), activeColor: TW.primary),
    ]),
  );
}

class _InfoRow extends StatelessWidget {
  final String label, value;
  const _InfoRow({required this.label, required this.value});

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
    child: Row(children: [
      Expanded(child: Text(label, style: const TextStyle(fontSize: 13, color: TW.text1))),
      Text(value, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: TW.primary)),
    ]),
  );
}

class _LegendDot extends StatelessWidget {
  final Color color;
  final String label;
  const _LegendDot({required this.color, required this.label});

  @override
  Widget build(BuildContext context) => Row(mainAxisSize: MainAxisSize.min, children: [
    Container(width: 8, height: 8, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
    const SizedBox(width: 4),
    Text(label, style: const TextStyle(fontSize: 10, color: TW.text2)),
  ]);
}
