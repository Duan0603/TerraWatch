import { useState, useEffect, useCallback, useRef } from 'react';
import forecastApi, { apiErrorMessage } from '../api/forecastApi';
import broadcastApi from '../api/broadcastApi';
import landslideApi from '../api/landslideApi';
import { toConfirmedCollection } from '../utils/confirmedLandslides';
import { API_BASE_URL } from '../api/axiosClient';
import { connectLiveUpdates } from '../api/liveUpdates';
import { takePrefetched } from '../preload/warmUp';

const REFRESH_MS = 60000; // làm mới để trạng thái "hết hạn" luôn đúng
const CONFIRMED_MS = 5 * 60000; // sạt lở đã xác nhận hiếm khi đổi: không cần hỏi mỗi phút

/** Story 4.36: mọi dữ liệu của dashboard (tải, làm mới 60 s, luồng cập nhật tức thì) gom ở một chỗ; trang chỉ lo giao diện. */
export function useDashboardData(isAdmin) {
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [fieldReports, setFieldReports] = useState([]);
  const [aoi, setAoi] = useState(null);
  const [broadcasts, setBroadcasts] = useState(null); // chỉ admin xem được lịch sử phát lệnh
  const [reviewMetrics, setReviewMetrics] = useState(null);
  const [confirmed, setConfirmed] = useState(null); // sạt lở đã xác nhận (GeoJSON), lớp bản đồ phụ
  const [experimentalRisk, setExperimentalRisk] = useState(null); // điểm GRU thử nghiệm (GeoJSON), chỉ cán bộ
  const [lastLoadedAt, setLastLoadedAt] = useState(null); // thời điểm tải dữ liệu thành công gần nhất
  const [liveConnected, setLiveConnected] = useState(false);
  const confirmedAt = useRef(0); // lần tải thành công gần nhất

  const loadEvents = useCallback(async () => {
    // Số liệu phụ của dải KPI: lỗi ở đây không được làm hỏng hàng đợi.
    takePrefetched('fieldReports', () => forecastApi.getFieldReports()).then(setFieldReports).catch(() => {});
    if (Date.now() - confirmedAt.current > CONFIRMED_MS) {
      // Lỗi tạm thời thì giữ dữ liệu cũ (lớp không biến mất); dữ liệu y hệt thì giữ nguyên đối tượng để bản đồ không vẽ lại.
      landslideApi.getConfirmed().then(d => {
        confirmedAt.current = Date.now();
        const next = toConfirmedCollection(d);
        setConfirmed(prev => (prev && JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
      }).catch(() => {});
    }
    // GIS chỉ cập nhật mỗi giờ; lỗi tạm thời giữ lớp cũ (mỗi điểm tự mang cờ current/stale).
    landslideApi.getExperimentalRisk()
      .then(next => setExperimentalRisk(prev => (prev && JSON.stringify(prev.features) === JSON.stringify(next.features) ? prev : next)))
      .catch(() => {});
    forecastApi.getReviewMetrics(7).then(setReviewMetrics).catch(() => setReviewMetrics(null));
    if (isAdmin) broadcastApi.getBroadcastHistory().then(setBroadcasts).catch(() => setBroadcasts(null));
    try {
      // Lần đầu sau đăng nhập: dùng kết quả đã tải sẵn ở trang login (Story 4.22), không có thì gọi thật.
      const data = await takePrefetched('queue', () => forecastApi.getReviewQueue('all'));
      setEvents(data);
      setLoadError(null);
      setLastLoadedAt(new Date());
      setSelectedEventId(prev => (data.some(e => e.id === prev) ? prev : data[0]?.id ?? null));
    } catch (err) {
      setLoadError(apiErrorMessage(err, 'Không tải được hàng đợi dự báo'));
    }
  }, [isAdmin]);

  useEffect(() => {
    loadEvents();
    const timer = setInterval(loadEvents, REFRESH_MS);
    return () => clearInterval(timer);
  }, [loadEvents]);

  // Story 4.35: máy chủ báo có thay đổi -> tải lại ngay (gom các tin dồn dập). Vòng 60 giây ở trên vẫn là phương án dự phòng.
  useEffect(() => {
    let debounce = null;
    const stop = connectLiveUpdates({
      url: `${API_BASE_URL}/api/v1/stream`,
      getToken: () => localStorage.getItem('terrawatch_token'),
      onStatus: setLiveConnected,
      onUpdate: () => {
        clearTimeout(debounce);
        debounce = setTimeout(loadEvents, 400);
      }
    });
    return () => { clearTimeout(debounce); stop(); };
  }, [loadEvents]);

  // Lớp bản đồ phụ: lỗi ở đây không chặn hàng đợi duyệt.
  const refreshAoi = useCallback(() => forecastApi.getAoiCollection().then(setAoi).catch(() => setAoi(null)), []);
  useEffect(() => {
    takePrefetched('aoi', () => forecastApi.getAoiCollection()).then(setAoi).catch(() => setAoi(null));
  }, []);

  return {
    events, selectedEventId, setSelectedEventId, loadError, fieldReports, aoi, broadcasts,
    reviewMetrics, confirmed, experimentalRisk, lastLoadedAt, liveConnected, loadEvents, refreshAoi
  };
}
