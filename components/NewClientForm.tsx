'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import AdminHeader from './AdminHeader'

export default function NewClientForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    birth_date: '',
    address: '',
    gender: '' as 'M' | 'F' | '',
    notes: ''
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      if (!formData.name || !formData.phone) {
        throw new Error('의뢰인 이름과 연락처는 필수입니다')
      }

      const payload = {
        name: formData.name,
        phone: formData.phone,
        email: formData.email || null,
        birth_date: formData.birth_date || null,
        address: formData.address || null,
        gender: formData.gender || null,
        notes: formData.notes || null
      }

      const response = await fetch('/api/admin/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || '의뢰인 등록에 실패했습니다')
      }

      router.push(`/clients/${data.data.id}`)
      router.refresh()
    } catch (err) {
      const message = err instanceof Error ? err.message : '의뢰인 등록에 실패했습니다'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader title="새 의뢰인 등록" />

      <div className="max-w-3xl mx-auto pt-20 pb-8 px-4">
        {/* Back Link */}
        <div className="mb-5">
          <Link
            href="/clients"
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            ← 의뢰인 목록으로
          </Link>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Basic Info */}
          <div className="bg-white rounded-lg border border-gray-200 p-5 mb-4">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">기본 정보</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  이름 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="홍길동"
                  className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sage-500 focus:border-sage-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  연락처 <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="010-1234-5678"
                  className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sage-500 focus:border-sage-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">이메일</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="example@email.com"
                  className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sage-500 focus:border-sage-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">생년월일</label>
                <input
                  type="date"
                  value={formData.birth_date}
                  onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm text-gray-900 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sage-500 focus:border-sage-500"
                  style={{ colorScheme: 'light' }}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">성별</label>
                <select
                  value={formData.gender}
                  onChange={(e) => setFormData({ ...formData, gender: e.target.value as 'M' | 'F' | '' })}
                  className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sage-500 focus:border-sage-500 bg-white"
                >
                  <option value="">선택</option>
                  <option value="M">남성</option>
                  <option value="F">여성</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-gray-500 mb-1">주소</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="경기도 평택시..."
                  className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sage-500 focus:border-sage-500"
                />
              </div>
            </div>
          </div>

          {/* Memo */}
          <div className="bg-white rounded-lg border border-gray-200 p-5 mb-4">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">메모</h2>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={4}
              placeholder="의뢰인에 대한 메모를 입력하세요..."
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sage-500 focus:border-sage-500 resize-none"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-2">
            <Link
              href="/clients"
              className="px-4 py-1.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              취소
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-1.5 text-sm font-medium text-white bg-sage-600 rounded-lg hover:bg-sage-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? '등록 중...' : '의뢰인 등록'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
