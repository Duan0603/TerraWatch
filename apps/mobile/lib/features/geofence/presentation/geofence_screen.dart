import 'dart:async';
import 'package:flutter/material.dart';
import '../../../core/network/api_exceptions.dart';
import '../../../core/theme/app_colors.dart';
import '../../../services/notification_service.dart';
import '../../../core/widgets/primary_button.dart';
import '../data/device_location.dart';
import '../data/forecast_repository.dart';
import '../data/forecast_zone.dart';
import '../data/geofence_evaluator.dart';
import '../data/zone_store.dart';

String formatLocal(DateTime utc) {
  final t = utc.toLocal();
  String two(int n) => n.toString().padLeft(2, '0');
  return '${two(t.day)}/${two(t.month)} ${two(t.hour)}:${two(t.minute)}';
}

/// Kiểm tra vị trí với các vùng dự báo đã lưu trên máy, kể cả khi không có mạng (Story 5.3)
class GeofenceScreen extends StatefulWidget {
  final ZoneStore? store;
  final ForecastRepository? repository;
  final DateTime Function()? clock;
  final EmergencyAlarm? alarm;
  final Future<DevicePosition> Function()? locationProvider;
  final Stream<DevicePosition> Function()? positionStream;
  final Future<void> Function()? notificationPermission;

  const GeofenceScreen({
    super.key,
    this.store,
    this.repository,
    this.clock,
    this.alarm,
    this.locationProvider,
    this.positionStream,
    this.notificationPermission,
  });

  @override
  State<GeofenceScreen> createState() => _GeofenceScreenState();
}

class _GeofenceScreenState extends State<GeofenceScreen> {
  late final ZoneStore _store = widget.store ?? SqliteZoneStore();
  late final ForecastRepository _repo = widget.repository ?? ForecastRepository(store: _store);
  late final GeofenceMonitor _monitor =
      GeofenceMonitor(GeofenceEvaluator(_store, clock: widget.clock), alarm: widget.alarm);
  StreamSubscription<DevicePosition>? _watch;
  ZoneSummary? _summary;
  GeofenceResult? _result;
  bool _busy = false;
  String? _message;

  @override
  void initState() {
    super.initState();
    _refreshSummary();
  }

  @override
  void dispose() {
    _watch?.cancel();
    super.dispose();
  }

  DateTime _now() => (widget.clock ?? DateTime.now)().toUtc();

  Future<void> _refreshSummary() async {
    final summary = await _store.summary(_now());
    if (mounted) setState(() => _summary = summary);
  }

  Future<void> _run(Future<void> Function() action) async {
    setState(() {
      _busy = true;
      _message = null;
    });
    try {
      await action();
    } on ApiException catch (e) {
      if (mounted) setState(() => _message = e.message);
    } catch (_) {
      if (mounted) setState(() => _message = 'Không đọc được dữ liệu dự báo trên máy');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _sync() => _run(() async {
        final count = await _repo.sync();
        await _refreshSummary();
        if (mounted) setState(() => _message = 'Đã đồng bộ $count vùng dự báo');
      });

  Future<void> _check() => _run(() async {
        await (widget.notificationPermission ?? NotificationService.requestPermission)();
        final position = await (widget.locationProvider ?? currentPosition)();
        final result = await _monitor.check(position.latitude, position.longitude);
        if (mounted) setState(() => _result = result);
        await _refreshSummary();
      });

  void _stopWatch() {
    _watch?.cancel();
    setState(() => _watch = null);
  }

  Future<void> _toggleWatch(bool on) async {
    if (!on) return _stopWatch();
    await (widget.notificationPermission ?? NotificationService.requestPermission)();
    if (!mounted) return;
    setState(() {
      _watch = (widget.positionStream ?? positionUpdates)().listen(
        (p) async {
          final result = await _monitor.check(p.latitude, p.longitude);
          if (mounted) setState(() => _result = result);
        },
        onError: (Object e) {
          if (!mounted) return;
          _stopWatch();
          setState(() => _message = e is ApiException ? e.message : 'Không theo dõi được vị trí. Hãy bật GPS và quyền vị trí');
        },
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    final summary = _summary;
    return Scaffold(
      appBar: AppBar(title: const Text('Cảnh báo vị trí')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          _StatusCard(result: _result),
          const SizedBox(height: 16),
          Text('Vùng dự báo đã lưu trên máy: ${summary?.count ?? '…'}'),
          const SizedBox(height: 4),
          Text(
            summary?.lastSyncAt == null ? 'Chưa đồng bộ lần nào' : 'Đồng bộ lần cuối: ${formatLocal(summary!.lastSyncAt!)}',
            style: const TextStyle(color: AppColors.textSecondary),
          ),
          const SizedBox(height: 16),
          PrimaryButton(label: 'Kiểm tra vị trí', icon: Icons.my_location, isLoading: _busy, onPressed: _check),
          const SizedBox(height: 8),
          OutlinedButton.icon(
            onPressed: _busy ? null : _sync,
            icon: const Icon(Icons.sync),
            label: const Text('Đồng bộ (cần mạng)'),
          ),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Theo dõi khi đang mở màn hình này'),
            subtitle: const Text('Báo động ngay khi bạn bước vào vùng cảnh báo'),
            value: _watch != null,
            onChanged: _toggleWatch,
          ),
          if (_message != null) ...[
            const SizedBox(height: 8),
            Text(_message!, style: const TextStyle(color: AppColors.textSecondary)),
          ],
          const SizedBox(height: 16),
          const Text(
            'Vị trí của bạn chỉ được xử lý trên điện thoại, không gửi lên máy chủ. '
            'Kết quả "chưa có cảnh báo" không phải xác nhận an toàn.',
            style: TextStyle(color: AppColors.textSecondary, fontSize: 12.5),
          ),
        ]),
      ),
    );
  }
}

class _StatusCard extends StatelessWidget {
  final GeofenceResult? result;
  const _StatusCard({required this.result});

  @override
  Widget build(BuildContext context) {
    final r = result;
    final (icon, color, title, detail) = r == null
        ? (Icons.location_searching, AppColors.textMuted, 'Chưa kiểm tra vị trí', 'Bấm "Kiểm tra vị trí" để so với các vùng đã lưu.')
        : switch (r.status) {
            GeofenceStatus.warning => (
                Icons.warning_amber_rounded,
                AppColors.danger,
                'Bạn đang trong vùng cảnh báo',
                'Mức nguy cơ: ${hazardLabels[r.hazardLevel]}. Hiệu lực đến ${formatLocal(r.soonestValidUntil!)}.',
              ),
            GeofenceStatus.stale => (Icons.update_disabled, AppColors.warning, 'Dữ liệu dự báo đã cũ', _staleDetail(r)),
            GeofenceStatus.none => (
                Icons.info_outline,
                AppColors.primary,
                'Chưa có cảnh báo hiện hành',
                'Không có dự báo nguy cơ đang hiệu lực tại vị trí này. Đây không phải xác nhận an toàn.',
              ),
          };
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        border: Border.all(color: color),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(children: [
        Icon(icon, color: color, size: 56),
        const SizedBox(height: 8),
        Text(title, textAlign: TextAlign.center, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
        const SizedBox(height: 6),
        Text(detail, textAlign: TextAlign.center, style: const TextStyle(color: AppColors.textSecondary)),
      ]),
    );
  }

  static String _staleDetail(GeofenceResult r) => switch (r.staleReason!) {
        StaleReason.neverSynced => 'Chưa tải dự báo về máy. Hãy đồng bộ khi có mạng. Đây không phải xác nhận an toàn.',
        StaleReason.syncTooOld =>
          'Lần đồng bộ cuối (${formatLocal(r.lastSyncAt!)}) đã quá 24 giờ. Hãy đồng bộ khi có mạng. Đây không phải xác nhận an toàn.',
        StaleReason.zoneExpired =>
          'Dự báo cho khu vực này đã hết hạn lúc ${formatLocal(r.expiredZone!.validUntil)}. Hãy đồng bộ khi có mạng. Đây không phải xác nhận an toàn.',
        StaleReason.allExpired => 'Mọi dự báo đã lưu đều hết hạn. Hãy đồng bộ khi có mạng. Đây không phải xác nhận an toàn.',
      };
}
