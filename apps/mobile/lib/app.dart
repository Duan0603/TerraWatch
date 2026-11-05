import 'package:flutter/material.dart';
import 'core/storage/session.dart';
import 'core/theme/app_theme.dart';
import 'core/constants/app_constants.dart';
import 'features/auth/data/auth_models.dart';
import 'features/auth/presentation/login_screen.dart';
import 'features/home/presentation/main_shell.dart';

/// Root Application Widget
class GeoSentryApp extends StatelessWidget {
  const GeoSentryApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: AppConstants.appName,
      debugShowCheckedModeBanner: false,
      theme: AppTheme.lightTheme,
      // Cổng đăng nhập: có phiên -> MainShell, hết phiên/đăng xuất -> LoginScreen
      home: ValueListenableBuilder<UserProfile?>(
        valueListenable: Session.user,
        builder: (_, user, __) => user == null ? const LoginScreen() : const MainShell(),
      ),
    );
  }
}
