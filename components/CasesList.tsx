'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import UnifiedScheduleModal from './UnifiedScheduleModal'

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
  client?: Client
}

interface Profile {
  id: string
  name: string
  email: string
  role: string
}

export default function CasesList({ profile, initialCases }: { profile: Profile, initialCases: LegalCase[] }) {
  const [cases] = useState<LegalCase[]>(initialCases)
  const [filteredCases, setFilteredCases] = useState<LegalCase[]>(initialCases)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | '진행중' | '종결'>('all')
  const [officeFilter, setOfficeFilter] = useState<'all' | '평택' | '천안' | '소송구조'>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [casesPerPage, setCasesPerPage] = useState(50)
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [selectedCaseNumber, setSelectedCaseNumber] = useState<string | undefined>(undefined)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    filterCases()
  }, [searchTerm, statusFilter, officeFilter])

  const filterCases = () => {
    let filtered = [...cases]

    // 상태 필터
    if (statusFilter !== 'all') {
      filtered = filtered.filter(c => c.status === statusFilter)
    }

    // 지점 필터
    if (officeFilter !== 'all') {
      filtered = filtered.filter(c => c.office === officeFilter)
    }

    // 검색어 필터
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(c =>
        c.contract_number?.toLowerCase().includes(term) ||
        c.case_name?.toLowerCase().includes(term) ||
        c.client?.name?.toLowerCase().includes(term)
      )
    }

    setFilteredCases(filtered)
    setCurrentPage(1)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  // 페이지네이션
  const indexOfLastCase = currentPage * casesPerPage
  const indexOfFirstCase = indexOfLastCase - casesPerPage
  const currentCases = filteredCases.slice(indexOfFirstCase, indexOfLastCase)
  const totalPages = Math.ceil(filteredCases.length / casesPerPage)

  const getStatusColor = (status: string) => {
    return status === '진행중'
      ? 'bg-emerald-50 text-emerald-700 border-l-emerald-400'
      : 'bg-gray-50 text-gray-600 border-l-gray-400'
  }

  const getOfficeColor = (office: string) => {
    switch (office) {
      case '평택': return 'bg-blue-50 text-blue-700'
      case '천안': return 'bg-purple-50 text-purple-700'
      case '소송구조': return 'bg-amber-50 text-amber-700'
      default: return 'bg-gray-50 text-gray-700'
    }
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <a href="/" className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-700 rounded-lg flex items-center justify-center hover:from-blue-600 hover:to-blue-800 transition-colors cursor-pointer">
              <span className="text-white font-bold text-lg">율</span>
            </a>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">사건 관리</h1>
              <p className="text-sm text-gray-600">총 {filteredCases.length}건</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <a
              href="/"
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              대시보드
            </a>
            <div className="text-right">
              <p className="text-sm font-medium text-gray-900">{profile.name}</p>
              <p className="text-xs text-gray-500">
                {profile.role === 'admin' ? '관리자' : '직원'}
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              로그아웃
            </button>
          </div>
        </div>
      </header>

      {/* 메인 콘텐츠 */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 필터 & 검색 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* 검색 */}
            <div className="md:col-span-2">
              <input
                type="text"
                placeholder="계약번호, 사건명, 의뢰인명으로 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* 상태 필터 */}
            <div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">전체 상태</option>
                <option value="진행중">진행중</option>
                <option value="종결">종결</option>
              </select>
            </div>

            {/* 지점 필터 */}
            <div>
              <select
                value={officeFilter}
                onChange={(e) => setOfficeFilter(e.target.value as any)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">전체 지점</option>
                <option value="평택">평택</option>
                <option value="천안">천안</option>
                <option value="소송구조">소송구조</option>
              </select>
            </div>
          </div>
        </div>

        {/* 사건 목록 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full table-fixed">
              <colgroup>
                <col className="w-24" />
                <col className="w-28" />
                <col className="w-28" />
                <col className="flex-1" />
                <col className="w-24" />
                <col className="w-24" />
                <col className="w-28" />
              </colgroup>
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    계약일
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    사건종류
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    의뢰인
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    사건명
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    지점
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    상태
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    일정
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {currentCases.map((legalCase) => (
                  <tr
                    key={legalCase.id}
                    onClick={() => router.push(`/cases/${legalCase.id}`)}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-center text-gray-900">
                      {legalCase.contract_date ? (() => {
                        const date = new Date(legalCase.contract_date);
                        const year = String(date.getFullYear()).slice(2);
                        const month = String(date.getMonth() + 1).padStart(2, '0');
                        const day = String(date.getDate()).padStart(2, '0');
                        return `${year}.${month}.${day}`;
                      })() : '-'}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-center text-gray-700">
                      {legalCase.case_type || '-'}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-center font-medium text-gray-900">
                      {legalCase.client?.name || '-'}
                    </td>
                    <td className="px-4 py-4 text-sm text-center text-gray-900">
                      {legalCase.case_name}
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className={`inline-flex px-2.5 py-1 text-xs font-semibold rounded-md ${getOfficeColor(legalCase.office)}`}>
                        {legalCase.office || '-'}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className={`inline-flex px-2.5 py-1 text-xs font-semibold rounded-md border-l-4 ${getStatusColor(legalCase.status)}`}>
                        {legalCase.status}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <button
                        onClick={(e) => handleAddSchedule(e, legalCase.court_case_number)}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                          legalCase.court_case_number
                            ? 'bg-blue-600 text-white hover:bg-blue-700'
                            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        }`}
                        disabled={!legalCase.court_case_number}
                      >
                        기일추가
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 빈 상태 */}
          {currentCases.length === 0 && (
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
                <span className="text-2xl">📋</span>
              </div>
              <p className="text-gray-600 font-medium">검색 결과가 없습니다.</p>
              <p className="text-sm text-gray-500 mt-1">다른 검색어나 필터를 시도해보세요.</p>
            </div>
          )}

          {/* 페이지네이션 */}
          {totalPages > 1 && (
            <div className="px-6 py-4 border-t border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm text-gray-600">
                  {indexOfFirstCase + 1}-{Math.min(indexOfLastCase, filteredCases.length)} / 총 {filteredCases.length}건
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    이전
                  </button>
                  <div className="flex items-center gap-2">
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
                          className={`px-4 py-2 text-sm font-medium rounded-md ${
                            currentPage === pageNum
                              ? 'bg-blue-600 text-white'
                              : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          {pageNum}
                        </button>
                      )
                    })}
                  </div>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    다음
                  </button>
                </div>
              </div>

              {/* 페이지당 표시 개수 버튼 */}
              <div className="flex items-center justify-center gap-2 pt-3 border-t border-gray-100">
                <span className="text-sm text-gray-600 mr-2">페이지당 표시:</span>
                <button
                  onClick={() => {
                    setCasesPerPage(50)
                    setCurrentPage(1)
                  }}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                    casesPerPage === 50
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  50건
                </button>
                <button
                  onClick={() => {
                    setCasesPerPage(100)
                    setCurrentPage(1)
                  }}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                    casesPerPage === 100
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  100건
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

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
    </div>
  )
}
