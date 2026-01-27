// Calendar Type Definitions (react-big-calendar)

// ========================================
// Profile & Tenant Types
// ========================================

export interface Profile {
  id: string
  name?: string
  email?: string
  role: string
  tenant_id?: string
  display_name?: string
}

export interface TenantMember {
  id: string
  display_name: string
  role: string
}

// ========================================
// Holiday Type
// ========================================

export interface Holiday {
  id: string
  holiday_date: string  // "2026-01-01"
  holiday_name: string  // "신정"
  year: number
}

// ========================================
// API Event Type (from unified_schedule_view)
// ========================================

export interface ApiEvent {
  id: string
  event_type: string
  event_subtype?: string | null
  title: string
  event_date: string
  event_time?: string | null
  location?: string | null
  reference_id?: string | null
  case_name?: string | null
  client_name?: string | null  // 의뢰인명 (primary_client_name)
  deadline_type_label?: string | null  // 마감일 타입명 (뱃지 표시용)
  case_id?: string | null
  description?: string | null
  status?: string | null
  attending_lawyer_id?: string | null
  attending_lawyer_name?: string | null
  scourt_type_raw?: string | null
  scourt_result_raw?: string | null  // 기일결과 (continued, settled, adjourned 등)
  video_participant_side?: string | null
  our_client_side?: string | null  // 의뢰인 측 (plaintiff_side, defendant_side)
}

// ========================================
// BigCalendar Event Type
// ========================================

export interface BigCalendarEvent {
  id: string
  title: string
  start: Date
  end: Date
  allDay?: boolean
  resource?: unknown
  // Custom properties
  eventType?: string
  eventSubtype?: string
  location?: string
  description?: string
  caseId?: string
  caseNumber?: string
  caseName?: string
  clientName?: string  // 의뢰인명
  deadlineTypeLabel?: string  // 마감일 타입명 (뱃지 표시용)
  status?: string
  attendingLawyerId?: string
  attendingLawyerName?: string
  scourtTypeRaw?: string
  scourtResultRaw?: string
  videoParticipantSide?: string
  ourClientSide?: string
  daysUntil?: number
}

// ========================================
// Legacy Schedule-X Event Type (for backward compatibility)
// ========================================

export interface ScheduleXEvent {
  id: string
  start: string | Date
  end: string | Date
  title: string
  location?: string
  description?: string
  calendarId?: string
  // Custom properties
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

// ========================================
// Unified Schedule (for detail panel)
// ========================================

export interface UnifiedSchedule {
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

// ========================================
// View Mode Type
// ========================================

export type ViewMode = 'month' | 'week' | 'day' | 'list'

// ========================================
// Event Type Mappings
// ========================================

export const EVENT_TYPE_CALENDAR_MAP: Record<string, string> = {
  COURT_HEARING: 'court_hearing',
  DEADLINE: 'deadline',
  CONSULTATION: 'consultation',
  MEETING: 'meeting',
  GENERAL_SCHEDULE: 'meeting',  // 일반 일정도 meeting으로 매핑
}

// ========================================
// Event Type Labels
// ========================================

export const EVENT_TYPE_LABELS: Record<string, string> = {
  COURT_HEARING: '법원기일',
  DEADLINE: '마감일',
  CONSULTATION: '상담',
  MEETING: '회의',
  GENERAL_SCHEDULE: '일반일정',
}

export const HEARING_TYPE_LABELS: Record<string, string> = {
  HEARING_TRIAL: '변론',
  HEARING_PREPARATION: '준비',
  HEARING_MEDIATION: '조정',
  HEARING_JUDGMENT: '선고',
  HEARING_LAWYER_MEETING: '미팅',
  HEARING_PARENTING: '양육',
  HEARING_INVESTIGATION: '조사',
  HEARING_OTHER: '기타',
}

// Types that don't require lawyer attendance
export const NO_LAWYER_ATTENDANCE_TYPES = [
  'HEARING_JUDGMENT',
  'HEARING_INVESTIGATION',
  'HEARING_PARENTING',
]
