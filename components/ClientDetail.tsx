'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import AdminHeader from './AdminHeader'
import ClientPaymentsModal from './ClientPaymentsModal'

interface LegalCase {
  id: string
  contract_number: string | null
  case_name: string
  status: '진행중' | '종결'
  office: string | null
  contract_date: string | null
  case_type: string | null
  retainer_fee: number | null
  calculated_success_fee: number | null
  total_received: number | null
}

interface Client {
  id: string
  name: string
  phone: string | null
  email: string | null
  address: string | null
  birth_date: string | null
  gender: 'M' | 'F' | null
  account_number: string | null
  resident_number: string | null
  notes: string | null
  created_at: string
  updated_at: string
  cases?: LegalCase[]
}

export default function ClientDetail({ clientData }: { clientData: Client }) {
  const router = useRouter()
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [totalReceived, setTotalReceived] = useState<number | null>(null)

  const formatDate = (date: string | null) => {
    if (!date) return '-'
    const d = new Date(date)
    const year = String(d.getFullYear()).slice(2)
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}.${month}.${day}`
  }

  const formatCurrency = (amount: number | null) => {
    if (!amount) return '0원'
    return `${amount.toLocaleString('ko-KR')}원`
  }

  // 총 입금 금액 계산
  const calculateTotalReceived = () => {
    if (totalReceived !== null) return totalReceived
    if (!clientData.cases) return 0
    return clientData.cases.reduce((sum, c) => sum + (c.total_received || 0), 0)
  }

  // 미수금 합계 계산
  const calculateTotalOutstanding = () => {
    if (!clientData.cases) return 0
    return clientData.cases.reduce((sum, c) => {
      const retainer = c.retainer_fee || 0
      const successFee = c.calculated_success_fee || 0
      const received = c.total_received || 0
      return sum + (retainer + successFee - received)
    }, 0)
  }

  useEffect(() => {
    const fetchTotals = async () => {
      try {
        const res = await fetch(`/api/admin/clients/${clientData.id}/payments-summary?name=${encodeURIComponent(clientData.name || '')}`)
        const json = await res.json()
        if (res.ok && typeof json.total === 'number') {
          setTotalReceived(json.total)
        }
      } catch (err) {
        console.error('Failed to fetch client payments summary', err)
      }
    }
    fetchTotals()
  }, [clientData.id, clientData.name])

  const getStatusBadge = (status: string) => {
    return status === '진행중'
      ? 'bg-emerald-50 text-emerald-700'
      : 'bg-gray-100 text-gray-600'
  }

  const getOfficeBadge = (office: string) => {
    switch (office) {
      case '평택': return 'bg-blue-50 text-blue-700'
      case '천안': return 'bg-purple-50 text-purple-700'
      case '소송구조': return 'bg-amber-50 text-amber-700'
      default: return 'bg-gray-50 text-gray-700'
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader title="의뢰인 상세" subtitle={clientData.name} />

      <div className="max-w-4xl mx-auto pt-20 pb-8 px-4">
        {/* Action Buttons */}
        <div className="flex items-center justify-between mb-5">
          <Link
            href="/clients"
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            ← 목록으로
          </Link>
          <div className="flex gap-2">
            <button
              onClick={() => window.open(`/admin/client-preview/${clientData.id}?preview=admin`, '_blank')}
              className="px-3 py-1.5 text-sm font-medium text-sage-700 bg-sage-100 rounded-lg hover:bg-sage-200 transition-colors"
            >
              포털 미리보기
            </button>
            <Link
              href={`/clients/${clientData.id}/edit`}
              className="px-3 py-1.5 text-sm font-medium text-white bg-sage-600 rounded-lg hover:bg-sage-700 transition-colors"
            >
              수정
            </Link>
          </div>
        </div>

        {/* Basic Info Card */}
        <div className="bg-white rounded-lg border border-gray-200 p-5 mb-4">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">기본 정보</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-xs text-gray-500">이름</span>
              <p className="text-gray-900 font-medium mt-0.5">{clientData.name}</p>
            </div>
            <div>
              <span className="text-xs text-gray-500">주민등록번호</span>
              <p className="text-gray-900 mt-0.5">{clientData.resident_number || '-'}</p>
            </div>
            <div>
              <span className="text-xs text-gray-500">연락처</span>
              <p className="text-gray-900 mt-0.5">{clientData.phone || '-'}</p>
            </div>
            <div>
              <span className="text-xs text-gray-500">생년월일</span>
              <p className="text-gray-900 mt-0.5">{formatDate(clientData.birth_date)}</p>
            </div>
            <div>
              <span className="text-xs text-gray-500">이메일</span>
              <p className="text-gray-900 mt-0.5">{clientData.email || '-'}</p>
            </div>
            <div>
              <span className="text-xs text-gray-500">성별</span>
              <p className="text-gray-900 mt-0.5">
                {clientData.gender === 'M' ? '남성' : clientData.gender === 'F' ? '여성' : '-'}
              </p>
            </div>
            <div className="col-span-2">
              <span className="text-xs text-gray-500">주소</span>
              <p className="text-gray-900 mt-0.5">{clientData.address || '-'}</p>
            </div>
            <div className="col-span-2">
              <span className="text-xs text-gray-500">계좌번호</span>
              <p className="text-gray-900 mt-0.5">{clientData.account_number || '-'}</p>
            </div>
          </div>
        </div>

        {/* Financial Summary */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div
            className="bg-white rounded-lg border border-gray-200 p-4 cursor-pointer hover:border-emerald-300 transition-colors"
            onClick={() => setShowPaymentModal(true)}
          >
            <span className="text-xs text-gray-500">총 입금액</span>
            <p className="text-xl font-bold text-emerald-600 mt-1">
              {formatCurrency(calculateTotalReceived())}
            </p>
            <p className="text-xs text-gray-400 mt-1">클릭하여 상세보기</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <span className="text-xs text-gray-500">미수금 합계</span>
            <p className="text-xl font-bold text-red-600 mt-1">
              {formatCurrency(calculateTotalOutstanding())}
            </p>
            <p className="text-xs text-gray-400 mt-1">전체 사건 미수금</p>
          </div>
        </div>

        {/* Memo Card */}
        {clientData.notes && (
          <div className="bg-white rounded-lg border border-gray-200 p-5 mb-4">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">메모</h2>
            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
              {clientData.notes}
            </p>
          </div>
        )}

        {/* Cases List */}
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">
              사건 목록 ({clientData.cases?.length || 0}건)
            </h2>
            <Link
              href={`/cases/new?client_id=${clientData.id}`}
              className="px-2.5 py-1 text-xs font-medium text-white bg-sage-600 rounded hover:bg-sage-700 transition-colors"
            >
              + 사건 추가
            </Link>
          </div>

          {clientData.cases && clientData.cases.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {clientData.cases.map((legalCase) => (
                <div
                  key={legalCase.id}
                  onClick={() => router.push(`/cases/${legalCase.id}`)}
                  className="px-5 py-3 hover:bg-gray-50 cursor-pointer flex items-center justify-between"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {legalCase.office && (
                        <span className={`px-1.5 py-0.5 text-xs font-medium rounded ${getOfficeBadge(legalCase.office)}`}>
                          {legalCase.office}
                        </span>
                      )}
                      <span className={`px-1.5 py-0.5 text-xs font-medium rounded ${getStatusBadge(legalCase.status)}`}>
                        {legalCase.status}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {legalCase.case_name}
                    </p>
                    <div className="flex gap-3 mt-1 text-xs text-gray-500">
                      {legalCase.case_type && <span>{legalCase.case_type}</span>}
                      {legalCase.contract_date && <span>계약일: {formatDate(legalCase.contract_date)}</span>}
                    </div>
                  </div>
                  <svg className="w-4 h-4 text-gray-400 ml-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center text-gray-400 text-sm">
              등록된 사건이 없습니다
            </div>
          )}
        </div>
      </div>

      {/* Payment Modal */}
      <ClientPaymentsModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        clientId={clientData.id}
        clientName={clientData.name}
      />
    </div>
  )
}
