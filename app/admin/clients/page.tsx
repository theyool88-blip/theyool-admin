'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import AdminHeader from '@/components/AdminHeader'

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
  case_count?: number
  latest_case?: {
    id: string
    case_name: string
  } | null
}

interface ClientDetailModalProps {
  client: Client | null
  isOpen: boolean
  onClose: () => void
  onEdit: (id: string) => void
  onPreview: (id: string) => void
}

function ClientDetailModal({ client, isOpen, onClose, onEdit, onPreview }: ClientDetailModalProps) {
  if (!isOpen || !client) return null

  const formatCurrency = (amount: number) => `${amount.toLocaleString('ko-KR')}원`
  const formatDate = (date: string) => new Date(date).toLocaleDateString('ko-KR')

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">의뢰인 상세</h3>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* Name & Basic Info */}
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-full bg-sage-100 flex items-center justify-center text-sage-700 font-medium text-lg">
              {client.name.charAt(0)}
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-gray-900">{client.name}</h4>
              {client.gender && (
                <span className="text-xs text-gray-500">
                  {client.gender === 'M' ? '남성' : '여성'}
                </span>
              )}
            </div>
            {client.total_outstanding > 0 && (
              <span className="px-2 py-1 text-xs font-medium bg-red-50 text-red-600 rounded">
                미수금 {formatCurrency(client.total_outstanding)}
              </span>
            )}
          </div>

          {/* Contact Info */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              <span className="text-gray-700">{client.phone || '-'}</span>
            </div>
            {client.email && (
              <div className="flex items-center gap-2 text-sm">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span className="text-gray-700">{client.email}</span>
              </div>
            )}
            {client.address && (
              <div className="flex items-start gap-2 text-sm">
                <svg className="w-4 h-4 text-gray-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="text-gray-700">{client.address}</span>
              </div>
            )}
            {client.birth_date && (
              <div className="flex items-center gap-2 text-sm">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-gray-700">{formatDate(client.birth_date)}</span>
              </div>
            )}
          </div>

          {/* Latest Case */}
          {client.latest_case && (
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-1">최근 사건</p>
              <p className="text-sm text-gray-800">{client.latest_case.case_name}</p>
            </div>
          )}

          {/* Notes */}
          {client.notes && (
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-1">메모</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{client.notes}</p>
            </div>
          )}

          {/* Registration Date */}
          <div className="text-xs text-gray-400">
            등록일: {formatDate(client.created_at)}
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-5 py-4 border-t border-gray-100">
          <button
            onClick={onClose}
            className="flex-1 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            닫기
          </button>
          <button
            onClick={() => onPreview(client.id)}
            className="flex-1 py-2 text-sm bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors"
          >
            포털 미리보기
          </button>
          <button
            onClick={() => onEdit(client.id)}
            className="flex-1 py-2 text-sm bg-sage-600 text-white rounded-lg hover:bg-sage-700 transition-colors"
          >
            수정
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AdminClientsPage() {
  const router = useRouter()
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState<'name' | 'outstanding' | 'recent'>('recent')
  const [filterOutstanding, setFilterOutstanding] = useState<'all' | 'has' | 'none'>('all')

  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const fetchClients = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/clients')
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setClients(json.clients || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : '조회 실패')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchClients()
  }, [fetchClients])

  const filteredClients = useMemo(() => {
    let result = clients

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      result = result.filter(c =>
        c.name?.toLowerCase().includes(term) ||
        c.phone?.toLowerCase().includes(term) ||
        c.email?.toLowerCase().includes(term)
      )
    }

    // Outstanding filter
    if (filterOutstanding === 'has') {
      result = result.filter(c => c.total_outstanding > 0)
    } else if (filterOutstanding === 'none') {
      result = result.filter(c => c.total_outstanding === 0)
    }

    // Sort
    result = [...result].sort((a, b) => {
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name, 'ko')
      } else if (sortBy === 'outstanding') {
        return b.total_outstanding - a.total_outstanding
      } else {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      }
    })

    return result
  }, [clients, searchTerm, sortBy, filterOutstanding])

  const formatCurrency = (amount: number) => `${amount.toLocaleString('ko-KR')}원`

  const openClientDetail = (client: Client) => {
    setSelectedClient(client)
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setSelectedClient(null)
  }

  const handleEdit = (id: string) => {
    router.push(`/clients/${id}/edit`)
  }

  const handlePreview = (id: string) => {
    router.push(`/admin/client-preview/${id}`)
  }

  const totalOutstanding = useMemo(() => {
    return clients.reduce((sum, c) => sum + (c.total_outstanding || 0), 0)
  }, [clients])

  const clientsWithOutstanding = useMemo(() => {
    return clients.filter(c => c.total_outstanding > 0).length
  }, [clients])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-gray-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader title="의뢰인 관리" />

      <div className="max-w-5xl mx-auto pt-20 pb-8 px-4">
        {/* Summary */}
        <div className="flex items-center gap-6 mb-5 text-sm">
          <div>
            <span className="text-gray-500">총 의뢰인</span>
            <span className="ml-2 text-lg font-bold text-gray-900">{clients.length}명</span>
          </div>
          <div className="text-gray-400">|</div>
          <div className="text-gray-500">
            미수금 {clientsWithOutstanding}명
          </div>
          {totalOutstanding > 0 && (
            <span className="px-2 py-0.5 text-xs bg-red-50 text-red-600 rounded">
              총 미수금 {formatCurrency(totalOutstanding)}
            </span>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-4 text-sm">
          {/* Search */}
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              placeholder="이름, 연락처, 이메일 검색"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-1.5 border border-gray-200 rounded bg-white text-sm placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-sage-500 focus:border-sage-500"
            />
          </div>

          {/* Outstanding Filter */}
          <select
            value={filterOutstanding}
            onChange={(e) => setFilterOutstanding(e.target.value as 'all' | 'has' | 'none')}
            className="px-2 py-1.5 border border-gray-200 rounded bg-white text-sm focus:outline-none focus:ring-1 focus:ring-sage-500"
          >
            <option value="all">전체</option>
            <option value="has">미수금 있음</option>
            <option value="none">미수금 없음</option>
          </select>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'name' | 'outstanding' | 'recent')}
            className="px-2 py-1.5 border border-gray-200 rounded bg-white text-sm focus:outline-none focus:ring-1 focus:ring-sage-500"
          >
            <option value="recent">최근등록순</option>
            <option value="name">이름순</option>
            <option value="outstanding">미수금순</option>
          </select>

          {/* Add Button */}
          <button
            onClick={() => router.push('/clients/new')}
            className="px-3 py-1.5 text-sm bg-sage-600 text-white rounded hover:bg-sage-700 transition-colors"
          >
            + 의뢰인 추가
          </button>
        </div>

        {error && <div className="text-sm text-red-600 mb-4">{error}</div>}

        {/* List */}
        <div className="bg-white rounded-lg border border-gray-200">
          {filteredClients.length === 0 ? (
            <div className="py-12 text-center text-gray-400">
              {searchTerm ? '검색 결과가 없습니다' : '등록된 의뢰인이 없습니다'}
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredClients.map((client) => (
                <div
                  key={client.id}
                  onClick={() => openClientDetail(client)}
                  className="flex items-center px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  {/* Avatar */}
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-medium mr-3 ${
                    client.total_outstanding > 0
                      ? 'bg-red-50 text-red-600'
                      : 'bg-sage-100 text-sage-700'
                  }`}>
                    {client.name.charAt(0)}
                  </div>

                  {/* Name & Contact */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900 text-sm">{client.name}</span>
                      {client.case_count !== undefined && client.case_count > 0 && (
                        <span className="text-xs text-gray-400">{client.case_count}건</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 truncate">
                      {client.phone || client.email || '연락처 없음'}
                    </p>
                  </div>

                  {/* Outstanding */}
                  {client.total_outstanding > 0 && (
                    <span className="text-sm font-medium text-red-600 mr-2">
                      {formatCurrency(client.total_outstanding)}
                    </span>
                  )}

                  {/* Arrow */}
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Count */}
        {filteredClients.length > 0 && (
          <div className="mt-3 text-xs text-gray-500 text-center">
            {filteredClients.length}명 표시
          </div>
        )}
      </div>

      {/* Detail Modal */}
      <ClientDetailModal
        client={selectedClient}
        isOpen={isModalOpen}
        onClose={closeModal}
        onEdit={handleEdit}
        onPreview={handlePreview}
      />
    </div>
  )
}
