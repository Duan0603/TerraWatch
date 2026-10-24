import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:geosentry_mobile/core/config/env.dart';
import 'package:geosentry_mobile/core/network/api_client.dart';
import 'package:geosentry_mobile/features/map/data/hazard_models.dart';
import 'package:geosentry_mobile/features/map/data/hazard_repository.dart';

// Dạng đúng của /api/v1/landslides/active (đọc từ server thật)
final _collection = <String, dynamic>{
  'type': 'FeatureCollection',
  'features': [
    {
      'type': 'Feature',
      'geometry': {
        'type': 'MultiPolygon',
        'coordinates': [
          [
            [[104.11, 21.86], [104.116, 21.86], [104.116, 21.867], [104.11, 21.867], [104.11, 21.86]]
          ]
        ],
      },
      'properties': {
        'event_id': 'e-1',
        'risk_level': 'extreme',
        'confidence': 0.96,
        'slope': 43.5,
        'area_m2': 480688.58,
        'scene_id': 'S2B_X',
        'verified_at': '2026-10-08T03:28:52+00:00',
      },
    },
    {
      'type': 'Feature',
      'geometry': {
        'type': 'MultiPolygon',
        'coordinates': [
          [
            [[103.82, 22.34], [103.824, 22.34], [103.824, 22.344], [103.82, 22.344], [103.82, 22.34]]
          ]
        ],
      },
      'properties': {'event_id': 'e-2', 'risk_level': 'medium', 'area_m2': 850},
    },
  ],
};

void main() {
  markerTests();
  group('Hazard info (Story 5.9)', () {
    test('parses server properties and builds display values', () {
      final info = HazardInfo.fromProperties(_collection['features'][0]['properties'] as Map<String, dynamic>);
      expect(info.label, 'Cực cao');
      expect(info.confidence, 0.96);
      expect(info.areaDisplay, '48.1 ha');
      expect(info.verifiedDateDisplay, '08/10/2026');
      expect(HazardInfo.colorHex['extreme'], '#ef4444'); // trùng bản web
    });

    test('missing or unknown values fall back safely', () {
      final info = HazardInfo.fromProperties({'event_id': 'e-2', 'risk_level': 'medium', 'area_m2': 850});
      expect(info.label, 'Trung bình');
      expect(info.areaDisplay, '850 m²');
      expect(info.confidence, isNull);
      expect(info.verifiedDateDisplay, isNull);
      expect(HazardInfo.fromProperties({}).label, 'Thấp');
    });

    test('bounds cover every polygon and are null for an empty collection', () {
      final b = hazardBounds(_collection)!;
      expect(b.south, 21.86);
      expect(b.north, 22.344);
      expect(b.west, 103.82);
      expect(b.east, 104.116);
      expect(hazardBounds({'type': 'FeatureCollection', 'features': []}), isNull);
    });
  });

  group('Map config and data', () {
    test('without a MapTiler key it falls back to the free style and has no satellite', () {
      expect(AppEnv.topoStyleUrl(''), contains('openfreemap'));
      expect(AppEnv.satelliteStyleUrl(''), isNull);
    });

    test('with a key it uses the same MapTiler styles as the web', () {
      expect(AppEnv.topoStyleUrl('K'), 'https://api.maptiler.com/maps/topo-v2/style.json?key=K');
      expect(AppEnv.satelliteStyleUrl('K'), 'https://api.maptiler.com/maps/satellite/style.json?key=K');
    });

    test('repository returns the GeoJSON collection from the active-hazards endpoint', () async {
      late http.Request sent;
      final repo = HazardRepository(
        apiClient: ApiClient(
          client: MockClient((r) async {
            sent = r;
            return http.Response(jsonEncode(_collection), 200, headers: {'content-type': 'application/json'});
          }),
          baseUrl: 'http://test',
        ),
      );
      final data = await repo.fetchActiveHazards();
      expect(sent.url.path, '/api/v1/landslides/active');
      expect((data['features'] as List).length, 2);
    });
  });
}

void markerTests() {
  group('Hazard markers (Story 5.9)', () {
    test('each area becomes one point at the centre of its box and keeps its properties', () {
      final markers = hazardMarkers(_collection);
      final features = markers['features'] as List;
      expect(features.length, 2);
      final first = features.first as Map;
      expect(first['geometry']['type'], 'Point');
      expect((first['geometry']['coordinates'] as List)[0], closeTo(104.113, 1e-9));
      expect((first['geometry']['coordinates'] as List)[1], closeTo(21.8635, 1e-9));
      expect(first['properties']['risk_level'], 'extreme');
    });

    test('empty or coordinate-less input gives no markers', () {
      expect((hazardMarkers({'features': []})['features'] as List), isEmpty);
      expect((hazardMarkers({'features': [{'type': 'Feature', 'geometry': null, 'properties': {}}]})['features'] as List), isEmpty);
    });
  });
}
