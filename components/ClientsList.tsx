'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface Client {
  id: string
  name: string
  phone: string | null
  email: string | null
  address: string | null
  birth_date: string | null
  gender: 'M' | 'F' | null
  notes: string | null
  created_at: string
  total_outstanding: number
  latest_case: {
    id: string
    case_name: string
  } | null
}

interface Profile {
  id: string
  name: string
  email: string
  role: string
}

export default function ClientsList({ profile: _profile, initialClients }: { profile: Profile, initialClients: Client[] }) {
  const [clients] = useState<Client[]>(initialClients)
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [clientsPerPage, setClientsPerPage] = useState(50)
  const router = useRouter()

  const filteredClients = useMemo(() => {
    if (!searchTerm) return clients
    const term = searchTerm.toLowerCase()
    return clients.filter(c =>
      c.name?.toLowerCase().includes(term) ||
      c.phone?.toLowerCase().includes(term) ||
      c.email?.toLowerCase().includes(term)
    )
  }, [clients, searchTerm])

  // Pagination
  const indexOfLastClient = currentPage * clientsPerPage
  const indexOfFirstClient = indexOfLastClient - clientsPerPage
  const currentClients = filteredClients.slice(indexOfFirstClient, indexOfLastClient)
  const totalPages = Math.ceil(filteredClients.length / clientsPerPage)

  const formatCurrency = (amount: number) => {
    return `${amount.toLocaleString('ko-KR')}원`
  }

  const handleCaseClick = (e: React.MouseEvent, caseId: string) => {
    e.stopPropagation()
    router.push(`/cases/${caseId}`)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto pt-20 pb-8 px-4">
        {/* Summary */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-4 text-sm">
            <span className="text-gray-500">총 의뢰인</span>
            <span className="text-lg font-bold text-gray-900">{filteredClients.length}명</span>
          </div>
          <Link
            href="/clients/new"
            className="px-3 py-1.5 text-sm font-medium text-white bg-sage-600 rounded-lg hover:bg-sage-700 transition-colors"
          >
            + 의뢰인 추가
          </Link>
        </div>

        {/* Search Filter */}
        <div className="flex items-center gap-3 mb-4">
          <input
            type="text"
            placeholder="이름, 연락처, 이메일로 검색..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value)
              setCurrentPage(1)
            }}
            className="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-sage-500 focus:border-sage-500"
          />
        </div>

        {/* Client List Table */}
        <div className="bg-white rounded-lg border border-gray-200">
          {currentClients.length === 0 ? (
            <div className="py-12 text-center text-gray-400 text-sm">
              {searchTerm ? '검색 결과가 없습니다' : '등록된 의뢰인이 없습니다'}
            </div>
          ) : (
            <>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-medium">이름</th>
                    <th className="px-4 py-2.5 text-left font-medium">연락처</th>
                    <th className="px-4 py-2.5 text-left font-medium">등록사건</th>
                    <th className="px-4 py-2.5 text-right font-medium">미수금</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {currentClients.map((client) => (
                    <tr
                      key={client.id}
                      onClick={() => router.push(`/clients/${client.id}`)}
                      className="hover:bg-gray-50 cursor-pointer"
                    >
                      <td className="px-4 py-3">
                        <span className="font-medium text-gray-900">{client.name}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {client.phone || '-'}
                      </td>
                      <td className="px-4 py-3">
                        {client.latest_case ? (
                          <button
                            onClick={(e) => handleCaseClick(e, client.latest_case!.id)}
                            className="text-sage-700 hover:text-sage-900 hover:underline text-left"
                          >
                            {client.latest_case.case_name}
                          </button>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {client.total_outstanding > 0 ? (
                          <span className="px-2 py-0.5 text-xs font-medium bg-red-50 text-red-600 rounded">
                            {formatCurrency(client.total_outstanding)}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs">0원</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="px-4 py-3 border-t border-gray-100">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500">
                      전체 {filteredClients.length}명 중 {indexOfFirstClient + 1}-{Math.min(indexOfLastClient, filteredClients.length)}명
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="px-2 py-1 border border-gray-200 rounded text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        이전
                      </button>
                      <span className="text-gray-600 px-2">
                        {currentPage} / {totalPages}
                      </span>
                      <button
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="px-2 py-1 border border-gray-200 rounded text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        다음
                      </button>
                    </div>
                  </div>

                  {/* Per Page Options */}
                  <div className="flex items-center justify-center gap-2 pt-3 mt-3 border-t border-gray-100">
                    <span className="text-xs text-gray-500 mr-1">페이지당:</span>
                    {[50, 100].map((num) => (
                      <button
                        key={num}
                        onClick={() => { setClientsPerPage(num); setCurrentPage(1) }}
                        className={`px-2 py-1 text-xs rounded transition-colors ${
                          clientsPerPage === num
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
            </>
          )}
        </div>
      </div>
    </div>
  )
}
