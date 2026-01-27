'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getCourtAbbrev } from '@/lib/scourt/court-codes';

interface CaseDetail {
  id: string;
  case_name: string;
  case_number: string;
  case_type: string;
  status: string;
  office_location: string;
  court_name: string;
  opponent_name: string;
  lawyer_name: string;
  description: string;
  created_at: string;
}

interface Hearing {
  id: string;
  hearing_date: string;
  hearing_time: string;
  court_name: string;
  hearing_type: string;
  hearing_result: string;
  judge_name: string;
  hearing_report: string;
}

interface Deadline {
  id: string;
  deadline_date: string;
  deadline_type: string;
  description: string;
  is_completed: boolean;
}

export default function CaseDetailPage() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();
  const params = useParams();
  const caseId = params.id as string;

  const [caseDetail, setCaseDetail] = useState<CaseDetail | null>(null);
  const [hearings, setHearings] = useState<Hearing[]>([]);
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'hearings' | 'deadlines'>('overview');

  useEffect(() => {
    if (sessionStatus === 'unauthenticated') {
      router.push('/client/login');
    }
  }, [sessionStatus, router]);

  useEffect(() => {
    if (session?.user?.id && caseId) {
      fetchCaseDetail();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, caseId]);

  async function fetchCaseDetail() {
    try {
      const res = await fetch(`/api/client/cases/${caseId}`);
      const data = await res.json();

      if (data.success) {
        setCaseDetail(data.case);
        setHearings(data.hearings || []);
        setDeadlines(data.deadlines || []);
      } else {
        router.push('/client');
      }
    } catch (error) {
      console.error('사건 조회 실패:', error);
      router.push('/client');
    } finally {
      setLoading(false);
    }
  }

  if (sessionStatus === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)]">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-[var(--sage-primary)] border-t-transparent"></div>
      </div>
    );
  }

  if (!session || !caseDetail) {
    return null;
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <span className="px-2 py-0.5 text-xs rounded-full bg-[var(--color-success-muted)] text-[var(--color-success)]">진행중</span>;
      case 'completed':
        return <span className="px-2 py-0.5 text-xs rounded-full bg-[var(--bg-tertiary)] text-[var(--text-secondary)]">완료</span>;
      case 'suspended':
        return <span className="px-2 py-0.5 text-xs rounded-full bg-yellow-100 text-yellow-700">중단</span>;
      default:
        return <span className="px-2 py-0.5 text-xs rounded-full bg-[var(--bg-tertiary)] text-[var(--text-secondary)]">{status}</span>;
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* 헤더 */}
      <header className="bg-[var(--bg-secondary)] border-b border-[var(--border-default)] sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <Link href="/client" className="text-[var(--text-muted)] hover:text-[var(--text-secondary)]">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-[var(--text-primary)]">{caseDetail.case_name}</h1>
                {getStatusBadge(caseDetail.status)}
              </div>
              {caseDetail.case_number && (
                <p className="text-xs text-[var(--text-tertiary)]">{caseDetail.case_number}</p>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* 탭 */}
      <div className="bg-[var(--bg-secondary)] border-b border-[var(--border-default)]">
        <div className="max-w-3xl mx-auto px-4">
          <div className="flex gap-6">
            <button
              onClick={() => setActiveTab('overview')}
              className={`py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'overview'
                  ? 'border-[var(--sage-primary)] text-[var(--sage-primary)]'
                  : 'border-transparent text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
              }`}
            >
              개요
            </button>
            <button
              onClick={() => setActiveTab('hearings')}
              className={`py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'hearings'
                  ? 'border-[var(--sage-primary)] text-[var(--sage-primary)]'
                  : 'border-transparent text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
              }`}
            >
              재판기일 ({hearings.length})
            </button>
            <button
              onClick={() => setActiveTab('deadlines')}
              className={`py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'deadlines'
                  ? 'border-[var(--sage-primary)] text-[var(--sage-primary)]'
                  : 'border-transparent text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
              }`}
            >
              기한 ({deadlines.length})
            </button>
          </div>
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-4 py-6">
        {/* 개요 탭 */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            <div className="card rounded-lg p-4">
              <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-3">사건 정보</h2>
              <div className="space-y-2 text-sm">
                <div className="flex">
                  <span className="w-20 text-[var(--text-tertiary)]">사건유형</span>
                  <span className="text-[var(--text-primary)]">{caseDetail.case_type}</span>
                </div>
                <div className="flex">
                  <span className="w-20 text-[var(--text-tertiary)]">관할법원</span>
                  <span className="text-[var(--text-primary)]">{getCourtAbbrev(caseDetail.court_name || '') || '-'}</span>
                </div>
                <div className="flex">
                  <span className="w-20 text-[var(--text-tertiary)]">상대방</span>
                  <span className="text-[var(--text-primary)]">{caseDetail.opponent_name || '-'}</span>
                </div>
                <div className="flex">
                  <span className="w-20 text-[var(--text-tertiary)]">담당변호사</span>
                  <span className="text-[var(--text-primary)]">{caseDetail.lawyer_name || '-'}</span>
                </div>
                <div className="flex">
                  <span className="w-20 text-[var(--text-tertiary)]">사무소</span>
                  <span className="text-[var(--text-primary)]">{caseDetail.office_location}</span>
                </div>
              </div>
            </div>

            {caseDetail.description && (
              <div className="card rounded-lg p-4">
                <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-2">사건 설명</h2>
                <p className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap">{caseDetail.description}</p>
              </div>
            )}
          </div>
        )}

        {/* 재판기일 탭 */}
        {activeTab === 'hearings' && (
          <div className="space-y-3">
            {hearings.length === 0 ? (
              <div className="card rounded-lg p-8 text-center">
                <p className="text-sm text-[var(--text-tertiary)]">등록된 재판기일이 없습니다.</p>
              </div>
            ) : (
              hearings.map((hearing) => (
                <div key={hearing.id} className="card rounded-lg p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-sm font-medium text-[var(--text-primary)]">
                        {hearing.hearing_date} {hearing.hearing_time}
                      </p>
                      <p className="text-xs text-[var(--text-tertiary)]">{getCourtAbbrev(hearing.court_name)}</p>
                    </div>
                    {hearing.hearing_result && (
                      <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700">
                        {hearing.hearing_result}
                      </span>
                    )}
                  </div>

                  {hearing.hearing_type && (
                    <p className="text-xs text-[var(--text-tertiary)] mb-2">기일유형: {hearing.hearing_type}</p>
                  )}

                  {hearing.judge_name && (
                    <p className="text-xs text-[var(--text-tertiary)] mb-2">담당판사: {hearing.judge_name}</p>
                  )}

                  {/* 재판진행보고서 */}
                  {hearing.hearing_report && (
                    <div className="mt-3 pt-3 border-t border-[var(--border-subtle)]">
                      <p className="text-xs font-medium text-[var(--text-secondary)] mb-1">재판진행보고서</p>
                      <p className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap bg-[var(--bg-primary)] rounded p-3">
                        {hearing.hearing_report}
                      </p>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* 기한 탭 */}
        {activeTab === 'deadlines' && (
          <div className="space-y-3">
            {deadlines.length === 0 ? (
              <div className="card rounded-lg p-8 text-center">
                <p className="text-sm text-[var(--text-tertiary)]">등록된 기한이 없습니다.</p>
              </div>
            ) : (
              deadlines.map((deadline) => (
                <div
                  key={deadline.id}
                  className={`card rounded-lg p-4 ${
                    deadline.is_completed ? 'opacity-60' : ''
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-[var(--text-primary)]">{deadline.deadline_date}</p>
                      <p className="text-xs text-[var(--text-tertiary)] mt-1">{deadline.deadline_type}</p>
                      {deadline.description && (
                        <p className="text-sm text-[var(--text-secondary)] mt-2">{deadline.description}</p>
                      )}
                    </div>
                    {deadline.is_completed ? (
                      <span className="px-2 py-0.5 text-xs rounded-full bg-[var(--color-success-muted)] text-[var(--color-success)]">
                        완료
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 text-xs rounded-full bg-[var(--color-danger-muted)] text-[var(--color-danger)]">
                        진행중
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

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
