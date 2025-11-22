'use client'

import { startOfWeek, addDays, format, isSameDay } from 'date-fns'
import { ko } from 'date-fns/locale'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Schedule {
  id: string
  title: string
  scheduled_date: string
  scheduled_time: string | null
  schedule_type: 'trial' | 'consultation' | 'meeting'
  location: string | null
  case_id: string | null
}

export default function WeeklyCalendar({ initialSchedules }: { initialSchedules: Schedule[] }) {
  const [currentDate] = useState(new Date())
  const [schedules, setSchedules] = useState<Schedule[]>(initialSchedules)
  const [loading, setLoading] = useState(false)

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 }) // 월요일 시작
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  const supabase = createClient()

  const fetchSchedules = async () => {
    try {
      const weekEnd = addDays(weekStart, 6)

      const { data, error } = await supabase
        .from('case_schedules')
        .select('*')
        .gte('scheduled_date', format(weekStart, 'yyyy-MM-dd'))
        .lte('scheduled_date', format(weekEnd, 'yyyy-MM-dd'))
        .eq('status', 'scheduled')
        .order('scheduled_time', { ascending: true })

      if (error) throw error
      setSchedules(data || [])
    } catch (error) {
      console.error('일정 로드 실패:', error)
    } finally {
      setLoading(false)
    }
  }

  const getSchedulesForDay = (day: Date) => {
    return schedules.filter(schedule =>
      isSameDay(new Date(schedule.scheduled_date), day)
    )
  }

  const getScheduleTypeLabel = (type: string) => {
    switch (type) {
      case 'trial': return '변론'
      case 'consultation': return '상담'
      case 'meeting': return '회의'
      default: return '기타'
    }
  }

  const getScheduleTypeColor = (type: string) => {
    switch (type) {
      case 'trial': return 'bg-purple-50 text-purple-700 border-l-purple-400'
      case 'consultation': return 'bg-blue-50 text-blue-700 border-l-blue-400'
      case 'meeting': return 'bg-emerald-50 text-emerald-700 border-l-emerald-400'
      default: return 'bg-gray-50 text-gray-700 border-l-gray-400'
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">이번 주 일정</h2>
        <div className="flex justify-center items-center h-64">
          <p className="text-gray-500">일정을 불러오는 중...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-1">
            이번 주 일정
          </h2>
          <p className="text-sm text-gray-500">
            {format(weekStart, 'M월 d일', { locale: ko })} - {format(weekDays[6], 'M월 d일', { locale: ko })}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchSchedules}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors"
          >
            새로고침
          </button>
          <a
            href="/schedules"
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            전체보기
          </a>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-3">
        {weekDays.map((day, index) => {
          const daySchedules = getSchedulesForDay(day)
          const isToday = isSameDay(day, new Date())

          return (
            <div
              key={index}
              className="min-h-[200px] group"
            >
              <div className="text-center mb-3 pb-2 border-b border-gray-100">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                  {format(day, 'EEE', { locale: ko })}
                </p>
                <div className={`inline-flex items-center justify-center w-8 h-8 rounded-full transition-colors ${
                  isToday
                    ? 'bg-blue-600 text-white font-semibold'
                    : 'text-gray-900 font-medium hover:bg-gray-50'
                }`}>
                  {format(day, 'd')}
                </div>
              </div>

              <div className="space-y-1.5">
                {daySchedules.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center mt-8 opacity-0 group-hover:opacity-100 transition-opacity">
                    일정 없음
                  </p>
                ) : (
                  <>
                    {daySchedules.slice(0, 3).map((schedule) => (
                      <div
                        key={schedule.id}
                        className={`px-2.5 py-2 rounded-md border-l-4 ${getScheduleTypeColor(schedule.schedule_type)} hover:shadow-sm transition-shadow cursor-pointer`}
                      >
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-[10px] font-semibold uppercase tracking-wide">
                            {getScheduleTypeLabel(schedule.schedule_type)}
                          </span>
                          {schedule.scheduled_time && (
                            <>
                              <span className="text-gray-400">·</span>
                              <span className="text-[10px] font-medium">
                                {schedule.scheduled_time.slice(0, 5)}
                              </span>
                            </>
                          )}
                        </div>
                        <p className="text-xs font-medium truncate leading-relaxed" title={schedule.title}>
                          {schedule.title}
                        </p>
                        {schedule.location && (
                          <p className="text-[10px] opacity-70 mt-1 truncate">
                            📍 {schedule.location}
                          </p>
                        )}
                      </div>
                    ))}
                    {daySchedules.length > 3 && (
                      <div className="text-[11px] text-center text-blue-600 font-medium py-1">
                        +{daySchedules.length - 3}개
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {schedules.length === 0 && (
        <div className="text-center mt-12 py-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
            <span className="text-2xl">📅</span>
          </div>
          <p className="text-gray-600 font-medium">이번 주에 등록된 일정이 없습니다.</p>
          <p className="text-sm text-gray-500 mt-2">일정 관리 페이지에서 새 일정을 추가하세요.</p>
        </div>
      )}
    </div>
  )
}
