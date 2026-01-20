'use client'

// Temporal API polyfill for Schedule-X (must be imported before Schedule-X)
import { Temporal } from '@js-temporal/polyfill'
if (typeof (globalThis as Record<string, unknown>).Temporal === 'undefined') {
  (globalThis as Record<string, unknown>).Temporal = Temporal
}

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addMonths, subMonths, isSameDay } from 'date-fns'
import { ko } from 'date-fns/locale'
import { formatDaysUntil } from '@/types/court-hearing'

// Schedule-X imports
import { ScheduleXCalendar, useNextCalendarApp } from '@schedule-x/react'
import { viewWeek, viewMonthGrid, viewDay } from '@schedule-x/calendar'
import { createDragAndDropPlugin } from '@schedule-x/drag-and-drop'
import { createResizePlugin } from '@schedule-x/resize'
import '@schedule-x/theme-default/dist/index.css'

// Custom components
import ScheduleXEventCard, { ScheduleXEventChip } from './calendar/ScheduleXEventCard'
import ScheduleListView from './ScheduleListView'
import UnifiedScheduleModal, { type EditScheduleData } from './UnifiedScheduleModal'

// Types
interface Profile {
  id: string
  name?: string
  email?: string
  role: string
  tenant_id?: string
  display_name?: string
}

interface ApiEvent {
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
  video_participant_side?: string | null
  our_client_side?: string | null
}

interface Holiday {
  id: string
  holiday_date: string
  holiday_name: string
  year: number
}

interface TenantMember {
  id: string
  display_name: string
  role: string
}

// Schedule-X event format
interface ScheduleXEvent {
  id: string
  start: string | Temporal.PlainDate | Temporal.ZonedDateTime
  end: string | Temporal.PlainDate | Temporal.ZonedDateTime
  title: string
  location?: string
  description?: string
  calendarId?: string
  // Custom properties for our system
  eventType?: string
  eventSubtype?: string
  caseId?: string
  caseNumber?: string
  caseName?: string
  status?: string
  attendingLawyerId?: string
  attendingLawyerName?: string
  scourtTypeRaw?: string
  scourtResultRaw?: string
  videoParticipantSide?: string
  ourClientSide?: string
  daysUntil?: number
}

// Unified schedule for detail panel
interface UnifiedSchedule {
  id: string
  type: 'trial' | 'consultation' | 'meeting' | 'court_hearing' | 'deadline'
  title: string
  date: string
  time?: string
  location?: string
  case_number?: string
  case_name?: string
  case_id?: string
  notes?: string
  status?: string
  daysUntil?: number
  hearing_type?: string
  event_subtype?: string
  attending_lawyer_id?: string
  attending_lawyer_name?: string
  scourt_type_raw?: string
  scourt_result_raw?: string
  video_participant_side?: string
  our_client_side?: string
}

// Helper function to extract date string from event (supports both string and Temporal)
function getEventDateString(eventStart: string | Temporal.PlainDate | Temporal.ZonedDateTime): string {
  if (typeof eventStart === 'string') {
    return eventStart.split(' ')[0]
  }
  // Temporal.PlainDate.toString() returns "2026-01-01"
  // Temporal.ZonedDateTime.toString() returns "2026-01-01T00:00:00+09:00[Asia/Seoul]"
  const str = eventStart.toString()
  return str.split('T')[0]
}

// Helper function to extract time string from event (supports both string and Temporal)
function getEventTimeString(eventStart: string | Temporal.PlainDate | Temporal.ZonedDateTime): string | undefined {
  if (typeof eventStart === 'string') {
    const parts = eventStart.split(' ')
    return parts[1] || undefined
  }
  // Temporal.PlainDate has no time
  if ('hour' in eventStart) {
    // ZonedDateTime
    const zdt = eventStart as Temporal.ZonedDateTime
    return `${String(zdt.hour).padStart(2, '0')}:${String(zdt.minute).padStart(2, '0')}`
  }
  return undefined
}

// Event type to calendar ID mapping
const EVENT_TYPE_CALENDAR_MAP: Record<string, string> = {
  COURT_HEARING: 'court_hearing',
  DEADLINE: 'deadline',
  CONSULTATION: 'consultation',
  MEETING: 'meeting',
}

// View mode type
type ViewMode = 'month' | 'week' | 'day' | 'list'

// 변호사 출석 불필요 기일 유형
const NO_LAWYER_ATTENDANCE_TYPES = [
  'HEARING_JUDGMENT',
  'HEARING_INVESTIGATION',
  'HEARING_PARENTING',
] as const

const NO_LAWYER_ATTENDANCE_KEYWORDS = ['조정조치']

function isNoLawyerAttendanceRequired(schedule: UnifiedSchedule): boolean {
  if (NO_LAWYER_ATTENDANCE_TYPES.includes(schedule.hearing_type as typeof NO_LAWYER_ATTENDANCE_TYPES[number])) {
    return true
  }
  if (schedule.scourt_type_raw) {
    return NO_LAWYER_ATTENDANCE_KEYWORDS.some(keyword => schedule.scourt_type_raw!.includes(keyword))
  }
  return false
}

// 기일 연기/변경 여부 확인
const isPostponedHearing = (result?: string): boolean => {
  if (!result) return false
  const keywords = ['기일변경', '연기', '취하', '취소', '변경지정']
  return keywords.some(kw => result.includes(kw))
}

// 화상장치 관련 텍스트 제거
const removeVideoDeviceText = (text: string) => {
  return text.replace(/\s*\[(일방|쌍방)\s*화상장치\]\s*/g, '').trim()
}

// 화상기일 배지 정보 반환
const getVideoBadgeInfo = (scourtTypeRaw?: string, videoParticipantSide?: string, ourClientSide?: string): { show: boolean; label: string; color: string } | null => {
  if (scourtTypeRaw?.includes('쌍방 화상장치') || scourtTypeRaw?.includes('쌍방화상장치') || videoParticipantSide === 'both') {
    return { show: true, label: '화상', color: 'bg-purple-100 text-purple-700' }
  }
  if (videoParticipantSide && ourClientSide) {
    if (videoParticipantSide === ourClientSide) {
      return { show: true, label: '화상', color: 'bg-purple-100 text-purple-700' }
    }
    return null
  }
  if (scourtTypeRaw?.includes('일방 화상장치') || scourtTypeRaw?.includes('일방화상장치')) {
    return { show: true, label: '화상', color: 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)]' }
  }
  return null
}

// 캘린더 셀용 짧은 제목
const getShortTitle = (title: string) => {
  return title
    .replace(/\s*\[(일방|쌍방)\s*화상장치\]\s*/g, ' ')
    .replace('변론기일', '변론')
    .replace('조정기일', '조정')
    .replace('선고기일', '선고')
    .replace('판결선고', '판결')
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

// 법원명 짧게
const getShortCourt = (location?: string) => {
  if (!location) return ''
  const jiwonMatch = location.match(/([가-힣]{2,4})지원/)
  if (jiwonMatch) return jiwonMatch[1]
  const siMatch = location.match(/([가-힣]{2,4})시법원/)
  if (siMatch) return siMatch[1]
  const courtNames = ['서울', '수원', '평택', '천안', '대전', '대구', '부산', '광주', '인천', '울산', '창원', '청주', '전주', '춘천', '제주', '의정부', '고양', '성남', '안산', '안양', '용인', '화성', '서산', '아산', '세종']
  for (const name of courtNames) {
    if (location.includes(name)) return name
  }
  return location.slice(0, 2)
}

// 법원명 축약형
const shortenCourtLocation = (location?: string): string => {
  if (!location) return ''
  const jiwonMatch = location.match(/[가-힣]+법원\s+([가-힣]{2,4}지원)\s+(.+)/)
  if (jiwonMatch) return `${jiwonMatch[1]} ${jiwonMatch[2]}`
  const goMatch = location.match(/([가-힣]{2,3})고등법원\s+(.+)/)
  if (goMatch) return `${goMatch[1]}고법 ${goMatch[2]}`
  const gaMatch = location.match(/([가-힣]{2,3})가정법원\s+(.+)/)
  if (gaMatch) return `${gaMatch[1]}가정 ${gaMatch[2]}`
  const jiMatch = location.match(/([가-힣]{2,3})지방법원\s+(.+)/)
  if (jiMatch) return `${jiMatch[1]}지법 ${jiMatch[2]}`
  return location
}

// 일정 타입 레이블
const getScheduleTypeLabel = (type: string, location?: string | null) => {
  if (type === 'consultation' && location) {
    if (location.includes('천안')) return '천안상담'
    if (location.includes('평택')) return '평택상담'
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

// 일정 타입별 색상
const getScheduleTypeColor = (type: string, hearingType?: string, eventSubtype?: string, scourtResultRaw?: string) => {
  if (type === 'court_hearing' && isPostponedHearing(scourtResultRaw)) {
    return 'bg-[var(--bg-tertiary)] text-[var(--text-muted)] border-l-[var(--border-default)]'
  }
  if (type === 'court_hearing' && hearingType === 'HEARING_LAWYER_MEETING') {
    return 'bg-teal-50 text-teal-700 border-l-teal-500'
  }
  if (type === 'court_hearing' && (hearingType === 'HEARING_JUDGMENT' || hearingType === 'HEARING_PARENTING' || hearingType === 'HEARING_INVESTIGATION')) {
    return 'bg-[var(--bg-primary)] text-[var(--text-secondary)] border-l-[var(--border-default)]'
  }
  if (type === 'consultation' && eventSubtype?.startsWith('pending_')) {
    return 'bg-[var(--color-info-muted)] text-[var(--color-info)] border-l-[var(--color-info)] border-dashed'
  }
  switch (type) {
    case 'trial': return 'bg-[var(--sage-muted)] text-[var(--sage-primary)] border-l-[var(--sage-primary)]'
    case 'consultation': return 'bg-[var(--color-info-muted)] text-[var(--color-info)] border-l-[var(--color-info)]'
    case 'meeting': return 'bg-[var(--bg-primary)] text-[var(--text-secondary)] border-l-[var(--border-default)]'
    case 'court_hearing': return 'bg-[var(--sage-muted)] text-[var(--sage-primary)] border-l-[var(--sage-primary)]'
    case 'deadline': return 'bg-orange-50 text-orange-700 border-l-orange-500'
    default: return 'bg-[var(--bg-primary)] text-[var(--text-secondary)] border-l-[var(--border-default)]'
  }
}

// Convert API event to Schedule-X format
function convertToScheduleXEvent(event: ApiEvent): ScheduleXEvent {
  const eventType = EVENT_TYPE_CALENDAR_MAP[event.event_type] || 'meeting'
  const hasTime = event.event_time && event.event_time !== '00:00' && event.event_time !== '00:00:00'

  let start: string
  let end: string

  if (hasTime) {
    const timeStr = event.event_time!.slice(0, 5)
    start = `${event.event_date} ${timeStr}`
    const [hours, minutes] = timeStr.split(':').map(Number)
    const endHours = Math.min(hours + 1, 23)
    end = `${event.event_date} ${String(endHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
  } else {
    start = event.event_date
    end = event.event_date
  }

  // Calculate daysUntil for deadlines
  let daysUntil: number | undefined
  if (event.event_type === 'DEADLINE') {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const deadlineDate = new Date(event.event_date)
    deadlineDate.setHours(0, 0, 0, 0)
    daysUntil = Math.ceil((deadlineDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  }

  return {
    id: event.id,
    start,
    end,
    title: event.title,
    location: event.location || undefined,
    description: event.description || undefined,
    calendarId: eventType,
    eventType: event.event_type,
    eventSubtype: event.event_subtype || undefined,
    caseId: event.case_id || undefined,
    caseNumber: event.reference_id || undefined,
    caseName: event.case_name || undefined,
    status: event.status || undefined,
    attendingLawyerId: event.attending_lawyer_id || undefined,
    attendingLawyerName: event.attending_lawyer_name || undefined,
    scourtTypeRaw: event.scourt_type_raw || undefined,
    scourtResultRaw: event.scourt_result_raw || undefined,
    videoParticipantSide: event.video_participant_side || undefined,
    ourClientSide: event.our_client_side || undefined,
    daysUntil,
  }
}

// Convert ScheduleXEvent to UnifiedSchedule
function convertToUnifiedSchedule(event: ScheduleXEvent): UnifiedSchedule {
  let type: UnifiedSchedule['type'] = 'meeting'
  if (event.eventType === 'COURT_HEARING') type = 'court_hearing'
  else if (event.eventType === 'DEADLINE') type = 'deadline'
  else if (event.eventType === 'CONSULTATION') type = 'consultation'

  // Use helper functions to handle both string and Temporal formats
  const date = getEventDateString(event.start)
  const time = getEventTimeString(event.start)

  return {
    id: event.id,
    type,
    title: event.title,
    date,
    time,
    location: event.location,
    case_number: event.caseNumber,
    case_name: event.caseName,
    case_id: event.caseId,
    notes: event.description,
    status: event.status,
    daysUntil: event.daysUntil,
    hearing_type: event.eventSubtype,
    event_subtype: event.eventSubtype,
    attending_lawyer_id: event.attendingLawyerId,
    attending_lawyer_name: event.attendingLawyerName,
    scourt_type_raw: event.scourtTypeRaw,
    scourt_result_raw: event.scourtResultRaw,
    video_participant_side: event.videoParticipantSide,
    our_client_side: event.ourClientSide,
  }
}

interface ScheduleXCalendarProps {
  profile: Profile
}

// Convert string date/time to Temporal object for Schedule-X
function toTemporalDate(dateStr: string): Temporal.PlainDate | Temporal.ZonedDateTime {
  // If already a Temporal object, return as-is (shouldn't happen but safety check)
  if (typeof dateStr !== 'string') {
    return dateStr
  }

  // Check if it has time component (e.g., "2026-01-20 10:00" or "2026-01-20T10:00")
  const hasTime = dateStr.includes(' ') || (dateStr.includes('T') && dateStr.length > 10)

  if (hasTime) {
    // Parse date and time
    const normalized = dateStr.replace(' ', 'T')
    const [datePart, timePart] = normalized.split('T')
    const [year, month, day] = datePart.split('-').map(Number)
    const [hours, minutes] = (timePart || '00:00').split(':').map(Number)

    // Use UTC timezone with local time values
    // This prevents double timezone conversion by Schedule-X
    return Temporal.ZonedDateTime.from({
      year,
      month,
      day,
      hour: hours || 0,
      minute: minutes || 0,
      second: 0,
      timeZone: 'UTC',
    })
  } else {
    // Date only
    return Temporal.PlainDate.from(dateStr)
  }
}

// Inner calendar component that creates a fresh calendar instance with the given events
interface CalendarInnerProps {
  events: ScheduleXEvent[]
  onEventClick: (event: ScheduleXEvent) => void
  onEventUpdate: (event: ScheduleXEvent) => void
  onClickDate: (date: Date) => void
}

function CalendarInner({ events, onEventClick, onEventUpdate, onClickDate }: CalendarInnerProps) {
  const isInitialMount = useRef(true)

  // Convert string dates to Temporal objects for Schedule-X
  const temporalEvents = useMemo(() => {
    return events.map(event => {
      const startTemporal = typeof event.start === 'string' ? toTemporalDate(event.start) : event.start
      const endTemporal = typeof event.end === 'string' ? toTemporalDate(event.end) : event.end
      return {
        ...event,
        start: startTemporal,
        end: endTemporal,
      }
    })
  }, [events])

  const calendar = useNextCalendarApp({
    locale: 'ko-KR',
    defaultView: viewMonthGrid.name,
    views: [viewDay, viewWeek, viewMonthGrid],
    events: temporalEvents,
    calendars: {
      holiday: {
        colorName: 'holiday',
        lightColors: {
          main: '#EF4444',
          container: 'rgba(239, 68, 68, 0.1)',
          onContainer: '#EF4444',
        },
        darkColors: {
          main: '#F87171',
          container: 'rgba(248, 113, 113, 0.15)',
          onContainer: '#F87171',
        },
      },
      court_hearing: {
        colorName: 'court_hearing',
        lightColors: {
          main: '#6DB5A4',
          container: 'rgba(109, 181, 164, 0.15)',
          onContainer: '#6DB5A4',
        },
        darkColors: {
          main: '#6DB5A4',
          container: 'rgba(109, 181, 164, 0.2)',
          onContainer: '#8CCABE',
        },
      },
      consultation: {
        colorName: 'consultation',
        lightColors: {
          main: '#3B82F6',
          container: 'rgba(59, 130, 246, 0.15)',
          onContainer: '#3B82F6',
        },
        darkColors: {
          main: '#3B82F6',
          container: 'rgba(59, 130, 246, 0.2)',
          onContainer: '#60A5FA',
        },
      },
      deadline: {
        colorName: 'deadline',
        lightColors: {
          main: '#F59E0B',
          container: 'rgba(245, 158, 11, 0.15)',
          onContainer: '#F59E0B',
        },
        darkColors: {
          main: '#F59E0B',
          container: 'rgba(245, 158, 11, 0.2)',
          onContainer: '#FBBF24',
        },
      },
      meeting: {
        colorName: 'meeting',
        lightColors: {
          main: '#6B7280',
          container: 'rgba(107, 114, 128, 0.1)',
          onContainer: '#6B7280',
        },
        darkColors: {
          main: '#9CA3AF',
          container: 'rgba(156, 163, 175, 0.15)',
          onContainer: '#9CA3AF',
        },
      },
    },
    dayBoundaries: {
      start: '07:00',
      end: '22:00',
    },
    weekOptions: {
      gridHeight: 800,
      nDays: 7,
      eventWidth: 95,
    },
    monthGridOptions: {
      nEventsPerDay: 4,
    },
    callbacks: {
      onEventClick: (event) => onEventClick(event as unknown as ScheduleXEvent),
      onEventUpdate: (event) => onEventUpdate(event as unknown as ScheduleXEvent),
      onClickDate: (date) => {
        const dateStr = typeof date === 'string' ? date : String(date)
        const clickedDate = new Date(dateStr)
        onClickDate(clickedDate)
      },
    },
  }, [
    createDragAndDropPlugin(15),
    createResizePlugin(15),
  ])

  // Update events dynamically without remounting the calendar
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }
    // Update events in place - no remount needed
    if (calendar) {
      calendar.events.set(temporalEvents)
    }
  }, [temporalEvents, calendar])

  return (
    <ScheduleXCalendar
      calendarApp={calendar}
      customComponents={{
        timeGridEvent: ScheduleXEventCard,
        dateGridEvent: ScheduleXEventCard,
        monthGridEvent: ScheduleXEventChip,
      }}
    />
  )
}

export default function ScheduleXCalendarComponent({ profile: _profile }: ScheduleXCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [allEvents, setAllEvents] = useState<ScheduleXEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [tenantMembers, setTenantMembers] = useState<TenantMember[]>([])

  // View and filter state
  const [viewMode, setViewMode] = useState<ViewMode>('month')
  const [filterType, setFilterType] = useState<'all' | 'court'>('all')
  const [lawyerFilter, setLawyerFilter] = useState<string>('all')
  const [showMenu, setShowMenu] = useState(false)

  // Selected date and detail panel
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [isDetailPanelCollapsed, setIsDetailPanelCollapsed] = useState(false)

  // Modal state
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingSchedule, setEditingSchedule] = useState<EditScheduleData | null>(null)
  const [prefilledDate, setPrefilledDate] = useState<string>('')

  // Lawyer update state
  const [updatingLawyer, setUpdatingLawyer] = useState<string | null>(null)

  const monthStart = useMemo(() => startOfMonth(currentDate), [currentDate])
  const monthEnd = useMemo(() => endOfMonth(currentDate), [currentDate])
  const calendarStart = useMemo(() => startOfWeek(monthStart, { weekStartsOn: 0 }), [monthStart])
  const calendarEnd = useMemo(() => endOfWeek(monthEnd, { weekStartsOn: 0 }), [monthEnd])

  // Fetch tenant members (lawyers)
  const fetchTenantMembers = useCallback(async () => {
    try {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { data } = await supabase
        .from('tenant_members')
        .select('id, display_name, role')
        .in('role', ['owner', 'lawyer'])
        .order('display_name')
      if (data) setTenantMembers(data)
    } catch (error) {
      console.error('테넌트 멤버 조회 실패:', error)
    }
  }, [])

  // Update attending lawyer
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

      const lawyerName = lawyerId
        ? tenantMembers.find(m => m.id === lawyerId)?.display_name
        : undefined

      setAllEvents(prev =>
        prev.map(e =>
          e.id === hearingId
            ? { ...e, attendingLawyerId: lawyerId || undefined, attendingLawyerName: lawyerName }
            : e
        )
      )
    } catch (error) {
      console.error('출석변호사 변경 실패:', error)
      alert('출석변호사 변경에 실패했습니다.')
    } finally {
      setUpdatingLawyer(null)
    }
  }

  // Fetch schedules from API
  const fetchSchedules = useCallback(async () => {
    try {
      setLoading(true)
      const startDate = format(monthStart, 'yyyy-MM-dd')
      const endDate = format(monthEnd, 'yyyy-MM-dd')

      const response = await fetch(`/api/admin/calendar?start_date=${startDate}&end_date=${endDate}`)
      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch schedules')
      }

      const scheduleXEvents = (result.data || []).map(convertToScheduleXEvent)

      // Sort deadlines to top
      const sortedEvents = [...scheduleXEvents].sort((a, b) => {
        const aDate = a.start.split(' ')[0]
        const bDate = b.start.split(' ')[0]
        if (aDate === bDate) {
          if (a.eventType === 'DEADLINE' && b.eventType !== 'DEADLINE') return -1
          if (a.eventType !== 'DEADLINE' && b.eventType === 'DEADLINE') return 1
        }
        return 0
      })

      setAllEvents(sortedEvents)

      // Fetch holidays
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
      console.error('Failed to load schedules:', error)
    } finally {
      setLoading(false)
    }
  }, [monthStart, monthEnd, calendarStart, calendarEnd])

  useEffect(() => {
    fetchSchedules()
  }, [fetchSchedules])

  useEffect(() => {
    fetchTenantMembers()
  }, [fetchTenantMembers])

  // Convert holidays to Schedule-X events
  // Use string format with time - Schedule-X will convert internally
  const holidayEvents: ScheduleXEvent[] = useMemo(() => {
    return holidays.map(holiday => ({
      id: `holiday-${holiday.id}`,
      start: `${holiday.holiday_date} 00:00`,
      end: `${holiday.holiday_date} 23:59`,
      title: holiday.holiday_name,
      calendarId: 'holiday',
      eventType: 'HOLIDAY',
    }))
  }, [holidays])

  // Apply filters using useMemo to avoid extra render cycles
  const events = useMemo(() => {
    let filtered = allEvents

    if (filterType === 'court') {
      filtered = filtered.filter(e => e.eventType !== 'CONSULTATION')
    }

    if (lawyerFilter !== 'all') {
      filtered = filtered.filter(e => e.attendingLawyerId === lawyerFilter)
    }

    return filtered
  }, [allEvents, filterType, lawyerFilter])

  // Handle event update (drag and drop / resize)
  const handleEventUpdate = useCallback(async (updatedEvent: ScheduleXEvent) => {
    // Update local state optimistically
    setAllEvents(prev => prev.map(e => e.id === updatedEvent.id ? updatedEvent : e))

    try {
      const newDate = getEventDateString(updatedEvent.start)
      const newTime = getEventTimeString(updatedEvent.start) || null

      let apiEndpoint: string | null = null
      let updatePayload: Record<string, unknown> = {}

      switch (updatedEvent.eventType) {
        case 'COURT_HEARING':
          apiEndpoint = `/api/admin/court-hearings/${updatedEvent.id}`
          updatePayload = { hearing_date: newDate, hearing_time: newTime }
          break
        case 'DEADLINE':
          apiEndpoint = `/api/admin/case-deadlines/${updatedEvent.id}`
          updatePayload = { deadline_date: newDate }
          break
        case 'CONSULTATION':
          apiEndpoint = `/api/admin/consultations/${updatedEvent.id}`
          updatePayload = { scheduled_date: newDate, scheduled_time: newTime }
          break
        default:
          console.warn('Unknown event type, skipping API update:', updatedEvent.eventType)
          return
      }

      if (apiEndpoint) {
        const response = await fetch(apiEndpoint, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatePayload),
        })
        const result = await response.json()
        if (!result.success) {
          throw new Error(result.error || 'Failed to update event')
        }
      }
    } catch (error) {
      console.error('Failed to update event:', error)
      fetchSchedules()
    }
  }, [fetchSchedules])

  // Handle event click
  const handleEventClick = useCallback((event: ScheduleXEvent) => {
    console.log('Event clicked:', event)

    // Set selected date to the event's date
    const eventDate = new Date(getEventDateString(event.start))
    setSelectedDate(eventDate)
  }, [])

  // Get holiday for a day
  const getHolidayForDay = (day: Date): string | null => {
    const dateStr = format(day, 'yyyy-MM-dd')
    const holiday = holidays.find(h => h.holiday_date === dateStr)
    return holiday ? holiday.holiday_name : null
  }

  // Get schedules for a specific day
  const getSchedulesForDay = useCallback((day: Date): UnifiedSchedule[] => {
    const dateStr = format(day, 'yyyy-MM-dd')
    return events
      .filter(e => getEventDateString(e.start) === dateStr)
      .map(convertToUnifiedSchedule)
  }, [events])

  const selectedDaySchedules = selectedDate ? getSchedulesForDay(selectedDate) : []

  // Callbacks for the calendar inner component
  const handleDateClick = useCallback((date: Date) => {
    const scrollY = window.scrollY
    setSelectedDate(date)
    // Restore scroll position as fast as possible after layout
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.scrollTo(0, scrollY)
      })
    })
  }, [])

  // Navigation functions
  const goToPreviousMonth = () => setCurrentDate(subMonths(currentDate, 1))
  const goToNextMonth = () => setCurrentDate(addMonths(currentDate, 1))
  const goToToday = () => {
    setCurrentDate(new Date())
    setSelectedDate(new Date())
  }

  // Handle schedule click in detail panel
  const handleScheduleClick = async (schedule: UnifiedSchedule) => {
    // For court hearings and deadlines with case_id, navigate to case page
    if ((schedule.type === 'court_hearing' || schedule.type === 'deadline') && schedule.case_id) {
      window.location.href = `/cases/${schedule.case_id}`
      return
    }

    // For consultations, open edit modal
    if (schedule.type === 'consultation') {
      try {
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
            event_date: consultation.preferred_date || schedule.date,
            event_time: consultation.preferred_time || null,
            location: consultation.office_location || null,
            description: consultation.message || null,
            status: consultation.status,
            preferred_date: consultation.preferred_date,
            preferred_time: consultation.preferred_time
          })
          setPrefilledDate(consultation.preferred_date || schedule.date)
          setShowAddModal(true)
        }
      } catch (error) {
        console.error('Error fetching consultation:', error)
        alert('상담 정보를 불러오는데 실패했습니다.')
      }
    } else if (schedule.type === 'court_hearing' || schedule.type === 'trial') {
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
    } else if (schedule.type === 'deadline') {
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
    }
  }

  if (loading && events.length === 0) {
    return (
      <div className="w-full max-w-screen-2xl mx-auto pt-16 sm:pt-20 pb-6 sm:pb-8 px-3 sm:px-6 lg:px-8">
        <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-default)] p-6">
          <div className="flex justify-center items-center h-96">
            <div className="flex flex-col items-center gap-3">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-[var(--border-default)] border-t-[var(--sage-primary)]" />
              <p className="text-[var(--text-tertiary)] text-sm">일정을 불러오는 중...</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-screen-2xl mx-auto pt-16 sm:pt-20 pb-6 sm:pb-8 px-3 sm:px-6 lg:px-8 relative">
      {/* Top Controls - Filters and View Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        {/* Left: Filter Toggles */}
        <div className="flex items-center gap-2">
          {/* Event Type Filter */}
          <div className="flex items-center bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-lg p-0.5">
            <button
              onClick={() => { setFilterType('all'); setShowMenu(false); }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${filterType === 'all' ? 'bg-[var(--sage-primary)] text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'}`}
            >
              전체
            </button>
            <button
              onClick={() => { setFilterType('court'); setShowMenu(false); }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${filterType === 'court' ? 'bg-[var(--sage-primary)] text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'}`}
            >
              재판만
            </button>
          </div>

          {/* Lawyer Filter */}
          {tenantMembers.length > 0 && (
            <select
              value={lawyerFilter}
              onChange={(e) => { setLawyerFilter(e.target.value); setShowMenu(false); }}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--sage-primary)] text-[var(--text-secondary)]"
            >
              <option value="all">모든 변호사</option>
              {tenantMembers.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.display_name}
                </option>
              ))}
            </select>
          )}

          {/* Filter Active Indicator */}
          {(filterType !== 'all' || lawyerFilter !== 'all') && (
            <span className="flex items-center gap-1 text-[10px] text-[var(--sage-primary)] bg-[var(--sage-muted)] px-2 py-1 rounded-full">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 6.707A1 1 0 013 6V3z" clipRule="evenodd" />
              </svg>
              필터 적용
            </span>
          )}
        </div>

        {/* Right: View Toggle and List Button */}
        <div className="flex items-center gap-2">
          {/* View Mode - Desktop */}
          <div className="hidden sm:flex items-center bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('month')}
              className={`p-1.5 rounded-md transition-colors ${viewMode === 'month' ? 'bg-[var(--sage-muted)] text-[var(--sage-primary)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'}`}
              title="월간 보기"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </button>
            <button
              onClick={() => setViewMode('week')}
              className={`p-1.5 rounded-md transition-colors ${viewMode === 'week' ? 'bg-[var(--sage-muted)] text-[var(--sage-primary)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'}`}
              title="주간 보기"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-[var(--sage-muted)] text-[var(--sage-primary)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'}`}
              title="목록 보기"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
            </button>
          </div>

          {/* Mobile Menu */}
          <div className="sm:hidden relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className={`p-2 rounded-lg transition-colors border border-[var(--border-default)] bg-[var(--bg-secondary)] ${showMenu ? 'text-[var(--sage-primary)]' : 'text-[var(--text-secondary)]'}`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            {showMenu && (
              <div className="absolute right-0 top-12 bg-[var(--bg-secondary)] rounded-lg shadow-lg border border-[var(--border-default)] p-2 z-50 min-w-[160px]">
                <button
                  onClick={() => { setViewMode('month'); setShowMenu(false); }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg transition-colors ${viewMode === 'month' ? 'bg-[var(--sage-muted)] text-[var(--sage-primary)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'}`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  월간
                </button>
                <button
                  onClick={() => { setViewMode('week'); setShowMenu(false); }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg transition-colors ${viewMode === 'week' ? 'bg-[var(--sage-muted)] text-[var(--sage-primary)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'}`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  주간
                </button>
                <button
                  onClick={() => { setViewMode('list'); setShowMenu(false); }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg transition-colors ${viewMode === 'list' ? 'bg-[var(--sage-muted)] text-[var(--sage-primary)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'}`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                  </svg>
                  목록
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Legend - Improved Card Style */}
      <div className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-default)] p-3 mb-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-[#EF4444] shadow-sm" />
            <span className="text-xs font-medium text-[var(--text-secondary)]">공휴일</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-[#6DB5A4] shadow-sm" />
            <span className="text-xs font-medium text-[var(--text-secondary)]">법원기일</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-[#3B82F6] shadow-sm" />
            <span className="text-xs font-medium text-[var(--text-secondary)]">상담</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-[#F59E0B] shadow-sm" />
            <span className="text-xs font-medium text-[var(--text-secondary)]">마감일</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-[#6B7280] shadow-sm" />
            <span className="text-xs font-medium text-[var(--text-secondary)]">기타</span>
          </div>
        </div>
      </div>

      {/* Main content */}
      {loading ? (
        <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-default)] flex items-center justify-center" style={{ minHeight: '500px' }}>
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-[var(--sage-primary)] border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-[var(--text-secondary)]">일정을 불러오는 중...</span>
          </div>
        </div>
      ) : viewMode === 'list' ? (
        <div className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-default)] p-3 sm:p-4">
          <ScheduleListView
            schedules={allEvents.map(e => {
              const unified = convertToUnifiedSchedule(e)
              return {
                id: unified.id,
                event_type: e.eventType === 'COURT_HEARING' ? 'COURT_HEARING' : e.eventType === 'DEADLINE' ? 'DEADLINE' : 'CONSULTATION',
                event_type_kr: getScheduleTypeLabel(unified.type, unified.location),
                event_subtype: unified.hearing_type || null,
                title: unified.title,
                case_name: unified.case_number || '',
                event_date: unified.date,
                event_time: unified.time || null,
                event_datetime: unified.time ? `${unified.date} ${unified.time}` : unified.date,
                reference_id: unified.case_number || '',
                location: unified.location || null,
                description: unified.notes || null,
                status: unified.status || 'SCHEDULED',
                sort_priority: unified.time ? 2 : 1
              }
            })}
            onEdit={(schedule) => {
              const unifiedSchedule: UnifiedSchedule = {
                id: schedule.id,
                type: schedule.event_type === 'COURT_HEARING' ? 'court_hearing' : schedule.event_type === 'DEADLINE' ? 'deadline' : 'consultation',
                title: schedule.title,
                date: schedule.event_date,
                time: schedule.event_time || undefined,
                location: schedule.location || undefined,
                case_number: schedule.reference_id,
                notes: schedule.description || undefined,
                status: schedule.status,
                hearing_type: schedule.event_subtype || undefined,
              }
              handleScheduleClick(unifiedSchedule)
            }}
          />
        </div>
      ) : (
        <>
          {/* Schedule-X Calendar */}
          <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-default)] overflow-hidden">
            <CalendarInner
              events={events}
              onEventClick={handleEventClick}
              onEventUpdate={handleEventUpdate}
              onClickDate={handleDateClick}
            />
          </div>

          {/* Selected date detail panel - Collapsible */}
          {selectedDate && (
            <div className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-default)] mt-3 shadow-sm overflow-hidden" style={{ overflowAnchor: 'none' }}>
              {/* Header - Always visible */}
              <div
                className="flex justify-between items-center px-3 py-2.5 cursor-pointer hover:bg-[var(--bg-hover)] transition-colors"
                onClick={() => setIsDetailPanelCollapsed(!isDetailPanelCollapsed)}
              >
                <div className="flex items-center gap-2">
                  <svg
                    className={`w-4 h-4 text-[var(--text-tertiary)] transition-transform ${isDetailPanelCollapsed ? '' : 'rotate-90'}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  <div>
                    <h3 className="text-xs font-bold text-[var(--text-primary)]">
                      {format(selectedDate, 'M월 d일 (E)', { locale: ko })}
                      {selectedDaySchedules.length > 0 && (
                        <span className="ml-2 px-1.5 py-0.5 text-[10px] font-semibold bg-[var(--sage-muted)] text-[var(--sage-primary)] rounded-full">
                          {selectedDaySchedules.length}건
                        </span>
                      )}
                    </h3>
                    <p className="text-[10px] text-[var(--text-tertiary)] mt-0.5">
                      {format(selectedDate, 'yyyy년', { locale: ko })}
                      {getHolidayForDay(selectedDate) && (
                        <span className="ml-2 text-[var(--color-danger)] font-medium">{getHolidayForDay(selectedDate)}</span>
                      )}
                    </p>
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); setSelectedDate(null); }}
                  className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors"
                  aria-label="닫기"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Content - Collapsible */}
              {!isDetailPanelCollapsed && (
                <div className="px-3 pb-3 border-t border-[var(--border-subtle)]">
              {selectedDaySchedules.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center">
                    <svg className="w-7 h-7 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-[var(--text-secondary)] mb-1">일정이 없습니다</p>
                  <p className="text-xs text-[var(--text-tertiary)] mb-4">이 날짜에 새 일정을 추가해보세요</p>
                  <button
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[var(--sage-primary)] rounded-lg hover:bg-[var(--sage-primary-hover)] transition-colors shadow-sm"
                    onClick={() => {
                      if (selectedDate) {
                        setPrefilledDate(format(selectedDate, 'yyyy-MM-dd'))
                      }
                      setEditingSchedule(null)
                      setShowAddModal(true)
                    }}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    일정 추가하기
                  </button>
                </div>
              ) : (
                <div className="space-y-1">
                  {selectedDaySchedules.map((schedule) => {
                    const isPostponed = schedule.type === 'court_hearing' && isPostponedHearing(schedule.scourt_result_raw)
                    const typeLabel = schedule.type === 'court_hearing' && schedule.scourt_type_raw
                      ? removeVideoDeviceText(schedule.scourt_type_raw)
                      : getScheduleTypeLabel(schedule.type, schedule.location)
                    const videoBadge = getVideoBadgeInfo(schedule.scourt_type_raw, schedule.video_participant_side, schedule.our_client_side)

                    return (
                      <div
                        key={schedule.id}
                        className={`px-2 py-1.5 rounded-md border-l-4 ${getScheduleTypeColor(schedule.type, schedule.hearing_type, schedule.event_subtype, schedule.scourt_result_raw)} hover:bg-[var(--bg-hover)] transition-all cursor-pointer ${isPostponed ? 'opacity-60' : ''}`}
                        onClick={() => handleScheduleClick(schedule)}
                      >
                        <div className="flex items-center gap-1.5 text-[11px]">
                          {/* Type badge */}
                          <span className={`px-1 py-0.5 rounded text-[9px] font-semibold flex-shrink-0 ${
                            isPostponed ? 'bg-gray-200 text-gray-500' : 'bg-white/90 shadow-sm'
                          }`}>
                            {isPostponed ? '연기' : typeLabel}
                          </span>
                          {/* Video badge */}
                          {videoBadge && !isPostponed && (
                            <span className={`px-1 py-0.5 rounded text-[9px] font-bold flex-shrink-0 ${videoBadge.color}`}>
                              {videoBadge.label}
                            </span>
                          )}
                          {/* Time */}
                          {schedule.time && (
                            <span className="font-semibold text-[var(--text-primary)] flex-shrink-0">
                              {schedule.time.slice(0, 5)}
                            </span>
                          )}
                          {/* Location */}
                          {schedule.location && (
                            <span className="text-[var(--text-secondary)] flex-shrink-0">
                              {shortenCourtLocation(schedule.location)}
                            </span>
                          )}
                          {/* Title (client name) */}
                          <span className={`truncate ${isPostponed ? 'text-[var(--text-muted)] line-through' : 'text-[var(--text-primary)]'}`}>
                            {schedule.title}
                          </span>
                          {/* Days until for deadlines */}
                          {schedule.type === 'deadline' && schedule.daysUntil !== undefined && (
                            <span className={`px-1 py-0.5 rounded text-[9px] font-bold flex-shrink-0 ${
                              schedule.daysUntil <= 1 ? 'bg-red-100 text-red-600' :
                              schedule.daysUntil <= 3 ? 'bg-orange-100 text-orange-600' :
                              'bg-yellow-100 text-yellow-600'
                            }`}>
                              {formatDaysUntil(schedule.daysUntil)}
                            </span>
                          )}
                          {/* Result */}
                          {schedule.type === 'court_hearing' && schedule.scourt_result_raw && (
                            <span className="text-[var(--sage-primary)] flex-shrink-0 font-medium">
                              → {schedule.scourt_result_raw}
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Add schedule button - only show when there are schedules */}
              {selectedDaySchedules.length > 0 && (
              <div className="mt-3 pt-3 border-t border-[var(--border-subtle)]">
                <button
                  className="w-full px-3 py-2 text-xs font-medium text-[var(--sage-primary)] bg-[var(--sage-muted)] rounded-lg hover:bg-[var(--sage-primary)] hover:text-white transition-all flex items-center justify-center gap-1.5"
                  onClick={() => {
                    if (selectedDate) {
                      setPrefilledDate(format(selectedDate, 'yyyy-MM-dd'))
                    }
                    setEditingSchedule(null)
                    setShowAddModal(true)
                  }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  일정 추가
                </button>
              </div>
              )}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Floating Add Button */}
      <button
        onClick={() => {
          if (selectedDate) {
            setPrefilledDate(format(selectedDate, 'yyyy-MM-dd'))
          } else {
            setPrefilledDate(format(new Date(), 'yyyy-MM-dd'))
          }
          setEditingSchedule(null)
          setShowAddModal(true)
        }}
        className="fixed bottom-6 right-6 w-14 h-14 bg-[var(--sage-primary)] text-white rounded-full shadow-lg hover:bg-[var(--sage-primary-hover)] hover:shadow-xl hover:scale-105 transition-all z-40 flex items-center justify-center group"
        title="새 일정 추가"
      >
        <svg className="w-6 h-6 group-hover:rotate-90 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </button>

      {/* Schedule modal */}
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
