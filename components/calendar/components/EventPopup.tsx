'use client'

import { memo, useEffect, useRef, useState } from 'react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import type { BigCalendarEvent } from '../types'
import { HEARING_TYPE_LABELS, NO_LAWYER_ATTENDANCE_TYPES } from '../types'
import { formatDaysUntil, HEARING_RESULT_LABELS } from '@/types/court-hearing'
import {
  getVideoBadgeInfo,
  shortenCourtLocation,
  isEventPostponed,
} from '../utils/eventTransformers'

interface EventPopupProps {
  event: BigCalendarEvent | null
  position: { x: number; y: number } | null
  onClose: () => void
  onEdit: (event: BigCalendarEvent) => void
  onViewCase: (caseId: string) => void
  onChangeAttendingLawyer?: (event: BigCalendarEvent) => void
}

const POPUP_WIDTH = 320
const POPUP_HEIGHT = 380

/**
 * EventPopup - 이벤트 근처에 표시되는 상세 팝업 (Google Calendar 스타일)
 */
function EventPopupComponent({
  event,
  position,
  onClose,
  onEdit,
  onViewCase,
  onChangeAttendingLawyer,
}: EventPopupProps) {
  const popupRef = useRef<HTMLDivElement>(null)
  const [popupStyle, setPopupStyle] = useState<React.CSSProperties>({})

  // 팝업 위치 계산
  useEffect(() => {
    if (!position) return

    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    const margin = 16

    // 이벤트 왼쪽에 표시 시도
    let left = position.x - POPUP_WIDTH - margin

    // 왼쪽 공간 부족하면 오른쪽
    if (left < margin) {
      left = position.x + margin
    }

    // 오른쪽도 부족하면 화면 중앙
    if (left + POPUP_WIDTH > viewportWidth - margin) {
      left = (viewportWidth - POPUP_WIDTH) / 2
    }

    // 세로 위치 - 이벤트 중앙 기준
    let top = position.y - POPUP_HEIGHT / 2

    // 화면 밖으로 나가지 않도록
    if (top < margin) top = margin
    if (top + POPUP_HEIGHT > viewportHeight - margin) {
      top = viewportHeight - POPUP_HEIGHT - margin
    }

    void (async () => {
      setPopupStyle({
        position: 'fixed',
        top,
        left,
        zIndex: 1000,
      })
    })()
  }, [position])

  // ESC 키로 닫기
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (event) {
      document.addEventListener('keydown', handleEscape)
    }
    return () => document.removeEventListener('keydown', handleEscape)
  }, [event, onClose])

  // 팝업 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement

      // 팝업 내부 클릭이면 무시
      if (popupRef.current?.contains(target)) return

      // 다른 캘린더 이벤트 클릭이면 무시 (onSelectEvent가 처리)
      if (target.closest('.rbc-event')) return

      // 그 외는 닫기
      onClose()
    }

    if (event) {
      const timer = setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside)
      }, 0)
      return () => {
        clearTimeout(timer)
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }
  }, [event, onClose])

  if (!event || !position) return null

  const {
    title,
    start,
    allDay,
    eventType,
    eventSubtype,
    location,
    caseNumber,
    caseId,
    caseName,
    status,
    attendingLawyerName,
    videoParticipantSide,
    ourClientName,
    daysUntil,
    result,
    scourtResultRaw,
    scourtHearingHash,
  } = event

  const isFromScourt = !!scourtHearingHash

  // 연기 여부: status가 POSTPONED이거나 result가 adjourned이거나,
  // scourt_result_raw가 '기일변경'으로 시작하거나 '연기', '휴정'인 경우
  const isPostponed = isEventPostponed(status, result, scourtResultRaw)
  const isLawyerMeeting = eventSubtype === 'HEARING_LAWYER_MEETING'
  const isNoAttendanceRequired = NO_LAWYER_ATTENDANCE_TYPES.includes(eventSubtype || '')
  const videoBadge = getVideoBadgeInfo(videoParticipantSide)

  const subtypeLabel = eventSubtype ? HEARING_TYPE_LABELS[eventSubtype] || '' : ''
  const typeLabel = subtypeLabel || getEventTypeLabel(eventType)

  // 결과 뱃지 클래스 (MonthEvent.tsx와 동일)
  const getResultBadgeClass = () => {
    if (isPostponed) return 'event-label-postponed'
    if (eventSubtype === 'HEARING_JUDGMENT') return 'event-label-judgment'
    if (isNoAttendanceRequired) return 'event-label-no-attendance'
    return 'event-label-hearing'
  }

  const getIndicatorColor = () => {
    if (isPostponed) return 'bg-gray-400'
    if (eventType === 'COURT_HEARING') {
      if (isLawyerMeeting) return 'bg-teal-500'
      if (isNoAttendanceRequired) return 'bg-gray-400'
      return 'bg-[var(--sage-primary)]'
    }
    switch (eventType) {
      case 'CONSULTATION': return 'bg-[var(--color-info)]'
      case 'DEADLINE': return 'bg-orange-500'
      default: return 'bg-gray-500'
    }
  }

  return (
    <>
      {/* 팝업 */}
      <div
        ref={popupRef}
        style={popupStyle}
        className="w-[320px] bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-default)] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        {/* 헤더 */}
        <div className="flex items-start gap-3 p-4 border-b border-[var(--border-subtle)]">
          <div className={`w-3 h-3 rounded-full flex-shrink-0 mt-1 ${getIndicatorColor()}`} />
          <div className="flex-1 min-w-0">
            {/* 제목: [기일타입] */}
            <div className={`flex items-center gap-1.5 flex-wrap ${isPostponed ? 'opacity-70' : ''}`}>
              <h3 className={`font-semibold text-sm text-[var(--text-primary)] leading-tight`}>
                {typeLabel}
              </h3>
              {isPostponed && (
                <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${getResultBadgeClass()}`}>
                  연기
                </span>
              )}
            </div>
            {/* 부제목: 의뢰인명 또는 사건명 */}
            <p className="text-xs text-[var(--text-secondary)] mt-0.5 truncate">
              {ourClientName || caseName || title}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 내용 */}
        <div className="p-4 space-y-3">
          {/* 날짜 & 시간 */}
          <div className="flex items-center gap-2 text-sm">
            <svg className="w-4 h-4 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="text-[var(--text-primary)]">
              {format(start, 'yyyy. M. d. (E)', { locale: ko })}
              {!allDay && ` ${format(start, 'HH:mm')}`}
            </span>
          </div>

          {/* 장소 */}
          {location && (
            <div className="flex items-center gap-2 text-sm">
              <svg className="w-4 h-4 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="text-[var(--text-primary)]">{shortenCourtLocation(location)}</span>
            </div>
          )}

          {/* 사건번호 */}
          {caseNumber && (
            <div className="flex items-center gap-2 text-sm">
              <svg className="w-4 h-4 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="text-[var(--text-primary)]">{caseNumber}</span>
            </div>
          )}

          {/* 담당 변호사 */}
          {attendingLawyerName && (
            <div className="flex items-center gap-2 text-sm">
              <svg className="w-4 h-4 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span className="text-[var(--text-primary)]">{attendingLawyerName}</span>
              {eventType === 'COURT_HEARING' && onChangeAttendingLawyer && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onChangeAttendingLawyer(event)
                  }}
                  className="p-1 text-[var(--text-muted)] hover:text-[var(--sage-primary)] hover:bg-[var(--bg-hover)] rounded transition-colors"
                  title="출석변호사 변경"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
              )}
            </div>
          )}

          {/* 기일 결과 */}
          {eventType === 'COURT_HEARING' && (result || scourtResultRaw) && (
            <div className="flex items-center gap-2 text-sm">
              <svg className="w-4 h-4 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-[var(--text-primary)]">
                결과: {scourtResultRaw || HEARING_RESULT_LABELS[result as keyof typeof HEARING_RESULT_LABELS] || result}
              </span>
            </div>
          )}

          {/* 뱃지 */}
          <div className="flex flex-wrap gap-1.5">
            {videoBadge && !isPostponed && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${videoBadge.color}`}>
                {videoBadge.label}
              </span>
            )}
            {eventType === 'DEADLINE' && daysUntil !== undefined && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                daysUntil <= 1 ? 'bg-red-100 text-red-700' :
                daysUntil <= 3 ? 'bg-orange-100 text-orange-700' :
                'bg-yellow-100 text-yellow-700'
              }`}>
                {formatDaysUntil(daysUntil)}
              </span>
            )}
          </div>
        </div>

        {/* 액션 버튼 */}
        <div className="flex items-center gap-2 p-4 border-t border-[var(--border-subtle)] bg-[var(--bg-tertiary)]">
          <button
            onClick={() => onEdit(event)}
            disabled={isFromScourt}
            className={`flex-1 px-3 py-2 text-xs font-medium border border-[var(--border-default)] rounded-lg transition-colors ${
              isFromScourt
                ? 'bg-[var(--bg-tertiary)] text-[var(--text-muted)] cursor-not-allowed'
                : 'text-[var(--text-secondary)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
            }`}
          >
            {isFromScourt ? 'SCOURT 동기화' : '수정'}
          </button>
          {caseId && (
            <button
              onClick={() => onViewCase(caseId)}
              className="flex-1 px-3 py-2 text-xs font-medium text-white bg-[var(--sage-primary)] rounded-lg hover:bg-[var(--sage-primary-hover)] transition-colors"
            >
              사건 보기
            </button>
          )}
        </div>
      </div>
    </>
  )
}

function getEventTypeLabel(eventType?: string): string {
  switch (eventType) {
    case 'COURT_HEARING': return '법원기일'
    case 'DEADLINE': return '마감일'
    case 'CONSULTATION': return '상담'
    case 'MEETING':
    case 'GENERAL_SCHEDULE': return '회의'
    default: return '일정'
  }
}

export const EventPopup = memo(EventPopupComponent)
export default EventPopup
