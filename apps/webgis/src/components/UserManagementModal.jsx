import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  Shield,
  UserCheck,
  UserX,
  CheckCircle2,
  XCircle,
  Lock,
  Unlock,
  RefreshCw,
  X,
  AlertCircle,
  Filter,
  Check
} from 'lucide-react';
import adminApi from '../api/adminApi';
import { useAuth } from '../context/AuthContext';
import { fmtVN } from '../utils/time';

export default function UserManagementModal({ isOpen, onClose }) {
  const { user: me } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [feedbackMsg, setFeedbackMsg] = useState(null);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminApi.getUsers();
      setUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Lỗi khi tải danh sách người dùng:', err);
      setError(err.response?.data?.message || err.message || 'Không thể tải danh sách người dùng');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchUsers();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleToggleStatus = async (user) => {
    const nextStatus = !user.isActive;
    const actionName = nextStatus ? 'mở khóa' : 'khóa';
    if (!window.confirm(`Bạn có chắc chắn muốn ${actionName} tài khoản ${user.fullName || user.email}?`)) {
      return;
    }

    setActionLoadingId(user.userId);
    try {
      await adminApi.updateUserStatus(user.userId, nextStatus);
      setFeedbackMsg({ type: 'success', text: `Đã ${actionName} tài khoản thành công` });
      await fetchUsers();
    } catch (err) {
      setFeedbackMsg({
        type: 'error',
        text: err.response?.data?.message || `Lỗi khi ${actionName} tài khoản`
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleChangeRole = async (user, newRole) => {
    if (user.role === newRole) return;
    setActionLoadingId(user.userId);
    try {
      await adminApi.updateUserRole(user.userId, newRole);
      setFeedbackMsg({ type: 'success', text: `Đã cập nhật vai trò sang ${newRole.toUpperCase()}` });
      await fetchUsers();
    } catch (err) {
      setFeedbackMsg({
        type: 'error',
        text: err.response?.data?.message || 'Lỗi khi cập nhật vai trò'
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleApproveOfficer = async (user) => {
    setActionLoadingId(user.userId);
    try {
      await adminApi.approveOfficer(user.userId);
      setFeedbackMsg({ type: 'success', text: `Đã phê duyệt tài khoản cán bộ: ${user.fullName}` });
      await fetchUsers();
    } catch (err) {
      setFeedbackMsg({
        type: 'error',
        text: err.response?.data?.message || 'Lỗi khi phê duyệt cán bộ'
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRejectOfficer = async (user) => {
    if (!window.confirm(`Bạn có chắc muốn từ chối tài khoản cán bộ của ${user.fullName}?`)) {
      return;
    }
    setActionLoadingId(user.userId);
    try {
      await adminApi.rejectOfficer(user.userId);
      setFeedbackMsg({ type: 'warning', text: `Đã từ chối tài khoản cán bộ: ${user.fullName}` });
      await fetchUsers();
    } catch (err) {
      setFeedbackMsg({
        type: 'error',
        text: err.response?.data?.message || 'Lỗi khi từ chối cán bộ'
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  // Filtered users
  const filteredUsers = users.filter((u) => {
    if (roleFilter !== 'ALL' && (u.role || '').toLowerCase() !== roleFilter.toLowerCase()) {
      return false;
    }
    if (statusFilter === 'ACTIVE' && !u.isActive) return false;
    if (statusFilter === 'LOCKED' && u.isActive) return false;
    if (statusFilter === 'PENDING' && (u.approvalStatus || '').toLowerCase() !== 'pending') return false;

    if (search.trim()) {
      const q = search.toLowerCase();
      const matchName = (u.fullName || '').toLowerCase().includes(q);
      const matchEmail = (u.email || '').toLowerCase().includes(q);
      const matchPhone = (u.phoneNumber || '').includes(q);
      if (!matchName && !matchEmail && !matchPhone) return false;
    }
    return true;
  });

  const pendingCount = users.filter((u) => (u.approvalStatus || '').toLowerCase() === 'pending').length;
  const activeCount = users.filter((u) => u.isActive).length;
  const lockedCount = users.filter((u) => !u.isActive).length;

  return (
    <div className="modal-backdrop" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(5, 12, 26, 0.82)',
      backdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1100,
      padding: '16px'
    }}>
      <div className="modal-container" style={{
        backgroundColor: '#0B1528',
        border: '1px solid #1E293B',
        borderRadius: '12px',
        width: '100%',
        maxWidth: '1040px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.65)',
        overflow: 'hidden',
        color: '#F1F5F9'
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid #1E293B',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: '#0E1B33'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '8px',
              backgroundColor: 'rgba(56, 189, 248, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#38BDF8'
            }}>
              <Users size={22} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#F8FAFC' }}>
                Quản Trị Người Dùng & Phê Duyệt Cán Bộ
              </h2>
              <p style={{ margin: 0, fontSize: '12px', color: '#94A3B8' }}>
                Phê duyệt tài khoản cán bộ trực ban, phân quyền quản trị và quản lý trạng thái tài khoản
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94A3B8',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Stats bar */}
        <div style={{
          padding: '12px 20px',
          backgroundColor: '#091122',
          borderBottom: '1px solid #1E293B',
          display: 'flex',
          gap: '16px',
          flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
            <span style={{ color: '#94A3B8' }}>Tổng tài khoản:</span>
            <span style={{ fontWeight: 600, color: '#F8FAFC' }}>{users.length}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
            <span style={{ color: '#94A3B8' }}>Cán bộ chờ duyệt:</span>
            <span style={{
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: '999px',
              backgroundColor: pendingCount > 0 ? 'rgba(245, 158, 11, 0.2)' : 'rgba(100, 116, 139, 0.2)',
              color: pendingCount > 0 ? '#FBBF24' : '#94A3B8',
              border: pendingCount > 0 ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid rgba(100, 116, 139, 0.3)'
            }}>
              {pendingCount}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
            <span style={{ color: '#94A3B8' }}>Đang hoạt động:</span>
            <span style={{ fontWeight: 600, color: '#34D399' }}>{activeCount}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
            <span style={{ color: '#94A3B8' }}>Đã khóa:</span>
            <span style={{ fontWeight: 600, color: '#F87171' }}>{lockedCount}</span>
          </div>
          <div style={{ marginLeft: 'auto' }}>
            <button
              onClick={fetchUsers}
              disabled={loading}
              style={{
                background: 'transparent',
                border: '1px solid #334155',
                color: '#CBD5E1',
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
              Làm mới
            </button>
          </div>
        </div>

        {/* Feedback message banner */}
        {feedbackMsg && (
          <div style={{
            padding: '10px 20px',
            backgroundColor: feedbackMsg.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            borderBottom: '1px solid #1E293B',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            color: feedbackMsg.type === 'success' ? '#34D399' : '#F87171',
            fontSize: '13px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {feedbackMsg.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
              <span>{feedbackMsg.text}</span>
            </div>
            <button
              onClick={() => setFeedbackMsg(null)}
              style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer' }}
            >
              &times;
            </button>
          </div>
        )}

        {/* Filters and search */}
        <div style={{
          padding: '14px 20px',
          display: 'flex',
          gap: '12px',
          alignItems: 'center',
          flexWrap: 'wrap',
          backgroundColor: '#0D172B',
          borderBottom: '1px solid #1E293B'
        }}>
          {/* Search box */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: '#1E293B',
            padding: '6px 12px',
            borderRadius: '6px',
            flex: '1 1 240px',
            minWidth: '220px'
          }}>
            <Search size={16} color="#64748B" />
            <input
              type="text"
              placeholder="Tìm theo tên, email, số điện thoại..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: '#F8FAFC',
                fontSize: '13px',
                width: '100%'
              }}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                style={{ background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: 0 }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Role selector filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12px', color: '#94A3B8' }}>Vai trò:</span>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              style={{
                backgroundColor: '#1E293B',
                color: '#F8FAFC',
                border: '1px solid #334155',
                borderRadius: '6px',
                padding: '6px 10px',
                fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              <option value="ALL">Tất cả vai trò</option>
              <option value="admin">Quản trị viên (ADMIN)</option>
              <option value="officer">Cán bộ trực ban (OFFICER)</option>
              <option value="citizen">Công dân (CITIZEN)</option>
            </select>
          </div>

          {/* Status selector filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12px', color: '#94A3B8' }}>Trạng thái:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                backgroundColor: '#1E293B',
                color: '#F8FAFC',
                border: '1px solid #334155',
                borderRadius: '6px',
                padding: '6px 10px',
                fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="PENDING">Chờ phê duyệt</option>
              <option value="ACTIVE">Đang hoạt động</option>
              <option value="LOCKED">Đã khóa</option>
            </select>
          </div>
        </div>

        {/* Content Table */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {loading && users.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#94A3B8' }}>
              <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 12px' }} />
              <div>Đang tải danh sách người dùng...</div>
            </div>
          ) : error ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#F87171' }}>
              <AlertCircle size={28} style={{ margin: '0 auto 12px' }} />
              <div>{error}</div>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#64748B' }}>
              <Users size={32} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
              <div>Không tìm thấy người dùng phù hợp với tiêu chí lọc</div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #1E293B', color: '#94A3B8' }}>
                    <th style={{ padding: '10px 12px', fontWeight: 500 }}>Họ tên & Email</th>
                    <th style={{ padding: '10px 12px', fontWeight: 500 }}>Số điện thoại</th>
                    <th style={{ padding: '10px 12px', fontWeight: 500 }}>Vai trò</th>
                    <th style={{ padding: '10px 12px', fontWeight: 500 }}>Phê duyệt</th>
                    <th style={{ padding: '10px 12px', fontWeight: 500 }}>Tài khoản</th>
                    <th style={{ padding: '10px 12px', fontWeight: 500, textAlign: 'right' }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((u) => {
                    const isOfficerPending = (u.approvalStatus || '').toLowerCase() === 'pending';
                    const isOfficerRejected = (u.approvalStatus || '').toLowerCase() === 'rejected';
                    const isActioning = actionLoadingId === u.userId;
                    const isSelf = me?.userId === u.userId; // server refuses these two actions on yourself (Story 4.7)

                    return (
                      <tr
                        key={u.userId}
                        style={{
                          borderBottom: '1px solid #1E293B',
                          transition: 'background 0.15s ease',
                          backgroundColor: isOfficerPending ? 'rgba(245, 158, 11, 0.05)' : 'transparent'
                        }}
                      >
                        {/* User name & email */}
                        <td style={{ padding: '12px' }}>
                          <div style={{ fontWeight: 600, color: '#F8FAFC' }}>
                            {u.fullName || 'Chưa đặt tên'}
                          </div>
                          <div style={{ fontSize: '12px', color: '#94A3B8' }}>{u.email}</div>
                          {u.departmentUnit && (
                            <div style={{ fontSize: '12px', color: '#38BDF8', marginTop: '2px' }}>Đơn vị: {u.departmentUnit}</div>
                          )}
                          {u.createdAt && (
                            <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
                              Tạo ngày: {fmtVN(u.createdAt)}
                            </div>
                          )}
                        </td>

                        {/* Phone number */}
                        <td style={{ padding: '12px', color: u.phoneNumber ? '#CBD5E1' : '#64748B' }}>
                          {u.phoneNumber || '—'}
                        </td>

                        {/* Role selection dropdown */}
                        <td style={{ padding: '12px' }}>
                          <select
                            value={(u.role || 'citizen').toLowerCase()}
                            disabled={isActioning || isSelf}
                            title={isSelf ? 'Bạn không thể tự đổi vai trò của chính mình' : undefined}
                            onChange={(e) => handleChangeRole(u, e.target.value)}
                            style={{
                              backgroundColor: '#1E293B',
                              color: u.role === 'admin' ? '#F43F5E' : u.role === 'officer' ? '#38BDF8' : '#94A3B8',
                              fontWeight: 600,
                              border: '1px solid #334155',
                              borderRadius: '6px',
                              padding: '4px 8px',
                              fontSize: '12px',
                              cursor: isActioning ? 'not-allowed' : 'pointer'
                            }}
                          >
                            <option value="admin">Quản trị viên (ADMIN)</option>
                            <option value="officer">Cán bộ trực ban (OFFICER)</option>
                            <option value="citizen">Công dân (CITIZEN)</option>
                          </select>
                        </td>

                        {/* Approval status */}
                        <td style={{ padding: '12px' }}>
                          {isOfficerPending ? (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '2px 8px',
                              borderRadius: '999px',
                              fontSize: '12px',
                              backgroundColor: 'rgba(245, 158, 11, 0.2)',
                              color: '#FBBF24',
                              border: '1px solid rgba(245, 158, 11, 0.4)'
                            }}>
                              <AlertCircle size={12} />
                              Chờ duyệt
                            </span>
                          ) : isOfficerRejected ? (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '2px 8px',
                              borderRadius: '999px',
                              fontSize: '12px',
                              backgroundColor: 'rgba(239, 68, 68, 0.2)',
                              color: '#F87171',
                              border: '1px solid rgba(239, 68, 68, 0.4)'
                            }}>
                              <XCircle size={12} />
                              Từ chối
                            </span>
                          ) : (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '2px 8px',
                              borderRadius: '999px',
                              fontSize: '12px',
                              backgroundColor: 'rgba(16, 185, 129, 0.15)',
                              color: '#34D399',
                              border: '1px solid rgba(16, 185, 129, 0.3)'
                            }}>
                              <CheckCircle2 size={12} />
                              Đã duyệt
                            </span>
                          )}
                        </td>

                        {/* Active / Locked status */}
                        <td style={{ padding: '12px' }}>
                          {u.isActive ? (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '12px',
                              color: '#34D399'
                            }}>
                              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#34D399' }} />
                              Hoạt động
                            </span>
                          ) : (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '12px',
                              color: '#F87171'
                            }}>
                              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#F87171' }} />
                              Đã khóa
                            </span>
                          )}
                        </td>

                        {/* Action buttons */}
                        <td style={{ padding: '12px', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                            {/* Approve / Reject buttons for pending accounts */}
                            {isOfficerPending && (
                              <>
                                <button
                                  onClick={() => handleApproveOfficer(u)}
                                  disabled={isActioning}
                                  title="Phê duyệt tài khoản cán bộ"
                                  style={{
                                    backgroundColor: '#059669',
                                    color: '#FFFFFF',
                                    border: 'none',
                                    borderRadius: '6px',
                                    padding: '5px 10px',
                                    fontSize: '12px',
                                    fontWeight: 500,
                                    cursor: isActioning ? 'not-allowed' : 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                  }}
                                >
                                  <UserCheck size={13} />
                                  Duyệt
                                </button>
                                <button
                                  onClick={() => handleRejectOfficer(u)}
                                  disabled={isActioning}
                                  title="Từ chối tài khoản cán bộ"
                                  style={{
                                    backgroundColor: 'transparent',
                                    color: '#F87171',
                                    border: '1px solid #7F1D1D',
                                    borderRadius: '6px',
                                    padding: '5px 8px',
                                    fontSize: '12px',
                                    cursor: isActioning ? 'not-allowed' : 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                  }}
                                >
                                  <UserX size={13} />
                                  Từ chối
                                </button>
                              </>
                            )}

                            {/* Lock / Unlock toggle */}
                            <button
                              onClick={() => handleToggleStatus(u)}
                              disabled={isActioning || isSelf}
                              title={isSelf ? 'Bạn không thể tự khóa tài khoản của chính mình' : (u.isActive ? 'Khóa tài khoản này' : 'Mở khóa tài khoản này')}
                              style={{
                                backgroundColor: u.isActive ? 'transparent' : 'rgba(16, 185, 129, 0.2)',
                                color: u.isActive ? '#94A3B8' : '#34D399',
                                border: u.isActive ? '1px solid #334155' : '1px solid #059669',
                                borderRadius: '6px',
                                padding: '5px 10px',
                                fontSize: '12px',
                                cursor: (isActioning || isSelf) ? 'not-allowed' : 'pointer',
                                opacity: isSelf ? 0.45 : 1,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                            >
                              {u.isActive ? (
                                <>
                                  <Lock size={13} />
                                  Khóa
                                </>
                              ) : (
                                <>
                                  <Unlock size={13} />
                                  Mở khóa
                                </>
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 20px',
          borderTop: '1px solid #1E293B',
          backgroundColor: '#0E1B33',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ fontSize: '12px', color: '#64748B' }}>
            TerraWatch GeoSentry Admin Console &bull; Quyền quản trị tối cao
          </div>
          <button
            onClick={onClose}
            style={{
              backgroundColor: '#1E293B',
              color: '#F8FAFC',
              border: '1px solid #334155',
              padding: '6px 16px',
              borderRadius: '6px',
              fontSize: '13px',
              cursor: 'pointer'
            }}
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
