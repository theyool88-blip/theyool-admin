'use client'

import { useState, useEffect, useCallback, type FormEvent, type KeyboardEvent } from 'react'
import Link from 'next/link'
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
  // NOTE: is_confirmed 컬럼이 스키마에서 제거됨
  const [categoryFilter, setCategoryFilter] = useState<string>('')
  const [depositorSearch, setDepositorSearch] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

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
      if (categoryFilter) params.append('payment_category', categoryFilter)
      if (depositorSearch) params.append('depositor_name', depositorSearch)
      if (fromDate) params.append('from_date', fromDate)
      if (toDate) params.append('to_date', toDate)
      // NOTE: is_confirmed 필터 제거됨 (스키마에서 컬럼 삭제)
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
  }, [categoryFilter, depositorSearch, fromDate, toDate, currentPage, limit])

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

  // NOTE: handleToggleConfirmation 함수 제거됨 (is_confirmed 컬럼 스키마에서 삭제)

  function resetFilters() {
    setCategoryFilter('')
    setDepositorSearch('')
    setFromDate('')
    setToDate('')
    setCurrentPage(1)
  }

  const totalPages = Math.ceil(totalCount / limit) || 1
  const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0)
  // NOTE: confirmedCount, unconfirmedCount 제거됨 (is_confirmed 컬럼 스키마에서 삭제)

  if (loading && payments.length === 0) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)]">
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-[var(--border-default)] border-t-[var(--sage-primary)]"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <div className="max-w-5xl mx-auto pt-6 pb-8 px-4">
        {/* Summary */}
        <div className="flex flex-wrap items-center gap-4 mb-5">
          <div className="flex items-baseline gap-2">
            <span className="text-xs text-[var(--text-tertiary)]">조회 금액</span>
            <span className="text-lg font-medium text-[var(--text-primary)]">{formatCurrency(totalAmount)}</span>
          </div>
          <span className="text-[var(--border-default)]">|</span>
          <span className="text-sm text-[var(--text-tertiary)]">{totalCount}건</span>
        </div>

        {/* Filters */}
        <div className="card p-4 mb-6">
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative w-full sm:w-auto sm:min-w-[180px]">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-4 w-4 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                placeholder="입금인 검색"
                value={depositorSearch}
                onChange={(e) => { setDepositorSearch(e.target.value); setCurrentPage(1) }}
                className="form-input pl-9 pr-3 py-2 text-sm min-h-[40px]"
              />
            </div>

            {/* NOTE: 확인상태 필터 제거됨 (is_confirmed 컬럼 스키마에서 삭제) */}

            <select
              value={categoryFilter}
              onChange={(e) => { setCategoryFilter(e.target.value); setCurrentPage(1) }}
              className="form-input px-3 py-2 text-sm min-h-[40px]"
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
                className="form-input px-3 py-2 text-sm min-h-[40px]"
              />
              <span className="text-[var(--text-muted)]">~</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => { setToDate(e.target.value); setCurrentPage(1) }}
                className="form-input px-3 py-2 text-sm min-h-[40px]"
              />
            </div>

            <button
              onClick={resetFilters}
              className="btn btn-ghost px-3 py-2 text-sm"
            >
              초기화
            </button>

            <div className="flex-1" />

            <button
              onClick={() => exportPaymentsToExcel(payments, `입금내역_${fromDate || 'all'}_${toDate || 'all'}.xlsx`)}
              disabled={payments.length === 0}
              className="btn btn-ghost p-2 disabled:opacity-40 min-w-[40px] min-h-[40px]"
              title="Excel 다운로드"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </button>

            <button
              onClick={() => { setEditingPayment(null); setShowModal(true) }}
              className="btn btn-primary px-4 py-2 text-sm font-medium min-h-[40px]"
            >
              + 입금 추가
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="card">
          {payments.length === 0 ? (
            <div className="py-16 text-center text-[var(--text-muted)]">입금 내역이 없습니다</div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b border-[var(--border-default)] bg-[var(--bg-primary)]">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-tertiary)]">입금일</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-tertiary)]">입금인</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-[var(--text-tertiary)]">입금액</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-tertiary)]">명목</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-tertiary)] min-w-[150px]">사건명</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-tertiary)] min-w-[100px]">메모</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-[var(--text-tertiary)]">작업</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-subtle)]">
                    {payments.map((p) => (
                      <tr key={p.id} className="hover:bg-[var(--bg-hover)]">
                        <td className="px-4 py-3 text-sm text-[var(--text-secondary)]">{p.payment_date}</td>
                        <td className="px-4 py-3 text-sm text-[var(--text-primary)]">{p.depositor_name}</td>
                        <td className="px-4 py-3 text-sm text-right text-[var(--text-primary)]">{formatCurrency(p.amount)}</td>
                        <td className="px-4 py-3 text-sm text-[var(--text-secondary)]">{p.payment_category}</td>
                        <td className="px-4 py-3">
                          {p.case_id ? (
                            <Link href={`/cases/${p.case_id}`} className="text-sm text-[var(--text-secondary)] hover:text-[var(--sage-primary)] hover:underline line-clamp-1">
                              {p.case_name || '-'}
                            </Link>
                          ) : (
                            <span className="text-sm text-[var(--text-muted)]">{p.case_name || '-'}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-[var(--text-tertiary)] line-clamp-1">{p.memo || '-'}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => { setEditingPayment(p); setShowModal(true) }}
                            className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] px-2 py-1 hover:bg-[var(--bg-tertiary)] rounded mr-1"
                          >
                            수정
                          </button>
                          <button
                            onClick={() => handleDelete(p.id)}
                            className="text-xs text-[var(--color-danger)] hover:text-[var(--color-danger)] px-2 py-1 hover:bg-[var(--color-danger-muted)] rounded"
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
              <div className="lg:hidden divide-y divide-[var(--border-subtle)]">
                {payments.map((p) => (
                  <div key={p.id} className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-[var(--text-tertiary)]">{p.payment_date}</span>
                      <span className="text-sm text-[var(--text-primary)]">{formatCurrency(p.amount)}</span>
                    </div>
                    <div className="text-sm text-[var(--text-primary)] mb-1">{p.depositor_name}</div>
                    <div className="text-xs text-[var(--text-tertiary)] mb-2">
                      {p.payment_category}
                      {p.case_name && <span> · {p.case_name}</span>}
                    </div>
                    <div className="flex gap-2 pt-2 border-t border-[var(--border-subtle)]">
                      <button
                        onClick={() => { setEditingPayment(p); setShowModal(true) }}
                        className="btn btn-secondary flex-1 py-2 text-sm"
                      >
                        수정
                      </button>
                      <button
                        onClick={() => handleDelete(p.id)}
                        className="flex-1 py-2 text-sm text-[var(--color-danger)] bg-[var(--color-danger-muted)] hover:bg-[var(--color-danger-muted)] rounded-lg"
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              <div className="px-4 py-3 border-t border-[var(--border-default)] flex items-center justify-between text-sm text-[var(--text-secondary)]">
                <span>{((currentPage - 1) * limit) + 1}-{Math.min(currentPage * limit, totalCount)} / {totalCount}건</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 border border-[var(--border-default)] rounded-lg hover:bg-[var(--bg-hover)] disabled:opacity-40"
                  >
                    이전
                  </button>
                  <span className="px-3 py-1.5">{currentPage} / {totalPages}</span>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1.5 border border-[var(--border-default)] rounded-lg hover:bg-[var(--bg-hover)] disabled:opacity-40"
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
            case_id: linkageType === 'case' ? (formData.case_id || null) : null,
            consultation_id: linkageType === 'consultation' ? (formData.consultation_id || null) : null,
            receipt_type: formData.receipt_type || null,
            // NOTE: is_confirmed 컬럼이 스키마에서 제거됨
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
      <div className="bg-[var(--bg-secondary)] rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-5">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-base font-medium text-[var(--text-primary)]">{payment ? '입금 수정' : '입금 추가'}</h3>
            <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] p-1">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="form-group">
                <label className="form-label">입금일 *</label>
                <input
                  type="date"
                  required
                  value={formData.payment_date}
                  onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
                  className="form-input"
                />
              </div>
              <div className="form-group">
                <label className="form-label">입금인 *</label>
                <input
                  type="text"
                  required
                  value={formData.depositor_name}
                  onChange={(e) => setFormData({ ...formData, depositor_name: e.target.value })}
                  className="form-input"
                />
              </div>
              <div className="form-group">
                <label className="form-label">입금액 *</label>
                <input
                  type="text"
                  required
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="form-input"
                  placeholder="1,000,000"
                />
              </div>
              <div className="form-group">
                <label className="form-label">명목 *</label>
                <select
                  required
                  value={formData.payment_category}
                  onChange={(e) => setFormData({ ...formData, payment_category: e.target.value as PaymentCategory })}
                  className="form-input"
                >
                  <option value="">선택</option>
                  {Object.values(PAYMENT_CATEGORIES).map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">영수증</label>
                <select
                  value={formData.receipt_type}
                  onChange={(e) => setFormData({ ...formData, receipt_type: e.target.value })}
                  className="form-input"
                >
                  <option value="">선택 안 함</option>
                  <option value="카드결제">카드결제</option>
                  <option value="현금">현금</option>
                  <option value="현금영수증">현금영수증</option>
                  <option value="세금계산서">세금계산서</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">전화번호</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label className="form-label">연결 대상</label>
              <div className="flex gap-3 mb-2">
                {(['none', 'case', 'consultation'] as const).map((t) => (
                  <label key={t} className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)]">
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
                      className="text-[var(--sage-primary)]"
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
                    className="form-input flex-1"
                    placeholder={linkageType === 'case' ? '사건명/사건번호' : '이름/전화번호'}
                  />
                  <button
                    type="button"
                    onClick={handleSearch}
                    disabled={searchLoading}
                    className="btn btn-secondary px-3 py-2 text-sm"
                  >
                    {searchLoading ? '...' : '검색'}
                  </button>
                </div>
                {selectedLabel && <p className="text-xs text-[var(--color-success)]">선택됨: {selectedLabel}</p>}
                {searchResults.length > 0 && (
                  <div className="border border-[var(--border-default)] rounded-lg max-h-32 overflow-y-auto">
                    {searchResults.map((item) => {
                      const isCase = linkageType === 'case'
                      const caseItem = item as CaseSearchResult
                      const consultItem = item as ConsultationSearchResult
                      return (
                        <div
                          key={item.id}
                          className="flex items-center justify-between p-2 hover:bg-[var(--bg-hover)] text-sm"
                        >
                          <span className="text-[var(--text-secondary)]">
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
                                }))
                                setSelectedLabel(caseItem.case_name)
                              } else {
                                setFormData(prev => ({ ...prev, consultation_id: consultItem.id }))
                                setSelectedLabel(consultItem.name)
                              }
                            }}
                            className="text-xs text-[var(--sage-primary)] hover:text-[var(--sage-primary)]"
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

            <div className="form-group">
              <label className="form-label">메모</label>
              <textarea
                value={formData.memo}
                onChange={(e) => setFormData({ ...formData, memo: e.target.value })}
                className="form-input resize-none"
                rows={2}
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="btn btn-secondary flex-1 py-2.5 text-sm"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={saving}
                className="btn btn-primary flex-1 py-2.5 text-sm disabled:opacity-50"
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
