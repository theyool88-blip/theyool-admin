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
  case_id?: string // 사건 페이지 이동용
  notes?: string
  status?: string
  daysUntil?: number // deadline만 해당
  hearing_type?: string // court_hearing 타입일 경우 hearing_type 저장
  event_subtype?: string // consultation의 경우 pending_visit, confirmed_visit 등
  attending_lawyer_id?: string // 출석변호사 ID
  attending_lawyer_name?: string // 출석변호사 이름
  // SCOURT 원본 데이터 (나의사건검색 동일 표시용)
  scourt_type_raw?: string // 원본 기일명 (예: "제1회 변론기일")
  scourt_result_raw?: string // 원본 결과 (예: "다음기일지정(2025.02.15)")
  hearing_sequence?: number // 기일 회차
}

interface TenantMember {
  id: string
  display_name: string
  role: string
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

// 변호사 출석 불필요 기일 유형 (선고기일, 조사기일, 상담/교육 기일)
const NO_LAWYER_ATTENDANCE_TYPES = [
  'HEARING_JUDGMENT',      // 선고기일: 판결 선고만 이루어짐
  'HEARING_INVESTIGATION', // 조사기일: 당사자만 참석 (가사조사관 면담)
  'HEARING_PARENTING',     // 상담/교육 기일: 당사자만 참석 (부모교육 등)
] as const

// 변호사 출석 불필요 여부 체크 (scourt_type_raw 기반 추가 체크)
const NO_LAWYER_ATTENDANCE_KEYWORDS = ['조정조치'] // 조정조치기일: 당사자만 참석

function isNoLawyerAttendanceRequired(schedule: UnifiedSchedule): boolean {
  // 1. 기일 유형으로 체크
  if (NO_LAWYER_ATTENDANCE_TYPES.includes(schedule.hearing_type as typeof NO_LAWYER_ATTENDANCE_TYPES[number])) {
    return true
  }
  // 2. scourt_type_raw에 특정 키워드 포함 체크 (조정조치기일 등)
  if (schedule.scourt_type_raw) {
    return NO_LAWYER_ATTENDANCE_KEYWORDS.some(keyword => schedule.scourt_type_raw!.includes(keyword))
  }
  return false
}

export default function MonthlyCalendar({ profile: _profile }: { profile: Profile }) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [schedules, setSchedules] = useState<UnifiedSchedule[]>([])
  const [viewMode, setViewMode] = useState<'calendar' | 'week' | 'list'>('calendar')
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingSchedule, setEditingSchedule] = useState<EditScheduleData | null>(null)
  const [prefilledDate, setPrefilledDate] = useState<string>('')
  const [allSchedules, setAllSchedules] = useState<UnifiedSchedule[]>([])
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [loading, setLoading] = useState(true)
  const [filterType, setFilterType] = useState<'all' | 'court'>('all')
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [tenantMembers, setTenantMembers] = useState<TenantMember[]>([])
  const [lawyerFilter, setLawyerFilter] = useState<string>('all') // 'all' 또는 lawyer ID
  const [updatingLawyer, setUpdatingLawyer] = useState<string | null>(null)
  const [showMenu, setShowMenu] = useState(false) // 메뉴 드롭다운

  const monthStart = useMemo(() => startOfMonth(currentDate), [currentDate])
  const monthEnd = useMemo(() => endOfMonth(currentDate), [currentDate])
  const calendarStart = useMemo(() => startOfWeek(monthStart, { weekStartsOn: 0 }), [monthStart])
  const calendarEnd = useMemo(() => endOfWeek(monthEnd, { weekStartsOn: 0 }), [monthEnd])

  // 테넌트 멤버 조회 (변호사 목록)
  const fetchTenantMembers = useCallback(async () => {
    try {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { data } = await supabase
        .from('tenant_members')
        .select('id, display_name, role')
        .in('role', ['owner', 'lawyer'])
        .order('display_name')

      if (data) {
        setTenantMembers(data)
      }
    } catch (error) {
      console.error('테넌트 멤버 조회 실패:', error)
    }
  }, [])

  // 출석변호사 변경
  const updateAttendingLawyer = async (hearingId: string, lawyerId: string | null) => {
    setUpdatingLawyer(hearingId)
    try {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { error } = await supabase
        .from('court_hearings')
        .update({ attending_lawyer_id: lawyerId })
        .eq('id', hearingId)

      if (error) throw error

      // 로컬 상태 업데이트
      const lawyerName = lawyerId
        ? tenantMembers.find(m => m.id === lawyerId)?.display_name
        : undefined

      setAllSchedules(prev =>
        prev.map(s =>
          s.id === hearingId
            ? { ...s, attending_lawyer_id: lawyerId || undefined, attending_lawyer_name: lawyerName }
            : s
        )
      )
    } catch (error) {
      console.error('출석변호사 변경 실패:', error)
      alert('출석변호사 변경에 실패했습니다.')
    } finally {
      setUpdatingLawyer(null)
    }
  }

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
          case_id?: string | null
          description?: string | null
          status?: string | null
          attending_lawyer_id?: string | null
          attending_lawyer_name?: string | null
          scourt_type_raw?: string | null
          scourt_result_raw?: string | null
          hearing_sequence?: number | null
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
            title: event.title, // 이미 "(제1회 변론기일) 김OO 이혼사건" 형식
            date: event.event_date,
            time: event.event_time === '00:00' ? undefined : (event.event_time ?? undefined),
            location: event.location ?? undefined,
            case_number: event.reference_id?.includes('-') || event.reference_id?.includes('드') ? event.reference_id : undefined,
            case_name: event.case_name ?? undefined,
            case_id: event.case_id ?? undefined,
            notes: event.description ?? undefined,
            status: event.status ?? undefined,
            daysUntil,
            hearing_type,
            event_subtype: event.event_subtype ?? undefined, // pending_visit, confirmed_callback 등
            attending_lawyer_id: event.attending_lawyer_id ?? undefined,
            attending_lawyer_name: event.attending_lawyer_name ?? undefined,
            // SCOURT 원본 데이터
            scourt_type_raw: event.scourt_type_raw ?? undefined,
            scourt_result_raw: event.scourt_result_raw ?? undefined,
            hearing_sequence: event.hearing_sequence ?? undefined,
          })
        })
      }

        // 데드라인을 해당 날짜의 최상단으로 정렬
        const sortedSchedules = [...unifiedSchedules].sort((a, b) => {
          if (a.date === b.date) {
            // 같은 날짜 내에서 deadline을 최상단으로
            if (a.type === 'deadline' && b.type !== 'deadline') return -1
            if (a.type !== 'deadline' && b.type === 'deadline') return 1
          }
          return 0 // 기존 정렬(날짜순) 유지
        })

        setAllSchedules(sortedSchedules)
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

  useEffect(() => {
    fetchTenantMembers()
  }, [fetchTenantMembers])


  const applyFilter = useCallback(() => {
    let filtered = allSchedules

    // 타입 필터
    if (filterType === 'court') {
      // 재판일정: 법원 기일 + 데드라인 (상담 제외)
      filtered = filtered.filter(s => s.type !== 'consultation')
    }

    // 변호사 필터
    if (lawyerFilter !== 'all') {
      filtered = filtered.filter(s => s.attending_lawyer_id === lawyerFilter)
    }

    setSchedules(filtered)
  }, [allSchedules, filterType, lawyerFilter])

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

  // 화상장치 관련 텍스트 제거 (예: "[일방 화상장치]", "[쌍방 화상장치]", "제1회 변론기일 [일방 화상장치]")
  const removeVideoDeviceText = (text: string) => {
    return text.replace(/\s*\[(일방|쌍방)\s*화상장치\]\s*/g, '').trim()
  }

  // 캘린더 셀용 짧은 제목 (예: "(변론기일) 김OO" → "(변론) 김OO")
  const getShortTitle = (title: string) => {
    return title
      // 화상장치 관련 텍스트 제거 (예: "[일방 화상장치]", "[쌍방 화상장치]")
      .replace(/\s*\[(일방|쌍방)\s*화상장치\]\s*/g, ' ')
      .replace('변론기일', '변론')
      .replace('조정기일', '조정')
      .replace('선고기일', '선고')
      .replace('심문기일', '심문')
      .replace('양육상담', '양육')
      .replace('중간심문', '중간')
      .replace('변호사 미팅', '미팅')
      .replace('상소기간', '상소')
      .replace('조정이의기간', '조정이의')
      .replace('즉시항고', '즉항')
      .replace('항소이유서', '항소이유')
      .replace('지급명령이의', '지명이의')
      .trim()
  }

  // 법원명 짧게 (예: "평택가정법원 제21호 법정" → "평택")
  // 지원이 있는 경우 지원명 우선 (예: "대전지방법원 서산지원" → "서산")
  const getShortCourt = (location?: string) => {
    if (!location) return ''

    // 1. "OO지원" 패턴이 있으면 지원명 추출 (예: "대전지방법원 서산지원" → "서산")
    const jiwonMatch = location.match(/([가-힣]{2,4})지원/)
    if (jiwonMatch) {
      return jiwonMatch[1]
    }

    // 2. "OO시법원" 패턴이 있으면 시법원명 추출 (예: "수원지방법원 안성시법원" → "안성")
    const siMatch = location.match(/([가-힣]{2,4})시법원/)
    if (siMatch) {
      return siMatch[1]
    }

    // 3. 주요 법원명 추출
    const courtNames = ['서울', '수원', '평택', '천안', '대전', '대구', '부산', '광주', '인천', '울산', '창원', '청주', '전주', '춘천', '제주', '의정부', '고양', '성남', '안산', '안양', '용인', '화성', '서산', '아산', '세종']
    for (const name of courtNames) {
      if (location.includes(name)) {
        return name
      }
    }
    // 못 찾으면 첫 2글자
    return location.slice(0, 2)
  }

  // 법원명을 축약형으로 변환 (장소 뒷부분은 유지)
  // "수원가정법원 평택지원 제21호 법정" → "평택지원 제21호 법정"
  // "수원고등법원 제804호 법정" → "수원고법 제804호 법정"
  const shortenCourtLocation = (location?: string): string => {
    if (!location) return ''

    // 1. OO지원 패턴 (평택지원, 안산지원, 천안지원)
    // "수원가정법원 평택지원 제21호 법정" → "평택지원 제21호 법정"
    const jiwonMatch = location.match(/[가-힣]+법원\s+([가-힣]{2,4}지원)\s+(.+)/)
    if (jiwonMatch) {
      return `${jiwonMatch[1]} ${jiwonMatch[2]}`
    }

    // 2. 고등법원
    // "수원고등법원 제804호 법정" → "수원고법 제804호 법정"
    const goMatch = location.match(/([가-힣]{2,3})고등법원\s+(.+)/)
    if (goMatch) {
      return `${goMatch[1]}고법 ${goMatch[2]}`
    }

    // 3. 가정법원 본원
    // "수원가정법원 본관 401호 법정" → "수원가정 본관 401호 법정"
    const gaMatch = location.match(/([가-힣]{2,3})가정법원\s+(.+)/)
    if (gaMatch) {
      return `${gaMatch[1]}가정 ${gaMatch[2]}`
    }

    // 4. 지방법원 본원
    // "수원지방법원 제101호 법정" → "수원지법 제101호 법정"
    const jiMatch = location.match(/([가-힣]{2,3})지방법원\s+(.+)/)
    if (jiMatch) {
      return `${jiMatch[1]}지법 ${jiMatch[2]}`
    }

    // 못 찾으면 원본 반환
    return location
  }

  // 기일 연기/변경 여부 확인
  const isPostponedHearing = (result?: string): boolean => {
    if (!result) return false
    const keywords = ['기일변경', '연기', '취하', '취소', '변경지정']
    return keywords.some(kw => result.includes(kw))
  }

  const getScheduleTypeColor = (type: ScheduleType, hearingType?: string, eventSubtype?: string, scourt_result_raw?: string) => {
    // 연기된 기일: 흐린 회색 (기일변경, 연기, 취하, 취소 등 - 비활성 느낌)
    if (type === 'court_hearing' && isPostponedHearing(scourt_result_raw)) {
      return 'bg-gray-100 text-gray-400 border-l-gray-300'
    }

    // 변호사미팅은 청록색(teal)으로 구분
    if (type === 'court_hearing' && hearingType === 'HEARING_LAWYER_MEETING') {
      return 'bg-teal-50 text-teal-700 border-l-teal-500'
    }

    // 참석하지 않는 법원기일은 회색으로 표시 (선고, 양육상담, 면접조사)
    if (type === 'court_hearing' && (hearingType === 'HEARING_JUDGMENT' || hearingType === 'HEARING_PARENTING' || hearingType === 'HEARING_INVESTIGATION')) {
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

    // 참석하지 않는 법원기일은 회색 점 (선고, 양육상담, 면접조사)
    if (type === 'court_hearing' && (hearingType === 'HEARING_JUDGMENT' || hearingType === 'HEARING_PARENTING' || hearingType === 'HEARING_INVESTIGATION')) {
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

  // 주(week) 수 계산 - 그리드 행 높이 고정에 사용
  const numberOfWeeks = Math.ceil(calendarDays.length / 7)

  // 7일 보기용 - 현재 주의 날짜들 (월요일 시작)
  const weekStart = startOfWeek(selectedDate || new Date(), { weekStartsOn: 1 })
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  const selectedDaySchedules = selectedDate ? getSchedulesForDay(selectedDate) : []

  const getHolidayForDay = (day: Date): string | null => {
    const dateStr = format(day, 'yyyy-MM-dd')
    const holiday = holidays.find(h => h.holiday_date === dateStr)
    return holiday ? holiday.holiday_name : null
  }

  return (
    <div className="w-full max-w-5xl mx-auto pt-16 sm:pt-20 pb-6 sm:pb-8 px-3 sm:px-6 lg:px-8">
      {/* 간소화된 헤더 (iOS 스타일) */}
      <div className="bg-white rounded-lg border border-gray-200 mb-3 relative">
        <div className="flex items-center justify-between px-3 py-2">
          {/* 좌측: 이전/다음 달 + 년월 */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentDate(subMonths(currentDate, 1))}
              className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h2 className="text-sm sm:text-base font-semibold text-gray-900 min-w-[100px] text-center">
              {format(currentDate, 'yyyy년 M월', { locale: ko })}
            </h2>
            <button
              onClick={() => setCurrentDate(addMonths(currentDate, 1))}
              className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* 우측: 보기 전환 + 메뉴 */}
          <div className="flex items-center gap-1">
            {/* 월간/7일 전환 아이콘 */}
            {viewMode === 'calendar' ? (
              <button
                onClick={() => setViewMode('week')}
                className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                title="7일 보기로 전환"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </button>
            ) : viewMode === 'week' ? (
              <button
                onClick={() => setViewMode('calendar')}
                className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                title="월간 보기로 전환"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </button>
            ) : null}
            <button
              onClick={() => setShowMenu(!showMenu)}
              className={`p-2 rounded-lg transition-colors ${
                showMenu ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
              </svg>
            </button>
          </div>
        </div>

        {/* 드롭다운 메뉴 */}
        {showMenu && (
          <div className="absolute right-3 top-14 bg-white rounded-lg shadow-lg border border-gray-200 p-4 z-50 min-w-[200px]">
            {/* 필터 활성 표시 */}
            {(filterType !== 'all' || lawyerFilter !== 'all') && (
              <div className="mb-3 pb-3 border-b border-gray-100">
                <div className="flex items-center gap-2 text-xs text-sage-600">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 6.707A1 1 0 013 6V3z" clipRule="evenodd" />
                  </svg>
                  필터 적용됨
                </div>
              </div>
            )}

            {/* 일정 타입 필터 */}
            <div className="mb-4">
              <p className="text-xs text-gray-500 mb-2 font-medium">일정 필터</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setFilterType('all')}
                  className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    filterType === 'all'
                      ? 'bg-sage-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  전체
                </button>
                <button
                  onClick={() => setFilterType('court')}
                  className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    filterType === 'court'
                      ? 'bg-sage-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  재판만
                </button>
              </div>
            </div>

            {/* 변호사 필터 */}
            {tenantMembers.length > 0 && (
              <div className="mb-4">
                <p className="text-xs text-gray-500 mb-2 font-medium">변호사</p>
                <select
                  value={lawyerFilter}
                  onChange={(e) => setLawyerFilter(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-sage-500"
                >
                  <option value="all">모든 변호사</option>
                  {tenantMembers.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.display_name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <hr className="my-3 border-gray-100" />

            {/* 목록 보기 */}
            <button
              onClick={() => { setViewMode('list'); setShowMenu(false); }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg transition-colors mb-1 ${
                viewMode === 'list' ? 'bg-sage-100 text-sage-700' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
              목록 보기
            </button>

            {/* 오늘로 이동 */}
            <button
              onClick={() => {
                setCurrentDate(new Date())
                setSelectedDate(new Date())
                setShowMenu(false)
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              오늘로 이동
            </button>
          </div>
        )}
      </div>

      {/* 월간 캘린더 */}
      <div className="bg-white rounded-lg border border-gray-200 p-3 sm:p-4">
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
        ) : viewMode === 'week' ? (
          /* 7일 보기 (iOS 스타일 - 2열 4행 8칸 그리드) */
          <div className="grid grid-cols-2 rounded-lg overflow-hidden">
            {/* 첫 번째 칸: 미니 캘린더 */}
            <div className="bg-white p-3" style={{ minHeight: 'max(120px, calc((100vh - 240px) / 4))' }}>
              <div className="grid grid-cols-7 text-center mb-1">
                {['월', '화', '수', '목', '금', '토', '일'].map((d, i) => (
                  <div key={d} className={`text-[10px] font-medium py-0.5 ${
                    i === 5 ? 'text-blue-600' : i === 6 ? 'text-red-500' : 'text-gray-500'
                  }`}>
                    {d}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {/* 월요일 시작 달력 */}
                {(() => {
                  const monthStartLocal = startOfMonth(currentDate)
                  const monthEndLocal = endOfMonth(currentDate)
                  const calStartMon = startOfWeek(monthStartLocal, { weekStartsOn: 1 })
                  const calEndMon = endOfWeek(monthEndLocal, { weekStartsOn: 1 })
                  const days: Date[] = []
                  let d = calStartMon
                  while (d <= calEndMon) {
                    days.push(d)
                    d = addDays(d, 1)
                  }
                  return days.map((d, i) => {
                    const isInCurrentMonth = isSameMonth(d, currentDate)
                    const isSelectedDay = selectedDate && isSameDay(d, selectedDate)
                    const isTodayDay = isToday(d)
                    const hasSchedule = getSchedulesForDay(d).length > 0
                    const dayOfWeek = d.getDay()
                    const isSunday = dayOfWeek === 0
                    const isSaturday = dayOfWeek === 6
                    return (
                      <button
                        key={i}
                        onClick={() => setSelectedDate(d)}
                        className={`text-[10px] min-h-[22px] min-w-[22px] py-0.5 rounded transition-all font-medium focus:outline-none ${
                          isSelectedDay
                            ? 'bg-sage-600 text-white'
                            : isTodayDay
                            ? 'bg-sage-100 text-sage-700 font-bold'
                            : isInCurrentMonth
                            ? isSunday
                              ? 'text-red-500 hover:bg-red-50'
                              : isSaturday
                              ? 'text-blue-600 hover:bg-blue-50'
                              : 'text-gray-600 hover:bg-gray-100'
                            : 'text-gray-300'
                        }`}
                      >
                        <span>{format(d, 'd')}</span>
                        {hasSchedule && !isSelectedDay && (
                          <div className="w-1 h-1 bg-sage-500 rounded-full mx-auto mt-0.5" />
                        )}
                      </button>
                    )
                  })
                })()}
              </div>
            </div>

            {/* 나머지 7칸: 요일별 일정 (월~일) */}
            {weekDays.map((d, i) => {
              const daySchedules = getSchedulesForDay(d)
              const isTodayDay = isToday(d)
              const holidayName = getHolidayForDay(d)
              const isWeekend = d.getDay() === 0 || d.getDay() === 6
              const isSunday = d.getDay() === 0
              const isSelectedDay = selectedDate && isSameDay(d, selectedDate)

              return (
                <div
                  key={i}
                  onClick={() => setSelectedDate(d)}
                  className={`bg-white p-2 sm:p-3 cursor-pointer relative ${
                    isSelectedDay
                      ? 'bg-sage-50 ring-1 ring-sage-400 ring-inset transition-all duration-150'
                      : 'hover:bg-gray-50 active:scale-[0.99] transition-all duration-150'
                  }`}
                  style={{ minHeight: 'max(120px, calc((100vh - 240px) / 4))' }}
                >
                  {/* 날짜 헤더 */}
                  <div className="flex items-center gap-1 mb-2">
                    <span className={`text-sm font-bold transition-all duration-150 flex-shrink-0 ${
                      isSelectedDay
                        ? 'w-6 h-6 flex items-center justify-center rounded-full text-xs text-white bg-sage-500'
                        : holidayName || isSunday ? 'text-red-500' : isWeekend ? 'text-blue-600' : 'text-gray-800'
                    }`}>
                      {format(d, 'd')}
                    </span>
                    <span className={`text-xs font-medium flex-shrink-0 ${
                      holidayName || isSunday ? 'text-red-400' : isWeekend ? 'text-blue-500' : 'text-gray-400'
                    }`}>
                      {format(d, 'EEE', { locale: ko })}
                    </span>
                    {isTodayDay && !holidayName && (
                      <span className="text-[10px] text-sage-700 font-medium bg-sage-100 px-1.5 py-0.5 rounded">TODAY</span>
                    )}
                    {holidayName && (
                      <span className="text-[10px] text-red-500 font-medium truncate">
                        {holidayName}{isTodayDay && ' (TODAY)'}
                      </span>
                    )}
                  </div>

                  {/* 일정 목록 */}
                  <div className="space-y-1">
                    {daySchedules.slice(0, 4).map((schedule) => (
                      <div
                        key={schedule.id}
                        className={`text-[9px] px-1 py-0.5 rounded border-l-2 ${getScheduleTypeColor(schedule.type, schedule.hearing_type, schedule.event_subtype, schedule.scourt_result_raw)} leading-tight cursor-pointer`}
                        title={`${schedule.time?.slice(0, 5) || ''} ${schedule.title} ${schedule.location ? '- ' + schedule.location : ''}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          if (schedule.case_id) {
                            window.location.href = `/cases/${schedule.case_id}`
                          }
                        }}
                      >
                        <div className="font-medium truncate">
                          {schedule.time?.slice(0, 5)}
                          {schedule.location && (
                            <span className="ml-0.5 text-gray-500 font-normal">{getShortCourt(schedule.location)}</span>
                          )}
                          {schedule.type === 'deadline' && schedule.daysUntil !== undefined && (
                            <span className="ml-0.5 text-orange-600 font-medium">{formatDaysUntil(schedule.daysUntil)}</span>
                          )}
                        </div>
                        <div className="truncate text-gray-600">
                          {getShortTitle(schedule.title)}
                        </div>
                      </div>
                    ))}
                    {daySchedules.length > 4 && (
                      <div className="text-[9px] text-gray-500 font-medium px-1">
                        +{daySchedules.length - 4}건
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <>
            {/* 요일 헤더 */}
            <div className="grid grid-cols-7 mb-1">
              {['일', '월', '화', '수', '목', '금', '토'].map((day, index) => (
                <div
                  key={day}
                  className={`text-center font-medium text-xs py-1 ${
                    index === 0 ? 'text-red-500' : index === 6 ? 'text-blue-600' : 'text-gray-500'
                  }`}
                >
                  {day}
                </div>
              ))}
            </div>

            {/* 날짜 그리드 (그리드 선 없음) */}
            <div
              className="grid grid-cols-7 rounded-lg overflow-hidden"
              style={{
                gridTemplateRows: `repeat(${numberOfWeeks}, minmax(90px, calc((100vh - 220px) / ${numberOfWeeks})))`,
              }}
            >
              {calendarDays.map((day, index) => {
                const daySchedules = getSchedulesForDay(day)
                const isCurrentMonth = isSameMonth(day, currentDate)
                const isCurrentDay = isToday(day)
                const isSelected = selectedDate && isSameDay(day, selectedDate)
                const holidayName = getHolidayForDay(day)
                const isHoliday = Boolean(holidayName)
                const dayOfWeek = day.getDay() // 0=일요일, 6=토요일
                const isSunday = dayOfWeek === 0
                const isSaturday = dayOfWeek === 6

                return (
                  <div
                    key={index}
                    onClick={() => setSelectedDate(day)}
                    className={`p-1 sm:p-2 cursor-pointer overflow-hidden relative ${
                      isSelected
                        ? 'bg-sage-50 ring-1 ring-sage-400 ring-inset z-10 transition-all duration-150'
                        : 'hover:bg-gray-50 active:scale-[0.98] transition-all duration-150'
                    } ${!isCurrentMonth ? 'opacity-40' : ''}`}
                  >
                    <div className="flex items-center gap-1 mb-1">
                      <div className={`text-xs font-medium transition-all duration-150 flex-shrink-0 ${
                        isSelected
                          ? 'w-5 h-5 flex items-center justify-center rounded-full text-[10px] text-white bg-sage-500'
                          : isHoliday || isSunday
                          ? 'text-red-500'
                          : isSaturday
                          ? 'text-blue-600'
                          : 'text-gray-700'
                      }`}>
                        {format(day, 'd')}
                      </div>
                      {isCurrentDay && !holidayName && (
                        <span className="text-[9px] text-sage-700 font-medium bg-sage-100 px-1.5 py-0.5 rounded">TODAY</span>
                      )}
                      {holidayName && (
                        <span className="text-[9px] text-red-500 font-medium truncate" title={holidayName}>
                          {holidayName}{isCurrentDay && ' (TODAY)'}
                        </span>
                      )}
                      {daySchedules.length > 0 && (
                        <div className="flex gap-0.5 ml-auto flex-shrink-0">
                          {daySchedules.slice(0, 3).map((schedule) => (
                            <div
                              key={schedule.id}
                              className={`w-1.5 h-1.5 rounded-full ${getScheduleTypeDot(schedule.type, schedule.hearing_type)}`}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="space-y-0.5">
                      {/* 일정 텍스트 표시 */}
                      {daySchedules.slice(0, 2).map((schedule) => (
                        <div
                          key={schedule.id}
                          className={`text-[9px] px-1 py-0.5 rounded border-l-2 ${getScheduleTypeColor(schedule.type, schedule.hearing_type, schedule.event_subtype, schedule.scourt_result_raw)} leading-tight`}
                          title={`${schedule.time?.slice(0, 5) || ''} ${schedule.title} ${schedule.location ? '- ' + schedule.location : ''}`}
                        >
                          <div className="font-medium truncate">
                            {schedule.time?.slice(0, 5)}
                            {schedule.location && (
                              <span className="ml-0.5 text-gray-500 font-normal">{getShortCourt(schedule.location)}</span>
                            )}
                            {schedule.type === 'deadline' && schedule.daysUntil !== undefined && (
                              <span className="ml-0.5 text-orange-600 font-medium">{formatDaysUntil(schedule.daysUntil)}</span>
                            )}
                          </div>
                          <div className="truncate text-gray-600">
                            {getShortTitle(schedule.title)}
                          </div>
                        </div>
                      ))}
                      {daySchedules.length > 2 && (
                        <div className="text-[9px] text-gray-500 font-medium px-1">
                          +{daySchedules.length - 2}건
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
        <div className="bg-white rounded-lg border border-gray-200 p-3 mt-3 shadow-sm">
          <div className="flex justify-between items-center mb-3">
            <div>
              <h3 className="text-xs font-bold text-gray-900">
                {format(selectedDate, 'M월 d일 (E)', { locale: ko })} 일정
              </h3>
              <p className="text-[10px] text-gray-500 mt-0.5">
                {format(selectedDate, 'yyyy년', { locale: ko })}
              </p>
            </div>
            <button
              onClick={() => setSelectedDate(null)}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-300"
              aria-label="닫기"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {selectedDaySchedules.length === 0 ? (
            <div className="text-center py-6">
              <svg className="w-8 h-8 mx-auto text-gray-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-[10px] text-gray-500">이 날짜에 등록된 일정이 없습니다.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {selectedDaySchedules.map((schedule) => {
                return (
                  <div
                    key={schedule.id}
                    className={`p-2.5 rounded-lg border-l-4 ${getScheduleTypeColor(schedule.type, schedule.hearing_type, schedule.event_subtype, schedule.scourt_result_raw)} hover:shadow-md transition-all cursor-pointer border border-gray-100 focus:outline-none focus:ring-2 focus:ring-sage-400`}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        e.currentTarget.click()
                      }
                    }}
                    onClick={async () => {
                      // 법원기일/데드라인: case_id가 있으면 사건 페이지로 이동
                      if ((schedule.type === 'court_hearing' || schedule.type === 'deadline') && schedule.case_id) {
                        window.location.href = `/cases/${schedule.case_id}`
                        return
                      }

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
                    <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-white/90 shadow-sm">
                        {/* 법원기일: 연기시 "기일연기", 아니면 scourt_type_raw 우선 표시 (화상장치 텍스트 제거) */}
                        {schedule.type === 'court_hearing' && isPostponedHearing(schedule.scourt_result_raw)
                          ? '기일연기'
                          : schedule.type === 'court_hearing' && schedule.scourt_type_raw
                            ? removeVideoDeviceText(schedule.scourt_type_raw)
                            : getScheduleTypeLabel(schedule.type, schedule.location)}
                      </span>
                      {schedule.time && (
                        <span className="text-[10px] font-semibold text-gray-700">
                          {schedule.time.slice(0, 5)}
                        </span>
                      )}
                      {schedule.type === 'deadline' && schedule.daysUntil !== undefined && (
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          schedule.daysUntil <= 1 ? 'bg-red-100 text-red-700' :
                          schedule.daysUntil <= 3 ? 'bg-orange-100 text-orange-700' :
                          'bg-amber-100 text-amber-700'
                        }`}>
                          {formatDaysUntil(schedule.daysUntil)}
                        </span>
                      )}
                    </div>
                    <h4 className="text-xs font-semibold text-gray-900 mb-1">{schedule.title}</h4>
                    {schedule.case_number && (
                      <p className="text-[10px] text-gray-600 flex items-center gap-1 mb-0.5">
                        <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span className="truncate">{schedule.case_number}</span>
                      </p>
                    )}
                    {schedule.location && (
                      <p className="text-[10px] text-gray-600 flex items-center gap-1">
                        <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span className="truncate">{shortenCourtLocation(schedule.location)}</span>
                      </p>
                    )}
                    {/* SCOURT 기일 결과 표시 (예: "다음기일지정(2025.02.15)", "변론종결") */}
                    {schedule.type === 'court_hearing' && schedule.scourt_result_raw && (
                      <p className="text-[10px] text-sage-600 flex items-center gap-1 mt-0.5">
                        <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="truncate">결과: {schedule.scourt_result_raw}</span>
                      </p>
                    )}
                    {/* 출석변호사 표시 및 변경 (법원기일만, 변호사 출석 불필요 기일 제외) */}
                    {schedule.type === 'court_hearing' &&
                     tenantMembers.length > 0 &&
                     !isNoLawyerAttendanceRequired(schedule) && (
                      <div
                        className="mt-2 pt-2 border-t border-gray-200 flex items-center gap-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className="text-[10px] text-gray-600 flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          출석:
                        </span>
                        <select
                          value={schedule.attending_lawyer_id || ''}
                          onChange={(e) => updateAttendingLawyer(schedule.id, e.target.value || null)}
                          disabled={updatingLawyer === schedule.id}
                          className={`text-[10px] px-2 py-1 rounded border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-sage-500 focus:border-sage-500 ${
                            updatingLawyer === schedule.id ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                          }`}
                        >
                          <option value="">미지정</option>
                          {tenantMembers.map((member) => (
                            <option key={member.id} value={member.id}>
                              {member.display_name}
                            </option>
                          ))}
                        </select>
                        {updatingLawyer === schedule.id && (
                          <div className="animate-spin w-3 h-3 border-2 border-gray-300 border-t-sage-600 rounded-full" />
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* 일정 추가 버튼 */}
          <div className="mt-3 pt-3 border-t border-gray-200">
            <button
              className="w-full px-3 py-2 text-[10px] font-semibold text-sage-700 bg-sage-50 border border-sage-200 rounded-lg hover:bg-sage-100 hover:border-sage-300 transition-all focus:outline-none focus:ring-2 focus:ring-sage-400 focus:ring-offset-1 flex items-center justify-center gap-1.5"
              onClick={() => {
                if (selectedDate) {
                  setPrefilledDate(format(selectedDate, 'yyyy-MM-dd'))
                }
                setEditingSchedule(null)
                setShowAddModal(true)
              }}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              이 날짜에 일정 추가
            </button>
          </div>
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
