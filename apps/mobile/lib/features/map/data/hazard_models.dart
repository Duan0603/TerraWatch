/// Mức nguy cơ của một vùng sạt lở đã được cán bộ xác minh (properties.risk_level)
class HazardInfo {
  final String eventId;
  final String riskLevel; // extreme | high | medium | low
  final double? confidence; // 0..1
  final double? slope; // độ
  final double? areaM2;
  final String? sceneId;
  final String? verifiedAt; // ISO 8601

  const HazardInfo({
    required this.eventId,
    required this.riskLevel,
    this.confidence,
    this.slope,
    this.areaM2,
    this.sceneId,
    this.verifiedAt,
  });

  factory HazardInfo.fromProperties(Map<String, dynamic> p) => HazardInfo(
        eventId: (p['event_id'] ?? '').toString(),
        riskLevel: (p['risk_level'] ?? 'low').toString(),
        confidence: (p['confidence'] as num?)?.toDouble(),
        slope: (p['slope'] as num?)?.toDouble(),
        areaM2: (p['area_m2'] as num?)?.toDouble(),
        sceneId: p['scene_id'] as String?,
        verifiedAt: p['verified_at'] as String?,
      );

  /// Màu giống bản web (MapViewer.jsx): extreme đỏ, high cam, medium vàng, còn lại xanh
  static const colorHex = {
    'extreme': '#ef4444',
    'high': '#f97316',
    'medium': '#eab308',
  };
  static const defaultColorHex = '#10b981';

  String get label => switch (riskLevel) {
        'extreme' => 'Cực cao',
        'high' => 'Cao',
        'medium' => 'Trung bình',
        _ => 'Thấp',
      };

  /// 12.3 ha hoặc 850 m²
  String? get areaDisplay {
    final a = areaM2;
    if (a == null) return null;
    return a >= 10000 ? '${(a / 10000).toStringAsFixed(1)} ha' : '${a.round()} m²';
  }

  /// dd/MM/yyyy từ chuỗi ISO
  String? get verifiedDateDisplay {
    final iso = verifiedAt;
    if (iso == null || iso.length < 10) return null;
    return '${iso.substring(8, 10)}/${iso.substring(5, 7)}/${iso.substring(0, 4)}';
  }
}

/// Khung bao (tây-nam, đông-bắc) của toàn bộ vùng trong một FeatureCollection; null nếu không có tọa độ
({double south, double west, double north, double east})? hazardBounds(Map<String, dynamic> collection) {
  double? south, west, north, east;
  void visit(dynamic node) {
    if (node is List && node.length >= 2 && node[0] is num && node[1] is num) {
      final lon = (node[0] as num).toDouble();
      final lat = (node[1] as num).toDouble();
      south = south == null || lat < south! ? lat : south;
      north = north == null || lat > north! ? lat : north;
      west = west == null || lon < west! ? lon : west;
      east = east == null || lon > east! ? lon : east;
    } else if (node is List) {
      node.forEach(visit);
    }
  }

  for (final f in (collection['features'] as List? ?? const [])) {
    visit((f as Map)['geometry']?['coordinates']);
  }
  if (south == null) return null;
  return (south: south!, west: west!, north: north!, east: east!);
}
