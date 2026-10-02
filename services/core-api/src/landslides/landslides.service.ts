import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class LandslidesService {
  constructor(private readonly db: DatabaseService) {}

  // FR3.1: Hàng đợi thẩm định (Verification Queue)
  async getVerificationQueue() {
    const query = `
      SELECT 
        event_id,
        detection_date,
        risk_level,
        status,
        confidence_score,
        slope_degrees,
        ndvi_drop,
        affected_area_m2,
        satellite_scene_id,
        ST_AsGeoJSON(geom)::jsonb as geometry,
        ST_AsGeoJSON(centroid)::jsonb as centroid
      FROM landslide_events
      WHERE status = 'pending'
      ORDER BY confidence_score DESC, detection_date DESC;
    `;
    const result = await this.db.query(query);
    return result.rows;
  }

  // FR3.2 & UC04: Cán bộ phê duyệt / Bác bỏ
  async verifyEvent(eventId: string, officerId: string, status: string, riskLevel?: string, officerNote?: string) {
    const query = `
      UPDATE landslide_events
      SET 
        status = $1,
        risk_level = COALESCE($2, risk_level),
        officer_note = $3,
        verified_by = $4,
        verified_at = CURRENT_TIMESTAMP
      WHERE event_id = $5
      RETURNING 
        event_id,
        status,
        risk_level,
        affected_area_m2,
        verified_at;
    `;
    const result = await this.db.query(query, [status, riskLevel || null, officerNote, officerId, eventId]);
    if (result.rowCount === 0) {
      throw new NotFoundException(`Landslide event ${eventId} not found`);
    }
    return result.rows[0];
  }

  // UC05: Bản đồ WebGIS các điểm đã thẩm định
  async getActiveVerifiedEvents() {
    const query = `
      SELECT jsonb_build_object(
        'type', 'FeatureCollection',
        'features', COALESCE(jsonb_agg(
          jsonb_build_object(
            'type', 'Feature',
            'id', event_id,
            'geometry', ST_AsGeoJSON(geom)::jsonb,
            'properties', jsonb_build_object(
              'event_id', event_id,
              'risk_level', risk_level,
              'confidence', confidence_score,
              'area_m2', affected_area_m2,
              'slope', slope_degrees,
              'verified_at', verified_at,
              'scene_id', satellite_scene_id
            )
          )
        ), '[]'::jsonb)
      ) as geojson
      FROM landslide_events
      WHERE status = 'verified';
    `;
    const result = await this.db.query(query);
    return result.rows[0]?.geojson || { type: 'FeatureCollection', features: [] };
  }

  // UC08 & Phần 4.4: Truy vấn Geofencing (500m)
  async queryGeofence(lon: number, lat: number, radiusMeters: number = 500) {
    const query = `
      SELECT 
        event_id, 
        risk_level,
        affected_area_m2,
        ST_Distance(geom::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) as distance_meters
      FROM landslide_events 
      WHERE ST_DWithin(
          geom::geography, 
          ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, 
          $3
      ) AND status = 'verified'
      ORDER BY distance_meters ASC;
    `;
    const result = await this.db.query(query, [lon, lat, radiusMeters]);
    return result.rows;
  }

  // UC08 & Phần 4.4: Xuất dữ liệu đồng bộ Offline (GeoJSON)
  async exportOfflineSync() {
    const query = `
      SELECT jsonb_build_object(
          'type', 'FeatureCollection',
          'features', COALESCE(jsonb_agg(
            jsonb_build_object(
              'type', 'Feature',
              'id', t.event_id,
              'geometry', ST_AsGeoJSON(t.geom)::jsonb,
              'properties', jsonb_build_object(
                'event_id', t.event_id,
                'risk_level', t.risk_level
              )
            )
          ), '[]'::jsonb)
      ) as geojson
      FROM (SELECT event_id, risk_level, geom FROM landslide_events WHERE status = 'verified') AS t;
    `;
    const result = await this.db.query(query);
    return result.rows[0]?.geojson || { type: 'FeatureCollection', features: [] };
  }
}
