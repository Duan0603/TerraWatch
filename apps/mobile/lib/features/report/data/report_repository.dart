import 'dart:convert';
import 'dart:typed_data';

import '../../../core/network/api_client.dart';
import '../../../core/network/api_exceptions.dart';
import '../../../core/storage/session.dart';
import 'field_report.dart';
import 'report_store.dart';

/// Gửi báo cáo hiện trường: lưu trong máy trước, rồi gửi; mất mạng thì giữ hàng đợi và gửi lại sau
/// với cùng clientReportId để server không tạo bản trùng.
class ReportRepository {
  static const photoLimitBytes = 700000; // khớp giới hạn của server
  static bool _syncing = false;

  final ReportStore _store;
  final ApiClient _api;
  final String? Function() _currentUserId;

  ReportRepository({ReportStore? store, ApiClient? apiClient, String? Function()? currentUserId})
      : _store = store ?? SqliteReportStore(),
        _api = apiClient ?? ApiClient(),
        _currentUserId = currentUserId ?? (() => Session.user.value?.userId);

  String get _userId {
    final id = _currentUserId();
    if (id == null) throw const ApiException(message: 'Cần đăng nhập để gửi báo cáo');
    return id;
  }

  /// Lưu vào máy rồi gửi ngay; kết quả có thể là sent, pending (đang chờ mạng) hoặc failed (bị từ chối)
  Future<FieldReport> submit({
    required double latitude,
    required double longitude,
    double? accuracyM,
    String? description,
    required DateTime observedAt,
    Uint8List? imageBytes,
  }) async {
    final text = description?.trim();
    final saved = await _store.insert(FieldReport(
      clientReportId: newClientReportId(),
      userId: _userId,
      latitude: latitude,
      longitude: longitude,
      accuracyM: accuracyM,
      description: (text == null || text.isEmpty) ? null : text,
      observedAt: observedAt.toUtc(),
      createdAt: DateTime.now().toUtc(),
      imageBytes: imageBytes,
    ));
    return _send(saved);
  }

  Future<List<FieldReport>> list() => _store.list(_userId);

  Future<int> sentCount() async => (await list()).where((r) => r.status == ReportStatus.sent).length;

  /// Gửi các báo cáo đang chờ của tài khoản hiện tại (cũ nhất trước). Dừng sớm khi mất mạng để khỏi chờ timeout nhiều lần.
  Future<int> syncPending() async {
    final userId = _currentUserId();
    if (userId == null || _syncing) return 0;
    _syncing = true;
    try {
      var sent = 0;
      final pending = (await _store.list(userId)).where((r) => r.status == ReportStatus.pending).toList().reversed;
      for (final report in pending) {
        final result = await _send(report);
        if (result.status == ReportStatus.sent) {
          sent++;
        } else if (result.status == ReportStatus.pending) {
          break; // lỗi tạm thời (mạng/máy chủ/phiên): thử lại lần sau
        }
      }
      return sent;
    } finally {
      _syncing = false;
    }
  }

  /// Báo cáo bị từ chối: người dùng chủ động thử gửi lại
  Future<FieldReport> retry(FieldReport report) =>
      _send(report.copyWith(status: ReportStatus.pending, clearError: true));

  /// Cập nhật trạng thái phía server (submitted/processed/archived) cho các báo cáo đã gửi
  Future<void> refreshStatuses() async {
    final data = (await _api.get('/api/v1/community-reports/mine'))['data'];
    if (data is! List) return;
    final byClientId = {for (final r in data) (r as Map)['clientReportId']: r};
    for (final report in await list()) {
      final server = byClientId[report.clientReportId];
      if (server == null || server['status'] == report.serverStatus) continue;
      await _store.update(report.copyWith(serverStatus: server['status'] as String?));
    }
  }

  Future<FieldReport> _send(FieldReport report) async {
    var current = report;
    try {
      if (current.imageBytes != null && current.photoId == null) {
        final upload = await _api.post('/api/v1/community-reports/photos',
            body: {'imageBase64': base64Encode(current.imageBytes!)});
        current = current.copyWith(photoId: upload['photoId'] as String);
        await _store.update(current); // lần gửi lại không tải ảnh lên nữa
      }
      final created = await _api.post('/api/v1/community-reports', body: {
        'clientReportId': current.clientReportId,
        'longitude': current.longitude,
        'latitude': current.latitude,
        if (current.accuracyM != null) 'accuracyM': current.accuracyM,
        if (current.description != null) 'description': current.description,
        if (current.photoId != null) 'photoId': current.photoId,
        'observedAt': current.observedAt.toUtc().toIso8601String(),
      });
      current = current.copyWith(
        status: ReportStatus.sent,
        serverReportId: created['reportId'] as int?,
        serverStatus: created['status'] as String?,
        clearError: true,
      );
    } on ApiException catch (e) {
      current = current.copyWith(status: _isPermanent(e) ? ReportStatus.failed : ReportStatus.pending, lastError: e.message);
    }
    await _store.update(current);
    return current;
  }

  /// 4xx do nội dung báo cáo (không phải hết phiên, hết giờ, quá tải) thì gửi lại cũng vô ích
  static bool _isPermanent(ApiException e) {
    final code = e.statusCode;
    return code != null && code >= 400 && code < 500 && code != 401 && code != 408 && code != 429;
  }
}
