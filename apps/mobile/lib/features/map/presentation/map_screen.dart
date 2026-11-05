import 'dart:convert';
import 'dart:math';

import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:maplibre_gl/maplibre_gl.dart';
import '../../../core/config/env.dart';
import '../../../core/network/api_exceptions.dart';
import '../../../core/theme/app_colors.dart';
import '../data/hazard_models.dart';
import '../data/hazard_repository.dart';

/// Bản đồ nguy cơ sạt lở: cùng nền MapTiler và cùng dữ liệu vùng đã xác minh với bản web.
class MapScreen extends StatefulWidget {
  final HazardRepository? repository;
  const MapScreen({super.key, this.repository});

  @override
  State<MapScreen> createState() => _MapScreenState();
}

class _MapScreenState extends State<MapScreen> {
  static const _source = 'hazards';
  static const _fillLayer = 'hazards-fill';
  static const _lineLayer = 'hazards-line';
  static const _markerSource = 'hazard-markers';
  static const _markerLayer = 'hazard-markers-circle';

  /// Màu theo risk_level, trùng bản web
  static const _colorExpression = [
    'match',
    ['get', 'risk_level'],
    'extreme', '#ef4444',
    'high', '#f97316',
    'medium', '#eab308',
    HazardInfo.defaultColorHex,
  ];

  late final HazardRepository _repo = widget.repository ?? HazardRepository();
  MapLibreMapController? _controller;
  Map<String, dynamic>? _hazards;
  String? _error;
  bool _styleLoaded = false;
  bool _satellite = false;
  bool _locationGranted = false;
  bool _fitted = false;

  int get _hazardCount => (_hazards?['features'] as List?)?.length ?? 0;

  @override
  void initState() {
    super.initState();
    _loadHazards();
  }

  Future<void> _loadHazards() async {
    setState(() => _error = null);
    try {
      final data = await _repo.fetchActiveHazards();
      if (!mounted) return;
      setState(() => _hazards = data);
      await _syncHazardLayers();
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    }
  }

  /// Vẽ (hoặc vẽ lại sau khi đổi nền) các vùng sạt lở; chỉ chạy khi cả nền bản đồ và dữ liệu đã sẵn sàng
  Future<void> _syncHazardLayers() async {
    final c = _controller;
    final data = _hazards;
    if (c == null || data == null || !_styleLoaded) return;
    for (final id in [_markerLayer, _lineLayer, _fillLayer]) {
      try {
        await c.removeLayer(id);
      } catch (_) {} // chưa có lớp này
    }
    for (final id in [_markerSource, _source]) {
      try {
        await c.removeSource(id);
      } catch (_) {}
    }
    await c.addGeoJsonSource(_source, data);
    await c.addFillLayer(_source, _fillLayer, const FillLayerProperties(fillColor: _colorExpression, fillOpacity: 0.45));
    await c.addLineLayer(_source, _lineLayer, const LineLayerProperties(lineColor: _colorExpression, lineWidth: 2));
    // Chấm tròn ở tâm mỗi vùng: vùng chỉ rộng vài trăm mét, ở mức thu phóng thấp sẽ không thấy và không chạm được
    await c.addGeoJsonSource(_markerSource, hazardMarkers(data));
    await c.addCircleLayer(
      _markerSource,
      _markerLayer,
      const CircleLayerProperties(
        circleRadius: 7,
        circleColor: _colorExpression,
        circleStrokeColor: '#ffffff',
        circleStrokeWidth: 2,
      ),
    );
    if (!_fitted) {
      final b = hazardBounds(data);
      if (b != null) {
        _fitted = true;
        await c.animateCamera(CameraUpdate.newLatLngBounds(
          LatLngBounds(southwest: LatLng(b.south, b.west), northeast: LatLng(b.north, b.east)),
          left: 48, top: 130, right: 48, bottom: 130,
        ));
      }
    }
  }

  Future<void> _onMapClick(Point<double> point, LatLng _) async {
    final c = _controller;
    if (c == null) return;
    final hits = await c.queryRenderedFeatures(point, [_markerLayer, _fillLayer], null);
    if (hits.isEmpty || !mounted) return;
    final feature = hits.first is String ? jsonDecode(hits.first as String) : hits.first;
    final properties = Map<String, dynamic>.from((feature as Map)['properties'] as Map);
    showModalBottomSheet(
      context: context,
      builder: (_) => _HazardSheet(info: HazardInfo.fromProperties(properties)),
    );
  }

  void _toggleSatellite() {
    if (AppEnv.satelliteStyleUrl() == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Chưa có khóa MapTiler (MAPTILER_KEY) nên chưa dùng được nền vệ tinh')),
      );
      return;
    }
    setState(() {
      _satellite = !_satellite;
      _styleLoaded = false; // lớp vùng sạt lở được vẽ lại khi nền mới tải xong
    });
  }

  Future<void> _goToMyLocation() async {
    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) permission = await Geolocator.requestPermission();
    if (permission == LocationPermission.denied || permission == LocationPermission.deniedForever) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Cần cấp quyền vị trí để xem vị trí của bạn')));
      }
      return;
    }
    try {
      final position = await Geolocator.getCurrentPosition(timeLimit: const Duration(seconds: 10));
      if (!mounted) return;
      setState(() => _locationGranted = true);
      await _controller?.animateCamera(CameraUpdate.newLatLngZoom(LatLng(position.latitude, position.longitude), 13));
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Không lấy được vị trí hiện tại')));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final style = (_satellite ? AppEnv.satelliteStyleUrl() : null) ?? AppEnv.topoStyleUrl();
    return Scaffold(
      appBar: AppBar(
        title: const Text('Bản đồ nguy cơ'),
        actions: [
          IconButton(
            icon: Icon(_satellite ? Icons.map_outlined : Icons.satellite_alt_outlined),
            tooltip: _satellite ? 'Nền địa hình' : 'Nền vệ tinh',
            onPressed: _toggleSatellite,
          ),
        ],
      ),
      body: Stack(
        children: [
          MapLibreMap(
            styleString: style,
            initialCameraPosition: const CameraPosition(target: LatLng(21.9, 104.2), zoom: 7.5),
            myLocationEnabled: _locationGranted,
            compassEnabled: true,
            onMapCreated: (c) => _controller = c,
            onStyleLoadedCallback: () {
              _styleLoaded = true;
              _syncHazardLayers();
            },
            onMapClick: _onMapClick,
          ),
          Positioned(
            top: 14,
            left: 14,
            right: 14,
            child: _StatusCard(
              text: _error ?? (_hazards == null ? 'Đang tải vùng nguy cơ...' : '$_hazardCount vùng nguy cơ đã xác minh'),
              isError: _error != null,
              onRetry: _error != null ? _loadHazards : null,
            ),
          ),
          if (AppEnv.mapTilerKey.isEmpty)
            const Positioned(
              top: 70,
              left: 14,
              right: 14,
              child: Text(
                'Đang dùng nền bản đồ miễn phí. Thêm MAPTILER_KEY để có nền địa hình và vệ tinh như bản web.',
                style: TextStyle(fontSize: 11, color: AppColors.textSecondary),
              ),
            ),
          Positioned(
            bottom: 20,
            left: 14,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: AppColors.cardSurface,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: AppColors.border),
              ),
              child: const Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  _LegendDot(color: Color(0xFF10B981), label: 'Thấp'),
                  SizedBox(width: 10),
                  _LegendDot(color: Color(0xFFEAB308), label: 'TB'),
                  SizedBox(width: 10),
                  _LegendDot(color: Color(0xFFF97316), label: 'Cao'),
                  SizedBox(width: 10),
                  _LegendDot(color: Color(0xFFEF4444), label: 'Cực cao'),
                ],
              ),
            ),
          ),
          Positioned(
            bottom: 20,
            right: 14,
            child: FloatingActionButton.small(
              backgroundColor: AppColors.cardSurface,
              foregroundColor: AppColors.primary,
              onPressed: _goToMyLocation,
              child: const Icon(Icons.my_location),
            ),
          ),
        ],
      ),
    );
  }
}

class _StatusCard extends StatelessWidget {
  final String text;
  final bool isError;
  final VoidCallback? onRetry;
  const _StatusCard({required this.text, required this.isError, this.onRetry});

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: AppColors.cardSurface,
          borderRadius: BorderRadius.circular(10),
          boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.08), blurRadius: 8)],
        ),
        child: Row(children: [
          Icon(isError ? Icons.error_outline : Icons.location_on_outlined,
              size: 16, color: isError ? AppColors.danger : AppColors.primary),
          const SizedBox(width: 8),
          Expanded(
            child: Text(text,
                style: TextStyle(
                    fontSize: 13, fontWeight: FontWeight.w600, color: isError ? AppColors.danger : AppColors.textPrimary)),
          ),
          if (onRetry != null) TextButton(onPressed: onRetry, child: const Text('Thử lại')),
        ]),
      );
}

class _HazardSheet extends StatelessWidget {
  final HazardInfo info;
  const _HazardSheet({required this.info});

  @override
  Widget build(BuildContext context) {
    final rows = <(String, String?)>[
      ('Độ tin cậy', info.confidence == null ? null : '${(info.confidence! * 100).round()}%'),
      ('Độ dốc', info.slope == null ? null : '${info.slope}°'),
      ('Diện tích', info.areaDisplay),
      ('Xác minh ngày', info.verifiedDateDisplay),
      ('Ảnh vệ tinh', info.sceneId),
    ];
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            const Text('Vùng sạt lở đã xác minh', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
            const Spacer(),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: _color(info.riskLevel).withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Text('Nguy cơ ${info.label}',
                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: _color(info.riskLevel))),
            ),
          ]),
          const SizedBox(height: 12),
          for (final (label, value) in rows)
            if (value != null)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 4),
                child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  SizedBox(width: 110, child: Text(label, style: const TextStyle(fontSize: 13, color: AppColors.textSecondary))),
                  Expanded(child: Text(value, style: const TextStyle(fontSize: 13))),
                ]),
              ),
        ]),
      ),
    );
  }

  static Color _color(String level) =>
      Color(int.parse((HazardInfo.colorHex[level] ?? HazardInfo.defaultColorHex).substring(1), radix: 16) | 0xFF000000);
}

class _LegendDot extends StatelessWidget {
  final Color color;
  final String label;
  const _LegendDot({required this.color, required this.label});

  @override
  Widget build(BuildContext context) => Row(mainAxisSize: MainAxisSize.min, children: [
        Container(width: 8, height: 8, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
        const SizedBox(width: 4),
        Text(label, style: const TextStyle(fontSize: 10, color: AppColors.textSecondary)),
      ]);
}
