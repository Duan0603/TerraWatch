import '../../../core/storage/local_storage.dart';
import 'field_report.dart';

/// Nơi lưu hàng đợi báo cáo. Là interface để logic gửi/gửi lại kiểm thử được mà không cần SQLite thật.
abstract class ReportStore {
  /// Lưu báo cáo mới, trả về bản có id
  Future<FieldReport> insert(FieldReport report);

  Future<void> update(FieldReport report);

  /// Báo cáo của một tài khoản, mới nhất trước
  Future<List<FieldReport>> list(String userId);
}

class SqliteReportStore implements ReportStore {
  static const _table = 'offline_reports';

  @override
  Future<FieldReport> insert(FieldReport report) async {
    final db = await LocalStorage.database;
    final id = await db.insert(_table, report.toMap());
    return report.copyWith(id: id);
  }

  @override
  Future<void> update(FieldReport report) async {
    final db = await LocalStorage.database;
    await db.update(_table, report.toMap(), where: 'id = ?', whereArgs: [report.id]);
  }

  @override
  Future<List<FieldReport>> list(String userId) async {
    final db = await LocalStorage.database;
    // Bản ghi cũ trước khi nâng cấp không có client_report_id, bỏ qua vì không có chủ
    final rows = await db.query(_table,
        where: 'user_id = ? AND client_report_id IS NOT NULL', whereArgs: [userId], orderBy: 'id DESC');
    return rows.map(FieldReport.fromMap).toList();
  }
}
