'use client'

import { useState, useEffect, useCallback, type FormEvent, type KeyboardEvent } from 'react'
import Link from 'next/link'
import AdminHeader from '@/components/AdminHeader'
import type { Payment, PaymentCategory } from '@/types/payment'
import { PAYMENT_CATEGORIES, formatCurrency } from '@/types/payment'
import { exportPaymentsToExcel } from '@/lib/excel-export'

type CaseSearchResult = {
  id: string
  case_name: string
  court_case_number?: string | null
  contract_number?: string | null
  office?: string | null
  client?: { name?: string | null } | null
}

type ConsultationSearchResult = {
  id: string
  name: string
  phone?: string | null
  request_type?: string | null
}

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [totalCount, setTotalCount] = useState(0)

  // Filters
  const [officeFilter, setOfficeFilter] = useState<string>('')
  const [categoryFilter, setCategoryFilter] = useState<string>('')
  const [depositorSearch, setDepositorSearch] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [confirmationFilter, setConfirmationFilter] = useState<string>('false')

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [limit] = useState(50)

  // Modal state
  const [showModal, setShowModal] = useState(false)
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null)

  const fetchPayments = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (officeFilter) params.append('office_location', officeFilter)
      if (categoryFilter) params.append('payment_category', categoryFilter)
      if (depositorSearch) params.append('depositor_name', depositorSearch)
      if (fromDate) params.append('from_date', fromDate)
      if (toDate) params.append('to_date', toDate)
      if (confirmationFilter) params.append('is_confirmed', confirmationFilter)
      params.append('limit', limit.toString())
      params.append('offset', ((currentPage - 1) * limit).toString())
      params.append('sort_by', 'payment_date')
      params.append('sort_order', 'desc')

      const res = await fetch(`/api/admin/payments?${params}`)
      const json = await res.json()

      if (json.data) {
        setPayments(json.data)
        setTotalCount(json.count || 0)
      }
    } catch (error) {
      console.error('Failed to fetch payments:', error)
    } finally {
      setLoading(false)
    }
  }, [officeFilter, categoryFilter, depositorSearch, fromDate, toDate, confirmationFilter, currentPage, limit])

  useEffect(() => {
    fetchPayments()
  }, [fetchPayments])

  async function handleDelete(id: string) {
    if (!confirm('이 입금 내역을 삭제하시겠습니까?')) return
    try {
      const res = await fetch(`/api/admin/payments/${id}`, { method: 'DELETE' })
      if (res.ok) fetchPayments()
      else alert('삭제 실패')
    } catch {
      alert('삭제 실패')
    }
  }

  async function handleToggleConfirmation(payment: Payment) {
    try {
      const res = await fetch(`/api/admin/payments/${payment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_confirmed: !payment.is_confirmed }),
      })
      if (res.ok) fetchPayments()
    } catch {
      alert('상태 변경 실패')
    }
  }

  function resetFilters() {
    setOfficeFilter('')
    setCategoryFilter('')
    setDepositorSearch('')
    setFromDate('')
    setToDate('')
    setConfirmationFilter('false')
    setCurrentPage(1)
  }

  const totalPages = Math.ceil(totalCount / limit) || 1
  const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0)
  const confirmedCount = payments.filter(p => p.is_confirmed).length
  const unconfirmedCount = payments.filter(p => !p.is_confirmed).length

  if (loading && payments.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <AdminHeader title="수금 관리" />
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-sage-600"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader title="수금 관리" />

      <div className="max-w-5xl mx-auto pt-20 pb-8 px-4">
        {/* Summary */}
        <div className="flex flex-wrap items-center gap-4 mb-5">
          <div className="flex items-baseline gap-2">
            <span className="text-xs text-gray-500">조회 금액</span>
            <span className="text-lg font-bold text-green-600">{formatCurrency(totalAmount)}</span>
          </div>
          <span className="text-gray-300">|</span>
          <span className="text-sm text-gray-500">{totalCount}건</span>
          {confirmedCount > 0 && (
            <span className="text-xs text-gray-500">확인 {confirmedCount}</span>
          )}
          {unconfirmedCount > 0 && (
            <span className="text-xs text-amber-600">미확인 {unconfirmedCount}</span>
          )}
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative w-full sm:w-auto sm:min-w-[180px]">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                placeholder="입금인 검색"
                value={depositorSearch}
                onChange={(e) => { setDepositorSearch(e.target.value); setCurrentPage(1) }}
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-sage-500 focus:border-sage-500 min-h-[40px]"
              />
            </div>

            {/* Status Filter */}
            <div className="flex bg-gray-100 rounded-lg p-0.5">
              {[
                { value: '', label: '전체' },
                { value: 'false', label: '미확인' },
                { value: 'true', label: '확인' },
              ].map((s) => (
                <button
                  key={s.value}
                  onClick={() => { setConfirmationFilter(s.value); setCurrentPage(1) }}
                  className={`px-3 py-1.5 rounded-md text-sm transition-all ${
                    confirmationFilter === s.value
                      ? 'bg-white text-gray-900 shadow-sm font-medium'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            <select
              value={officeFilter}
              onChange={(e) => { setOfficeFilter(e.target.value); setCurrentPage(1) }}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm min-h-[40px]"
            >
              <option value="">전체 사무소</option>
              <option value="평택">평택</option>
              <option value="천안">천안</option>
            </select>

            <select
              value={categoryFilter}
              onChange={(e) => { setCategoryFilter(e.target.value); setCurrentPage(1) }}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm min-h-[40px]"
            >
              <option value="">전체 명목</option>
              {Object.values(PAYMENT_CATEGORIES).map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>

            <div className="flex items-center gap-2">
              <input
                type="date"
                value={fromDate}
                onChange={(e) => { setFromDate(e.target.value); setCurrentPage(1) }}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm min-h-[40px]"
              />
              <span className="text-gray-400">~</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => { setToDate(e.target.value); setCurrentPage(1) }}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm min-h-[40px]"
              />
            </div>

            <button
              onClick={resetFilters}
              className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              초기화
            </button>

            <div className="flex-1" />

            <button
              onClick={() => exportPaymentsToExcel(payments, `입금내역_${fromDate || 'all'}_${toDate || 'all'}.xlsx`)}
              disabled={payments.length === 0}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg disabled:opacity-40 min-w-[40px] min-h-[40px]"
              title="Excel 다운로드"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </button>

            <button
              onClick={() => { setEditingPayment(null); setShowModal(true) }}
              className="px-4 py-2 bg-sage-600 text-white text-sm font-medium rounded-lg hover:bg-sage-700 min-h-[40px]"
            >
              + 입금 추가
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg border border-gray-200">
          {payments.length === 0 ? (
            <div className="py-16 text-center text-gray-400">입금 내역이 없습니다</div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b border-gray-200 bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">상태</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">입금일</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">입금인</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">입금액</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">사무실</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">명목</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 min-w-[150px]">사건명</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 min-w-[100px]">메모</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">작업</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {payments.map((p) => (
                      <tr key={p.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <button
                            onClick={() => handleToggleConfirmation(p)}
                            className={`text-xs px-2 py-0.5 rounded ${
                              p.is_confirmed
                                ? 'bg-green-100 text-green-700'
                                : 'bg-amber-100 text-amber-700'
                            }`}
                          >
                            {p.is_confirmed ? '확인' : '미확인'}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">{p.payment_date}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{p.depositor_name}</td>
                        <td className="px-4 py-3 text-sm text-right text-gray-900">{formatCurrency(p.amount)}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{p.office_location || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{p.payment_category}</td>
                        <td className="px-4 py-3">
                          {p.case_id ? (
                            <Link href={`/cases/${p.case_id}`} className="text-sm text-gray-700 hover:text-sage-600 hover:underline line-clamp-1">
                              {p.case_name || '-'}
                            </Link>
                          ) : (
                            <span className="text-sm text-gray-400">{p.case_name || '-'}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500 line-clamp-1">{p.memo || '-'}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => { setEditingPayment(p); setShowModal(true) }}
                            className="text-xs text-gray-600 hover:text-gray-800 px-2 py-1 hover:bg-gray-100 rounded mr-1"
                          >
                            수정
                          </button>
                          <button
                            onClick={() => handleDelete(p.id)}
                            className="text-xs text-red-500 hover:text-red-700 px-2 py-1 hover:bg-red-50 rounded"
                          >
                            삭제
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile */}
              <div className="lg:hidden divide-y divide-gray-100">
                {payments.map((p) => (
                  <div key={p.id} className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleToggleConfirmation(p)}
                          className={`text-xs px-2 py-0.5 rounded ${
                            p.is_confirmed ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {p.is_confirmed ? '확인' : '미확인'}
                        </button>
                        <span className="text-xs text-gray-500">{p.payment_date}</span>
                      </div>
                      <span className="text-sm text-gray-900">{formatCurrency(p.amount)}</span>
                    </div>
                    <div className="text-sm text-gray-900 mb-1">{p.depositor_name}</div>
                    <div className="text-xs text-gray-500 mb-2">
                      {p.office_location && <span>{p.office_location} · </span>}
                      {p.payment_category}
                      {p.case_name && <span> · {p.case_name}</span>}
                    </div>
                    <div className="flex gap-2 pt-2 border-t border-gray-100">
                      <button
                        onClick={() => { setEditingPayment(p); setShowModal(true) }}
                        className="flex-1 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg"
                      >
                        수정
                      </button>
                      <button
                        onClick={() => handleDelete(p.id)}
                        className="flex-1 py-2 text-sm text-red-600 bg-red-50 hover:bg-red-100 rounded-lg"
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between text-sm text-gray-600">
                <span>{((currentPage - 1) * limit) + 1}-{Math.min(currentPage * limit, totalCount)} / {totalCount}건</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40"
                  >
                    이전
                  </button>
                  <span className="px-3 py-1.5">{currentPage} / {totalPages}</span>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40"
                  >
                    다음
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {showModal && (
          <PaymentFormModal
            payment={editingPayment}
            onClose={() => { setShowModal(false); setEditingPayment(null) }}
            onSave={() => { setShowModal(false); setEditingPayment(null); fetchPayments() }}
          />
        )}
      </div>
    </div>
  )
}

// Simple Modal
function PaymentFormModal({
  payment,
  onClose,
  onSave,
}: {
  payment: Payment | null
  onClose: () => void
  onSave: () => void
}) {
  const [linkageType, setLinkageType] = useState<'none' | 'case' | 'consultation'>(
    payment?.case_id ? 'case' : payment?.consultation_id ? 'consultation' : 'none'
  )
  const [searchTerm, setSearchTerm] = useState('')
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchResults, setSearchResults] = useState<Array<CaseSearchResult | ConsultationSearchResult>>([])
  const [selectedLabel, setSelectedLabel] = useState('')
  const [formData, setFormData] = useState({
    payment_date: payment?.payment_date || new Date().toISOString().split('T')[0],
    depositor_name: payment?.depositor_name || '',
    amount: payment ? payment.amount.toLocaleString('ko-KR') : '',
    office_location: payment?.office_location || '',
    payment_category: payment?.payment_category || '',
    case_id: payment?.case_id || '',
    case_name: payment?.case_name || '',
    consultation_id: payment?.consultation_id || '',
    phone: payment?.phone || '',
    memo: payment?.memo || '',
    receipt_type: payment?.receipt_type || '',
  })
  const [saving, setSaving] = useState(false)

  const handleSearch = async () => {
    if (!searchTerm.trim()) return
    setSearchLoading(true)
    try {
      const endpoint = linkageType === 'case' ? 'cases' : 'consultations'
      const res = await fetch(`/api/admin/${endpoint}/search?q=${encodeURIComponent(searchTerm.trim())}`)
      const json = await res.json()
      setSearchResults(json.data || [])
    } catch {
      alert('검색 실패')
    } finally {
      setSearchLoading(false)
    }
  }

  const handleSearchKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); handleSearch() }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const parsedAmount = parseInt(formData.amount.replace(/[^0-9]/g, ''), 10)
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        alert('유효한 입금액을 입력하세요.')
        setSaving(false)
        return
      }

      const res = await fetch(
        payment ? `/api/admin/payments/${payment.id}` : '/api/admin/payments',
        {
          method: payment ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...formData,
            amount: parsedAmount,
            office_location: formData.office_location || null,
            case_id: linkageType === 'case' ? (formData.case_id || null) : null,
            consultation_id: linkageType === 'consultation' ? (formData.consultation_id || null) : null,
            receipt_type: formData.receipt_type || null,
            is_confirmed: true,
          }),
        }
      )
      if (res.ok) onSave()
      else alert('저장 실패')
    } catch {
      alert('저장 실패')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-5">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-base font-medium text-gray-900">{payment ? '입금 수정' : '입금 추가'}</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">입금일 *</label>
                <input
                  type="date"
                  required
                  value={formData.payment_date}
                  onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-sage-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">입금인 *</label>
                <input
                  type="text"
                  required
                  value={formData.depositor_name}
                  onChange={(e) => setFormData({ ...formData, depositor_name: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-sage-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">입금액 *</label>
                <input
                  type="text"
                  required
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-sage-500"
                  placeholder="1,000,000"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">사무실</label>
                <select
                  value={formData.office_location}
                  onChange={(e) => setFormData({ ...formData, office_location: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-sage-500"
                >
                  <option value="">미지정</option>
                  <option value="평택">평택</option>
                  <option value="천안">천안</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">명목 *</label>
                <select
                  required
                  value={formData.payment_category}
                  onChange={(e) => setFormData({ ...formData, payment_category: e.target.value as PaymentCategory })}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-sage-500"
                >
                  <option value="">선택</option>
                  {Object.values(PAYMENT_CATEGORIES).map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">영수증</label>
                <select
                  value={formData.receipt_type}
                  onChange={(e) => setFormData({ ...formData, receipt_type: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-sage-500"
                >
                  <option value="">선택 안 함</option>
                  <option value="카드결제">카드결제</option>
                  <option value="현금">현금</option>
                  <option value="현금영수증">현금영수증</option>
                  <option value="세금계산서">세금계산서</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">전화번호</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-sage-500"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">연결 대상</label>
              <div className="flex gap-3 mb-2">
                {(['none', 'case', 'consultation'] as const).map((t) => (
                  <label key={t} className="flex items-center gap-1.5 text-sm text-gray-700">
                    <input
                      type="radio"
                      name="linkage"
                      checked={linkageType === t}
                      onChange={() => {
                        setLinkageType(t)
                        setSearchResults([])
                        setSearchTerm('')
                        setSelectedLabel('')
                      }}
                      className="text-sage-600"
                    />
                    {t === 'none' ? '미연결' : t === 'case' ? '사건' : '상담'}
                  </label>
                ))}
              </div>
            </div>

            {linkageType !== 'none' && (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={handleSearchKeyDown}
                    className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-sage-500"
                    placeholder={linkageType === 'case' ? '사건명/사건번호' : '이름/전화번호'}
                  />
                  <button
                    type="button"
                    onClick={handleSearch}
                    disabled={searchLoading}
                    className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                  >
                    {searchLoading ? '...' : '검색'}
                  </button>
                </div>
                {selectedLabel && <p className="text-xs text-green-600">선택됨: {selectedLabel}</p>}
                {searchResults.length > 0 && (
                  <div className="border border-gray-200 rounded-lg max-h-32 overflow-y-auto">
                    {searchResults.map((item) => {
                      const isCase = linkageType === 'case'
                      const caseItem = item as CaseSearchResult
                      const consultItem = item as ConsultationSearchResult
                      return (
                        <div
                          key={item.id}
                          className="flex items-center justify-between p-2 hover:bg-gray-50 text-sm"
                        >
                          <span className="text-gray-700">
                            {isCase ? caseItem.case_name : consultItem.name}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              if (isCase) {
                                setFormData(prev => ({
                                  ...prev,
                                  case_id: caseItem.id,
                                  case_name: caseItem.case_name,
                                  office_location: caseItem.office === '평택' || caseItem.office === '천안' ? caseItem.office : prev.office_location,
                                }))
                                setSelectedLabel(caseItem.case_name)
                              } else {
                                setFormData(prev => ({ ...prev, consultation_id: consultItem.id }))
                                setSelectedLabel(consultItem.name)
                              }
                            }}
                            className="text-xs text-sage-600 hover:text-sage-700"
                          >
                            선택
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="block text-xs text-gray-500 mb-1">메모</label>
              <textarea
                value={formData.memo}
                onChange={(e) => setFormData({ ...formData, memo: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-sage-500 resize-none"
                rows={2}
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 py-2.5 text-sm text-white bg-sage-600 rounded-lg hover:bg-sage-700 disabled:opacity-50"
              >
                {saving ? '저장 중...' : '저장'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
