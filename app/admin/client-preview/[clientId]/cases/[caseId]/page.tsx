'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import CaseDocuments from '@/components/client/CaseDocuments';
import { getCourtAbbrev } from '@/lib/scourt/court-codes';

interface CaseDetail {
  id: string;
  case_name: string;
  contract_number: string;
  case_type: string;
  status: string;
  office: string;
  contract_date: string;
  created_at: string;
}

interface Hearing {
  id: string;
  hearing_date: string;
  hearing_time: string | null;
  court_name: string | null;
  hearing_type: string | null;
  hearing_result: string | null;
  judge_name: string | null;
  hearing_report: string | null;
}

interface Deadline {
  id: string;
  deadline_date: string;
  deadline_type: string | null;
  description: string | null;
  is_completed: boolean;
}

// 기일 유형 라벨
const HEARING_TYPE_LABELS: Record<string, string> = {
  'TRIAL': '변론기일',
  'MEDIATION': '조정기일',
  'RULING': '선고기일',
  'PREPARATION': '변론준비기일',
  'SETTLEMENT': '화해기일',
  'OTHER': '기타',
};

// 결과 라벨 (DB enum과 일치)
const HEARING_RESULT_LABELS: Record<string, string> = {
  'continued': '속행',
  'settled': '종결/화해',
  'judgment': '판결선고',
  'dismissed': '각하/기각',
  'withdrawn': '취하',
  'adjourned': '휴정/연기',
  'other': '기타',
};

export default function CaseDetailPreview() {
  const params = useParams();
  const clientId = params.clientId as string;
  const caseId = params.caseId as string;

  const [caseDetail, setCaseDetail] = useState<CaseDetail | null>(null);
  const [hearings, setHearings] = useState<Hearing[]>([]);
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedHearing, setSelectedHearing] = useState<Hearing | null>(null);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, caseId]);

  async function fetchData() {
    try {
      const res = await fetch(`/api/admin/client-preview/${clientId}/cases/${caseId}`);
      const data = await res.json();

      if (data.success) {
        setCaseDetail(data.case);
        setHearings(data.hearings || []);
        setDeadlines(data.deadlines || []);
      }
    } catch (error) {
      console.error('데이터 로딩 실패:', error);
    } finally {
      setLoading(false);
    }
  }

  // 상태 정보
  const getStatusInfo = (status: string) => {
    if (status === '진행중' || status === 'active') {
      return { label: '진행중', color: 'bg-[var(--color-success-muted)] text-[var(--color-success)]' };
    }
    return { label: '종결', color: 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)]' };
  };

  // 날짜 포맷
  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return { month: 0, day: 0, weekday: '-', full: '-', simple: '-' };
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
    const weekday = weekdays[date.getDay()];
    const yy = String(year).slice(2);
    const mm = String(month).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    return {
      month,
      day,
      weekday,
      full: `${yy}.${mm}.${dd}(${weekday})`,
      simple: `${yy}.${mm}.${dd}`
    };
  };

  // D-Day 계산
  const getDDay = (dateStr: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const targetDate = new Date(dateStr);
    targetDate.setHours(0, 0, 0, 0);
    return Math.ceil((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

  // 과거/미래 재판 분리
  const upcomingHearings = hearings.filter(h => getDDay(h.hearing_date) >= 0);
  const pastHearings = hearings.filter(h => getDDay(h.hearing_date) < 0);

  // 미완료/완료 기한 분리
  const pendingDeadlines = deadlines.filter(d => !d.is_completed);
  const completedDeadlines = deadlines.filter(d => d.is_completed);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)]">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-[var(--sage-primary)] border-t-transparent"></div>
      </div>
    );
  }

  if (!caseDetail) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)]">
        <p className="text-[var(--text-tertiary)]">사건 정보를 찾을 수 없습니다.</p>
      </div>
    );
  }

  const statusInfo = getStatusInfo(caseDetail.status);

  // 사무소별 전화번호 (기본: 평택)
  const getOfficePhone = () => {
    const office = caseDetail?.office || '';
    if (office === '천안') {
      return '041-622-7005';
    }
    return '031-652-7005';
  };
  const officePhone = getOfficePhone();

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* 관리자 배너 */}
      <div className="bg-[var(--sage-primary)] text-white px-4 py-2.5 text-center text-sm">
        <span className="font-medium">관리자 미리보기</span>
        <Link href={`/admin/client-preview/${clientId}`} className="ml-3 underline underline-offset-2 hover:no-underline opacity-80">
          ← 목록으로
        </Link>
      </div>

      {/* 헤더 */}
      <header className="bg-[var(--bg-secondary)] border-b border-[var(--border-subtle)] sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-5 py-4">
          <div className="flex items-start gap-3">
            <Link
              href={`/admin/client-preview/${clientId}`}
              className="mt-0.5 w-8 h-8 flex items-center justify-center rounded-full hover:bg-[var(--bg-hover)] shrink-0"
            >
              <svg className="w-5 h-5 text-[var(--text-tertiary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${statusInfo.color}`}>
                  {statusInfo.label}
                </span>
                {caseDetail.case_type && (
                  <span className="text-xs text-[var(--text-muted)]">{caseDetail.case_type}</span>
                )}
              </div>
              <h1 className="text-lg font-bold text-[var(--text-primary)]">{caseDetail.case_name}</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-5 py-6 space-y-5">
        {/* 사건 정보 */}
        <section className="card rounded-2xl p-4">
          <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-3">사건 정보</h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-[var(--text-muted)]">사건 유형</p>
              <p className="font-medium text-[var(--text-primary)]">{caseDetail.case_type || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--text-muted)]">담당 사무소</p>
              <p className="font-medium text-[var(--text-primary)]">{caseDetail.office || '-'}</p>
            </div>
            <div className="col-span-2">
              <p className="text-xs text-[var(--text-muted)]">계약일</p>
              <p className="font-medium text-[var(--text-primary)]">{caseDetail.contract_date ? formatDate(caseDetail.contract_date).simple : '-'}</p>
            </div>
          </div>
        </section>

        {/* 다가오는 기한 */}
        {pendingDeadlines.length > 0 && (
          <section className="card rounded-2xl p-4">
            <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-3">다가오는 기한</h2>
            <div className="space-y-2">
              {pendingDeadlines.map((deadline) => {
                const dday = getDDay(deadline.deadline_date);
                const isUrgent = dday <= 3;
                return (
                  <div key={deadline.id} className={`flex items-center gap-3 p-3 rounded-xl ${isUrgent ? 'bg-[var(--color-danger-muted)]' : 'bg-amber-50'}`}>
                    <div className={`w-10 h-10 rounded-lg flex flex-col items-center justify-center shrink-0 ${isUrgent ? 'bg-[var(--color-danger)]/20' : 'bg-amber-100'}`}>
                      <span className={`text-[10px] font-medium ${isUrgent ? 'text-[var(--color-danger)]' : 'text-amber-600'}`}>{formatDate(deadline.deadline_date).month}월</span>
                      <span className={`text-sm font-bold ${isUrgent ? 'text-[var(--color-danger)]' : 'text-amber-700'}`}>{formatDate(deadline.deadline_date).day}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--text-primary)]">{deadline.deadline_type || '기한'}</p>
                      {deadline.description && <p className="text-xs text-[var(--text-tertiary)] truncate">{deadline.description}</p>}
                    </div>
                    <span className={`text-xs font-bold ${isUrgent ? 'text-[var(--color-danger)]' : 'text-amber-600'}`}>D-{dday}</span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* 재판기일 */}
        {hearings.length > 0 && (
          <section className="card rounded-2xl p-4">
            <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-3">재판기일</h2>
            <div className="space-y-3">
              {/* 예정된 재판 */}
              {upcomingHearings.map((hearing) => (
                <div
                  key={hearing.id}
                  className="p-4 bg-[var(--sage-muted)] rounded-xl cursor-pointer hover:bg-[var(--sage-muted)]/80 transition-colors"
                  onClick={() => setSelectedHearing(hearing)}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-[var(--sage-muted)] border border-[var(--sage-primary)]/20 rounded-xl flex flex-col items-center justify-center shrink-0">
                      <span className="text-xs text-[var(--sage-primary)] font-medium">{formatDate(hearing.hearing_date).month}월</span>
                      <span className="text-xl font-bold text-[var(--sage-primary)]">{formatDate(hearing.hearing_date).day}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold text-[var(--text-primary)]">{formatDate(hearing.hearing_date).weekday}요일 {hearing.hearing_time || ''}</p>
                        <span className="px-2 py-0.5 bg-[var(--sage-primary)]/20 text-[var(--sage-primary)] text-xs font-bold rounded-full">D-{getDDay(hearing.hearing_date)}</span>
                      </div>
                      <p className="text-sm text-[var(--text-secondary)]">{getCourtAbbrev(hearing.court_name) || '장소 미정'}</p>
                      {hearing.hearing_type && (
                        <p className="text-xs text-[var(--sage-primary)] mt-1">{HEARING_TYPE_LABELS[hearing.hearing_type] || hearing.hearing_type}</p>
                      )}
                    </div>
                    <svg className="w-5 h-5 text-[var(--sage-primary)]/50 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              ))}

              {/* 지난 재판 */}
              {pastHearings.map((hearing) => (
                <div
                  key={hearing.id}
                  className="p-4 bg-[var(--bg-primary)] rounded-xl cursor-pointer hover:bg-[var(--bg-hover)] transition-colors"
                  onClick={() => setSelectedHearing(hearing)}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-[var(--bg-tertiary)] rounded-xl flex flex-col items-center justify-center shrink-0">
                      <span className="text-xs text-[var(--text-tertiary)] font-medium">{formatDate(hearing.hearing_date).month}월</span>
                      <span className="text-xl font-bold text-[var(--text-secondary)]">{formatDate(hearing.hearing_date).day}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-[var(--text-secondary)]">{formatDate(hearing.hearing_date).full}</p>
                      <p className="text-sm text-[var(--text-tertiary)]">{getCourtAbbrev(hearing.court_name) || '-'}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {hearing.hearing_type && (
                          <span className="text-xs text-[var(--text-tertiary)]">{HEARING_TYPE_LABELS[hearing.hearing_type] || hearing.hearing_type}</span>
                        )}
                        {hearing.hearing_result && (
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                            {HEARING_RESULT_LABELS[hearing.hearing_result] || hearing.hearing_result}
                          </span>
                        )}
                      </div>
                    </div>
                    {hearing.hearing_report && (
                      <div className="shrink-0 flex items-center gap-1 text-[var(--sage-primary)]">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span className="text-xs font-medium">보고서</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 완료된 기한 */}
        {completedDeadlines.length > 0 && (
          <section className="card rounded-2xl p-4">
            <h2 className="text-sm font-semibold text-[var(--text-muted)] mb-3">완료된 기한</h2>
            <div className="space-y-2">
              {completedDeadlines.map((deadline) => (
                <div key={deadline.id} className="flex items-center gap-3 p-2 opacity-50">
                  <div className="w-6 h-6 bg-[var(--color-success-muted)] rounded flex items-center justify-center shrink-0">
                    <svg className="w-3 h-3 text-[var(--color-success)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-sm text-[var(--text-tertiary)] line-through flex-1">{deadline.deadline_type || '기한'}</p>
                  <span className="text-xs text-[var(--text-muted)]">{formatDate(deadline.deadline_date).simple}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 소송 서류 */}
        <section className="card rounded-2xl p-4">
          <CaseDocuments caseId={caseId} />
        </section>

        {/* 문의 안내 */}
        <section className="bg-[var(--sage-muted)] rounded-2xl p-4 text-center">
          <p className="text-sm text-[var(--sage-primary)]">
            문의사항이 있으시면 <strong>{officePhone}</strong>으로 연락주세요.
          </p>
        </section>
      </main>

      {/* 재판 진행 보고서 모달 */}
      {selectedHearing && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-[var(--bg-secondary)] rounded-t-2xl sm:rounded-2xl w-full max-w-lg max-h-[85vh] overflow-hidden">
            {/* 모달 헤더 */}
            <div className="sticky top-0 bg-[var(--bg-secondary)] border-b border-[var(--border-subtle)] px-5 py-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-[var(--text-primary)]">재판기일 상세</h3>
                <button
                  onClick={() => setSelectedHearing(null)}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[var(--bg-hover)]"
                >
                  <svg className="w-5 h-5 text-[var(--text-tertiary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* 모달 내용 */}
            <div className="p-5 overflow-y-auto max-h-[calc(85vh-64px)] space-y-4">
              {/* 날짜 및 장소 */}
              <div className="flex items-center gap-4 p-4 bg-[var(--bg-primary)] rounded-xl">
                <div className="w-14 h-14 bg-[var(--bg-secondary)] rounded-xl flex flex-col items-center justify-center shrink-0 shadow-sm">
                  <span className="text-xs text-[var(--text-tertiary)] font-medium">{formatDate(selectedHearing.hearing_date).month}월</span>
                  <span className="text-xl font-bold text-[var(--text-primary)]">{formatDate(selectedHearing.hearing_date).day}</span>
                </div>
                <div>
                  <p className="font-semibold text-[var(--text-primary)]">{formatDate(selectedHearing.hearing_date).full}</p>
                  <p className="text-sm text-[var(--text-tertiary)]">{selectedHearing.hearing_time || '시간 미정'}</p>
                </div>
              </div>

              {/* 상세 정보 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-[var(--text-muted)] mb-1">기일 유형</p>
                  <p className="text-sm font-medium text-[var(--text-primary)]">
                    {selectedHearing.hearing_type ? (HEARING_TYPE_LABELS[selectedHearing.hearing_type] || selectedHearing.hearing_type) : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[var(--text-muted)] mb-1">법원/장소</p>
                  <p className="text-sm font-medium text-[var(--text-primary)]">{getCourtAbbrev(selectedHearing.court_name) || '-'}</p>
                </div>
                {selectedHearing.judge_name && (
                  <div>
                    <p className="text-xs text-[var(--text-muted)] mb-1">담당 판사</p>
                    <p className="text-sm font-medium text-[var(--text-primary)]">{selectedHearing.judge_name}</p>
                  </div>
                )}
                {selectedHearing.hearing_result && (
                  <div>
                    <p className="text-xs text-[var(--text-muted)] mb-1">기일 결과</p>
                    <span className="inline-block px-2.5 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-lg">
                      {HEARING_RESULT_LABELS[selectedHearing.hearing_result] || selectedHearing.hearing_result}
                    </span>
                  </div>
                )}
              </div>

              {/* 재판 진행 보고서 */}
              {selectedHearing.hearing_report && (
                <div>
                  <p className="text-xs text-[var(--text-muted)] mb-2">재판 진행 보고서</p>
                  <div className="p-4 bg-[var(--sage-muted)] border border-[var(--sage-primary)]/20 rounded-xl">
                    <p className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed">
                      {selectedHearing.hearing_report}
                    </p>
                  </div>
                </div>
              )}

              {/* D-Day 또는 경과일 */}
              {getDDay(selectedHearing.hearing_date) >= 0 ? (
                <div className="p-4 bg-[var(--sage-muted)] rounded-xl text-center">
                  <p className="text-sm text-[var(--sage-primary)]">
                    재판까지 <strong>D-{getDDay(selectedHearing.hearing_date)}</strong> 남았습니다.
                  </p>
                </div>
              ) : (
                <div className="p-4 bg-[var(--bg-tertiary)] rounded-xl text-center">
                  <p className="text-sm text-[var(--text-secondary)]">
                    {Math.abs(getDDay(selectedHearing.hearing_date))}일 전에 진행된 재판입니다.
                  </p>
                </div>
              )}
            </div>

            {/* 닫기 버튼 */}
            <div className="sticky bottom-0 bg-[var(--bg-secondary)] border-t border-[var(--border-subtle)] p-4">
              <button
                onClick={() => setSelectedHearing(null)}
                className="btn btn-primary w-full py-3 rounded-xl"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
