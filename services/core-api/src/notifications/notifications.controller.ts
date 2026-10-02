import { Controller, Post, Body } from '@nestjs/common';
import { NotificationsService } from './notifications.service';

class BroadcastAlertDto {
  event_id: string;
  risk_level: string;
  message?: string;
  target_area?: string;
}

@Controller('api/v1/notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('broadcast')
  async broadcast(@Body() dto: BroadcastAlertDto) {
    return this.notificationsService.broadcastAlert(dto.event_id, dto.risk_level, dto.message, dto.target_area);
  }
}
