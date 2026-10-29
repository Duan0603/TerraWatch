import 'package:sqflite/sqflite.dart';
import '../../../core/storage/local_storage.dart';
import 'forecast_zone.dart';

class ZoneSummary {
  final int count;

  /// Số vùng chưa hết hạn (đang hiệu lực hoặc sắp có hiệu lực)
  final int unexpiredCount;
  final DateTime? lastSyncAt;
  const ZoneSummary({required this.count, required this.unexpiredCount, required this.lastSyncAt});
}

/// Bộ nhớ đệm các vùng dự báo trên máy
abstract class ZoneStore {
  /// Thay toàn bộ bộ đệm bằng [zones] và ghi mốc đồng bộ; lỗi giữa chừng thì bộ đệm cũ còn nguyên
  Future<void> replaceAll(List<ForecastZone> zones, DateTime syncedAt);

  /// Các vùng có khung bao chứa điểm (kể cả vùng đã hết hạn); người gọi phải kiểm tra đa giác
  Future<List<ForecastZone>> candidates(double lat, double lon);

  Future<ZoneSummary> summary(DateTime now);
}

class SqliteZoneStore implements ZoneStore {
  static const _syncedAtKey = 'forecast_synced_at';

  final Future<Database> Function() _open;

  SqliteZoneStore([Future<Database> Function()? open]) : _open = open ?? (() => LocalStorage.database);

  @override
  Future<void> replaceAll(List<ForecastZone> zones, DateTime syncedAt) async {
    final db = await _open();
    await db.transaction((txn) async {
      await txn.delete('forecast_zones');
      final batch = txn.batch();
      for (final zone in zones) {
        batch.insert('forecast_zones', zone.toRow());
      }
      batch.insert(
        'cache_meta',
        {'key': _syncedAtKey, 'value': syncedAt.millisecondsSinceEpoch.toString()},
        conflictAlgorithm: ConflictAlgorithm.replace,
      );
      await batch.commit(noResult: true);
    });
  }

  @override
  Future<List<ForecastZone>> candidates(double lat, double lon) async {
    final db = await _open();
    final rows = await db.query(
      'forecast_zones',
      where: 'min_lat <= ? AND max_lat >= ? AND min_lon <= ? AND max_lon >= ?',
      whereArgs: [lat, lat, lon, lon],
    );
    return rows.map(ForecastZone.fromRow).toList();
  }

  @override
  Future<ZoneSummary> summary(DateTime now) async {
    final db = await _open();
    final ms = now.millisecondsSinceEpoch;
    final counts = await db.rawQuery(
      'SELECT COUNT(*) AS total, COALESCE(SUM(CASE WHEN valid_until > ? THEN 1 ELSE 0 END), 0) AS unexpired FROM forecast_zones',
      [ms],
    );
    final meta = await db.query('cache_meta', where: 'key = ?', whereArgs: [_syncedAtKey]);
    return ZoneSummary(
      count: counts.first['total'] as int,
      unexpiredCount: counts.first['unexpired'] as int,
      lastSyncAt: meta.isEmpty
          ? null
          : DateTime.fromMillisecondsSinceEpoch(int.parse(meta.first['value'] as String), isUtc: true),
    );
  }
}
