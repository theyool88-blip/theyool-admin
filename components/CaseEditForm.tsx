'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import AdminHeader from './AdminHeader'
import { COURTS, getCourtAbbrev } from '@/lib/scourt/court-codes'
import {
  CASE_TYPE_OPTIONS,
  CASE_TYPE_GROUPS,
  getGroupedCaseTypes,
  getCaseTypeAuto,
  isApplicationCaseType
} from '@/lib/constants/case-types'

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
  assigned_to: string | null
  contract_date: string | null
  retainer_fee: number | null
  total_received: number | null
  outstanding_balance: number | null
  success_fee_agreement: string | null
  calculated_success_fee: number | null
  court_case_number: string | null
  court_name: string | null
  case_type: string | null
  application_type: string | null
  judge_name: string | null
  notes: string | null
  onedrive_folder_url: string | null
  client_role: 'plaintiff' | 'defendant' | null
  opponent_name: string | null
  enc_cs_no: string | null
  scourt_case_name: string | null
  client?: Client
  assigned_member?: { id: string; display_name: string | null; role: string } | null
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
    assigned_to: caseData.assigned_to || '',
    contract_date: caseData.contract_date || '',
    retainer_fee: caseData.retainer_fee || 0,
    total_received: caseData.total_received || 0,
    success_fee_agreement: caseData.success_fee_agreement || '',
    calculated_success_fee: caseData.calculated_success_fee || 0,
    court_case_number: caseData.court_case_number || '',
    court_name: caseData.court_name || '',
    case_type: caseData.case_type || '',
    application_type: caseData.application_type || '',
    judge_name: caseData.judge_name || '',
    notes: caseData.notes || '',
    onedrive_folder_url: caseData.onedrive_folder_url || '',
    client_role: caseData.client_role || '' as 'plaintiff' | 'defendant' | '',
    opponent_name: caseData.opponent_name || '',
    enc_cs_no: caseData.enc_cs_no || '',
    scourt_case_name: caseData.scourt_case_name || ''
  })

  // 담당자 목록 (변호사)
  const [lawyerMembers, setLawyerMembers] = useState<{id: string, display_name: string | null, role: string}[]>([])

  // 대법원 검색 관련 상태
  const [scourtSearching, setScourtSearching] = useState(false)
  const [scourtSearchError, setScourtSearchError] = useState<string | null>(null)
  const [scourtSearchPartyName, setScourtSearchPartyName] = useState('')  // 당사자이름 검색용

  // 법원 선택 드롭다운
  const [showCourtDropdown, setShowCourtDropdown] = useState(false)
  const filteredCourts = COURTS.filter(c =>
    c.name.includes(formData.court_name)
  ).slice(0, 15)

  // 대법원 검색 성공 여부
  const [scourtSearchSuccess, setScourtSearchSuccess] = useState(false)
  // 법원명 수정 알림
  const [courtNameCorrected, setCourtNameCorrected] = useState<{original: string, corrected: string} | null>(null)

  // 그룹별 사건 유형 옵션 (메모이제이션)
  const groupedCaseTypes = useMemo(() => getGroupedCaseTypes(), [])

  // 사건종류가 신청사건인지 확인 (보전처분, 가사신청 포함)
  const isApplicationCase = isApplicationCaseType(formData.case_type, formData.court_case_number)

  // 사건번호 또는 사건명 변경 시 자동분류
  const handleAutoClassify = (caseNumber: string, caseName: string) => {
    const autoType = getCaseTypeAuto(caseNumber, caseName)
    if (autoType && !formData.case_type) {
      // 사건유형이 비어있을 때만 자동분류 적용
      setFormData(prev => ({ ...prev, case_type: autoType }))
    }
  }

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
      try {
        const response = await fetch('/api/admin/clients')
        const result = await response.json()

        if (result.clients) {
          setAllClients(result.clients)
        } else if (result.error) {
          console.error('의뢰인 목록 로드 실패:', result.error)
        }
      } catch (error) {
        console.error('의뢰인 목록 로드 실패:', error)
      }
      setLoadingClients(false)
    }
    fetchClients()

    // 담당자 목록 불러오기
    fetch('/api/admin/tenant/members?role=lawyer,admin,owner')
      .then(res => res.json())
      .then(data => {
        if (data.members) {
          setLawyerMembers(data.members)
        }
      })
      .catch(err => console.error('담당자 목록 조회 실패:', err))
  }, [])

  // 대법원 사건 검색 (사건번호, 법원, 당사자이름 3개 입력 필요)
  const handleScourtSearch = async () => {
    const caseNumber = formData.court_case_number.trim()
    const courtName = formData.court_name.trim()
    const partyName = scourtSearchPartyName.trim()

    // 3개 필드 모두 입력 필요
    if (!caseNumber || !courtName || !partyName) {
      setScourtSearchError('사건번호, 법원, 당사자이름을 모두 입력해주세요.')
      return
    }

    // 사건번호 파싱 (법원명 포함 가능: "수원가정법원 2024드단12345" 또는 "2024드단12345")
    const caseNumberOnly = caseNumber.replace(/^[가-힣\s]+(?=\d)/, '').trim()
    const caseNumberPattern = /^(\d{4})([가-힣]+)(\d+)$/
    const match = caseNumberOnly.match(caseNumberPattern)

    if (!match) {
      setScourtSearchError('사건번호 형식이 올바르지 않습니다. 예: 2024드단12345')
      return
    }

    const [, caseYear, caseType, caseSerial] = match

    setScourtSearching(true)
    setScourtSearchError(null)

    try {
      const response = await fetch('/api/admin/scourt/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseYear,
          caseType,
          caseSerial,
          courtName,
          partyName,
          legalCaseId: caseData.id  // 스냅샷 저장용
        })
      })

      const result = await response.json()

      // 에러 타입별 처리
      if (result.errorType === 'COURT_MISMATCH') {
        // 법원명이 완전히 잘못됨 - 에러 표시
        setScourtSearchError(`${result.error}`)
        return
      }

      if (result.errorType === 'COURT_CORRECTION_NEEDED') {
        // 법원명 수정 필요 - 사용자 확인 요청
        const confirmed = window.confirm(
          `입력한 법원: ${result.enteredCourt}\n` +
          `실제 법원: ${result.suggestedCourt}\n\n` +
          `"${result.suggestedCourt}"으로 수정하시겠습니까?`
        )

        if (confirmed) {
          // 수정 확인 후 재요청
          setScourtSearching(true)
          const retryResponse = await fetch('/api/admin/scourt/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              caseYear,
              caseType,
              caseSerial,
              courtName: result.suggestedCourt,  // 수정된 법원명
              partyName,
              legalCaseId: caseData.id,
              confirmCourtCorrection: true  // 수정 확인 플래그
            })
          })
          const retryResult = await retryResponse.json()

          if (retryResult.success) {
            // 수정된 법원명으로 폼 업데이트
            setFormData(prev => ({
              ...prev,
              court_name: result.suggestedCourt,
              client_role: retryResult.caseInfo.clientRole || prev.client_role,
              enc_cs_no: retryResult.caseInfo.encCsNo || prev.enc_cs_no,
            }))
            setCourtNameCorrected({
              original: result.enteredCourt,
              corrected: result.suggestedCourt
            })
            setScourtSearchError(null)
            setScourtSearchSuccess(true)
          } else {
            setScourtSearchError(retryResult.error || '사건 등록에 실패했습니다.')
          }
        } else {
          setScourtSearchError('법원명을 확인 후 다시 검색해주세요.')
        }
        return
      }

      if (result.success && result.caseInfo) {
        // 검색 성공 - 법원명 자동 수정 알림
        if (result.courtNameCorrected) {
          setCourtNameCorrected(result.courtNameCorrected)
          console.log(`법원명 자동 수정: ${result.courtNameCorrected.original} → ${result.courtNameCorrected.corrected}`)
        } else {
          setCourtNameCorrected(null)
        }

        // 폼 데이터 업데이트
        setFormData(prev => ({
          ...prev,
          court_name: result.caseInfo.courtName || prev.court_name,
          client_role: result.caseInfo.clientRole || prev.client_role,
          enc_cs_no: result.caseInfo.encCsNo || prev.enc_cs_no,
        }))

        setScourtSearchError(null)
        setScourtSearchSuccess(true)
        console.log(`✅ 연동 완료: 기일 ${result.generalData?.hearings || 0}건, 진행 ${result.generalData?.progress || 0}건`)
      } else {
        setScourtSearchError(result.error || '사건을 찾을 수 없습니다.')
      }
    } catch (error) {
      console.error('대법원 검색 실패:', error)
      setScourtSearchError('대법원 검색 중 오류가 발생했습니다.')
    } finally {
      setScourtSearching(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // 의뢰인 필수 검증
    if (!formData.client_id) {
      alert('의뢰인을 선택해주세요.')
      return
    }

    setSaving(true)

    try {
      const response = await fetch(`/api/admin/cases/${caseData.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contract_number: formData.contract_number || null,
          case_name: formData.case_name,
          client_id: formData.client_id,
          status: formData.status,
          assigned_to: formData.assigned_to || null,
          contract_date: formData.contract_date || null,
          retainer_fee: formData.retainer_fee,
          total_received: formData.total_received,
          success_fee_agreement: formData.success_fee_agreement || null,
          calculated_success_fee: formData.calculated_success_fee,
          court_case_number: formData.court_case_number || null,
          court_name: formData.court_name || null,
          case_type: formData.case_type || null,
          application_type: isApplicationCase ? (formData.application_type || null) : null,
          judge_name: formData.judge_name || null,
          notes: formData.notes || null,
          onedrive_folder_url: formData.onedrive_folder_url || null,
          client_role: formData.client_role || null,
          opponent_name: formData.opponent_name || null,
          enc_cs_no: formData.enc_cs_no || null,
          scourt_case_name: formData.scourt_case_name || null
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || '저장에 실패했습니다')
      }

      alert('저장되었습니다')
      router.push(`/cases/${caseData.id}`)
      router.refresh()
    } catch (error) {
      console.error('저장 실패:', error)
      alert(error instanceof Error ? error.message : '저장에 실패했습니다')
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
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  의뢰인 *
                  {formData.client_role && (
                    <span className={`ml-2 px-1.5 py-0.5 text-xs font-semibold rounded ${
                      formData.client_role === 'plaintiff'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {formData.client_role === 'plaintiff' ? '원고' : '피고'}
                    </span>
                  )}
                </label>
                <select
                  value={formData.client_id}
                  onChange={(e) => setFormData({...formData, client_id: e.target.value})}
                  required
                  disabled={loadingClients}
                  className={`w-full px-3 py-2 text-sm border rounded bg-white focus:outline-none focus:ring-1 focus:ring-sage-500 ${
                    !formData.client_id ? 'border-red-300 bg-red-50' : 'border-gray-200'
                  }`}
                >
                  <option value="">의뢰인 선택 (필수)</option>
                  {allClients.map(client => (
                    <option key={client.id} value={client.id}>
                      {client.name} {client.phone ? `(${client.phone})` : ''}
                    </option>
                  ))}
                </select>
                {!formData.client_id && (
                  <p className="text-xs text-red-500 mt-1">의뢰인을 선택해주세요</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">사건명 *</label>
                <input
                  type="text"
                  value={formData.case_name}
                  onChange={(e) => {
                    const newCaseName = e.target.value
                    setFormData({...formData, case_name: newCaseName})
                    // 사건유형이 비어있을 때 자동분류 시도
                    if (!formData.case_type) {
                      handleAutoClassify(formData.court_case_number, newCaseName)
                    }
                  }}
                  required
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-sage-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">의뢰인 역할</label>
                <select
                  value={formData.client_role}
                  onChange={(e) => setFormData({...formData, client_role: e.target.value as 'plaintiff' | 'defendant' | ''})}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-sage-500"
                >
                  <option value="">선택하세요</option>
                  <option value="plaintiff">원고</option>
                  <option value="defendant">피고</option>
                </select>
                <p className="text-xs text-gray-400 mt-1">대법원 검색 시 자동 판별됩니다</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">상대방 이름</label>
                <input
                  type="text"
                  value={formData.opponent_name}
                  onChange={(e) => setFormData({...formData, opponent_name: e.target.value})}
                  placeholder="예: 김철수"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-sage-500"
                />
                <p className="text-xs text-gray-400 mt-1">사건 상세에서 실명으로 표시됩니다</p>
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
                <label className="block text-xs font-medium text-gray-500 mb-1">담당 변호사</label>
                <select
                  value={formData.assigned_to}
                  onChange={(e) => setFormData({...formData, assigned_to: e.target.value})}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-sage-500"
                >
                  <option value="">선택하세요</option>
                  {lawyerMembers.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.display_name || '이름 없음'}
                      {member.role === 'owner' && ' (대표)'}
                    </option>
                  ))}
                </select>
              </div>
              {/* 대법원 검색 섹션 */}
              <div className={`md:col-span-2 p-4 rounded-lg border ${scourtSearchSuccess ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200'}`}>
                {scourtSearchSuccess ? (
                  // 검색 성공 시 결과 표시
                  <>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-green-800 flex items-center gap-2">
                        <span className="text-green-600">✓</span> 대법원 사건 연동 완료
                      </h3>
                      <button
                        type="button"
                        onClick={() => {
                          setScourtSearchSuccess(false)
                          setScourtSearchError(null)
                          setCourtNameCorrected(null)
                        }}
                        className="px-3 py-1 text-xs font-medium text-green-700 border border-green-300 rounded hover:bg-green-100"
                      >
                        다시 검색
                      </button>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                      <div>
                        <span className="text-green-700 text-xs">사건번호</span>
                        <p className="font-medium text-green-900">{formData.court_case_number}</p>
                      </div>
                      <div>
                        <span className="text-green-700 text-xs">법원</span>
                        <p className="font-medium text-green-900">{getCourtAbbrev(formData.court_name)}</p>
                      </div>
                      {formData.client_role && (
                        <div>
                          <span className="text-green-700 text-xs">의뢰인 지위</span>
                          <p className="font-medium text-green-900">{formData.client_role === 'plaintiff' ? '원고' : '피고'}</p>
                        </div>
                      )}
                    </div>
                    <p className="mt-2 text-xs text-green-700">
                      나의사건검색에 등록되어 기일/송달 정보가 자동 동기화됩니다.
                    </p>
                    {/* 법원명 수정 알림 */}
                    {courtNameCorrected && (
                      <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs">
                        <span className="text-yellow-700 font-medium">ℹ️ 법원명이 수정되었습니다:</span>
                        <span className="text-yellow-900 ml-1">
                          {getCourtAbbrev(courtNameCorrected.original)} → {getCourtAbbrev(courtNameCorrected.corrected)}
                        </span>
                      </div>
                    )}
                  </>
                ) : (
                  // 검색 폼
                  <>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-blue-900">대법원 사건 검색</h3>
                      <button
                        type="button"
                        onClick={handleScourtSearch}
                        disabled={scourtSearching}
                        className="px-4 py-1.5 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                      >
                        {scourtSearching ? '검색중...' : '검색'}
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-blue-700 mb-1">사건번호 *</label>
                        <input
                          type="text"
                          value={formData.court_case_number}
                          onChange={(e) => {
                            const newCaseNumber = e.target.value
                            setFormData({...formData, court_case_number: newCaseNumber})
                            // 사건유형이 비어있을 때 자동분류 시도
                            if (!formData.case_type) {
                              handleAutoClassify(newCaseNumber, formData.case_name)
                            }
                          }}
                          placeholder="2024드단12345"
                          className="w-full px-3 py-2 text-sm border border-blue-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                        />
                      </div>
                      <div className="relative">
                        <label className="block text-xs font-medium text-blue-700 mb-1">법원 *</label>
                        <input
                          type="text"
                          value={formData.court_name}
                          onChange={(e) => {
                            setFormData({...formData, court_name: e.target.value})
                            setShowCourtDropdown(true)
                          }}
                          onFocus={() => setShowCourtDropdown(true)}
                          onBlur={() => setTimeout(() => setShowCourtDropdown(false), 150)}
                          placeholder="검색 또는 선택..."
                          className="w-full px-3 py-2 text-sm border border-blue-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                        />
                        {showCourtDropdown && filteredCourts.length > 0 && (
                          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto">
                            {filteredCourts.map(c => (
                              <div
                                key={c.code}
                                className="px-3 py-2 text-sm cursor-pointer hover:bg-blue-50 text-gray-900"
                                onMouseDown={() => {
                                  setFormData({...formData, court_name: c.name})
                                  setShowCourtDropdown(false)
                                }}
                              >
                                {getCourtAbbrev(c.name)}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-blue-700 mb-1">당사자이름 *</label>
                        <input
                          type="text"
                          value={scourtSearchPartyName}
                          onChange={(e) => setScourtSearchPartyName(e.target.value)}
                          placeholder="의뢰인 또는 상대방 이름"
                          className="w-full px-3 py-2 text-sm border border-blue-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                        />
                      </div>
                    </div>
                    {scourtSearchError && (
                      <p className="mt-2 text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
                        ⚠️ {scourtSearchError}
                      </p>
                    )}
                    <p className="mt-2 text-xs text-blue-600">
                      검색 성공 시 법원, 판사, 원고/피고 정보가 자동으로 입력됩니다.
                    </p>
                  </>
                )}
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
                <select
                  value={formData.case_type}
                  onChange={(e) => setFormData({...formData, case_type: e.target.value})}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-sage-500"
                >
                  <option value="">선택하세요</option>
                  {CASE_TYPE_GROUPS.map(group => (
                    <optgroup key={group} label={group}>
                      {groupedCaseTypes[group]?.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                {formData.case_type && !CASE_TYPE_OPTIONS.find(o => o.value === formData.case_type) && (
                  <p className="text-xs text-gray-400 mt-1">직접 입력: {formData.case_type}</p>
                )}
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

          {/* Google Drive Folder Link */}
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-2">소송 서류 폴더 (의뢰인 포털용)</h2>
            <p className="text-xs text-gray-500 mb-3">
              Google Drive 공유 폴더 링크를 입력하세요. 의뢰인 포털에서 서류를 확인할 수 있습니다.
            </p>
            <input
              type="url"
              value={formData.onedrive_folder_url}
              onChange={(e) => setFormData({...formData, onedrive_folder_url: e.target.value})}
              placeholder="https://drive.google.com/drive/folders/..."
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-sage-500"
            />
            {formData.onedrive_folder_url && (
              <div className="mt-2">
                <a
                  href={formData.onedrive_folder_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-sage-600 hover:text-sage-700 underline"
                >
                  링크 열어보기 →
                </a>
              </div>
            )}
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
