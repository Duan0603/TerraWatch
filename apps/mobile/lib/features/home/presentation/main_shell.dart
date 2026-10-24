import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../../alerts/presentation/alerts_screen.dart';
import '../../map/presentation/map_screen.dart';
import '../../profile/presentation/profile_screen.dart';
import 'home_screen.dart';

/// Khung điều hướng 4 tab (Trang chủ, Bản đồ, Cảnh báo, Hồ sơ)
class MainShell extends StatefulWidget {
  const MainShell({super.key});

  @override
  State<MainShell> createState() => _MainShellState();
}

class _MainShellState extends State<MainShell> {
  int _index = 0;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      // IndexedStack giữ HomeScreen sống để vẫn nhận cảnh báo khẩn cấp khi đang ở tab khác
      body: IndexedStack(
        index: _index,
        children: const [HomeScreen(), MapScreen(), AlertsScreen(), ProfileScreen()],
      ),
      bottomNavigationBar: Container(
        decoration: const BoxDecoration(
          border: Border(top: BorderSide(color: AppColors.border)),
          color: AppColors.cardSurface,
        ),
        child: BottomNavigationBar(
          currentIndex: _index,
          onTap: (i) => setState(() => _index = i),
          backgroundColor: AppColors.cardSurface,
          selectedItemColor: AppColors.primary,
          unselectedItemColor: AppColors.textMuted,
          selectedLabelStyle: const TextStyle(fontSize: 10, fontWeight: FontWeight.w600),
          unselectedLabelStyle: const TextStyle(fontSize: 10),
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
