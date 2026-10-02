import { Module } from '@nestjs/common';
import { DatabaseService } from './database/database.service';
import { LandslidesService } from './landslides/landslides.service';
import { LandslidesController } from './landslides/landslides.controller';
import { MonitoringAreasService } from './monitoring-areas/monitoring-areas.service';
import { MonitoringAreasController } from './monitoring-areas/monitoring-areas.controller';
import { CommunityReportsService } from './community-reports/community-reports.service';
import { CommunityReportsController } from './community-reports/community-reports.controller';
import { NotificationsService } from './notifications/notifications.service';
import { NotificationsController } from './notifications/notifications.controller';

@Module({
  imports: [],
  controllers: [
    LandslidesController,
    MonitoringAreasController,
    CommunityReportsController,
    NotificationsController
  ],
  providers: [
    DatabaseService,
    LandslidesService,
    MonitoringAreasService,
    CommunityReportsService,
    NotificationsService
  ],
})
export class AppModule {}
