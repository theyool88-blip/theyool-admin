'use client'

import { useState } from 'react'
import { X } from 'lucide-react'

export interface WithdrawalFormData {
  withdrawal_date: string
  partner_name: string
  amount: number | string
  withdrawal_type: string
  month_key: string
  description?: string
}

interface WithdrawalFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: WithdrawalFormData) => Promise<void>
}

const PARTNERS = ['김현성', '임은지']
const WITHDRAWAL_TYPES = ['입금', '카드', '현금', '법인지출']

export default function WithdrawalFormModal({ isOpen, onClose, onSubmit }: WithdrawalFormModalProps) {
  const [formData, setFormData] = useState({
    withdrawal_date: new Date().toISOString().slice(0, 10),
    partner_name: '',
    amount: '',
    withdrawal_type: '입금',
    month_key: new Date().toISOString().slice(0, 7),
    description: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!formData.partner_name || !formData.amount) {
      setError('변호사명과 금액은 필수 입력 항목입니다.')
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
        amount: parsedAmount
      })
      onClose()
      setFormData({
        withdrawal_date: new Date().toISOString().slice(0, 10),
        partner_name: '',
        amount: '',
        withdrawal_type: '입금',
        month_key: new Date().toISOString().slice(0, 7),
        description: ''
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : '인출 등록에 실패했습니다.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-sage-200">
          <h2 className="text-lg font-semibold text-sage-800">변호사 인출 등록</h2>
          <button
            onClick={onClose}
            className="text-sage-400 hover:text-sage-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4">
            {/* 인출일 */}
            <div>
              <label className="block text-sm font-medium text-sage-700 mb-2">
                인출일 <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={formData.withdrawal_date}
                onChange={(e) => setFormData({ ...formData, withdrawal_date: e.target.value })}
                className="w-full px-4 py-2 text-sm border border-sage-200 rounded-lg focus:ring-2 focus:ring-sage-500 focus:border-sage-500 transition-colors"
                required
              />
            </div>

            {/* 변호사 */}
            <div>
              <label className="block text-sm font-medium text-sage-700 mb-2">
                변호사 <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.partner_name}
                onChange={(e) => setFormData({ ...formData, partner_name: e.target.value })}
                className="w-full px-4 py-2 text-sm border border-sage-200 rounded-lg focus:ring-2 focus:ring-sage-500 focus:border-sage-500 transition-colors"
                required
              >
                <option value="">선택하세요</option>
                {PARTNERS.map(partner => (
                  <option key={partner} value={partner}>{partner}</option>
                ))}
              </select>
            </div>

            {/* 금액 */}
            <div>
              <label className="block text-sm font-medium text-sage-700 mb-2">
                금액 <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                placeholder="예: 1000000"
                className="w-full px-4 py-2 text-sm border border-sage-200 rounded-lg focus:ring-2 focus:ring-sage-500 focus:border-sage-500 transition-colors"
                required
              />
            </div>

            {/* 인출 유형 */}
            <div>
              <label className="block text-sm font-medium text-sage-700 mb-2">
                인출 유형 <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.withdrawal_type}
                onChange={(e) => setFormData({ ...formData, withdrawal_type: e.target.value })}
                className="w-full px-4 py-2 text-sm border border-sage-200 rounded-lg focus:ring-2 focus:ring-sage-500 focus:border-sage-500 transition-colors"
              >
                {WITHDRAWAL_TYPES.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>

            {/* 정산 월 */}
            <div>
              <label className="block text-sm font-medium text-sage-700 mb-2">
                정산 월 <span className="text-red-500">*</span>
              </label>
              <input
                type="month"
                value={formData.month_key}
                onChange={(e) => setFormData({ ...formData, month_key: e.target.value })}
                className="w-full px-4 py-2 text-sm border border-sage-200 rounded-lg focus:ring-2 focus:ring-sage-500 focus:border-sage-500 transition-colors"
                required
              />
            </div>

            {/* 설명 */}
            <div>
              <label className="block text-sm font-medium text-sage-700 mb-2">
                설명
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                placeholder="추가 설명이나 메모"
                className="w-full px-4 py-2 text-sm border border-sage-200 rounded-lg focus:ring-2 focus:ring-sage-500 focus:border-sage-500 transition-colors"
              />
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 min-h-[44px] text-sm font-medium text-sage-700 bg-white border border-sage-300 rounded-lg hover:bg-sage-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading}
            >
              취소
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 min-h-[44px] text-sm font-medium text-white bg-sage-600 rounded-lg hover:bg-sage-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '저장 중...' : '저장'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
