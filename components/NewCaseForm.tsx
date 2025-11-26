'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import AdminHeader from './AdminHeader'

interface Client {
  id: string
  name: string
  phone: string | null
  email: string | null
}

interface NewCaseFormProps {
  clients: Client[]
}

interface NewClientPayload {
  name: string
  phone: string
  email: string | null
  birth_date: string | null
  address: string | null
}

interface NewCasePayload {
  case_name: string
  case_type: string
  office: string
  status: string
  contract_date: string
  retainer_fee: number | null
  notes: string
  is_new_case: boolean
  client_id?: string
  new_client?: NewClientPayload
}

export default function NewCaseForm({ clients }: NewCaseFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isNewClient, setIsNewClient] = useState(false)

  const [formData, setFormData] = useState({
    case_name: '',
    client_id: '',
    case_type: '',
    office: '평택',
    status: '진행중',
    contract_date: new Date().toISOString().split('T')[0],
    retainer_fee: '',
    notes: '',
    is_new_case: true,
    // New client info
    client_name: '',
    client_phone: '',
    client_email: '',
    client_birth_date: '',
    client_address: ''
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const payload: NewCasePayload = {
        case_name: formData.case_name,
        case_type: formData.case_type,
        office: formData.office,
        status: formData.status,
        contract_date: formData.contract_date,
        retainer_fee: formData.retainer_fee ? Number(formData.retainer_fee) : null,
        notes: formData.notes,
        is_new_case: formData.is_new_case
      }

      if (isNewClient) {
        if (!formData.client_name || !formData.client_phone) {
          throw new Error('의뢰인 이름과 연락처는 필수입니다')
        }
        payload.new_client = {
          name: formData.client_name,
          phone: formData.client_phone,
          email: formData.client_email || null,
          birth_date: formData.client_birth_date || null,
          address: formData.client_address || null
        }
      } else {
        if (!formData.client_id) {
          throw new Error('의뢰인을 선택하세요')
        }
        payload.client_id = formData.client_id
      }

      const response = await fetch('/api/admin/cases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || '사건 등록에 실패했습니다')
      }

      router.push(`/cases/${data.data.id}`)
      router.refresh()
    } catch (err) {
      const message = err instanceof Error ? err.message : '사건 등록에 실패했습니다'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader title="새 사건 등록" />

      <div className="max-w-3xl mx-auto pt-20 pb-8 px-4">
        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Case Info */}
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">사건 정보</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  사건명 *
                </label>
                <input
                  type="text"
                  required
                  value={formData.case_name}
                  onChange={(e) => setFormData({ ...formData, case_name: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-sage-500"
                  placeholder="예: 김철수 이혼 사건"
                />
              </div>

              <div className="md:col-span-2">
                <label className="flex items-center gap-2 text-xs font-medium text-gray-700">
                  <input
                    type="checkbox"
                    checked={formData.is_new_case}
                    onChange={(e) => setFormData({ ...formData, is_new_case: e.target.checked })}
                    className="rounded border-gray-300 text-sage-600 focus:ring-sage-500"
                  />
                  신건 여부
                  <span className="text-gray-400 font-normal">(신규 수임이면 체크)</span>
                </label>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  사건 유형 *
                </label>
                <select
                  required
                  value={formData.case_type}
                  onChange={(e) => setFormData({ ...formData, case_type: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-sage-500"
                >
                  <option value="">선택하세요</option>
                  <option value="이혼">이혼</option>
                  <option value="재산분할">재산분할</option>
                  <option value="양육권">양육권</option>
                  <option value="위자료">위자료</option>
                  <option value="상간소송">상간소송</option>
                  <option value="기타">기타</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  사무소
                </label>
                <select
                  value={formData.office}
                  onChange={(e) => setFormData({ ...formData, office: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-sage-500"
                >
                  <option value="평택">평택</option>
                  <option value="천안">천안</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  상태
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-sage-500"
                >
                  <option value="진행중">진행중</option>
                  <option value="완료">완료</option>
                  <option value="중단">중단</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  계약일
                </label>
                <input
                  type="date"
                  value={formData.contract_date}
                  onChange={(e) => setFormData({ ...formData, contract_date: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-sage-500"
                  style={{ colorScheme: 'light' }}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  착수금 (원)
                </label>
                <input
                  type="number"
                  value={formData.retainer_fee}
                  onChange={(e) => setFormData({ ...formData, retainer_fee: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-sage-500"
                  placeholder="0"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  메모
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-sage-500"
                  placeholder="추가 메모 사항"
                />
              </div>
            </div>
          </div>

          {/* Client Info */}
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-900">의뢰인 정보 *</h2>
              <button
                type="button"
                onClick={() => setIsNewClient(!isNewClient)}
                className="text-xs text-sage-600 hover:text-sage-700 font-medium"
              >
                {isNewClient ? '기존 의뢰인 선택' : '+ 새 의뢰인 입력'}
              </button>
            </div>

            {!isNewClient ? (
              <select
                required={!isNewClient}
                value={formData.client_id}
                onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-sage-500"
              >
                <option value="">선택하세요</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name} {client.phone ? `(${client.phone})` : ''}
                  </option>
                ))}
              </select>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 bg-gray-50 rounded border border-gray-200">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    이름 *
                  </label>
                  <input
                    type="text"
                    required={isNewClient}
                    value={formData.client_name}
                    onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-sage-500"
                    placeholder="홍길동"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    연락처 *
                  </label>
                  <input
                    type="tel"
                    required={isNewClient}
                    value={formData.client_phone}
                    onChange={(e) => setFormData({ ...formData, client_phone: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-sage-500"
                    placeholder="010-1234-5678"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    이메일
                  </label>
                  <input
                    type="email"
                    value={formData.client_email}
                    onChange={(e) => setFormData({ ...formData, client_email: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-sage-500"
                    placeholder="example@email.com"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    생년월일
                  </label>
                  <input
                    type="date"
                    value={formData.client_birth_date}
                    onChange={(e) => setFormData({ ...formData, client_birth_date: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-sage-500"
                    style={{ colorScheme: 'light' }}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    주소
                  </label>
                  <input
                    type="text"
                    value={formData.client_address}
                    onChange={(e) => setFormData({ ...formData, client_address: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-sage-500"
                    placeholder="경기도 평택시..."
                  />
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2">
            <Link
              href="/cases"
              className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded hover:bg-gray-50 transition-colors"
            >
              취소
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-white bg-sage-600 rounded hover:bg-sage-700 disabled:opacity-50 transition-colors"
            >
              {loading ? '등록 중...' : '사건 등록'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
