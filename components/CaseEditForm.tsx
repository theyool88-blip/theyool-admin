'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import AdminHeader from './AdminHeader'

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
  judge_name: string | null
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
    client_id: caseData.client_id || '',
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
    judge_name: caseData.judge_name || '',
    notes: caseData.notes || ''
  })

  const [allClients, setAllClients] = useState<Client[]>([])
  const [loadingClients, setLoadingClients] = useState(true)

  const [relations, setRelations] = useState<RelatedCase[]>(relatedCases)
  const [showAddRelation, setShowAddRelation] = useState(false)
  const [newRelation, setNewRelation] = useState({
    related_case_id: '',
    relation_type: '',
    notes: ''
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const fetchClients = async () => {
      const { data } = await supabase
        .from('clients')
        .select('id, name, phone')
        .order('name')

      if (data) {
        setAllClients(data)
      }
      setLoadingClients(false)
    }
    fetchClients()
  }, [supabase])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      const { error } = await supabase
        .from('legal_cases')
        .update({
          contract_number: formData.contract_number || null,
          case_name: formData.case_name,
          client_id: formData.client_id,
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
          judge_name: formData.judge_name || null,
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
      const { error: error1 } = await supabase
        .from('case_relations')
        .insert({
          case_id: caseData.id,
          related_case_id: newRelation.related_case_id,
          relation_type: newRelation.relation_type || null,
          notes: newRelation.notes || null
        })

      if (error1) throw error1

      const { error: error2 } = await supabase
        .from('case_relations')
        .insert({
          case_id: newRelation.related_case_id,
          related_case_id: caseData.id,
          relation_type: newRelation.relation_type || null,
          notes: newRelation.notes ? `[역방향] ${newRelation.notes}` : null
        })

      if (error2) throw error2

      alert('관련 사건이 양방향으로 추가되었습니다')
      router.refresh()
    } catch (error) {
      console.error('추가 실패:', error)
      alert('추가에 실패했습니다')
    }
  }

  const handleDeleteRelation = async (relationId: string) => {
    if (!confirm('이 관련 사건을 삭제하시겠습니까? (양방향 모두 삭제됩니다)')) return

    try {
      const { data: relation } = await supabase
        .from('case_relations')
        .select('case_id, related_case_id')
        .eq('id', relationId)
        .single()

      if (!relation) throw new Error('관계를 찾을 수 없습니다')

      const { error: error1 } = await supabase
        .from('case_relations')
        .delete()
        .eq('id', relationId)

      if (error1) throw error1

      const { error: error2 } = await supabase
        .from('case_relations')
        .delete()
        .eq('case_id', relation.related_case_id)
        .eq('related_case_id', relation.case_id)

      if (error2) throw error2

      setRelations(relations.filter(r => r.id !== relationId))
      alert('양방향 관계가 모두 삭제되었습니다')
    } catch (error) {
      console.error('삭제 실패:', error)
      alert('삭제에 실패했습니다')
    }
  }

  const formatCurrency = (amount: number) => {
    return `${amount.toLocaleString()}원`
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader title="사건 수정" subtitle={caseData.case_name} />

      <div className="max-w-4xl mx-auto pt-20 pb-8 px-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Basic Info */}
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">기본 정보</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">계약번호</label>
                <input
                  type="text"
                  value={formData.contract_number}
                  onChange={(e) => setFormData({...formData, contract_number: e.target.value})}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-sage-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">계약일</label>
                <input
                  type="date"
                  value={formData.contract_date}
                  onChange={(e) => setFormData({...formData, contract_date: e.target.value})}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-sage-500"
                  style={{ colorScheme: 'light' }}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">의뢰인 *</label>
                <select
                  value={formData.client_id}
                  onChange={(e) => setFormData({...formData, client_id: e.target.value})}
                  required
                  disabled={loadingClients}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-sage-500"
                >
                  <option value="">의뢰인 선택</option>
                  {allClients.map(client => (
                    <option key={client.id} value={client.id}>
                      {client.name} {client.phone ? `(${client.phone})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">사건명 *</label>
                <input
                  type="text"
                  value={formData.case_name}
                  onChange={(e) => setFormData({...formData, case_name: e.target.value})}
                  required
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-sage-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">상태</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({...formData, status: e.target.value})}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-sage-500"
                >
                  <option value="진행중">진행중</option>
                  <option value="종결">종결</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">지점</label>
                <select
                  value={formData.office}
                  onChange={(e) => setFormData({...formData, office: e.target.value})}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-sage-500"
                >
                  <option value="">선택</option>
                  <option value="평택">평택</option>
                  <option value="천안">천안</option>
                  <option value="소송구조">소송구조</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">사건번호</label>
                <input
                  type="text"
                  value={formData.court_case_number}
                  onChange={(e) => setFormData({...formData, court_case_number: e.target.value})}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-sage-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">법원</label>
                <input
                  type="text"
                  value={formData.court_name}
                  onChange={(e) => setFormData({...formData, court_name: e.target.value})}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-sage-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">담당 판사</label>
                <input
                  type="text"
                  value={formData.judge_name}
                  onChange={(e) => setFormData({...formData, judge_name: e.target.value})}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-sage-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">사건종류</label>
                <input
                  type="text"
                  value={formData.case_type}
                  onChange={(e) => setFormData({...formData, case_type: e.target.value})}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-sage-500"
                />
              </div>
            </div>
          </div>

          {/* Fee Info */}
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">수임료 정보</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">착수금 (원)</label>
                <input
                  type="number"
                  value={formData.retainer_fee}
                  onChange={(e) => setFormData({...formData, retainer_fee: Number(e.target.value)})}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-sage-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">입금액 (원)</label>
                <input
                  type="number"
                  value={formData.total_received}
                  onChange={(e) => setFormData({...formData, total_received: Number(e.target.value)})}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-sage-500"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-gray-500 mb-1">성공보수 약정</label>
                <input
                  type="text"
                  value={formData.success_fee_agreement}
                  onChange={(e) => setFormData({...formData, success_fee_agreement: e.target.value})}
                  placeholder="예: 위자료 인정액의 5%"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-sage-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">발생 성공보수 (원)</label>
                <input
                  type="number"
                  value={formData.calculated_success_fee}
                  onChange={(e) => setFormData({...formData, calculated_success_fee: Number(e.target.value)})}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-sage-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">미수금</label>
                <input
                  type="text"
                  value={formatCurrency((formData.retainer_fee || 0) + (formData.calculated_success_fee || 0) - (formData.total_received || 0))}
                  disabled
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded bg-gray-50 text-gray-600"
                />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">메모</h2>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({...formData, notes: e.target.value})}
              rows={4}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-sage-500"
            />
          </div>

          {/* Related Cases */}
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-900">관련 사건</h2>
              <button
                type="button"
                onClick={() => setShowAddRelation(!showAddRelation)}
                className="px-3 py-1 text-xs font-medium text-white bg-sage-600 rounded hover:bg-sage-700 transition-colors"
              >
                + 추가
              </button>
            </div>

            {showAddRelation && (
              <div className="mb-4 p-3 border border-gray-200 rounded bg-gray-50">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">사건 선택</label>
                    <select
                      value={newRelation.related_case_id}
                      onChange={(e) => setNewRelation({...newRelation, related_case_id: e.target.value})}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-sage-500"
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
                    <label className="block text-xs font-medium text-gray-500 mb-1">관계 유형</label>
                    <input
                      type="text"
                      value={newRelation.relation_type}
                      onChange={(e) => setNewRelation({...newRelation, relation_type: e.target.value})}
                      placeholder="예: 항소, 상고, 관련사건"
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-sage-500"
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={handleAddRelation}
                      className="w-full px-3 py-2 text-sm font-medium text-white bg-sage-600 rounded hover:bg-sage-700 transition-colors"
                    >
                      추가하기
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {relations.map((relation) => (
                <div key={relation.id} className="flex items-center justify-between p-3 border border-gray-200 rounded">
                  <div className="flex items-center gap-2">
                    {relation.relation_type && (
                      <span className="px-1.5 py-0.5 text-xs font-medium bg-blue-50 text-blue-700 rounded">
                        {relation.relation_type}
                      </span>
                    )}
                    <span className="text-sm text-gray-900">
                      {relation.related_case?.case_name || '사건명 없음'}
                    </span>
                    {relation.related_case?.contract_number && (
                      <span className="text-xs text-gray-400">
                        ({relation.related_case.contract_number})
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteRelation(relation.id)}
                    className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded transition-colors"
                  >
                    삭제
                  </button>
                </div>
              ))}
              {relations.length === 0 && (
                <p className="text-center text-gray-400 text-sm py-6">관련 사건이 없습니다</p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Link
              href={`/cases/${caseData.id}`}
              className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded hover:bg-gray-50 transition-colors"
            >
              취소
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-sage-600 rounded hover:bg-sage-700 disabled:opacity-50 transition-colors"
            >
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
