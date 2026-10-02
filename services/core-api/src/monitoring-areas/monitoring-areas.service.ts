import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class MonitoringAreasService {
  constructor(private readonly db: DatabaseService) {}

  async listAreas() {
    const query = `
      SELECT 
        area_id, 
        name, 
        description, 
        is_active, 
        ST_AsGeoJSON(geom)::jsonb as geometry,
        created_at
      FROM monitoring_areas
      ORDER BY area_id ASC;
    `;
    const result = await this.db.query(query);
    return result.rows;
  }

  async createArea(name: string, description: string, geojson: any) {
    const query = `
      INSERT INTO monitoring_areas (name, description, geom)
      VALUES ($1, $2, ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON($3), 4326)))
      RETURNING area_id, name, description, is_active, created_at;
    `;
    const result = await this.db.query(query, [name, description, JSON.stringify(geojson)]);
    return result.rows[0];
  }
}
