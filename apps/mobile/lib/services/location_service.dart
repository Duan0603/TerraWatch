import 'package:geolocator/geolocator.dart';

/// Quản lý quyền và lấy tọa độ GPS của thiết bị
class LocationService {
  LocationService._();

  /// Kiểm tra và yêu cầu cấp quyền định vị
  static Future<bool> checkAndRequestPermission() async {
    bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      return false;
    }

    LocationPermission permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied) {
        return false;
      }
    }

    if (permission == LocationPermission.deniedForever) {
      return false;
    }

    return true;
  }

  /// Lấy tọa độ GPS hiện tại
  static Future<Position?> getCurrentLocation() async {
    final hasPermission = await checkAndRequestPermission();
    if (!hasPermission) return null;

    return await Geolocator.getCurrentPosition(
      desiredAccuracy: LocationAccuracy.high,
    );
  }

  /// Luồng cập nhật vị trí thời gian thực phục vụ Geofencing chạy ngầm
  static Stream<Position> getPositionStream({int intervalSeconds = 10}) {
    return Geolocator.getPositionStream(
      locationSettings: LocationSettings(
        accuracy: LocationAccuracy.high,
        distanceFilter: 10,
        timeLimit: Duration(seconds: intervalSeconds),
      ),
    );
  }
}
