import React, { useState } from 'react';
import { 
  ShieldAlert, 
  Satellite, 
  Layers, 
  Radio, 
  FileText, 
  Volume2, 
  VolumeX, 
  CheckCircle, 
  XCircle, 
  MapPin, 
  AlertOctagon, 
  Activity, 
  Wind, 
  Mountain,
  Share2
} from 'lucide-react';

export default function App() {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [notice, setNotice] = useState('');
  const [buffers, setBuffers] = useState(true);
  const [selectedEventId, setSelectedEventId] = useState('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  
  const [events, setEvents] = useState([
    {
      id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      location: 'Mù Cang Chải (Yên Bái) - Sườn Đèo Khau Phạ',
      coords: '104.085°E, 21.845°N',
      risk: 'high',
      status: 'pending',
      confidence: 0.89,
      slope: 37.2,
      ndviDrop: -0.48,
      areaM2: 1850,
      detectedAt: '2026-10-02 08:30:15 UTC',
      satelliteScene: 'Sentinel-2A L2A (10m Multi-spectral)',
      estPopulation: 120,
      mapX: 42,
      mapY: 55,
      geology: 'Đất đá phong hóa nứt nẻ, ta-luy dương cao'
    },
    {
      id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      location: 'Quốc Lộ 32 - Bản Dế Xu Phình',
      coords: '104.110°E, 21.860°N',
      risk: 'extreme',
      status: 'verified',
      confidence: 0.96,
      slope: 43.5,
      ndviDrop: -0.62,
      areaM2: 3400,
      detectedAt: '2026-10-02 06:15:00 UTC',
      satelliteScene: 'Sentinel-2B L2A (10m Multi-spectral)',
      estPopulation: 350,
      mapX: 48,
      mapY: 48,
      geology: 'Sạt trượt đất đá khối lượng lớn chia cắt giao thông'
    },
    {
      id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
      location: 'Bản Tả Phìn (Sa Pa, Lào Cai)',
      coords: '103.820°E, 22.340°N',
      risk: 'medium',
      status: 'verified',
      confidence: 0.78,
      slope: 28.0,
      ndviDrop: -0.35,
      areaM2: 920,
      detectedAt: '2026-10-01 19:40:22 UTC',
      satelliteScene: 'Sentinel-2A L2A (10m Multi-spectral)',
      estPopulation: 45,
      mapX: 30,
      mapY: 28,
      geology: 'Mưa dầm xói lở ta-luy âm đường bê tông'
    }
  ]);


  const selectedEvent = events.find(e => e.id === selectedEventId);
  const risks = { high: 'Cao', extreme: 'Rất cao', medium: 'Trung bình' };
  const statuses = { pending: 'Chờ thẩm định', verified: 'Đã xác thực', false_alarm: 'Đã bác bỏ' };
  const normalize = text => text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
  const visible = events.filter(e => (filter === 'all' || e.status === filter) && normalize(e.location).includes(normalize(query)));
  const pendingCount = events.filter(e => e.status === 'pending').length;
  const verifiedCount = events.filter(e => e.status === 'verified').length;
  const activeEvents = events.filter(e => e.status !== 'false_alarm');
  const number = value => value.toLocaleString('vi-VN');
  const handleVerify = status => {
    setEvents(previous => previous.map(e => e.id === selectedEventId ? { ...e, status } : e));
    setNotice(statuses[status] + ' trong phiên minh họa. Chưa gửi cảnh báo thực tế.');
  };
  const exportReport = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify({ mode: 'demo', events }, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = 'terrawatch-minh-hoa.json'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice('Đã xuất báo cáo dữ liệu minh họa dưới dạng JSON.');
  };
  return (
    <div className="app-shell">
      <header className="topbar"><a className="brand" href="#main"><span className="brand-icon"><Mountain size={25}/></span><span>TerraWatch<small>GIÁM SÁT SẠT LỞ ĐẤT</small></span></a><div className="breadcrumb">Không gian giám sát <span>/</span><strong>Tây Bắc</strong></div><span className="demo-badge">● Chế độ minh họa</span></header>
      <main className="workspace" id="main">
        <section className="page-heading"><div><div className="eyebrow">TỔNG QUAN KHU VỰC</div><h1>Giám sát & cảnh báo</h1><p>Theo dõi điểm nguy cơ, xem phân tích và thẩm định sự kiện.</p></div><button className="button secondary" onClick={exportReport}><FileText size={17}/>Xuất báo cáo</button></section>
        <section className="stats" aria-label="Thống kê sự kiện">
          {[['Điểm đang theo dõi', activeEvents.length, 'Trong khu vực Tây Bắc', MapPin, 'green'], ['Chờ thẩm định', pendingCount, 'Cần cán bộ kiểm tra', Activity, 'amber'], ['Đã xác thực', verifiedCount, 'Kết quả trong dữ liệu mẫu', ShieldAlert, 'blue'], ['Dân số trong vùng nguy cơ', activeEvents.reduce((n,e)=>n+e.estPopulation,0), 'Ước tính từ dữ liệu mẫu', Radio, 'purple']].map(([label,value,note,Icon,tone]) => <article className="stat" key={label}><div><span>{label}</span><strong>{number(value)}</strong><small>{note}</small></div><span className={'stat-icon '+tone}><Icon size={21}/></span></article>)}
        </section>
        <div className="monitor-layout">
          <section className="panel event-panel" aria-label="Danh sách sự kiện">
            <div className="panel-heading"><h2>Sự kiện phát hiện</h2><span className="count">{events.length}</span></div>
            <label className="search"><MapPin size={16}/><input aria-label="Tìm địa điểm" placeholder="Tìm địa điểm…" value={query} onChange={e=>setQuery(e.target.value)}/></label>
            <div className="filters" aria-label="Lọc trạng thái">{[['all','Tất cả'],['pending','Chờ duyệt'],['verified','Đã xác thực'],['false_alarm','Đã bác bỏ']].map(([value,label])=><button key={value} aria-pressed={filter===value} className={filter===value?'active':''} onClick={()=>setFilter(value)}>{label}</button>)}</div>
            <div className="event-list">{visible.map(e=><button key={e.id} className={'event-card '+(selectedEventId===e.id?'selected':'')} aria-pressed={selectedEventId===e.id} onClick={()=>setSelectedEventId(e.id)}><div className="event-top"><span className={'risk '+e.risk}>● Nguy cơ {risks[e.risk].toLowerCase()}</span><span>↗</span></div><h3>{e.location}</h3><p><MapPin size={12}/>{e.coords}</p><div className="event-bottom"><span className={'status '+e.status}>{statuses[e.status]}</span><span>AI {Math.round(e.confidence*100)}%</span></div></button>)}{!visible.length&&<div className="empty"><h3>Không có sự kiện phù hợp</h3><p>Thử địa điểm hoặc bộ lọc khác.</p><button className="button secondary" onClick={()=>{setQuery('');setFilter('all');}}>Xóa bộ lọc</button></div>}</div>
            <div className="list-footer"><Satellite size={15}/>Nguồn mẫu: Sentinel-2A/B</div>
          </section>
          <section className="panel map-panel" aria-label="Sơ đồ vị trí minh họa"><div className="panel-heading"><div><h2>Phân bố điểm nguy cơ</h2><p>Tây Bắc, Việt Nam · Sơ đồ minh họa</p></div><button className="layer-button" aria-pressed={buffers} onClick={()=>setBuffers(!buffers)}><Layers size={16}/><span>Vùng ảnh hưởng</span></button></div>
            <div className="map-surface">
              <svg className="terrain" viewBox="0 0 900 600" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><rect width="900" height="600" fill="#eaf0e6"/><g fill="none" stroke="#ceddc8" strokeWidth="1.5">{Array.from({length:14},(_,i)=><path key={i} d={`M ${-240+i*38} -60 C ${430+i*26} 120, ${-220+i*35} 350, ${270+i*44} 680`}/>)}{Array.from({length:9},(_,i)=><ellipse key={i} cx="790" cy="140" rx={80+i*29} ry={55+i*26} transform="rotate(-28 790 140)"/>)}</g><path d="M340 -20 C390 130 610 190 490 310 S300 420 420 620" fill="none" stroke="#bbdadb" strokeWidth="18"/><path d="M-30 470 C210 410 200 210 420 290 S690 440 960 230" fill="none" stroke="white" strokeWidth="8"/><path d="M-30 470 C210 410 200 210 420 290 S690 440 960 230" fill="none" stroke="#d9c9a2" strokeWidth="3" strokeDasharray="8 5"/></svg>
              <span className="region-label lao-cai">LÀO CAI</span><span className="region-label yen-bai">YÊN BÁI</span><div className="compass">N<span>↑</span></div>
              {visible.filter(e=>e.status!=='false_alarm').map(e=><button key={e.id} className={'map-point '+e.risk+(buffers?' with-buffer':'')+(selectedEventId===e.id?' chosen':'')} style={{left:e.mapX+'%',top:e.mapY+'%'}} aria-label={e.location+', nguy cơ '+risks[e.risk]} aria-pressed={selectedEventId===e.id} onClick={()=>setSelectedEventId(e.id)}><span className="pin"><Mountain size={16}/></span><span className="point-label">{e.location.split(' - ')[0]}</span></button>)}
              <div className="map-legend">{Object.entries(risks).map(([key,label])=><span key={key}><i className={key}/>{label}</span>)}</div><span className="map-disclaimer">Vị trí và vùng ảnh hưởng chỉ mang tính minh họa</span>
            </div>
          </section>
          <aside className="panel detail-panel" aria-label="Chi tiết sự kiện"><div className="panel-heading"><h2>Chi tiết sự kiện</h2><MapPin size={16}/></div><div className="detail-content"><span className={'risk '+selectedEvent.risk}>● Nguy cơ {risks[selectedEvent.risk].toLowerCase()}</span><h2 className="detail-title">{selectedEvent.location}</h2><p className="coordinates"><MapPin size={13}/>{selectedEvent.coords}</p><div className="detail-status"><span>Trạng thái</span><strong className={'status '+selectedEvent.status}>{statuses[selectedEvent.status]}</strong></div><div className="confidence"><div><span>Độ tin cậy AI</span><strong>{Math.round(selectedEvent.confidence*100)}%</strong></div><meter min="0" max="1" value={selectedEvent.confidence}>{Math.round(selectedEvent.confidence*100)}%</meter><small>Kết quả mô hình cần được thẩm định.</small></div><dl className="metrics"><div><dt>Độ dốc</dt><dd>{selectedEvent.slope}°</dd></div><div><dt>Diện tích</dt><dd>{number(selectedEvent.areaM2)} <small>m²</small></dd></div><div><dt>Thay đổi NDVI</dt><dd>{selectedEvent.ndviDrop}</dd></div><div><dt>Dân số ước tính</dt><dd>{selectedEvent.estPopulation} <small>người</small></dd></div></dl><div className="observation"><h3>Ghi nhận địa hình</h3><p>{selectedEvent.geology}</p></div><div className="capture"><Satellite size={17}/><div>{selectedEvent.satelliteScene}<small>{selectedEvent.detectedAt}</small></div></div>{selectedEvent.status==='pending'?<div className="review-actions"><button className="button primary" onClick={()=>handleVerify('verified')}><CheckCircle size={16}/>Xác thực sự kiện</button><button className="button secondary" onClick={()=>handleVerify('false_alarm')}><XCircle size={16}/>Bác bỏ cảnh báo</button></div>:<p className="reviewed"><CheckCircle size={16}/>{statuses[selectedEvent.status]}</p>}<p className="demo-note">Thao tác chỉ áp dụng cho dữ liệu mẫu và được đặt lại khi tải lại trang.</p></div></aside>
        </div>
        <footer className="page-footer"><span>TerraWatch · Hỗ trợ quan sát và thẩm định nguy cơ sạt lở</span><span>Dữ liệu minh họa · Tháng 10/2026</span></footer>
        <div className="notice" role="status" aria-live="polite">{notice&&<><CheckCircle size={18}/><span>{notice}</span><button aria-label="Đóng thông báo" onClick={()=>setNotice('')}>×</button></>}</div>
      </main>
    </div>
  );
}
