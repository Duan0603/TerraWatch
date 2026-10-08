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

  AlertModel({
    this.id,
    required this.broadcastId,
    required this.title,
    required this.message,
    required this.severity,
    required this.areaName,
    required this.receivedAt,
  });

  Map<String, dynamic> toMap() => {
        if (id != null) 'id': id,
        'broadcast_id': broadcastId,
        'title': title,
        'message': message,
        'severity': severity,
        'area_name': areaName,
        'received_at': receivedAt,
      };

  factory AlertModel.fromMap(Map<String, dynamic> map) => AlertModel(
        id: map['id'] as int?,
        broadcastId: map['broadcast_id'] ?? '',
        title: map['title'] ?? '',
        message: map['message'] ?? '',
        severity: map['severity'] ?? 'high',
        areaName: map['area_name'] ?? '',
        receivedAt: map['received_at'] ?? '',
      );

  factory AlertModel.fromFcmPayload(Map<String, dynamic> data) => AlertModel(
        broadcastId: data['broadcastId'] ?? DateTime.now().millisecondsSinceEpoch.toString(),
        title: data['title'] ?? '🚨 CẢNH BÁO SẠT LỞ ĐẤT KHẨN CẤP',
        message: data['message'] ?? 'Yêu cầu người dân sơ tán ngay lập tức!',
        severity: data['severity'] ?? 'extreme',
        areaName: data['areaName'] ?? 'Khu vực trọng điểm',
        receivedAt: DateTime.now().toIso8601String(),
      );
}
