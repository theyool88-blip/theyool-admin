'use client'

import { useState } from 'react'
import { X } from 'lucide-react'

export interface RecurringTemplateData {
  name: string
  amount: number | string
  expense_category: string
  subcategory?: string
  office_location?: string
  vendor_name?: string
  day_of_month: string | number
  start_date: string
  end_date?: string
  is_active?: boolean
  memo?: string
}

interface RecurringTemplateFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: RecurringTemplateData) => Promise<void>
  title: string
  initialData?: RecurringTemplateData
}

const CATEGORIES = ['임대료', '인건비', '필수운영비', '마케팅비', '광고비', '세금', '식대', '구독료', '기타']
const LOCATIONS = ['천안', '평택', '공통']

export default function RecurringTemplateFormModal({
  isOpen,
  onClose,
  onSubmit,
  title,
  initialData
}: RecurringTemplateFormModalProps) {
  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    amount: initialData?.amount || '',
    expense_category: initialData?.expense_category || '',
    subcategory: initialData?.subcategory || '',
    office_location: initialData?.office_location || '',
    vendor_name: initialData?.vendor_name || '',
    day_of_month: initialData?.day_of_month || '1',
    start_date: initialData?.start_date || new Date().toISOString().slice(0, 10),
    end_date: initialData?.end_date || '',
    is_active: initialData?.is_active ?? true,
    memo: initialData?.memo || ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!formData.name || !formData.amount || !formData.expense_category) {
      setError('템플릿명, 금액, 카테고리는 필수 입력 항목입니다.')
      return
    }

    const dayOfMonth = parseInt(String(formData.day_of_month))
    if (dayOfMonth < 1 || dayOfMonth > 28) {
      setError('발생일은 1일부터 28일 사이여야 합니다.')
      return
    }

    const parsedAmount = parseInt(formData.amount.toString().replace(/[^0-9]/g, ''), 10)
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('유효한 금액을 입력하세요.')
      return
    }

    setLoading(true)
    try {
      await onSubmit({
        ...formData,
        amount: parsedAmount,
        day_of_month: dayOfMonth,
        end_date: formData.end_date || ''
      })
      onClose()
      // Reset form
      setFormData({
        name: '',
        amount: '',
        expense_category: '',
        subcategory: '',
        office_location: '',
        vendor_name: '',
        day_of_month: '1',
        start_date: new Date().toISOString().slice(0, 10),
        end_date: '',
        is_active: true,
        memo: ''
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : '템플릿 등록에 실패했습니다.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--bg-secondary)] rounded-xl shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
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
            {/* 템플릿명 */}
            <div className="form-group">
              <label className="form-label">
                템플릿명 <span className="text-[var(--color-danger)]">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="예: 사무실 임대료"
                className="form-input"
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
                placeholder="예: 1000000"
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
                placeholder="예: 천안사무실"
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
                placeholder="예: 건물주"
                className="form-input"
              />
            </div>

            {/* 매월 발생일 */}
            <div className="form-group">
              <label className="form-label">
                매월 발생일 <span className="text-[var(--color-danger)]">*</span>
              </label>
              <select
                value={formData.day_of_month}
                onChange={(e) => setFormData({ ...formData, day_of_month: e.target.value })}
                className="form-input"
              >
                {Array.from({ length: 28 }, (_, i) => i + 1).map(day => (
                  <option key={day} value={day}>{day}일</option>
                ))}
              </select>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                월말이 28일보다 짧은 경우 마지막 날에 자동 생성됩니다
              </p>
            </div>

            {/* 시작일 */}
            <div className="form-group">
              <label className="form-label">
                시작일 <span className="text-[var(--color-danger)]">*</span>
              </label>
              <input
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                className="form-input"
                style={{ colorScheme: 'light' }}
                required
              />
            </div>

            {/* 종료일 */}
            <div className="form-group">
              <label className="form-label">
                종료일 (선택사항)
              </label>
              <input
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                className="form-input"
                style={{ colorScheme: 'light' }}
              />
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                비워두면 무기한으로 설정됩니다
              </p>
            </div>

            {/* 활성 여부 */}
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="is_active"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="w-4 h-4 accent-[var(--sage-primary)] rounded"
              />
              <label htmlFor="is_active" className="text-sm font-medium text-[var(--text-secondary)]">
                활성화 (자동 생성 대상에 포함)
              </label>
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
                placeholder="템플릿 설명이나 메모"
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
