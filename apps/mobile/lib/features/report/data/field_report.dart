import 'dart:math';
import 'dart:typed_data';

enum ReportStatus { pending, sent, failed }

/// UUID v4 do app sinh; server dùng nó để gửi lại không tạo bản trùng
String newClientReportId() {
  final random = Random.secure();
  final bytes = List<int>.generate(16, (_) => random.nextInt(256));
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant RFC 4122
  final hex = bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
  return '${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20)}';
}

/// Một báo cáo hiện trường lưu trong máy (hàng đợi offline) và trạng thái gửi lên server
class FieldReport {
  final int? id;
  final String clientReportId;
  final String userId; // chủ báo cáo: chỉ gửi khi đúng tài khoản này đang đăng nhập
  final double latitude;
  final double longitude;
  final double? accuracyM;
  final String? description;
  final DateTime observedAt; // UTC, lúc người dân thấy sự việc (khác lúc gửi)
  final DateTime createdAt;
  final Uint8List? imageBytes;
  final String? photoId; // đã tải ảnh lên server thì có, lần gửi lại không tải lại
  final ReportStatus status;
  final int? serverReportId;
  final String? serverStatus; // submitted | processed | archived
  final String? lastError;

  const FieldReport({
    this.id,
    required this.clientReportId,
    required this.userId,
    required this.latitude,
    required this.longitude,
    this.accuracyM,
    this.description,
    required this.observedAt,
    required this.createdAt,
    this.imageBytes,
    this.photoId,
    this.status = ReportStatus.pending,
    this.serverReportId,
    this.serverStatus,
    this.lastError,
  });

  FieldReport copyWith({
    int? id,
    String? photoId,
    ReportStatus? status,
    int? serverReportId,
    String? serverStatus,
    String? lastError,
    bool clearError = false,
  }) =>
      FieldReport(
        id: id ?? this.id,
        clientReportId: clientReportId,
        userId: userId,
        latitude: latitude,
        longitude: longitude,
        accuracyM: accuracyM,
        description: description,
        observedAt: observedAt,
        createdAt: createdAt,
        imageBytes: imageBytes,
        photoId: photoId ?? this.photoId,
        status: status ?? this.status,
        serverReportId: serverReportId ?? this.serverReportId,
        serverStatus: serverStatus ?? this.serverStatus,
        lastError: clearError ? null : (lastError ?? this.lastError),
      );

  Map<String, Object?> toMap() => {
        'client_report_id': clientReportId,
        'user_id': userId,
        'latitude': latitude,
        'longitude': longitude,
        'accuracy_m': accuracyM,
        'description': description,
        'observed_at': observedAt.toUtc().toIso8601String(),
        'created_at': createdAt.toUtc().toIso8601String(),
        'image_bytes': imageBytes,
        'photo_id': photoId,
        'status': status.name,
        'server_report_id': serverReportId,
        'server_status': serverStatus,
        'last_error': lastError,
      };

  factory FieldReport.fromMap(Map<String, Object?> m) => FieldReport(
        id: m['id'] as int?,
        clientReportId: m['client_report_id'] as String,
        userId: m['user_id'] as String,
        latitude: (m['latitude'] as num).toDouble(),
        longitude: (m['longitude'] as num).toDouble(),
        accuracyM: (m['accuracy_m'] as num?)?.toDouble(),
        description: m['description'] as String?,
        observedAt: DateTime.parse(m['observed_at'] as String),
        createdAt: DateTime.parse(m['created_at'] as String),
        imageBytes: m['image_bytes'] as Uint8List?,
        photoId: m['photo_id'] as String?,
        status: ReportStatus.values.firstWhere((s) => s.name == m['status'], orElse: () => ReportStatus.pending),
        serverReportId: m['server_report_id'] as int?,
        serverStatus: m['server_status'] as String?,
        lastError: m['last_error'] as String?,
      );
}
