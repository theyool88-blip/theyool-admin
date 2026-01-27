'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Payment, PaymentCategory, ReceiptType } from '@/types/payment'
import { PAYMENT_CATEGORIES, RECEIPT_TYPES, formatCurrency } from '@/types/payment'

interface CasePaymentsModalProps {
  isOpen: boolean
  onClose: () => void
  caseId: string
  caseName: string
  clientName?: string
  onPaymentAdded?: () => void
}

export default function CasePaymentsModal({
  isOpen,
  onClose,
  caseId,
  caseName,
  clientName,
  onPaymentAdded,
}: CasePaymentsModalProps) {
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [totalAmount, setTotalAmount] = useState(0)
  const supabase = createClient()

  const fetchPayments = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('case_id', caseId)
        .order('payment_date', { ascending: false })

      if (error) throw error

      setPayments(data || [])
      const total = (data || []).reduce((sum, p) => sum + p.amount, 0)
      setTotalAmount(total)
    } catch (error) {
      console.error('Failed to fetch payments:', error)
    } finally {
      setLoading(false)
    }
  }, [caseId, supabase])

  useEffect(() => {
    if (isOpen) {
      fetchPayments()
    }
  }, [fetchPayments, isOpen])

  async function handleDelete(paymentId: string) {
    if (!confirm('이 입금 내역을 삭제하시겠습니까?')) return

    try {
      const res = await fetch(`/api/admin/payments/${paymentId}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error || '삭제 실패')
      }

      await fetchPayments()
      onPaymentAdded?.()
    } catch (error) {
      console.error('Failed to delete payment:', error)
      alert('삭제 실패')
    }
  }

  function handlePaymentAdded() {
    setShowAddForm(false)
    fetchPayments()
    onPaymentAdded?.()
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const yy = String(date.getFullYear()).slice(2)
    const mm = String(date.getMonth() + 1).padStart(2, '0')
    const dd = String(date.getDate()).padStart(2, '0')
    return `${yy}.${mm}.${dd}`
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-[var(--bg-secondary)] rounded-xl shadow-xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 border-b border-[var(--border-subtle)]">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">{caseName}</h2>
              <p className="text-sm text-[var(--text-muted)] mt-0.5">입금 관리</p>
            </div>
            <button
              onClick={onClose}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          {/* Summary */}
          <div className="flex items-center gap-4 mt-4 text-sm">
            <div className="bg-[var(--sage-muted)] px-4 py-2 rounded-lg">
              <span className="text-[var(--text-secondary)]">총 입금액</span>
              <span className="ml-2 font-medium text-[var(--text-primary)]">{formatCurrency(totalAmount)}</span>
            </div>
            <div className="text-[var(--border-default)]">|</div>
            <span className="text-[var(--text-secondary)]">{payments.length}건</span>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {showAddForm ? (
            <AddPaymentForm
              caseId={caseId}
              caseName={caseName}
              clientName={clientName}
              onSuccess={handlePaymentAdded}
              onCancel={() => setShowAddForm(false)}
            />
          ) : (
            <>
              {/* Add Button */}
              <button
                onClick={() => setShowAddForm(true)}
                className="btn btn-primary mb-5"
              >
                + 입금 추가
              </button>

              {/* Payments List */}
              {loading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-[var(--border-subtle)] border-t-[var(--sage-primary)] mx-auto"></div>
                  <p className="mt-3 text-sm text-[var(--text-muted)]">불러오는 중...</p>
                </div>
              ) : payments.length === 0 ? (
                <div className="text-center py-12 text-[var(--text-muted)] text-sm">
                  입금 내역이 없습니다
                </div>
              ) : (
                <div className="border border-[var(--border-subtle)] rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-[var(--bg-tertiary)]">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">일자</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">입금자</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">금액</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">명목</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">삭제</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-subtle)] bg-[var(--bg-secondary)]">
                      {payments.map((payment) => (
                        <tr key={payment.id} className="hover:bg-[var(--bg-hover)] transition-colors">
                          <td className="px-4 py-3 text-sm text-[var(--text-secondary)]">
                            {formatDate(payment.payment_date)}
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-[var(--text-primary)]">
                            {payment.depositor_name}
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-medium text-[var(--text-primary)]">
                            {formatCurrency(payment.amount)}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-md ${
                              payment.payment_category === '환불'
                                ? 'bg-[var(--color-danger-muted)] text-[var(--color-danger)]'
                                : 'bg-[var(--sage-muted)] text-[var(--sage-primary)]'
                            }`}>
                              {payment.payment_category}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => handleDelete(payment.id)}
                              className="btn btn-sm btn-danger-ghost"
                            >
                              삭제
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[var(--border-subtle)] bg-[var(--bg-tertiary)]">
          <button
            onClick={onClose}
            className="btn btn-secondary"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}

// Add Payment Form Component
function AddPaymentForm({
  caseId,
  caseName,
  clientName,
  onSuccess,
  onCancel,
}: {
  caseId: string
  caseName: string
  clientName?: string
  onSuccess: () => void
  onCancel: () => void
}) {
  const [formData, setFormData] = useState({
    payment_date: new Date().toISOString().split('T')[0],
    depositor_name: clientName || '',
    amount: '',
    payment_category: '' as PaymentCategory | '',
    receipt_type: '' as ReceiptType | '',
    memo: '',
  })
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!formData.depositor_name || !formData.amount || !formData.payment_category) {
      alert('필수 항목을 입력해주세요.')
      return
    }

    // 환불인 경우 음수 허용, 그 외에는 양수만
    const isRefund = formData.payment_category === '환불'
    const amountStr = formData.amount.replace(/,/g, '').replace(/^-/, '')
    const parsedAmount = parseInt(amountStr, 10)
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      alert('유효한 금액을 입력하세요.')
      return
    }
    const finalAmount = isRefund ? -Math.abs(parsedAmount) : parsedAmount

    setSubmitting(true)
    try {
      const res = await fetch('/api/admin/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          case_id: caseId,
          case_name: caseName,
          payment_date: formData.payment_date,
          depositor_name: formData.depositor_name,
          amount: finalAmount,
          payment_category: formData.payment_category,
          receipt_type: formData.receipt_type || null,
          memo: formData.memo || null,
          is_confirmed: true,
        })
      })

      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error || '입금 내역 추가 실패')
      }

      onSuccess()
    } catch (error) {
      console.error('Failed to add payment:', error)
      alert('입금 내역 추가 실패')
    } finally {
      setSubmitting(false)
    }
  }

  function handleAmountChange(value: string) {
    const numbers = value.replace(/[^0-9]/g, '')
    const formatted = numbers ? parseInt(numbers).toLocaleString('ko-KR') : ''
    setFormData({ ...formData, amount: formatted })
  }

  return (
    <form onSubmit={handleSubmit} className="bg-[var(--sage-muted)] rounded-xl p-5 border border-[var(--border-subtle)]">
      <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-5">입금 추가</h3>

      <div className="grid grid-cols-2 gap-4">
        <div className="form-group">
          <label className="form-label">
            입금일 <span className="text-[var(--color-danger)]">*</span>
          </label>
          <input
            type="date"
            value={formData.payment_date}
            onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
            className="form-input"
            style={{ colorScheme: 'light' }}
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label">
            입금자명 <span className="text-[var(--color-danger)]">*</span>
          </label>
          <input
            type="text"
            value={formData.depositor_name}
            onChange={(e) => setFormData({ ...formData, depositor_name: e.target.value })}
            className="form-input"
            placeholder="홍길동"
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label">
            금액 <span className="text-[var(--color-danger)]">*</span>
          </label>
          <input
            type="text"
            value={formData.amount}
            onChange={(e) => handleAmountChange(e.target.value)}
            className="form-input"
            placeholder="1,000,000"
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label">
            명목 <span className="text-[var(--color-danger)]">*</span>
          </label>
          <select
            value={formData.payment_category}
            onChange={(e) => setFormData({ ...formData, payment_category: e.target.value as PaymentCategory })}
            className="form-input"
            required
          >
            <option value="">선택</option>
            {Object.values(PAYMENT_CATEGORIES).map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">입금방법</label>
          <select
            value={formData.receipt_type}
            onChange={(e) => setFormData({ ...formData, receipt_type: e.target.value as ReceiptType | '' })}
            className="form-input"
          >
            <option value="">선택</option>
            {Object.values(RECEIPT_TYPES).map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group col-span-2">
          <label className="form-label">메모</label>
          <input
            type="text"
            value={formData.memo}
            onChange={(e) => setFormData({ ...formData, memo: e.target.value })}
            className="form-input"
            placeholder="메모 (선택)"
          />
        </div>
      </div>

      <div className="flex gap-3 mt-6">
        <button
          type="button"
          onClick={onCancel}
          className="btn btn-secondary flex-1"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="btn btn-primary flex-1"
        >
          {submitting ? '처리중...' : '추가'}
        </button>
      </div>
    </form>
  )
}
