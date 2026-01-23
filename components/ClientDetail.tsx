'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import ClientPaymentsModal from './ClientPaymentsModal'
import StatusBadge from './ui/StatusBadge'
import { Phone, Mail, MapPin, Calendar, User, ChevronRight, CreditCard, Wallet, Plus, Building2, FileText } from 'lucide-react'

interface LegalCase {
  id: string
  contract_number: string | null
  case_name: string
  status: '진행중' | '종결'
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
  bank_account: string | null
  resident_number: string | null
  client_type: 'individual' | 'corporation' | null
  company_name: string | null
  registration_number: string | null
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

  const outstandingBalance = calculateTotalOutstanding()

  return (
    <div className="page-container max-w-4xl">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <Link
            href="/clients"
            className="text-caption text-[var(--text-muted)] hover:text-[var(--text-secondary)] mb-2 inline-block"
          >
            ← 의뢰인 목록
          </Link>
          <h1 className="page-title">{clientData.name}</h1>
          <p className="page-subtitle">
            {clientData.cases?.length || 0}건의 사건
            {outstandingBalance > 0 && (
              <span className="ml-2 text-[var(--color-danger)]">
                미수금 {formatCurrency(outstandingBalance)}
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => window.open(`/admin/client-preview/${clientData.id}?preview=admin`, '_blank')}
            className="btn btn-secondary"
          >
            포털 미리보기
          </button>
          <Link
            href={`/clients/${clientData.id}/edit`}
            className="btn btn-primary"
          >
            수정
          </Link>
        </div>
      </div>

      {/* Financial Summary Cards */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div
          className="card p-4 cursor-pointer hover:border-[var(--sage-primary)] transition-colors"
          onClick={() => setShowPaymentModal(true)}
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-[var(--color-success-muted)] flex items-center justify-center">
              <Wallet className="w-4 h-4 text-[var(--color-success)]" />
            </div>
            <span className="text-caption text-[var(--text-muted)]">총 입금액</span>
          </div>
          <p className="text-heading font-bold text-[var(--color-success)]">
            {formatCurrency(calculateTotalReceived())}
          </p>
          <p className="text-caption text-[var(--text-muted)] mt-1">클릭하여 상세보기</p>
        </div>

        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${outstandingBalance > 0 ? 'bg-[var(--color-danger-muted)]' : 'bg-[var(--bg-tertiary)]'}`}>
              <CreditCard className={`w-4 h-4 ${outstandingBalance > 0 ? 'text-[var(--color-danger)]' : 'text-[var(--text-muted)]'}`} />
            </div>
            <span className="text-caption text-[var(--text-muted)]">미수금 합계</span>
          </div>
          <p className={`text-heading font-bold ${outstandingBalance > 0 ? 'text-[var(--color-danger)]' : 'text-[var(--text-muted)]'}`}>
            {formatCurrency(outstandingBalance)}
          </p>
          <p className="text-caption text-[var(--text-muted)] mt-1">전체 사건 미수금</p>
        </div>
      </div>

      {/* Basic Info Card */}
      <div className="card mb-4">
        <div className="p-4 border-b border-[var(--border-subtle)]">
          <h2 className="text-body font-semibold text-[var(--text-primary)]">기본 정보</h2>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            {/* 의뢰인 유형 표시 */}
            <div className="col-span-2 flex items-start gap-3">
              <User className="w-4 h-4 text-[var(--text-muted)] mt-0.5 flex-shrink-0" />
              <div>
                <span className="text-caption text-[var(--text-muted)]">의뢰인 유형</span>
                <p className="text-[var(--text-primary)] font-medium">
                  {clientData.client_type === 'corporation' ? '법인' : '개인'}
                </p>
              </div>
            </div>

            {/* 법인인 경우 회사명, 사업자등록번호 표시 */}
            {clientData.client_type === 'corporation' && (
              <>
                <div className="flex items-start gap-3">
                  <Building2 className="w-4 h-4 text-[var(--text-muted)] mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="text-caption text-[var(--text-muted)]">회사명</span>
                    <p className="text-[var(--text-primary)] font-medium">{clientData.company_name || '-'}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <FileText className="w-4 h-4 text-[var(--text-muted)] mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="text-caption text-[var(--text-muted)]">사업자등록번호</span>
                    <p className="text-[var(--text-primary)]">{clientData.registration_number || '-'}</p>
                  </div>
                </div>
              </>
            )}

            <div className="flex items-start gap-3">
              <User className="w-4 h-4 text-[var(--text-muted)] mt-0.5 flex-shrink-0" />
              <div>
                <span className="text-caption text-[var(--text-muted)]">
                  {clientData.client_type === 'corporation' ? '대표자명' : '이름'}
                </span>
                <p className="text-[var(--text-primary)] font-medium">{clientData.name}</p>
              </div>
            </div>

            {/* 개인인 경우 주민등록번호 표시 */}
            {clientData.client_type !== 'corporation' && (
              <div className="flex items-start gap-3">
                <CreditCard className="w-4 h-4 text-[var(--text-muted)] mt-0.5 flex-shrink-0" />
                <div>
                  <span className="text-caption text-[var(--text-muted)]">주민등록번호</span>
                  <p className="text-[var(--text-primary)]">{clientData.resident_number || '-'}</p>
                </div>
              </div>
            )}

            <div className="flex items-start gap-3">
              <Phone className="w-4 h-4 text-[var(--text-muted)] mt-0.5 flex-shrink-0" />
              <div>
                <span className="text-caption text-[var(--text-muted)]">연락처</span>
                <p className="text-[var(--text-primary)]">{clientData.phone || '-'}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Calendar className="w-4 h-4 text-[var(--text-muted)] mt-0.5 flex-shrink-0" />
              <div>
                <span className="text-caption text-[var(--text-muted)]">
                  {clientData.client_type === 'corporation' ? '설립일' : '생년월일'}
                </span>
                <p className="text-[var(--text-primary)]">{formatDate(clientData.birth_date)}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Mail className="w-4 h-4 text-[var(--text-muted)] mt-0.5 flex-shrink-0" />
              <div>
                <span className="text-caption text-[var(--text-muted)]">이메일</span>
                <p className="text-[var(--text-primary)]">{clientData.email || '-'}</p>
              </div>
            </div>
            <div className="col-span-2 flex items-start gap-3">
              <MapPin className="w-4 h-4 text-[var(--text-muted)] mt-0.5 flex-shrink-0" />
              <div>
                <span className="text-caption text-[var(--text-muted)]">주소</span>
                <p className="text-[var(--text-primary)]">{clientData.address || '-'}</p>
              </div>
            </div>
            <div className="col-span-2 flex items-start gap-3">
              <Wallet className="w-4 h-4 text-[var(--text-muted)] mt-0.5 flex-shrink-0" />
              <div>
                <span className="text-caption text-[var(--text-muted)]">계좌번호</span>
                <p className="text-[var(--text-primary)]">{clientData.bank_account || '-'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Memo Card */}
      {clientData.notes && (
        <div className="card mb-4">
          <div className="p-4 border-b border-[var(--border-subtle)]">
            <h2 className="text-body font-semibold text-[var(--text-primary)]">메모</h2>
          </div>
          <div className="p-4">
            <p className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed">
              {clientData.notes}
            </p>
          </div>
        </div>
      )}

      {/* Cases List */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-subtle)]">
          <h2 className="text-body font-semibold text-[var(--text-primary)]">
            사건 목록 ({clientData.cases?.length || 0}건)
          </h2>
          <Link
            href={`/cases/new?client_id=${clientData.id}`}
            className="btn btn-sm btn-primary"
          >
            <Plus className="w-4 h-4" />
            사건 추가
          </Link>
        </div>

        {clientData.cases && clientData.cases.length > 0 ? (
          <div className="divide-y divide-[var(--border-subtle)]">
            {clientData.cases.map((legalCase) => (
              <div
                key={legalCase.id}
                onClick={() => router.push(`/cases/${legalCase.id}`)}
                className="px-4 py-3 hover:bg-[var(--bg-hover)] cursor-pointer flex items-center justify-between transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <StatusBadge
                      variant={legalCase.status === '진행중' ? 'success' : 'neutral'}
                      showDot
                    >
                      {legalCase.status}
                    </StatusBadge>
                  </div>
                  <p className="text-body font-medium text-[var(--text-primary)] truncate">
                    {legalCase.case_name}
                  </p>
                  <div className="flex gap-3 mt-1 text-caption text-[var(--text-muted)]">
                    {legalCase.case_type && <span>{legalCase.case_type}</span>}
                    {legalCase.contract_date && <span>계약일: {formatDate(legalCase.contract_date)}</span>}
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-[var(--text-muted)] ml-3 flex-shrink-0" />
              </div>
            ))}
          </div>
        ) : (
          <div className="py-12 text-center text-[var(--text-muted)] text-sm">
            등록된 사건이 없습니다
          </div>
        )}
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
