import 'dart:convert';
import 'dart:math';
import '../../../core/utils/geo_math.dart';

const hazardLevels = ['low', 'medium', 'high', 'extreme'];

const hazardLabels = {'low': 'Thấp', 'medium': 'Trung bình', 'high': 'Cao', 'extreme': 'Rất cao'};

/// Một vùng dự báo đã được cán bộ duyệt, lưu trên máy để kiểm tra vị trí khi mất mạng (Story 5.3).
/// Mọi mốc thời gian là UTC; chỉ đổi sang giờ địa phương khi hiển thị.
class ForecastZone {
  final String runId;
  final String unitId;
  final String unitVersion;
  final String hazardLevel;
  final double? probability;
  final DateTime issuedAt;
  final DateTime validFrom;
  final DateTime validUntil;
  final String modelVersion;

  /// Vòng ngoài của đa giác, mỗi đỉnh là [kinh độ, vĩ độ]
  final List<List<double>> ring;
  final double minLat, maxLat, minLon, maxLon;

  ForecastZone({
    required this.runId,
    required this.unitId,
    required this.unitVersion,
    required this.hazardLevel,
    required this.probability,
    required this.issuedAt,
    required this.validFrom,
    required this.validUntil,
    required this.modelVersion,
    required this.ring,
  })  : minLat = ring.map((p) => p[1]).reduce(min),
        maxLat = ring.map((p) => p[1]).reduce(max),
        minLon = ring.map((p) => p[0]).reduce(min),
        maxLon = ring.map((p) => p[0]).reduce(max);

  /// Đọc một phần tử của `items` trong phản hồi `/forecasts/offline-sync`; dữ liệu sai dạng thì ném [FormatException]
  factory ForecastZone.fromJson(Map<String, dynamic> json) {
    try {
      final geometry = json['geometry'] as Map<String, dynamic>;
      if (geometry['type'] != 'Polygon') throw const FormatException('geometry is not a Polygon');
      final ring = ((geometry['coordinates'] as List).first as List)
          .map((p) => [(p[0] as num).toDouble(), (p[1] as num).toDouble()])
          .toList();
      if (ring.length < 4) throw const FormatException('polygon ring too short');
      final level = json['hazardLevel'] as String;
      if (!hazardLevels.contains(level)) throw FormatException('unknown hazard level $level');
      final validFrom = DateTime.parse(json['validFrom'] as String).toUtc();
      final validUntil = DateTime.parse(json['validUntil'] as String).toUtc();
      if (!validUntil.isAfter(validFrom)) throw const FormatException('validUntil must be after validFrom');
      return ForecastZone(
        runId: json['runId'] as String,
        unitId: json['unitId'] as String,
        unitVersion: (json['unitVersion'] as String?) ?? '',
        hazardLevel: level,
        probability: (json['probability'] as num?)?.toDouble(),
        issuedAt: DateTime.parse(json['issuedAt'] as String).toUtc(),
        validFrom: validFrom,
        validUntil: validUntil,
        modelVersion: (json['modelVersion'] as String?) ?? '',
        ring: ring,
      );
    } on FormatException {
      rethrow;
    } catch (e) {
      throw FormatException('invalid forecast zone: $e');
    }
  }

  factory ForecastZone.fromRow(Map<String, Object?> row) => ForecastZone(
        runId: row['run_id'] as String,
        unitId: row['unit_id'] as String,
        unitVersion: row['unit_version'] as String,
        hazardLevel: row['hazard_level'] as String,
        probability: (row['probability'] as num?)?.toDouble(),
        issuedAt: _utc(row['issued_at']),
        validFrom: _utc(row['valid_from']),
        validUntil: _utc(row['valid_until']),
        modelVersion: row['model_version'] as String,
        ring: (jsonDecode(row['polygon'] as String) as List)
            .map((p) => [(p[0] as num).toDouble(), (p[1] as num).toDouble()])
            .toList(),
      );

  Map<String, Object?> toRow() => {
        'run_id': runId,
        'unit_id': unitId,
        'unit_version': unitVersion,
        'hazard_level': hazardLevel,
        'probability': probability,
        'issued_at': issuedAt.millisecondsSinceEpoch,
        'valid_from': validFrom.millisecondsSinceEpoch,
        'valid_until': validUntil.millisecondsSinceEpoch,
        'model_version': modelVersion,
        'polygon': jsonEncode(ring),
        'min_lat': minLat,
        'max_lat': maxLat,
        'min_lon': minLon,
        'max_lon': maxLon,
      };

  /// Còn hiệu lực khi validFrom ≤ now < validUntil (đúng giờ hết hạn là đã hết hạn)
  bool isValidAt(DateTime now) => !now.isBefore(validFrom) && now.isBefore(validUntil);

  bool isExpiredAt(DateTime now) => !now.isBefore(validUntil);

  bool contains(double lat, double lon) => GeoMath.isPointInOrOnPolygon(lat, lon, ring);

  int get hazardRank => hazardLevels.indexOf(hazardLevel);

  static DateTime _utc(Object? millis) => DateTime.fromMillisecondsSinceEpoch(millis as int, isUtc: true);
}
