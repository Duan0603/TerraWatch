import React, { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import VerificationQueue from '../components/VerificationQueue';
import DetailPanel from '../components/DetailPanel';
import EmergencyAlertPrompt from '../components/EmergencyAlertPrompt';
import landslideApi from '../api/landslideApi';
import { useAuth } from '../context/AuthContext';

export default function DashboardPage() {
  const { role } = useAuth();
  const isAdmin = role === 'admin';

  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [alertPromptEvent, setAlertPromptEvent] = useState(null);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="dashboard-root">
      {/* 1. Header Navigation */}
      <Navbar
        soundEnabled={soundEnabled}
        setSoundEnabled={setSoundEnabled}
        activeNav="monitor"
      />

      {/* 2. Main Operational Layout */}
      <div className="main-layout">
        {/* Left Sidebar: Verification Queue */}
        <VerificationQueue
          events={events}
          selectedEventId={selectedEventId}
          onSelectEvent={setSelectedEventId}
          onVerifyEvent={handleVerify}
          onResetData={handleResetData}
        />

        {/* Right Canvas: Detail & Map Inspector */}
        <DetailPanel
          selectedEvent={selectedEvent}
          events={events}
          onSelectEvent={setSelectedEventId}
        />
      </div>

      {/* 3. Post-Approval Emergency Alert Prompt (AC5 & Story 4.4 readiness) */}
      <EmergencyAlertPrompt
        event={alertPromptEvent}
        isAdmin={isAdmin}
        onClose={() => setAlertPromptEvent(null)}
      />
    </div>
  );
}
