'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Payment, PaymentCategory, ReceiptType, OfficeLocation } from '@/types/payment'
import { PAYMENT_CATEGORIES, RECEIPT_TYPES, formatCurrency } from '@/types/payment'

interface CasePaymentsModalProps {
  isOpen: boolean
  onClose: () => void
  caseId: string
  caseName: string
  clientName?: string
  officeLocation?: OfficeLocation
  onPaymentAdded?: () => void
}

export default function CasePaymentsModal({
  isOpen,
  onClose,
  caseId,
  caseName,
  clientName,
  officeLocation,
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
    return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 border-b border-sage-100">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-sage-800">{caseName}</h2>
              <p className="text-sm text-sage-500 mt-0.5">입금 관리</p>
            </div>
            <button
              onClick={onClose}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center text-sage-400 hover:text-sage-600 hover:bg-sage-50 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          {/* Summary */}
          <div className="flex items-center gap-4 mt-4 text-sm">
            <div className="bg-sage-50 px-4 py-2 rounded-lg">
              <span className="text-sage-600">총 입금액</span>
              <span className="ml-2 font-semibold text-sage-800">{formatCurrency(totalAmount)}</span>
            </div>
            <div className="text-sage-300">|</div>
            <span className="text-sage-600">{payments.length}건</span>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {showAddForm ? (
            <AddPaymentForm
              caseId={caseId}
              caseName={caseName}
              clientName={clientName}
              officeLocation={officeLocation}
              onSuccess={handlePaymentAdded}
              onCancel={() => setShowAddForm(false)}
            />
          ) : (
            <>
              {/* Add Button */}
              <button
                onClick={() => setShowAddForm(true)}
                className="mb-5 px-4 py-2.5 min-h-[44px] text-sm font-medium bg-sage-600 text-white rounded-lg hover:bg-sage-700 transition-colors"
              >
                + 입금 추가
              </button>

              {/* Payments List */}
              {loading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-sage-200 border-t-sage-600 mx-auto"></div>
                  <p className="mt-3 text-sm text-sage-500">불러오는 중...</p>
                </div>
              ) : payments.length === 0 ? (
                <div className="text-center py-12 text-sage-400 text-sm">
                  입금 내역이 없습니다
                </div>
              ) : (
                <div className="border border-sage-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-sage-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-sage-500 uppercase tracking-wider">일자</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-sage-500 uppercase tracking-wider">입금자</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-sage-500 uppercase tracking-wider">금액</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-sage-500 uppercase tracking-wider">명목</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-sage-500 uppercase tracking-wider">삭제</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-sage-100 bg-white">
                      {payments.map((payment) => (
                        <tr key={payment.id} className="hover:bg-sage-50 transition-colors">
                          <td className="px-4 py-3 text-sm text-sage-600">
                            {formatDate(payment.payment_date)}
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-sage-800">
                            {payment.depositor_name}
                          </td>
                          <td className={`px-4 py-3 text-sm text-right font-medium ${payment.amount < 0 ? 'text-coral-600' : 'text-sage-800'}`}>
                            {formatCurrency(payment.amount)}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-md ${
                              payment.payment_category === '환불'
                                ? 'bg-coral-50 text-coral-700'
                                : 'bg-sage-100 text-sage-700'
                            }`}>
                              {payment.payment_category}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => handleDelete(payment.id)}
                              className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-xs text-coral-500 hover:text-coral-700 hover:bg-coral-50 rounded-lg transition-colors"
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
        <div className="px-6 py-4 border-t border-sage-100 bg-sage-50">
          <button
            onClick={onClose}
            className="px-4 py-2.5 min-h-[44px] text-sm font-medium bg-white border border-sage-300 text-sage-700 rounded-lg hover:bg-sage-50 transition-colors"
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
  officeLocation,
  onSuccess,
  onCancel,
}: {
  caseId: string
  caseName: string
  clientName?: string
  officeLocation?: OfficeLocation
  onSuccess: () => void
  onCancel: () => void
}) {
  const [formData, setFormData] = useState({
    payment_date: new Date().toISOString().split('T')[0],
    depositor_name: clientName || '',
    amount: '',
    payment_category: '' as PaymentCategory | '',
    receipt_type: '' as ReceiptType | '',
    office_location: (officeLocation || '') as '평택' | '천안' | '',
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
          office_location: formData.office_location || null,
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
    <form onSubmit={handleSubmit} className="bg-sage-50 rounded-xl p-5 border border-sage-200">
      <h3 className="text-lg font-semibold text-sage-800 mb-5">입금 추가</h3>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-sage-700 mb-1.5">
            입금일 <span className="text-coral-500">*</span>
          </label>
          <input
            type="date"
            value={formData.payment_date}
            onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
            className="w-full px-3 py-2.5 text-sm border border-sage-200 rounded-lg bg-white focus:outline-none focus:border-sage-500 focus:ring-2 focus:ring-sage-500/20 transition-colors"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-sage-700 mb-1.5">
            입금자명 <span className="text-coral-500">*</span>
          </label>
          <input
            type="text"
            value={formData.depositor_name}
            onChange={(e) => setFormData({ ...formData, depositor_name: e.target.value })}
            className="w-full px-3 py-2.5 text-sm border border-sage-200 rounded-lg bg-white focus:outline-none focus:border-sage-500 focus:ring-2 focus:ring-sage-500/20 transition-colors"
            placeholder="홍길동"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-sage-700 mb-1.5">
            금액 <span className="text-coral-500">*</span>
          </label>
          <input
            type="text"
            value={formData.amount}
            onChange={(e) => handleAmountChange(e.target.value)}
            className="w-full px-3 py-2.5 text-sm border border-sage-200 rounded-lg bg-white focus:outline-none focus:border-sage-500 focus:ring-2 focus:ring-sage-500/20 transition-colors"
            placeholder="1,000,000"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-sage-700 mb-1.5">
            명목 <span className="text-coral-500">*</span>
          </label>
          <select
            value={formData.payment_category}
            onChange={(e) => setFormData({ ...formData, payment_category: e.target.value as PaymentCategory })}
            className="w-full px-3 py-2.5 text-sm border border-sage-200 rounded-lg bg-white focus:outline-none focus:border-sage-500 focus:ring-2 focus:ring-sage-500/20 transition-colors"
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

        <div>
          <label className="block text-sm font-medium text-sage-700 mb-1.5">
            입금방법
          </label>
          <select
            value={formData.receipt_type}
            onChange={(e) => setFormData({ ...formData, receipt_type: e.target.value as ReceiptType | '' })}
            className="w-full px-3 py-2.5 text-sm border border-sage-200 rounded-lg bg-white focus:outline-none focus:border-sage-500 focus:ring-2 focus:ring-sage-500/20 transition-colors"
          >
            <option value="">선택</option>
            {Object.values(RECEIPT_TYPES).map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-sage-700 mb-1.5">
            사무소
          </label>
          <select
            value={formData.office_location}
            onChange={(e) => setFormData({ ...formData, office_location: e.target.value as '평택' | '천안' | '' })}
            className="w-full px-3 py-2.5 text-sm border border-sage-200 rounded-lg bg-white focus:outline-none focus:border-sage-500 focus:ring-2 focus:ring-sage-500/20 transition-colors"
          >
            <option value="">선택</option>
            <option value="평택">평택</option>
            <option value="천안">천안</option>
          </select>
        </div>

        <div className="col-span-2">
          <label className="block text-sm font-medium text-sage-700 mb-1.5">
            메모
          </label>
          <input
            type="text"
            value={formData.memo}
            onChange={(e) => setFormData({ ...formData, memo: e.target.value })}
            className="w-full px-3 py-2.5 text-sm border border-sage-200 rounded-lg bg-white focus:outline-none focus:border-sage-500 focus:ring-2 focus:ring-sage-500/20 transition-colors"
            placeholder="메모 (선택)"
          />
        </div>
      </div>

      <div className="flex gap-3 mt-6">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-2.5 min-h-[44px] text-sm font-medium bg-white border border-sage-300 text-sage-700 rounded-lg hover:bg-sage-50 transition-colors"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="flex-1 py-2.5 min-h-[44px] text-sm font-medium bg-sage-600 text-white rounded-lg hover:bg-sage-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {submitting ? '처리중...' : '추가'}
        </button>
      </div>
    </form>
  )
}
