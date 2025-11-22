'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

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

export default function ClientsList({ profile, initialClients }: { profile: Profile, initialClients: Client[] }) {
  const [clients] = useState<Client[]>(initialClients)
  const [filteredClients, setFilteredClients] = useState<Client[]>(initialClients)
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [clientsPerPage, setClientsPerPage] = useState(50)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    filterClients()
  }, [searchTerm])

  const filterClients = () => {
    let filtered = [...clients]

    // 검색어 필터
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(c =>
        c.name?.toLowerCase().includes(term) ||
        c.phone?.toLowerCase().includes(term) ||
        c.email?.toLowerCase().includes(term)
      )
    }

    setFilteredClients(filtered)
    setCurrentPage(1)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  // 페이지네이션
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
      {/* 헤더 */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <a href="/" className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-700 rounded-lg flex items-center justify-center hover:from-blue-600 hover:to-blue-800 transition-colors cursor-pointer">
              <span className="text-white font-bold text-lg">율</span>
            </a>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">의뢰인 관리</h1>
              <p className="text-sm text-gray-600">총 {filteredClients.length}명</p>
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
        {/* 필터 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
          <div className="flex gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="이름, 연락처, 이메일로 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* 의뢰인 목록 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full table-fixed">
              <colgroup>
                <col className="w-32" />
                <col className="w-40" />
                <col className="flex-1" />
                <col className="w-32" />
              </colgroup>
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    이름
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    연락처
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    등록사건
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    미수금
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {currentClients.map((client) => (
                  <tr
                    key={client.id}
                    onClick={() => router.push(`/clients/${client.id}`)}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-center font-medium text-gray-900">
                      {client.name}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-center text-gray-700">
                      {client.phone || '-'}
                    </td>
                    <td className="px-4 py-4 text-sm text-center">
                      {client.latest_case ? (
                        <button
                          onClick={(e) => handleCaseClick(e, client.latest_case!.id)}
                          className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                        >
                          {client.latest_case.case_name}
                        </button>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className={`inline-flex px-2.5 py-1 text-xs font-semibold rounded-md ${
                        client.total_outstanding > 0
                          ? 'bg-red-50 text-red-700'
                          : 'bg-gray-50 text-gray-600'
                      }`}>
                        {formatCurrency(client.total_outstanding)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 빈 상태 */}
          {currentClients.length === 0 && (
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
                <span className="text-2xl">👥</span>
              </div>
              <p className="text-gray-600 font-medium">검색 결과가 없습니다.</p>
              <p className="text-sm text-gray-500 mt-2">다른 검색어로 시도해보세요.</p>
            </div>
          )}

          {/* 페이지네이션 */}
          {totalPages > 1 && (
            <div className="px-6 py-4 border-t border-gray-100">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  전체 {filteredClients.length}명 중 {indexOfFirstClient + 1}-{Math.min(indexOfLastClient, filteredClients.length)}명 표시
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    이전
                  </button>
                  <span className="px-3 py-1 text-sm text-gray-600">
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    다음
                  </button>
                </div>
              </div>

              {/* 페이지당 표시 옵션 */}
              <div className="flex items-center justify-center gap-2 pt-3 border-t border-gray-100 mt-3">
                <span className="text-sm text-gray-600 mr-2">페이지당 표시:</span>
                <button
                  onClick={() => {setClientsPerPage(50); setCurrentPage(1)}}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    clientsPerPage === 50
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  50건
                </button>
                <button
                  onClick={() => {setClientsPerPage(100); setCurrentPage(1)}}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    clientsPerPage === 100
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
    </div>
  )
}
