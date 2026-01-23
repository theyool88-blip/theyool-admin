'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function NewClientForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    birth_date: '',
    resident_number: '',
    address: '',
    bank_account: '',
    client_type: 'individual' as 'individual' | 'corporation',
    company_name: '',
    registration_number: '',
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
        resident_number: formData.resident_number || null,
        address: formData.address || null,
        bank_account: formData.bank_account || null,
        client_type: formData.client_type,
        company_name: formData.client_type === 'corporation' ? (formData.company_name || null) : null,
        registration_number: formData.client_type === 'corporation' ? (formData.registration_number || null) : null,
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
    <div className="page-container max-w-2xl">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <Link
            href="/clients"
            className="text-caption text-[var(--text-muted)] hover:text-[var(--text-secondary)] mb-2 inline-block"
          >
            ← 의뢰인 목록
          </Link>
          <h1 className="page-title">새 의뢰인 등록</h1>
          <p className="page-subtitle">의뢰인 정보를 입력하여 새 의뢰인을 등록하세요</p>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-[var(--color-danger-muted)] border border-[var(--color-danger)]/20 rounded-xl">
          <p className="text-sm text-[var(--color-danger)]">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <div className="card overflow-hidden">
          <div className="p-5 border-b border-[var(--border-subtle)]">
            <h2 className="text-body font-semibold text-[var(--text-primary)]">기본 정보</h2>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* 의뢰인 유형 선택 */}
              <div className="form-group sm:col-span-2">
                <label className="form-label">의뢰인 유형</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="client_type"
                      value="individual"
                      checked={formData.client_type === 'individual'}
                      onChange={(e) => setFormData({ ...formData, client_type: e.target.value as 'individual' | 'corporation' })}
                      className="w-4 h-4 text-[var(--color-primary)] border-[var(--border-default)] focus:ring-[var(--color-primary)]"
                    />
                    <span className="text-sm text-[var(--text-primary)]">개인</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="client_type"
                      value="corporation"
                      checked={formData.client_type === 'corporation'}
                      onChange={(e) => setFormData({ ...formData, client_type: e.target.value as 'individual' | 'corporation' })}
                      className="w-4 h-4 text-[var(--color-primary)] border-[var(--border-default)] focus:ring-[var(--color-primary)]"
                    />
                    <span className="text-sm text-[var(--text-primary)]">법인</span>
                  </label>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">
                  {formData.client_type === 'corporation' ? '대표자명' : '이름'} <span className="text-[var(--color-danger)]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder={formData.client_type === 'corporation' ? '대표자 이름' : '홍길동'}
                  className="form-input"
                />
              </div>
              <div className="form-group">
                <label className="form-label">
                  연락처 <span className="text-[var(--color-danger)]">*</span>
                </label>
                <input
                  type="tel"
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="010-1234-5678"
                  className="form-input"
                />
              </div>

              {/* 법인 전용 필드 */}
              {formData.client_type === 'corporation' && (
                <>
                  <div className="form-group">
                    <label className="form-label">회사명</label>
                    <input
                      type="text"
                      value={formData.company_name}
                      onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                      placeholder="주식회사 ○○○"
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">사업자등록번호</label>
                    <input
                      type="text"
                      value={formData.registration_number}
                      onChange={(e) => setFormData({ ...formData, registration_number: e.target.value })}
                      placeholder="000-00-00000"
                      className="form-input"
                    />
                  </div>
                </>
              )}

              {/* 개인 전용 필드 */}
              {formData.client_type === 'individual' && (
                <div className="form-group">
                  <label className="form-label">주민등록번호</label>
                  <input
                    type="text"
                    value={formData.resident_number}
                    onChange={(e) => setFormData({ ...formData, resident_number: e.target.value })}
                    placeholder="000000-0000000"
                    className="form-input"
                  />
                </div>
              )}

              <div className="form-group">
                <label className="form-label">이메일</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="example@email.com"
                  className="form-input"
                />
              </div>
              <div className="form-group">
                <label className="form-label">{formData.client_type === 'corporation' ? '설립일' : '생년월일'}</label>
                <input
                  type="date"
                  value={formData.birth_date}
                  onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
                  className="form-input"
                  style={{ colorScheme: 'light' }}
                />
              </div>
              <div className="form-group sm:col-span-2">
                <label className="form-label">주소</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="경기도 평택시..."
                  className="form-input"
                />
              </div>
              <div className="form-group sm:col-span-2">
                <label className="form-label">계좌번호</label>
                <input
                  type="text"
                  value={formData.bank_account}
                  onChange={(e) => setFormData({ ...formData, bank_account: e.target.value })}
                  placeholder="은행명 000-0000-0000-00"
                  className="form-input"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Memo */}
        <div className="card overflow-hidden">
          <div className="p-5 border-b border-[var(--border-subtle)]">
            <h2 className="text-body font-semibold text-[var(--text-primary)]">메모</h2>
          </div>
          <div className="p-5">
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={4}
              placeholder="의뢰인에 대한 메모를 입력하세요..."
              className="form-input resize-none"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-4">
          <Link
            href="/clients"
            className="btn btn-secondary w-full sm:w-auto justify-center"
          >
            취소
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary w-full sm:w-auto justify-center"
          >
            {loading ? '등록 중...' : '의뢰인 등록'}
          </button>
        </div>
      </form>
    </div>
  )
}
