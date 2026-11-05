import axiosClient from './axiosClient';

// Core API forecast contract (Stories 4.2/4.3). Không có dữ liệu giả: lỗi mạng được ném ra để UI hiển thị.

const ERROR_BY_STATUS = {
  400: 'Yêu cầu không hợp lệ (cần nhập lý do khi từ chối).',
  401: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
  403: 'Tài khoản không có quyền thẩm định dự báo.',
  404: 'Không tìm thấy dự báo này.',
  409: 'Dự báo đã được xử lý, đã hết hạn hoặc đã bị thay thế bởi bản mới. Hãy tải lại danh sách.'
};

export const apiErrorMessage = (err, fallback) =>
  ERROR_BY_STATUS[err.response?.status] || `${fallback} (${err.message})`;

// Chuyển một ForecastReviewItem của backend sang mô hình hiển thị dùng chung cho hàng đợi, bản đồ và panel bằng chứng.
export const toForecastView = (item) => {
  const { unit } = item;
  const ring = unit.geometry?.type === 'Polygon' ? unit.geometry.coordinates[0] : null;
  const unavailable = item.availability !== 'available';
  return {
    id: item.runId,
    unit,
    location: unit.name || [unit.commune, unit.district, unit.province].filter(Boolean).join(', '),
    lng: unit.centroidLng,
    lat: unit.centroidLat,
    polygon: ring,
    risk: unavailable ? 'unavailable' : item.hazardLevel,
    status: item.reviewStatus, // pending | approved | rejected | superseded
    expired: item.expired,
    availability: item.availability,
    unavailabilityReason: item.unavailabilityReason,
    probability: item.probability,
    issuedAt: item.issuedAt,
    validFrom: item.validFrom,
    validUntil: item.validUntil,
    horizonHours: item.horizonHours,
    modelVersion: item.modelVersion,
    factors: item.contributingFactors,
    quality: item.inputQuality,
    observedRain: item.observedRain,
    forecastRain: item.forecastRain,
    priorRuns: item.priorRuns
  };
};

export const forecastApi = {
  // status: pending | approved | rejected | all
  async getReviewQueue(status = 'pending') {
    const items = await axiosClient.get('/forecasts/review-queue', { params: { status } });
    return items.filter(i => i.unit?.centroidLng != null).map(toForecastView);
  },

  // Vùng cảnh báo đã duyệt và còn hiệu lực (mọi tài khoản đăng nhập đọc được) — dùng cho trang công dân.
  async getApprovedZones() {
    const { items } = await axiosClient.get('/forecasts/offline-sync');
    return items.filter(z => z.geometry?.type === 'Polygon').map(z => {
      const ring = z.geometry.coordinates[0];
      return {
        id: z.runId,
        location: z.unitName || z.unitId,
        lng: ring.reduce((s, p) => s + p[0], 0) / ring.length,
        lat: ring.reduce((s, p) => s + p[1], 0) / ring.length,
        polygon: ring,
        risk: z.hazardLevel,
        status: 'approved',
        expired: false,
        availability: 'available',
        probability: z.probability,
        issuedAt: z.issuedAt,
        validFrom: z.validFrom,
        validUntil: z.validUntil
      };
    });
  },

  // decision: approved | rejected. Từ chối bắt buộc có lý do (backend kiểm tra lại).
  async review(runId, decision, reasonNotes) {
    try {
      return await axiosClient.patch(`/forecasts/${runId}/review`, { decision, reasonNotes: reasonNotes || null });
    } catch (err) {
      throw new Error(apiErrorMessage(err, 'Không gửi được quyết định thẩm định'));
    }
  },

  // Báo cáo hiện trường của người dân (lớp bản đồ riêng, không phải sự cố đã xác nhận).
  async getFieldReports() {
    const rows = await axiosClient.get('/community-reports');
    return rows
      .filter(r => r.longitude != null && r.latitude != null)
      .map(r => ({ id: r.report_id, coords: [r.longitude, r.latitude], description: r.description || '', time: r.observed_at || r.report_time, status: r.status }));
  },

  // Ranh giới vùng giám sát (AOI) dạng GeoJSON FeatureCollection.
  async getAoiCollection() {
    const rows = await axiosClient.get('/monitoring-areas');
    return {
      type: 'FeatureCollection',
      features: rows.filter(a => a.is_active && a.geometry_geojson).map(a => ({
        type: 'Feature',
        properties: { name: a.name },
        geometry: JSON.parse(a.geometry_geojson)
      }))
    };
  }
};

export default forecastApi;
