'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
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
import { createClient } from '@/lib/supabase/client'
import { HEARING_TYPE_LABELS, DEADLINE_TYPE_LABELS, formatDaysUntil } from '@/types/court-hearing'

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
}

interface Profile {
  id: string
  name: string
  email: string
  role: string
}

export default function MonthlyCalendar({ profile }: { profile: Profile }) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [schedules, setSchedules] = useState<UnifiedSchedule[]>([])
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    fetchSchedules()
  }, [currentDate])

  const fetchSchedules = async () => {
    try {
      setLoading(true)
      const monthStart = startOfMonth(currentDate)
      const monthEnd = endOfMonth(currentDate)
      const startDate = format(monthStart, 'yyyy-MM-dd')
      const endDate = format(monthEnd, 'yyyy-MM-dd')

      const allSchedules: UnifiedSchedule[] = []

      // 1. case_schedules 조회 (기존)
      const { data: caseSchedules, error: schedError } = await supabase
        .from('case_schedules')
        .select('*')
        .gte('scheduled_date', startDate)
        .lte('scheduled_date', endDate)
        .eq('status', 'scheduled')
        .order('scheduled_time', { ascending: true })

      if (schedError) throw schedError

      if (caseSchedules) {
        caseSchedules.forEach((sched) => {
          allSchedules.push({
            id: `sched_${sched.id}`,
            type: sched.schedule_type as ScheduleType,
            title: sched.title,
            date: sched.scheduled_date,
            time: sched.scheduled_time,
            location: sched.location,
          })
        })
      }

      // 2. court_hearings 조회 (신규)
      const { data: hearings, error: hearingError } = await supabase
        .from('court_hearings')
        .select('*')
        .gte('hearing_date', `${startDate}T00:00:00`)
        .lte('hearing_date', `${endDate}T23:59:59`)
        .in('status', ['SCHEDULED', 'POSTPONED'])
        .order('hearing_date', { ascending: true })

      if (hearingError) throw hearingError

      if (hearings) {
        hearings.forEach((hearing) => {
          const hearingDateTime = new Date(hearing.hearing_date)
          allSchedules.push({
            id: `hearing_${hearing.id}`,
            type: 'court_hearing',
            title: HEARING_TYPE_LABELS[hearing.hearing_type as keyof typeof HEARING_TYPE_LABELS],
            date: format(hearingDateTime, 'yyyy-MM-dd'),
            time: format(hearingDateTime, 'HH:mm:ss'),
            location: hearing.location,
            case_number: hearing.case_number,
            status: hearing.status,
            notes: hearing.notes,
            hearing_type: hearing.hearing_type, // 변호사미팅 구분용
          })
        })
      }

      // 3. case_deadlines 조회 (신규)
      const { data: deadlines, error: deadlineError } = await supabase
        .from('case_deadlines')
        .select('*')
        .gte('deadline_date', startDate)
        .lte('deadline_date', endDate)
        .eq('status', 'PENDING')
        .order('deadline_date', { ascending: true })

      if (deadlineError) throw deadlineError

      if (deadlines) {
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        deadlines.forEach((deadline) => {
          const deadlineDate = new Date(deadline.deadline_date)
          deadlineDate.setHours(0, 0, 0, 0)
          const daysUntil = Math.ceil((deadlineDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

          allSchedules.push({
            id: `deadline_${deadline.id}`,
            type: 'deadline',
            title: DEADLINE_TYPE_LABELS[deadline.deadline_type as keyof typeof DEADLINE_TYPE_LABELS],
            date: deadline.deadline_date,
            time: deadline.deadline_datetime ? format(new Date(deadline.deadline_datetime), 'HH:mm:ss') : undefined,
            case_number: deadline.case_number,
            status: deadline.status,
            notes: deadline.notes,
            daysUntil,
          })
        })
      }

      // 날짜/시간 기준 정렬
      allSchedules.sort((a, b) => {
        const dateA = `${a.date} ${a.time || '00:00:00'}`
        const dateB = `${b.date} ${b.time || '00:00:00'}`
        return dateA.localeCompare(dateB)
      })

      setSchedules(allSchedules)
    } catch (error) {
      console.error('일정 로드 실패:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const getSchedulesForDay = (day: Date) => {
    return schedules.filter(schedule =>
      isSameDay(new Date(schedule.date), day)
    )
  }

  const getScheduleTypeLabel = (type: ScheduleType) => {
    switch (type) {
      case 'trial': return '변론'
      case 'consultation': return '상담'
      case 'meeting': return '회의'
      case 'court_hearing': return '법원기일'
      case 'deadline': return '데드라인'
      default: return '기타'
    }
  }

  const getScheduleTypeColor = (type: ScheduleType, hearingType?: string) => {
    // 변호사미팅은 청록색(teal)으로 구분
    if (type === 'court_hearing' && hearingType === 'HEARING_LAWYER_MEETING') {
      return 'bg-teal-50 text-teal-700 border-l-teal-400'
    }

    switch (type) {
      case 'trial': return 'bg-purple-50 text-purple-700 border-l-purple-400'
      case 'consultation': return 'bg-indigo-50 text-indigo-700 border-l-indigo-400'
      case 'meeting': return 'bg-emerald-50 text-emerald-700 border-l-emerald-400'
      case 'court_hearing': return 'bg-blue-50 text-blue-700 border-l-blue-400'
      case 'deadline': return 'bg-orange-50 text-orange-700 border-l-orange-400'
      default: return 'bg-gray-50 text-gray-700 border-l-gray-400'
    }
  }

  const getScheduleTypeDot = (type: ScheduleType, hearingType?: string) => {
    // 변호사미팅은 청록색(teal) 점으로 구분
    if (type === 'court_hearing' && hearingType === 'HEARING_LAWYER_MEETING') {
      return 'bg-teal-400'
    }

    switch (type) {
      case 'trial': return 'bg-purple-400'
      case 'consultation': return 'bg-indigo-400'
      case 'meeting': return 'bg-emerald-400'
      case 'court_hearing': return 'bg-blue-400'
      case 'deadline': return 'bg-orange-400'
      default: return 'bg-gray-400'
    }
  }

  // 월간 캘린더 날짜 배열 생성
  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(currentDate)
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 }) // 일요일 시작
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })

  const calendarDays: Date[] = []
  let day = calendarStart
  while (day <= calendarEnd) {
    calendarDays.push(day)
    day = addDays(day, 1)
  }

  const selectedDaySchedules = selectedDate ? getSchedulesForDay(selectedDate) : []

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <a href="/" className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-700 rounded-lg flex items-center justify-center hover:from-blue-600 hover:to-blue-800 transition-colors cursor-pointer">
              <span className="text-white font-bold text-lg">율</span>
            </a>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">일정 관리</h1>
              <p className="text-sm text-gray-600">월간 캘린더</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <a
              href="/"
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              대시보드
            </a>
            <div className="text-right">
              <p className="text-sm font-medium text-gray-900">{profile.name}</p>
              <p className="text-xs text-gray-500">
                {profile.role === 'admin' ? '관리자' : '직원'}
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              로그아웃
            </button>
          </div>
        </div>
      </header>

      {/* 메인 콘텐츠 */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 월 네비게이션 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-6 p-4">
          <div className="flex justify-between items-center">
            <button
              onClick={() => setCurrentDate(subMonths(currentDate, 1))}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors"
            >
              ← 이전 달
            </button>
            <h2 className="text-2xl font-semibold text-gray-900">
              {format(currentDate, 'yyyy년 M월', { locale: ko })}
            </h2>
            <button
              onClick={() => setCurrentDate(addMonths(currentDate, 1))}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors"
            >
              다음 달 →
            </button>
          </div>
        </div>

        {/* 월간 캘린더 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          {loading ? (
            <div className="flex justify-center items-center h-96">
              <p className="text-gray-500">일정을 불러오는 중...</p>
            </div>
          ) : (
            <>
              {/* 요일 헤더 */}
              <div className="grid grid-cols-7 gap-3 mb-4">
                {['일', '월', '화', '수', '목', '금', '토'].map((day, index) => (
                  <div
                    key={day}
                    className={`text-center font-semibold text-sm py-3 ${
                      index === 0 ? 'text-red-500' : index === 6 ? 'text-blue-500' : 'text-gray-600'
                    }`}
                  >
                    {day}
                  </div>
                ))}
              </div>

              {/* 날짜 그리드 */}
              <div className="grid grid-cols-7 gap-3">
                {calendarDays.map((day, index) => {
                  const daySchedules = getSchedulesForDay(day)
                  const isCurrentMonth = isSameMonth(day, currentDate)
                  const isCurrentDay = isToday(day)
                  const isSelected = selectedDate && isSameDay(day, selectedDate)

                  return (
                    <div
                      key={index}
                      onClick={() => setSelectedDate(day)}
                      className={`min-h-[120px] p-3 rounded-lg cursor-pointer transition-all group ${
                        isSelected
                          ? 'bg-blue-50 shadow-md ring-2 ring-blue-200'
                          : isCurrentDay
                          ? 'bg-blue-50/50'
                          : 'hover:bg-gray-50 hover:shadow-sm'
                      } ${!isCurrentMonth ? 'opacity-40' : ''}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className={`inline-flex items-center justify-center transition-all ${
                          isCurrentDay
                            ? 'w-7 h-7 bg-blue-600 text-white rounded-full font-semibold text-sm'
                            : 'text-sm font-medium'
                        } ${
                          !isCurrentMonth
                            ? 'text-gray-400'
                            : index % 7 === 0
                            ? 'text-red-500'
                            : index % 7 === 6
                            ? 'text-blue-500'
                            : 'text-gray-900'
                        }`}>
                          {format(day, 'd')}
                        </div>
                        {daySchedules.length > 0 && (
                          <div className="flex gap-1">
                            {daySchedules.slice(0, 3).map((schedule) => (
                              <div
                                key={schedule.id}
                                className={`w-1.5 h-1.5 rounded-full ${getScheduleTypeDot(schedule.type, schedule.hearing_type)}`}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="space-y-1">
                        {daySchedules.slice(0, 2).map((schedule) => (
                          <div
                            key={schedule.id}
                            className={`text-[10px] px-2 py-1.5 rounded border-l-2 ${getScheduleTypeColor(schedule.type, schedule.hearing_type)} leading-tight`}
                            title={`${schedule.time?.slice(0, 5) || ''} ${schedule.title} ${schedule.location ? '- ' + schedule.location : ''}`}
                          >
                            <div className="font-semibold truncate">
                              {schedule.time?.slice(0, 5)}
                              {schedule.type === 'deadline' && schedule.daysUntil !== undefined && (
                                <span className="ml-1 text-orange-600">{formatDaysUntil(schedule.daysUntil)}</span>
                              )}
                            </div>
                            <div className="truncate opacity-90 font-medium">
                              {schedule.title}
                            </div>
                          </div>
                        ))}
                        {daySchedules.length > 2 && (
                          <div className="text-[10px] text-blue-600 font-semibold px-2 py-0.5">
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
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mt-6">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-1">
                  {format(selectedDate, 'M월 d일 (E)', { locale: ko })} 일정
                </h3>
                <p className="text-sm text-gray-500">
                  {format(selectedDate, 'yyyy년', { locale: ko })}
                </p>
              </div>
              <button
                onClick={() => setSelectedDate(null)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {selectedDaySchedules.length === 0 ? (
              <div className="text-center py-12">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
                  <span className="text-2xl">📭</span>
                </div>
                <p className="text-gray-600 font-medium">이 날짜에 등록된 일정이 없습니다.</p>
                <p className="text-sm text-gray-500 mt-1">새로운 일정을 추가해보세요.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {selectedDaySchedules.map((schedule) => (
                  <div
                    key={schedule.id}
                    className={`p-4 rounded-lg border-l-4 ${getScheduleTypeColor(schedule.type, schedule.hearing_type)} hover:shadow-md transition-all cursor-pointer`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <span className="px-2.5 py-1 rounded-md bg-white/80 text-xs font-semibold uppercase tracking-wide">
                        {getScheduleTypeLabel(schedule.type)}
                      </span>
                      {schedule.time && (
                        <span className="text-sm font-semibold">
                          {schedule.time.slice(0, 5)}
                        </span>
                      )}
                      {schedule.type === 'deadline' && schedule.daysUntil !== undefined && (
                        <span className={`px-2 py-1 rounded-md text-xs font-bold ${
                          schedule.daysUntil <= 1 ? 'bg-red-100 text-red-700' :
                          schedule.daysUntil <= 3 ? 'bg-orange-100 text-orange-700' :
                          'bg-yellow-100 text-yellow-700'
                        }`}>
                          {formatDaysUntil(schedule.daysUntil)}
                        </span>
                      )}
                    </div>
                    <h4 className="font-semibold text-gray-900 mb-2 text-base">{schedule.title}</h4>
                    {schedule.case_number && (
                      <p className="text-sm text-gray-600 mb-1 flex items-center gap-1.5">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        사건번호: {schedule.case_number}
                      </p>
                    )}
                    {schedule.location && (
                      <p className="text-sm text-gray-600 flex items-center gap-1.5">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        {schedule.location}
                      </p>
                    )}
                    {schedule.notes && (
                      <p className="text-sm text-gray-600 mt-2 italic">
                        {schedule.notes}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* 차후: 일정 추가 버튼 */}
            <div className="mt-6 pt-6 border-t border-gray-100">
              <button
                className="w-full px-4 py-3 text-sm font-semibold text-blue-600 border-2 border-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
                onClick={() => alert('일정 추가 기능은 곧 추가됩니다!')}
              >
                + 이 날짜에 일정 추가
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
