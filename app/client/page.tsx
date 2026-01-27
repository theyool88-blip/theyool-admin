'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getCourtAbbrev } from '@/lib/scourt/court-codes';

interface Case {
  id: string;
  case_name: string;
  case_number: string;
  case_type: string;
  status: string;
  office_location: string;
  created_at: string;
  opponent_name?: string;
}

interface Hearing {
  id: string;
  hearing_date: string;
  hearing_time: string;
  court_name: string;
  case_number: string;
  case_name: string;
}

export default function ClientDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [cases, setCases] = useState<Case[]>([]);
  const [upcomingHearings, setUpcomingHearings] = useState<Hearing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/client/login');
    }
  }, [status, router]);

  useEffect(() => {
    if (session?.user?.id) {
      fetchClientData();
    }
  }, [session]);

  async function fetchClientData() {
    try {
      const res = await fetch(`/api/client/dashboard`);
      const data = await res.json();

      if (data.success) {
        setCases(data.cases || []);
        setUpcomingHearings(data.upcomingHearings || []);
      }
    } catch (error) {
      console.error('데이터 로딩 실패:', error);
    } finally {
      setLoading(false);
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)]">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-[var(--sage-primary)] border-t-transparent"></div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <span className="px-2 py-0.5 text-xs rounded-full bg-[var(--color-success-muted)] text-[var(--color-success)]">진행중</span>;
      case 'completed':
        return <span className="px-2 py-0.5 text-xs rounded-full bg-[var(--bg-tertiary)] text-[var(--text-secondary)]">완료</span>;
      case 'suspended':
        return <span className="px-2 py-0.5 text-xs rounded-full bg-[var(--color-warning-muted)] text-[var(--color-warning)]">중단</span>;
      default:
        return <span className="px-2 py-0.5 text-xs rounded-full bg-[var(--bg-tertiary)] text-[var(--text-secondary)]">{status}</span>;
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* 헤더 */}
      <header className="bg-[var(--bg-secondary)] border-b border-[var(--border-default)] sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-[var(--text-primary)]">법무법인 더율</h1>
            <p className="text-xs text-[var(--text-tertiary)]">의뢰인 포털</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-[var(--text-secondary)]">{session.user?.name}님</span>
            <button
              onClick={() => signOut({ callbackUrl: '/client/login' })}
              className="btn-ghost text-xs"
            >
              로그아웃
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">
        {/* 다가오는 재판 */}
        {upcomingHearings.length > 0 && (
          <section className="mb-6">
            <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-3">다가오는 재판</h2>
            <div className="space-y-2">
              {upcomingHearings.map((hearing) => (
                <div
                  key={hearing.id}
                  className="card p-4"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-[var(--text-primary)]">
                        {hearing.hearing_date} {hearing.hearing_time}
                      </p>
                      <p className="text-xs text-[var(--text-tertiary)] mt-1">{getCourtAbbrev(hearing.court_name)}</p>
                      <p className="text-xs text-[var(--text-muted)] mt-0.5">{hearing.case_name}</p>
                    </div>
                    <span className="px-2 py-0.5 text-xs rounded-full bg-[var(--color-info-muted)] text-[var(--color-info)]">
                      예정
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 내 사건 목록 */}
        <section>
          <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-3">내 사건</h2>

          {cases.length === 0 ? (
            <div className="card p-8 text-center">
              <p className="text-sm text-[var(--text-tertiary)]">등록된 사건이 없습니다.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {cases.map((caseItem) => (
                <Link
                  key={caseItem.id}
                  href={`/client/cases/${caseItem.id}`}
                  className="block card p-4 hover:border-[var(--sage-primary)] transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                          {caseItem.case_name}
                        </p>
                        {getStatusBadge(caseItem.status)}
                      </div>
                      {caseItem.case_number && (
                        <p className="text-xs text-[var(--text-tertiary)] mt-1">{caseItem.case_number}</p>
                      )}
                      <div className="flex items-center gap-2 mt-2 text-xs text-[var(--text-muted)]">
                        <span>{caseItem.case_type}</span>
                        <span>·</span>
                        <span>{caseItem.office_location}</span>
                      </div>
                    </div>
                    <svg className="w-5 h-5 text-[var(--border-default)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* 문의 안내 */}
        <section className="mt-8 p-4 bg-[var(--sage-muted)] rounded-lg">
          <p className="text-sm text-[var(--sage-primary)] text-center">
            문의사항이 있으시면 <strong>1661-7633</strong>으로 연락주세요.
          </p>
        </section>
      </main>
    </div>
  );
}
