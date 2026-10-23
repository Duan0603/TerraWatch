import React, { useState, useRef, useEffect } from 'react';
import { Mountain, MapPin, ChevronDown, Check, Compass } from 'lucide-react';
import { MOUNTAIN_LOCATIONS, getLocationById } from '../data/mountainLocations';

/**
 * Component LocationSelector - Bộ chọn khu vực miền núi & toàn cảnh Việt Nam (AC 1.3.2, AC 1.3.4)
 * 
 * @param {string} selectedLocationId - ID khu vực hiện đang xem
 * @param {function} onSelectLocation - Callback khi người dùng chọn khu vực mới
 */
export default function LocationSelector({ selectedLocationId = 'vietnam', onSelectLocation }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const currentLocation = getLocationById(selectedLocationId) || MOUNTAIN_LOCATIONS[0];

  // Đóng dropdown khi click ra ngoài
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Đóng dropdown khi nhấn Escape
  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleSelect = (loc) => {
    if (onSelectLocation) {
      onSelectLocation(loc);
    }
    setIsOpen(false);
  };

  return (
    <div 
      className="location-selector-wrapper" 
      ref={dropdownRef}
      style={{ position: 'relative', display: 'inline-block' }}
    >
      {/* Nút trigger dropdown (AC 1.3.2, AC 1.3.4) */}
      <button
        type="button"
        className="location-selector-trigger"
        onClick={() => setIsOpen(prev => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        title="Chọn khu vực miền núi hoặc góc nhìn toàn cảnh"
        style={{
          background: 'rgba(255, 255, 255, 0.95)',
          color: '#172524',
          border: '1px solid #DCE5E2',
          padding: '6px 12px',
          borderRadius: 8,
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
          backdropFilter: 'blur(6px)',
          transition: 'all 0.15s ease'
        }}
      >
        <div style={{
          width: 20,
          height: 20,
          borderRadius: 4,
          background: currentLocation.id === 'vietnam' ? '#E4F4F1' : '#FEF3C7',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: currentLocation.id === 'vietnam' ? '#087B70' : '#D97706',
          flexShrink: 0
        }}>
          {currentLocation.id === 'vietnam' ? (
            <Compass size={13} />
          ) : (
            <Mountain size={13} />
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left', lineHeight: 1.2 }}>
          <span 
            className="location-selector-label"
            style={{ fontSize: 9, color: '#687977', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em' }}
          >
            Khu vực đang xem
          </span>
          <span 
            className="location-selector-current-name"
            style={{ fontSize: 12, fontWeight: 700, color: '#172524' }}
          >
            {currentLocation.name}
          </span>
        </div>

        <ChevronDown 
          size={14} 
          color="#687977" 
          style={{ 
            transition: 'transform 0.2s ease', 
            transform: isOpen ? 'rotate(180deg)' : 'none',
            marginLeft: 2
          }} 
        />
      </button>

      {/* Danh sách dropdown 8 khu vực (AC 1.3.1, AC 1.3.2) */}
      {isOpen && (
        <div
          className="location-selector-menu"
          role="listbox"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            width: 270,
            background: 'rgba(255, 255, 255, 0.98)',
            border: '1px solid #DCE5E2',
            borderRadius: 10,
            boxShadow: '0 8px 28px rgba(23, 37, 36, 0.15)',
            backdropFilter: 'blur(10px)',
            zIndex: 100,
            padding: '6px 0',
            maxHeight: 360,
            overflowY: 'auto'
          }}
        >
          <div style={{
            padding: '6px 14px 4px',
            fontSize: 10,
            fontWeight: 700,
            color: '#9BB0AD',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            borderBottom: '1px solid #F0F5F3',
            marginBottom: 4
          }}>
            Khu vực quan trắc trọng điểm
          </div>

          {MOUNTAIN_LOCATIONS.map((loc) => {
            const isActive = loc.id === currentLocation.id;
            const isNational = loc.id === 'vietnam';

            return (
              <div
                key={loc.id}
                role="option"
                aria-selected={isActive}
                onClick={() => handleSelect(loc)}
                className={`location-option-item ${isActive ? 'active' : ''}`}
                style={{
                  padding: '8px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  background: isActive ? '#E4F4F1' : 'transparent',
                  borderLeft: isActive ? '3px solid #087B70' : '3px solid transparent',
                  transition: 'background 0.12s'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <div style={{
                    width: 24,
                    height: 24,
                    borderRadius: 6,
                    background: isNational ? '#F0FDF4' : '#FFFBEB',
                    border: isNational ? '1px solid #BBF7D0' : '1px solid #FDE68A',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: isNational ? '#15803D' : '#B45309',
                    flexShrink: 0
                  }}>
                    {isNational ? <Compass size={13} /> : <Mountain size={13} />}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                    <span style={{ 
                      fontSize: 12, 
                      fontWeight: isActive ? 700 : 600, 
                      color: isActive ? '#087B70' : '#172524',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>
                      {loc.name}
                    </span>
                    <span style={{ 
                      fontSize: 10, 
                      color: '#687977',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>
                      {isNational ? 'Góc nhìn toàn quốc' : `Cao độ 3D: pitch ${loc.pitch}°`}
                    </span>
                  </div>
                </div>

                {isActive && (
                  <Check size={14} color="#087B70" style={{ flexShrink: 0, marginLeft: 8 }} />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
