import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:geosentry_mobile/core/network/api_client.dart';
import 'package:geosentry_mobile/core/network/api_exceptions.dart';
import 'package:geosentry_mobile/core/storage/session.dart';
import 'package:geosentry_mobile/features/auth/data/auth_models.dart';
import 'package:geosentry_mobile/features/map/data/hazard_models.dart';
import 'package:geosentry_mobile/features/map/data/hazard_repository.dart';

// Targets: lib/features/map/data/hazard_models.dart and hazard_repository.dart.
// Covers MD-MAP-001, 002, 003 (models) and MD-MAP-005, 006, 007, 008, 009 (repository).
// Already asserted by map_test: MD-MAP-004 (valid collection), and the basic fallbacks / bounds / markers.
// MD-MAP-010 (OS permission) does not apply: the repository only does an HTTP GET; location permission is in map_screen_location_test.
// The repository returns the raw GeoJSON; it has no local copy, so "keep local data" on errors means: it throws and returns nothing.

http.Response _json(int status, Object body) => http.Response(jsonEncode(body), status, headers: {'content-type': 'application/json'});

void main() {
  group('HazardInfo (MD-MAP-001, 002, 003)', () {
    test('MD-MAP-001: every property is read with its type; label, area and date display follow', () {
      final h = HazardInfo.fromProperties({
        'event_id': 'e-1',
        'risk_level': 'extreme',
        'confidence': 0.96,
        'slope': 43.5,
        'area_m2': 480688.58,
        'scene_id': 'S2B_X',
        'verified_at': '2026-10-08T03:28:52+00:00',
      });
      expect((h.eventId, h.riskLevel, h.confidence, h.slope, h.sceneId), ('e-1', 'extreme', 0.96, 43.5, 'S2B_X'));
      expect([h.label, h.areaDisplay, h.verifiedDateDisplay], ['Cực cao', '48.1 ha', '08/10/2026']);
    });

    test('MD-MAP-002: an empty properties map gives the safest-to-show defaults (low, no area, no date)', () {
      final h = HazardInfo.fromProperties({});
      expect((h.eventId, h.riskLevel, h.label), ('', 'low', 'Thấp'));
      expect([h.confidence, h.slope, h.areaM2, h.sceneId, h.verifiedAt, h.areaDisplay, h.verifiedDateDisplay], everyElement(isNull));
      final nulls = HazardInfo.fromProperties({'event_id': null, 'risk_level': null, 'area_m2': null});
      expect((nulls.eventId, nulls.riskLevel), ('', 'low'));
    });

    test('MD-MAP-002: integers from JSON become doubles; the area display switches to hectares at exactly 10,000 m²', () {
      final h = HazardInfo.fromProperties({'confidence': 1, 'slope': 30, 'area_m2': 9999});
      expect((h.confidence, h.slope), (1.0, 30.0));
      expect(h.areaDisplay, '9999 m²');
      expect(HazardInfo.fromProperties({'area_m2': 10000}).areaDisplay, '1.0 ha');
      expect(HazardInfo.fromProperties({'area_m2': 849.6}).areaDisplay, '850 m²');
    });

    test('MD-MAP-002: a verified_at shorter than a date, or an unknown risk level, never throws and shows the lowest level', () {
      expect(HazardInfo.fromProperties({'verified_at': '2026-10'}).verifiedDateDisplay, isNull);
      expect(HazardInfo.fromProperties({'verified_at': '2026-10-08'}).verifiedDateDisplay, '08/10/2026');
      final odd = HazardInfo.fromProperties({'risk_level': 'catastrophic'});
      expect((odd.riskLevel, odd.label), ('catastrophic', 'Thấp'));
      expect(HazardInfo.colorHex['catastrophic'], isNull, reason: 'the map falls back to defaultColorHex for it');
    });

    test('MD-MAP-003: a wrongly typed property is rejected (TypeError) instead of becoming a wrong number', () {
      expect(() => HazardInfo.fromProperties({'confidence': '0.9'}), throwsA(isA<TypeError>()));
      expect(() => HazardInfo.fromProperties({'area_m2': 'big'}), throwsA(isA<TypeError>()));
      expect(() => HazardInfo.fromProperties({'scene_id': 5}), throwsA(isA<TypeError>()));
      expect(() => HazardInfo.fromProperties({'verified_at': 20261008}), throwsA(isA<TypeError>()));
    });

    test('MD-MAP-003: bounds and markers skip points that are not numbers, and a wrongly typed features list throws', () {
      final collection = {
        'features': [
          {
            'geometry': {
              'coordinates': [
                [
                  [104.0, 21.0],
                  ['x', 'y'],
                  [105.0, 22.0],
                ]
              ]
            },
            'properties': {'event_id': 'a'},
          },
        ],
      };
      final b = hazardBounds(collection)!;
      expect((b.south, b.west, b.north, b.east), (21.0, 104.0, 22.0, 105.0));
      expect(hazardMarkers(collection)['features'], hasLength(1));
      expect(() => hazardBounds({'features': 'nope'}), throwsA(isA<TypeError>()));
      expect(hazardBounds({'features': [{'geometry': null}]}), isNull);
      expect(hazardMarkers({'features': [{'geometry': null, 'properties': {'a': 1}}]})['features'], isEmpty);
    });

    test('a feature without properties still becomes a marker with an empty properties map', () {
      final m = hazardMarkers({
        'features': [
          {'geometry': {'coordinates': [[[104.0, 21.0], [104.2, 21.4]]]}}
        ]
      });
      final feature = (m['features'] as List).single as Map;
      expect(feature['properties'], <String, dynamic>{});
      expect((feature['geometry'] as Map)['coordinates'], [104.1, 21.2]);
    });
  });

  group('HazardRepository (MD-MAP-005..009)', () {
    late http.Response Function(http.Request) reply;
    late List<http.Request> requests;
    var online = true;

    HazardRepository repo() => HazardRepository(
          apiClient: ApiClient(
            baseUrl: 'http://test',
            client: MockClient((r) async {
              requests.add(r);
              if (!online) throw http.ClientException('no route to host');
              return reply(r);
            }),
          ),
        );

    setUp(() async {
      SharedPreferences.setMockInitialValues({});
      await Session.save('jwt-1', const UserProfile(userId: 'u-1', fullName: 'An', email: 'a@b.c', role: 'citizen'));
      requests = [];
      online = true;
      reply = (_) => _json(200, {'type': 'FeatureCollection', 'features': []});
    });

    test('MD-MAP-005: an empty collection is returned as it is; an empty 200 body becomes an empty map, not an error', () async {
      expect(await repo().fetchActiveHazards(), {'type': 'FeatureCollection', 'features': []});
      reply = (_) => http.Response('', 200);
      expect(await repo().fetchActiveHazards(), isEmpty);
      expect(hazardBounds(await repo().fetchActiveHazards()), isNull, reason: 'the caller can tell "nothing to show" without a crash');
    });

    test('MD-MAP-005: a JSON array answer is wrapped under "data" so the caller does not get a cast error', () async {
      reply = (_) => _json(200, [1, 2]);
      expect(await repo().fetchActiveHazards(), {'data': [1, 2]});
    });

    test('MD-MAP-006: an answer that is not JSON throws ApiException (connection message), never a half-parsed map', () async {
      reply = (_) => http.Response('<html>login</html>', 200);
      await expectLater(repo().fetchActiveHazards(), throwsA(isA<ApiException>().having((e) => e.message, 'message', contains('Không kết nối được máy chủ'))));
    });

    test('MD-MAP-007: 4xx becomes the server message, or fixed Vietnamese text for 401 and 403; the request carries the bearer token', () async {
      for (final (status, body, message) in <(int, Object, String)>[
        (400, {'message': 'Bad bbox'}, 'Bad bbox'),
        (404, {'detail': 'x'}, 'Lỗi máy chủ (404)'),
        (403, {'message': 'x'}, 'Không có quyền truy cập.'),
      ]) {
        reply = (_) => _json(status, body);
        await expectLater(
          repo().fetchActiveHazards(),
          throwsA(isA<ApiException>().having((e) => (e.statusCode, e.message), 'status+message', (status, message))),
        );
      }
      expect(requests.every((r) => r.headers['Authorization'] == 'Bearer jwt-1' && r.url.path == '/api/v1/landslides/active'), isTrue);
      reply = (_) => _json(401, {'message': 'x'});
      await expectLater(repo().fetchActiveHazards(), throwsA(isA<ApiException>().having((e) => e.statusCode, 'statusCode', 401)));
      expect(Session.token, isNull, reason: 'a 401 with a token clears the session');
    });

    test('MD-MAP-008: 5xx throws ApiException with the status and returns no data', () async {
      for (final status in [500, 502, 503]) {
        reply = (_) => http.Response('<html>$status</html>', status);
        await expectLater(
          repo().fetchActiveHazards(),
          throwsA(isA<ApiException>().having((e) => (e.statusCode, e.message), 'status+message', (status, 'Lỗi máy chủ ($status)'))),
        );
      }
      expect(Session.token, 'jwt-1', reason: 'a 5xx is not a logout');
    });

    test('MD-MAP-009: no network throws the connection message; the repository keeps no copy of an earlier answer to show instead', () async {
      expect((await repo().fetchActiveHazards())['type'], 'FeatureCollection');
      online = false;
      await expectLater(repo().fetchActiveHazards(), throwsA(isA<ApiException>().having((e) => e.message, 'message', contains('Không kết nối được máy chủ'))));
    });
  });
}
