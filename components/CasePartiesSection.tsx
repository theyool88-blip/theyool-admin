'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import type {
  CaseParty,
  CaseRepresentative,
  PartyType,
} from '@/types/case-party'
import { PARTY_TYPE_LABELS, getOppositePartyType, normalizePartyLabel } from '@/types/case-party'
import { getPartyLabels } from '@/lib/scourt/party-labels'

interface Client {
  id: string
  name: string
  phone?: string | null
  email?: string | null
}

// SCOURT 스냅샷 당사자 타입
interface ScourtSnapshotParty {
  btprNm: string
  btprDvsNm: string
  adjdocRchYmd?: string
  indvdCfmtnYmd?: string
}

// 실제 당사자 유형 (사건본인, 제3자 제외)
const REAL_PARTY_LABELS = [
  '원고', '피고', '채권자', '채무자', '신청인', '피신청인',
  '항소인', '피항소인', '상고인', '피상고인', '항고인', '상대방',
  '청구인', '피청구인', '소송수계인', '사건본인'
]

function isRealParty(label: string): boolean {
  const normalized = normalizePartyLabel(label)
  return REAL_PARTY_LABELS.some(l => normalized.includes(l))
}

const MASKED_NAME_REGEX = /[가-힣]O{1,3}|O{1,3}[가-힣]/

function isMaskedPartyName(name: string): boolean {
  return MASKED_NAME_REGEX.test(name)
}

function normalizePartyName(name: string): string {
  return name.replace(/^\d+\.\s*/, '').trim()
}

// 당사자 이름 파싱 (번호+성씨 prefix와 편집가능 부분 분리)
// 예: "1. 김OO" → { prefix: "1. 김", editable: "OO" }
function parsePartyName(name: string): { prefix: string; editable: string } {
  // 패턴 1: "1. 김OO" (번호 + 성씨)
  const withNumberMatch = name.match(/^(\d+\.\s*[가-힣])(.*)$/)
  if (withNumberMatch) {
    return { prefix: withNumberMatch[1], editable: withNumberMatch[2] }
  }
  // 패턴 2: "김OO" (번호 없이 성씨만)
  const nameOnlyMatch = name.match(/^([가-힣])(.*)$/)
  if (nameOnlyMatch) {
    return { prefix: nameOnlyMatch[1], editable: nameOnlyMatch[2] }
  }
  // 패턴 매칭 실패 시 전체 편집 가능
  return { prefix: '', editable: name }
}

// 파싱된 이름 재조합
function combinePartyName(prefix: string, editable: string): string {
  return prefix + editable
}

interface CasePartiesSectionProps {
  caseId: string
  courtCaseNumber?: string | null  // 사건번호 (사건유형 기반 라벨 결정용)
  clientId?: string | null
  clientName?: string | null
  clientRole?: PartyType | null
  opponentName?: string | null
  onPartiesUpdate?: () => void
  // SCOURT 스냅샷 데이터 (case_parties 비어있을 때 표시용)
  scourtParties?: ScourtSnapshotParty[]
}

export default function CasePartiesSection({
  caseId,
  courtCaseNumber,
  clientId,
  clientName,
  clientRole,
  opponentName,
  onPartiesUpdate,
  scourtParties = [],
}: CasePartiesSectionProps) {
  // 사건유형 기반 당사자 라벨 결정
  const partyLabels = getPartyLabels(courtCaseNumber || '')
  const [parties, setParties] = useState<CaseParty[]>([])
  const [representatives, setRepresentatives] = useState<CaseRepresentative[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 수정 중인 당사자
  const [editingPartyId, setEditingPartyId] = useState<string | null>(null)
  const [editData, setEditData] = useState<{
    party_name: string
    is_our_client: boolean
    client_id: string | null
    fee_allocation_amount: number | null  // 착수금 (원)
    success_fee_terms: string | null      // 성공보수 약정내용
  } | null>(null)

  // 수정 중인 대리인
  const [editingRepId, setEditingRepId] = useState<string | null>(null)
  const [editRepData, setEditRepData] = useState<{
    representative_name: string
    is_our_firm: boolean
  } | null>(null)

  // 당사자 및 대리인 목록 조회
  const fetchParties = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch(`/api/admin/cases/${caseId}/parties`)
      const data = await res.json()

      if (data.error) {
        setError(data.error)
      } else {
        setParties(data.parties || [])
        setRepresentatives(data.representatives || [])
      }
    } catch (err) {
      setError('당사자 목록 조회 실패')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [caseId])

  // 의뢰인 목록 조회
  const fetchClients = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/clients')
      const data = await res.json()
      // API 응답 형식: { clients: [...], count: number }
      if (data.clients && Array.isArray(data.clients)) {
        setClients(data.clients)
      }
    } catch (err) {
      console.error('의뢰인 목록 조회 실패:', err)
    }
  }, [])

  useEffect(() => {
    fetchParties()
    fetchClients()
  }, [fetchParties, fetchClients])

  const mergedParties = useMemo(() => {
    const manualOverrides = parties.filter(p => p.manual_override)
    if (manualOverrides.length === 0) return parties

    const scourtCandidates = parties.filter(p => p.scourt_synced && !p.manual_override)
    const matchedScourtIds = new Set<string>()

    manualOverrides.forEach((manual) => {
      const manualLabel = normalizePartyLabel(manual.party_type_label || PARTY_TYPE_LABELS[manual.party_type] || '')
      const manualName = normalizePartyName(manual.party_name)
      const manualFirstChar = manualName.charAt(0)
      if (!manualFirstChar) return

      for (const scourt of scourtCandidates) {
        if (matchedScourtIds.has(scourt.id)) continue
        const scourtLabel = normalizePartyLabel(scourt.party_type_label || PARTY_TYPE_LABELS[scourt.party_type] || '')
        // 사건본인은 사건본인끼리만 매칭 (다른 당사자 유형과 매칭 방지)
        if (scourtLabel === '사건본인' && manualLabel !== '사건본인') continue
        if (manualLabel === '사건본인' && scourtLabel !== '사건본인') continue
        const labelMatches = scourtLabel === manualLabel
        if (!labelMatches) continue
        const scourtName = normalizePartyName(scourt.party_name)
        if (!scourtName) continue
        if (scourtName === manualName) {
          matchedScourtIds.add(scourt.id)
          break
        }
        if (isMaskedPartyName(scourt.party_name) && scourtName.charAt(0) === manualFirstChar) {
          matchedScourtIds.add(scourt.id)
          break
        }
      }
    })

    if (matchedScourtIds.size === 0) return parties
    return parties.filter(p => !matchedScourtIds.has(p.id))
  }, [parties])

  // 실제 당사자만 필터링 (사건본인, 제3자 제외)
  const realParties = mergedParties.filter((party) => {
    const rawLabel = party.party_type_label || ''
    return isRealParty(rawLabel) || party.party_type === 'plaintiff' || party.party_type === 'defendant'
  })

  // 당사자 유형별 그룹화 - 원본 라벨(항고인, 상대방 등) 그대로 사용
  const partyGroups = realParties.reduce((groups, party) => {
    // 원본 라벨 그대로 사용 (SCOURT에서 가져온 라벨)
    const label = normalizePartyLabel(party.party_type_label || '') || PARTY_TYPE_LABELS[party.party_type] || '기타'

    if (!groups[label]) {
      groups[label] = []
    }
    groups[label].push(party)
    return groups
  }, {} as Record<string, CaseParty[]>)

  // 당사자 의뢰인 상태 수정
  const handleSaveParty = async (partyId: string) => {
    if (!editData) return

    setSaving(true)
    try {
      const res = await fetch(`/api/admin/cases/${caseId}/parties`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partyId,
          party_name: editData.party_name,
          is_our_client: editData.is_our_client,
          client_id: editData.client_id,
          fee_allocation_amount: editData.fee_allocation_amount,
          success_fee_terms: editData.success_fee_terms,
        }),
      })

      if (res.ok) {
        await fetchParties()
        setEditingPartyId(null)
        setEditData(null)
        onPartiesUpdate?.()
      } else {
        const data = await res.json()
        setError(data.error || '저장 실패')
      }
    } catch (err) {
      setError('저장 중 오류 발생')
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  // 대리인 수정 저장
  const handleSaveRepresentative = async (repId: string) => {
    if (!editRepData) return

    setSaving(true)
    try {
      const res = await fetch(`/api/admin/cases/${caseId}/parties`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          representativeId: repId,
          representative_name: editRepData.representative_name,
          is_our_firm: editRepData.is_our_firm,
        }),
      })

      if (res.ok) {
        await fetchParties()
        setEditingRepId(null)
        setEditRepData(null)
        onPartiesUpdate?.()
      } else {
        const data = await res.json()
        setError(data.error || '저장 실패')
      }
    } catch (err) {
      setError('저장 중 오류 발생')
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  // 로딩 중
  if (loading) {
    return (
      <div className="text-gray-500 text-sm py-2">당사자 정보 로딩 중...</div>
    )
  }

  // case_parties에 데이터가 없으면 SCOURT 스냅샷 또는 기존 데이터 표시
  if (realParties.length === 0) {
    // SCOURT 스냅샷 데이터가 있으면 그것을 표시 (실제 당사자만 필터링)
    const realScourtParties = scourtParties.filter(p => isRealParty(p.btprDvsNm))

    if (realScourtParties.length > 0) {
      return (
        <>
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="px-5 py-2 text-xs font-medium text-gray-500 text-left w-24">구분</th>
                <th className="px-5 py-2 text-xs font-medium text-gray-500 text-left">성명</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {realScourtParties.map((party, idx) => (
                <tr key={`scourt-party-${idx}`} className="hover:bg-gray-50">
                  <td className="px-5 py-3 text-sm text-gray-500">{party.btprDvsNm}</td>
                  <td className="px-5 py-3 text-sm text-gray-900">{party.btprNm}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {error && <div className="px-5 py-2 text-xs text-red-500">{error}</div>}
        </>
      )
    }

    // SCOURT 데이터도 없으면 기존 client/opponent 표시
    if (clientName || opponentName) {
      return (
        <>
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="px-5 py-2 text-xs font-medium text-gray-500 text-left w-24">구분</th>
                <th className="px-5 py-2 text-xs font-medium text-gray-500 text-left">성명</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {clientName && (
                <tr className="hover:bg-gray-50">
                  <td className="px-5 py-3 text-sm text-gray-500">
                    {clientRole ? PARTY_TYPE_LABELS[clientRole] : partyLabels.plaintiff}
                  </td>
                  <td className="px-5 py-3 text-sm">
                    <span className="font-medium text-gray-900">{clientName}</span>
                    <span className="ml-1.5 text-xs text-sage-600">(의뢰인)</span>
                  </td>
                </tr>
              )}
              {opponentName && (
                <tr className="hover:bg-gray-50">
                  <td className="px-5 py-3 text-sm text-gray-500">
                    {clientRole ? PARTY_TYPE_LABELS[getOppositePartyType(clientRole)] : partyLabels.defendant}
                  </td>
                  <td className="px-5 py-3 text-sm text-gray-900">{opponentName}</td>
                </tr>
              )}
            </tbody>
          </table>
          {error && <div className="px-5 py-2 text-xs text-red-500">{error}</div>}
        </>
      )
    }

    // 데이터 없음
    return (
      <div className="text-gray-400 text-sm px-5 py-6 text-center">
        등록된 당사자 정보가 없습니다.
      </div>
    )
  }

  // 대리인 그룹화 (구분별)
  const representativeGroups = representatives.reduce((groups, rep) => {
    const label = rep.representative_type_label || '소송대리인'
    if (!groups[label]) {
      groups[label] = []
    }
    groups[label].push(rep)
    return groups
  }, {} as Record<string, CaseRepresentative[]>)

  // 당사자 데이터가 있으면 테이블 형식으로 표시
  return (
    <>
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50/50">
            <th className="px-5 py-2 text-xs font-medium text-gray-500 text-left w-24">구분</th>
            <th className="px-5 py-2 text-xs font-medium text-gray-500 text-left">성명</th>
            <th className="px-5 py-2 text-xs font-medium text-gray-500 text-center w-16"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {/* 당사자 */}
          {Object.entries(partyGroups).map(([label, groupParties]) =>
            groupParties.map((party, idx) => (
              <PartyTableRow
                key={party.id}
                party={party}
                label={label}
                showLabel={idx === 0}
                rowSpan={groupParties.length}
                clients={clients}
                allParties={realParties}
                isEditing={editingPartyId === party.id}
                editData={editData}
                setEditData={setEditData}
                onEdit={() => {
                  setEditingPartyId(party.id)
                  setEditData({
                    party_name: party.party_name,
                    is_our_client: party.is_our_client,
                    client_id: party.client_id,
                    fee_allocation_amount: party.fee_allocation_amount,
                    success_fee_terms: party.success_fee_terms,
                  })
                }}
                onSave={() => handleSaveParty(party.id)}
                onCancel={() => {
                  setEditingPartyId(null)
                  setEditData(null)
                }}
                onClientCreated={fetchClients}
                saving={saving}
              />
            ))
          )}

          {/* 대리인 */}
          {Object.entries(representativeGroups).map(([label, groupReps]) =>
            groupReps.map((rep, idx) => {
              const isMaskedName = /[가-힣]O{1,3}|O{1,3}[가-힣]/.test(rep.representative_name)
              const isEditing = editingRepId === rep.id

              // 수정 모드
              if (isEditing && editRepData) {
                const parsedName = parsePartyName(editRepData.representative_name)
                return (
                  <tr key={rep.id} className="bg-sage-50/50">
                    <td colSpan={3} className="px-5 py-4">
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <label className="text-sm text-gray-600 w-20 flex-shrink-0">성명</label>
                          <div className="flex items-center flex-1 bg-white border border-gray-200 rounded-lg overflow-hidden h-10 focus-within:border-sage-400 focus-within:ring-1 focus-within:ring-sage-400">
                            {parsedName.prefix && (
                              <span className="text-sm font-medium text-gray-500 bg-gray-50 px-3 h-full flex items-center border-r border-gray-200">
                                {parsedName.prefix}
                              </span>
                            )}
                            <input
                              type="text"
                              value={parsedName.editable}
                              onChange={(e) => setEditRepData({
                                ...editRepData,
                                representative_name: combinePartyName(parsedName.prefix, e.target.value)
                              })}
                              className="text-sm px-3 flex-1 h-full font-medium outline-none bg-transparent"
                              placeholder="이름 입력"
                            />
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="w-20 flex-shrink-0" />
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={editRepData.is_our_firm}
                              onChange={(e) => setEditRepData({ ...editRepData, is_our_firm: e.target.checked })}
                              className="w-4 h-4 rounded border-gray-300 text-sage-600 focus:ring-sage-500"
                            />
                            <span className="text-sm text-gray-700">당 사무소 소속</span>
                          </label>
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                          <button
                            onClick={() => {
                              setEditingRepId(null)
                              setEditRepData(null)
                            }}
                            disabled={saving}
                            className="text-sm text-gray-500 hover:text-gray-700 px-4 h-9 rounded-lg hover:bg-gray-100 transition-colors"
                          >
                            취소
                          </button>
                          <button
                            onClick={() => handleSaveRepresentative(rep.id)}
                            disabled={saving}
                            className="text-sm bg-sage-600 text-white px-4 h-9 rounded-lg hover:bg-sage-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                          >
                            {saving ? '저장 중...' : '저장'}
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                )
              }

              // 일반 표시 모드
              return (
                <tr key={rep.id} className="hover:bg-gray-50 group">
                  {idx === 0 && (
                    <td
                      className="px-5 py-3 text-sm text-gray-500 align-top border-r border-gray-100"
                      rowSpan={groupReps.length}
                    >
                      {label}
                    </td>
                  )}
                  <td className="px-5 py-3 text-sm text-gray-900">
                    <span className={rep.is_our_firm ? 'font-medium' : ''}>
                      {rep.representative_name}
                    </span>
                    {rep.law_firm_name && (
                      <span className="ml-1.5 text-xs text-gray-500">({rep.law_firm_name})</span>
                    )}
                    {rep.is_our_firm && (
                      <span className="ml-1.5 text-xs text-sage-600">(당 사무소)</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-center">
                    {isMaskedName && (
                      <button
                        onClick={() => {
                          setEditingRepId(rep.id)
                          setEditRepData({
                            representative_name: rep.representative_name,
                            is_our_firm: rep.is_our_firm,
                          })
                        }}
                        className="text-xs px-2 py-0.5 rounded text-sage-600 hover:text-sage-700 hover:bg-sage-50"
                      >
                        수정
                      </button>
                    )}
                  </td>
                </tr>
              )
            })
          )}
        </tbody>
      </table>

      {error && (
        <div className="px-5 py-2 text-xs text-red-500">{error}</div>
      )}
    </>
  )
}

// 당사자 테이블 행 컴포넌트
function PartyTableRow({
  party,
  label,
  showLabel,
  rowSpan,
  clients,
  allParties,
  isEditing,
  editData,
  setEditData,
  onEdit,
  onSave,
  onCancel,
  onClientCreated,
  saving,
}: {
  party: CaseParty
  label: string
  showLabel: boolean
  rowSpan: number
  clients: Client[]
  allParties: CaseParty[]
  isEditing: boolean
  editData: { party_name: string; is_our_client: boolean; client_id: string | null; fee_allocation_amount: number | null; success_fee_terms: string | null } | null
  setEditData: (data: { party_name: string; is_our_client: boolean; client_id: string | null; fee_allocation_amount: number | null; success_fee_terms: string | null } | null) => void
  onEdit: () => void
  onSave: () => void
  onCancel: () => void
  onClientCreated: () => void
  saving: boolean
}) {
  // 새 의뢰인 입력 모드
  const [isCreatingClient, setIsCreatingClient] = useState(false)
  const [newClientName, setNewClientName] = useState('')
  const [newClientPhone, setNewClientPhone] = useState('')
  const [creatingClient, setCreatingClient] = useState(false)

  // 현재 의뢰인이 설정된 측 확인 (같은 측만 추가 가능)
  const existingClientParty = allParties.find(p => p.is_our_client && p.id !== party.id)
  const clientSide = existingClientParty?.party_type
  const canSetAsClient = !clientSide || party.party_type === clientSide

  // 새 의뢰인 생성
  const handleCreateClient = async () => {
    if (!newClientName.trim() || !newClientPhone.trim()) return

    setCreatingClient(true)
    try {
      const res = await fetch('/api/admin/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newClientName.trim(),
          phone: newClientPhone.trim(),
        }),
      })
      const data = await res.json()
      // API 응답 형식: { success: true, data: { id: ..., name: ... } }
      if (res.ok && data.success && data.data?.id) {
        // 새 의뢰인 선택
        setEditData({
          ...editData!,
          client_id: data.data.id,
        })
        onClientCreated()
        setIsCreatingClient(false)
        setNewClientName('')
        setNewClientPhone('')
      }
    } catch (err) {
      console.error('의뢰인 생성 실패:', err)
    } finally {
      setCreatingClient(false)
    }
  }
  // 번호 prefix 추출 (예: "1. " 또는 "1.")
  const numberPrefixMatch = party.party_name.match(/^(\d+\.\s*)/)
  const numberPrefix = numberPrefixMatch ? numberPrefixMatch[1] : ''

  // 의뢰인인 경우 번호 prefix 보존하면서 실제 이름 사용, 아니면 SCOURT 이름 사용
  const displayName = party.is_our_client && party.clients?.name
    ? `${numberPrefix}${party.clients.name}`
    : party.party_name

  // 마스킹된 이름 감지 (예: 김OO, 이O수, 박OOO)
  const isMaskedName = isMaskedPartyName(party.party_name)

  // 수정 버튼 표시 조건: 의뢰인 연동 안 됨 OR 마스킹된 이름
  const showEditButton = !(party.is_our_client && party.client_id) || isMaskedName

  // 수정 버튼 항상 표시 여부 (마스킹된 이름이면 항상 표시)
  const alwaysShowEdit = isMaskedName || !party.is_our_client

  // 이름 파싱 (prefix 보호)
  const parsedName = parsePartyName(editData?.party_name || party.party_name)

  // 수정 모드일 때는 전체 행을 편집 폼으로 표시
  if (isEditing && editData) {
    const currentParsed = parsePartyName(editData.party_name)

    // 통일된 입력칸 스타일
    const inputClass = "text-sm bg-white border border-gray-200 rounded-lg px-3 h-10 flex-1 focus:border-sage-400 focus:ring-1 focus:ring-sage-400 outline-none"
    const selectClass = "text-sm bg-white border border-gray-200 rounded-lg px-3 h-10 flex-1 focus:border-sage-400 focus:ring-1 focus:ring-sage-400 outline-none"

    return (
      <tr className="bg-sage-50/50">
        <td colSpan={3} className="px-5 py-4">
          <div className="space-y-3">
            {/* 성명 입력 */}
            <div className="flex items-center gap-3">
              <label className="text-sm text-gray-600 w-20 flex-shrink-0">성명</label>
              <div className="flex items-center flex-1 bg-white border border-gray-200 rounded-lg overflow-hidden h-10 focus-within:border-sage-400 focus-within:ring-1 focus-within:ring-sage-400">
                {currentParsed.prefix && (
                  <span className="text-sm font-medium text-gray-500 bg-gray-50 px-3 h-full flex items-center border-r border-gray-200">
                    {currentParsed.prefix}
                  </span>
                )}
                <input
                  type="text"
                  value={currentParsed.editable}
                  onChange={(e) => setEditData({
                    ...editData,
                    party_name: combinePartyName(currentParsed.prefix, e.target.value)
                  })}
                  className="text-sm px-3 flex-1 h-full font-medium outline-none bg-transparent"
                  placeholder="이름 입력"
                />
              </div>
            </div>

            {/* 의뢰인 설정 체크박스 */}
            <div className="flex items-center gap-3">
              <div className="w-20 flex-shrink-0" />
              <label className={`flex items-center gap-2 cursor-pointer ${!canSetAsClient ? 'opacity-50 cursor-not-allowed' : ''}`}>
                <input
                  type="checkbox"
                  checked={editData.is_our_client}
                  onChange={(e) => setEditData({ ...editData, is_our_client: e.target.checked })}
                  disabled={!canSetAsClient}
                  className="w-4 h-4 rounded border-gray-300 text-sage-600 focus:ring-sage-500 disabled:cursor-not-allowed"
                />
                <span className="text-sm text-gray-700">의뢰인으로 설정</span>
              </label>
              {!canSetAsClient && (
                <span className="text-xs text-red-500 ml-2">
                  (반대측이 이미 의뢰인으로 설정됨)
                </span>
              )}
            </div>

            {/* 의뢰인 세부 설정 */}
            {editData.is_our_client && (
              <div className="ml-[calc(5rem+0.75rem)] space-y-3 pt-1 border-l-2 border-sage-200 pl-4">
                {/* 의뢰인 선택 */}
                <div className="flex items-center gap-3">
                  <label className="text-sm text-gray-600 w-16 flex-shrink-0">의뢰인</label>
                  {!isCreatingClient ? (
                    <div className="flex gap-2 flex-1 items-center">
                      <select
                        value={editData.client_id || ''}
                        onChange={(e) => setEditData({ ...editData, client_id: e.target.value || null })}
                        className={selectClass}
                      >
                        <option value="">선택...</option>
                        {clients.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => setIsCreatingClient(true)}
                        className="text-sm text-sage-600 hover:text-sage-700 whitespace-nowrap font-medium h-10 px-2"
                      >
                        + 새 의뢰인
                      </button>
                    </div>
                  ) : (
                    <div className="flex-1 space-y-2">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newClientName}
                          onChange={(e) => setNewClientName(e.target.value)}
                          placeholder="이름"
                          className={inputClass}
                        />
                        <input
                          type="tel"
                          value={newClientPhone}
                          onChange={(e) => setNewClientPhone(e.target.value)}
                          placeholder="연락처"
                          className={inputClass}
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={handleCreateClient}
                          disabled={creatingClient || !newClientName.trim() || !newClientPhone.trim()}
                          className="text-sm bg-sage-600 text-white px-3 h-8 rounded-lg hover:bg-sage-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {creatingClient ? '생성 중...' : '추가'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsCreatingClient(false)
                            setNewClientName('')
                            setNewClientPhone('')
                          }}
                          className="text-sm text-gray-500 hover:text-gray-700 px-3 h-8"
                        >
                          취소
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* 착수금 */}
                <div className="flex items-center gap-3">
                  <label className="text-sm text-gray-600 w-16 flex-shrink-0">착수금</label>
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      type="number"
                      value={editData.fee_allocation_amount || ''}
                      onChange={(e) => setEditData({
                        ...editData,
                        fee_allocation_amount: e.target.value ? parseInt(e.target.value) : null
                      })}
                      placeholder="금액 입력 (선택)"
                      className={inputClass}
                    />
                    <span className="text-sm text-gray-400 w-6">원</span>
                  </div>
                </div>

                {/* 성공보수 약정내용 */}
                <div className="flex items-center gap-3">
                  <label className="text-sm text-gray-600 w-16 flex-shrink-0">성공보수</label>
                  <input
                    type="text"
                    value={editData.success_fee_terms || ''}
                    onChange={(e) => setEditData({
                      ...editData,
                      success_fee_terms: e.target.value || null
                    })}
                    placeholder="약정 내용 입력 (선택)"
                    className={inputClass}
                  />
                </div>
              </div>
            )}

            {/* 버튼 영역 */}
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={onCancel}
                disabled={saving}
                className="text-sm text-gray-500 hover:text-gray-700 px-4 h-9 rounded-lg hover:bg-gray-100 transition-colors"
              >
                취소
              </button>
              <button
                onClick={onSave}
                disabled={saving}
                className="text-sm bg-sage-600 text-white px-4 h-9 rounded-lg hover:bg-sage-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {saving ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </td>
      </tr>
    )
  }

  return (
    <tr className="hover:bg-gray-50 group">
      {/* 구분 - rowSpan으로 그룹 표시 */}
      {showLabel && (
        <td
          className="px-5 py-3 text-sm text-gray-500 align-top border-r border-gray-100"
          rowSpan={rowSpan}
        >
          {label}
        </td>
      )}
      {/* 성명 */}
      <td className="px-5 py-3 text-sm text-gray-900">
        <span className={party.is_our_client ? 'font-medium' : ''}>
          {displayName}
        </span>
        {party.is_our_client && (
          <span className="ml-1.5 text-xs text-sage-600">(의뢰인)</span>
        )}
      </td>
      {/* 수정 버튼 */}
      <td className="px-3 py-3 text-center">
        {showEditButton && (
          <button
            onClick={onEdit}
            className={`text-xs px-2 py-0.5 rounded ${
              alwaysShowEdit
                ? 'text-sage-600 hover:text-sage-700 hover:bg-sage-50'
                : 'text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity'
            }`}
          >
            수정
          </button>
        )}
      </td>
    </tr>
  )
}
