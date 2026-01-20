'use client';

import { useState } from 'react';
import {
  X,
  Mail,
  UserPlus,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Copy,
  Check,
} from 'lucide-react';
import { MemberRole, ROLE_DISPLAY_NAMES } from '@/types/tenant';

interface InviteMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  currentRole: MemberRole;
  canInvite: boolean;
  memberLimit: number;
}

export default function InviteMemberModal({
  isOpen,
  onClose,
  onSuccess,
  currentRole,
  canInvite,
  memberLimit,
}: InviteMemberModalProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<MemberRole>('staff');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // owner만 admin 역할 부여 가능
  const availableRoles: MemberRole[] =
    currentRole === 'owner' ? ['admin', 'lawyer', 'staff'] : ['lawyer', 'staff'];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInviteUrl(null);
    setLoading(true);

    try {
      const response = await fetch('/api/admin/tenant/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role }),
      });

      const result = await response.json();

      if (!result.success) {
        setError(result.error || '초대에 실패했습니다.');
        return;
      }

      setInviteUrl(result.data.inviteUrl);
    } catch (err) {
      console.error('Invite error:', err);
      setError('서버 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = async () => {
    if (!inviteUrl) return;

    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Copy error:', err);
    }
  };

  const handleClose = () => {
    setEmail('');
    setRole('staff');
    setError('');
    setInviteUrl(null);
    setCopied(false);
    if (inviteUrl) {
      onSuccess(); // 초대가 생성된 경우에만 새로고침
    }
    onClose();
  };

  if (!isOpen) return null;

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
              <UserPlus className="w-5 h-5 text-[var(--sage-primary)]" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[var(--text-primary)]">멤버 초대</h2>
              <p className="text-xs text-[var(--text-tertiary)]">
                이메일로 팀원을 초대하세요
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
        <div className="p-6">
          {!canInvite && (
            <div className="mb-4 p-4 bg-[var(--color-warning-muted)] border border-[var(--color-warning)] rounded-lg">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-[var(--color-warning)] flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-[var(--color-warning)]">
                    멤버 제한에 도달했습니다
                  </p>
                  <p className="text-xs text-[var(--text-secondary)] mt-1">
                    현재 플랜에서는 최대 {memberLimit}명까지 멤버를 추가할 수 있습니다.
                    더 많은 멤버를 초대하려면 플랜을 업그레이드하세요.
                  </p>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="mb-4 p-4 bg-[var(--color-danger-muted)] border border-[var(--color-danger)] rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-[var(--color-danger)] flex-shrink-0" />
              <p className="text-sm text-[var(--color-danger)]">{error}</p>
            </div>
          )}

          {inviteUrl ? (
            // 초대 링크 표시
            <div className="space-y-4">
              <div className="p-4 bg-[var(--color-success-muted)] border border-[var(--color-success)] rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-4 h-4 text-[var(--color-success)]" />
                  <p className="text-sm font-medium text-[var(--color-success)]">
                    초대가 생성되었습니다
                  </p>
                </div>
                <p className="text-xs text-[var(--text-secondary)]">
                  아래 링크를 복사하여 {email}에게 전달해주세요.
                </p>
              </div>

              <div className="form-group">
                <label className="form-label">초대 링크</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={inviteUrl}
                    readOnly
                    className="form-input flex-1 text-sm font-mono"
                  />
                  <button
                    onClick={handleCopyLink}
                    className="btn btn-primary h-10 px-4 flex items-center gap-2"
                  >
                    {copied ? (
                      <>
                        <Check className="w-4 h-4" />
                        복사됨
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        복사
                      </>
                    )}
                  </button>
                </div>
                <p className="mt-2 text-xs text-[var(--text-tertiary)]">
                  이 링크는 7일 동안 유효합니다.
                </p>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={handleClose}
                  className="btn btn-secondary h-10 px-6"
                >
                  닫기
                </button>
              </div>
            </div>
          ) : (
            // 초대 폼
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="form-group">
                <label className="form-label">이메일</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="member@example.com"
                    disabled={!canInvite || loading}
                    className="form-input pl-10"
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">역할</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as MemberRole)}
                  disabled={!canInvite || loading}
                  className="form-input"
                >
                  {availableRoles.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_DISPLAY_NAMES[r]}
                    </option>
                  ))}
                </select>
                <p className="mt-1.5 text-xs text-[var(--text-tertiary)]">
                  {role === 'admin' && '관리자는 모든 기능에 접근할 수 있습니다.'}
                  {role === 'lawyer' && '변호사는 사건 관리가 가능하지만 회계 기능은 제한됩니다.'}
                  {role === 'staff' && '직원은 기본 사건 조회만 가능하며 회계 기능은 제한됩니다.'}
                </p>
              </div>

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
                  disabled={!canInvite || loading || !email}
                  className="btn btn-primary h-10 px-6 flex items-center gap-2"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      초대 중...
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" />
                      초대하기
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
