'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import UnifiedScheduleModal from '@/components/UnifiedScheduleModal'
import CasePaymentsModal from '@/components/CasePaymentsModal'
import { formatCurrency } from '@/types/payment'

interface Client {
  id: string
  name: string
}

interface LegalCase {
  id: string
  contract_number: string
  case_name: string
  case_type: string | null
  client_id: string
  status: '진행중' | '종결'
  assigned_to?: string
  assigned_member?: {
    id: string
    display_name: string
    role: string
  }
  contract_date: string
  court_case_number: string | null
  client?: Client
  payment_info?: {
    total_amount: number
    payment_count: number
  }
}

interface CasesSummary {
  total_count: number
  active_count: number
  closed_count: number
}

export default function CasesPage() {
  const router = useRouter()
  const [cases, setCases] = useState<LegalCase[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | '진행중' | '종결'>('진행중')

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const casesPerPage = 30

  // Modals
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [selectedCaseNumber, setSelectedCaseNumber] = useState<string | undefined>(undefined)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [selectedCaseForPayment, setSelectedCaseForPayment] = useState<LegalCase | null>(null)

  const fetchCases = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/cases')
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setCases(json.cases || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : '조회 실패')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCases()
  }, [fetchCases])

  // Summary calculations
  const summary: CasesSummary = useMemo(() => {
    return {
      total_count: cases.length,
      active_count: cases.filter(c => c.status === '진행중').length,
      closed_count: cases.filter(c => c.status === '종결').length,
    }
  }, [cases])

  // Filtered cases
  const filteredCases = useMemo(() => {
    let filtered = [...cases]

    if (statusFilter !== 'all') {
      filtered = filtered.filter(c => c.status === statusFilter)
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(c =>
        c.contract_number?.toLowerCase().includes(term) ||
        c.case_name?.toLowerCase().includes(term) ||
        c.client?.name?.toLowerCase().includes(term) ||
        c.court_case_number?.toLowerCase().includes(term)
      )
    }

    return filtered
  }, [cases, statusFilter, searchTerm])

  // Pagination
  const indexOfLastCase = currentPage * casesPerPage
  const indexOfFirstCase = indexOfLastCase - casesPerPage
  const currentCases = filteredCases.slice(indexOfFirstCase, indexOfLastCase)
  const totalPages = Math.ceil(filteredCases.length / casesPerPage)

  const handleAddSchedule = (e: React.MouseEvent, caseNumber: string | null) => {
    e.stopPropagation()
    if (!caseNumber) {
      alert('사건번호가 등록되지 않은 사건입니다.')
      return
    }
    setSelectedCaseNumber(caseNumber)
    setShowScheduleModal(true)
  }

  const handleOpenPaymentModal = (e: React.MouseEvent, legalCase: LegalCase) => {
    e.stopPropagation()
    setSelectedCaseForPayment(legalCase)
    setShowPaymentModal(true)
  }

  const handlePaymentAdded = () => {
    setShowPaymentModal(false)
    setSelectedCaseForPayment(null)
    fetchCases()
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-'
    const date = new Date(dateStr)
    const year = String(date.getFullYear()).slice(2)
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}.${month}.${day}`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[var(--bg-primary)]">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-[var(--border-default)] border-t-[var(--sage-primary)]"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <div className="max-w-6xl mx-auto pt-6 pb-8 px-4">
        {/* Summary */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-6 text-sm">
            <div>
              <span className="text-[var(--text-tertiary)]">전체</span>
              <span className="ml-2 text-lg font-bold text-[var(--text-primary)]">{summary.total_count}건</span>
            </div>
            <div className="text-[var(--border-default)]">|</div>
            <div className="flex items-center gap-3">
              <span className="px-2 py-0.5 text-xs bg-[var(--sage-muted)] text-[var(--sage-primary)] rounded">
                진행 {summary.active_count}
              </span>
              <span className="px-2 py-0.5 text-xs bg-[var(--bg-tertiary)] text-[var(--text-secondary)] rounded">
                종결 {summary.closed_count}
              </span>
            </div>
          </div>
          <button
            onClick={() => router.push('/cases/new')}
            className="btn btn-primary px-4 py-2 text-sm font-medium"
          >
            + 사건 추가
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-4 text-sm">
          {/* Search */}
          <div className="flex-1 min-w-[200px] max-w-md">
            <input
              type="text"
              placeholder="사건명, 의뢰인, 사건번호 검색..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value)
                setCurrentPage(1)
              }}
              className="form-input w-full px-3 py-2 text-sm"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as 'all' | '진행중' | '종결')
              setCurrentPage(1)
            }}
            className="form-input px-3 py-2 text-sm"
          >
            <option value="all">전체 상태</option>
            <option value="진행중">진행중</option>
            <option value="종결">종결</option>
          </select>

        </div>

        {error && <div className="text-sm text-[var(--color-danger)] mb-4">{error}</div>}

        {/* Cases List */}
        <div className="card">
          {!filteredCases.length ? (
            <div className="py-12 text-center text-[var(--text-muted)] text-sm">
              {searchTerm ? '검색 결과가 없습니다' : '등록된 사건이 없습니다'}
            </div>
          ) : (
            <>
              {/* Table Header */}
              <div className="hidden md:grid grid-cols-12 gap-2 px-4 py-2 bg-[var(--bg-primary)] border-b border-[var(--border-default)] text-xs text-[var(--text-tertiary)] font-medium">
                <div className="col-span-1 text-center">계약일</div>
                <div className="col-span-1 text-center">담당자</div>
                <div className="col-span-1 text-center">의뢰인</div>
                <div className="col-span-3">사건명</div>
                <div className="col-span-2">사건번호</div>
                <div className="col-span-1 text-center">상태</div>
                <div className="col-span-1 text-right">입금액</div>
                <div className="col-span-2 text-center">액션</div>
              </div>

              {/* Table Body */}
              <div className="divide-y divide-[var(--border-subtle)]">
                {currentCases.map((legalCase) => (
                  <div
                    key={legalCase.id}
                    onClick={() => router.push(`/cases/${legalCase.id}`)}
                    className="grid grid-cols-1 md:grid-cols-12 gap-2 px-4 py-3 hover:bg-[var(--bg-hover)] cursor-pointer transition-colors items-center"
                  >
                    {/* Mobile Layout */}
                    <div className="md:hidden space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="px-1.5 py-0.5 text-xs rounded bg-indigo-50 text-indigo-700">
                            {legalCase.assigned_member?.display_name || '-'}
                          </span>
                          <span className="text-xs text-[var(--text-tertiary)]">{formatDate(legalCase.contract_date)}</span>
                        </div>
                        <span className={`px-1.5 py-0.5 text-xs rounded ${
                          legalCase.status === '진행중' ? 'bg-[var(--sage-muted)] text-[var(--sage-primary)]' : 'bg-[var(--bg-tertiary)] text-[var(--text-tertiary)]'
                        }`}>
                          {legalCase.status}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-[var(--text-primary)]">{legalCase.case_name}</p>
                        <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
                          {legalCase.client?.name || '-'}
                          {legalCase.court_case_number && ` | ${legalCase.court_case_number}`}
                        </p>
                      </div>
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-xs text-[var(--text-secondary)]">
                          입금: {formatCurrency(legalCase.payment_info?.total_amount || 0)}
                        </span>
                        <div className="flex gap-2">
                          <button
                            onClick={(e) => handleOpenPaymentModal(e, legalCase)}
                            className="btn btn-primary px-2 py-1 text-xs"
                          >
                            입금
                          </button>
                          <button
                            onClick={(e) => handleAddSchedule(e, legalCase.court_case_number)}
                            disabled={!legalCase.court_case_number}
                            className={`px-2 py-1 text-xs rounded ${
                              legalCase.court_case_number
                                ? 'btn btn-primary'
                                : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)] cursor-not-allowed'
                            }`}
                          >
                            기일
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Desktop Layout */}
                    <div className="hidden md:block col-span-1 text-center text-xs text-[var(--text-secondary)]">
                      {formatDate(legalCase.contract_date)}
                    </div>
                    <div className="hidden md:block col-span-1 text-center">
                      <span className="px-1.5 py-0.5 text-xs rounded bg-indigo-50 text-indigo-700">
                        {legalCase.assigned_member?.display_name || '-'}
                      </span>
                    </div>
                    <div className="hidden md:block col-span-1 text-center text-sm font-medium text-[var(--text-primary)] truncate">
                      {legalCase.client?.name || '-'}
                    </div>
                    <div className="hidden md:block col-span-3 text-sm text-[var(--text-primary)] truncate">
                      {legalCase.case_name}
                    </div>
                    <div className="hidden md:block col-span-2 text-xs text-[var(--text-tertiary)] truncate">
                      {legalCase.court_case_number || '-'}
                    </div>
                    <div className="hidden md:block col-span-1 text-center">
                      <span className={`px-1.5 py-0.5 text-xs rounded ${
                        legalCase.status === '진행중' ? 'bg-[var(--sage-muted)] text-[var(--sage-primary)]' : 'bg-[var(--bg-tertiary)] text-[var(--text-tertiary)]'
                      }`}>
                        {legalCase.status}
                      </span>
                    </div>
                    <div className="hidden md:block col-span-1 text-right text-xs font-medium text-[var(--text-secondary)]">
                      {formatCurrency(legalCase.payment_info?.total_amount || 0)}
                    </div>
                    <div className="hidden md:flex col-span-2 justify-center gap-2">
                      <button
                        onClick={(e) => handleOpenPaymentModal(e, legalCase)}
                        className="btn btn-primary px-2 py-1 text-xs"
                      >
                        입금
                      </button>
                      <button
                        onClick={(e) => handleAddSchedule(e, legalCase.court_case_number)}
                        disabled={!legalCase.court_case_number}
                        className={`px-2 py-1 text-xs rounded transition-colors ${
                          legalCase.court_case_number
                            ? 'btn btn-primary'
                            : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)] cursor-not-allowed'
                        }`}
                      >
                        기일
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="px-4 py-3 border-t border-[var(--border-subtle)] flex items-center justify-between">
                  <span className="text-xs text-[var(--text-tertiary)]">
                    {indexOfFirstCase + 1}-{Math.min(indexOfLastCase, filteredCases.length)} / {filteredCases.length}건
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="px-2 py-1 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] rounded disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      이전
                    </button>
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum
                      if (totalPages <= 5) {
                        pageNum = i + 1
                      } else if (currentPage <= 3) {
                        pageNum = i + 1
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i
                      } else {
                        pageNum = currentPage - 2 + i
                      }
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`px-2 py-1 text-xs rounded ${
                            currentPage === pageNum
                              ? 'bg-[var(--sage-primary)] text-white'
                              : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
                          }`}
                        >
                          {pageNum}
                        </button>
                      )
                    })}
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      className="px-2 py-1 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] rounded disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      다음
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Schedule Modal */}
      <UnifiedScheduleModal
        isOpen={showScheduleModal}
        onClose={() => {
          setShowScheduleModal(false)
          setSelectedCaseNumber(undefined)
        }}
        onSuccess={() => {
          setShowScheduleModal(false)
          setSelectedCaseNumber(undefined)
        }}
        prefilledCaseNumber={selectedCaseNumber}
      />

      {/* Payment Modal */}
      {selectedCaseForPayment && (
        <CasePaymentsModal
          isOpen={showPaymentModal}
          onClose={() => {
            setShowPaymentModal(false)
            setSelectedCaseForPayment(null)
          }}
          caseId={selectedCaseForPayment.id}
          caseName={selectedCaseForPayment.case_name}
          clientName={selectedCaseForPayment.client?.name}
          onPaymentAdded={handlePaymentAdded}
        />
      )}
    </div>
  )
}
