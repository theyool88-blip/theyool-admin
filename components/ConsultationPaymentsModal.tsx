'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Payment, PaymentCategory, ReceiptType } from '@/types/payment'
import { PAYMENT_CATEGORIES, RECEIPT_TYPES, formatCurrency } from '@/types/payment'

interface ConsultationPaymentsModalProps {
  isOpen: boolean
  onClose: () => void
  consultationId: string
  consultationName: string
  onPaymentAdded?: () => void
}

export default function ConsultationPaymentsModal({
  isOpen,
  onClose,
  consultationId,
  consultationName,
  onPaymentAdded,
}: ConsultationPaymentsModalProps) {
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
        .eq('consultation_id', consultationId)
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
  }, [consultationId, supabase])

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
      alert('삭제되었습니다.')
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

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--bg-secondary)] rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 border-b border-[var(--border-subtle)]">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-[var(--text-primary)]">{consultationName}</h3>
              <p className="text-sm text-[var(--text-muted)] mt-0.5">상담 입금 내역</p>
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
        </div>

        {/* Summary */}
        <div className="flex items-center gap-6 px-6 py-4 bg-[var(--bg-tertiary)] border-b border-[var(--border-subtle)]">
          <div className="bg-[var(--bg-secondary)] px-4 py-2.5 rounded-lg border border-[var(--border-subtle)]">
            <span className="text-sm text-[var(--text-muted)]">총 입금액</span>
            <span className="ml-2 text-sm font-medium text-[var(--text-primary)]">{formatCurrency(totalAmount)}</span>
          </div>
          <div className="text-[var(--border-default)]">|</div>
          <div className="text-sm text-[var(--text-secondary)]">{payments.length}건</div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {showAddForm ? (
            <AddPaymentForm
              consultationId={consultationId}
              depositorName={consultationName}
              onSuccess={handlePaymentAdded}
              onCancel={() => setShowAddForm(false)}
            />
          ) : (
            <>
              {/* Add Button */}
              <div className="mb-5">
                <button
                  onClick={() => setShowAddForm(true)}
                  className="btn btn-primary"
                >
                  + 입금 추가
                </button>
              </div>

              {/* Payments List */}
              {loading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-[var(--border-subtle)] border-t-[var(--sage-primary)] mx-auto"></div>
                  <p className="mt-3 text-sm text-[var(--text-muted)]">불러오는 중...</p>
                </div>
              ) : payments.length === 0 ? (
                <div className="text-center py-12 text-[var(--text-muted)] text-sm">
                  입금 내역이 없습니다.
                </div>
              ) : (
                <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-subtle)] divide-y divide-[var(--border-subtle)] overflow-hidden">
                  {payments.map((payment) => (
                    <div key={payment.id} className="flex items-center px-5 py-4 hover:bg-[var(--bg-hover)] transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-medium text-[var(--text-primary)]">{payment.depositor_name}</span>
                          <span className="text-xs text-[var(--text-muted)]">
                            {(() => {
                              const d = new Date(payment.payment_date)
                              return `${String(d.getFullYear()).slice(2)}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
                            })()}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1.5">
                          {payment.payment_category && (
                            <span className="inline-flex px-2 py-0.5 text-xs font-medium bg-[var(--sage-muted)] text-[var(--sage-primary)] rounded-md">
                              {payment.payment_category}
                            </span>
                          )}
                          {payment.receipt_type && (
                            <span className="text-xs text-[var(--text-muted)]">{payment.receipt_type}</span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-medium text-[var(--text-primary)]">{formatCurrency(payment.amount)}</span>
                      </div>
                      <button
                        onClick={() => handleDelete(payment.id)}
                        className="btn btn-sm btn-danger-ghost ml-4"
                      >
                        삭제
                      </button>
                    </div>
                  ))}
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
  consultationId,
  depositorName,
  onSuccess,
  onCancel,
}: {
  consultationId: string
  depositorName?: string
  onSuccess: () => void
  onCancel: () => void
}) {
  const [formData, setFormData] = useState({
    payment_date: new Date().toISOString().split('T')[0],
    depositor_name: depositorName || '',
    amount: '',
    payment_category: '모든 상담' as PaymentCategory,
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

    const parsedAmount = formData.amount ? parseInt(formData.amount.replace(/,/g, ''), 10) : NaN
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      alert('유효한 금액을 입력하세요.')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/admin/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          consultation_id: consultationId,
          payment_date: formData.payment_date,
          depositor_name: formData.depositor_name,
          amount: parsedAmount,
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

      // Update consultation status to payment_confirmed
      try {
        await fetch(`/api/admin/consultations/${consultationId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'payment_confirmed' })
        })
      } catch (statusError) {
        console.error('Failed to update consultation status:', statusError)
      }

      alert('입금 내역이 추가되었습니다.')
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
      <h4 className="text-lg font-semibold text-[var(--text-primary)] mb-5">입금 추가</h4>

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
          <label className="form-label">입금방법</label>
          <select
            value={formData.receipt_type}
            onChange={(e) => setFormData({ ...formData, receipt_type: e.target.value as ReceiptType | '' })}
            className="form-input"
          >
            <option value="">선택</option>
            {Object.values(RECEIPT_TYPES).map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
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
              <option key={category} value={category}>{category}</option>
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
          type="submit"
          disabled={submitting}
          className="btn btn-primary flex-1"
        >
          {submitting ? '추가 중...' : '추가'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="btn btn-secondary flex-1"
        >
          취소
        </button>
      </div>
    </form>
  )
}
