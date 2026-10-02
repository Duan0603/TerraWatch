import { Controller, Get, Post, Patch, Param, Body, Query } from '@nestjs/common';
import { LandslidesService } from './landslides.service';

class VerifyLandslideDto {
  status: 'verified' | 'rejected' | 'false_alarm';
  risk_level?: 'low' | 'medium' | 'high' | 'extreme';
  officer_note?: string;
  officer_id?: string;
}

@Controller('api/v1/landslides')
export class LandslidesController {
  constructor(private readonly landslidesService: LandslidesService) {}

  @Get('queue')
  async getQueue() {
    return this.landslidesService.getVerificationQueue();
  }

  @Patch(':id/verify')
  async verifyEvent(
    @Param('id') eventId: string,
    @Body() dto: VerifyLandslideDto
  ) {
    const officerId = dto.officer_id || '22222222-2222-2222-2222-222222222222';
    return this.landslidesService.verifyEvent(eventId, officerId, dto.status, dto.risk_level, dto.officer_note);
  }

  @Get('active')
  async getActive() {
    return this.landslidesService.getActiveVerifiedEvents();
  }

  @Get('geofence')
  async getGeofence(
    @Query('lon') lon: string,
    @Query('lat') lat: string,
    @Query('radius') radius?: string
  ) {
    const radiusMeters = radius ? parseFloat(radius) : 500;
    return this.landslidesService.queryGeofence(parseFloat(lon), parseFloat(lat), radiusMeters);
  }

  @Get('offline-sync')
  async getOfflineSync() {
    return this.landslidesService.exportOfflineSync();
  }
}
