import React, { useState, useEffect, useCallback } from 'react';
import { List, Map, AlertTriangle } from 'lucide-react';
import Navbar from '../components/Navbar';
import VerificationQueue from '../components/VerificationQueue';
import DetailPanel from '../components/DetailPanel';
import EmergencyAlertPrompt from '../components/EmergencyAlertPrompt';
import BroadcastModal from '../components/BroadcastModal';
import BroadcastHistoryModal from '../components/BroadcastHistoryModal';
import ReviewAuditModal from '../components/ReviewAuditModal';
import FieldReportsModal from '../components/FieldReportsModal';
import AoiManagementModal from '../components/AoiManagementModal';
import UserManagementModal from '../components/UserManagementModal';
import ReviewDialog from '../components/ReviewDialog';
import KpiStrip from '../components/KpiStrip';
import forecastApi, { apiErrorMessage } from '../api/forecastApi';
import broadcastApi from '../api/broadcastApi';
import { exportReport, FORECAST_COLUMNS } from '../utils/reportExport';
import { takePrefetched } from '../preload/warmUp';
import { useAuth } from '../context/AuthContext';
import { useResponsive } from '../hooks/useResponsive';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { playAlertBeep } from '../utils/sound';

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
  const [broadcasts, setBroadcasts] = useState(null); // chỉ admin xem được lịch sử phát lệnh
  const [lastLoadedAt, setLastLoadedAt] = useState(null); // thời điểm tải dữ liệu thành công gần nhất

  const [isBroadcastOpen, setIsBroadcastOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isAuditLogOpen, setIsAuditLogOpen] = useState(false);
  const [isFieldReportsOpen, setIsFieldReportsOpen] = useState(false);
  const [isAoiOpen, setIsAoiOpen] = useState(false);
  const [isUserManagementOpen, setIsUserManagementOpen] = useState(false);
  const [broadcastTargetEvent, setBroadcastTargetEvent] = useState(null);

  // Keyboard navigation shortcuts for emergency operations
  useKeyboardShortcuts({
    Escape: () => {
      if (isBroadcastOpen) setIsBroadcastOpen(false);
      else if (isHistoryOpen) setIsHistoryOpen(false);
      else if (isAuditLogOpen) setIsAuditLogOpen(false);
      else if (isFieldReportsOpen) setIsFieldReportsOpen(false);
      else if (isAoiOpen) setIsAoiOpen(false);
      else if (isUserManagementOpen) setIsUserManagementOpen(false);
      else if (alertPromptEvent) setAlertPromptEvent(null);
    },
    'Alt+m': () => setMobileTab('map'),
    'Alt+l': () => setMobileTab('list'),
  });

  const loadEvents = useCallback(async () => {
    // Số liệu phụ của dải KPI: lỗi ở đây không được làm hỏng hàng đợi.
    takePrefetched('fieldReports', () => forecastApi.getFieldReports()).then(setFieldReports).catch(() => {});
    if (isAdmin) broadcastApi.getBroadcastHistory().then(setBroadcasts).catch(() => setBroadcasts(null));
    try {
      // Lần đầu sau đăng nhập: dùng kết quả đã tải sẵn ở trang login (Story 4.22), không có thì gọi thật.
      const data = await takePrefetched('queue', () => forecastApi.getReviewQueue('all'));
      setEvents(data);
      setLoadError(null);
      setLastLoadedAt(new Date()); // ghi nhận thời điểm tải thành công
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

  // Lớp bản đồ phụ: lỗi ở đây không chặn hàng đợi duyệt.
  useEffect(() => {
    takePrefetched('aoi', () => forecastApi.getAoiCollection()).then(setAoi).catch(() => setAoi(null));
  }, []);

  const handleReviewRequest = (id, decision) => {
    const event = events.find(e => e.id === id);
    if (event && !event.expired) setReviewTarget({ event, decision });
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
      if (soundEnabled) playAlertBeep();
    }
  };

  const selectedEvent = events.find(e => e.id === selectedEventId) || null;

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
        onOpenAuditLog={() => setIsAuditLogOpen(true)}
        onOpenFieldReports={() => setIsFieldReportsOpen(true)}
        onOpenAoi={() => setIsAoiOpen(true)}
        onOpenUsers={() => setIsUserManagementOpen(true)}
        onExportReport={() => exportReport('du-bao', FORECAST_COLUMNS, events)}
        lastLoadedAt={lastLoadedAt}
        loadError={loadError}
      />

      {loadError && (
        <div role="alert" style={{ background: '#FEF2F2', color: '#B91C1C', borderBottom: '1px solid #FECACA', padding: '8px 16px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertTriangle size={14} /> {loadError}
          <button className="btn-ghost" style={{ marginLeft: 'auto' }} onClick={loadEvents}>Thử lại</button>
        </div>
      )}

      <KpiStrip events={events} fieldReports={fieldReports} broadcasts={broadcasts} />

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
          events={events}
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

      <ReviewAuditModal
        isOpen={isAuditLogOpen}
        onClose={() => setIsAuditLogOpen(false)}
      />

      <FieldReportsModal
        isOpen={isFieldReportsOpen}
        onClose={() => setIsFieldReportsOpen(false)}
      />

      <AoiManagementModal
        isOpen={isAoiOpen}
        onClose={() => setIsAoiOpen(false)}
        onAoiUpdated={() => forecastApi.getAoiCollection().then(setAoi).catch(() => setAoi(null))}
      />

      <UserManagementModal
        isOpen={isUserManagementOpen}
        onClose={() => setIsUserManagementOpen(false)}
      />
    </div>
  );
}
