/// Hồ sơ người dùng trả về từ /api/v1/auth/* (UserProfileResponse)
class UserProfile {
  final String userId;
  final String fullName;
  final String email;
  final String role;
  final String? phoneNumber;
  final String authProvider; // email | google
  final String? dateOfBirth; // ISO yyyy-MM-dd
  final String? gender; // male | female | other
  final String? province;
  final String? district;
  final String? commune;
  final String? addressLine;
  final String? emergencyContactName;
  final String? emergencyContactPhone;
  final String? emergencyContactRelation;
  final bool hasAvatar;

  const UserProfile({
    required this.userId,
    required this.fullName,
    required this.email,
    required this.role,
    this.phoneNumber,
    this.authProvider = 'email',
    this.dateOfBirth,
    this.gender,
    this.province,
    this.district,
    this.commune,
    this.addressLine,
    this.emergencyContactName,
    this.emergencyContactPhone,
    this.emergencyContactRelation,
    this.hasAvatar = false,
  });

  factory UserProfile.fromJson(Map<String, dynamic> json) => UserProfile(
        userId: json['userId'] as String,
        fullName: json['fullName'] as String,
        email: json['email'] as String,
        role: json['role'] as String,
        phoneNumber: json['phoneNumber'] as String?,
        authProvider: (json['authProvider'] as String?) ?? 'email',
        dateOfBirth: json['dateOfBirth'] as String?,
        gender: json['gender'] as String?,
        province: json['province'] as String?,
        district: json['district'] as String?,
        commune: json['commune'] as String?,
        addressLine: json['addressLine'] as String?,
        emergencyContactName: json['emergencyContactName'] as String?,
        emergencyContactPhone: json['emergencyContactPhone'] as String?,
        emergencyContactRelation: json['emergencyContactRelation'] as String?,
        hasAvatar: (json['hasAvatar'] as bool?) ?? false,
      );

  Map<String, dynamic> toJson() => {
        'userId': userId,
        'fullName': fullName,
        'email': email,
        'role': role,
        'phoneNumber': phoneNumber,
        'authProvider': authProvider,
        'dateOfBirth': dateOfBirth,
        'gender': gender,
        'province': province,
        'district': district,
        'commune': commune,
        'addressLine': addressLine,
        'emergencyContactName': emergencyContactName,
        'emergencyContactPhone': emergencyContactPhone,
        'emergencyContactRelation': emergencyContactRelation,
        'hasAvatar': hasAvatar,
      };

  /// Chữ cái đầu của tối đa 2 từ cuối trong tên, dùng cho avatar
  String get initials {
    final parts = fullName.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
    if (parts.isEmpty) return '?';
    final picked = parts.length == 1 ? [parts.first] : parts.sublist(parts.length - 2);
    return picked.map((p) => p[0].toUpperCase()).join();
  }

  /// dd/MM/yyyy từ chuỗi ISO yyyy-MM-dd; null nếu chưa có
  String? get dateOfBirthDisplay {
    final iso = dateOfBirth;
    if (iso == null || iso.length != 10) return null;
    return '${iso.substring(8, 10)}/${iso.substring(5, 7)}/${iso.substring(0, 4)}';
  }

  String? get genderLabel => switch (gender) {
        'male' => 'Nam',
        'female' => 'Nữ',
        'other' => 'Khác',
        _ => null,
      };

  /// Địa chỉ gộp từ thôn/bản đến tỉnh; null nếu chưa nhập gì
  String? get fullAddress {
    final parts = [addressLine, commune, district, province].where((p) => p != null && p.isNotEmpty);
    return parts.isEmpty ? null : parts.join(', ');
  }

  /// "Tên (Quan hệ) · số điện thoại"; null nếu chưa có người liên hệ
  String? get emergencyContactDisplay {
    final name = emergencyContactName;
    final phone = emergencyContactPhone;
    if ((name == null || name.isEmpty) && (phone == null || phone.isEmpty)) return null;
    final relation = emergencyContactRelation;
    final who = [
      if (name != null && name.isNotEmpty) name,
      if (relation != null && relation.isNotEmpty) '($relation)',
    ].join(' ');
    return [if (who.isNotEmpty) who, if (phone != null && phone.isNotEmpty) phone].join(' · ');
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
