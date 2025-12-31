'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import AdminHeader from './AdminHeader'
import UnifiedScheduleModal from './UnifiedScheduleModal'
import CasePaymentsModal from './CasePaymentsModal'

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
  office: '평택' | '천안' | '소송구조'
  contract_date: string
  court_case_number: string | null
  onedrive_folder_url: string | null
  client?: Client
  payment_info?: {
    total_amount: number
    payment_count: number
  }
}

export default function CasesList({ initialCases }: { initialCases: LegalCase[] }) {
  const cases = initialCases
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | '진행중' | '종결'>('진행중')
  const [officeFilter, setOfficeFilter] = useState<'all' | '평택' | '천안' | '소송구조'>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [casesPerPage, setCasesPerPage] = useState(50)
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [selectedCaseNumber, setSelectedCaseNumber] = useState<string | undefined>(undefined)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [selectedCaseForPayment, setSelectedCaseForPayment] = useState<LegalCase | null>(null)
  const router = useRouter()

  const filteredCases = useMemo(() => {
    let filtered = [...cases]

    if (statusFilter !== 'all') {
      filtered = filtered.filter(c => c.status === statusFilter)
    }

    if (officeFilter !== 'all') {
      filtered = filtered.filter(c => c.office === officeFilter)
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(c =>
        c.contract_number?.toLowerCase().includes(term) ||
        c.case_name?.toLowerCase().includes(term) ||
        c.client?.name?.toLowerCase().includes(term)
      )
    }

    return filtered
  }, [cases, officeFilter, searchTerm, statusFilter])

  const indexOfLastCase = currentPage * casesPerPage
  const indexOfFirstCase = indexOfLastCase - casesPerPage
  const currentCases = filteredCases.slice(indexOfFirstCase, indexOfLastCase)
  const totalPages = Math.ceil(filteredCases.length / casesPerPage)

  const getStatusStyle = (status: string) => {
    return status === '진행중'
      ? 'bg-sage-100 text-sage-700'
      : 'bg-gray-100 text-gray-600'
  }

  const getOfficeStyle = (office: string) => {
    switch (office) {
      case '평택': return 'bg-blue-50 text-blue-700'
      case '천안': return 'bg-purple-50 text-purple-700'
      case '소송구조': return 'bg-amber-50 text-amber-700'
      default: return 'bg-gray-100 text-gray-600'
    }
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-'
    const date = new Date(dateStr)
    const year = String(date.getFullYear()).slice(2)
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}.${month}.${day}`
  }

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
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader title="사건 관리" />

      <div className="max-w-6xl mx-auto pt-20 pb-8 px-4">
        {/* Summary */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-4 text-sm">
            <span className="text-gray-500">총 {filteredCases.length}건</span>
          </div>
          <button
            onClick={() => router.push('/cases/new')}
            className="px-4 py-2 text-sm font-medium text-white bg-sage-600 rounded-lg hover:bg-sage-700 transition-colors"
          >
            + 사건 추가
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-4 text-sm">
          <input
            type="text"
            placeholder="계약번호, 사건명, 의뢰인..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value)
              setCurrentPage(1)
            }}
            className="px-3 py-1.5 border border-gray-200 rounded bg-white text-sm w-64 focus:outline-none focus:ring-1 focus:ring-sage-500"
          />

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as 'all' | '진행중' | '종결')
              setCurrentPage(1)
            }}
            className="px-2 py-1.5 border border-gray-200 rounded bg-white text-sm"
          >
            <option value="all">전체 상태</option>
            <option value="진행중">진행중</option>
            <option value="종결">종결</option>
          </select>

          <select
            value={officeFilter}
            onChange={(e) => {
              setOfficeFilter(e.target.value as 'all' | '평택' | '천안' | '소송구조')
              setCurrentPage(1)
            }}
            className="px-2 py-1.5 border border-gray-200 rounded bg-white text-sm"
          >
            <option value="all">전체 지점</option>
            <option value="평택">평택</option>
            <option value="천안">천안</option>
            <option value="소송구조">소송구조</option>
          </select>
        </div>

        {/* Cases Table */}
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium">계약일</th>
                  <th className="px-4 py-2.5 text-left font-medium">유형</th>
                  <th className="px-4 py-2.5 text-left font-medium">의뢰인</th>
                  <th className="px-4 py-2.5 text-left font-medium">사건명</th>
                  <th className="px-4 py-2.5 text-center font-medium">지점</th>
                  <th className="px-4 py-2.5 text-center font-medium">상태</th>
                  <th className="px-4 py-2.5 text-center font-medium">액션</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {currentCases.map((legalCase) => (
                  <tr
                    key={legalCase.id}
                    onClick={() => router.push(`/cases/${legalCase.id}`)}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 text-gray-600">
                      {formatDate(legalCase.contract_date)}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {legalCase.case_type || '-'}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {legalCase.client?.name || '-'}
                    </td>
                    <td className="px-4 py-3 text-gray-900 max-w-[300px]">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate">{legalCase.case_name}</span>
                        {legalCase.onedrive_folder_url && (
                          <span className="flex-shrink-0 text-sky-500" title="OneDrive 연결됨">
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M12.5 3C9.85 3 7.45 4.35 6.15 6.5C3.25 6.7 1 9.1 1 12c0 3 2.5 5.5 5.5 5.5h12c2.5 0 4.5-2 4.5-4.5 0-2.4-1.85-4.35-4.2-4.5C17.85 5.95 15.35 3 12.5 3z"/>
                            </svg>
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded ${getOfficeStyle(legalCase.office)}`}>
                        {legalCase.office || '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded ${getStatusStyle(legalCase.status)}`}>
                        {legalCase.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={(e) => handleOpenPaymentModal(e, legalCase)}
                          className="px-2 py-1 text-xs font-medium rounded bg-sage-600 text-white hover:bg-sage-700 transition-colors"
                        >
                          입금
                        </button>
                        <button
                          onClick={(e) => handleAddSchedule(e, legalCase.court_case_number)}
                          disabled={!legalCase.court_case_number}
                          className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                            legalCase.court_case_number
                              ? 'bg-sage-600 text-white hover:bg-sage-700'
                              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                          }`}
                        >
                          기일
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Empty State */}
          {currentCases.length === 0 && (
            <div className="py-12 text-center text-gray-400">
              검색 결과가 없습니다
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-4 py-3 border-t border-gray-100">
              <div className="flex items-center justify-between">
                <div className="text-xs text-gray-500">
                  {indexOfFirstCase + 1}-{Math.min(indexOfLastCase, filteredCases.length)} / {filteredCases.length}건
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
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
                        className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                          currentPage === pageNum
                            ? 'bg-sage-600 text-white'
                            : 'text-gray-600 bg-white border border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        {pageNum}
                      </button>
                    )
                  })}
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    다음
                  </button>
                </div>
              </div>

              {/* Per Page */}
              <div className="flex items-center justify-center gap-2 mt-3 pt-3 border-t border-gray-100">
                <span className="text-xs text-gray-500">페이지당:</span>
                {[50, 100].map((num) => (
                  <button
                    key={num}
                    onClick={() => {
                      setCasesPerPage(num)
                      setCurrentPage(1)
                    }}
                    className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                      casesPerPage === num
                        ? 'bg-sage-600 text-white'
                        : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    {num}건
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Unified Schedule Modal */}
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
          officeLocation={selectedCaseForPayment.office}
          onPaymentAdded={handlePaymentAdded}
        />
      )}
    </div>
  )
}
