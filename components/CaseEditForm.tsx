'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Client {
  id: string
  name: string
  phone: string | null
}

interface LegalCase {
  id: string
  contract_number: string | null
  case_name: string
  client_id: string
  status: string
  office: string | null
  contract_date: string | null
  retainer_fee: number | null
  total_received: number | null
  outstanding_balance: number | null
  success_fee_agreement: string | null
  calculated_success_fee: number | null
  court_case_number: string | null
  court_name: string | null
  case_type: string | null
  notes: string | null
  client?: Client
}

interface SimpleCase {
  id: string
  case_name: string
  contract_number: string | null
  status: string
}

interface RelatedCase {
  id: string
  related_case_id: string
  relation_type: string | null
  notes: string | null
  related_case?: {
    id: string
    case_name: string
    contract_number: string | null
  }
}

interface Profile {
  id: string
  name: string
  role: string
}

export default function CaseEditForm({
  profile,
  caseData,
  allCases,
  relatedCases
}: {
  profile: Profile
  caseData: LegalCase
  allCases: SimpleCase[]
  relatedCases: RelatedCase[]
}) {
  const router = useRouter()
  const supabase = createClient()

  const [formData, setFormData] = useState({
    contract_number: caseData.contract_number || '',
    case_name: caseData.case_name || '',
    status: caseData.status || '진행중',
    office: caseData.office || '',
    contract_date: caseData.contract_date || '',
    retainer_fee: caseData.retainer_fee || 0,
    total_received: caseData.total_received || 0,
    success_fee_agreement: caseData.success_fee_agreement || '',
    calculated_success_fee: caseData.calculated_success_fee || 0,
    court_case_number: caseData.court_case_number || '',
    court_name: caseData.court_name || '',
    case_type: caseData.case_type || '',
    notes: caseData.notes || ''
  })

  const [relations, setRelations] = useState<RelatedCase[]>(relatedCases)
  const [showAddRelation, setShowAddRelation] = useState(false)
  const [newRelation, setNewRelation] = useState({
    related_case_id: '',
    relation_type: '',
    notes: ''
  })
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      const { error } = await supabase
        .from('legal_cases')
        .update({
          contract_number: formData.contract_number || null,
          case_name: formData.case_name,
          status: formData.status,
          office: formData.office || null,
          contract_date: formData.contract_date || null,
          retainer_fee: formData.retainer_fee,
          total_received: formData.total_received,
          success_fee_agreement: formData.success_fee_agreement || null,
          calculated_success_fee: formData.calculated_success_fee,
          court_case_number: formData.court_case_number || null,
          court_name: formData.court_name || null,
          case_type: formData.case_type || null,
          notes: formData.notes || null
        })
        .eq('id', caseData.id)

      if (error) throw error

      alert('저장되었습니다')
      router.push(`/cases/${caseData.id}`)
      router.refresh()
    } catch (error) {
      console.error('저장 실패:', error)
      alert('저장에 실패했습니다')
    } finally {
      setSaving(false)
    }
  }

  const handleAddRelation = async () => {
    if (!newRelation.related_case_id) return

    try {
      const { error } = await supabase
        .from('case_relations')
        .insert({
          case_id: caseData.id,
          related_case_id: newRelation.related_case_id,
          relation_type: newRelation.relation_type || null,
          notes: newRelation.notes || null
        })

      if (error) throw error

      alert('관련 사건이 추가되었습니다')
      router.refresh()
    } catch (error) {
      console.error('추가 실패:', error)
      alert('추가에 실패했습니다')
    }
  }

  const handleDeleteRelation = async (relationId: string) => {
    if (!confirm('이 관련 사건을 삭제하시겠습니까?')) return

    try {
      const { error } = await supabase
        .from('case_relations')
        .delete()
        .eq('id', relationId)

      if (error) throw error

      setRelations(relations.filter(r => r.id !== relationId))
      alert('삭제되었습니다')
    } catch (error) {
      console.error('삭제 실패:', error)
      alert('삭제에 실패했습니다')
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
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
              <h1 className="text-2xl font-bold text-gray-900">사건 수정</h1>
              <p className="text-sm text-gray-600">{caseData.case_name}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <a
              href={`/cases/${caseData.id}`}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              취소
            </a>
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
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 기본 정보 */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">기본 정보</h2>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">계약번호</label>
                <input
                  type="text"
                  value={formData.contract_number}
                  onChange={(e) => setFormData({...formData, contract_number: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">계약일</label>
                <input
                  type="date"
                  value={formData.contract_date}
                  onChange={(e) => setFormData({...formData, contract_date: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">사건명 *</label>
                <input
                  type="text"
                  value={formData.case_name}
                  onChange={(e) => setFormData({...formData, case_name: e.target.value})}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">상태</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({...formData, status: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="진행중">진행중</option>
                  <option value="종결">종결</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">지점</label>
                <select
                  value={formData.office}
                  onChange={(e) => setFormData({...formData, office: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">선택</option>
                  <option value="평택">평택</option>
                  <option value="천안">천안</option>
                  <option value="소송구조">소송구조</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">사건번호</label>
                <input
                  type="text"
                  value={formData.court_case_number}
                  onChange={(e) => setFormData({...formData, court_case_number: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">법원</label>
                <input
                  type="text"
                  value={formData.court_name}
                  onChange={(e) => setFormData({...formData, court_name: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">사건종류</label>
                <input
                  type="text"
                  value={formData.case_type}
                  onChange={(e) => setFormData({...formData, case_type: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* 수임료 정보 */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">수임료 정보</h2>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">착수금 (원)</label>
                <input
                  type="number"
                  value={formData.retainer_fee}
                  onChange={(e) => setFormData({...formData, retainer_fee: Number(e.target.value)})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">입금액 (원)</label>
                <input
                  type="number"
                  value={formData.total_received}
                  onChange={(e) => setFormData({...formData, total_received: Number(e.target.value)})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">성공보수 약정</label>
                <input
                  type="text"
                  value={formData.success_fee_agreement}
                  onChange={(e) => setFormData({...formData, success_fee_agreement: e.target.value})}
                  placeholder="예: 위자료 인정액의 5%"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">발생 성공보수 (원)</label>
                <input
                  type="number"
                  value={formData.calculated_success_fee}
                  onChange={(e) => setFormData({...formData, calculated_success_fee: Number(e.target.value)})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">미수금</label>
                <input
                  type="text"
                  value={`${((formData.retainer_fee || 0) + (formData.calculated_success_fee || 0) - (formData.total_received || 0)).toLocaleString()}원`}
                  disabled
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700"
                />
              </div>
            </div>
          </div>

          {/* 메모 */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">메모</h2>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({...formData, notes: e.target.value})}
              rows={6}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* 관련 사건 */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">관련 사건</h2>
              <button
                type="button"
                onClick={() => setShowAddRelation(!showAddRelation)}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
              >
                + 추가
              </button>
            </div>

            {showAddRelation && (
              <div className="mb-6 p-4 border border-blue-200 rounded-lg bg-blue-50">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">사건 선택</label>
                    <select
                      value={newRelation.related_case_id}
                      onChange={(e) => setNewRelation({...newRelation, related_case_id: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">선택하세요</option>
                      {allCases.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.case_name} {c.contract_number ? `(${c.contract_number})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">관계 유형</label>
                    <input
                      type="text"
                      value={newRelation.relation_type}
                      onChange={(e) => setNewRelation({...newRelation, relation_type: e.target.value})}
                      placeholder="예: 항소, 상고, 관련사건"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={handleAddRelation}
                      className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                    >
                      추가하기
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-3">
              {relations.map((relation) => (
                <div key={relation.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                  <div>
                    {relation.relation_type && (
                      <span className="inline-block px-2 py-1 text-xs font-semibold bg-blue-100 text-blue-700 rounded mr-2">
                        {relation.relation_type}
                      </span>
                    )}
                    <span className="text-sm font-medium text-gray-900">
                      {relation.related_case?.case_name || '사건명 없음'}
                    </span>
                    {relation.related_case?.contract_number && (
                      <span className="ml-2 text-sm text-gray-500">
                        ({relation.related_case.contract_number})
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteRelation(relation.id)}
                    className="px-3 py-1 text-sm font-medium text-red-600 hover:bg-red-50 rounded"
                  >
                    삭제
                  </button>
                </div>
              ))}
              {relations.length === 0 && (
                <p className="text-center text-gray-500 py-8">관련 사건이 없습니다</p>
              )}
            </div>
          </div>

          {/* 저장 버튼 */}
          <div className="flex justify-end gap-4">
            <a
              href={`/cases/${caseData.id}`}
              className="px-6 py-3 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              취소
            </a>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-3 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}
