/// Định nghĩa toàn bộ Endpoints gọi tới API Gateway Nginx (Port 8080)
class ApiEndpoints {
  ApiEndpoints._();

  // Auth & User Profile
  static const String login = '/api/v1/auth/login';
  static const String register = '/api/v1/auth/register';
  static const String me = '/api/v1/auth/me';

  // Landslide Hazards & Offline Sync (Story 5.3)
  static const String landslidesActive = '/api/v1/landslides/active';
  static const String landslidesOfflineSync = '/api/v1/landslides/offline-sync';
  static const String landslidesGeofence = '/api/v1/landslides/geofence';

  // Alerts & Notifications (Story 5.1 & FR4)
  static const String alertSubscriptions = '/api/v1/alerts/subscriptions';
  static const String deviceRegister = '/api/v1/alerts/devices/register';
  static const String notificationsBroadcast = '/api/v1/notifications/broadcast';

  // Community Reports (Story 5.2 - Crowdsourcing)
  static const String communityReports = '/api/v1/community-reports';
}
