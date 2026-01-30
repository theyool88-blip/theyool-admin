'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { HEARING_TYPE_LABELS, DEADLINE_TYPE_LABELS, type HearingType, type DeadlineType } from '@/types/court-hearing';
import { PartyVsDisplay } from '@/components/ui/PartyVsDisplay';

interface UpcomingEvent {
  id: string;
  type: 'deadline' | 'hearing';
  date: string;
  time?: string;
  title: string;
  caseId: string;
  caseNumber: string;
  caseName?: string;
  clientName?: string;
  opponentName?: string;
  attendingLawyerName?: string;
  daysRemaining: number;
  location?: string;
}

interface Props {
  limit?: number;
}

export default function UpcomingEventsWidget({ limit = 7 }: Props) {
  const [events, setEvents] = useState<UpcomingEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    fetchEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limit]);

  async function fetchEvents() {
    try {
      setLoading(true);
      const allEvents: UpcomingEvent[] = [];
      const today = new Date().toISOString().split('T')[0];

      // 기일 조회 (Supabase 직접 사용, 당사자/출석변호사 JOIN)
      // NOTE: client_id → primary_client_id로 변경 (스키마 변경)
      const { data: hearings, error: hearingError } = await supabase
        .from('court_hearings')
        .select(`
          *,
          attending_lawyer:attending_lawyer_id(id, display_name),
          legal_cases!inner(
            id,
            case_name,
            court_case_number,
            primary_client_name
          )
        `)
        .gte('hearing_date', today)
        .eq('status', 'SCHEDULED')
        .order('hearing_date', { ascending: true })
        .limit(limit * 2);

      if (hearingError) {
        console.error('기일 조회 오류:', hearingError);
      }

      // 기한 조회
      const { data: deadlines, error: deadlineError } = await supabase
        .from('case_deadlines')
        .select(`
          *,
          legal_cases!inner(
            id,
            case_name,
            court_case_number,
            primary_client_name
          )
        `)
        .gte('deadline_date', today)
        .in('status', ['PENDING', 'OVERDUE'])
        .order('deadline_date', { ascending: true })
        .limit(limit * 2);

      if (deadlineError) {
        console.error('기한 조회 오류:', deadlineError);
      }

      // case_parties에서 상대방 이름 조회 (opponent_name은 case_parties로 관리)
      const caseIdsFromHearings = (hearings || []).map(h => (h.legal_cases as { id?: string })?.id).filter(Boolean);
      const caseIdsFromDeadlines = (deadlines || []).map(d => (d.legal_cases as { id?: string })?.id).filter(Boolean);
      const allCaseIds = [...new Set([...caseIdsFromHearings, ...caseIdsFromDeadlines])];

      let opponentMap = new Map<string, string>();
      if (allCaseIds.length > 0) {
        // NOTE: is_our_client 컬럼이 스키마에서 제거됨 - is_primary=false로 상대방 식별
        const { data: opponents } = await supabase
          .from('case_parties')
          .select('case_id, party_name')
          .in('case_id', allCaseIds)
          .eq('is_primary', false)
          .order('party_order', { ascending: true });

        if (opponents) {
          opponentMap = new Map(opponents.map(o => [o.case_id, o.party_name]));
        }
      }

      // 기일 데이터 변환
      if (hearings) {
        for (const h of hearings) {
          const daysRemaining = Math.ceil(
            (new Date(h.hearing_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
          );
          const legalCase = h.legal_cases as { id?: string; court_case_number?: string; case_name?: string; primary_client_name?: string } | null;
          // scourt_type_raw 우선 사용 (예: "제1회 변론기일"), 없으면 ENUM 라벨
          const hearingTitle = h.scourt_type_raw
            || HEARING_TYPE_LABELS[h.hearing_type as HearingType]
            || h.hearing_type
            || '기일';

          allEvents.push({
            id: h.id,
            type: 'hearing',
            date: h.hearing_date,
            time: h.hearing_date?.split('T')[1]?.slice(0, 5),
            title: hearingTitle,
            caseId: h.case_id,
            caseNumber: legalCase?.court_case_number || '',
            caseName: legalCase?.case_name,
            clientName: legalCase?.primary_client_name || undefined,
            opponentName: legalCase?.id ? opponentMap.get(legalCase.id) : undefined,
            attendingLawyerName: (h.attending_lawyer as { display_name?: string } | null)?.display_name,
            daysRemaining,
            location: h.location,
          });
        }
      }

      // 기한 데이터 변환
      if (deadlines) {
        for (const d of deadlines) {
          const daysRemaining = Math.ceil(
            (new Date(d.deadline_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
          );
          const legalCase = d.legal_cases as { id?: string; court_case_number?: string; case_name?: string; primary_client_name?: string } | null;
          // DEADLINE_TYPE_LABELS에서 한글 라벨 사용
          const deadlineTitle = DEADLINE_TYPE_LABELS[d.deadline_type as DeadlineType]
            || d.deadline_type
            || '기한';

          allEvents.push({
            id: d.id,
            type: 'deadline',
            date: d.deadline_date,
            title: deadlineTitle,
            caseId: d.case_id,
            caseNumber: legalCase?.court_case_number || '',
            caseName: legalCase?.case_name,
            clientName: legalCase?.primary_client_name || undefined,
            opponentName: legalCase?.id ? opponentMap.get(legalCase.id) : undefined,
            daysRemaining,
          });
        }
      }

      // 날짜순 정렬
      allEvents.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      setEvents(allEvents.slice(0, limit));
    } catch (err) {
      setError('일정을 불러오지 못했습니다');
      console.error('Failed to fetch events:', err);
    } finally {
      setLoading(false);
    }
  }

  function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    const yy = String(date.getFullYear()).slice(2);
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yy}.${mm}.${dd}`;
  }

  function getDaysLabel(days: number): string {
    if (days === 0) return '오늘';
    if (days === 1) return '내일';
    if (days < 0) return `${Math.abs(days)}일 전`;
    return `${days}일 후`;
  }

  if (loading) {
    return (
      <div className="card">
        <div className="px-4 py-3 border-b border-[var(--border-subtle)]">
          <p className="text-sm font-medium text-[var(--text-primary)]">다가오는 일정</p>
        </div>
        <div className="p-4 flex justify-center">
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-[var(--border-default)] border-t-[var(--sage-primary)]"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <div className="px-4 py-3 border-b border-[var(--border-subtle)]">
          <p className="text-sm font-medium text-[var(--text-primary)]">다가오는 일정</p>
        </div>
        <div className="p-4 text-center text-sm text-[var(--text-tertiary)]">{error}</div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="px-4 py-3 border-b border-[var(--border-subtle)] flex items-center justify-between">
        <p className="text-sm font-medium text-[var(--text-primary)]">다가오는 일정</p>
        <span className="text-xs text-[var(--text-tertiary)]">{events.length}건</span>
      </div>

      {events.length === 0 ? (
        <div className="p-4 text-center text-sm text-[var(--text-tertiary)]">
          예정된 일정이 없습니다
        </div>
      ) : (
        <div className="divide-y divide-[var(--border-subtle)]">
          {events.map((event) => (
            <Link
              key={`${event.type}-${event.id}`}
              href={`/cases/${event.caseId}`}
              className="block px-4 py-3 hover:bg-[var(--bg-hover)] transition-colors"
            >
              <div className="flex items-start gap-3">
                {/* 날짜 */}
                <div className="flex-shrink-0 w-14 text-center">
                  <span
                    className={`text-xs font-medium ${
                      event.daysRemaining <= 0
                        ? 'text-[var(--color-danger)]'
                        : event.daysRemaining <= 3
                          ? 'text-[var(--color-warning)]'
                          : 'text-[var(--text-secondary)]'
                    }`}
                  >
                    {formatDate(event.date)}
                  </span>
                  {event.time && (
                    <p className="text-xs text-[var(--text-muted)]">{event.time}</p>
                  )}
                </div>

                {/* 내용 */}
                <div className="flex-1 min-w-0">
                  {/* 첫 줄: [기일종류] 의뢰인 v 상대방 */}
                  <div className="flex items-center gap-2">
                    <span
                      className={`flex-shrink-0 px-1.5 py-0.5 rounded text-xs font-medium ${
                        event.type === 'hearing'
                          ? 'bg-[var(--color-info-muted)] text-[var(--color-info)]'
                          : 'bg-purple-50 text-purple-600'
                      }`}
                    >
                      {event.title}
                    </span>
                    {event.type === 'hearing' && (event.clientName || event.opponentName) && (
                      <PartyVsDisplay
                        clientName={event.clientName}
                        opponentName={event.opponentName}
                        size="sm"
                      />
                    )}
                    {event.type === 'deadline' && (
                      <span className="text-sm text-[var(--text-primary)] truncate">
                        {event.caseName || event.caseNumber}
                      </span>
                    )}
                  </div>
                  {/* 둘째 줄: 사건번호 */}
                  {event.caseNumber && (
                    <p className="text-xs text-[var(--text-tertiary)] truncate">
                      {event.caseNumber}
                    </p>
                  )}
                  {/* 셋째 줄: 장소 | 출석변호사 */}
                  <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] truncate">
                    {event.location && (
                      <span>{event.location}</span>
                    )}
                    {event.location && event.attendingLawyerName && (
                      <span>|</span>
                    )}
                    {event.attendingLawyerName && (
                      <span>출석: {event.attendingLawyerName}</span>
                    )}
                  </div>
                </div>

                {/* D-day */}
                <div className="flex-shrink-0">
                  <span
                    className={`text-xs font-medium ${
                      event.daysRemaining <= 0
                        ? 'text-[var(--color-danger)]'
                        : event.daysRemaining <= 3
                          ? 'text-[var(--color-warning)]'
                          : 'text-[var(--text-tertiary)]'
                    }`}
                  >
                    {getDaysLabel(event.daysRemaining)}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
