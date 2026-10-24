/// Hồ sơ người dùng trả về từ /api/v1/auth/* (UserProfileResponse)
class UserProfile {
  final String userId;
  final String fullName;
  final String email;
  final String role;
  final String? phoneNumber;

  const UserProfile({
    required this.userId,
    required this.fullName,
    required this.email,
    required this.role,
    this.phoneNumber,
  });

  factory UserProfile.fromJson(Map<String, dynamic> json) => UserProfile(
        userId: json['userId'] as String,
        fullName: json['fullName'] as String,
        email: json['email'] as String,
        role: json['role'] as String,
        phoneNumber: json['phoneNumber'] as String?,
      );

  Map<String, dynamic> toJson() => {
        'userId': userId,
        'fullName': fullName,
        'email': email,
        'role': role,
        'phoneNumber': phoneNumber,
      };

  /// Chữ cái đầu của tối đa 2 từ cuối trong tên, dùng cho avatar
  String get initials {
    final parts = fullName.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
    if (parts.isEmpty) return '?';
    final picked = parts.length == 1 ? [parts.first] : parts.sublist(parts.length - 2);
    return picked.map((p) => p[0].toUpperCase()).join();
  }
}

/// AuthResponse: { token, role, user }
class AuthResult {
  final String token;
  final UserProfile user;

  const AuthResult({required this.token, required this.user});

  factory AuthResult.fromJson(Map<String, dynamic> json) => AuthResult(
        token: json['token'] as String,
        user: UserProfile.fromJson(json['user'] as Map<String, dynamic>),
      );
}
