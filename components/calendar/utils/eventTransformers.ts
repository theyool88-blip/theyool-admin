import type { ApiEvent, BigCalendarEvent, UnifiedSchedule } from '../types'
import { EVENT_TYPE_CALENDAR_MAP } from '../types'

/**
 * Convert API event to BigCalendar event format
 */
export function convertToBigCalendarEvent(event: ApiEvent): BigCalendarEvent {
  const eventType = EVENT_TYPE_CALENDAR_MAP[event.event_type] || 'meeting'
  const hasTime = event.event_time && event.event_time !== '00:00' && event.event_time !== '00:00:00'

  // Parse date
  const [year, month, day] = event.event_date.split('-').map(Number)

  let start: Date
  let end: Date

  if (hasTime) {
    const timeStr = event.event_time!.slice(0, 5)
    const [hours, minutes] = timeStr.split(':').map(Number)

    start = new Date(year, month - 1, day, hours, minutes)

    // Default event duration: 30 minutes
    const endMinutes = (minutes || 0) + 30
    const endHours = Math.min((hours || 0) + Math.floor(endMinutes / 60), 23)
    end = new Date(year, month - 1, day, endHours, endMinutes % 60)
  } else {
    // All-day events
    start = new Date(year, month - 1, day, 0, 0)
    end = new Date(year, month - 1, day, 23, 59)
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
    title: event.title,
    start,
    end,
    allDay: !hasTime,
    eventType: event.event_type,
    eventSubtype: event.event_subtype || undefined,
    location: event.location || undefined,
    description: event.description || undefined,
    caseId: event.case_id || undefined,
    caseNumber: event.reference_id || undefined,
    caseName: event.case_name || undefined,
    status: event.status || undefined,
    attendingLawyerId: event.attending_lawyer_id || undefined,
    attendingLawyerName: event.attending_lawyer_name || undefined,
    videoParticipantSide: event.video_participant_side || undefined,
    ourClientName: event.our_client_name || undefined,
    sortPriority: event.sort_priority || undefined,
    daysUntil,
  }
}

/**
 * Convert BigCalendarEvent to UnifiedSchedule (for detail panel)
 */
export function convertToUnifiedSchedule(event: BigCalendarEvent): UnifiedSchedule {
  let type: UnifiedSchedule['type'] = 'meeting'
  if (event.eventType === 'COURT_HEARING') type = 'court_hearing'
  else if (event.eventType === 'DEADLINE') type = 'deadline'
  else if (event.eventType === 'CONSULTATION') type = 'consultation'

  const date = formatDateString(event.start)
  const time = !event.allDay ? formatTimeString(event.start) : undefined

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
    video_participant_side: event.videoParticipantSide,
    our_client_name: event.ourClientName,
  }
}

/**
 * Format Date to "YYYY-MM-DD" string
 */
export function formatDateString(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Format Date to "HH:mm" time string
 */
export function formatTimeString(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${hours}:${minutes}`
}

/**
 * Check if a hearing is postponed/cancelled
 * DB에 영문 enum 값으로 저장됨: adjourned, withdrawn
 */
export function isPostponedHearing(result?: string): boolean {
  if (!result) return false
  // 영문 enum 값 (DB 저장값)
  const englishKeywords = ['adjourned', 'withdrawn']
  // 한글 키워드 (레거시 또는 수동 입력 대비)
  const koreanKeywords = ['기일변경', '연기', '취하', '취소', '변경지정']
  return englishKeywords.includes(result) || koreanKeywords.some(kw => result.includes(kw))
}

/**
 * Remove video device text from string
 */
export function removeVideoDeviceText(text: string): string {
  return text.replace(/\s*\[(일방|쌍방)\s*화상장치\]\s*/g, '').trim()
}

/**
 * Get video badge info
 */
export function getVideoBadgeInfo(
  videoParticipantSide?: string
): { show: boolean; label: string; color: string } | null {
  if (videoParticipantSide === 'both') {
    return { show: true, label: '쌍방화상', color: 'bg-purple-100 text-purple-700' }
  }
  if (videoParticipantSide === 'plaintiff_side' || videoParticipantSide === 'defendant_side') {
    return { show: true, label: '일방화상', color: 'bg-purple-50 text-purple-600' }
  }
  return null
}

/**
 * Shorten court location for display
 */
export function shortenCourtLocation(location?: string): string {
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

/**
 * Get short court name for compact displays
 * 가정법원은 본원과 위치가 다른 경우 "서울가정", "대전가정" 등으로 표시
 */
export function getShortCourt(location?: string): string {
  if (!location) return ''

  // 1. 가정법원 처리 (본원과 위치가 다른 가정법원들)
  // 서울가정법원(서초구), 수원가정법원(영통구), 인천가정법원(미추홀구),
  // 대전가정법원(서구), 대구가정법원(달서구), 부산가정법원(연제구),
  // 울산가정법원(남구), 광주가정법원(서구)
  const familyCourtMatch = location.match(/([가-힣]{2,3})가정법원/)
  if (familyCourtMatch) {
    return `${familyCourtMatch[1]}가정`
  }

  // 2. 지원 처리
  const jiwonMatch = location.match(/([가-힣]{2,4})지원/)
  if (jiwonMatch) return jiwonMatch[1]

  // 3. 일반 법원 (지법, 고법 등)
  const courtNames = ['서울', '수원', '평택', '천안', '대전', '대구', '부산', '광주', '인천', '울산', '창원', '청주', '전주', '춘천', '제주', '의정부', '고양', '성남', '안산', '안양', '용인', '화성', '서산', '아산', '세종']
  for (const name of courtNames) {
    if (location.includes(name)) return name
  }
  return location.slice(0, 2)
}

/**
 * Get schedule type label
 */
export function getScheduleTypeLabel(type: string, location?: string | null): string {
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

/**
 * Get schedule type color classes
 */
export function getScheduleTypeColor(
  type: string,
  hearingType?: string,
  eventSubtype?: string,
  status?: string
): string {
  if (type === 'court_hearing' && status === 'adjourned') {
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
    case 'deadline': return 'bg-[var(--color-warning-muted)] text-[var(--color-warning)] border-l-[var(--color-warning)]'
    default: return 'bg-[var(--bg-primary)] text-[var(--text-secondary)] border-l-[var(--border-default)]'
  }
}

/**
 * Get short title for calendar display
 */
export function getShortTitle(title: string): string {
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

/**
 * Extract client name or case type from title
 * Handles formats like:
 * - "김철수 vs 이영희" → "김철수"
 * - "(심문기일) 이혼 등" → "이혼 등"
 * - "(변론기일) 손해배상" → "손해배상"
 */
export function extractClientName(title: string): string {
  // 1. "(기일유형) 사건명" 형식 처리
  const parenthesisMatch = title.match(/^\([^)]+\)\s*(.+)/)
  if (parenthesisMatch) {
    return parenthesisMatch[1].trim()
  }

  // 2. "이름 vs 이름" 형식 처리
  const vsMatch = title.match(/^([가-힣]+)\s*(vs|VS|v\.|대)/)
  if (vsMatch) return vsMatch[1]

  // 3. 한글 이름으로 시작하는 경우
  const nameMatch = title.match(/^([가-힣]{2,4})/)
  if (nameMatch) return nameMatch[1]

  // 4. 기본값: 전체 제목 (너무 길면 자름)
  return title.length > 10 ? title.slice(0, 10) : title
}
