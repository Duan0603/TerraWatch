import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  async broadcastAlert(eventId: string, riskLevel: string, message: string, targetArea?: string) {
    this.logger.log(`[ALERT BROADCAST] Event: ${eventId}, Risk: ${riskLevel}, Area: ${targetArea || 'Affected Zone'}`);
    
    // Simulate FCM Cloud Messaging & Cell Broadcast
    const dispatchDetails = {
      event_id: eventId,
      risk_level: riskLevel,
      channels: ['FCM_PUSH', 'SMS_BROADCAST', 'WEB_SOCKET'],
      timestamp: new Date().toISOString(),
      recipients_estimated: 1250,
      status: 'DISPATCHED',
      payload: {
        title: `CẢNH BÁO SẠT LỞ ĐẤT (${riskLevel.toUpperCase()})`,
        body: message || 'Phát hiện nguy cơ sạt lở đất nghiêm trọng trong khu vực của bạn. Vui lòng di chuyển đến nơi an toàn!',
      }
    };

    return dispatchDetails;
  }
}
