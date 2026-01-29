'use client'

import { useState, useEffect } from 'react'
import { getCourtAbbrev } from '@/lib/scourt/court-codes'

interface RelatedCaseInfo {
  caseNo: string          // "2025가소6582"
  courtName: string       // "수원지방법원 평택지원"
  relationType: string    // "이의신청", "반소", "항소심" 등
  encCsNo?: string        // SCOURT 암호화된 사건번호
}

interface GeneralInfo {
  caseName?: string
  courtName?: string
  status?: string
  receiptDate?: string
  judge?: string
  division?: string
  parties?: Array<{
    name: string
    type: string
    role?: string
  }>
}

interface ProgressEvent {
  date: string
  event: string
  result?: string
}

interface RelatedCasePreviewModalProps {
  isOpen: boolean
  onClose: () => void
  relatedCaseInfo: RelatedCaseInfo
  sourceCaseId: string      // Source case ID for API call
  onLink: () => void        // Trigger linking
  onDismiss: () => void     // Dismiss (연동안함)
}

export default function RelatedCasePreviewModal({
  isOpen,
  onClose,
  relatedCaseInfo,
  sourceCaseId,
  onLink,
  onDismiss
}: RelatedCasePreviewModalProps) {
  const [activeTab, setActiveTab] = useState<'general' | 'progress'>('general')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [generalInfo, setGeneralInfo] = useState<GeneralInfo | null>(null)
  const [progress, setProgress] = useState<ProgressEvent[]>([])

  useEffect(() => {
    if (isOpen && relatedCaseInfo.encCsNo) {
      fetchPreviewData()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, relatedCaseInfo.encCsNo])

  const fetchPreviewData = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/admin/scourt/preview-related', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          encCsNo: relatedCaseInfo.encCsNo,
          caseNo: relatedCaseInfo.caseNo,
          courtName: relatedCaseInfo.courtName,
          sourceCaseId,
        })
      })
      const data = await response.json()
      if (data.success) {
        setGeneralInfo(data.generalInfo || {})
        setProgress(data.progress || [])
      } else {
        setError(data.error || '데이터를 불러올 수 없습니다')
      }
    } catch {
      setError('네트워크 오류가 발생했습니다')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  // 연관관계 타입에 따른 배지 색상 (RelatedCaseConfirmModal과 동일)
  const getRelationBadgeColor = (relationType: string) => {
    if (['항소심', '상고심', '하심사건'].includes(relationType)) {
      return 'bg-[var(--color-info-muted)] text-[var(--color-info)]'  // 심급 관계
    }
    if (['반소', '병합'].includes(relationType)) {
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'  // 관련 본안
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
        <div className="relative w-full max-w-2xl transform rounded-xl bg-[var(--bg-secondary)] shadow-2xl transition-all">
          {/* Header */}
          <div className="border-b border-[var(--border-subtle)] px-6 py-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                    {relatedCaseInfo.caseNo}
                  </h3>
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getRelationBadgeColor(relatedCaseInfo.relationType)}`}>
                    {relatedCaseInfo.relationType}
                  </span>
                </div>
                <p className="text-sm text-[var(--text-muted)]">
                  {getCourtAbbrev(relatedCaseInfo.courtName)}
                </p>
              </div>
              <button
                onClick={onClose}
                className="ml-4 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="border-b border-[var(--border-subtle)] px-6">
            <div className="flex gap-6">
              <button
                onClick={() => setActiveTab('general')}
                className={`py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'general'
                    ? 'border-[var(--sage-primary)] text-[var(--sage-primary)]'
                    : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                }`}
              >
                일반
              </button>
              <button
                onClick={() => setActiveTab('progress')}
                className={`py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'progress'
                    ? 'border-[var(--sage-primary)] text-[var(--sage-primary)]'
                    : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                }`}
              >
                진행
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="px-6 py-5 min-h-[300px]">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-8 h-8 border-2 border-[var(--sage-primary)] border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm text-[var(--text-muted)]">데이터를 불러오는 중...</p>
                </div>
              </div>
            ) : error ? (
              <div className="flex items-center justify-center h-64">
                <div className="text-center">
                  <svg className="w-12 h-12 mx-auto mb-4 text-[var(--color-error)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm text-[var(--text-primary)] mb-4">{error}</p>
                  <button
                    onClick={fetchPreviewData}
                    className="btn btn-secondary text-sm"
                  >
                    다시 시도
                  </button>
                </div>
              </div>
            ) : activeTab === 'general' ? (
              <div className="space-y-4">
                {generalInfo?.caseName && (
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">사건명</label>
                    <p className="text-sm text-[var(--text-primary)]">{generalInfo.caseName}</p>
                  </div>
                )}

                {generalInfo?.courtName && (
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">법원명</label>
                    <p className="text-sm text-[var(--text-primary)]">{generalInfo.courtName}</p>
                  </div>
                )}

                {generalInfo?.status && (
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">진행상태</label>
                    <p className="text-sm text-[var(--text-primary)]">{generalInfo.status}</p>
                  </div>
                )}

                {generalInfo?.receiptDate && (
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">접수일</label>
                    <p className="text-sm text-[var(--text-primary)]">{generalInfo.receiptDate}</p>
                  </div>
                )}

                {(generalInfo?.judge || generalInfo?.division) && (
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">재판부</label>
                    <p className="text-sm text-[var(--text-primary)]">
                      {generalInfo.division && `${generalInfo.division}`}
                      {generalInfo.division && generalInfo.judge && ' - '}
                      {generalInfo.judge}
                    </p>
                  </div>
                )}

                {generalInfo?.parties && generalInfo.parties.length > 0 && (
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-muted)] mb-2">당사자 정보</label>
                    <div className="space-y-2">
                      {generalInfo.parties.map((party, index) => (
                        <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-[var(--bg-tertiary)]">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[var(--bg-secondary)] text-[var(--text-secondary)]">
                            {party.type}
                          </span>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-[var(--text-primary)]">{party.name}</p>
                            {party.role && (
                              <p className="text-xs text-[var(--text-muted)] mt-0.5">{party.role}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {!generalInfo?.caseName && !generalInfo?.courtName && !generalInfo?.status && (
                  <div className="text-center py-12">
                    <p className="text-sm text-[var(--text-muted)]">표시할 정보가 없습니다</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {progress.length > 0 ? (
                  <div className="space-y-2">
                    {progress.map((event, index) => (
                      <div key={index} className="flex gap-3 p-3 rounded-lg bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] transition-colors">
                        <div className="flex-shrink-0 w-20 text-xs text-[var(--text-muted)]">
                          {event.date}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-[var(--text-primary)]">{event.event}</p>
                          {event.result && (
                            <p className="text-xs text-[var(--text-secondary)] mt-1">{event.result}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <p className="text-sm text-[var(--text-muted)]">진행 내역이 없습니다</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-[var(--border-subtle)] px-6 py-4">
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onDismiss}
                className="btn btn-secondary"
              >
                연동안함
              </button>
              <button
                type="button"
                onClick={onLink}
                className="btn btn-primary"
              >
                연동
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
