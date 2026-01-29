'use client'

import { useState, useEffect, useMemo } from 'react'
import { getCourtAbbrev } from '@/lib/scourt/court-codes'
import ScourtGeneralInfoXml from './scourt/ScourtGeneralInfoXml'
import type { ScourtCaseType } from '@/lib/scourt/xml-mapping'

interface RelatedCaseInfo {
  caseNo: string          // "2025가소6582"
  courtName: string       // "수원지방법원 평택지원"
  relationType: string    // "이의신청", "반소", "항소심" 등
  encCsNo?: string        // SCOURT 암호화된 사건번호
}

interface ProgressItem {
  date: string
  content: string
  result?: string | null
  progCttDvs?: string  // 진행구분 코드: 0=법원, 1=기일, 2=명령, 3=제출, 4=송달
}

interface RelatedCasePreviewModalProps {
  isOpen: boolean
  onClose: () => void
  relatedCaseInfo: RelatedCaseInfo
  sourceCaseId: string      // Source case ID for API call
  onLink: () => void        // Trigger linking
}

// 진행 카테고리별 색상 (CaseDetail과 동일)
const getProgressColor = (item: ProgressItem): string => {
  const category = getProgressCategory(item)
  switch (category) {
    case 'hearing': return '#003399'    // 기일 - 파랑
    case 'order': return '#336633'      // 명령 - 녹색
    case 'submit': return '#660000'     // 제출 - 진빨강
    case 'delivery': return '#CC6600'   // 송달 - 주황
    case 'court': return '#000000'      // 법원 - 검정
    default: return 'var(--text-primary)'
  }
}

// 진행 카테고리 판단 (CaseDetail과 동일)
const getProgressCategory = (item: ProgressItem): string => {
  // SCOURT 진행구분 코드 기반
  if (item.progCttDvs === '1') return 'hearing'   // 기일
  if (item.progCttDvs === '2') return 'order'     // 명령
  if (item.progCttDvs === '3') return 'submit'    // 제출
  if (item.progCttDvs === '4') return 'delivery'  // 송달
  if (item.progCttDvs === '0') return 'court'     // 법원
  return 'court'
}

// 날짜 포맷 (YYYYMMDD -> YY.MM.DD)
const formatProgressDate = (dateStr: string): string => {
  if (!dateStr) return '-'
  // YYYY-MM-DD 형식인 경우
  if (dateStr.includes('-')) {
    const [year, month, day] = dateStr.split('-')
    return `${year.slice(2)}.${month}.${day}`
  }
  // YYYYMMDD 형식인 경우
  if (dateStr.length === 8) {
    return `${dateStr.slice(2, 4)}.${dateStr.slice(4, 6)}.${dateStr.slice(6, 8)}`
  }
  return dateStr
}

export default function RelatedCasePreviewModal({
  isOpen,
  onClose,
  relatedCaseInfo,
  sourceCaseId,
  onLink,
}: RelatedCasePreviewModalProps) {
  const [activeTab, setActiveTab] = useState<'general' | 'progress'>('general')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rawData, setRawData] = useState<Record<string, unknown> | null>(null)
  const [caseType, setCaseType] = useState<ScourtCaseType>('ssgo101')
  const [progress, setProgress] = useState<ProgressItem[]>([])

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
        setRawData(data.rawData || null)
        setCaseType((data.caseType as ScourtCaseType) || 'ssgo101')
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

  // 진행 카테고리별 카운트
  const progressCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: progress.length,
      hearing: 0,
      order: 0,
      submit: 0,
      delivery: 0,
      court: 0,
    }
    progress.forEach(item => {
      const cat = getProgressCategory(item)
      if (counts[cat] !== undefined) counts[cat]++
    })
    return counts
  }, [progress])

  if (!isOpen) return null

  // 연관관계 타입에 따른 배지 색상
  const getRelationBadgeColor = (relationType: string) => {
    if (['항소심', '상고심', '하심사건'].includes(relationType)) {
      return 'bg-[var(--color-info-muted)] text-[var(--color-info)]'
    }
    if (['반소', '병합'].includes(relationType)) {
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
    }
    if (['본안사건', '신청사건'].includes(relationType)) {
      return 'bg-[var(--color-success-muted)] text-[var(--color-success)]'
    }
    return 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)]'
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
        <div className="relative w-full max-w-3xl transform rounded-xl bg-[var(--bg-secondary)] shadow-2xl transition-all">
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
          <div className="px-6 py-5 min-h-[400px] max-h-[60vh] overflow-y-auto">
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
              // 일반 탭 - ScourtGeneralInfoXml 사용
              rawData ? (
                <ScourtGeneralInfoXml
                  apiData={rawData as { dma_csBasCtt?: Record<string, unknown>; [key: string]: unknown }}
                  caseType={caseType}
                  caseNumber={relatedCaseInfo.caseNo}
                  compact={true}
                />
              ) : (
                <div className="text-center py-12">
                  <p className="text-sm text-[var(--text-muted)]">일반내용 데이터가 없습니다</p>
                </div>
              )
            ) : (
              // 진행 탭 - CaseDetail과 동일한 형식
              progress.length > 0 ? (
                <>
                  {/* 필터 탭 */}
                  <div className="flex flex-wrap gap-2 mb-5">
                    {[
                      { key: 'all', label: '전체', color: undefined },
                      { key: 'hearing', label: '기일', color: '#003399' },
                      { key: 'order', label: '명령', color: '#336633' },
                      { key: 'submit', label: '제출', color: '#660000' },
                      { key: 'delivery', label: '송달', color: '#CC6600' },
                      { key: 'court', label: '법원', color: '#000000' },
                    ].map((tab) => {
                      const count = progressCounts[tab.key] || 0
                      if (tab.key !== 'all' && count === 0) return null

                      return (
                        <span
                          key={tab.key}
                          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-[var(--bg-tertiary)] text-[var(--text-secondary)]"
                          style={tab.color ? { color: tab.color } : {}}
                        >
                          {tab.label}
                          <span className="ml-1 text-[var(--text-muted)]">{count}</span>
                        </span>
                      )
                    })}
                  </div>

                  {/* 진행내용 테이블 */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[var(--border-default)]">
                          <th className="px-4 py-2.5 text-left text-[var(--text-tertiary)] font-medium w-24">
                            일자
                          </th>
                          <th className="px-4 py-2.5 text-left text-[var(--text-tertiary)] font-medium">
                            내용
                          </th>
                          <th className="px-4 py-2.5 text-left text-[var(--text-tertiary)] font-medium w-24">
                            결과
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {progress.slice(0, 20).map((item, idx) => {
                          const textColor = getProgressColor(item)
                          return (
                            <tr
                              key={idx}
                              className="border-b border-[var(--border-subtle)] last:border-0"
                            >
                              <td
                                className="px-4 py-3 font-medium whitespace-nowrap"
                                style={{ color: textColor }}
                              >
                                {formatProgressDate(item.date)}
                              </td>
                              <td
                                className="px-4 py-3 leading-relaxed"
                                style={{ color: textColor }}
                              >
                                {item.content || '-'}
                              </td>
                              <td
                                className="px-4 py-3"
                                style={{ color: textColor }}
                              >
                                {item.result ? formatProgressDate(item.result) : '-'}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                    {progress.length > 20 && (
                      <div className="py-3 text-center text-sm text-[var(--text-muted)]">
                        + {progress.length - 20}건 더 있음
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="text-center py-12">
                  <p className="text-sm text-[var(--text-muted)]">진행 내역이 없습니다</p>
                </div>
              )
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-[var(--border-subtle)] px-6 py-4">
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="btn btn-secondary"
              >
                닫기
              </button>
              <button
                type="button"
                onClick={onLink}
                className="btn btn-primary"
              >
                등록
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
