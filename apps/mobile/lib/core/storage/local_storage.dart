import 'package:sqflite/sqflite.dart';
import 'package:path/path.dart' as p;
import '../constants/app_constants.dart';

/// Quản lý CSDL SQLite cục bộ trên thiết bị (Story 5.2 & Story 5.3)
class LocalStorage {
  static Database? _database;

  static Future<Database> get database async {
    if (_database != null && _database!.isOpen) {
      await _createTablesIfNotExist(_database!);
      return _database!;
    }
    _database = await _initDb();
    return _database!;
  }

  static Future<Database> _initDb() async {
    final dbPath = await getDatabasesPath();
    final path = p.join(dbPath, AppConstants.dbName);

    return await openDatabase(
      path,
      version: AppConstants.dbVersion,
      onCreate: (db, version) async {
        await _createTablesIfNotExist(db);
      },
      onUpgrade: (db, oldVersion, newVersion) async {
        await _createTablesIfNotExist(db);
      },
      onOpen: (db) async {
        await _createTablesIfNotExist(db);
      },
    );
  }

  static Future<void> _createTablesIfNotExist(Database db) async {
    // 1. Bảng lưu trữ đa giác sạt lở ngoại tuyến (Story 5.3: >= 10,000 polygon)
    await db.execute('''
      CREATE TABLE IF NOT EXISTS hazard_polygons (
        event_id TEXT PRIMARY KEY,
        risk_level TEXT,
        confidence_score REAL,
        centroid_lat REAL,
        centroid_lon REAL,
        polygon_geojson TEXT,
        updated_at TEXT
      )
    ''');

    // Chỉ mục hỗ trợ tìm kiếm nhanh theo tâm sạt lở
    await db.execute('''
      CREATE INDEX IF NOT EXISTS idx_hazard_centroid ON hazard_polygons (centroid_lat, centroid_lon)
    ''');

    // 2. Bảng lưu trữ hàng đợi Báo cáo hiện trường khi mất mạng (Story 5.2)
    await db.execute('''
      CREATE TABLE IF NOT EXISTS offline_reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        latitude REAL,
        longitude REAL,
        image_path TEXT,
        description TEXT,
        created_at TEXT,
        status TEXT DEFAULT 'pending',
        client_report_id TEXT,
        user_id TEXT,
        observed_at TEXT,
        accuracy_m REAL,
        image_bytes BLOB,
        photo_id TEXT,
        server_report_id INTEGER,
        server_status TEXT,
        last_error TEXT
      )
    ''');
    await _addMissingReportColumns(db);

    // 3. Bảng lưu trữ lịch sử cảnh báo khẩn cấp đã nhận (Story 5.1)
    await db.execute('''
      CREATE TABLE IF NOT EXISTS alert_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        broadcast_id TEXT,
        title TEXT,
        message TEXT,
        severity TEXT,
        area_name TEXT,
        received_at TEXT
      )
    ''');
  }

  /// Máy đã cài bản cũ (offline_reports chỉ có 7 cột): thêm các cột còn thiếu, không mất dữ liệu cũ
  static Future<void> _addMissingReportColumns(Database db) async {
    const columns = {
      'client_report_id': 'TEXT',
      'user_id': 'TEXT',
      'observed_at': 'TEXT',
      'accuracy_m': 'REAL',
      'image_bytes': 'BLOB',
      'photo_id': 'TEXT',
      'server_report_id': 'INTEGER',
      'server_status': 'TEXT',
      'last_error': 'TEXT',
    };
    final existing = (await db.rawQuery('PRAGMA table_info(offline_reports)')).map((r) => r['name']).toSet();
    for (final entry in columns.entries) {
      if (!existing.contains(entry.key)) {
        await db.execute('ALTER TABLE offline_reports ADD COLUMN ${entry.key} ${entry.value}');
      }
    }
    await db.execute('CREATE UNIQUE INDEX IF NOT EXISTS idx_report_client_id ON offline_reports (client_report_id)');
  }

  /// Thêm bản tin cảnh báo mới vào SQLite
  static Future<int> insertAlert(Map<String, dynamic> alert) async {
    try {
      final db = await database;
      return await db.insert('alert_history', alert);
    } catch (_) {
      return -1;
    }
  }

  /// Lấy danh sách lịch sử cảnh báo mới nhất
  static Future<List<Map<String, dynamic>>> getAlertHistory() async {
    try {
      final db = await database;
      return await db.query('alert_history', orderBy: 'id DESC');
    } catch (_) {
      return [];
    }
  }

  /// Xóa sạch lịch sử cảnh báo (Dành cho reset kiểm thử)
  static Future<void> clearAlertHistory() async {
    try {
      final db = await database;
      await db.delete('alert_history');
    } catch (_) {}
  }

  /// Lấy tổng số lượng vùng sạt lở đang lưu trong SQLite
  static Future<int> getHazardCount() async {
    try {
      final db = await database;
      final result = await db.rawQuery('SELECT COUNT(*) as total FROM hazard_polygons');
      return Sqflite.firstIntValue(result) ?? 0;
    } catch (_) {
      return 0;
    }
  }
}
