/**
 * Danh mục các khu vực miền núi trọng điểm & góc nhìn toàn cảnh (Story 1.3, AC 1.3.1)
 * Tọa độ theo chuẩn MapLibre GL JS: [longitude, latitude] (R7)
 */

export const DEFAULT_LOCATION_ID = 'vietnam';

export const MOUNTAIN_LOCATIONS = [
  {
    id: 'vietnam',
    name: 'Toàn Việt Nam',
    center: [106.0, 16.0],
    lng: 106.0,
    lat: 16.0,
    zoom: 5.2,
    pitch: 35,
    bearing: 0,
    description: 'Toàn cảnh lãnh thổ và hệ thống cảnh báo sạt lở quốc gia'
  },
  {
    id: 'lao-cai',
    name: 'Lào Cai',
    center: [103.97, 22.48],
    lng: 103.97,
    lat: 22.48,
    zoom: 9.8,
    pitch: 60,
    bearing: 25,
    description: 'Khu vực dãy Hoàng Liên Sơn, Sa Pa, Bát Xát - nguy cơ trượt lở sườn dốc cao'
  },
  {
    id: 'ha-giang',
    name: 'Hà Giang',
    center: [104.98, 22.82],
    lng: 104.98,
    lat: 22.82,
    zoom: 9.6,
    pitch: 58,
    bearing: -15,
    description: 'Vùng cao nguyên đá karst, sườn hẻm vực dốc đứng'
  },
  {
    id: 'yen-bai',
    name: 'Yên Bái',
    center: [104.60, 21.70],
    lng: 104.60,
    lat: 21.70,
    zoom: 9.6,
    pitch: 58,
    bearing: 30,
    description: 'Khu vực Mù Cang Chải, Trạm Tấu - sườn dốc địa hình đồi núi dốc đứng'
  },
  {
    id: 'son-la',
    name: 'Sơn La',
    center: [103.91, 21.32],
    lng: 103.91,
    lat: 21.32,
    zoom: 9.5,
    pitch: 56,
    bearing: 15,
    description: 'Lưu vực sông Đà, vùng đồi núi Mường La, Mộc Châu'
  },
  {
    id: 'dien-bien',
    name: 'Điện Biên',
    center: [103.02, 21.39],
    lng: 103.02,
    lat: 21.39,
    zoom: 9.6,
    pitch: 58,
    bearing: -20,
    description: 'Địa hình lòng chảo và các dãy núi hiểm trở giáp biên giới'
  },
  {
    id: 'cao-bang',
    name: 'Cao Bằng',
    center: [106.26, 22.67],
    lng: 106.26,
    lat: 22.67,
    zoom: 9.6,
    pitch: 56,
    bearing: 10,
    description: 'Vùng đồi núi đá vôi, thung lũng sông Quây Sơn và sườn dốc phong hóa'
  },
  {
    id: 'lai-chau',
    name: 'Lai Châu',
    center: [103.46, 22.40],
    lng: 103.46,
    lat: 22.40,
    zoom: 9.6,
    pitch: 62,
    bearing: 35,
    description: 'Vùng núi cao chia cắt mạnh, Mường Tè, Phong Thổ, Tam Đường'
  }
];

/**
 * Lấy thông tin cấu hình khu vực theo ID
 * @param {string} id - ID định danh khu vực
 * @returns {object|undefined} Đối tượng cấu hình khu vực
 */
export function getLocationById(id) {
  return MOUNTAIN_LOCATIONS.find(loc => loc.id === id);
}
