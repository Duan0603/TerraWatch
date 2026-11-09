import React, { useState, useEffect, useMemo } from 'react';
import { 
  Map, 
  X, 
  Plus, 
  Edit3, 
  Check, 
  AlertTriangle, 
  CheckCircle2, 
  Layers, 
  RefreshCw, 
  FileCode,
  ShieldAlert,
  Search
} from 'lucide-react';
import forecastApi from '../api/forecastApi';
import AoiDrawMap from './AoiDrawMap';
import { parseRing, selfIntersects } from '../utils/aoiRing';
import { fmtVN } from '../utils/time';

const PRESETS = [
  {
    name: 'Sa Pa - Lào Cai (Khu Vực Núi Cao)',
    desc: 'Vùng trọng điểm sạt lở đèo Ô Quy Hồ & thị xã Sa Pa',
    coords: [
      [103.80, 22.30],
      [103.95, 22.30],
      [103.95, 22.45],
      [103.80, 22.45],
      [103.80, 22.30]
    ]
  },
  {
    name: 'Bát Xát - Lào Cai (Vùng Biên Giới)',
    desc: 'Khu vực lưu vực sông Hồng và vùng đồi dốc hiểm trở Bát Xát',
    coords: [
      [103.65, 22.50],
      [103.85, 22.50],
      [103.85, 22.70],
      [103.65, 22.70],
      [103.65, 22.50]
    ]
  },
  {
    name: 'Mù Cang Chải - Yên Bái (Ruộng Bậc Thang)',
    desc: 'Vùng trọng điểm trượt lở đất đá quốc lộ 32 Mù Cang Chải',
    coords: [
      [104.00, 21.80],
      [104.20, 21.80],
      [104.20, 21.95],
      [104.00, 21.95],
      [104.00, 21.80]
    ]
  }
];

export default function AoiManagementModal({ isOpen, onClose, onAoiUpdated }) {
  const [areas, setAreas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Selected area for editing (null means creating new)
  const [selectedArea, setSelectedArea] = useState(null);
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formActive, setFormActive] = useState(true);
  const [formCoordsStr, setFormCoordsStr] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Các vùng khác (không kể vùng đang sửa) vẽ mờ trên bản đồ để đặt ranh giới cho khớp.
  const otherAreas = useMemo(() => ({
    type: 'FeatureCollection',
    features: areas.filter(a => a.area_id !== selectedArea?.area_id).map(a => {
      try {
        const g = typeof a.geometry_geojson === 'string' ? JSON.parse(a.geometry_geojson) : a.geometry_geojson;
        return g?.coordinates ? { type: 'Feature', properties: {}, geometry: g } : null;
      } catch { return null; }
    }).filter(Boolean)
  }), [areas, selectedArea]);

  const fetchAreas = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await forecastApi.getMonitoringAreas();
      setAreas(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Không thể tải danh sách vùng giám sát');
      setAreas([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchAreas();
      resetForm();
    }
  }, [isOpen]);

  const resetForm = () => {
    setSelectedArea(null);
    setFormName('');
    setFormDesc('');
    setFormActive(true);
    setFormCoordsStr(JSON.stringify(PRESETS[0].coords, null, 2));
    setSaveSuccess(false);
  };

  const handleSelectArea = (area) => {
    setSelectedArea(area);
    setFormName(area.name || '');
    setFormDesc(area.description || '');
    setFormActive(area.is_active !== false);
    setSaveSuccess(false);

    try {
      let geojson = area.geometry_geojson;
      if (typeof geojson === 'string') {
        geojson = JSON.parse(geojson);
      }
      if (geojson && geojson.coordinates) {
        // MultiPolygon coordinates: [[ring]], Polygon: [ring]
        const ring = geojson.type === 'MultiPolygon' ? geojson.coordinates[0][0] : geojson.coordinates[0];
        setFormCoordsStr(JSON.stringify(ring, null, 2));
      } else {
        setFormCoordsStr(JSON.stringify(PRESETS[0].coords, null, 2));
      }
    } catch (e) {
      setFormCoordsStr(JSON.stringify(PRESETS[0].coords, null, 2));
    }
  };

  const handleApplyPreset = (preset) => {
    setFormName(preset.name);
    setFormDesc(preset.desc);
    setFormCoordsStr(JSON.stringify(preset.coords, null, 2));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formName.trim()) {
      alert('Vui lòng nhập tên vùng giám sát.');
      return;
    }

    let parsedCoords;
    try {
      parsedCoords = JSON.parse(formCoordsStr);
      if (!Array.isArray(parsedCoords) || parsedCoords.length < 4) {
        throw new Error('Tọa độ phải là danh sách ít nhất 4 điểm [kinh độ, vĩ độ].');
      }
      // Ensure closed ring
      const first = parsedCoords[0];
      const last = parsedCoords[parsedCoords.length - 1];
      if (first[0] !== last[0] || first[1] !== last[1]) {
        parsedCoords.push([...first]);
      }
    } catch (err) {
      alert(`Định dạng tọa độ không hợp lệ: ${err.message}`);
      return;
    }

    if (selfIntersects(parseRing(formCoordsStr))) {
      alert('Ranh giới vùng tự cắt nhau (hình nơ) nên không hợp lệ. Hãy kéo các điểm cho ranh giới không giao nhau.');
      return;
    }

    const geojson = {
      type: 'Polygon',
      coordinates: [parsedCoords]
    };

    try {
      setSaving(true);
      setError(null);
      if (selectedArea) {
        // Update
        await forecastApi.updateMonitoringArea(selectedArea.area_id, {
          name: formName.trim(),
          description: formDesc.trim(),
          isActive: formActive,
          geojson
        });
      } else {
        // Create
        await forecastApi.createMonitoringArea({
          name: formName.trim(),
          description: formDesc.trim(),
          geojson
        });
      }
      setSaveSuccess(true);
      await fetchAreas();
      onAoiUpdated?.();
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setError(err.message || 'Lỗi lưu thông tin vùng giám sát');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const filteredAreas = areas.filter(a => 
    a.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(5, 8, 16, 0.88)',
      backdropFilter: 'blur(16px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: 20
    }}>
      <div style={{
        maxWidth: 1040,
        width: '100%',
        background: 'rgba(13, 19, 34, 0.98)',
        border: '1px solid rgba(56, 189, 248, 0.3)',
        borderRadius: 16,
        boxShadow: '0 25px 70px rgba(0, 0, 0, 0.85)',
        color: '#f8fafc',
        display: 'flex',
        flexDirection: 'column',
        maxHeight: '90vh',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 24px',
          background: 'rgba(255, 255, 255, 0.02)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ background: 'rgba(56, 189, 248, 0.15)', padding: 8, borderRadius: 8, display: 'flex' }}>
              <Layers size={20} color="#38bdf8" />
            </div>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#fff' }}>
                QUẢN LÝ VÙNG GIÁM SÁT TRỌNG ĐIỂM (AOI)
              </h3>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                Định nghĩa ranh giới không gian các vùng địa lý theo dõi sạt lở (<code>gis_schema.monitoring_areas</code>)
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={resetForm}
              style={{
                background: '#0284c7',
                border: 'none',
                color: '#fff',
                padding: '6px 12px',
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5
              }}
            >
              <Plus size={14} /> Thêm Vùng Mới
            </button>
            <button
              onClick={onClose}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#94a3b8',
                padding: 6,
                borderRadius: 8,
                cursor: 'pointer',
                display: 'flex'
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* 2-Column Layout */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Left Column: List of Areas */}
          <div style={{ width: '42%', borderRight: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: 12, borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
              <div style={{ position: 'relative' }}>
                <Search size={14} color="#64748b" style={{ position: 'absolute', left: 10, top: 9 }} />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Tìm kiếm vùng giám sát..."
                  style={{
                    width: '100%',
                    background: 'rgba(6, 9, 17, 0.9)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: 8,
                    padding: '6px 10px 6px 32px',
                    color: '#fff',
                    fontSize: 12,
                    outline: 'none'
                  }}
                />
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
              {loading ? (
                <div style={{ textAlign: 'center', padding: 30, color: '#64748b', fontSize: 12 }}>
                  <RefreshCw size={14} className="spin" style={{ display: 'inline', marginRight: 6 }} /> Đang tải...
                </div>
              ) : filteredAreas.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 30, color: '#64748b', fontSize: 12 }}>
                  Không tìm thấy vùng giám sát nào.
                </div>
              ) : (
                filteredAreas.map((a) => {
                  const isSelected = selectedArea?.area_id === a.area_id;
                  return (
                    <div
                      key={a.area_id}
                      onClick={() => handleSelectArea(a)}
                      style={{
                        background: isSelected ? 'rgba(2, 132, 199, 0.2)' : 'rgba(255, 255, 255, 0.02)',
                        border: `1px solid ${isSelected ? '#38bdf8' : 'rgba(255, 255, 255, 0.06)'}`,
                        borderRadius: 8,
                        padding: '10px 12px',
                        marginBottom: 8,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc' }}>
                          {a.name}
                        </span>
                        <span style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: '1px 6px',
                          borderRadius: 4,
                          background: a.is_active ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                          color: a.is_active ? '#4ade80' : '#f87171'
                        }}>
                          {a.is_active ? 'HOẠT ĐỘNG' : 'TẠM TẮT'}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.4 }}>
                        {a.description || 'Không có mô tả'}
                      </div>
                      <div style={{ fontSize: 10, color: '#64748b', marginTop: 4, display: 'flex', justifyContent: 'space-between' }}>
                        <span>Mã vùng: #{a.area_id}</span>
                        <span>{fmtVN(a.created_at)}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Editor Form */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <h4 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: '#fff' }}>
                  {selectedArea ? `Sửa Vùng Giám Sát: ${selectedArea.name}` : 'Tạo Vùng Giám Sát Mới'}
                </h4>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                  {selectedArea ? `Cập nhật thông tin và ranh giới cho vùng #${selectedArea.area_id}` : 'Nhập thông tin hoặc chọn nhanh từ danh mục vùng mẫu có sẵn'}
                </div>
              </div>

              {saveSuccess && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#4ade80', fontSize: 12, fontWeight: 600 }}>
                  <CheckCircle2 size={15} /> Đã lưu thành công!
                </div>
              )}
            </div>

            {error && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: 8,
                padding: 10,
                color: '#f87171',
                fontSize: 12,
                marginBottom: 16
              }}>
                {error}
              </div>
            )}

            {/* Presets Quick Picker */}
            {!selectedArea && (
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 6 }}>
                  Vùng mẫu gợi ý (Quick Presets):
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {PRESETS.map((p, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleApplyPreset(p)}
                      style={{
                        background: 'rgba(56, 189, 248, 0.08)',
                        border: '1px solid rgba(56, 189, 248, 0.25)',
                        color: '#38bdf8',
                        padding: '4px 10px',
                        borderRadius: 6,
                        fontSize: 11,
                        cursor: 'pointer',
                        transition: 'all 0.15s'
                      }}
                    >
                      + {p.name.split(' - ')[0]}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#cbd5e1', marginBottom: 4 }}>
                  TÊN VÙNG GIÁM SÁT *
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ví dụ: Vùng Cảnh Báo Sạt Lở Sa Pa"
                  required
                  style={{
                    width: '100%',
                    background: 'rgba(6, 9, 17, 0.95)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: 8,
                    padding: '8px 12px',
                    color: '#fff',
                    fontSize: 12,
                    outline: 'none'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#cbd5e1', marginBottom: 4 }}>
                  MÔ TẢ CHI TIẾT
                </label>
                <input
                  type="text"
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  placeholder="Ví dụ: Khu vực các sườn dốc dọc tuyến đèo quốc lộ 4D"
                  style={{
                    width: '100%',
                    background: 'rgba(6, 9, 17, 0.95)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: 8,
                    padding: '8px 12px',
                    color: '#fff',
                    fontSize: 12,
                    outline: 'none'
                  }}
                />
              </div>

              {selectedArea && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="checkbox"
                    id="areaActive"
                    checked={formActive}
                    onChange={(e) => setFormActive(e.target.checked)}
                    style={{ cursor: 'pointer' }}
                  />
                  <label htmlFor="areaActive" style={{ fontSize: 12, color: '#cbd5e1', cursor: 'pointer' }}>
                    Kích hoạt giám sát (Vùng đang hoạt động và hiển thị trên bản đồ)
                  </label>
                </div>
              )}

              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#cbd5e1', marginBottom: 4 }}>
                  VẼ RANH GIỚI TRÊN BẢN ĐỒ *
                </div>
                <AoiDrawMap value={formCoordsStr} onChange={setFormCoordsStr} others={otherAreas} />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#cbd5e1' }}>
                    TỌA ĐỘ (nâng cao, tự cập nhật theo bản đồ — Polygon JSON: [ [lng, lat], ... ])
                  </label>
                  <span style={{ fontSize: 10, color: '#64748b' }}>WGS84 EPSG:4326</span>
                </div>
                <textarea
                  value={formCoordsStr}
                  onChange={(e) => setFormCoordsStr(e.target.value)}
                  rows={5}
                  style={{
                    width: '100%',
                    background: 'rgba(6, 9, 17, 0.95)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: 8,
                    padding: '10px 12px',
                    color: '#38bdf8',
                    fontFamily: 'monospace',
                    fontSize: 11,
                    lineHeight: 1.5,
                    outline: 'none'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                {selectedArea && (
                  <button
                    type="button"
                    onClick={resetForm}
                    style={{
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      color: '#cbd5e1',
                      padding: '8px 16px',
                      borderRadius: 6,
                      fontSize: 12,
                      cursor: 'pointer'
                    }}
                  >
                    Hủy Sửa
                  </button>
                )}

                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    background: '#0284c7',
                    border: 'none',
                    color: '#fff',
                    padding: '8px 20px',
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: saving ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                >
                  {saving ? 'Đang lưu...' : (selectedArea ? 'Cập Nhật Vùng' : 'Lưu Vùng Giám Sát')}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
