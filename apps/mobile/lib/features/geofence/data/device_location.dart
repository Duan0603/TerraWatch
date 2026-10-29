import 'package:geolocator/geolocator.dart';
import '../../../core/network/api_exceptions.dart';

typedef DevicePosition = ({double latitude, double longitude});

/// Vị trí GPS cũ hơn mức này thì không dùng làm vị trí hiện tại
const _maxLastKnownAge = Duration(minutes: 10);

/// Đọc vị trí hiện tại sau khi người dùng chủ động bấm. GPS không cần mạng; trong nhà hoặc bật chế độ máy bay
/// thì lấy vị trí đã biết gần đây (tối đa 10 phút). Không lấy được thì ném [ApiException] kèm lời nhắc.
Future<DevicePosition> currentPosition() async {
  var permission = await Geolocator.checkPermission();
  if (permission == LocationPermission.denied) permission = await Geolocator.requestPermission();
  if (permission == LocationPermission.denied || permission == LocationPermission.deniedForever) {
    throw const ApiException(message: 'Cần cấp quyền vị trí để kiểm tra vùng cảnh báo');
  }
  try {
    final p = await Geolocator.getCurrentPosition(timeLimit: const Duration(seconds: 30));
    return (latitude: p.latitude, longitude: p.longitude);
  } catch (_) {
    final last = await Geolocator.getLastKnownPosition();
    if (last != null && DateTime.now().difference(last.timestamp) <= _maxLastKnownAge) {
      return (latitude: last.latitude, longitude: last.longitude);
    }
    throw const ApiException(message: 'Không lấy được vị trí hiện tại. Hãy bật GPS và thử lại');
  }
}

/// Luồng vị trí khi bật theo dõi; ít nhất 25 m mới phát một điểm mới. Vị trí chỉ xử lý trên máy.
Stream<DevicePosition> positionUpdates() => Geolocator.getPositionStream(
      locationSettings: const LocationSettings(accuracy: LocationAccuracy.high, distanceFilter: 25),
    ).map((p) => (latitude: p.latitude, longitude: p.longitude));
