import React, { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
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
import AdminAuditModal from '../components/AdminAuditModal';
import SystemHealthModal from '../components/SystemHealthModal';
import ModelCardModal from '../components/ModelCardModal';
import ReviewDialog from '../components/ReviewDialog';
import KpiStrip from '../components/KpiStrip';
import MobileTabBar from '../components/MobileTabBar';
import forecastApi from '../api/forecastApi';
import { exportReport, FORECAST_COLUMNS } from '../utils/reportExport';
import { useAuth } from '../context/AuthContext';
import { useDashboardData } from '../hooks/useDashboardData';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { playAlertBeep } from '../utils/sound';

// Thứ tự Escape đóng hộp thoại: cái đầu danh sách đóng trước.
const DIALOG_ORDER = ['broadcast', 'history', 'audit', 'fieldReports', 'aoi', 'users', 'adminAudit', 'health', 'modelCard'];

export default function DashboardPage() {
  const { user, role } = useAuth();
  const isAdmin = role === 'admin';

  const {
    events, selectedEventId, setSelectedEventId, loadError, fieldReports, aoi, broadcasts,
    reviewMetrics, confirmed, experimentalRisk, lastLoadedAt, liveConnected, loadEvents, refreshAoi
  } = useDashboardData(isAdmin);

  const [soundEnabled, setSoundEnabled] = useState(false);
  const [alertPromptEvent, setAlertPromptEvent] = useState(null);
  const [mobileTab, setMobileTab] = useState('map');
  const [reviewTarget, setReviewTarget] = useState(null); // { event, decision }
  const [broadcastTargetEvent, setBroadcastTargetEvent] = useState(null);
  const [dialogs, setDialogs] = useState({}); // { broadcast: true, ... } - hộp thoại nào đang mở
  const show = (name) => setDialogs(d => ({ ...d, [name]: true }));
  const hide = (name) => setDialogs(d => ({ ...d, [name]: false }));

  // Keyboard navigation shortcuts for emergency operations
  useKeyboardShortcuts({
    Escape: () => {
      const openName = DIALOG_ORDER.find(name => dialogs[name]);
      if (openName) hide(openName);
      else if (alertPromptEvent) setAlertPromptEvent(null);
    },
    'Alt+m': () => setMobileTab('map'),
    'Alt+l': () => setMobileTab('list'),
  });

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
    show('broadcast');
    setAlertPromptEvent(null);
  };

  return (
    <div className="dashboard-root">
      <Navbar
        soundEnabled={soundEnabled}
        setSoundEnabled={setSoundEnabled}
        onOpenBroadcast={() => handleOpenBroadcast(selectedEvent)}
        onOpenHistory={() => show('history')}
        onOpenAuditLog={() => show('audit')}
        onOpenFieldReports={() => show('fieldReports')}
        onOpenAoi={() => show('aoi')}
        onOpenUsers={() => show('users')}
        onOpenAdminAudit={() => show('adminAudit')}
        onOpenHealth={() => show('health')}
        onOpenModelCard={() => show('modelCard')}
        onExportReport={() => exportReport('du-bao', FORECAST_COLUMNS, events)}
        lastLoadedAt={lastLoadedAt}
        loadError={loadError}
        liveConnected={liveConnected}
      />

      {loadError && (
        <div role="alert" style={{ background: '#FEF2F2', color: '#B91C1C', borderBottom: '1px solid #FECACA', padding: '8px 16px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertTriangle size={14} /> {loadError}
          <button className="btn-ghost" style={{ marginLeft: 'auto' }} onClick={loadEvents}>Thử lại</button>
        </div>
      )}

      <KpiStrip events={events} fieldReports={fieldReports} broadcasts={broadcasts} reviewMetrics={reviewMetrics} />

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
          confirmed={confirmed}
          experimentalRisk={experimentalRisk}
          className={mobileTab === 'list' ? 'mobile-hidden' : ''}
        />
      </div>

      <MobileTabBar active={mobileTab} onChange={setMobileTab} />

      <ReviewDialog target={reviewTarget} onCancel={() => setReviewTarget(null)} onSubmit={submitReview} />

      <EmergencyAlertPrompt
        event={alertPromptEvent}
        isAdmin={isAdmin}
        onClose={() => setAlertPromptEvent(null)}
        onOpenBroadcast={handleOpenBroadcast}
      />

      <BroadcastModal
        isOpen={!!dialogs.broadcast}
        onClose={() => hide('broadcast')}
        event={broadcastTargetEvent}
        currentUser={user}
      />

      <BroadcastHistoryModal
        isOpen={!!dialogs.history}
        onClose={() => hide('history')}
        onOpenNewBroadcast={() => handleOpenBroadcast(selectedEvent)}
      />

      <ReviewAuditModal isOpen={!!dialogs.audit} onClose={() => hide('audit')} />
      <FieldReportsModal isOpen={!!dialogs.fieldReports} onClose={() => hide('fieldReports')} />
      <AoiManagementModal isOpen={!!dialogs.aoi} onClose={() => hide('aoi')} onAoiUpdated={refreshAoi} />
      <UserManagementModal isOpen={!!dialogs.users} onClose={() => hide('users')} />
      <AdminAuditModal isOpen={!!dialogs.adminAudit} onClose={() => hide('adminAudit')} />
      <SystemHealthModal isOpen={!!dialogs.health} onClose={() => hide('health')} />
      <ModelCardModal isOpen={!!dialogs.modelCard} onClose={() => hide('modelCard')} />
    </div>
  );
}
