'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  format,
  isSameMonth,
  isSameDay,
  isToday
} from 'date-fns'
import { ko } from 'date-fns/locale'
import { formatDaysUntil } from '@/types/court-hearing'
import ScheduleListView from './ScheduleListView'
import UnifiedScheduleModal, { type EditScheduleData } from './UnifiedScheduleModal'

// 통합 일정 타입
type ScheduleType = 'trial' | 'consultation' | 'meeting' | 'court_hearing' | 'deadline'

interface UnifiedSchedule {
  id: string
  type: ScheduleType
  title: string
  date: string // YYYY-MM-DD
  time?: string // HH:MM:SS
  location?: string
  case_number?: string
  case_name?: string
  notes?: string
  status?: string
  daysUntil?: number // deadline만 해당
  hearing_type?: string // court_hearing 타입일 경우 hearing_type 저장
  event_subtype?: string // consultation의 경우 pending_visit, confirmed_visit 등
}

interface Profile {
  id: string
  name: string
  email: string
  role: string
}

interface Holiday {
  id: string
  holiday_date: string
  holiday_name: string
  year: number
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function MonthlyCalendar({ profile: _profile }: { profile: Profile }) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [schedules, setSchedules] = useState<UnifiedSchedule[]>([])
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar')
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingSchedule, setEditingSchedule] = useState<EditScheduleData | null>(null)
  const [prefilledDate, setPrefilledDate] = useState<string>('')
  const [allSchedules, setAllSchedules] = useState<UnifiedSchedule[]>([])
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [loading, setLoading] = useState(true)
  const [filterType, setFilterType] = useState<'all' | 'court'>('all')
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [syncing, setSyncing] = useState(false)
  const [pendingEvents, setPendingEvents] = useState<any[]>([])
  const [showPendingSection, setShowPendingSection] = useState(false)

  const monthStart = useMemo(() => startOfMonth(currentDate), [currentDate])
  const monthEnd = useMemo(() => endOfMonth(currentDate), [currentDate])
  const calendarStart = useMemo(() => startOfWeek(monthStart, { weekStartsOn: 0 }), [monthStart])
  const calendarEnd = useMemo(() => endOfWeek(monthEnd, { weekStartsOn: 0 }), [monthEnd])

  const fetchSchedules = useCallback(async () => {
    try {
      setLoading(true)
      const startDate = format(monthStart, 'yyyy-MM-dd')
      const endDate = format(monthEnd, 'yyyy-MM-dd')

      // 통합 캘린더 API 호출
      const response = await fetch(
        `/api/admin/calendar?start_date=${startDate}&end_date=${endDate}`
      )
      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || '일정 조회 실패')
      }

      const unifiedSchedules: UnifiedSchedule[] = []
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      // unified_calendar VIEW 데이터를 UnifiedSchedule 타입으로 변환
      // VIEW에서 이미 한글 제목 형식으로 변환됨: "(종류) 사건명"
      if (result.data) {
        result.data.forEach((event: {
          id: string
          event_type: string
          event_subtype?: string | null
          title: string
          event_date: string
          event_time?: string | null
          location?: string | null
          reference_id?: string | null
          case_name?: string | null
          description?: string | null
          status?: string | null
        }) => {
          let scheduleType: ScheduleType
          let hearing_type: string | undefined

          // event_type에 따라 schedule type 매핑
          if (event.event_type === 'COURT_HEARING') {
            scheduleType = 'court_hearing'
            hearing_type = event.event_subtype ?? undefined // hearing_type 원본값 저장
          } else if (event.event_type === 'DEADLINE') {
            scheduleType = 'deadline'
          } else if (event.event_type === 'CONSULTATION') {
            scheduleType = 'consultation'
          } else {
            scheduleType = 'meeting'
          }

          // deadline의 경우 daysUntil 계산
          let daysUntil: number | undefined
          if (event.event_type === 'DEADLINE') {
            const deadlineDate = new Date(event.event_date)
            deadlineDate.setHours(0, 0, 0, 0)
            daysUntil = Math.ceil((deadlineDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
          }

          unifiedSchedules.push({
            id: event.id,
            type: scheduleType,
            title: event.title, // 이미 "(변론기일) 김OO 이혼사건" 형식
            date: event.event_date,
            time: event.event_time === '00:00' ? undefined : (event.event_time ?? undefined),
            location: event.location ?? undefined,
            case_number: event.reference_id?.includes('-') || event.reference_id?.includes('드') ? event.reference_id : undefined,
            case_name: event.case_name ?? undefined,
            notes: event.description ?? undefined,
            status: event.status ?? undefined,
            daysUntil,
            hearing_type,
            event_subtype: event.event_subtype ?? undefined, // pending_visit, confirmed_callback 등
          })
        })
      }

        setAllSchedules(unifiedSchedules)
        if (!selectedDate) {
          setSelectedDate(new Date())
        }

      // 공휴일 데이터 조회 (달력 그리드가 걸치는 연도 모두 요청)
      const yearsToFetch = Array.from(
        new Set([calendarStart.getFullYear(), calendarEnd.getFullYear()])
      )

      const holidayResponses = await Promise.all(
        yearsToFetch.map(year =>
          fetch(`/api/admin/holidays?year=${year}`).then(res => res.json())
        )
      )

      const holidayData: Holiday[] = holidayResponses
        .filter(result => result?.success && Array.isArray(result.data))
        .flatMap(result => result.data)

      setHolidays(holidayData)
    } catch (error) {
      console.error('일정 로드 실패:', error)
      alert('일정을 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }, [calendarEnd, calendarStart, monthEnd, monthStart, selectedDate])

  useEffect(() => {
    fetchSchedules()
  }, [fetchSchedules])

  // 캘린더 동기화 함수
  const handleCalendarSync = async () => {
    setSyncing(true)
    try {
      const response = await fetch('/api/admin/google-calendar/sync', {
        method: 'POST',
      })
      const result = await response.json()

      if (response.ok) {
        alert(`동기화 완료!\n- 새로 매칭: ${result.matched}건\n- 업데이트: ${result.updated}건\n- 매칭 대기: ${result.pending}건`)
        fetchSchedules()
        fetchPendingEvents()
      } else {
        alert('동기화 실패: ' + (result.error || '알 수 없는 오류'))
      }
    } catch (error) {
      console.error('Sync error:', error)
      alert('동기화 중 오류가 발생했습니다.')
    } finally {
      setSyncing(false)
    }
  }

  // 매칭 안 된 이벤트 조회
  const fetchPendingEvents = async () => {
    try {
      const response = await fetch('/api/admin/google-calendar/sync')
      const result = await response.json()
      if (result.pendingEvents) {
        setPendingEvents(result.pendingEvents)
        if (result.pendingEvents.length > 0) {
          setShowPendingSection(true)
        }
      }
    } catch (error) {
      console.error('Error fetching pending events:', error)
    }
  }

  // 매칭 재시도
  const handleRetryPending = async () => {
    setSyncing(true)
    try {
      const response = await fetch('/api/admin/google-calendar/sync?action=retry', {
        method: 'POST',
      })
      const result = await response.json()

      if (response.ok) {
        alert(`재시도 완료!\n- 새로 매칭: ${result.matched}건\n- 여전히 대기: ${result.stillPending}건`)
        fetchSchedules()
        fetchPendingEvents()
      } else {
        alert('재시도 실패: ' + (result.error || '알 수 없는 오류'))
      }
    } catch (error) {
      console.error('Retry error:', error)
      alert('재시도 중 오류가 발생했습니다.')
    } finally {
      setSyncing(false)
    }
  }

  useEffect(() => {
    fetchPendingEvents()
  }, [])

  const applyFilter = useCallback(() => {
    if (filterType === 'all') {
      setSchedules(allSchedules)
    } else if (filterType === 'court') {
      // 재판일정: 법원 기일 + 데드라인 (상담 제외)
      setSchedules(allSchedules.filter(s => s.type !== 'consultation'))
    }
  }, [allSchedules, filterType])

  useEffect(() => {
    applyFilter()
  }, [applyFilter])

  const getSchedulesForDay = (day: Date) => {
    return schedules.filter(schedule =>
      isSameDay(new Date(schedule.date), day)
    )
  }

  const getScheduleTypeLabel = (type: ScheduleType, location?: string | null) => {
    if (type === 'consultation' && location) {
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
      case 'court_hearing': return '법원기일'
      case 'deadline': return '마감'
      default: return '기타'
    }
  }

  const getScheduleTypeColor = (type: ScheduleType, hearingType?: string, eventSubtype?: string) => {
    // 변호사미팅은 청록색(teal)으로 구분
    if (type === 'court_hearing' && hearingType === 'HEARING_LAWYER_MEETING') {
      return 'bg-teal-50 text-teal-700 border-l-teal-500'
    }

    // 참석하지 않는 법원기일은 회색으로 표시
    if (type === 'court_hearing' && (hearingType === 'HEARING_JUDGMENT' || hearingType === 'HEARING_PARENTING')) {
      return 'bg-gray-50 text-gray-600 border-l-gray-400'
    }

    // 미확정 상담은 점선 테두리
    if (type === 'consultation' && eventSubtype?.startsWith('pending_')) {
      return 'bg-blue-50 text-blue-700 border-l-blue-400 border-dashed'
    }

    switch (type) {
      case 'trial': return 'bg-sage-50 text-sage-700 border-l-sage-500'
      case 'consultation': return 'bg-blue-50 text-blue-700 border-l-blue-500'
      case 'meeting': return 'bg-gray-50 text-gray-600 border-l-gray-400'
      case 'court_hearing': return 'bg-sage-50 text-sage-700 border-l-sage-500'
      case 'deadline': return 'bg-orange-50 text-orange-700 border-l-orange-500'
      default: return 'bg-gray-50 text-gray-600 border-l-gray-400'
    }
  }

  const getScheduleTypeDot = (type: ScheduleType, hearingType?: string) => {
    // 변호사미팅은 청록색(teal) 점으로 구분
    if (type === 'court_hearing' && hearingType === 'HEARING_LAWYER_MEETING') {
      return 'bg-teal-500'
    }

    // 참석하지 않는 법원기일은 회색 점
    if (type === 'court_hearing' && (hearingType === 'HEARING_JUDGMENT' || hearingType === 'HEARING_PARENTING')) {
      return 'bg-gray-400'
    }

    switch (type) {
      case 'trial': return 'bg-sage-500'
      case 'consultation': return 'bg-blue-500'
      case 'meeting': return 'bg-gray-400'
      case 'court_hearing': return 'bg-sage-500'
      case 'deadline': return 'bg-orange-500'
      default: return 'bg-gray-400'
    }
  }

  // 월간 캘린더 날짜 배열 생성 (렌더링용 로컬 변수)
  const monthStartLocal = monthStart
  const monthEndLocal = monthEnd
  const calendarStartLocal = startOfWeek(monthStartLocal, { weekStartsOn: 0 }) // 일요일 시작
  const calendarEndLocal = endOfWeek(monthEndLocal, { weekStartsOn: 0 })

  const calendarDays: Date[] = []
  let day = calendarStartLocal
  while (day <= calendarEndLocal) {
    calendarDays.push(day)
    day = addDays(day, 1)
  }

  const selectedDaySchedules = selectedDate ? getSchedulesForDay(selectedDate) : []

  const getHolidayForDay = (day: Date): string | null => {
    const dateStr = format(day, 'yyyy-MM-dd')
    const holiday = holidays.find(h => h.holiday_date === dateStr)
    return holiday ? holiday.holiday_name : null
  }

  return (
    <div className="max-w-5xl mx-auto pt-20 pb-8 px-4">
      {/* 월 네비게이션 & 필터 */}
      <div className="bg-white rounded-lg border border-gray-200 mb-4 p-3">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
          <button
            onClick={() => setCurrentDate(subMonths(currentDate, 1))}
            className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors"
          >
            &larr; 이전 달
          </button>

          <div className="flex flex-col items-center gap-2">
            <h2 className="text-sm font-semibold text-gray-900">
              {format(currentDate, 'yyyy년 M월', { locale: ko })}
            </h2>

            {/* 뷰 전환 및 필터 버튼 */}
            <div className="flex gap-2">
              {/* 뷰 전환 */}
              <div className="flex bg-gray-100 rounded-lg p-0.5">
                <button
                  onClick={() => setViewMode('calendar')}
                  className={`px-2.5 py-1 text-[10px] font-medium rounded transition-colors ${
                    viewMode === 'calendar'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  캘린더
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`px-2.5 py-1 text-[10px] font-medium rounded transition-colors ${
                    viewMode === 'list'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  목록
                </button>
              </div>

              {/* 필터 */}
              <div className="flex gap-1">
                <button
                  onClick={() => setFilterType('all')}
                  className={`px-2.5 py-1 text-[10px] font-medium rounded-full transition-colors ${
                    filterType === 'all'
                      ? 'bg-sage-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  전체
                </button>
                <button
                  onClick={() => setFilterType('court')}
                  className={`px-2.5 py-1 text-[10px] font-medium rounded-full transition-colors ${
                    filterType === 'court'
                      ? 'bg-sage-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  재판
                </button>
              </div>

              {/* 캘린더 동기화 버튼 */}
              <button
                onClick={handleCalendarSync}
                disabled={syncing}
                className={`px-2.5 py-1 text-[10px] font-medium rounded-full transition-colors flex items-center gap-1 ${
                  syncing
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                }`}
              >
                {syncing ? (
                  <>
                    <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    동기화 중...
                  </>
                ) : (
                  <>
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    캘린더 동기화
                  </>
                )}
              </button>
            </div>
          </div>

          <button
            onClick={() => setCurrentDate(addMonths(currentDate, 1))}
            className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors"
          >
            다음 달 &rarr;
          </button>
        </div>
      </div>

      {/* 월간 캘린더 */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        {loading ? (
          <div className="flex justify-center items-center h-96">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-300 border-t-gray-600"></div>
          </div>
        ) : viewMode === 'list' ? (
          <ScheduleListView
            schedules={allSchedules.map(s => ({
              id: s.id,
              event_type: s.type === 'court_hearing' ? 'COURT_HEARING' : s.type === 'deadline' ? 'DEADLINE' : 'CONSULTATION',
              event_type_kr: getScheduleTypeLabel(s.type, s.location),
              event_subtype: s.hearing_type || null,
              title: s.title,
              case_name: s.case_number || '',
              event_date: s.date,
              event_time: s.time || null,
              event_datetime: s.time ? `${s.date} ${s.time}` : s.date,
              reference_id: s.case_number || '',
              location: s.location || null,
              description: s.notes || null,
              status: s.status || 'SCHEDULED',
              sort_priority: s.time ? 2 : 1
            }))}
            onEdit={(schedule) => {
              setEditingSchedule(schedule)
              setShowAddModal(true)
            }}
          />
        ) : (
          <>
            {/* 요일 헤더 */}
            <div className="grid grid-cols-7 gap-2 mb-3">
              {['일', '월', '화', '수', '목', '금', '토'].map((day, index) => (
                <div
                  key={day}
                  className={`text-center font-semibold text-xs py-2 ${
                    index === 0 ? 'text-red-500' : index === 6 ? 'text-blue-500' : 'text-gray-600'
                  }`}
                >
                  {day}
                </div>
              ))}
            </div>

            {/* 날짜 그리드 */}
            <div className="grid grid-cols-7 gap-2">
              {calendarDays.map((day, index) => {
                const daySchedules = getSchedulesForDay(day)
                const isCurrentMonth = isSameMonth(day, currentDate)
                const isCurrentDay = isToday(day)
                const isSelected = selectedDate && isSameDay(day, selectedDate)
                const holidayName = getHolidayForDay(day)
                const isHoliday = Boolean(holidayName)

                return (
                  <div
                    key={index}
                    onClick={() => setSelectedDate(day)}
                    className={`min-h-[130px] p-2.5 rounded-lg cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-sage-50 ring-2 ring-sage-300'
                        : isCurrentDay
                        ? 'bg-gray-50'
                        : 'hover:bg-gray-50'
                    } ${!isCurrentMonth ? 'opacity-40' : ''}`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className={`text-sm font-semibold ${
                        isCurrentDay
                          ? 'w-7 h-7 flex items-center justify-center bg-sage-600 text-white rounded-full'
                          : isHoliday || index % 7 === 0
                          ? 'text-red-500'
                          : index % 7 === 6
                          ? 'text-blue-500'
                          : 'text-gray-700'
                      }`}>
                        {format(day, 'd')}
                      </div>
                      {daySchedules.length > 0 && (
                        <div className="flex gap-1">
                          {daySchedules.slice(0, 3).map((schedule) => (
                            <div
                              key={schedule.id}
                              className={`w-2 h-2 rounded-full ${getScheduleTypeDot(schedule.type, schedule.hearing_type)}`}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      {holidayName && (
                        <p className="text-[10px] text-red-500 font-medium truncate" title={holidayName}>
                          {holidayName}
                        </p>
                      )}
                      {daySchedules.slice(0, 2).map((schedule) => (
                        <div
                          key={schedule.id}
                          className={`text-[11px] px-2 py-1.5 rounded border-l-2 ${getScheduleTypeColor(schedule.type, schedule.hearing_type, schedule.event_subtype)} leading-tight`}
                          title={`${schedule.time?.slice(0, 5) || ''} ${schedule.title} ${schedule.location ? '- ' + schedule.location : ''}`}
                        >
                          <div className="font-semibold truncate">
                            {schedule.time?.slice(0, 5)}
                            {schedule.type === 'deadline' && schedule.daysUntil !== undefined && (
                              <span className="ml-1 text-orange-600">{formatDaysUntil(schedule.daysUntil)}</span>
                            )}
                          </div>
                          <div className="truncate opacity-80">
                            {schedule.title}
                          </div>
                        </div>
                      ))}
                      {daySchedules.length > 2 && (
                        <div className="text-[11px] text-gray-500 font-medium px-2">
                          +{daySchedules.length - 2}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* 선택된 날짜의 상세 일정 */}
      {selectedDate && (
        <div className="bg-white rounded-lg border border-gray-200 p-4 mt-4">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">
                {format(selectedDate, 'M월 d일 (E)', { locale: ko })} 일정
              </h3>
              <p className="text-[10px] text-gray-500">
                {format(selectedDate, 'yyyy년', { locale: ko })}
              </p>
            </div>
            <button
              onClick={() => setSelectedDate(null)}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {selectedDaySchedules.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-xs text-gray-400">이 날짜에 등록된 일정이 없습니다.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {selectedDaySchedules.map((schedule) => {
                return (
                  <div
                    key={schedule.id}
                    className={`p-3 rounded-lg border-l-4 ${getScheduleTypeColor(schedule.type, schedule.hearing_type, schedule.event_subtype)} hover:shadow-sm transition-all cursor-pointer border border-gray-100`}
                    onClick={async () => {
                      // 상담 타입인 경우 UnifiedScheduleModal로 수정
                      if (schedule.type === 'consultation') {
                        try {
                          // 상담 데이터 가져오기
                          const response = await fetch(`/api/admin/consultations/${schedule.id}`)
                          const result = await response.json()

                          if (response.ok && result.data) {
                            const consultation = result.data
                            setEditingSchedule({
                              id: consultation.id,
                              event_type: 'CONSULTATION',
                              event_subtype: consultation.request_type,
                              reference_id: null,
                              case_name: consultation.name,
                              case_id: null,
                              event_date: consultation.confirmed_date || consultation.preferred_date || schedule.date,
                              event_time: consultation.confirmed_time || consultation.preferred_time || null,
                              location: consultation.office_location || null,
                              description: consultation.message || null,
                              status: consultation.status,
                              preferred_date: consultation.preferred_date,
                              preferred_time: consultation.preferred_time,
                              confirmed_date: consultation.confirmed_date,
                              confirmed_time: consultation.confirmed_time
                            })
                            setPrefilledDate(consultation.confirmed_date || consultation.preferred_date || schedule.date)
                            setShowAddModal(true)
                          } else {
                            alert('상담 정보를 불러오는데 실패했습니다.')
                          }
                        } catch (error) {
                          console.error('Error fetching consultation:', error)
                          alert('상담 정보를 불러오는데 실패했습니다.')
                        }
                      } else if (schedule.type === 'court_hearing' || schedule.type === 'trial') {
                        // 법원기일 - UnifiedScheduleModal로 편집
                        try {
                          const { createClient } = await import('@/lib/supabase/client')
                          const supabase = createClient()
                          const { data: hearing } = await supabase
                            .from('court_hearings')
                            .select('*')
                            .eq('id', schedule.id)
                            .single()

                          if (hearing) {
                            const hearingDateTime = new Date(hearing.hearing_date)
                            const dateStr = hearingDateTime.toISOString().split('T')[0]
                            const timeStr = hearingDateTime.toTimeString().slice(0, 5)

                            setEditingSchedule({
                              id: hearing.id,
                              event_type: 'COURT_HEARING',
                              event_subtype: hearing.hearing_type,
                              reference_id: hearing.case_number,
                              case_name: null,
                              case_id: null,
                              event_date: dateStr,
                              event_time: timeStr,
                              location: hearing.location || null,
                              description: hearing.notes || null,
                              status: hearing.status,
                              report: hearing.report || null,
                              result: hearing.result || null,
                              judge_name: hearing.judge_name || null
                            })
                            setPrefilledDate(dateStr)
                            setShowAddModal(true)
                          }
                        } catch (error) {
                          console.error('Error fetching court hearing:', error)
                          alert('법원기일 정보를 불러오는데 실패했습니다.')
                        }
                      } else if (schedule.type === 'deadline' || schedule.type === 'meeting') {
                        // 데드라인 - UnifiedScheduleModal로 편집
                        try {
                          const { createClient } = await import('@/lib/supabase/client')
                          const supabase = createClient()
                          const { data: deadline } = await supabase
                            .from('case_deadlines')
                            .select('*')
                            .eq('id', schedule.id)
                            .single()

                          if (deadline) {
                            setEditingSchedule({
                              id: deadline.id,
                              event_type: 'DEADLINE',
                              event_subtype: deadline.deadline_type,
                              reference_id: deadline.case_number,
                              case_name: null,
                              case_id: null,
                              event_date: deadline.trigger_date,
                              event_time: null,
                              location: null,
                              description: deadline.notes || null,
                              status: deadline.status,
                              trigger_date: deadline.trigger_date
                            })
                            setPrefilledDate(deadline.trigger_date)
                            setShowAddModal(true)
                          }
                        } catch (error) {
                          console.error('Error fetching deadline:', error)
                          alert('데드라인 정보를 불러오는데 실패했습니다.')
                        }
                      } else {
                        // 기타 타입 (향후 확장 가능)
                        setPrefilledDate(schedule.date)
                        setEditingSchedule(null)
                        setShowAddModal(true)
                      }
                    }}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-white/80">
                        {getScheduleTypeLabel(schedule.type, schedule.location)}
                      </span>
                      {schedule.time && (
                        <span className="text-[10px] font-medium text-gray-600">
                          {schedule.time.slice(0, 5)}
                        </span>
                      )}
                      {schedule.type === 'deadline' && schedule.daysUntil !== undefined && (
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                          schedule.daysUntil <= 1 ? 'bg-red-100 text-red-700' :
                          schedule.daysUntil <= 3 ? 'bg-orange-100 text-orange-700' :
                          'bg-amber-100 text-amber-700'
                        }`}>
                          {formatDaysUntil(schedule.daysUntil)}
                        </span>
                      )}
                    </div>
                    <h4 className="text-xs font-medium text-gray-900 mb-1">{schedule.title}</h4>
                    {schedule.case_number && (
                      <p className="text-[10px] text-gray-500 flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        {schedule.case_number}
                      </p>
                    )}
                    {schedule.location && (
                      <p className="text-[10px] text-gray-500 flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        {schedule.location}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* 일정 추가 버튼 */}
          <div className="mt-4 pt-3 border-t border-gray-100">
            <button
              className="w-full px-3 py-2 text-xs font-medium text-sage-600 border border-sage-200 rounded-lg hover:bg-sage-50 transition-colors"
              onClick={() => {
                if (selectedDate) {
                  setPrefilledDate(format(selectedDate, 'yyyy-MM-dd'))
                }
                setEditingSchedule(null)
                setShowAddModal(true)
              }}
            >
              + 이 날짜에 일정 추가
            </button>
          </div>
        </div>
      )}

      {/* 매칭 안 된 기일 섹션 */}
      {pendingEvents.length > 0 && (
        <div className="bg-amber-50 rounded-lg border border-amber-200 p-4 mt-4">
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <h3 className="text-sm font-semibold text-amber-800">
                매칭 안 된 기일 ({pendingEvents.length}건)
              </h3>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleRetryPending}
                disabled={syncing}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  syncing
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : 'bg-amber-600 text-white hover:bg-amber-700'
                }`}
              >
                {syncing ? '처리 중...' : '다시 매칭 시도'}
              </button>
              <button
                onClick={() => setShowPendingSection(!showPendingSection)}
                className="p-1.5 text-amber-600 hover:text-amber-800 hover:bg-amber-100 rounded transition-colors"
              >
                <svg className={`w-4 h-4 transition-transform ${showPendingSection ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
          </div>

          <p className="text-xs text-amber-700 mb-3">
            아래 기일들은 사건번호와 매칭되지 않았습니다. 해당 사건을 먼저 등록하면 자동으로 연결됩니다.
          </p>

          {showPendingSection && (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {pendingEvents.map((event) => (
                <div
                  key={event.id}
                  className="bg-white rounded-lg border border-amber-200 p-3"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700">
                          {event.parsed_hearing_detail || '기일'}
                        </span>
                        <span className="text-[10px] text-gray-500">
                          {event.start_datetime ? format(new Date(event.start_datetime), 'M/d (E) HH:mm', { locale: ko }) : ''}
                        </span>
                      </div>
                      <p className="text-xs font-medium text-gray-900 mb-1">
                        {event.summary}
                      </p>
                      <div className="flex flex-wrap gap-2 text-[10px] text-gray-500">
                        {event.parsed_case_number && (
                          <span className="flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            {event.parsed_case_number}
                          </span>
                        )}
                        {event.location && (
                          <span className="flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            {event.location}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-[10px] text-gray-400">
                      시도 {event.match_attempts}회
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 일정 추가/수정 모달 */}
      <UnifiedScheduleModal
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false)
          setEditingSchedule(null)
          setPrefilledDate('')
        }}
        onSuccess={() => {
          fetchSchedules()
          setShowAddModal(false)
          setEditingSchedule(null)
          setPrefilledDate('')
        }}
        prefilledCaseNumber={editingSchedule?.reference_id ?? undefined}
        prefilledDate={prefilledDate}
        editMode={!!editingSchedule}
        editData={editingSchedule ?? undefined}
      />
    </div>
  )
}
