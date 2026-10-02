import { Controller, Get, Post, Body } from '@nestjs/common';
import { CommunityReportsService } from './community-reports.service';

class SubmitReportDto {
  user_id?: string;
  longitude: number;
  latitude: number;
  image_url?: string;
  description: string;
}

@Controller('api/v1/community-reports')
export class CommunityReportsController {
  constructor(private readonly reportsService: CommunityReportsService) {}

  @Get()
  async list() {
    return this.reportsService.listReports();
  }

  @Post()
  async submit(@Body() dto: SubmitReportDto) {
    const userId = dto.user_id || '33333333-3333-3333-3333-333333333333';
    return this.reportsService.submitReport(userId, dto.longitude, dto.latitude, dto.image_url, dto.description);
  }
}
