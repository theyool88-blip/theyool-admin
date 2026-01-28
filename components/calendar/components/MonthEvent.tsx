'use client'

import { memo } from 'react'
import type { BigCalendarEvent } from '../types'
import { HEARING_TYPE_LABELS, NO_LAWYER_ATTENDANCE_TYPES } from '../types'
import {
  getVideoBadgeInfo,
  getShortCourt,
  extractClientName,
  getSpecialResultLabel,
  isEventPostponed,
} from '../utils/eventTransformers'

// 기일 결과 라벨
const RESULT_LABELS: Record<string, string> = {
  continued: '속행',
  settled: '종결',
  judgment: '판결선고',
  dismissed: '각하',
  withdrawn: '취하',
  adjourned: '연기',
  other: '기타',
}

interface MonthEventProps {
  event: BigCalendarEvent
  isSelected?: boolean
}

// Get purpose/type label for display
function getDisplayLabel(eventType?: string, eventSubtype?: string): string {
  if (eventType === 'CONSULTATION') return '상담'
  if (eventType === 'DEADLINE') return ''  // 마감일은 D-n으로 표시
  if (eventType === 'MEETING' || eventType === 'GENERAL_SCHEDULE') return '회의'
  if (eventType === 'COURT_HEARING' && eventSubtype) {
    if (eventSubtype === 'HEARING_LAWYER_MEETING') return '미팅'
    return HEARING_TYPE_LABELS[eventSubtype] || '기일'
  }
  return ''
}

// Get label badge CSS class for timed events
function getLabelBadgeClass(
  eventType?: string,
  eventSubtype?: string,
  isPostponed?: boolean,
  isNoAttendance?: boolean
): string {
  if (isPostponed) return 'event-label-postponed'

  if (eventType === 'COURT_HEARING') {
    if (isNoAttendance) return 'event-label-no-attendance'
    return 'event-label-hearing'
  }
  if (eventType === 'DEADLINE') return 'event-label-deadline'

  // 상담, 변호사 미팅, 일반 회의 → Blue
  return 'event-label-meeting'
}

// Get bar color class for all-day events
function getBarColorClass(
  eventType?: string,
  eventSubtype?: string,
  isPostponed?: boolean,
  isNoAttendance?: boolean
): string {
  if (isPostponed) return 'event-bar-postponed'

  if (eventType === 'COURT_HEARING') {
    if (isNoAttendance) return 'event-bar-no-attendance'
    return 'event-bar-hearing'
  }
  if (eventType === 'DEADLINE') return 'event-bar-deadline'

  // 상담, 변호사 미팅, 일반 회의 → Blue
  return 'event-bar-meeting'
}

/**
 * MonthEvent - Google Calendar style
 * - All-day events: colored bar
 * - Timed events: dot + text
 */
function MonthEventComponent({ event, isSelected }: MonthEventProps) {
  const {
    title,
    start,
    allDay,
    eventType,
    eventSubtype,
    location,
    status,
    result,
    scourtResultRaw,
    videoParticipantSide,
    ourClientName,
  } = event

  // 연기 여부: status가 POSTPONED이거나 result가 adjourned이거나,
  // scourt_result_raw가 '기일변경'으로 시작하거나 '연기', '휴정'인 경우
  const isPostponed = isEventPostponed(status, result, scourtResultRaw)
  // 선고기일 여부
  const isJudgment = eventSubtype === 'HEARING_JUDGMENT' || eventSubtype === 'HEARING_SENTENCE'
  // 결과가 있는지 여부
  const hasResult = result && RESULT_LABELS[result]

  // 특별 표시할 기일 결과 (Sage Green 뱃지로 표시)
  const specialResultLabel = getSpecialResultLabel(scourtResultRaw)
  const isNoAttendanceRequired = NO_LAWYER_ATTENDANCE_TYPES.includes(eventSubtype || '')
  const videoBadge = getVideoBadgeInfo(videoParticipantSide)

  // Get time string (only for timed events)
  const timeStr = !allDay
    ? `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`
    : ''

  // Get display components
  const displayLabel = getDisplayLabel(eventType, eventSubtype)
  const shortCourt = eventType === 'COURT_HEARING' ? getShortCourt(location) : ''
  // 의뢰인명: DB에서 가져온 ourClientName 우선, 없으면 title에서 추출
  const clientName = ourClientName || extractClientName(title)

  // Build display text and badge label
  let displayText = ''
  let badgeLabel = ''

  if (eventType === 'DEADLINE') {
    // 마감일: '기한'을 뱃지로 표시
    badgeLabel = '기한'
    displayText = clientName
  } else if (allDay) {
    // 종일 이벤트: 라벨 제목 (시간 없음)
    // 결과가 있으면 결과로 뱃지 교체
    badgeLabel = specialResultLabel || displayLabel
    displayText = clientName
  } else {
    // 시간 이벤트: 시간 법원 의뢰인 (라벨은 뱃지로 표시)
    // 결과가 있으면 결과로 뱃지 교체
    badgeLabel = specialResultLabel || displayLabel
    const parts = [timeStr, shortCourt, clientName].filter(Boolean)
    displayText = parts.join(' ')
  }

  // ===== 종일 이벤트: 색상 바 스타일 =====
  if (allDay) {
    const barColorClass = getBarColorClass(eventType, eventSubtype, isPostponed, isNoAttendanceRequired)

    return (
      <div
        data-event-id={event.id}
        className={`
          px-1.5 py-0.5 rounded text-[12px] leading-normal truncate cursor-pointer transition-all
          ${barColorClass}
          ${isSelected ? 'ring-2 ring-[var(--sage-primary)] ring-opacity-70 scale-[1.02]' : ''}
          hover:opacity-90
        `}
      >
        <span className="truncate">
          {badgeLabel || ''}
          {videoBadge && !isPostponed && (
            <span className="ml-0.5 text-[8px] px-0.5 rounded event-badge-video">화</span>
          )}
          {(badgeLabel || videoBadge) && ' '}
          <span className={isPostponed ? 'line-through' : ''}>{displayText}</span>
        </span>
      </div>
    )
  }

  // ===== 시간 이벤트: 라벨 뱃지 + 텍스트 스타일 =====
  // 연기/기일변경된 경우 회색 스타일 적용
  const labelBadgeClass = getLabelBadgeClass(eventType, eventSubtype, isPostponed, isNoAttendanceRequired)

  // 결과 텍스트 (선고 결과 또는 연기)
  const resultText = hasResult ? RESULT_LABELS[result!] : ''

  // 연기된 경우: 취소선 효과만 적용
  if (isPostponed) {
    return (
      <div
        data-event-id={event.id}
        className={`
          flex items-center gap-1 px-0.5 py-0.5 rounded text-[12px] leading-normal truncate cursor-pointer transition-all
          ${isSelected ? 'bg-[var(--sage-primary)] bg-opacity-20 ring-2 ring-[var(--sage-primary)] ring-opacity-50 scale-[1.02]' : 'hover:bg-[var(--bg-hover)]'}
        `}
      >
        {badgeLabel && (
          <span className={`text-[10px] px-1 py-0 rounded flex-shrink-0 font-medium ${labelBadgeClass}`}>
            {badgeLabel}
          </span>
        )}
        <span className="truncate text-[var(--text-muted)] line-through">
          {displayText}
        </span>
      </div>
    )
  }

  // 선고기일이고 결과가 있는 경우: 결과 표시
  if (isJudgment && hasResult && !isPostponed) {
    return (
      <div
        data-event-id={event.id}
        className={`
          flex flex-col gap-0 px-0.5 py-0.5 rounded text-[12px] leading-tight cursor-pointer transition-all
          ${isSelected ? 'bg-[var(--sage-primary)] bg-opacity-20 ring-2 ring-[var(--sage-primary)] ring-opacity-50 scale-[1.02]' : 'hover:bg-[var(--bg-hover)]'}
        `}
      >
        {/* 첫째 줄: 기본 정보 */}
        <div className="flex items-center gap-1 truncate">
          {badgeLabel && (
            <span className={`text-[10px] px-1 py-0 rounded flex-shrink-0 font-medium ${labelBadgeClass}`}>
              {badgeLabel}
            </span>
          )}
          <span className="truncate text-[var(--text-secondary)]">
            {displayText}
          </span>
        </div>
        {/* 둘째 줄: 선고 결과 */}
        <div className="text-[10px] text-[var(--sage-primary)] pl-1 font-medium">
          → {resultText}
        </div>
      </div>
    )
  }

  // 일반 이벤트
  return (
    <div
      data-event-id={event.id}
      className={`
        flex items-center gap-1 px-0.5 py-0.5 rounded text-[12px] leading-normal truncate cursor-pointer transition-all
        ${isSelected ? 'bg-[var(--sage-primary)] bg-opacity-20 ring-2 ring-[var(--sage-primary)] ring-opacity-50 scale-[1.02]' : 'hover:bg-[var(--bg-hover)]'}
      `}
    >
      {badgeLabel && (
        <span className={`text-[10px] px-1 py-0 rounded flex-shrink-0 font-medium ${labelBadgeClass}`}>
          {badgeLabel}
        </span>
      )}
      {videoBadge && (
        <span className="text-[8px] px-0.5 rounded event-badge-video flex-shrink-0">화</span>
      )}
      <span className="truncate text-[var(--text-secondary)]">
        {displayText}
      </span>
    </div>
  )
}

export const MonthEvent = memo(MonthEventComponent)
export default MonthEvent
