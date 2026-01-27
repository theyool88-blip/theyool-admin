'use client'

import { useState } from 'react'
import { X } from 'lucide-react'

export interface ExpenseFormData {
  expense_date: string
  amount: number | string
  expense_category: string
  subcategory?: string
  office_location?: string
  vendor_name?: string
  memo?: string
  payment_method?: string
  is_recurring?: boolean
}

interface ExpenseFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: ExpenseFormData) => Promise<void>
  title: string
  initialData?: ExpenseFormData
}

const CATEGORIES = ['임대료', '인건비', '필수운영비', '마케팅비', '광고비', '세금', '식대', '구독료', '기타']
const LOCATIONS = ['천안', '평택', '공통']
const PAYMENT_METHODS = ['카드', '현금', '계좌이체', '자동이체', '기타']

export default function ExpenseFormModal({ isOpen, onClose, onSubmit, title, initialData }: ExpenseFormModalProps) {
  const [formData, setFormData] = useState({
    expense_date: initialData?.expense_date || new Date().toISOString().slice(0, 10),
    amount: initialData?.amount || '',
    expense_category: initialData?.expense_category || '',
    subcategory: initialData?.subcategory || '',
    office_location: initialData?.office_location || '',
    vendor_name: initialData?.vendor_name || '',
    memo: initialData?.memo || '',
    payment_method: initialData?.payment_method || '카드',
    is_recurring: initialData?.is_recurring || false
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!formData.amount || !formData.expense_category) {
      setError('금액과 카테고리는 필수 입력 항목입니다.')
      return
    }

    setLoading(true)
    try {
      const parsedAmount = parseInt(formData.amount.toString().replace(/[^0-9]/g, ''), 10)
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        setError('유효한 금액을 입력하세요.')
        setLoading(false)
        return
      }

      await onSubmit({
        ...formData,
        amount: parsedAmount
      })
      onClose()
      setFormData({
        expense_date: new Date().toISOString().slice(0, 10),
        amount: '',
        expense_category: '',
        subcategory: '',
        office_location: '',
        vendor_name: '',
        memo: '',
        payment_method: '카드',
        is_recurring: false
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : '지출 등록에 실패했습니다.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--bg-secondary)] rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[var(--border-subtle)]">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">{title}</h2>
          <button
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-[var(--color-danger-muted)] border border-[var(--color-danger)]/20 rounded-lg text-[var(--color-danger)] text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4">
            {/* 지출일 */}
            <div className="form-group">
              <label className="form-label">
                지출일 <span className="text-[var(--color-danger)]">*</span>
              </label>
              <input
                type="date"
                value={formData.expense_date}
                onChange={(e) => setFormData({ ...formData, expense_date: e.target.value })}
                className="form-input"
                style={{ colorScheme: 'light' }}
                required
              />
            </div>

            {/* 금액 */}
            <div className="form-group">
              <label className="form-label">
                금액 <span className="text-[var(--color-danger)]">*</span>
              </label>
              <input
                type="number"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                placeholder="예: 100000"
                className="form-input"
                required
              />
            </div>

            {/* 카테고리 */}
            <div className="form-group">
              <label className="form-label">
                카테고리 <span className="text-[var(--color-danger)]">*</span>
              </label>
              <select
                value={formData.expense_category}
                onChange={(e) => setFormData({ ...formData, expense_category: e.target.value })}
                className="form-input"
                required
              >
                <option value="">선택하세요</option>
                {CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {/* 세부 카테고리 */}
            <div className="form-group">
              <label className="form-label">
                세부 카테고리
              </label>
              <input
                type="text"
                value={formData.subcategory}
                onChange={(e) => setFormData({ ...formData, subcategory: e.target.value })}
                placeholder="예: 사무실 임대료"
                className="form-input"
              />
            </div>

            {/* 지역 */}
            <div className="form-group">
              <label className="form-label">
                지역
              </label>
              <select
                value={formData.office_location}
                onChange={(e) => setFormData({ ...formData, office_location: e.target.value })}
                className="form-input"
              >
                <option value="">선택하세요</option>
                {LOCATIONS.map(loc => (
                  <option key={loc} value={loc}>{loc}</option>
                ))}
              </select>
            </div>

            {/* 공급업체명 */}
            <div className="form-group">
              <label className="form-label">
                공급업체명
              </label>
              <input
                type="text"
                value={formData.vendor_name}
                onChange={(e) => setFormData({ ...formData, vendor_name: e.target.value })}
                placeholder="예: 네이버"
                className="form-input"
              />
            </div>

            {/* 결제 수단 */}
            <div className="form-group">
              <label className="form-label">
                결제 수단
              </label>
              <select
                value={formData.payment_method}
                onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                className="form-input"
              >
                {PAYMENT_METHODS.map(method => (
                  <option key={method} value={method}>{method}</option>
                ))}
              </select>
            </div>

            {/* 메모 */}
            <div className="form-group">
              <label className="form-label">
                메모
              </label>
              <textarea
                value={formData.memo}
                onChange={(e) => setFormData({ ...formData, memo: e.target.value })}
                rows={3}
                placeholder="추가 설명이나 메모를 입력하세요"
                className="form-input resize-none"
              />
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary flex-1"
              disabled={loading}
            >
              취소
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary flex-1"
            >
              {loading ? '저장 중...' : '저장'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
