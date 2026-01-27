'use client'

import { useState } from 'react'
import { getCourtAbbrev } from '@/lib/scourt/court-codes'

interface RelatedCaseInfo {
  case_number: string         // "2025가소6582"
  court_name: string          // "수원지방법원 평택지원"
  relation_type: string       // "이의신청", "반소", "항소심" 등
  scourt_enc_cs_no?: string   // SCOURT 암호화된 사건번호 (encCsNo)
}

interface RelatedCaseConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (action: 'create' | 'skip', relatedCase: RelatedCaseInfo) => void
  sourceCaseId: string
  sourceCaseName: string    // 현재 사건 표시용
  relatedCases: RelatedCaseInfo[]  // SCOURT에서 발견된 연관사건들
  loading?: boolean
}

export default function RelatedCaseConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  sourceCaseId: _sourceCaseId,
  sourceCaseName,
  relatedCases,
  loading = false
}: RelatedCaseConfirmModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedAction, setSelectedAction] = useState<'create' | 'skip'>('create')
  const [_processedCount, setProcessedCount] = useState(0)

  if (!isOpen || relatedCases.length === 0) return null

  const currentCase = relatedCases[currentIndex]
  const isLastCase = currentIndex === relatedCases.length - 1
  const progress = `${currentIndex + 1} / ${relatedCases.length}`

  const handleConfirm = () => {
    onConfirm(selectedAction, currentCase)
    setProcessedCount(prev => prev + 1)

    if (!isLastCase) {
      setCurrentIndex(prev => prev + 1)
      setSelectedAction('create')  // Reset selection for next case
    } else {
      // All cases processed
      onClose()
    }
  }

  const handleSkipAll = () => {
    // Skip all remaining cases
    onClose()
  }

  // 연관관계 타입에 따른 배지 색상
  const getRelationBadgeColor = (relationType: string) => {
    if (['항소심', '상고심', '하심사건'].includes(relationType)) {
      return 'bg-[var(--color-info-muted)] text-[var(--color-info)]'  // 심급 관계
    }
    if (['반소', '병합'].includes(relationType)) {
      return 'bg-purple-100 text-purple-800'  // 관련 본안
    }
    if (['본안사건', '신청사건'].includes(relationType)) {
      return 'bg-[var(--color-success-muted)] text-[var(--color-success)]'  // 본안/보전 관계
    }
    return 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)]'  // 기타
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-lg transform rounded-xl bg-[var(--bg-secondary)] shadow-2xl transition-all">
          {/* Header */}
          <div className="border-b border-[var(--border-subtle)] px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                  연관사건 발견
                </h3>
                <p className="mt-1 text-sm text-[var(--text-muted)]">
                  SCOURT에서 연관사건을 발견했습니다
                </p>
              </div>
              <span className="text-sm text-[var(--text-muted)]">{progress}</span>
            </div>
          </div>

          {/* Body */}
          <div className="px-6 py-5">
            {/* Source case info */}
            <div className="mb-4 rounded-lg bg-[var(--bg-tertiary)] p-3">
              <p className="text-xs text-[var(--text-muted)] mb-1">현재 사건</p>
              <p className="text-sm font-medium text-[var(--text-primary)]">{sourceCaseName}</p>
            </div>

            {/* Related case info */}
            <div className="mb-6 rounded-lg border-2 border-[var(--sage-primary)]/30 bg-[var(--sage-muted)] p-4">
              <div className="flex items-start justify-between mb-3">
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getRelationBadgeColor(currentCase.relation_type)}`}>
                  {currentCase.relation_type}
                </span>
              </div>
              <p className="text-lg font-semibold text-[var(--text-primary)] mb-1">
                {currentCase.case_number}
              </p>
              <p className="text-sm text-[var(--text-secondary)]">
                {getCourtAbbrev(currentCase.court_name)}
              </p>
            </div>

            {/* Action selection */}
            <div className="space-y-3">
              <label className="flex items-center gap-3 p-3 rounded-lg border border-[var(--border-default)] cursor-pointer hover:bg-[var(--bg-hover)] transition-colors">
                <input
                  type="radio"
                  name="action"
                  value="create"
                  checked={selectedAction === 'create'}
                  onChange={() => setSelectedAction('create')}
                  className="h-4 w-4 accent-[var(--sage-primary)]"
                />
                <div>
                  <p className="text-sm font-medium text-[var(--text-primary)]">
                    새 사건으로 등록하고 연결
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">
                    시스템에 새 사건을 등록하고 현재 사건과 연결합니다
                  </p>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 rounded-lg border border-[var(--border-default)] cursor-pointer hover:bg-[var(--bg-hover)] transition-colors">
                <input
                  type="radio"
                  name="action"
                  value="skip"
                  checked={selectedAction === 'skip'}
                  onChange={() => setSelectedAction('skip')}
                  className="h-4 w-4 accent-[var(--sage-primary)]"
                />
                <div>
                  <p className="text-sm font-medium text-[var(--text-primary)]">
                    연결하지 않음
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">
                    이 연관사건은 건너뜁니다
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-[var(--border-subtle)] px-6 py-4">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={handleSkipAll}
                className="text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
              >
                모두 건너뛰기
              </button>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="btn btn-secondary"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={loading}
                  className="btn btn-primary"
                >
                  {loading ? '처리 중...' : isLastCase ? '완료' : '다음'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
