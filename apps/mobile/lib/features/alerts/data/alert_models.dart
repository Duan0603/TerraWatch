/// Model đăng ký vùng nhận cảnh báo khẩn cấp (UC07)
class SubscriptionModel {
  final String phoneNumber;
  final String areaId;
  final String areaName;
  final List<String> alertChannels;

  SubscriptionModel({
    required this.phoneNumber,
    required this.areaId,
    this.areaName = '',
    this.alertChannels = const ['PUSH', 'SMS'],
  });

  Map<String, dynamic> toJson() => {
        'phoneNumber': phoneNumber,
        'areaId': areaId,
        'alertChannels': alertChannels,
      };

  factory SubscriptionModel.fromJson(Map<String, dynamic> json) =>
      SubscriptionModel(
        phoneNumber: json['phoneNumber'] ?? '',
        areaId: json['areaId'] ?? '',
        areaName: json['areaName'] ?? '',
        alertChannels: List<String>.from(json['alertChannels'] ?? ['PUSH', 'SMS']),
      );
}

/// Model bản tin cảnh báo sạt lở khẩn cấp nhận từ FCM Push hoặc SQLite
class AlertModel {
  final int? id;
  final String broadcastId;
  final String title;
  final String message;
  final String severity; // high, extreme
  final String areaName;
  final String receivedAt;

  /// Giờ phát lệnh và hạn hiệu lực (ISO-8601 UTC, có thể rỗng với bản tin cũ); [status] là active hoặc revoked
  final String? issuedAt;
  final String? validUntil;
  final String status;

  AlertModel({
    this.id,
    required this.broadcastId,
    required this.title,
    required this.message,
    required this.severity,
    required this.areaName,
    required this.receivedAt,
    this.issuedAt,
    this.validUntil,
    this.status = 'active',
  });

  /// Trạng thái hiển thị: thu hồi thắng hết hạn; hết hạn khi đúng giờ validUntil trở đi
  AlertState stateAt(DateTime now) {
    if (status == 'revoked') return AlertState.revoked;
    final until = validUntil == null ? null : DateTime.tryParse(validUntil!);
    if (until != null && !now.isBefore(until)) return AlertState.expired;
    return AlertState.active;
  }

  Map<String, dynamic> toMap() => {
        if (id != null) 'id': id,
        'broadcast_id': broadcastId,
        'title': title,
        'message': message,
        'severity': severity,
        'area_name': areaName,
        'received_at': receivedAt,
        'issued_at': issuedAt,
        'valid_until': validUntil,
        'status': status,
      };

  factory AlertModel.fromMap(Map<String, dynamic> map) => AlertModel(
        id: map['id'] as int?,
        broadcastId: map['broadcast_id'] ?? '',
        title: map['title'] ?? '',
        message: map['message'] ?? '',
        severity: map['severity'] ?? 'high',
        areaName: map['area_name'] ?? '',
        receivedAt: map['received_at'] ?? '',
        issuedAt: map['issued_at'] as String?,
        validUntil: map['valid_until'] as String?,
        status: (map['status'] as String?) ?? 'active',
      );

  factory AlertModel.fromFcmPayload(Map<String, dynamic> data) => AlertModel(
        broadcastId: data['broadcastId'] ?? DateTime.now().millisecondsSinceEpoch.toString(),
        title: data['title'] ?? '🚨 CẢNH BÁO SẠT LỞ ĐẤT KHẨN CẤP',
        message: data['message'] ?? 'Yêu cầu người dân sơ tán ngay lập tức!',
        severity: data['severity'] ?? 'extreme',
        areaName: data['areaName'] ?? 'Khu vực trọng điểm',
        receivedAt: DateTime.now().toIso8601String(),
        issuedAt: data['issuedAt'],
        validUntil: data['validUntil'],
      );

  /// Một phần tử của `GET /api/v1/alerts/broadcasts` (đồng bộ lại)
  factory AlertModel.fromBroadcastJson(Map<String, dynamic> json) => AlertModel(
        broadcastId: json['broadcastId'] as String,
        title: (json['title'] as String?) ?? '',
        message: (json['message'] as String?) ?? '',
        severity: (json['severity'] as String?) ?? 'high',
        areaName: (json['areaName'] as String?) ?? 'Khu vực trọng điểm',
        receivedAt: (json['issuedAt'] as String?) ?? DateTime.now().toIso8601String(),
        issuedAt: json['issuedAt'] as String?,
        validUntil: json['validUntil'] as String?,
        status: (json['status'] as String?) ?? 'active',
      );
}

enum AlertState { active, expired, revoked }

/// Vùng người dùng đã đăng ký nhận cảnh báo (GET /api/v1/alerts/subscriptions)
class SubscribedArea {
  final String subscriptionId;
  final int areaId;
  final String areaName;
  final List<String> alertChannels; // PUSH, SMS

  const SubscribedArea({
    required this.subscriptionId,
    required this.areaId,
    required this.areaName,
    required this.alertChannels,
  });

  factory SubscribedArea.fromJson(Map<String, dynamic> json) => SubscribedArea(
        subscriptionId: json['subscriptionId'] as String,
        areaId: json['areaId'] as int,
        areaName: (json['areaName'] as String?) ?? 'Khu vực #${json['areaId']}',
        alertChannels: List<String>.from(json['alertChannels'] as List),
      );
}
