'use client'

import { memo } from 'react'
import type { BigCalendarEvent } from '../types'
import { HEARING_TYPE_LABELS, NO_LAWYER_ATTENDANCE_TYPES } from '../types'
import {
  isPostponedHearing,
  getVideoBadgeInfo,
  getShortCourt,
  extractClientName,
} from '../utils/eventTransformers'

// 기일결과 한글 변환
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
    scourtResultRaw,
    scourtTypeRaw,
    videoParticipantSide,
    ourClientSide,
    clientName: eventClientName,
    deadlineTypeLabel,
  } = event

  const isPostponed = isPostponedHearing(scourtResultRaw)
  const isNoAttendanceRequired = NO_LAWYER_ATTENDANCE_TYPES.includes(eventSubtype || '')
  const videoBadge = getVideoBadgeInfo(scourtTypeRaw, videoParticipantSide, ourClientSide)

  // Get time string (only for timed events)
  const timeStr = !allDay
    ? `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`
    : ''

  // Get display components
  const displayLabel = getDisplayLabel(eventType, eventSubtype)
  const shortCourt = eventType === 'COURT_HEARING' ? getShortCourt(location) : ''
  // 의뢰인명: DB에서 가져온 clientName 우선, 없으면 title에서 추출
  const clientName = eventClientName || extractClientName(title)

  // 기일결과 한글 변환 (영문 enum은 한글로, 한글은 그대로)
  const resultLabelKr = scourtResultRaw ? (RESULT_LABELS[scourtResultRaw] || scourtResultRaw) : ''

  // Build display text and badge label
  let displayText = ''
  let badgeLabel = ''
  let resultLabel = '' // 기일결과 (결과가 있을 때만, 화살표 없이)

  if (eventType === 'DEADLINE') {
    // 마감일: deadlineTypeLabel을 뱃지로 표시 (D-day 대신)
    badgeLabel = deadlineTypeLabel || '기한'
    displayText = clientName
  } else if (allDay) {
    // 종일 이벤트: 라벨 제목 (시간 없음)
    badgeLabel = displayLabel
    displayText = clientName
    // 기일결과가 있으면 별도 뱃지로 표시 (본래 기일 타입 유지)
    if (eventType === 'COURT_HEARING' && resultLabelKr) {
      resultLabel = resultLabelKr
    }
  } else {
    // 시간 이벤트: 시간 법원 의뢰인 (라벨은 뱃지로 표시)
    badgeLabel = displayLabel
    const parts = [timeStr, shortCourt, clientName].filter(Boolean)
    displayText = parts.join(' ')
    // 기일결과가 있으면 별도 뱃지로 표시 (본래 기일 타입 유지)
    if (eventType === 'COURT_HEARING' && resultLabelKr) {
      resultLabel = resultLabelKr
    }
  }

  // ===== 종일 이벤트: 색상 바 스타일 =====
  if (allDay) {
    // 선고기일 결과가 있으면 Purple 바 사용
    const isJudgmentWithResult = eventSubtype === 'HEARING_JUDGMENT' && resultLabel && !isPostponed
    const barColorClass = isJudgmentWithResult
      ? 'event-bar-judgment'
      : getBarColorClass(eventType, eventSubtype, isPostponed, isNoAttendanceRequired)

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
          {resultLabel && (
            <span className="ml-0.5 px-1 rounded text-[10px] bg-white/30 text-inherit">
              {resultLabel}
            </span>
          )}
          {videoBadge && !isPostponed && (
            <span className="ml-0.5 text-[8px] px-0.5 rounded event-badge-video">화</span>
          )}
          {(badgeLabel || videoBadge || resultLabel) && ' '}
          <span className={isPostponed ? 'line-through' : ''}>{displayText}</span>
        </span>
      </div>
    )
  }

  // ===== 시간 이벤트: 라벨 뱃지 + 텍스트 스타일 =====
  // 연기/기일변경된 경우 회색 스타일 적용
  const labelBadgeClass = getLabelBadgeClass(eventType, eventSubtype, isPostponed, isNoAttendanceRequired)

  // 선고기일 결과는 Purple로 표시 (연기 제외)
  const isJudgmentResult = eventSubtype === 'HEARING_JUDGMENT' && resultLabel && !isPostponed
  const resultBadgeClass = isJudgmentResult ? 'event-label-judgment' : labelBadgeClass

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
      {resultLabel && (
        <span className={`text-[10px] px-1 py-0 rounded flex-shrink-0 font-medium ${resultBadgeClass}`}>
          {resultLabel}
        </span>
      )}
      {videoBadge && !isPostponed && (
        <span className="text-[8px] px-0.5 rounded event-badge-video flex-shrink-0">화</span>
      )}
      <span className={`truncate ${isPostponed ? 'text-[var(--text-muted)] line-through' : 'text-[var(--text-secondary)]'}`}>
        {displayText}
      </span>
    </div>
  )
}

export const MonthEvent = memo(MonthEventComponent)
export default MonthEvent
