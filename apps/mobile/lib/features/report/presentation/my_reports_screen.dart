import 'package:flutter/material.dart';
import '../../../core/network/api_exceptions.dart';
import '../../../core/theme/app_colors.dart';
import '../data/field_report.dart';
import '../data/report_repository.dart';
import 'report_screen.dart' show formatDateTime;

/// Báo cáo của tôi: hàng đợi trong máy kèm trạng thái gửi và trạng thái xử lý phía server
class MyReportsScreen extends StatefulWidget {
  final ReportRepository? repository;
  const MyReportsScreen({super.key, this.repository});

  @override
  State<MyReportsScreen> createState() => _MyReportsScreenState();
}

class _MyReportsScreenState extends State<MyReportsScreen> {
  late final ReportRepository _repo = widget.repository ?? ReportRepository();
  List<FieldReport>? _reports;

  @override
  void initState() {
    super.initState();
    _refresh();
  }

  /// Gửi các báo cáo đang chờ, lấy trạng thái mới từ server rồi nạp lại danh sách (lỗi mạng thì giữ danh sách trong máy)
  Future<void> _refresh() async {
    await _reload();
    try {
      await _repo.syncPending();
      await _repo.refreshStatuses();
    } on ApiException catch (_) {}
    await _reload();
  }

  Future<void> _reload() async {
    final list = await _repo.list();
    if (mounted) setState(() => _reports = list);
  }

  Future<void> _retry(FieldReport report) async {
    await _repo.retry(report);
    await _reload();
  }

  @override
  Widget build(BuildContext context) {
    final reports = _reports;
    return Scaffold(
      appBar: AppBar(title: const Text('Báo cáo của tôi')),
      body: reports == null
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _refresh,
              child: reports.isEmpty
                  ? ListView(children: const [
                      Padding(
                        padding: EdgeInsets.all(32),
                        child: Text('Bạn chưa gửi báo cáo nào.', textAlign: TextAlign.center, style: TextStyle(color: AppColors.textSecondary)),
                      ),
                    ])
                  : ListView.separated(
                      padding: const EdgeInsets.all(16),
                      itemCount: reports.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 10),
                      itemBuilder: (_, i) => _ReportCard(report: reports[i], onRetry: () => _retry(reports[i])),
                    ),
            ),
    );
  }
}

class _ReportCard extends StatelessWidget {
  final FieldReport report;
  final VoidCallback onRetry;
  const _ReportCard({required this.report, required this.onRetry});

  (String, Color) get _status => switch (report.status) {
        ReportStatus.pending => ('Chờ gửi', AppColors.warning),
        ReportStatus.failed => ('Lỗi', AppColors.danger),
        ReportStatus.sent => switch (report.serverStatus) {
            'processed' => ('Đã xử lý', AppColors.primary),
            'archived' => ('Đã lưu trữ', AppColors.textMuted),
            _ => ('Đã gửi', AppColors.safe),
          },
      };

  @override
  Widget build(BuildContext context) {
    final (label, color) = _status;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          if (report.imageBytes != null)
            ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: Image.memory(report.imageBytes!, width: 64, height: 64, fit: BoxFit.cover),
            )
          else
            const SizedBox(width: 64, height: 64, child: Icon(Icons.description_outlined, color: AppColors.textMuted)),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(color: color.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(12)),
                  child: Text(label, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: color)),
                ),
                const Spacer(),
                Text(formatDateTime(report.observedAt), style: const TextStyle(fontSize: 11, color: AppColors.textSecondary)),
              ]),
              const SizedBox(height: 6),
              Text(report.description ?? '(chỉ có ảnh)', maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 13)),
              if (report.status != ReportStatus.sent && report.lastError != null)
                Padding(
                  padding: const EdgeInsets.only(top: 4),
                  child: Text(report.lastError!, style: const TextStyle(fontSize: 11, color: AppColors.danger)),
                ),
              if (report.status != ReportStatus.sent)
                Align(
                  alignment: Alignment.centerRight,
                  child: TextButton(onPressed: onRetry, child: const Text('Gửi lại')),
                ),
            ]),
          ),
        ]),
      ),
    );
  }
}
