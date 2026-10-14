export const INITIAL_EVENTS = [
  {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    location: 'Mù Cang Chải (Yên Bái) - Sườn Đèo Khau Phạ',
    coords: '104.085°E, 21.845°N',
    lng: 104.085,
    lat: 21.845,
    risk: 'high',
    status: 'pending',
    confidence: 0.89,
    slope: 37.2,
    ndviDrop: -0.48,
    areaM2: 1850,
    detectedAt: '2026-10-14 06:15:00 UTC',
    satelliteScene: 'Sentinel-2A L2A (10m Multi-spectral)',
    estPopulation: 120,
    mapX: 42,
    mapY: 55,
    geology: 'Đất đá phong hóa nứt nẻ, ta-luy dương cao sườn đèo',
    aoiName: 'Vùng giám sát trọng điểm YB-01 (Mù Cang Chải)',
    soilMoisture: '84.2%',
    forecastWindow: {
      issuedAt: '2026-10-14 06:00:00 UTC',
      validUntil: '2026-10-15 06:00:00 UTC',
      status: 'fresh' // fresh | stale | expired
    },
    rainfall24h: {
      observedTotal: 186.5, // mm
      forecastTotal: 124.0, // mm
      threshold: 150.0,
      hourly: [
        { hour: '06h', observed: 12, forecast: 10 },
        { hour: '10h', observed: 28, forecast: 18 },
        { hour: '14h', observed: 55, forecast: 32 },
        { hour: '18h', observed: 48, forecast: 25 },
        { hour: '22h', observed: 25, forecast: 22 },
        { hour: '02h', observed: 18, forecast: 17 }
      ]
    },
    // Đa giác GeoJSON sạt lở
    polygon: [
      [104.082, 21.842],
      [104.088, 21.843],
      [104.089, 21.848],
      [104.084, 21.847],
      [104.082, 21.842]
    ]
  },
  {
    id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    location: 'Quốc Lộ 32 - Bản Dế Xu Phình',
    coords: '104.110°E, 21.860°N',
    lng: 104.110,
    lat: 21.860,
    risk: 'extreme',
    status: 'pending',
    confidence: 0.96,
    slope: 43.5,
    ndviDrop: -0.62,
    areaM2: 3400,
    detectedAt: '2026-10-14 05:40:00 UTC',
    satelliteScene: 'Sentinel-2B L2A (10m Multi-spectral)',
    estPopulation: 350,
    mapX: 48,
    mapY: 48,
    geology: 'Sạt trượt khối lớn đất đá bão hòa nước chia cắt QL32',
    aoiName: 'Vùng giám sát trọng điểm YB-02 (Dế Xu Phình)',
    soilMoisture: '93.8%',
    forecastWindow: {
      issuedAt: '2026-10-14 06:00:00 UTC',
      validUntil: '2026-10-15 06:00:00 UTC',
      status: 'fresh'
    },
    rainfall24h: {
      observedTotal: 242.0,
      forecastTotal: 165.0,
      threshold: 150.0,
      hourly: [
        { hour: '06h', observed: 18, forecast: 15 },
        { hour: '10h', observed: 42, forecast: 28 },
        { hour: '14h', observed: 75, forecast: 45 },
        { hour: '18h', observed: 60, forecast: 38 },
        { hour: '22h', observed: 30, forecast: 24 },
        { hour: '02h', observed: 17, forecast: 15 }
      ]
    },
    polygon: [
      [104.106, 21.856],
      [104.114, 21.857],
      [104.116, 21.864],
      [104.108, 21.863],
      [104.106, 21.856]
    ]
  },
  {
    id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
    location: 'Huyện Bắc Hà (Lào Cai) - Xã Nậm Khánh',
    coords: '104.280°E, 22.510°N',
    lng: 104.280,
    lat: 22.510,
    risk: 'medium',
    status: 'verified',
    confidence: 0.74,
    slope: 28.0,
    ndviDrop: -0.31,
    areaM2: 920,
    detectedAt: '2026-10-13 14:20:00 UTC',
    satelliteScene: 'Sentinel-2A L2A (10m Multi-spectral)',
    estPopulation: 45,
    mapX: 62,
    mapY: 35,
    geology: 'Trượt lở đất tầng nông cục bộ taluy đường liên xã',
    aoiName: 'Vùng giám sát LC-01 (Bắc Hà)',
    soilMoisture: '71.5%',
    forecastWindow: {
      issuedAt: '2026-10-13 12:00:00 UTC',
      validUntil: '2026-10-14 12:00:00 UTC',
      status: 'stale'
    },
    rainfall24h: {
      observedTotal: 92.0,
      forecastTotal: 65.0,
      threshold: 120.0,
      hourly: [
        { hour: '06h', observed: 8, forecast: 10 },
        { hour: '10h', observed: 14, forecast: 12 },
        { hour: '14h', observed: 25, forecast: 18 },
        { hour: '18h', observed: 22, forecast: 14 },
        { hour: '22h', observed: 13, forecast: 8 },
        { hour: '02h', observed: 10, forecast: 3 }
      ]
    },
    polygon: [
      [104.276, 22.507],
      [104.284, 22.508],
      [104.285, 22.513],
      [104.278, 22.512],
      [104.276, 22.507]
    ]
  },
  {
    id: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
    location: 'Bảo Yên (Lào Cai) - Thung lũng Làng Nủ',
    coords: '104.420°E, 22.350°N',
    lng: 104.420,
    lat: 22.350,
    risk: 'extreme',
    status: 'pending',
    confidence: 0.98,
    slope: 46.2,
    ndviDrop: -0.75,
    areaM2: 8500,
    detectedAt: '2026-10-14 04:00:10 UTC',
    satelliteScene: 'Sentinel-2B L2A (10m Multi-spectral)',
    estPopulation: 520,
    mapX: 70,
    mapY: 40,
    geology: 'Lũ bùn đá quét diện rộng cuốn trôi sườn đồi núi Con Voi',
    aoiName: 'Vùng giám sát khẩn cấp LC-02 (Làng Nủ, Bảo Yên)',
    soilMoisture: '97.2%',
    forecastWindow: {
      issuedAt: '2026-10-14 06:00:00 UTC',
      validUntil: '2026-10-15 06:00:00 UTC',
      status: 'fresh'
    },
    rainfall24h: {
      observedTotal: 310.5,
      forecastTotal: 198.0,
      threshold: 150.0,
      hourly: [
        { hour: '06h', observed: 25, forecast: 20 },
        { hour: '10h', observed: 65, forecast: 42 },
        { hour: '14h', observed: 98, forecast: 55 },
        { hour: '18h', observed: 72, forecast: 45 },
        { hour: '22h', observed: 32, forecast: 24 },
        { hour: '02h', observed: 18, forecast: 12 }
      ]
    },
    polygon: [
      [104.414, 22.344],
      [104.426, 22.346],
      [104.428, 22.356],
      [104.418, 22.355],
      [104.414, 22.344]
    ]
  }
];

// Danh sách các điểm báo cáo hiện trường từ người dân (community_reports)
export const COMMUNITY_REPORTS = [
  {
    id: 'report-01',
    reporterName: 'Anh Lò Văn Dũng (Bản Dế Xu Phình)',
    coords: [104.108, 21.859],
    description: 'Vết nứt rộng 30cm kéo dài 50m trên ta-luy dương, nước bùn đục bắt đầu chảy mạnh',
    time: '2026-10-14 05:20 UTC',
    photoUrl: '/assets/sample-field-crack.jpg'
  },
  {
    id: 'report-02',
    reporterName: 'Đ/c Ma Seo Phố (Trưởng thôn Làng Nủ)',
    coords: [104.419, 22.348],
    description: 'Tiếng nổ lớn trên đỉnh đồi Con Voi, sườn núi rung lắc dữ dội',
    time: '2026-10-14 03:45 UTC',
    photoUrl: '/assets/sample-field-mudflow.jpg'
  }
];

export default INITIAL_EVENTS;
