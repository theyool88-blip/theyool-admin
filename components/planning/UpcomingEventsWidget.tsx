'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

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
  }, [limit]);

  async function fetchEvents() {
    try {
      setLoading(true);
      const allEvents: UpcomingEvent[] = [];
      const today = new Date().toISOString().split('T')[0];

      // 기일 조회 (Supabase 직접 사용, 당사자/출석변호사 JOIN)
      const { data: hearings, error: hearingError } = await supabase
        .from('court_hearings')
        .select(`
          *,
          attending_lawyer:attending_lawyer_id(id, display_name),
          legal_cases!inner(
            id,
            case_name,
            court_case_number,
            client:client_id(id, name),
            opponent_name
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
            client:client_id(id, name),
            opponent_name
          )
        `)
        .gte('deadline_date', today)
        .in('status', ['PENDING', 'OVERDUE'])
        .order('deadline_date', { ascending: true })
        .limit(limit * 2);

      if (deadlineError) {
        console.error('기한 조회 오류:', deadlineError);
      }

      // 기일 데이터 변환
      if (hearings) {
        for (const h of hearings) {
          const daysRemaining = Math.ceil(
            (new Date(h.hearing_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
          );
          const legalCase = h.legal_cases as any;
          allEvents.push({
            id: h.id,
            type: 'hearing',
            date: h.hearing_date,
            time: h.hearing_date?.split('T')[1]?.slice(0, 5),
            title: h.hearing_type || '기일',
            caseId: h.case_id,
            caseNumber: legalCase?.court_case_number || '',
            caseName: legalCase?.case_name,
            clientName: legalCase?.client?.name,
            opponentName: legalCase?.opponent_name,
            attendingLawyerName: (h.attending_lawyer as any)?.display_name,
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
          const legalCase = d.legal_cases as any;
          allEvents.push({
            id: d.id,
            type: 'deadline',
            date: d.deadline_date,
            title: d.deadline_type || '기한',
            caseId: d.case_id,
            caseNumber: legalCase?.court_case_number || '',
            caseName: legalCase?.case_name,
            clientName: legalCase?.client?.name,
            opponentName: legalCase?.opponent_name,
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
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-4 py-3 border-b border-gray-100">
          <p className="text-sm font-medium text-gray-900">다가오는 일정</p>
        </div>
        <div className="p-4 flex justify-center">
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-300 border-t-sage-600"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-4 py-3 border-b border-gray-100">
          <p className="text-sm font-medium text-gray-900">다가오는 일정</p>
        </div>
        <div className="p-4 text-center text-sm text-gray-500">{error}</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <p className="text-sm font-medium text-gray-900">다가오는 일정</p>
        <span className="text-xs text-gray-500">{events.length}건</span>
      </div>

      {events.length === 0 ? (
        <div className="p-4 text-center text-sm text-gray-500">
          예정된 일정이 없습니다
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {events.map((event) => (
            <Link
              key={`${event.type}-${event.id}`}
              href={`/cases/${event.caseId}`}
              className="block px-4 py-3 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-start gap-3">
                {/* 날짜 */}
                <div className="flex-shrink-0 w-14 text-center">
                  <span
                    className={`text-xs font-medium ${
                      event.daysRemaining <= 0
                        ? 'text-red-600'
                        : event.daysRemaining <= 3
                          ? 'text-orange-600'
                          : 'text-gray-600'
                    }`}
                  >
                    {formatDate(event.date)}
                  </span>
                  {event.time && (
                    <p className="text-xs text-gray-400">{event.time}</p>
                  )}
                </div>

                {/* 내용 */}
                <div className="flex-1 min-w-0">
                  {/* 첫 줄: [기일종류] 의뢰인 v 상대방 */}
                  <div className="flex items-center gap-2">
                    <span
                      className={`flex-shrink-0 px-1.5 py-0.5 rounded text-xs font-medium ${
                        event.type === 'hearing'
                          ? 'bg-blue-50 text-blue-600'
                          : 'bg-purple-50 text-purple-600'
                      }`}
                    >
                      {event.title}
                    </span>
                    {event.type === 'hearing' && (event.clientName || event.opponentName) && (
                      <span className="text-sm text-gray-900 truncate">
                        {event.clientName || '의뢰인'} v {event.opponentName || '상대방'}
                      </span>
                    )}
                    {event.type === 'deadline' && (
                      <span className="text-sm text-gray-900 truncate">
                        {event.caseName || event.caseNumber}
                      </span>
                    )}
                  </div>
                  {/* 둘째 줄: 사건번호 */}
                  {event.caseNumber && (
                    <p className="text-xs text-gray-500 truncate">
                      {event.caseNumber}
                    </p>
                  )}
                  {/* 셋째 줄: 장소 | 출석변호사 */}
                  <div className="flex items-center gap-2 text-xs text-gray-400 truncate">
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
                        ? 'text-red-600'
                        : event.daysRemaining <= 3
                          ? 'text-orange-600'
                          : 'text-gray-500'
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
