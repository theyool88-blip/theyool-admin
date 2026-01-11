'use client'

import { useState } from 'react'
import { getCourtAbbrev } from '@/lib/scourt/court-codes'

interface RelatedCaseInfo {
  case_number: string       // "2025가소6582"
  court_name: string        // "수원지방법원 평택지원"
  relation_type: string     // "이의신청", "반소", "항소심" 등
  enc_cs_no?: string        // SCOURT encCsNo
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
      return 'bg-blue-100 text-blue-800'  // 심급 관계
    }
    if (['반소', '병합'].includes(relationType)) {
      return 'bg-purple-100 text-purple-800'  // 관련 본안
    }
    if (['본안사건', '신청사건'].includes(relationType)) {
      return 'bg-green-100 text-green-800'  // 본안/보전 관계
    }
    return 'bg-gray-100 text-gray-800'  // 기타
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
        <div className="relative w-full max-w-lg transform rounded-xl bg-white shadow-2xl transition-all">
          {/* Header */}
          <div className="border-b border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  연관사건 발견
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  SCOURT에서 연관사건을 발견했습니다
                </p>
              </div>
              <span className="text-sm text-gray-400">{progress}</span>
            </div>
          </div>

          {/* Body */}
          <div className="px-6 py-5">
            {/* Source case info */}
            <div className="mb-4 rounded-lg bg-gray-50 p-3">
              <p className="text-xs text-gray-500 mb-1">현재 사건</p>
              <p className="text-sm font-medium text-gray-900">{sourceCaseName}</p>
            </div>

            {/* Related case info */}
            <div className="mb-6 rounded-lg border-2 border-sage-200 bg-sage-50 p-4">
              <div className="flex items-start justify-between mb-3">
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getRelationBadgeColor(currentCase.relation_type)}`}>
                  {currentCase.relation_type}
                </span>
              </div>
              <p className="text-lg font-semibold text-gray-900 mb-1">
                {currentCase.case_number}
              </p>
              <p className="text-sm text-gray-600">
                {getCourtAbbrev(currentCase.court_name)}
              </p>
            </div>

            {/* Action selection */}
            <div className="space-y-3">
              <label className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-gray-50 transition-colors">
                <input
                  type="radio"
                  name="action"
                  value="create"
                  checked={selectedAction === 'create'}
                  onChange={() => setSelectedAction('create')}
                  className="h-4 w-4 text-sage-600 focus:ring-sage-500"
                />
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    새 사건으로 등록하고 연결
                  </p>
                  <p className="text-xs text-gray-500">
                    시스템에 새 사건을 등록하고 현재 사건과 연결합니다
                  </p>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-gray-50 transition-colors">
                <input
                  type="radio"
                  name="action"
                  value="skip"
                  checked={selectedAction === 'skip'}
                  onChange={() => setSelectedAction('skip')}
                  className="h-4 w-4 text-sage-600 focus:ring-sage-500"
                />
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    연결하지 않음
                  </p>
                  <p className="text-xs text-gray-500">
                    이 연관사건은 건너뜁니다
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={handleSkipAll}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                모두 건너뛰기
              </button>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={loading}
                  className="px-4 py-2 text-sm font-medium text-white bg-sage-600 rounded-lg hover:bg-sage-700 disabled:opacity-50 disabled:cursor-not-allowed"
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
