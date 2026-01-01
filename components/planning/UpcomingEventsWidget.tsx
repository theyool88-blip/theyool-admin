'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface UpcomingEvent {
  id: string;
  type: 'deadline' | 'hearing';
  date: string;
  time?: string;
  title: string;
  caseId: string;
  caseNumber: string;
  clientName?: string;
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

  useEffect(() => {
    fetchEvents();
  }, [limit]);

  async function fetchEvents() {
    try {
      setLoading(true);
      // 기한과 기일을 함께 조회
      const [deadlinesRes, hearingsRes] = await Promise.all([
        fetch(`/api/admin/case-deadlines?upcoming=true&limit=${limit}`),
        fetch(`/api/admin/court-hearings?upcoming=true&limit=${limit}`),
      ]);

      const [deadlinesData, hearingsData] = await Promise.all([
        deadlinesRes.json(),
        hearingsRes.json(),
      ]);

      const allEvents: UpcomingEvent[] = [];

      // 기한 데이터 변환
      if (deadlinesData.success && deadlinesData.data) {
        for (const d of deadlinesData.data) {
          const daysRemaining = Math.ceil(
            (new Date(d.deadline_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
          );
          allEvents.push({
            id: d.id,
            type: 'deadline',
            date: d.deadline_date,
            title: d.deadline_type_name || d.deadline_type || '기한',
            caseId: d.case_id,
            caseNumber: d.cases?.case_number || '',
            clientName: d.cases?.clients?.name,
            daysRemaining,
          });
        }
      }

      // 기일 데이터 변환
      if (hearingsData.success && hearingsData.data) {
        for (const h of hearingsData.data) {
          const daysRemaining = Math.ceil(
            (new Date(h.hearing_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
          );
          allEvents.push({
            id: h.id,
            type: 'hearing',
            date: h.hearing_date,
            time: h.hearing_time,
            title: h.hearing_type_name || h.hearing_type || '기일',
            caseId: h.case_id,
            caseNumber: h.cases?.case_number || '',
            clientName: h.cases?.clients?.name,
            daysRemaining,
            location: h.courtroom,
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
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekday = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];
    return `${month}/${day}(${weekday})`;
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
            <div
              key={`${event.type}-${event.id}`}
              className="px-4 py-3 hover:bg-gray-50 transition-colors"
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
                    <p className="text-xs text-gray-400">{event.time.slice(0, 5)}</p>
                  )}
                </div>

                {/* 내용 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`flex-shrink-0 px-1.5 py-0.5 rounded text-xs font-medium ${
                        event.type === 'hearing'
                          ? 'bg-blue-50 text-blue-600'
                          : 'bg-purple-50 text-purple-600'
                      }`}
                    >
                      {event.type === 'hearing' ? '기일' : '기한'}
                    </span>
                    <span className="text-sm text-gray-900 truncate">{event.title}</span>
                  </div>
                  <Link
                    href={`/admin/cases?id=${event.caseId}`}
                    className="text-xs text-gray-500 hover:text-sage-600 block truncate"
                  >
                    {event.caseNumber}
                    {event.clientName && ` · ${event.clientName}`}
                  </Link>
                  {event.location && (
                    <p className="text-xs text-gray-400 truncate">{event.location}</p>
                  )}
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
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
