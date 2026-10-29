import 'package:flutter_test/flutter_test.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';
import 'package:geosentry_mobile/core/storage/local_storage.dart';
import 'package:geosentry_mobile/features/geofence/data/forecast_zone.dart';
import 'package:geosentry_mobile/features/geofence/data/geofence_evaluator.dart';
import 'package:geosentry_mobile/features/geofence/data/zone_store.dart';

final now = DateTime.utc(2026, 10, 14, 12);

ForecastZone cell(int i, {Duration validFor = const Duration(hours: 23), String hazard = 'medium'}) {
  // lưới 100 x 100 ô 0.01°, không chồng nhau
  final lon = 104.0 + (i % 100) * 0.01;
  final lat = 21.0 + (i ~/ 100) * 0.01;
  return ForecastZone(
    runId: 'run-$i',
    unitId: 'U$i',
    unitVersion: 'v1',
    hazardLevel: hazard,
    probability: 0.7,
    issuedAt: now,
    validFrom: now.subtract(const Duration(hours: 1)),
    validUntil: now.add(validFor),
    modelVersion: 'm1',
    ring: [
      [lon, lat],
      [lon + 0.01, lat],
      [lon + 0.01, lat + 0.01],
      [lon, lat + 0.01],
      [lon, lat],
    ],
  );
}

void main() {
  sqfliteFfiInit();
  late SqliteZoneStore store;

  setUp(() async {
    final db = await databaseFactoryFfi.openDatabase(inMemoryDatabasePath);
    await LocalStorage.createTables(db);
    store = SqliteZoneStore(() async => db);
  });

  test('stores zones, finds them by bounding box and keeps the sync time', () async {
    await store.replaceAll([cell(0), cell(1)], now);
    final found = await store.candidates(21.005, 104.005);
    expect(found.map((z) => z.runId), ['run-0']);
    expect(found.single.validUntil, now.add(const Duration(hours: 23)));
    expect(found.single.validUntil.isUtc, isTrue);
    final summary = await store.summary(now);
    expect((summary.count, summary.unexpiredCount, summary.lastSyncAt), (2, 2, now));
    expect((await store.summary(now.add(const Duration(hours: 24)))).unexpiredCount, 0);
  });

  test('a replace is atomic: a failure midway keeps the previous cache', () async {
    await store.replaceAll([cell(0), cell(1)], now);
    final duplicate = [cell(5), cell(5)]; // run_id trùng -> lỗi khóa chính giữa chừng
    await expectLater(store.replaceAll(duplicate, now.add(const Duration(hours: 1))), throwsA(anything));
    final summary = await store.summary(now);
    expect(summary.count, 2);
    expect(summary.lastSyncAt, now);
  });

  test('10,000 zones: cached, looked up and decided correctly (capacity check, timings printed)', () async {
    final zones = [for (var i = 0; i < 10000; i++) cell(i, hazard: i == 4242 ? 'extreme' : 'medium')];
    final write = Stopwatch()..start();
    await store.replaceAll(zones, now);
    write.stop();

    expect((await store.summary(now)).count, 10000);
    final evaluator = GeofenceEvaluator(store, clock: () => now);

    // tâm ô 4242: hàng 42, cột 42
    final lookup = Stopwatch()..start();
    final inside = await evaluator.evaluate(21.0 + 42 * 0.01 + 0.005, 104.0 + 42 * 0.01 + 0.005);
    lookup.stop();
    expect(inside.status, GeofenceStatus.warning);
    expect(inside.hazardLevel, 'extreme');
    expect(inside.activeZones.single.runId, 'run-4242');

    final outside = await evaluator.evaluate(30.0, 110.0);
    expect(outside.status, GeofenceStatus.none);

    // cạnh chung của 2 ô liền kề: nằm trên cạnh nên thuộc cả hai ô
    final shared = await evaluator.evaluate(21.0 + 42 * 0.01 + 0.005, 104.0 + 43 * 0.01);
    expect(shared.activeZones.length, 2);

    // ignore: avoid_print
    print('10,000 zones: write ${write.elapsedMilliseconds} ms, one lookup ${lookup.elapsedMilliseconds} ms');
  });
}
