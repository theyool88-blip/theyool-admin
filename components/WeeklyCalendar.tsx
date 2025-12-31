'use client'

import { startOfWeek, addDays, format, isSameDay } from 'date-fns'
import { ko } from 'date-fns/locale'
import { useState, useEffect, useCallback, useMemo } from 'react'

interface Schedule {
  id: string
  title: string
  scheduled_date: string
  scheduled_time: string | null
  schedule_type: 'trial' | 'consultation' | 'meeting'
  location: string | null
  case_id: string | null
  event_type?: string
  event_subtype?: string | null  // HEARING_JUDGMENT, HEARING_PARENTING 등
  reference_id?: string | null
}

interface Holiday {
  id: string
  holiday_date: string
  holiday_name: string
  year: number
}

interface WeeklyCalendarProps {
  initialSchedules: Schedule[]
  onScheduleClick?: (schedule: Schedule) => void
  onDateClick?: (date: Date) => void
  onViewAll?: (date: Date, schedules: Schedule[]) => void
}

export default function WeeklyCalendar({ initialSchedules, onScheduleClick, onDateClick, onViewAll }: WeeklyCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [schedules, setSchedules] = useState<Schedule[]>(initialSchedules)
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [loading, setLoading] = useState(false)

  const weekStart = useMemo(() => startOfWeek(currentDate, { weekStartsOn: 1 }), [currentDate]) // 월요일 시작
  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart])
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart])

  // currentDate가 변경될 때마다 일정 다시 불러오기
  const fetchSchedules = useCallback(async () => {
    try {
      setLoading(true)
      const startDate = format(weekStart, 'yyyy-MM-dd')
      const endDate = format(weekEnd, 'yyyy-MM-dd')

      // 통합 캘린더 API 사용
      const response = await fetch(`/api/admin/calendar?start_date=${startDate}&end_date=${endDate}`)
      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || '일정 조회 실패')
      }

      // unified_calendar 데이터를 Schedule 형식으로 변환
      // VIEW에서 이미 한글 제목 형식으로 변환: "(종류) 사건명"
      const convertedSchedules: Schedule[] = (result.data || []).map((event: {
        id: string
        title: string
        event_date: string
        event_time?: string | null
        event_type: string
        event_subtype?: string | null  // hearing_type 정보
        location?: string | null
        reference_id?: string | null
      }) => {
        return {
          id: event.id,
          title: event.title, // 이미 "(변론기일) 김OO 이혼사건" 형식으로 저장됨
          scheduled_date: event.event_date,
          scheduled_time: event.event_time === '00:00' ? null : event.event_time,
          schedule_type: event.event_type === 'COURT_HEARING' ? 'trial' :
                         event.event_type === 'CONSULTATION' ? 'consultation' :
                         event.event_type === 'DEADLINE' ? 'meeting' : 'meeting',
          location: event.location,
          case_id: event.reference_id,
          event_type: event.event_type,
          event_subtype: event.event_subtype,  // hearing_type 저장
          reference_id: event.reference_id
        }
      })

      setSchedules(convertedSchedules)

      // 공휴일 조회 (해당 주의 연도)
      const year = weekStart.getFullYear()
      const holidayResponse = await fetch(`/api/admin/holidays?year=${year}`)
      const holidayResult = await holidayResponse.json()

      if (holidayResult.success) {
        setHolidays(holidayResult.data || [])
      }
    } catch (error) {
      console.error('일정 로드 실패:', error)
    } finally {
      setLoading(false)
    }
  }, [weekEnd, weekStart])

  useEffect(() => {
    fetchSchedules()
  }, [fetchSchedules, currentDate])

  const getSchedulesForDay = (day: Date) => {
    return schedules.filter(schedule =>
      isSameDay(new Date(schedule.scheduled_date), day)
    )
  }

  const getHolidayForDay = (day: Date): string | null => {
    const dateStr = format(day, 'yyyy-MM-dd')
    const holiday = holidays.find(h => h.holiday_date === dateStr)
    return holiday ? holiday.holiday_name : null
  }

  const getScheduleTypeLabel = (type: string, eventType?: string, location?: string | null) => {
    if (type === 'consultation' && eventType === 'CONSULTATION' && location) {
      if (location === '천안' || location?.includes('천안')) {
        return '천안상담'
      } else if (location === '평택' || location?.includes('평택')) {
        return '평택상담'
      }
    }

    switch (type) {
      case 'trial': return '변론'
      case 'consultation': return '상담'
      case 'meeting': return '회의'
      default: return '기타'
    }
  }

  const getScheduleTypeColor = (type: string, eventType?: string, eventSubtype?: string | null) => {
    // 변호사미팅은 청록색(teal)으로 구분
    if (type === 'trial' && eventSubtype === 'HEARING_LAWYER_MEETING') {
      return 'bg-teal-50 text-teal-700 border-l-teal-500'
    }

    // 참석하지 않는 법원기일(선고기일, 부모교육)은 회색으로 표시
    if (type === 'trial' && (eventSubtype === 'HEARING_JUDGMENT' || eventSubtype === 'HEARING_PARENTING')) {
      return 'bg-gray-50 text-gray-600 border-l-gray-400'
    }

    switch (type) {
      case 'trial': return 'bg-sage-50 text-sage-700 border-l-sage-400'
      case 'consultation': return 'bg-blue-50 text-blue-700 border-l-blue-400'
      case 'meeting': return 'bg-orange-50 text-orange-700 border-l-orange-400'
      default: return 'bg-gray-50 text-gray-700 border-l-gray-400'
    }
  }

  const goToPreviousWeek = () => {
    setCurrentDate(prev => addDays(prev, -7))
  }

  const goToNextWeek = () => {
    setCurrentDate(prev => addDays(prev, 7))
  }

  const goToThisWeek = () => {
    setCurrentDate(new Date())
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-sage-800 mb-4">이번 주 일정</h2>
        <div className="flex justify-center items-center h-64">
          <p className="text-sage-500">일정을 불러오는 중...</p>
        </div>
      </div>
    )
  }

  // 날짜 범위 표시 로직 (연도/월이 다른 경우 처리)
  const getDateRangeText = () => {
    const startYear = weekStart.getFullYear()
    const endYear = weekEnd.getFullYear()
    const startMonth = weekStart.getMonth()
    const endMonth = weekEnd.getMonth()

    // 연도가 다른 경우
    if (startYear !== endYear) {
      return `${format(weekStart, 'yyyy. M월 d일', { locale: ko })} - ${format(weekEnd, 'yyyy. M월 d일', { locale: ko })}`
    }
    // 월이 다른 경우
    if (startMonth !== endMonth) {
      return `${format(weekStart, 'M월 d일', { locale: ko })} - ${format(weekEnd, 'M월 d일', { locale: ko })}`
    }
    // 같은 월인 경우
    return `${format(weekStart, 'M월 d일', { locale: ko })} - ${format(weekEnd, 'd일', { locale: ko })}`
  }

  // 현재 주인지 확인
  const isCurrentWeek = () => {
    const today = new Date()
    const currentWeekStart = startOfWeek(today, { weekStartsOn: 1 })
    return isSameDay(weekStart, currentWeekStart)
  }

  // 중앙 버튼 텍스트
  const getCenterButtonText = () => {
    if (isCurrentWeek()) {
      return '이번 주'
    }
    // 다른 주를 보고 있는 경우 월 정보 표시
    const startMonth = weekStart.getMonth() + 1
    const endMonth = weekEnd.getMonth() + 1
    if (startMonth !== endMonth) {
      return `${startMonth}월 · ${endMonth}월`
    }
    return `${startMonth}월`
  }

  return (
    <div className="card-sage shadow-sage">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-semibold text-sage-800 mb-1">
            주간 일정
          </h2>
          <p className="text-sm text-sage-600">
            {getDateRangeText()}
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={goToPreviousWeek}
            className="p-2 text-sage-600 hover:text-sage-800 hover:bg-sage-50 rounded-lg transition-all"
            title="이전 주"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={goToThisWeek}
            className="px-3 py-2 text-sm font-medium text-sage-700 hover:text-sage-900 hover:bg-sage-50 rounded-lg transition-all"
          >
            {getCenterButtonText()}
          </button>
          <button
            onClick={goToNextWeek}
            className="p-2 text-sage-600 hover:text-sage-800 hover:bg-sage-50 rounded-lg transition-all"
            title="다음 주"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <button
            onClick={fetchSchedules}
            className="px-4 py-2 text-sm font-medium text-sage-600 hover:text-sage-900 hover:bg-sage-50 rounded-lg transition-all ml-auto"
          >
            새로고침
          </button>
          <a
            href="/schedules"
            className="px-4 py-2 text-sm font-medium text-white bg-sage-600 rounded-lg hover:bg-sage-700 transition-all shadow-sm hover:shadow-md"
          >
            전체보기
          </a>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-3">
        {weekDays.map((day, index) => {
          const daySchedules = getSchedulesForDay(day)
          const isToday = isSameDay(day, new Date())
          const holidayName = getHolidayForDay(day)
          const isHoliday = holidayName !== null
          const holidayColor = '#f87171' // tailwind red-400
          const holidayBg = '#fff1f2' // tailwind red-50

          return (
            <div
              key={index}
              className="min-h-[220px] group"
            >
              <div className="text-center mb-3 pb-2 border-b border-sage-100">
                <p className={`text-sm font-semibold uppercase tracking-wider mb-1 ${
                  isHoliday ? 'text-red-500' : 'text-sage-600'
                }`} style={isHoliday ? { color: holidayColor } : undefined}>
                  {format(day, 'EEE', { locale: ko })}
                </p>
                <button
                  onClick={() => onDateClick && onDateClick(day)}
                  className={`inline-flex items-center justify-center w-9 h-9 rounded-full transition-colors text-base ${
                    isToday
                      ? isHoliday
                        ? 'text-red-600 font-bold'
                        : 'bg-sage-600 text-white font-bold hover:bg-sage-700'
                      : isHoliday
                      ? 'text-red-500 font-bold hover:bg-red-50 cursor-pointer'
                      : 'text-sage-900 font-semibold hover:bg-sage-50 cursor-pointer'
                  }`}
                  style={
                    isHoliday
                      ? {
                          color: holidayColor,
                          backgroundColor: isToday ? holidayBg : undefined
                        }
                      : undefined
                  }
                  title="일정 추가"
                >
                  {format(day, 'd')}
                </button>
                {isHoliday && (
                  <p
                    className="text-[11px] text-red-500 font-medium mt-1 truncate px-1"
                    style={{ color: holidayColor }}
                    title={holidayName}
                  >
                    {holidayName}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                {daySchedules.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center mt-8 opacity-0 group-hover:opacity-100 transition-opacity">
                    일정 없음
                  </p>
                ) : (
                  <>
                    {daySchedules.slice(0, 5).map((schedule) => (
                      <div
                        key={schedule.id}
                        className={`px-2.5 pt-1.5 pb-2 rounded-md border-l-4 ${getScheduleTypeColor(schedule.schedule_type, schedule.event_type, schedule.event_subtype)} hover:shadow-sm transition-shadow ${onScheduleClick ? 'cursor-pointer' : ''} max-h-[6rem] overflow-hidden`}
                        onClick={() => {
                          if (onScheduleClick) {
                            onScheduleClick(schedule)
                          }
                        }}
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-bold uppercase tracking-wide">
                            {getScheduleTypeLabel(schedule.schedule_type, schedule.event_type, schedule.location)}
                          </span>
                          {schedule.scheduled_time && (
                            <>
                              <span className="text-gray-400">·</span>
                              <span className="text-[11px] font-semibold">
                                {schedule.scheduled_time.slice(0, 5)}
                              </span>
                            </>
                          )}
                        </div>
                        <p className="text-[13px] font-medium line-clamp-2 leading-snug" title={schedule.title}>
                          {schedule.title}
                        </p>
                        {schedule.location && (
                          <p className="text-[11px] opacity-70 mt-0.5 truncate">
                            📍 {schedule.location}
                          </p>
                        )}
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => onViewAll && onViewAll(day, daySchedules)}
                      className="text-[11px] text-center text-sage-600 font-medium py-1 w-full hover:text-sage-800"
                    >
                      {daySchedules.length > 5 ? `+${daySchedules.length - 5}` : '+'}
                    </button>
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
            
          </div>
          <p className="text-gray-600 font-medium">이번 주에 등록된 일정이 없습니다.</p>
          <p className="text-sm text-gray-500 mt-2">일정 관리 페이지에서 새 일정을 추가하세요.</p>
        </div>
      )}
    </div>
  )
}
