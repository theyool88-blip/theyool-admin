'use client'

import { useState, useCallback, useMemo, startTransition, useEffect } from 'react'
import { Calendar, dateFnsLocalizer, Views, type Event as RBCEvent } from 'react-big-calendar'
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop'
import { format, parse, startOfWeek, getDay, startOfMonth, endOfMonth, startOfWeek as startOfWeekFn, endOfWeek as endOfWeekFn } from 'date-fns'
import { ko } from 'date-fns/locale'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css'

import { useHolidays } from '@/hooks/useHolidays'
import { formatDaysUntil } from '@/types/court-hearing'

import type { Profile, BigCalendarEvent, UnifiedSchedule, Holiday } from './types'
import { useCalendarEvents } from './hooks/useCalendarEvents'
import { useCalendarNavigation } from './hooks/useCalendarNavigation'
import { useEventActions } from './hooks/useEventActions'
import { convertToUnifiedSchedule, getVideoBadgeInfo, shortenCourtLocation, getScheduleTypeLabel, getScheduleTypeColor } from './utils/eventTransformers'
import { CalendarToolbar } from './components/CalendarToolbar'
import { MonthEvent } from './components/MonthEvent'
import { WeekDayEvent } from './components/WeekDayEvent'
import { EventPopup } from './components/EventPopup'
import ScheduleListView from '../ScheduleListView'
import UnifiedScheduleModal, { type EditScheduleData } from '../UnifiedScheduleModal'

import './styles/big-calendar.css'

// Setup date-fns localizer for Korean
const locales = { 'ko': ko }
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: (date: Date) => startOfWeek(date, { weekStartsOn: 0 }),
  getDay,
  locales,
})

// Create drag-and-drop calendar
const DnDCalendar = withDragAndDrop<BigCalendarEvent>(Calendar)

// Custom formats for Korean
const formats = {
  monthHeaderFormat: (date: Date) => format(date, 'yyyy년 M월', { locale: ko }),
  weekdayFormat: (date: Date) => format(date, 'EEE', { locale: ko }),
  dayHeaderFormat: (date: Date) => format(date, 'M월 d일 (EEE)', { locale: ko }),
  dayRangeHeaderFormat: ({ start, end }: { start: Date; end: Date }) =>
    `${format(start, 'M월 d일', { locale: ko })} - ${format(end, 'M월 d일', { locale: ko })}`,
  timeGutterFormat: (date: Date) => format(date, 'HH:mm'),
  eventTimeRangeFormat: ({ start }: { start: Date; end: Date }) =>
    format(start, 'HH:mm'),
}

// Messages for Korean
const messages = {
  today: '오늘',
  previous: '이전',
  next: '다음',
  month: '월',
  week: '주',
  day: '일',
  agenda: '목록',
  date: '날짜',
  time: '시간',
  event: '일정',
  showMore: (total: number) => `+${total}개 더보기`,
  noEventsInRange: '일정이 없습니다',
}

interface BigCalendarProps {
  profile: Profile
}

export default function BigCalendar({ profile: _profile }: BigCalendarProps) {
  // Navigation state
  const navigation = useCalendarNavigation()
  const {
    currentDate,
    viewMode,
    selectedDate,
    pickerYear,
    showMonthPicker,
    setCurrentDate,
    setViewMode,
    setSelectedDate,
    goToPrevious,
    goToNext,
    goToToday,
    handleViewChange,
    openMonthPicker,
    closeMonthPicker,
    setPickerYear,
    handleMonthSelect,
  } = navigation

  // Filter state
  const [filterType, setFilterType] = useState<'all' | 'court'>('all')
  const [selectedLawyers, setSelectedLawyers] = useState<string[]>([])
  const [showLawyerPopover, setShowLawyerPopover] = useState(false)

  // Events state
  const {
    events,
    allEvents,
    loading,
    isValidating,
    tenantMembers,
    refetch,
    updateEvent,
    updateAttendingLawyer,
    updatingLawyer,
  } = useCalendarEvents({
    currentDate,
    filterType,
    selectedLawyers,
  })

  // Event actions
  const { handleEventDrop, handleEventResize } = useEventActions({
    onEventUpdate: updateEvent,
    onRefetch: refetch,
  })

  // Popup state
  const [popupEvent, setPopupEvent] = useState<BigCalendarEvent | null>(null)
  const [popupPosition, setPopupPosition] = useState<{ x: number; y: number } | null>(null)

  // Modal state
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingSchedule, setEditingSchedule] = useState<EditScheduleData | null>(null)
  const [prefilledDate, setPrefilledDate] = useState<string>('')

  // Detail panel state
  const [isDetailPanelCollapsed, setIsDetailPanelCollapsed] = useState(false)

  // Holidays
  const monthStart = useMemo(() => startOfMonth(currentDate), [currentDate])
  const monthEnd = useMemo(() => endOfMonth(currentDate), [currentDate])
  const calendarStart = useMemo(() => startOfWeekFn(monthStart, { weekStartsOn: 0 }), [monthStart])
  const calendarEnd = useMemo(() => endOfWeekFn(monthEnd, { weekStartsOn: 0 }), [monthEnd])

  const holidayYears = useMemo(() => {
    const years = new Set<number>()
    years.add(calendarStart.getFullYear())
    years.add(calendarEnd.getFullYear())
    return Array.from(years)
  }, [calendarStart, calendarEnd])

  const { holidays } = useHolidays(holidayYears)

  const holidayMap = useMemo(() => {
    const map = new Map<string, Holiday>()
    holidays.forEach(h => map.set(h.holiday_date, h))
    return map
  }, [holidays])

  // 공휴일/주말 날짜 숫자 색상 적용 (DOM 직접 수정)
  useEffect(() => {
    if (viewMode !== 'month' && viewMode !== 'list') return

    // 약간의 지연 후 실행 (렌더링 완료 대기)
    const timer = setTimeout(() => {
      const monthRows = document.querySelectorAll('.rbc-month-row')

      monthRows.forEach((row) => {
        const bgCells = row.querySelectorAll('.rbc-row-bg .rbc-day-bg')
        const dateCells = row.querySelectorAll('.rbc-row-content .rbc-date-cell')

        dateCells.forEach((dateCell, idx) => {
          const bgCell = bgCells[idx]
          const button = dateCell.querySelector('.rbc-button-link') as HTMLElement

          if (button && bgCell) {
            // 기존 클래스 제거
            button.classList.remove('holiday-date', 'saturday-date')

            if (bgCell.classList.contains('rbc-day-holiday')) {
              button.classList.add('holiday-date')
            } else if (bgCell.classList.contains('rbc-day-saturday')) {
              button.classList.add('saturday-date')
            }
          }
        })
      })
    }, 50)

    return () => clearTimeout(timer)
  }, [currentDate, viewMode, holidayMap])

  // Toggle lawyer selection
  const toggleLawyer = useCallback((id: string) => {
    setSelectedLawyers(prev =>
      prev.includes(id) ? prev.filter(l => l !== id) : [...prev, id]
    )
  }, [])

  // Handle event click - 이벤트와 클릭 위치 저장
  const handleSelectEvent = useCallback((event: BigCalendarEvent, e: React.SyntheticEvent) => {
    const target = e.target as HTMLElement
    const eventElement = target.closest('.rbc-event') as HTMLElement

    if (eventElement) {
      const rect = eventElement.getBoundingClientRect()
      setPopupPosition({ x: rect.left, y: rect.top + rect.height / 2 })
    } else {
      // Fallback: 클릭 위치
      const nativeEvent = e.nativeEvent as MouseEvent
      setPopupPosition({ x: nativeEvent.clientX, y: nativeEvent.clientY })
    }
    setPopupEvent(event)
  }, [])

  // Handle date click
  const handleSelectSlot = useCallback(({ start }: { start: Date }) => {
    startTransition(() => {
      setSelectedDate(start)
    })
  }, [setSelectedDate])

  // Handle navigation change
  const handleNavigate = useCallback((date: Date) => {
    setCurrentDate(date)
  }, [setCurrentDate])

  // Get schedules for selected day
  const selectedDaySchedules = useMemo(() => {
    if (!selectedDate) return []
    const dateStr = format(selectedDate, 'yyyy-MM-dd')
    return events
      .filter(e => format(e.start, 'yyyy-MM-dd') === dateStr)
      .map(convertToUnifiedSchedule)
  }, [selectedDate, events])

  // Get holiday for a day
  const getHolidayForDay = useCallback((day: Date): string | null => {
    const dateStr = format(day, 'yyyy-MM-dd')
    return holidayMap.get(dateStr)?.holiday_name || null
  }, [holidayMap])

  // Handle popup edit
  const handlePopupEdit = useCallback((event: BigCalendarEvent) => {
    setPopupEvent(null)
    setPopupPosition(null)
    // Open edit modal based on event type
    handleScheduleClick(convertToUnifiedSchedule(event))
  }, [])

  // Handle popup view case
  const handlePopupViewCase = useCallback((caseId: string) => {
    setPopupEvent(null)
    setPopupPosition(null)
    window.location.href = `/cases/${caseId}`
  }, [])

  // Close popup
  const handleClosePopup = useCallback(() => {
    setPopupEvent(null)
    setPopupPosition(null)
  }, [])

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

  // Custom day prop getter for holidays/weekends
  const dayPropGetter = useCallback((date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd')
    const holiday = holidayMap.get(dateStr)
    const dayOfWeek = date.getDay()
    const isSunday = dayOfWeek === 0
    const isSaturday = dayOfWeek === 6

    const style: React.CSSProperties = {}
    const className: string[] = []

    if (holiday || isSunday) {
      className.push('rbc-day-holiday')
    } else if (isSaturday) {
      className.push('rbc-day-saturday')
    }

    return { style, className: className.join(' ') }
  }, [holidayMap])

  // Custom event prop getter for event styling
  const eventPropGetter = useCallback((event: BigCalendarEvent) => {
    const isPostponed = event.status === 'POSTPONED'
    const isLawyerMeeting = event.eventSubtype === 'HEARING_LAWYER_MEETING'
    const isNoAttendance = ['HEARING_JUDGMENT', 'HEARING_INVESTIGATION', 'HEARING_PARENTING'].includes(event.eventSubtype || '')

    let className = 'rbc-event-custom'

    if (event.eventType === 'COURT_HEARING') {
      if (isPostponed) {
        className += ' rbc-event-postponed'
      } else if (isLawyerMeeting) {
        className += ' rbc-event-lawyer-meeting'
      } else if (isNoAttendance) {
        className += ' rbc-event-no-attendance'
      } else {
        className += ' rbc-event-court-hearing'
      }
    } else if (event.eventType === 'CONSULTATION') {
      className += ' rbc-event-consultation'
    } else if (event.eventType === 'DEADLINE') {
      className += ' rbc-event-deadline'
    } else {
      className += ' rbc-event-meeting'
    }

    return { className }
  }, [])

  // Custom components - pass selected state
  const components = useMemo(() => ({
    event: ({ event }: { event: BigCalendarEvent }) => (
      <WeekDayEvent event={event} isSelected={popupEvent?.id === event.id} />
    ),
    month: {
      event: ({ event }: { event: BigCalendarEvent }) => (
        <MonthEvent event={event} isSelected={popupEvent?.id === event.id} />
      ),
    },
    toolbar: () => null, // We use our own toolbar
  }), [popupEvent?.id])

  // View mapping
  const rbcView = viewMode === 'month' ? Views.MONTH : viewMode === 'week' ? Views.WEEK : Views.DAY

  // Loading state
  if (loading && events.length === 0) {
    return (
      <div className="w-full h-full flex flex-col overflow-hidden">
        <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-default)] flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-[var(--border-default)] border-t-[var(--sage-primary)]" />
            <p className="text-[var(--text-tertiary)] text-sm">일정을 불러오는 중...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full h-full flex flex-col overflow-hidden">
      {/* Toolbar */}
      <CalendarToolbar
        currentDate={currentDate}
        viewMode={viewMode}
        filterType={filterType}
        selectedLawyers={selectedLawyers}
        tenantMembers={tenantMembers}
        showLawyerPopover={showLawyerPopover}
        showMonthPicker={showMonthPicker}
        pickerYear={pickerYear}
        onFilterTypeChange={setFilterType}
        onViewModeChange={setViewMode}
        onToggleLawyer={toggleLawyer}
        onClearLawyers={() => setSelectedLawyers([])}
        onShowLawyerPopover={setShowLawyerPopover}
        onGoToPrevious={goToPrevious}
        onGoToNext={goToNext}
        onGoToToday={goToToday}
        onOpenMonthPicker={openMonthPicker}
        onCloseMonthPicker={closeMonthPicker}
        onSetPickerYear={setPickerYear}
        onMonthSelect={handleMonthSelect}
        isValidating={isValidating}
      />

      {/* Main content */}
      {loading && allEvents.length === 0 ? (
        <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-default)] flex items-center justify-center" style={{ minHeight: '500px' }}>
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-[var(--sage-primary)] border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-[var(--text-secondary)]">일정을 불러오는 중...</span>
          </div>
        </div>
      ) : viewMode === 'list' ? (
        <div className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-default)] p-3 sm:p-4 flex-1 overflow-auto">
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
        <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-default)] overflow-hidden big-calendar-wrapper flex-1">
          <DnDCalendar
            localizer={localizer}
            events={events}
            view={rbcView}
            date={currentDate}
            onNavigate={handleNavigate}
            onView={() => {}} // We handle view changes via our toolbar
            onSelectEvent={handleSelectEvent}
            onSelectSlot={handleSelectSlot}
            onEventDrop={({ event, start, end }) => handleEventDrop({ event, start: start as Date, end: end as Date })}
            onEventResize={({ event, start, end }) => handleEventResize({ event, start: start as Date, end: end as Date })}
            selectable
            resizable
            popup
            formats={formats}
            messages={messages}
            components={components}
            dayPropGetter={dayPropGetter}
            eventPropGetter={eventPropGetter}
            min={new Date(2020, 0, 1, 8, 0)} // 8:00 AM
            max={new Date(2020, 0, 1, 20, 0)} // 8:00 PM
            step={30}
            timeslots={1}
            style={{ height: '100%' }}
          />
        </div>
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

      {/* Event Popup */}
      <EventPopup
        event={popupEvent}
        position={popupPosition}
        onClose={handleClosePopup}
        onEdit={handlePopupEdit}
        onViewCase={handlePopupViewCase}
      />

      {/* Schedule modal */}
      <UnifiedScheduleModal
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false)
          setEditingSchedule(null)
          setPrefilledDate('')
        }}
        onSuccess={() => {
          refetch()
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
