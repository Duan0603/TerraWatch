import React, { useState, useEffect, useCallback } from 'react';
import { List, Map, AlertTriangle } from 'lucide-react';
import Navbar from '../components/Navbar';
import VerificationQueue from '../components/VerificationQueue';
import DetailPanel from '../components/DetailPanel';
import EmergencyAlertPrompt from '../components/EmergencyAlertPrompt';
import BroadcastModal from '../components/BroadcastModal';
import BroadcastHistoryModal from '../components/BroadcastHistoryModal';
import ReviewDialog from '../components/ReviewDialog';
import forecastApi, { apiErrorMessage } from '../api/forecastApi';
import { loadSimResults, subscribeSimResults, simResultsToEvents, clearSimResults } from '../api/simBus';
import { useAuth } from '../context/AuthContext';
import { useResponsive } from '../hooks/useResponsive';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';

const REFRESH_MS = 60000; // làm mới để trạng thái "hết hạn" luôn đúng

export default function DashboardPage() {
  const { user, role } = useAuth();
  const isAdmin = role === 'admin';
  const { isMobile } = useResponsive();

  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [alertPromptEvent, setAlertPromptEvent] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [mobileTab, setMobileTab] = useState('map');
  const [reviewTarget, setReviewTarget] = useState(null); // { event, decision }
  const [fieldReports, setFieldReports] = useState([]);
  const [aoi, setAoi] = useState(null);

  const [isBroadcastOpen, setIsBroadcastOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [broadcastTargetEvent, setBroadcastTargetEvent] = useState(null);

  // Lớp mô phỏng AI: hiện thêm trên bản đồ nhưng không đưa vào hàng đợi thẩm định
  const [simEvents, setSimEvents] = useState(() => simResultsToEvents(loadSimResults()));

  // Keyboard navigation shortcuts for emergency operations
  useKeyboardShortcuts({
    Escape: () => {
      if (isBroadcastOpen) setIsBroadcastOpen(false);
      else if (isHistoryOpen) setIsHistoryOpen(false);
      else if (alertPromptEvent) setAlertPromptEvent(null);
    },
    'Alt+m': () => setMobileTab('map'),
    'Alt+l': () => setMobileTab('list'),
  });

  const loadEvents = useCallback(async () => {
    try {
      const data = await forecastApi.getReviewQueue('all');
      setEvents(data);
      setLoadError(null);
      setSelectedEventId(prev => {
        // Initial load: pick first item. Subsequent refreshes: keep current selection
        // to prevent map from flying when queue updates after inject.
        if (prev === null) return data[0]?.id ?? null;
        return data.some(e => e.id === prev) ? prev : null;
      });
    } catch (err) {
      setLoadError(apiErrorMessage(err, 'Không tải được hàng đợi dự báo'));
    }
  }, []);

  useEffect(() => {
    loadEvents();
    const timer = setInterval(loadEvents, REFRESH_MS);
    return () => clearInterval(timer);
  }, [loadEvents]);

  // Lớp bản đồ phụ: lỗi ở đây không chặn hàng đợi duyệt.
  useEffect(() => {
    forecastApi.getFieldReports().then(setFieldReports).catch(() => setFieldReports([]));
    forecastApi.getAoiCollection().then(setAoi).catch(() => setAoi(null));
  }, []);

  const handleReviewRequest = (id, decision) => {
    const event = events.find(e => e.id === id);
    if (event) setReviewTarget({ event, decision });
  };

  const submitReview = async (reason) => {
    const { event, decision } = reviewTarget;
    try {
      await forecastApi.review(event.id, decision, reason);
    } catch (err) {
      // 409: danh sách đã cũ (hết hạn / đã duyệt / bị thay thế) -> tải lại để khớp server.
      loadEvents();
      throw err;
    }
    setReviewTarget(null);
    await loadEvents();
    if (decision === 'approved' && (event.risk === 'extreme' || event.risk === 'high')) {
      setAlertPromptEvent({ ...event, status: 'approved' }); // bản trong state là bản trước khi duyệt
    }
  };

  // Lắng nghe broadcast từ AutoSimPage (tab khác)
  useEffect(() => subscribeSimResults(
    (r) => setSimEvents(simResultsToEvents(r)),
    ()  => setSimEvents([])
  ), []);

  // Làm mới hàng đợi ngay khi LiveRainfallPanel inject thành công
  useEffect(() => {
    const handler = () => loadEvents();
    window.addEventListener('tw:queue-refresh', handler);
    return () => window.removeEventListener('tw:queue-refresh', handler);
  }, [loadEvents]);

  const selectedEvent = events.find(e => e.id === selectedEventId) || null;
  // Merge: real events cho queue, sim events chỉ hiện trên bản đồ
  const mapEvents = [...events, ...simEvents];

  // Mở form phát cảnh báo — không bao giờ tự gửi.
  const handleOpenBroadcast = (ev = null) => {
    setBroadcastTargetEvent(ev || selectedEvent);
    setIsBroadcastOpen(true);
    setAlertPromptEvent(null);
  };

  return (
    <div className="dashboard-root">
      <Navbar
        soundEnabled={soundEnabled}
        setSoundEnabled={setSoundEnabled}
        onOpenBroadcast={() => handleOpenBroadcast(selectedEvent)}
        onOpenHistory={() => setIsHistoryOpen(true)}
      />

      {loadError && (
        <div role="alert" style={{ background: '#FEF2F2', color: '#B91C1C', borderBottom: '1px solid #FECACA', padding: '8px 16px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertTriangle size={14} /> {loadError}
          <button className="btn-ghost" style={{ marginLeft: 'auto' }} onClick={loadEvents}>Thử lại</button>
        </div>
      )}

      {simEvents.length > 0 && (
        <div role="status" style={{ background: '#fffbeb', color: '#92400e', borderBottom: '1px solid #fcd34d', padding: '7px 16px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14 }}>⚡</span>
          <strong>Mô phỏng AI</strong>: đang hiển thị {simEvents.length} vùng nguy cơ mô phỏng trên bản đồ
          <span style={{ opacity: .6, marginLeft: 4 }}>(không phải dữ liệu thực)</span>
          <button className="btn-ghost" style={{ marginLeft: 'auto', fontSize: 12, color: '#92400e' }}
            onClick={() => { clearSimResults(); setSimEvents([]); }}>
            ✕ Xóa lớp mô phỏng
          </button>
        </div>
      )}

      <div className="main-layout">
        <VerificationQueue
          events={events}
          selectedEventId={selectedEventId}
          onSelectEvent={(id) => { setSelectedEventId(id); setMobileTab('map'); }}
          onReviewEvent={handleReviewRequest}
          onRefresh={loadEvents}
          className={mobileTab === 'map' ? 'mobile-hidden' : ''}
        />

        <DetailPanel
          selectedEvent={selectedEvent}
          events={mapEvents}
          onSelectEvent={setSelectedEventId}
          fieldReports={fieldReports}
          aoi={aoi}
          className={mobileTab === 'list' ? 'mobile-hidden' : ''}
        />
      </div>

      {/* Mobile Bottom Tab Bar */}
      <nav className="mobile-tab-bar" role="tablist" aria-label="Điều hướng giao diện di động">
        <button
          role="tab"
          aria-selected={mobileTab === 'list'}
          className={`mobile-tab-btn${mobileTab === 'list' ? ' active' : ''}`}
          onClick={() => setMobileTab('list')}
        >
          <List size={20} aria-hidden="true" />
          <span>Danh sách</span>
        </button>
        <button
          role="tab"
          aria-selected={mobileTab === 'map'}
          className={`mobile-tab-btn${mobileTab === 'map' ? ' active' : ''}`}
          onClick={() => setMobileTab('map')}
        >
          <Map size={20} aria-hidden="true" />
          <span>Bản đồ</span>
        </button>
      </nav>

      <ReviewDialog target={reviewTarget} onCancel={() => setReviewTarget(null)} onSubmit={submitReview} />

      <EmergencyAlertPrompt
        event={alertPromptEvent}
        isAdmin={isAdmin}
        onClose={() => setAlertPromptEvent(null)}
        onOpenBroadcast={handleOpenBroadcast}
      />

      <BroadcastModal
        isOpen={isBroadcastOpen}
        onClose={() => setIsBroadcastOpen(false)}
        event={broadcastTargetEvent}
        currentUser={user}
      />

      <BroadcastHistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        onOpenNewBroadcast={() => handleOpenBroadcast(selectedEvent)}
      />
    </div>
  );
}
