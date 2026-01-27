'use client'

import { memo } from 'react'
import type { BigCalendarEvent } from '../types'
import { HEARING_TYPE_LABELS, NO_LAWYER_ATTENDANCE_TYPES } from '../types'
import { formatDaysUntil } from '@/types/court-hearing'
import {
  isPostponedHearing,
  getVideoBadgeInfo,
  getShortCourt,
  getShortTitle,
} from '../utils/eventTransformers'

interface WeekDayEventProps {
  event: BigCalendarEvent
  isSelected?: boolean
}

/**
 * WeekDayEvent - Event card for week/day views
 * Shows title, time, type badge, location, and case number
 */
function WeekDayEventComponent({ event, isSelected }: WeekDayEventProps) {
  const {
    title,
    start,
    allDay,
    eventType,
    eventSubtype,
    location,
    caseNumber,
    scourtResultRaw,
    scourtTypeRaw,
    videoParticipantSide,
    ourClientSide,
    daysUntil,
  } = event

  const isPostponed = isPostponedHearing(scourtResultRaw)
  const isLawyerMeeting = eventSubtype === 'HEARING_LAWYER_MEETING'
  const isNoAttendanceRequired = NO_LAWYER_ATTENDANCE_TYPES.includes(eventSubtype || '')
  const videoBadge = getVideoBadgeInfo(scourtTypeRaw, videoParticipantSide, ourClientSide)

  // Get type label
  const subtypeLabel = eventSubtype ? HEARING_TYPE_LABELS[eventSubtype] || eventSubtype : ''

  // Get time string
  const timeStr = !allDay
    ? `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`
    : null

  // Determine styling based on event type and status
  const getEventStyle = () => {
    if (eventType === 'COURT_HEARING') {
      if (isPostponed) {
        return 'border-l-[var(--border-default)] bg-[var(--bg-tertiary)] opacity-60'
      }
      if (isLawyerMeeting) {
        return 'border-l-teal-500 bg-teal-50 dark:bg-teal-950/30'
      }
      if (isNoAttendanceRequired) {
        return 'border-l-[var(--border-default)] bg-[var(--bg-primary)]'
      }
      return 'border-l-[var(--sage-primary)] bg-[var(--sage-muted)]'
    }
    switch (eventType) {
      case 'CONSULTATION':
        return 'border-l-[var(--color-info)] bg-[var(--color-info-muted)]'
      case 'DEADLINE':
        return 'border-l-[#F59E0B] bg-[rgba(245,158,11,0.15)]'
      default:
        return 'border-l-[var(--text-muted)] bg-[var(--bg-tertiary)]'
    }
  }

  return (
    <div
      data-event-id={event.id}
      className={`
        w-full h-full px-1.5 py-1 rounded-md border-l-[3px] overflow-hidden
        cursor-pointer transition-all
        ${isSelected ? 'ring-2 ring-[var(--sage-primary)] shadow-md scale-[1.02]' : 'hover:shadow-sm'}
        ${getEventStyle()}
      `}
    >
      {/* Title */}
      <div className={`font-medium text-[11px] truncate leading-tight ${isPostponed ? 'text-[var(--text-muted)] line-through' : 'text-[var(--text-primary)]'}`}>
        {getShortTitle(title)}
      </div>

      {/* Time & Type Badge */}
      <div className="flex items-center gap-1 mt-0.5 flex-wrap">
        {timeStr && (
          <span className="text-[10px] text-[var(--text-secondary)] font-medium">
            {timeStr}
          </span>
        )}
        {eventType === 'COURT_HEARING' && subtypeLabel && (
          <span className={`text-[9px] px-1 py-0.5 rounded ${
            isPostponed ? 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]' :
            isLawyerMeeting ? 'bg-teal-100 text-teal-700 dark:bg-teal-900/50 dark:text-teal-300' :
            'bg-[var(--sage-muted)] text-[var(--sage-primary)]'
          }`}>
            {isPostponed ? '연기' : subtypeLabel}
          </span>
        )}
        {videoBadge && !isPostponed && (
          <span className={`text-[9px] px-1 py-0.5 rounded font-bold ${videoBadge.color}`}>
            {videoBadge.label}
          </span>
        )}
        {eventType === 'DEADLINE' && daysUntil !== undefined && (
          <span className={`text-[9px] px-1 py-0.5 rounded font-bold ${
            daysUntil <= 1 ? 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300' :
            daysUntil <= 3 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300' :
            'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300'
          }`}>
            {formatDaysUntil(daysUntil)}
          </span>
        )}
      </div>

      {/* Location (shortened) */}
      {location && (
        <div className="flex items-center gap-1 mt-0.5 text-[10px] text-[var(--text-tertiary)] truncate">
          <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          </svg>
          <span className="truncate">{getShortCourt(location)}</span>
        </div>
      )}

      {/* Case Number */}
      {caseNumber && (
        <div className="flex items-center gap-1 mt-0.5 text-[10px] text-[var(--text-tertiary)] truncate">
          <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span className="truncate">{caseNumber}</span>
        </div>
      )}
    </div>
  )
}

export const WeekDayEvent = memo(WeekDayEventComponent)
export default WeekDayEvent
