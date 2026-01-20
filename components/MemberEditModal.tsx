'use client';

import { useState, useEffect } from 'react';
import {
  X,
  User,
  RefreshCw,
  AlertCircle,
  Save,
  Phone,
  Mail,
  Briefcase,
  Scale,
} from 'lucide-react';
import { MemberRole, ROLE_DISPLAY_NAMES } from '@/types/tenant';

interface MemberData {
  id: string;
  user_id: string;
  role: MemberRole;
  display_name?: string;
  email?: string;
  phone?: string;
  title?: string;
  bar_number?: string;
  status: string;
}

interface MemberEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  member: MemberData | null;
  currentRole: MemberRole;
  currentMemberId: string;
}

export default function MemberEditModal({
  isOpen,
  onClose,
  onSuccess,
  member,
  currentRole,
  currentMemberId,
}: MemberEditModalProps) {
  const [formData, setFormData] = useState({
    display_name: '',
    email: '',
    phone: '',
    title: '',
    bar_number: '',
    role: 'staff' as MemberRole,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 폼 초기화
  useEffect(() => {
    if (member) {
      setFormData({
        display_name: member.display_name || '',
        email: member.email || '',
        phone: member.phone || '',
        title: member.title || '',
        bar_number: member.bar_number || '',
        role: member.role,
      });
    }
  }, [member]);

  // 본인 여부
  const isSelf = member?.id === currentMemberId;

  // 역할 변경 가능 여부
  const canChangeRole = !isSelf && member?.role !== 'owner';

  // owner만 admin 역할 부여 가능
  const availableRoles: MemberRole[] =
    currentRole === 'owner' ? ['admin', 'lawyer', 'staff'] : ['lawyer', 'staff'];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!member) return;

    setError('');
    setLoading(true);

    try {
      const response = await fetch(`/api/admin/tenant/members/${member.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (!result.success) {
        setError(result.error || '수정에 실패했습니다.');
        return;
      }

      onSuccess();
      onClose();
    } catch (err) {
      console.error('Update error:', err);
      setError('서버 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setError('');
    onClose();
  };

  if (!isOpen || !member) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative bg-[var(--bg-secondary)] rounded-xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-default)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[var(--sage-muted)] flex items-center justify-center">
              <User className="w-5 h-5 text-[var(--sage-primary)]" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[var(--text-primary)]">
                멤버 정보 수정
              </h2>
              <p className="text-xs text-[var(--text-tertiary)]">
                {isSelf ? '내 정보 수정' : member.display_name || member.email || '멤버'}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-[var(--bg-hover)] rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-[var(--text-tertiary)]" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-4 bg-[var(--color-danger-muted)] border border-[var(--color-danger)] rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-[var(--color-danger)] flex-shrink-0" />
              <p className="text-sm text-[var(--color-danger)]">{error}</p>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">이름</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
              <input
                type="text"
                value={formData.display_name}
                onChange={(e) =>
                  setFormData({ ...formData, display_name: e.target.value })
                }
                placeholder="홍길동"
                disabled={loading}
                className="form-input pl-10"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="form-group">
              <label className="form-label">이메일</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  placeholder="email@example.com"
                  disabled={loading}
                  className="form-input pl-10"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">전화번호</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                  placeholder="010-1234-5678"
                  disabled={loading}
                  className="form-input pl-10"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="form-group">
              <label className="form-label">직함</label>
              <div className="relative">
                <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  placeholder="대표변호사"
                  disabled={loading}
                  className="form-input pl-10"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">변호사 등록번호</label>
              <div className="relative">
                <Scale className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                <input
                  type="text"
                  value={formData.bar_number}
                  onChange={(e) =>
                    setFormData({ ...formData, bar_number: e.target.value })
                  }
                  placeholder="12345"
                  disabled={loading}
                  className="form-input pl-10"
                />
              </div>
            </div>
          </div>

          {canChangeRole && (
            <div className="form-group">
              <label className="form-label">역할</label>
              <select
                value={formData.role}
                onChange={(e) =>
                  setFormData({ ...formData, role: e.target.value as MemberRole })
                }
                disabled={loading}
                className="form-input"
              >
                {availableRoles.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_DISPLAY_NAMES[r]}
                  </option>
                ))}
              </select>
              <p className="mt-1.5 text-xs text-[var(--text-tertiary)]">
                {formData.role === 'admin' &&
                  '관리자는 모든 기능에 접근할 수 있습니다.'}
                {formData.role === 'lawyer' &&
                  '변호사는 사건 관리가 가능하지만 회계 기능은 제한됩니다.'}
                {formData.role === 'staff' &&
                  '직원은 기본 사건 조회만 가능하며 회계 기능은 제한됩니다.'}
              </p>
            </div>
          )}

          {!canChangeRole && (
            <div className="form-group">
              <label className="form-label">역할</label>
              <div className="p-3 bg-[var(--bg-primary)] rounded-lg text-sm text-[var(--text-secondary)]">
                {ROLE_DISPLAY_NAMES[member.role]}
                {isSelf && (
                  <span className="text-xs text-[var(--text-tertiary)] ml-2">
                    (본인의 역할은 변경할 수 없습니다)
                  </span>
                )}
                {member.role === 'owner' && (
                  <span className="text-xs text-[var(--text-tertiary)] ml-2">
                    (소유자의 역할은 변경할 수 없습니다)
                  </span>
                )}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="btn btn-secondary h-10 px-6"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary h-10 px-6 flex items-center gap-2"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  저장 중...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  저장
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
