'use client'

import { useMemo, useState } from 'react'
import type { CaseNotice } from '@/types/case-notice'
import { NOTICE_CATEGORY_ICONS, NOTICE_CATEGORY_LABELS } from '@/types/case-notice'

interface CaseNoticeSectionProps {
  notices: CaseNotice[]
  onAction?: (notice: CaseNotice, actionType: string) => void
  onDismiss?: (notice: CaseNotice) => Promise<void>
}

export default function CaseNoticeSection({ notices, onAction, onDismiss }: CaseNoticeSectionProps) {
  // 알림이 없으면 빈 상태 표시
  if (notices.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <span>알림</span>
          </h3>
        </div>
        <div className="px-5 py-8 text-center">
          <div className="text-gray-400 text-sm">
            확인이 필요한 알림이 없습니다
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <span>알림</span>
          <span className="text-xs font-normal text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
            {notices.length}건
          </span>
        </h3>
      </div>
      <div className="divide-y divide-gray-100">
        {notices.map((notice) => (
          <NoticeItem
            key={notice.id}
            notice={notice}
            onAction={onAction}
            onDismiss={onDismiss}
          />
        ))}
      </div>
    </div>
  )
}

interface NoticeItemProps {
  notice: CaseNotice
  onAction?: (notice: CaseNotice, actionType: string) => void
  onDismiss?: (notice: CaseNotice) => Promise<void>
}

function NoticeItem({ notice, onAction, onDismiss }: NoticeItemProps) {
  const [isDismissing, setIsDismissing] = useState(false)
  const icon = NOTICE_CATEGORY_ICONS[notice.category]
  const categoryLabel = NOTICE_CATEGORY_LABELS[notice.category]

  const handleDismiss = async () => {
    if (!onDismiss || isDismissing) return
    setIsDismissing(true)
    try {
      await onDismiss(notice)
    } finally {
      setIsDismissing(false)
    }
  }

  // D-day 표시
  const dDayText = useMemo(() => {
    if (notice.daysRemaining === undefined) return null
    if (notice.daysRemaining === 0) return 'D-day'
    if (notice.daysRemaining > 0) return `D-${notice.daysRemaining}`
    return `D+${Math.abs(notice.daysRemaining)}`
  }, [notice.daysRemaining])

  // D-day에 따른 배경색
  const bgColor = useMemo(() => {
    if (notice.daysRemaining === undefined) return 'bg-white'
    if (notice.daysRemaining < 0) return 'bg-red-50'
    if (notice.daysRemaining <= 3) return 'bg-amber-50'
    if (notice.daysRemaining <= 7) return 'bg-yellow-50'
    return 'bg-white'
  }, [notice.daysRemaining])

  // D-day 텍스트 색상
  const dDayColor = useMemo(() => {
    if (notice.daysRemaining === undefined) return 'text-gray-500'
    if (notice.daysRemaining < 0) return 'text-red-600 font-semibold'
    if (notice.daysRemaining <= 3) return 'text-amber-600 font-semibold'
    if (notice.daysRemaining <= 7) return 'text-yellow-600'
    return 'text-gray-500'
  }, [notice.daysRemaining])

  return (
    <div className={`px-5 py-4 ${bgColor} hover:bg-gray-50 transition-colors`}>
      <div className="flex items-start gap-3">
        {/* 아이콘 */}
        <div className="text-lg flex-shrink-0">
          {icon}
        </div>

        {/* 내용 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-gray-900">
              {notice.title}
            </span>
            {dDayText && (
              <span className={`text-xs ${dDayColor}`}>
                {dDayText}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            {notice.description}
          </p>

          {/* 기일 충돌 액션 버튼 */}
          {notice.category === 'schedule_conflict' && notice.actions && (
            <div className="flex gap-2 mt-3 flex-wrap">
              {notice.actions.map((action, idx) => (
                <button
                  key={idx}
                  onClick={() => onAction?.(notice, action.type)}
                  className={`text-xs px-3 py-1.5 rounded border transition-colors ${
                    action.type === 'dismiss'
                      ? 'border-gray-200 text-gray-600 hover:bg-gray-100'
                      : 'border-sage-200 text-sage-700 hover:bg-sage-50'
                  }`}
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 삭제 버튼 */}
        {onDismiss && (
          <button
            onClick={handleDismiss}
            disabled={isDismissing}
            className="flex-shrink-0 p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors disabled:opacity-50"
            title="알림 삭제"
          >
            {isDismissing ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
          </button>
        )}
      </div>
    </div>
  )
}
