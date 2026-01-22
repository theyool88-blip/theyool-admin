'use client'

// Temporal API polyfill for Schedule-X (MUST be imported before Schedule-X)
import { Temporal } from '@js-temporal/polyfill'
if (typeof (globalThis as Record<string, unknown>).Temporal === 'undefined') {
  (globalThis as Record<string, unknown>).Temporal = Temporal
}

import { useEffect, useState, useCallback, useMemo, useRef, createContext, useContext } from 'react'
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addMonths, subMonths } from 'date-fns'
import { ko } from 'date-fns/locale'
import { formatDaysUntil } from '@/types/court-hearing'
import { useTheme } from '@/hooks/useTheme'
import { useHolidays } from '@/hooks/useHolidays'

// Schedule-X imports
import { ScheduleXCalendar, useNextCalendarApp } from '@schedule-x/react'
import { viewWeek, viewMonthGrid, viewDay } from '@schedule-x/calendar'
import { createDragAndDropPlugin } from '@schedule-x/drag-and-drop'
import { createResizePlugin } from '@schedule-x/resize'
import { createCurrentTimePlugin } from '@schedule-x/current-time'
import { createCalendarControlsPlugin } from '@schedule-x/calendar-controls'
import '@schedule-x/theme-default/dist/index.css'

// Custom components
import ScheduleXEventCard, { ScheduleXEventChip } from './calendar/ScheduleXEventCard'
import ScheduleListView from './ScheduleListView'
import UnifiedScheduleModal, { type EditScheduleData } from './UnifiedScheduleModal'

// Types
import type {
  Profile,
  TenantMember,
  Holiday,
  ApiEvent,
  ScheduleXEvent,
  UnifiedSchedule,
  ViewMode
} from './calendar/types'
import { EVENT_TYPE_CALENDAR_MAP } from './calendar/types'

// Type for calendar controls plugin
type CalendarControls = ReturnType<typeof createCalendarControlsPlugin>

// ========================================
// Context for Calendar Data (Holiday Map + Current Displayed Month)
// ========================================
interface CalendarContextData {
  holidayMap: Map<string, Holiday>
  displayedMonth: { year: number; month: number }  // 현재 표시 중인 달
}

const CalendarContext = createContext<CalendarContextData>({
  holidayMap: new Map(),
  displayedMonth: { year: new Date().getFullYear(), month: new Date().getMonth() + 1 }
})

// Legacy context for backward compatibility
const HolidayContext = createContext<Map<string, Holiday>>(new Map())

// ========================================
// Custom Date Components
// ========================================

// MonthGridDateComponent - Schedule-X 기본 스타일 + 공휴일/주말 색상 + 이번달 외 날짜 연한색
function MonthGridDateComponent({ date, jsDate }: { date: unknown; jsDate: Date }) {
  const { holidayMap, displayedMonth } = useContext(CalendarContext)

  // Validate jsDate
  if (!jsDate || !(jsDate instanceof Date) || isNaN(jsDate.getTime())) {
    const dayNum = typeof date === 'number' ? date : 1
    return <span className="sx__month-grid-day__day-number">{dayNum}</span>
  }

  const year = jsDate.getFullYear()
  const month = jsDate.getMonth() + 1
  const dayNum = jsDate.getDate()
  const dayOfWeek = jsDate.getDay()

  const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`

  // 현재 표시 중인 달과 비교하여 이번달 외 날짜인지 확인
  const isOutsideMonth = year !== displayedMonth.year || month !== displayedMonth.month

  const now = new Date()
  const isToday =
    year === now.getFullYear() &&
    month === now.getMonth() + 1 &&
    dayNum === now.getDate()

  const isSunday = dayOfWeek === 0
  const isSaturday = dayOfWeek === 6
  const holiday = holidayMap.get(dateStr)

  // Schedule-X 기본 클래스 사용 + 오늘 표시
  const baseClass = 'sx__month-grid-day__day-number'
  const todayClass = isToday ? ' sx__month-grid-day__day-number--is-today' : ''

  // 색상 스타일 - 이번달 외 날짜는 연한색, 그 외는 기존 색상
  const getColorStyle = (): React.CSSProperties | undefined => {
    if (isToday) return undefined // 오늘은 흰색 텍스트 (CSS에서 처리)

    // 이번달이 아닌 날짜는 연한색으로 표시
    if (isOutsideMonth) {
      return { color: 'var(--text-muted)', opacity: 0.5 }
    }

    if (holiday || isSunday) return { color: '#B45454' }  // 공휴일/일요일: 부드러운 빨강
    if (isSaturday) return { color: '#64748B' }  // 토요일: 슬레이트 그레이
    return { color: 'var(--text-primary)' }  // 평일: 기본 텍스트 색상
  }

  return (
    <>
      <span className={baseClass + todayClass} style={getColorStyle()}>
        {dayNum}
      </span>
      {/* 이번달 외 날짜는 공휴일 이름 숨김 */}
      {holiday && !isOutsideMonth && (
        <span style={{ fontSize: '10px', color: '#B45454', marginLeft: '4px' }}>
          {holiday.holiday_name}
        </span>
      )}
    </>
  )
}

// MonthGridDayNameComponent - Schedule-X 기본 스타일 + 주말 색상
function MonthGridDayNameComponent({ day }: { day: number }) {
  const dayNames = ['일', '월', '화', '수', '목', '금', '토']
  const isSunday = day === 0
  const isSaturday = day === 6

  // 색상 스타일 - 모든 요일에 적용 (홈페이지 스타일에 맞춘 부드러운 색상)
  const getColorStyle = (): React.CSSProperties => {
    if (isSunday) return { color: '#B45454' }  // 일요일: 부드러운 빨강
    if (isSaturday) return { color: '#64748B' }  // 토요일: 슬레이트 그레이
    return { color: 'var(--text-tertiary)' }  // 평일: 회색
  }

  return (
    <span className="sx__week-grid__day-name" style={getColorStyle()}>
      {dayNames[day]}
    </span>
  )
}

// WeekGridDateComponent - Week view header with holidays
function WeekGridDateComponent({ date }: { date: unknown }) {
  const { holidayMap } = useContext(CalendarContext)

  // Parse date from various formats
  let jsDate: Date | null = null
  let dateStr = ''

  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(date)) {
    dateStr = date.split('T')[0]
    jsDate = new Date(dateStr + 'T00:00:00')
  } else if (date && typeof date === 'object') {
    // Try Temporal object or object with year/month/day
    try {
      const str = String(date)
      const match = str.match(/^(\d{4}-\d{2}-\d{2})/)
      if (match) {
        dateStr = match[1]
        jsDate = new Date(dateStr + 'T00:00:00')
      }
    } catch {
      // Fallback
    }
  }

  if (!jsDate || isNaN(jsDate.getTime())) {
    return <span className="text-sm">-</span>
  }

  const dayNum = jsDate.getDate()
  const dayOfWeek = jsDate.getDay()
  const dayNames = ['일', '월', '화', '수', '목', '금', '토']

  const holiday = holidayMap.get(dateStr)
  const isSunday = dayOfWeek === 0
  const isSaturday = dayOfWeek === 6

  // 홈페이지 스타일에 맞춘 색상
  const getTextColor = () => {
    if (holiday || isSunday) return '#B45454'  // 부드러운 빨강
    if (isSaturday) return '#64748B'  // 슬레이트 그레이
    return 'var(--text-primary)'
  }

  return (
    <div className="flex flex-col items-center py-2" style={{ color: getTextColor() }}>
      <span className="text-xs">{dayNames[dayOfWeek]}</span>
      <span className="text-lg font-semibold">{dayNum}</span>
      {holiday && (
        <span className="text-[9px] truncate max-w-[50px] font-medium">
          {holiday.holiday_name}
        </span>
      )}
    </div>
  )
}

// WeekGridHourComponent - 정각만 표시, 30분은 그리드만
function WeekGridHourComponent({ hour }: { hour: string | number }) {
  // hour가 "09:30" 같은 형태일 때 30분인지 체크
  const hourStr = String(hour)
  const isHalfHour = hourStr.includes(':30')

  // 30분일 경우 라벨 없이 빈 공간만 표시
  if (isHalfHour) {
    return <span className="text-xs">&nbsp;</span>
  }

  const hourNum = typeof hour === 'number'
    ? hour
    : typeof hour === 'string' && hour.includes(':')
      ? parseInt(hour.split(':')[0])
      : parseInt(String(hour))

  const isLunchTime = hourNum === 12
  const isAfterHours = hourNum < 9 || hourNum >= 18

  // 정각만 시간 표시 (09, 10, 11...)
  const displayHour = String(hourNum).padStart(2, '0')

  return (
    <span className={`text-xs ${
      isLunchTime ? 'text-orange-500 font-medium' :
      isAfterHours ? 'text-[var(--text-muted)] opacity-50' :
      'text-[var(--text-secondary)]'
    }`}>
      {displayHour}
    </span>
  )
}

// ========================================
// Helper Functions
// ========================================

// Extract date string from event (supports both string and Temporal)
function getEventDateString(eventStart: string | Temporal.PlainDate | Temporal.ZonedDateTime): string {
  if (typeof eventStart === 'string') {
    return eventStart.split(' ')[0]
  }
  const str = eventStart.toString()
  return str.split('T')[0]
}

// Extract time string from event
function getEventTimeString(eventStart: string | Temporal.PlainDate | Temporal.ZonedDateTime): string | undefined {
  if (typeof eventStart === 'string') {
    const parts = eventStart.split(' ')
    return parts[1] || undefined
  }
  if ('hour' in eventStart) {
    const zdt = eventStart as Temporal.ZonedDateTime
    return `${String(zdt.hour).padStart(2, '0')}:${String(zdt.minute).padStart(2, '0')}`
  }
  return undefined
}

// Convert string date/time to Temporal object
function toTemporalDate(dateStr: string): Temporal.PlainDate | Temporal.ZonedDateTime {
  if (typeof dateStr !== 'string') return dateStr

  const hasTime = dateStr.includes(' ') || (dateStr.includes('T') && dateStr.length > 10)

  if (hasTime) {
    const normalized = dateStr.replace(' ', 'T')
    const [datePart, timePart] = normalized.split('T')
    const [year, month, day] = datePart.split('-').map(Number)
    const [hours, minutes] = (timePart || '00:00').split(':').map(Number)

    return Temporal.ZonedDateTime.from({
      year,
      month,
      day,
      hour: hours || 0,
      minute: minutes || 0,
      second: 0,
      timeZone: 'UTC',  // Use UTC to prevent double timezone conversion
    })
  }

  return Temporal.PlainDate.from(dateStr)
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
    // 기본 이벤트 길이: 30분
    const totalMinutes = minutes + 30
    const endHours = Math.min(hours + Math.floor(totalMinutes / 60), 23)
    const endMinutes = totalMinutes % 60
    end = `${event.event_date} ${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`
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

// ========================================
// Display Helper Functions
// ========================================

const isPostponedHearing = (result?: string): boolean => {
  if (!result) return false
  const keywords = ['기일변경', '연기', '취하', '취소', '변경지정']
  return keywords.some(kw => result.includes(kw))
}

const removeVideoDeviceText = (text: string) => {
  return text.replace(/\s*\[(일방|쌍방)\s*화상장치\]\s*/g, '').trim()
}

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

// ========================================
// Calendar Inner Component
// ========================================

interface CalendarInnerProps {
  events: ScheduleXEvent[]
  holidayMap: Map<string, Holiday>
  isDark: boolean
  viewMode: ViewMode
  selectedDate: Date  // The date to display (controls which month is shown)
  onEventClick: (event: ScheduleXEvent) => void
  onEventUpdate: (event: ScheduleXEvent) => void
  onClickDate: (date: Date) => void
  onCalendarControlsReady: (controls: CalendarControls) => void
}

function CalendarInner({
  events,
  holidayMap,
  isDark,
  viewMode,
  selectedDate,
  onEventClick,
  onEventUpdate,
  onClickDate,
  onCalendarControlsReady,
}: CalendarInnerProps) {
  const isInitialMount = useRef(true)
  const controlsReadyRef = useRef(false)

  // Create plugins (memoized)
  const calendarControls = useMemo(() => createCalendarControlsPlugin(), [])
  const dragAndDropPlugin = useMemo(() => createDragAndDropPlugin(15), [])
  const resizePlugin = useMemo(() => createResizePlugin(15), [])
  const currentTimePlugin = useMemo(() => createCurrentTimePlugin(), [])

  // Determine which plugins to use based on view mode
  const plugins = useMemo(() => {
    const basePlugins = [calendarControls, dragAndDropPlugin, resizePlugin]
    // Only include currentTimePlugin for week/day views
    if (viewMode === 'week' || viewMode === 'day') {
      return [...basePlugins, currentTimePlugin]
    }
    return basePlugins
  }, [calendarControls, dragAndDropPlugin, resizePlugin, currentTimePlugin, viewMode])

  // Convert events to Temporal format
  const temporalEvents = useMemo(() => {
    return events.map(event => ({
      ...event,
      start: typeof event.start === 'string' ? toTemporalDate(event.start) : event.start,
      end: typeof event.end === 'string' ? toTemporalDate(event.end) : event.end,
    }))
  }, [events])

  // Convert selectedDate to Temporal.PlainDate for Schedule-X (v3+ requires Temporal object)
  const selectedDateTemporal = Temporal.PlainDate.from(format(selectedDate, 'yyyy-MM-dd'))

  // Create calendar app
  const calendar = useNextCalendarApp({
    locale: 'ko-KR',
    isDark,
    timezone: 'Asia/Seoul',
    selectedDate: selectedDateTemporal,  // This controls which month is displayed
    defaultView: viewMonthGrid.name,
    views: [viewDay, viewWeek, viewMonthGrid],
    events: temporalEvents,
    // 주간/일간 뷰 시간 범위: 08:00 ~ 20:00
    dayBoundaries: {
      start: '08:00',
      end: '20:00',
    },
    calendars: {
      court_hearing: {
        colorName: 'court_hearing',
        lightColors: { main: '#6DB5A4', container: 'rgba(109, 181, 164, 0.15)', onContainer: '#6DB5A4' },
        darkColors: { main: '#6DB5A4', container: 'rgba(109, 181, 164, 0.2)', onContainer: '#8CCABE' },
      },
      consultation: {
        colorName: 'consultation',
        lightColors: { main: '#3B82F6', container: 'rgba(59, 130, 246, 0.15)', onContainer: '#3B82F6' },
        darkColors: { main: '#3B82F6', container: 'rgba(59, 130, 246, 0.2)', onContainer: '#60A5FA' },
      },
      deadline: {
        colorName: 'deadline',
        lightColors: { main: '#F59E0B', container: 'rgba(245, 158, 11, 0.15)', onContainer: '#F59E0B' },
        darkColors: { main: '#F59E0B', container: 'rgba(245, 158, 11, 0.2)', onContainer: '#FBBF24' },
      },
      meeting: {
        colorName: 'meeting',
        lightColors: { main: '#6B7280', container: 'rgba(107, 114, 128, 0.1)', onContainer: '#6B7280' },
        darkColors: { main: '#9CA3AF', container: 'rgba(156, 163, 175, 0.15)', onContainer: '#9CA3AF' },
      },
    },
    // 주간/일간 뷰 설정: 30분 단위 그리드
    weekOptions: { gridHeight: 800, nDays: 7, eventWidth: 95, gridStep: 30 },
    monthGridOptions: { nEventsPerDay: 7 },
    callbacks: {
      onEventClick: (event) => onEventClick(event as unknown as ScheduleXEvent),
      onEventUpdate: (event) => onEventUpdate(event as unknown as ScheduleXEvent),
      onClickDate: (date) => {
        const dateStr = typeof date === 'string' ? date : String(date)
        const clickedDate = new Date(dateStr)
        onClickDate(clickedDate)
      },
    },
  }, plugins)

  // Update events dynamically
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }
    if (calendar) {
      calendar.events.set(temporalEvents)
    }
  }, [temporalEvents, calendar])

  // Pass calendar controls to parent
  useEffect(() => {
    if (calendar && !controlsReadyRef.current) {
      controlsReadyRef.current = true
      onCalendarControlsReady(calendarControls)
    }
  }, [calendar, calendarControls, onCalendarControlsReady])

  // 현재 표시 중인 달 정보 (selectedDate에서 추출)
  const calendarContextValue = useMemo<CalendarContextData>(() => ({
    holidayMap,
    displayedMonth: {
      year: selectedDate.getFullYear(),
      month: selectedDate.getMonth() + 1,  // JavaScript month is 0-indexed
    },
  }), [holidayMap, selectedDate])

  return (
    <CalendarContext.Provider value={calendarContextValue}>
      <ScheduleXCalendar
        calendarApp={calendar}
        customComponents={{
          timeGridEvent: ScheduleXEventCard,
          dateGridEvent: ScheduleXEventCard,
          monthGridEvent: ScheduleXEventChip,
          monthGridDate: MonthGridDateComponent,
          monthGridDayName: MonthGridDayNameComponent,
          weekGridDate: WeekGridDateComponent,
          weekGridHour: WeekGridHourComponent,
        }}
      />
    </CalendarContext.Provider>
  )
}

// ========================================
// Main Component
// ========================================

interface ScheduleXCalendarProps {
  profile: Profile
}

export default function ScheduleXCalendarComponent({ profile: _profile }: ScheduleXCalendarProps) {
  const { resolvedTheme } = useTheme()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [allEvents, setAllEvents] = useState<ScheduleXEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [tenantMembers, setTenantMembers] = useState<TenantMember[]>([])

  // Calendar controls
  const [calendarControls, setCalendarControls] = useState<CalendarControls | null>(null)

  // View and filter state
  const [viewMode, setViewMode] = useState<ViewMode>('month')
  const [filterType, setFilterType] = useState<'all' | 'court'>('all')
  const [selectedLawyers, setSelectedLawyers] = useState<string[]>([])
  const [showLawyerPopover, setShowLawyerPopover] = useState(false)
  const [showMonthPicker, setShowMonthPicker] = useState(false)
  const [pickerYear, setPickerYear] = useState(new Date().getFullYear())

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

  // Years to fetch holidays for (automatically cached by useHolidays)
  const holidayYears = useMemo(() => {
    const years = new Set<number>()
    years.add(calendarStart.getFullYear())
    years.add(calendarEnd.getFullYear())
    return Array.from(years)
  }, [calendarStart, calendarEnd])

  // Use cached holidays hook (global cache, no redundant fetches)
  const { holidays } = useHolidays(holidayYears)

  // Holiday Map for fast O(1) lookup
  const holidayMap = useMemo(() => {
    const map = new Map<string, Holiday>()
    holidays.forEach(h => map.set(h.holiday_date, h))
    return map
  }, [holidays])

  // Fetch tenant members
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

  // Stable date range key for fetch dependency
  const dateRangeKey = useMemo(() => {
    return `${format(monthStart, 'yyyy-MM-dd')}_${format(monthEnd, 'yyyy-MM-dd')}`
  }, [monthStart, monthEnd])

  // Fetch schedules (holidays are now handled by useHolidays hook separately)
  const fetchSchedules = useCallback(async () => {
    try {
      setLoading(true)
      const [startDate, endDate] = dateRangeKey.split('_')

      const response = await fetch(`/api/admin/calendar?start_date=${startDate}&end_date=${endDate}`)
      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch schedules')
      }

      const scheduleXEvents = (result.data || []).map(convertToScheduleXEvent)

      // Sort deadlines to top
      const sortedEvents = [...scheduleXEvents].sort((a, b) => {
        const aDate = typeof a.start === 'string' ? a.start.split(' ')[0] : String(a.start).split('T')[0]
        const bDate = typeof b.start === 'string' ? b.start.split(' ')[0] : String(b.start).split('T')[0]
        if (aDate === bDate) {
          if (a.eventType === 'DEADLINE' && b.eventType !== 'DEADLINE') return -1
          if (a.eventType !== 'DEADLINE' && b.eventType === 'DEADLINE') return 1
        }
        return 0
      })

      setAllEvents(sortedEvents)
    } catch (error) {
      console.error('Failed to load schedules:', error)
    } finally {
      setLoading(false)
    }
  }, [dateRangeKey]) // Only depend on stable dateRangeKey string

  useEffect(() => {
    fetchSchedules()
  }, [fetchSchedules])

  useEffect(() => {
    fetchTenantMembers()
  }, [fetchTenantMembers])

  // Toggle lawyer selection
  const toggleLawyer = useCallback((id: string) => {
    setSelectedLawyers(prev =>
      prev.includes(id) ? prev.filter(l => l !== id) : [...prev, id]
    )
  }, [])

  // Filtered events
  const events = useMemo(() => {
    let filtered = allEvents

    if (filterType === 'court') {
      filtered = filtered.filter(e => e.eventType !== 'CONSULTATION')
    }

    if (selectedLawyers.length > 0) {
      filtered = filtered.filter(e => e.attendingLawyerId && selectedLawyers.includes(e.attendingLawyerId))
    }

    return filtered
  }, [allEvents, filterType, selectedLawyers])

  // Handle event update (drag and drop / resize)
  const handleEventUpdate = useCallback(async (updatedEvent: ScheduleXEvent) => {
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
    const eventDate = new Date(getEventDateString(event.start))
    setSelectedDate(eventDate)
  }, [])

  // Get holiday for a day
  const getHolidayForDay = (day: Date): string | null => {
    const dateStr = format(day, 'yyyy-MM-dd')
    return holidayMap.get(dateStr)?.holiday_name || null
  }

  // Get schedules for a specific day
  const getSchedulesForDay = useCallback((day: Date): UnifiedSchedule[] => {
    const dateStr = format(day, 'yyyy-MM-dd')
    return events
      .filter(e => getEventDateString(e.start) === dateStr)
      .map(convertToUnifiedSchedule)
  }, [events])

  const selectedDaySchedules = selectedDate ? getSchedulesForDay(selectedDate) : []

  // Handle date click
  const handleDateClick = useCallback((date: Date) => {
    const scrollY = window.scrollY
    setSelectedDate(date)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.scrollTo(0, scrollY)
      })
    })
  }, [])

  // Navigation functions
  const goToPreviousMonth = useCallback(() => {
    const newDate = subMonths(currentDate, 1)
    setCurrentDate(newDate)
    if (calendarControls) {
      const temporalDate = Temporal.PlainDate.from(format(newDate, 'yyyy-MM-dd'))
      calendarControls.setDate(temporalDate)
    }
  }, [currentDate, calendarControls])

  const goToNextMonth = useCallback(() => {
    const newDate = addMonths(currentDate, 1)
    setCurrentDate(newDate)
    if (calendarControls) {
      const temporalDate = Temporal.PlainDate.from(format(newDate, 'yyyy-MM-dd'))
      calendarControls.setDate(temporalDate)
    }
  }, [currentDate, calendarControls])

  const goToToday = useCallback(() => {
    const today = new Date()
    setCurrentDate(today)
    setSelectedDate(today)
    if (calendarControls) {
      const temporalDate = Temporal.PlainDate.from(format(today, 'yyyy-MM-dd'))
      calendarControls.setDate(temporalDate)
    }
  }, [calendarControls])

  // View switching
  const handleViewChange = useCallback((newView: 'month' | 'week' | 'day') => {
    setViewMode(newView)
    if (calendarControls) {
      const viewName = newView === 'day' ? viewDay.name : newView === 'week' ? viewWeek.name : viewMonthGrid.name
      calendarControls.setView(viewName)
    }
  }, [calendarControls])

  // Month picker handlers
  const openMonthPicker = useCallback(() => {
    setPickerYear(currentDate.getFullYear())
    setShowMonthPicker(true)
  }, [currentDate])

  const handleMonthSelect = useCallback((month: number) => {
    const newDate = new Date(pickerYear, month, 1)
    setCurrentDate(newDate)
    setShowMonthPicker(false)
    if (calendarControls) {
      const temporalDate = Temporal.PlainDate.from(format(newDate, 'yyyy-MM-dd'))
      calendarControls.setDate(temporalDate)
    }
  }, [pickerYear, calendarControls])

  // Handle schedule click in detail panel
  const handleScheduleClick = async (schedule: UnifiedSchedule) => {
    if ((schedule.type === 'court_hearing' || schedule.type === 'deadline') && schedule.case_id) {
      window.location.href = `/cases/${schedule.case_id}`
      return
    }

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

  // Loading state
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
      {/* Top Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        {/* Left: Filter Controls */}
        <div className="flex items-center gap-2">
          {/* Event Type Filter Toggle */}
          <div className="flex items-center bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-lg p-0.5">
            <button
              onClick={() => { setFilterType('all'); if (viewMode === 'list') setViewMode('month'); }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${filterType === 'all' && viewMode !== 'list' ? 'bg-[var(--sage-primary)] text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'}`}
            >
              전체
            </button>
            <button
              onClick={() => { setFilterType('court'); if (viewMode === 'list') setViewMode('month'); }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${filterType === 'court' && viewMode !== 'list' ? 'bg-[var(--sage-primary)] text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'}`}
            >
              재판만
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${viewMode === 'list' ? 'bg-[var(--sage-primary)] text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'}`}
            >
              목록
            </button>
          </div>

          {/* Lawyer Filter */}
          {tenantMembers.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setShowLawyerPopover(!showLawyerPopover)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                  selectedLawyers.length > 0
                    ? 'border-[var(--sage-primary)] bg-[var(--sage-muted)] text-[var(--sage-primary)]'
                    : 'border-[var(--border-default)] bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
                }`}
              >
                <span>변호사</span>
                {selectedLawyers.length > 0 && (
                  <span className="px-1.5 py-0.5 text-[10px] font-bold bg-[var(--sage-primary)] text-white rounded-full">
                    {selectedLawyers.length}
                  </span>
                )}
                <svg className={`w-3.5 h-3.5 transition-transform ${showLawyerPopover ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showLawyerPopover && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowLawyerPopover(false)} />
                  <div className="absolute left-0 top-full mt-1 bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-lg shadow-lg p-2 z-50 min-w-[180px]">
                    {selectedLawyers.length > 0 && (
                      <button
                        onClick={() => setSelectedLawyers([])}
                        className="w-full text-left px-2 py-1.5 text-[11px] text-[var(--text-tertiary)] hover:text-[var(--color-danger)] hover:bg-[var(--bg-hover)] rounded transition-colors mb-1"
                      >
                        선택 해제
                      </button>
                    )}
                    {tenantMembers.map(member => (
                      <label
                        key={member.id}
                        className="flex items-center gap-2 px-2 py-1.5 hover:bg-[var(--bg-hover)] rounded cursor-pointer transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={selectedLawyers.includes(member.id)}
                          onChange={() => toggleLawyer(member.id)}
                          className="w-4 h-4 rounded border-[var(--border-default)] text-[var(--sage-primary)] focus:ring-[var(--sage-primary)] focus:ring-offset-0"
                        />
                        <span className="text-xs text-[var(--text-primary)]">{member.display_name}</span>
                      </label>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Filter Active Indicator */}
          {(filterType !== 'all' || selectedLawyers.length > 0) && (
            <span className="hidden sm:flex items-center gap-1 text-[10px] text-[var(--sage-primary)] bg-[var(--sage-muted)] px-2 py-1 rounded-full">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 6.707A1 1 0 013 6V3z" clipRule="evenodd" />
              </svg>
              필터
            </span>
          )}
        </div>

        {/* Right: Today Button + Date Navigation + View Toggle */}
        <div className="flex items-center gap-2">
          {/* Today Button */}
          <button
            onClick={goToToday}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-colors"
          >
            오늘
          </button>

          {/* Date Navigation */}
          <div className="flex items-center gap-1 relative">
            <button
              onClick={goToPreviousMonth}
              className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              aria-label="이전 달"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <button
              onClick={openMonthPicker}
              className="px-2 py-1 text-sm font-semibold text-[var(--text-primary)] min-w-[80px] text-center rounded-lg hover:bg-[var(--bg-hover)] transition-colors"
            >
              {format(currentDate, 'yyyy. M.', { locale: ko })}
            </button>

            {/* Month Picker Popup */}
            {showMonthPicker && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowMonthPicker(false)} />
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-xl shadow-lg p-3 z-50 min-w-[240px]">
                  {/* Year Navigation */}
                  <div className="flex items-center justify-between mb-3">
                    <button
                      onClick={() => setPickerYear(y => y - 1)}
                      className="p-1 rounded hover:bg-[var(--bg-hover)] text-[var(--text-secondary)]"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <span className="text-sm font-semibold text-[var(--text-primary)]">{pickerYear}년</span>
                    <button
                      onClick={() => setPickerYear(y => y + 1)}
                      className="p-1 rounded hover:bg-[var(--bg-hover)] text-[var(--text-secondary)]"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                  {/* Month Grid */}
                  <div className="grid grid-cols-4 gap-1">
                    {[...Array(12)].map((_, i) => {
                      const isCurrentMonth = pickerYear === currentDate.getFullYear() && i === currentDate.getMonth()
                      const isToday = pickerYear === new Date().getFullYear() && i === new Date().getMonth()
                      return (
                        <button
                          key={i}
                          onClick={() => handleMonthSelect(i)}
                          className={`py-2 px-1 text-xs font-medium rounded-lg transition-colors ${
                            isCurrentMonth
                              ? 'bg-[var(--sage-primary)] text-white'
                              : isToday
                                ? 'bg-[var(--sage-muted)] text-[var(--sage-primary)] font-bold'
                                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
                          }`}
                        >
                          {i + 1}월
                        </button>
                      )
                    })}
                  </div>
                  {/* Quick Actions */}
                  <div className="mt-3 pt-2 border-t border-[var(--border-subtle)] flex justify-center">
                    <button
                      onClick={() => {
                        const today = new Date()
                        setPickerYear(today.getFullYear())
                        handleMonthSelect(today.getMonth())
                      }}
                      className="text-xs text-[var(--sage-primary)] hover:underline"
                    >
                      오늘로 이동
                    </button>
                  </div>
                </div>
              </>
            )}

            <button
              onClick={goToNextMonth}
              className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              aria-label="다음 달"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* View Mode Toggle - Desktop */}
          <div className="hidden sm:flex items-center bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-lg p-0.5">
            <button
              onClick={() => handleViewChange('month')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                viewMode === 'month'
                  ? 'bg-[var(--sage-primary)] text-white'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
              }`}
            >
              월
            </button>
            <button
              onClick={() => handleViewChange('week')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                viewMode === 'week'
                  ? 'bg-[var(--sage-primary)] text-white'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
              }`}
            >
              주
            </button>
            <button
              onClick={() => handleViewChange('day')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                viewMode === 'day'
                  ? 'bg-[var(--sage-primary)] text-white'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
              }`}
            >
              일
            </button>
          </div>

          {/* View Mode Toggle - Mobile */}
          <div className="sm:hidden flex items-center bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-lg p-0.5">
            <button
              onClick={() => handleViewChange('month')}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
                viewMode === 'month'
                  ? 'bg-[var(--sage-primary)] text-white'
                  : 'text-[var(--text-secondary)]'
              }`}
            >
              월
            </button>
            <button
              onClick={() => handleViewChange('week')}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
                viewMode === 'week'
                  ? 'bg-[var(--sage-primary)] text-white'
                  : 'text-[var(--text-secondary)]'
              }`}
            >
              주
            </button>
            <button
              onClick={() => handleViewChange('day')}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
                viewMode === 'day'
                  ? 'bg-[var(--sage-primary)] text-white'
                  : 'text-[var(--text-secondary)]'
              }`}
            >
              일
            </button>
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
              key={`${currentDate.getFullYear()}-${currentDate.getMonth()}`}
              events={events}
              holidayMap={holidayMap}
              isDark={resolvedTheme === 'dark'}
              viewMode={viewMode}
              selectedDate={currentDate}
              onEventClick={handleEventClick}
              onEventUpdate={handleEventUpdate}
              onClickDate={handleDateClick}
              onCalendarControlsReady={setCalendarControls}
            />
          </div>

          {/* Selected date detail panel */}
          {selectedDate && (
            <div className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-default)] mt-3 shadow-sm overflow-hidden" style={{ overflowAnchor: 'none' }}>
              {/* Header */}
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

              {/* Content */}
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
                              <span className={`px-1 py-0.5 rounded text-[9px] font-semibold flex-shrink-0 ${
                                isPostponed ? 'bg-gray-200 text-gray-500' : 'bg-white/90 shadow-sm'
                              }`}>
                                {isPostponed ? '연기' : typeLabel}
                              </span>
                              {videoBadge && !isPostponed && (
                                <span className={`px-1 py-0.5 rounded text-[9px] font-bold flex-shrink-0 ${videoBadge.color}`}>
                                  {videoBadge.label}
                                </span>
                              )}
                              {schedule.time && (
                                <span className="font-semibold text-[var(--text-primary)] flex-shrink-0">
                                  {schedule.time.slice(0, 5)}
                                </span>
                              )}
                              {schedule.location && (
                                <span className="text-[var(--text-secondary)] flex-shrink-0">
                                  {shortenCourtLocation(schedule.location)}
                                </span>
                              )}
                              <span className={`truncate ${isPostponed ? 'text-[var(--text-muted)] line-through' : 'text-[var(--text-primary)]'}`}>
                                {schedule.title}
                              </span>
                              {schedule.type === 'deadline' && schedule.daysUntil !== undefined && (
                                <span className={`px-1 py-0.5 rounded text-[9px] font-bold flex-shrink-0 ${
                                  schedule.daysUntil <= 1 ? 'bg-red-100 text-red-600' :
                                  schedule.daysUntil <= 3 ? 'bg-orange-100 text-orange-600' :
                                  'bg-yellow-100 text-yellow-600'
                                }`}>
                                  {formatDaysUntil(schedule.daysUntil)}
                                </span>
                              )}
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
