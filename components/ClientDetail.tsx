'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface LegalCase {
  id: string
  contract_number: string | null
  case_name: string
  status: '진행중' | '종결'
  office: string | null
  contract_date: string | null
  case_type: string | null
  retainer_fee: number | null
  calculated_success_fee: number | null
  total_received: number | null
}

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
  created_at: string
  updated_at: string
  cases?: LegalCase[]
}

interface Profile {
  id: string
  name: string
  email: string
  role: string
}

export default function ClientDetail({ profile, clientData }: { profile: Profile, clientData: Client }) {
  const router = useRouter()
  const supabase = createClient()
  const [isEditing, setIsEditing] = useState(true)
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

  const hasChanges = () => {
    return formData.name !== (clientData.name || '') ||
           formData.resident_number !== (clientData.resident_number || '') ||
           formData.phone !== (clientData.phone || '') ||
           formData.email !== (clientData.email || '') ||
           formData.birth_date !== (clientData.birth_date || '') ||
           formData.gender !== (clientData.gender || '') ||
           formData.address !== (clientData.address || '') ||
           formData.account_number !== (clientData.account_number || '') ||
           formData.notes !== (clientData.notes || '')
  }

  const handleSave = async () => {
    if (!hasChanges()) {
      setIsEditing(false)
      return
    }

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
      router.refresh()
      setIsEditing(false)
    } catch (error) {
      console.error('Error:', error)
      alert('저장 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setFormData({
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
    setIsEditing(false)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const formatDate = (date: string | null) => {
    if (!date) return '-'
    const d = new Date(date)
    const year = String(d.getFullYear()).slice(2)
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}.${month}.${day}`
  }

  const formatCurrency = (amount: number | null) => {
    if (!amount) return '0원'
    return `${amount.toLocaleString('ko-KR')}원`
  }

  // 총 입금 금액 계산
  const calculateTotalReceived = () => {
    if (!clientData.cases) return 0
    return clientData.cases.reduce((sum, c) => sum + (c.total_received || 0), 0)
  }

  // 미수금 합계 계산
  const calculateTotalOutstanding = () => {
    if (!clientData.cases) return 0
    return clientData.cases.reduce((sum, c) => {
      const retainer = c.retainer_fee || 0
      const successFee = c.calculated_success_fee || 0
      const received = c.total_received || 0
      return sum + (retainer + successFee - received)
    }, 0)
  }

  const getStatusColor = (status: string) => {
    return status === '진행중'
      ? 'bg-emerald-50 text-emerald-700 border-l-emerald-400'
      : 'bg-gray-50 text-gray-600 border-l-gray-400'
  }

  const getOfficeColor = (office: string) => {
    switch (office) {
      case '평택': return 'bg-blue-50 text-blue-700'
      case '천안': return 'bg-purple-50 text-purple-700'
      case '소송구조': return 'bg-amber-50 text-amber-700'
      default: return 'bg-gray-50 text-gray-700'
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <a href="/" className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-700 rounded-lg flex items-center justify-center hover:from-blue-600 hover:to-blue-800 transition-colors cursor-pointer">
              <span className="text-white font-bold text-lg">율</span>
            </a>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">의뢰인 상세</h1>
              <p className="text-sm text-gray-600">{clientData.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <a
              href="/clients"
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              목록으로
            </a>
            {isEditing ? (
              <>
                <button
                  onClick={handleCancel}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !hasChanges()}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? '저장 중...' : '저장'}
                </button>
              </>
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
              >
                수정
              </button>
            )}
            <div className="text-right">
              <p className="text-sm font-medium text-gray-900">{profile.name}</p>
              <p className="text-xs text-gray-500">
                {profile.role === 'admin' ? '관리자' : '직원'}
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              로그아웃
            </button>
          </div>
        </div>
      </header>

      {/* 메인 콘텐츠 */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          {/* 기본 정보 - 2열 그리드 */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">기본 정보</h2>
            <div className="grid grid-cols-2 gap-x-8 gap-y-4">
              <div>
                <label className="text-sm font-medium text-gray-500">이름</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="mt-1 w-full px-3 py-1.5 text-base text-gray-900 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                ) : (
                  <p className="mt-1 text-base text-gray-900 font-semibold">{formData.name}</p>
                )}
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">주민등록번호</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={formData.resident_number}
                    onChange={(e) => setFormData({ ...formData, resident_number: e.target.value })}
                    placeholder="000000-0000000"
                    className="mt-1 w-full px-3 py-1.5 text-base text-gray-900 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                ) : (
                  <p className="mt-1 text-base text-gray-900">{formData.resident_number || '-'}</p>
                )}
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">연락처</label>
                {isEditing ? (
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="010-0000-0000"
                    className="mt-1 w-full px-3 py-1.5 text-base text-gray-900 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                ) : (
                  <p className="mt-1 text-base text-gray-900">{formData.phone || '-'}</p>
                )}
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">생년월일</label>
                {isEditing ? (
                  <input
                    type="date"
                    value={formData.birth_date}
                    onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
                    className="mt-1 w-full px-3 py-1.5 text-base text-gray-900 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                ) : (
                  <p className="mt-1 text-base text-gray-900">{formatDate(formData.birth_date)}</p>
                )}
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">이메일</label>
                {isEditing ? (
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="example@email.com"
                    className="mt-1 w-full px-3 py-1.5 text-base text-gray-900 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                ) : (
                  <p className="mt-1 text-base text-gray-900">{formData.email || '-'}</p>
                )}
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">성별</label>
                {isEditing ? (
                  <select
                    value={formData.gender}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value as 'M' | 'F' | '' })}
                    className="mt-1 w-full px-3 py-1.5 text-base text-gray-900 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">선택</option>
                    <option value="M">남성</option>
                    <option value="F">여성</option>
                  </select>
                ) : (
                  <p className="mt-1 text-base text-gray-900">
                    {formData.gender === 'M' ? '남성' : formData.gender === 'F' ? '여성' : '-'}
                  </p>
                )}
              </div>
              <div className="col-span-2">
                <label className="text-sm font-medium text-gray-500">주소</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="mt-1 w-full px-3 py-1.5 text-base text-gray-900 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                ) : (
                  <p className="mt-1 text-base text-gray-900">{formData.address || '-'}</p>
                )}
              </div>
              <div className="col-span-2">
                <label className="text-sm font-medium text-gray-500">계좌번호</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={formData.account_number}
                    onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                    placeholder="은행명 000-0000-0000"
                    className="mt-1 w-full px-3 py-1.5 text-base text-gray-900 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                ) : (
                  <p className="mt-1 text-base text-gray-900">{formData.account_number || '-'}</p>
                )}
              </div>
            </div>
          </div>

          {/* 금액 정보 - 2열 그리드 */}
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">총 입금 금액</h2>
              <p className="text-3xl font-bold text-emerald-600">{formatCurrency(calculateTotalReceived())}</p>
              <p className="text-sm text-gray-500 mt-2">전체 사건의 입금액 합계</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">미수금 합계</h2>
              <p className="text-3xl font-bold text-red-600">{formatCurrency(calculateTotalOutstanding())}</p>
              <p className="text-sm text-gray-500 mt-2">전체 사건의 미수금 합계</p>
            </div>
          </div>

          {/* 메모 */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">메모</h2>
            {isEditing ? (
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={6}
                placeholder="의뢰인에 대한 메모를 입력하세요..."
                className="w-full px-3 py-2 text-base text-gray-900 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
            ) : (
              formData.notes ? (
                <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">{formData.notes}</p>
              ) : (
                <p className="text-gray-400 text-sm">메모가 없습니다.</p>
              )
            )}
          </div>

          {/* 사건 목록 */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">
                사건 목록 ({clientData.cases?.length || 0}건)
              </h2>
              <a
                href={`/cases/new?client_id=${clientData.id}`}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
              >
                + 사건 추가
              </a>
            </div>
            {clientData.cases && clientData.cases.length > 0 ? (
              <div className="space-y-3">
                {clientData.cases.map((legalCase) => (
                  <div
                    key={legalCase.id}
                    onClick={() => router.push(`/cases/${legalCase.id}`)}
                    className="p-4 border border-gray-200 rounded-lg hover:border-blue-400 hover:bg-blue-50 cursor-pointer transition-all"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {legalCase.office && (
                          <span className={`inline-block px-2 py-1 text-xs font-semibold rounded ${getOfficeColor(legalCase.office)}`}>
                            {legalCase.office}
                          </span>
                        )}
                        <span className={`inline-block px-2 py-1 text-xs font-semibold rounded border-l-4 ${getStatusColor(legalCase.status)}`}>
                          {legalCase.status}
                        </span>
                      </div>
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                    <p className="text-sm font-medium text-gray-900 mb-1">
                      {legalCase.case_name}
                    </p>
                    <div className="flex gap-4 text-xs text-gray-500">
                      {legalCase.contract_number && (
                        <span>계약번호: {legalCase.contract_number}</span>
                      )}
                      {legalCase.case_type && (
                        <span>종류: {legalCase.case_type}</span>
                      )}
                      {legalCase.contract_date && (
                        <span>계약일: {formatDate(legalCase.contract_date)}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
                  <span className="text-2xl">⚖️</span>
                </div>
                <p className="text-gray-600 font-medium">등록된 사건이 없습니다.</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
