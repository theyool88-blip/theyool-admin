'use client';

import { useEffect, useState } from 'react';
import {
  Users,
  UserPlus,
  RefreshCw,
  AlertCircle,
  Crown,
  Shield,
  Scale,
  UserCircle,
  MoreVertical,
  Edit2,
  Trash2,
  Ban,
  CheckCircle,
  Mail,
  Clock,
  Copy,
  Check,
  X,
  Settings,
} from 'lucide-react';
import { MemberRole, ROLE_DISPLAY_NAMES } from '@/types/tenant';
import InviteMemberModal from '@/components/InviteMemberModal';
import MemberEditModal from '@/components/MemberEditModal';
import MemberPermissionModal from './MemberPermissionModal';

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
  joined_at?: string;
}

interface InvitationData {
  id: string;
  tenant_id: string;
  email: string;
  role: MemberRole;
  token: string;
  status: 'pending' | 'accepted' | 'expired';
  expires_at: string;
  invited_by: string;
  created_at: string;
  accepted_at?: string;
}

interface MemberListProps {
  currentMemberId: string;
  currentRole: MemberRole;
  tenantType: string;
}

export default function MemberList({
  currentMemberId,
  currentRole,
  tenantType,
}: MemberListProps) {
  const [members, setMembers] = useState<MemberData[]>([]);
  const [invitations, setInvitations] = useState<InvitationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [memberLimit, setMemberLimit] = useState(2);
  const [canInvite, setCanInvite] = useState(false);

  // Modals
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState<MemberData | null>(null);

  // Dropdown
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  // Copy state
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // Action loading
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchMembers = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/admin/tenant/members');
      const result = await response.json();

      if (!result.success) {
        setError(result.error || '멤버 목록을 가져올 수 없습니다.');
        return;
      }

      setMembers(result.data.members || []);
      setInvitations(result.data.invitations || []);
      setMemberLimit(result.data.memberLimit);
      setCanInvite(result.data.canInvite);
    } catch (err) {
      console.error('Fetch members error:', err);
      setError('서버 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, []);

  // 드롭다운 외부 클릭 처리
  useEffect(() => {
    const handleClickOutside = () => setOpenDropdown(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const getRoleIcon = (role: MemberRole) => {
    switch (role) {
      case 'owner':
        return <Crown className="w-4 h-4 text-[var(--color-warning)]" />;
      case 'admin':
        return <Shield className="w-4 h-4 text-[var(--color-info)]" />;
      case 'lawyer':
        return <Scale className="w-4 h-4 text-[var(--sage-primary)]" />;
      default:
        return <UserCircle className="w-4 h-4 text-[var(--text-muted)]" />;
    }
  };

  const handleEdit = (member: MemberData) => {
    setSelectedMember(member);
    setShowEditModal(true);
    setOpenDropdown(null);
  };

  const handlePermissions = (member: MemberData) => {
    setSelectedMember(member);
    setShowPermissionModal(true);
    setOpenDropdown(null);
  };

  const handleSuspend = async (member: MemberData) => {
    if (!confirm(`${member.display_name || member.email}을(를) 정지하시겠습니까?`)) {
      return;
    }

    setActionLoading(member.id);
    setOpenDropdown(null);

    try {
      const response = await fetch(`/api/admin/tenant/members/${member.id}/suspend`, {
        method: 'POST',
      });

      const result = await response.json();

      if (!result.success) {
        alert(result.error || '정지에 실패했습니다.');
        return;
      }

      fetchMembers();
    } catch (err) {
      console.error('Suspend error:', err);
      alert('서버 오류가 발생했습니다.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnsuspend = async (member: MemberData) => {
    setActionLoading(member.id);
    setOpenDropdown(null);

    try {
      const response = await fetch(`/api/admin/tenant/members/${member.id}/suspend`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (!result.success) {
        alert(result.error || '정지 해제에 실패했습니다.');
        return;
      }

      fetchMembers();
    } catch (err) {
      console.error('Unsuspend error:', err);
      alert('서버 오류가 발생했습니다.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRemove = async (member: MemberData) => {
    if (
      !confirm(
        `${member.display_name || member.email}을(를) 정말 제거하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`
      )
    ) {
      return;
    }

    setActionLoading(member.id);
    setOpenDropdown(null);

    try {
      const response = await fetch(`/api/admin/tenant/members/${member.id}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (!result.success) {
        alert(result.error || '제거에 실패했습니다.');
        return;
      }

      fetchMembers();
    } catch (err) {
      console.error('Remove error:', err);
      alert('서버 오류가 발생했습니다.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancelInvitation = async (invitation: InvitationData) => {
    if (!confirm(`${invitation.email}에 대한 초대를 취소하시겠습니까?`)) {
      return;
    }

    setActionLoading(invitation.id);

    try {
      const response = await fetch(`/api/admin/tenant/invitations/${invitation.id}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (!result.success) {
        alert(result.error || '초대 취소에 실패했습니다.');
        return;
      }

      fetchMembers();
    } catch (err) {
      console.error('Cancel invitation error:', err);
      alert('서버 오류가 발생했습니다.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleResendInvitation = async (invitation: InvitationData) => {
    setActionLoading(invitation.id);

    try {
      const response = await fetch(
        `/api/admin/tenant/invitations/${invitation.id}?action=resend`,
        {
          method: 'POST',
        }
      );

      const result = await response.json();

      if (!result.success) {
        alert(result.error || '재전송에 실패했습니다.');
        return;
      }

      if (result.data.inviteUrl) {
        await navigator.clipboard.writeText(result.data.inviteUrl);
        alert('새 초대 링크가 생성되어 클립보드에 복사되었습니다.');
      }

      fetchMembers();
    } catch (err) {
      console.error('Resend invitation error:', err);
      alert('서버 오류가 발생했습니다.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCopyInviteLink = async (token: string) => {
    const url = `${window.location.origin}/invite/${token}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedToken(token);
      setTimeout(() => setCopiedToken(null), 2000);
    } catch (err) {
      console.error('Copy error:', err);
    }
  };

  const _formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    const yy = String(date.getFullYear()).slice(2);
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yy}.${mm}.${dd}`;
  };

  const getExpiresIn = (expiresAt: string) => {
    const now = new Date();
    const expires = new Date(expiresAt);
    const diff = expires.getTime() - now.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (days > 0) return `${days}일 남음`;
    if (hours > 0) return `${hours}시간 남음`;
    return '곧 만료';
  };

  const canManageMember = (member: MemberData) => {
    if (member.id === currentMemberId) return false;
    if (member.role === 'owner') return false;
    if (member.role === 'admin' && currentRole !== 'owner') return false;
    return true;
  };

  if (loading) {
    return (
      <div className="card p-6">
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="w-6 h-6 animate-spin text-[var(--sage-primary)]" />
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="card p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[var(--sage-muted)] flex items-center justify-center">
              <Users className="w-5 h-5 text-[var(--sage-primary)]" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">권한 설정</h2>
              <p className="text-xs text-[var(--text-tertiary)]">
                {members.length}명 / {memberLimit === -1 ? '무제한' : `${memberLimit}명`}
              </p>
            </div>
          </div>

          {tenantType === 'firm' && ['owner', 'admin'].includes(currentRole) && (
            <button
              onClick={() => setShowInviteModal(true)}
              className="btn btn-primary h-9 px-4 text-sm flex items-center gap-2"
            >
              <UserPlus className="w-4 h-4" />
              팀원 초대
            </button>
          )}
        </div>

        {error && (
          <div className="mb-4 p-4 bg-[var(--color-danger-muted)] border border-[var(--color-danger)] rounded-lg flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-[var(--color-danger)] flex-shrink-0" />
            <p className="text-sm text-[var(--color-danger)]">{error}</p>
          </div>
        )}

        {/* Members List */}
        <div className="space-y-3">
          {members.map((member) => (
            <div
              key={member.id}
              className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                member.status === 'suspended'
                  ? 'bg-[var(--color-danger-muted)] opacity-60'
                  : 'bg-[var(--bg-primary)]'
              }`}
            >
              <div className="w-10 h-10 rounded-full bg-[var(--sage-muted)] flex items-center justify-center flex-shrink-0">
                {getRoleIcon(member.role)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                    {member.display_name || '이름 없음'}
                  </p>
                  <span className="text-xs px-1.5 py-0.5 bg-[var(--bg-tertiary)] text-[var(--text-secondary)] rounded">
                    {ROLE_DISPLAY_NAMES[member.role]}
                  </span>
                  {member.id === currentMemberId && (
                    <span className="text-xs text-[var(--sage-primary)]">(나)</span>
                  )}
                </div>
                <p className="text-xs text-[var(--text-tertiary)] truncate">
                  {member.email || member.bar_number || '-'}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={`text-xs px-2 py-0.5 rounded ${
                    member.status === 'active'
                      ? 'bg-[var(--color-success-muted)] text-[var(--color-success)]'
                      : member.status === 'suspended'
                      ? 'bg-[var(--color-danger-muted)] text-[var(--color-danger)]'
                      : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)]'
                  }`}
                >
                  {member.status === 'active' && '활성'}
                  {member.status === 'suspended' && '정지됨'}
                  {member.status === 'invited' && '초대됨'}
                </span>

                {/* Actions Dropdown */}
                {['owner', 'admin'].includes(currentRole) && (
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenDropdown(openDropdown === member.id ? null : member.id);
                      }}
                      disabled={actionLoading === member.id}
                      className="p-1.5 hover:bg-[var(--bg-hover)] rounded transition-colors"
                    >
                      {actionLoading === member.id ? (
                        <RefreshCw className="w-4 h-4 animate-spin text-[var(--text-muted)]" />
                      ) : (
                        <MoreVertical className="w-4 h-4 text-[var(--text-muted)]" />
                      )}
                    </button>

                    {openDropdown === member.id && (
                      <div className="absolute right-0 top-full mt-1 w-44 bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-lg shadow-lg z-10 py-1">
                        <button
                          onClick={() => handleEdit(member)}
                          className="w-full px-3 py-2 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--bg-hover)] flex items-center gap-2"
                        >
                          <Edit2 className="w-4 h-4" />
                          정보 수정
                        </button>

                        {canManageMember(member) && (
                          <button
                            onClick={() => handlePermissions(member)}
                            className="w-full px-3 py-2 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--bg-hover)] flex items-center gap-2"
                          >
                            <Settings className="w-4 h-4" />
                            권한 설정
                          </button>
                        )}

                        {canManageMember(member) && (
                          <>
                            <div className="my-1 border-t border-[var(--border-default)]" />
                            {member.status === 'active' ? (
                              <button
                                onClick={() => handleSuspend(member)}
                                className="w-full px-3 py-2 text-left text-sm text-[var(--color-warning)] hover:bg-[var(--bg-hover)] flex items-center gap-2"
                              >
                                <Ban className="w-4 h-4" />
                                정지하기
                              </button>
                            ) : member.status === 'suspended' ? (
                              <button
                                onClick={() => handleUnsuspend(member)}
                                className="w-full px-3 py-2 text-left text-sm text-[var(--color-success)] hover:bg-[var(--bg-hover)] flex items-center gap-2"
                              >
                                <CheckCircle className="w-4 h-4" />
                                정지 해제
                              </button>
                            ) : null}

                            <button
                              onClick={() => handleRemove(member)}
                              className="w-full px-3 py-2 text-left text-sm text-[var(--color-danger)] hover:bg-[var(--bg-hover)] flex items-center gap-2"
                            >
                              <Trash2 className="w-4 h-4" />
                              멤버 제거
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Pending Invitations */}
        {invitations.length > 0 && (
          <div className="mt-6 pt-6 border-t border-[var(--border-default)]">
            <h3 className="text-sm font-medium text-[var(--text-primary)] mb-3 flex items-center gap-2">
              <Mail className="w-4 h-4 text-[var(--text-muted)]" />
              대기중인 초대
            </h3>

            <div className="space-y-2">
              {invitations.map((invitation) => (
                <div
                  key={invitation.id}
                  className="flex items-center gap-3 p-3 bg-[var(--bg-primary)] rounded-lg"
                >
                  <div className="w-8 h-8 rounded-full bg-[var(--color-info-muted)] flex items-center justify-center flex-shrink-0">
                    <Mail className="w-4 h-4 text-[var(--color-info)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[var(--text-primary)] truncate">
                      {invitation.email}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-[var(--text-tertiary)]">
                      <span>{ROLE_DISPLAY_NAMES[invitation.role]}</span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {getExpiresIn(invitation.expires_at)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleCopyInviteLink(invitation.token)}
                      className="p-1.5 hover:bg-[var(--bg-hover)] rounded transition-colors"
                      title="초대 링크 복사"
                    >
                      {copiedToken === invitation.token ? (
                        <Check className="w-4 h-4 text-[var(--color-success)]" />
                      ) : (
                        <Copy className="w-4 h-4 text-[var(--text-muted)]" />
                      )}
                    </button>
                    <button
                      onClick={() => handleResendInvitation(invitation)}
                      disabled={actionLoading === invitation.id}
                      className="p-1.5 hover:bg-[var(--bg-hover)] rounded transition-colors"
                      title="초대 재전송"
                    >
                      {actionLoading === invitation.id ? (
                        <RefreshCw className="w-4 h-4 animate-spin text-[var(--text-muted)]" />
                      ) : (
                        <RefreshCw className="w-4 h-4 text-[var(--text-muted)]" />
                      )}
                    </button>
                    <button
                      onClick={() => handleCancelInvitation(invitation)}
                      disabled={actionLoading === invitation.id}
                      className="p-1.5 hover:bg-[var(--bg-hover)] rounded transition-colors"
                      title="초대 취소"
                    >
                      <X className="w-4 h-4 text-[var(--color-danger)]" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <InviteMemberModal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        onSuccess={fetchMembers}
        currentRole={currentRole}
        canInvite={canInvite}
        memberLimit={memberLimit}
      />

      <MemberEditModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setSelectedMember(null);
        }}
        onSuccess={fetchMembers}
        member={selectedMember}
        currentRole={currentRole}
        currentMemberId={currentMemberId}
      />

      {selectedMember && (
        <MemberPermissionModal
          isOpen={showPermissionModal}
          onClose={() => {
            setShowPermissionModal(false);
            setSelectedMember(null);
          }}
          member={selectedMember}
          currentRole={currentRole}
        />
      )}
    </>
  );
}
