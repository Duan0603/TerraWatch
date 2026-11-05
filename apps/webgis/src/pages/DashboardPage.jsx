import React, { useState, useEffect } from 'react';
import { List, Map } from 'lucide-react';
import Navbar from '../components/Navbar';
import VerificationQueue from '../components/VerificationQueue';
import DetailPanel from '../components/DetailPanel';
import EmergencyAlertPrompt from '../components/EmergencyAlertPrompt';
import BroadcastModal from '../components/BroadcastModal';
import BroadcastHistoryModal from '../components/BroadcastHistoryModal';
import landslideApi from '../api/landslideApi';
import { useAuth } from '../context/AuthContext';
import { useResponsive } from '../hooks/useResponsive';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';

export default function DashboardPage() {
  const { user, role } = useAuth();
  const isAdmin = role === 'admin';
  const { isMobile } = useResponsive();

  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [alertPromptEvent, setAlertPromptEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mobileTab, setMobileTab] = useState('map');

  // Story 4.4: Emergency Alert Broadcast States
  const [isBroadcastOpen, setIsBroadcastOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [broadcastTargetEvent, setBroadcastTargetEvent] = useState(null);

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

  // Tải danh sách sự cố từ API / Mock data
  const loadEvents = async () => {
    try {
      setLoading(true);
      const data = await landslideApi.getLandslides();
      setEvents(data);
      if (data.length > 0 && !selectedEventId) {
        setSelectedEventId(data[0].id);
      }
    } catch (err) {
      console.error('Lỗi khi tải danh sách sự cố:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, []);

  // Xử lý Thẩm định 1-Click (Phê duyệt hoặc Bác bỏ)
  const handleVerify = async (id, status) => {
    const targetEvent = events.find(e => e.id === id);
    if (!targetEvent) return;

    try {
      await landslideApi.verifyLandslide(id, {
        status,
        risk_level: targetEvent.risk,
        verified_notes: `Được thẩm định bởi vai trò ${role}`
      });

      // Cập nhật state trực tiếp trên giao diện
      setEvents(prev => prev.map(ev => {
        if (ev.id === id) {
          return { ...ev, status };
        }
        return ev;
      }));

      // Nếu phê duyệt sự cố có nguy cơ cao (high hoặc extreme) -> kích hoạt prompt cảnh báo khẩn cấp (AC5)
      if (status === 'verified' && (targetEvent.risk === 'extreme' || targetEvent.risk === 'high')) {
        setAlertPromptEvent(targetEvent);
      }
    } catch (err) {
      alert(`Lỗi khi cập nhật thẩm định: ${err.message}`);
    }
  };

  // Đặt lại dữ liệu mẫu
  const handleResetData = () => {
    const initial = landslideApi.resetMockData();
    setEvents(initial);
    if (initial.length > 0) setSelectedEventId(initial[0].id);
    setAlertPromptEvent(null);
  };

  const selectedEvent = events.find(e => e.id === selectedEventId) || events[0];

  // Xử lý mở Modal Phát Cảnh Báo Khẩn Cấp
  const handleOpenBroadcast = (ev = null) => {
    setBroadcastTargetEvent(ev || selectedEvent);
    setIsBroadcastOpen(true);
    setAlertPromptEvent(null); // Đóng prompt nếu đang mở
  };

  // Xử lý khi phát lệnh thành công
  const handleBroadcastSuccess = (result) => {
    console.log('Phát lệnh thành công:', result);
  };

  return (
    <div className="dashboard-root">
      {/* 1. Header Navigation */}
      <Navbar
        soundEnabled={soundEnabled}
        setSoundEnabled={setSoundEnabled}
        activeNav="monitor"
        onOpenBroadcast={() => handleOpenBroadcast(selectedEvent)}
        onOpenHistory={() => setIsHistoryOpen(true)}
      />

      {/* 2. Main Operational Layout */}
      <div className="main-layout">
        <VerificationQueue
          events={events}
          selectedEventId={selectedEventId}
          onSelectEvent={(id) => { setSelectedEventId(id); setMobileTab('map'); }}
          onVerifyEvent={handleVerify}
          onResetData={handleResetData}
          className={mobileTab === 'map' ? 'mobile-hidden' : ''}
        />

        <DetailPanel
          selectedEvent={selectedEvent}
          events={events}
          onSelectEvent={setSelectedEventId}
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

      {/* 3. Post-Approval Emergency Alert Prompt (Story 4.2 -> Story 4.4 Bridge) */}
      <EmergencyAlertPrompt
        event={alertPromptEvent}
        isAdmin={isAdmin}
        onClose={() => setAlertPromptEvent(null)}
        onOpenBroadcast={handleOpenBroadcast}
      />

      {/* 4. Modal Phát Cảnh Báo Khẩn Cấp (Story 4.4 AC1 -> AC6) */}
      <BroadcastModal
        isOpen={isBroadcastOpen}
        onClose={() => setIsBroadcastOpen(false)}
        event={broadcastTargetEvent}
        allEvents={events}
        currentUser={user}
        onBroadcastSuccess={handleBroadcastSuccess}
      />

      {/* 5. Modal Nhật Ký & Lịch Sử Phát Cảnh Báo (Story 4.4 AC7) */}
      <BroadcastHistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        onOpenNewBroadcast={() => handleOpenBroadcast(selectedEvent)}
      />
    </div>
  );
}
