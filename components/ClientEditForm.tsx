'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import AdminHeader from './AdminHeader'

interface Client {
  id: string
  name: string
  phone: string | null
  email: string | null
  address: string | null
  birth_date: string | null
  gender: 'M' | 'F' | null
  account_number: string | null
  resident_number: string | null
  notes: string | null
}

interface Profile {
  id: string
  name: string
  email: string
  role: string
}

export default function ClientEditForm({ profile, clientData }: { profile: Profile, clientData: Client }) {
  const router = useRouter()
  const supabase = createClient()
  const [saving, setSaving] = useState(false)

  const [formData, setFormData] = useState({
    name: clientData.name || '',
    resident_number: clientData.resident_number || '',
    phone: clientData.phone || '',
    email: clientData.email || '',
    birth_date: clientData.birth_date || '',
    gender: clientData.gender || '',
    address: clientData.address || '',
    account_number: clientData.account_number || '',
    notes: clientData.notes || '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      const { error } = await supabase
        .from('clients')
        .update({
          name: formData.name,
          resident_number: formData.resident_number || null,
          phone: formData.phone || null,
          email: formData.email || null,
          birth_date: formData.birth_date || null,
          gender: formData.gender || null,
          address: formData.address || null,
          account_number: formData.account_number || null,
          notes: formData.notes || null,
        })
        .eq('id', clientData.id)

      if (error) throw error

      alert('저장되었습니다.')
      router.push(`/clients/${clientData.id}`)
      router.refresh()
    } catch (error) {
      console.error('Error:', error)
      alert('저장 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader title="의뢰인 수정" subtitle={clientData.name} />

      <div className="max-w-3xl mx-auto pt-20 pb-8 px-4">
        {/* Back Link */}
        <div className="mb-5">
          <Link
            href={`/clients/${clientData.id}`}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            ← 상세보기로 돌아가기
          </Link>
        </div>

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
                  className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sage-500 focus:border-sage-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">주민등록번호</label>
                <input
                  type="text"
                  value={formData.resident_number}
                  onChange={(e) => setFormData({ ...formData, resident_number: e.target.value })}
                  placeholder="000000-0000000"
                  className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sage-500 focus:border-sage-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">연락처</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="010-0000-0000"
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
                  className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sage-500 focus:border-sage-500"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-gray-500 mb-1">계좌번호</label>
                <input
                  type="text"
                  value={formData.account_number}
                  onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                  placeholder="은행명 000-0000-0000"
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
              href={`/clients/${clientData.id}`}
              className="px-4 py-1.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              취소
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-1.5 text-sm font-medium text-white bg-sage-600 rounded-lg hover:bg-sage-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
