'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Building2,
  User,
  Mail,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  UserPlus,
  LogIn,
  Clock,
  XCircle,
} from 'lucide-react';
import { ROLE_DISPLAY_NAMES, MemberRole } from '@/types/tenant';

interface InvitationInfo {
  id: string;
  email: string;
  role: MemberRole;
  expiresAt: string;
}

interface TenantInfo {
  id: string;
  name: string;
  type: string;
}

interface CurrentUser {
  id: string;
  email?: string;
  emailMatches: boolean;
}

interface AcceptInvitationClientProps {
  token: string;
}

type PageState =
  | 'loading'
  | 'not_found'
  | 'expired'
  | 'already_accepted'
  | 'needs_login'
  | 'email_mismatch'
  | 'ready'
  | 'accepting'
  | 'success'
  | 'error';

export default function AcceptInvitationClient({ token }: AcceptInvitationClientProps) {
  const router = useRouter();
  const [state, setState] = useState<PageState>('loading');
  const [invitation, setInvitation] = useState<InvitationInfo | null>(null);
  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [error, setError] = useState('');
  const [displayName, setDisplayName] = useState('');

  const fetchInvitationInfo = async () => {
    setState('loading');
    setError('');

    try {
      const response = await fetch(`/api/invite/${token}`);
      const result = await response.json();

      if (!result.success) {
        switch (result.code) {
          case 'ALREADY_ACCEPTED':
            setState('already_accepted');
            break;
          case 'EXPIRED':
            setState('expired');
            break;
          default:
            setState('not_found');
            setError(result.error || '유효하지 않은 초대입니다.');
        }
        return;
      }

      setInvitation(result.data.invitation);
      setTenant(result.data.tenant);
      setCurrentUser(result.data.currentUser);

      // 상태 결정
      if (!result.data.currentUser) {
        setState('needs_login');
      } else if (!result.data.currentUser.emailMatches) {
        setState('email_mismatch');
      } else {
        setState('ready');
      }
    } catch (err) {
      console.error('Fetch invitation error:', err);
      setState('error');
      setError('서버 오류가 발생했습니다.');
    }
  };

  useEffect(() => {
    fetchInvitationInfo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleAccept = async () => {
    setState('accepting');
    setError('');

    try {
      const response = await fetch(`/api/invite/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName }),
      });

      const result = await response.json();

      if (!result.success) {
        switch (result.code) {
          case 'LOGIN_REQUIRED':
            setState('needs_login');
            break;
          case 'EMAIL_MISMATCH':
            setState('email_mismatch');
            break;
          case 'ALREADY_MEMBER':
            setState('success');
            break;
          default:
            setState('error');
            setError(result.error || '초대 수락에 실패했습니다.');
        }
        return;
      }

      setState('success');
      // 3초 후 관리자 페이지로 이동
      setTimeout(() => {
        router.push('/admin');
      }, 3000);
    } catch (err) {
      console.error('Accept invitation error:', err);
      setState('error');
      setError('서버 오류가 발생했습니다.');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // 로딩 화면
  if (state === 'loading') {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin text-[var(--sage-primary)] mx-auto mb-4" />
          <p className="text-sm text-[var(--text-tertiary)]">초대 정보를 확인하는 중...</p>
        </div>
      </div>
    );
  }

  // 찾을 수 없음
  if (state === 'not_found') {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="w-16 h-16 rounded-full bg-[var(--color-danger-muted)] flex items-center justify-center mx-auto mb-4">
            <XCircle className="w-8 h-8 text-[var(--color-danger)]" />
          </div>
          <h1 className="text-xl font-bold text-[var(--text-primary)] mb-2">
            유효하지 않은 초대
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mb-6">
            {error || '이 초대 링크는 유효하지 않거나 이미 사용되었습니다.'}
          </p>
          <Link href="/login" className="btn btn-primary h-10 px-6 inline-flex items-center">
            로그인 페이지로 이동
          </Link>
        </div>
      </div>
    );
  }

  // 만료됨
  if (state === 'expired') {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="w-16 h-16 rounded-full bg-[var(--color-warning-muted)] flex items-center justify-center mx-auto mb-4">
            <Clock className="w-8 h-8 text-[var(--color-warning)]" />
          </div>
          <h1 className="text-xl font-bold text-[var(--text-primary)] mb-2">
            만료된 초대
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mb-6">
            이 초대는 만료되었습니다. 관리자에게 새 초대를 요청해주세요.
          </p>
          <Link href="/login" className="btn btn-primary h-10 px-6 inline-flex items-center">
            로그인 페이지로 이동
          </Link>
        </div>
      </div>
    );
  }

  // 이미 수락됨
  if (state === 'already_accepted') {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="w-16 h-16 rounded-full bg-[var(--color-info-muted)] flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-[var(--color-info)]" />
          </div>
          <h1 className="text-xl font-bold text-[var(--text-primary)] mb-2">
            이미 수락된 초대
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mb-6">
            이 초대는 이미 수락되었습니다.
          </p>
          <Link href="/admin" className="btn btn-primary h-10 px-6 inline-flex items-center">
            관리자 페이지로 이동
          </Link>
        </div>
      </div>
    );
  }

  // 로그인 필요
  if (state === 'needs_login') {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="card p-8">
            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-full bg-[var(--sage-muted)] flex items-center justify-center mx-auto mb-4">
                <UserPlus className="w-8 h-8 text-[var(--sage-primary)]" />
              </div>
              <h1 className="text-xl font-bold text-[var(--text-primary)] mb-2">
                팀원 초대
              </h1>
              {tenant && (
                <p className="text-sm text-[var(--text-secondary)]">
                  <span className="font-medium">{tenant.name}</span>에서 초대를 보냈습니다
                </p>
              )}
            </div>

            {invitation && (
              <div className="mb-6 p-4 bg-[var(--bg-primary)] rounded-lg">
                <div className="flex items-center gap-3 mb-3">
                  <Mail className="w-4 h-4 text-[var(--text-muted)]" />
                  <span className="text-sm text-[var(--text-primary)]">{invitation.email}</span>
                </div>
                <div className="flex items-center gap-3">
                  <User className="w-4 h-4 text-[var(--text-muted)]" />
                  <span className="text-sm text-[var(--text-secondary)]">
                    {ROLE_DISPLAY_NAMES[invitation.role]} 역할로 초대됨
                  </span>
                </div>
              </div>
            )}

            <div className="p-4 bg-[var(--color-info-muted)] border border-[var(--color-info)] rounded-lg mb-6">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-[var(--color-info)] flex-shrink-0 mt-0.5" />
                <p className="text-sm text-[var(--text-secondary)]">
                  초대를 수락하려면 먼저 로그인이 필요합니다.
                  <br />
                  초대받은 이메일 주소로 로그인해주세요.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <Link
                href={`/login?redirect=/invite/${token}`}
                className="btn btn-primary w-full h-10 flex items-center justify-center gap-2"
              >
                <LogIn className="w-4 h-4" />
                로그인
              </Link>
              <Link
                href={`/register?redirect=/invite/${token}&email=${encodeURIComponent(invitation?.email || '')}`}
                className="btn btn-secondary w-full h-10 flex items-center justify-center gap-2"
              >
                <UserPlus className="w-4 h-4" />
                계정 만들기
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 이메일 불일치
  if (state === 'email_mismatch') {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="card p-8">
            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-full bg-[var(--color-warning-muted)] flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-8 h-8 text-[var(--color-warning)]" />
              </div>
              <h1 className="text-xl font-bold text-[var(--text-primary)] mb-2">
                이메일 불일치
              </h1>
              <p className="text-sm text-[var(--text-secondary)]">
                로그인한 계정의 이메일과 초대받은 이메일이 다릅니다.
              </p>
            </div>

            <div className="mb-6 p-4 bg-[var(--bg-primary)] rounded-lg space-y-3">
              <div>
                <p className="text-xs text-[var(--text-tertiary)] mb-1">초대받은 이메일</p>
                <p className="text-sm font-medium text-[var(--text-primary)]">
                  {invitation?.email}
                </p>
              </div>
              <div>
                <p className="text-xs text-[var(--text-tertiary)] mb-1">로그인된 이메일</p>
                <p className="text-sm font-medium text-[var(--text-primary)]">
                  {currentUser?.email}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <Link
                href={`/login?redirect=/invite/${token}`}
                className="btn btn-primary w-full h-10 flex items-center justify-center gap-2"
              >
                <LogIn className="w-4 h-4" />
                다른 계정으로 로그인
              </Link>
              <button
                onClick={() => router.push('/admin')}
                className="btn btn-secondary w-full h-10"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 성공
  if (state === 'success') {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="w-16 h-16 rounded-full bg-[var(--color-success-muted)] flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-[var(--color-success)]" />
          </div>
          <h1 className="text-xl font-bold text-[var(--text-primary)] mb-2">
            환영합니다!
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mb-6">
            {tenant?.name}에 합류하셨습니다.
            <br />
            잠시 후 관리자 페이지로 이동합니다...
          </p>
          <RefreshCw className="w-6 h-6 animate-spin text-[var(--sage-primary)] mx-auto" />
        </div>
      </div>
    );
  }

  // 에러
  if (state === 'error') {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="w-16 h-16 rounded-full bg-[var(--color-danger-muted)] flex items-center justify-center mx-auto mb-4">
            <XCircle className="w-8 h-8 text-[var(--color-danger)]" />
          </div>
          <h1 className="text-xl font-bold text-[var(--text-primary)] mb-2">오류 발생</h1>
          <p className="text-sm text-[var(--text-secondary)] mb-6">
            {error || '알 수 없는 오류가 발생했습니다.'}
          </p>
          <button onClick={fetchInvitationInfo} className="btn btn-primary h-10 px-6">
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  // 수락 준비 (ready 또는 accepting)
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="card p-8">
          <div className="text-center mb-6">
            <div className="w-16 h-16 rounded-full bg-[var(--sage-muted)] flex items-center justify-center mx-auto mb-4">
              <Building2 className="w-8 h-8 text-[var(--sage-primary)]" />
            </div>
            <h1 className="text-xl font-bold text-[var(--text-primary)] mb-2">
              팀원 초대
            </h1>
            {tenant && (
              <p className="text-sm text-[var(--text-secondary)]">
                <span className="font-medium">{tenant.name}</span>에 합류하시겠습니까?
              </p>
            )}
          </div>

          {invitation && (
            <div className="mb-6 p-4 bg-[var(--bg-primary)] rounded-lg space-y-3">
              <div className="flex items-center gap-3">
                <Mail className="w-4 h-4 text-[var(--text-muted)]" />
                <span className="text-sm text-[var(--text-primary)]">{invitation.email}</span>
              </div>
              <div className="flex items-center gap-3">
                <User className="w-4 h-4 text-[var(--text-muted)]" />
                <span className="text-sm text-[var(--text-secondary)]">
                  {ROLE_DISPLAY_NAMES[invitation.role]} 역할로 초대됨
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Clock className="w-4 h-4 text-[var(--text-muted)]" />
                <span className="text-xs text-[var(--text-tertiary)]">
                  {formatDate(invitation.expiresAt)}까지 유효
                </span>
              </div>
            </div>
          )}

          <div className="mb-6">
            <label className="form-label">표시 이름 (선택)</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="홍길동"
              disabled={state === 'accepting'}
              className="form-input"
            />
            <p className="mt-1.5 text-xs text-[var(--text-tertiary)]">
              팀원들에게 표시될 이름입니다. 나중에 변경할 수 있습니다.
            </p>
          </div>

          <div className="space-y-3">
            <button
              onClick={handleAccept}
              disabled={state === 'accepting'}
              className="btn btn-primary w-full h-10 flex items-center justify-center gap-2"
            >
              {state === 'accepting' ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  처리 중...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  초대 수락
                </>
              )}
            </button>
            <button
              onClick={() => router.push('/')}
              disabled={state === 'accepting'}
              className="btn btn-secondary w-full h-10"
            >
              취소
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
