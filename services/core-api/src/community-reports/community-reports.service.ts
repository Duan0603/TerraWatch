import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class CommunityReportsService {
  constructor(private readonly db: DatabaseService) {}

  async submitReport(userId: string, lon: number, lat: number, imageUrl: string, description: string) {
    const query = `
      INSERT INTO community_reports (user_id, location, image_url, description, status)
      VALUES ($1, ST_SetSRID(ST_MakePoint($2, $3), 4326), $4, $5, 'submitted')
      RETURNING report_id, user_id, report_time, image_url, description, status;
    `;
    const result = await this.db.query(query, [userId, lon, lat, imageUrl, description]);
    return result.rows[0];
  }

  async listReports() {
    const query = `
      SELECT 
        r.report_id,
        r.report_time,
        r.image_url,
        r.description,
        r.status,
        ST_X(r.location) as longitude,
        ST_Y(r.location) as latitude,
        u.full_name as submitter_name
      FROM community_reports r
      LEFT JOIN users u ON r.user_id = u.user_id
      ORDER BY r.report_time DESC;
    `;
    const result = await this.db.query(query);
    return result.rows;
  }
}
