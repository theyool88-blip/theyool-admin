'use client'

import { useMemo, useState } from 'react'
import type { CaseNotice } from '@/types/case-notice'
import { NOTICE_CATEGORY_LABELS } from '@/types/case-notice'
import { NOTICE_ICONS, NOTICE_ICON_COLORS } from '@/lib/icons/notice-icons'

interface ActionMetadata {
  opponentName?: string
}

interface CaseNoticeSectionProps {
  notices: CaseNotice[]
  onAction?: (notice: CaseNotice, actionType: string, metadata?: ActionMetadata) => void
  onDismiss?: (notice: CaseNotice) => Promise<void>
  onRelatedCasePreview?: (notice: CaseNotice) => void
}

export default function CaseNoticeSection({ notices, onAction, onDismiss, onRelatedCasePreview }: CaseNoticeSectionProps) {
  // 알림이 없으면 빈 상태 표시
  if (notices.length === 0) {
    return (
      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-[var(--border-subtle)] flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
            <span>알림</span>
          </h3>
        </div>
        <div className="px-5 py-8 text-center">
          <div className="text-[var(--text-muted)] text-sm">
            확인이 필요한 알림이 없습니다
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-3 border-b border-[var(--border-subtle)] flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
          <span>알림</span>
          <span className="text-xs font-normal text-[var(--text-tertiary)] bg-[var(--bg-tertiary)] px-1.5 py-0.5 rounded">
            {notices.length}건
          </span>
        </h3>
      </div>
      <div className="divide-y divide-[var(--border-subtle)]">
        {notices.map((notice) => (
          <NoticeItem
            key={notice.id}
            notice={notice}
            onAction={onAction}
            onDismiss={onDismiss}
            onRelatedCasePreview={onRelatedCasePreview}
          />
        ))}
      </div>
    </div>
  )
}

interface NoticeItemProps {
  notice: CaseNotice
  onAction?: (notice: CaseNotice, actionType: string, metadata?: ActionMetadata) => void
  onDismiss?: (notice: CaseNotice) => Promise<void>
  onRelatedCasePreview?: (notice: CaseNotice) => void
}

function NoticeItem({ notice, onAction, onDismiss, onRelatedCasePreview }: NoticeItemProps) {
  const [isDismissing, setIsDismissing] = useState(false)
  const [opponentNameInput, setOpponentNameInput] = useState('')
  const Icon = NOTICE_ICONS[notice.category]
  const iconColor = NOTICE_ICON_COLORS[notice.category]
  const _categoryLabel = NOTICE_CATEGORY_LABELS[notice.category]

  // 상대방 이름 미입력 여부
  const opponentNameMissing = notice.category === 'client_role_confirm' && notice.metadata?.opponentNameMissing === 'true'

  // 관련사건 프리뷰 가능 여부
  const isRelatedCase = notice.category === 'unlinked_related_case' || notice.category === 'unlinked_lower_court'

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
    if (notice.daysRemaining === undefined) return 'bg-[var(--bg-secondary)]'
    if (notice.daysRemaining < 0) return 'bg-[var(--color-danger-muted)]'
    if (notice.daysRemaining <= 3) return 'bg-[var(--color-warning-muted)]'
    if (notice.daysRemaining <= 7) return 'bg-[var(--color-warning-muted)]/50'
    return 'bg-[var(--bg-secondary)]'
  }, [notice.daysRemaining])

  // D-day 텍스트 색상
  const dDayColor = useMemo(() => {
    if (notice.daysRemaining === undefined) return 'text-[var(--text-tertiary)]'
    if (notice.daysRemaining < 0) return 'text-[var(--color-danger)] font-semibold'
    if (notice.daysRemaining <= 3) return 'text-[var(--color-warning)] font-semibold'
    if (notice.daysRemaining <= 7) return 'text-[var(--color-warning)]'
    return 'text-[var(--text-tertiary)]'
  }, [notice.daysRemaining])

  return (
    <div className={`px-5 py-4 ${bgColor} hover:bg-[var(--bg-hover)] transition-colors`}>
      <div className="flex items-start gap-3">
        {/* 아이콘 */}
        <div className="flex-shrink-0">
          <Icon className={`w-5 h-5 ${iconColor}`} />
        </div>

        {/* 내용 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {isRelatedCase && onRelatedCasePreview ? (
              <button
                onClick={() => onRelatedCasePreview(notice)}
                className="text-sm font-medium text-[var(--color-info)] hover:text-[var(--color-info)]/80 hover:underline transition-colors text-left"
              >
                {notice.title}
              </button>
            ) : (
              <span className="text-sm font-medium text-[var(--text-primary)]">
                {notice.title}
              </span>
            )}
            {dDayText && (
              <span className={`text-xs ${dDayColor}`}>
                {dDayText}
              </span>
            )}
          </div>
          <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
            {notice.description}
          </p>

          {/* 의뢰인 역할 확인 액션 버튼 */}
          {notice.category === 'client_role_confirm' && notice.actions && (
            <div className="mt-3 space-y-3">
              {/* 상대방 이름 입력 필드 (미입력 시) */}
              {opponentNameMissing && (
                <div className="flex items-center gap-2">
                  <label className="text-xs text-[var(--text-secondary)] whitespace-nowrap">상대방:</label>
                  <input
                    type="text"
                    value={opponentNameInput}
                    onChange={(e) => setOpponentNameInput(e.target.value)}
                    placeholder="상대방 이름을 입력해주세요"
                    className="form-input flex-1 text-sm px-3 py-1.5"
                  />
                </div>
              )}
              {/* 역할 확정 버튼 */}
              <div className="flex gap-2 flex-wrap">
                {notice.actions.map((action, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      const metadata: ActionMetadata = {}
                      if (opponentNameMissing && opponentNameInput.trim()) {
                        metadata.opponentName = opponentNameInput.trim()
                      }
                      onAction?.(notice, action.type, Object.keys(metadata).length > 0 ? metadata : undefined)
                    }}
                    disabled={opponentNameMissing && !opponentNameInput.trim()}
                    className={`text-xs px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                      action.type === 'confirm_plaintiff'
                        ? 'bg-[var(--color-info-muted)] text-[var(--color-info)] border border-[var(--color-info)]/20 hover:bg-[var(--color-info-muted)]/80'
                        : action.type === 'confirm_defendant'
                        ? 'bg-[var(--color-warning-muted)] text-[var(--color-warning)] border border-[var(--color-warning)]/20 hover:bg-[var(--color-warning-muted)]/80'
                        : 'border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                    }`}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 기일 충돌 액션 버튼 */}
          {notice.category === 'schedule_conflict' && notice.actions && (
            <div className="flex gap-2 mt-3 flex-wrap">
              {notice.actions.map((action, idx) => (
                <button
                  key={idx}
                  onClick={() => onAction?.(notice, action.type)}
                  className={`text-xs px-3 py-1.5 rounded border transition-colors ${
                    action.type === 'dismiss'
                      ? 'border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                      : 'border-[var(--sage-primary)]/20 text-[var(--sage-primary)] hover:bg-[var(--sage-muted)]'
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
            className="flex-shrink-0 p-1.5 text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] rounded transition-colors disabled:opacity-50"
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
