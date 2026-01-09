'use client'

import { useState, useEffect, useCallback } from 'react'
import type {
  CaseParty,
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
  '청구인', '피청구인', '소송수계인'
]

function isRealParty(label: string): boolean {
  const normalized = normalizePartyLabel(label)
  return REAL_PARTY_LABELS.some(l => normalized.includes(l))
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
    fee_allocation_amount: number | null
  } | null>(null)

  // 당사자 목록 조회
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
      if (Array.isArray(data)) {
        setClients(data)
      }
    } catch (err) {
      console.error('의뢰인 목록 조회 실패:', err)
    }
  }, [])

  useEffect(() => {
    fetchParties()
    fetchClients()
  }, [fetchParties, fetchClients])

  // 당사자 유형별 그룹화 (사건유형 기반 라벨 사용)
  // 원고측/피고측 라벨 매핑
  const plaintiffLabels = ['원고', '채권자', '신청인', '항소인', '상고인', '항고인', '청구인']
  const defendantLabels = ['피고', '채무자', '피신청인', '피항소인', '피상고인', '상대방', '피청구인']

  // 실제 당사자만 필터링 (사건본인, 제3자 제외)
  const realParties = parties.filter((party) => {
    const rawLabel = party.party_type_label || ''
    return isRealParty(rawLabel) || party.party_type === 'plaintiff' || party.party_type === 'defendant'
  })

  const partyGroups = realParties.reduce((groups, party) => {
    const rawLabel = party.party_type_label || ''
    const normalizedLabel = normalizePartyLabel(rawLabel)
    let label: string

    // 원고측 라벨이면 → 사건유형에 맞는 원고측 라벨 사용
    if (plaintiffLabels.includes(normalizedLabel) || party.party_type === 'plaintiff') {
      label = partyLabels.plaintiff || rawLabel || '원고'
    }
    // 피고측 라벨이면 → 사건유형에 맞는 피고측 라벨 사용
    else if (defendantLabels.includes(normalizedLabel) || party.party_type === 'defendant') {
      label = partyLabels.defendant || rawLabel || '피고'
    }
    // 기타
    else {
      label = rawLabel || PARTY_TYPE_LABELS[party.party_type] || '기타'
    }

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
          {Object.entries(partyGroups).map(([label, groupParties]) =>
            groupParties.map((party, idx) => (
              <PartyTableRow
                key={party.id}
                party={party}
                label={label}
                showLabel={idx === 0}
                rowSpan={groupParties.length}
                clients={clients}
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
                  })
                }}
                onSave={() => handleSaveParty(party.id)}
                onCancel={() => {
                  setEditingPartyId(null)
                  setEditData(null)
                }}
                saving={saving}
              />
            ))
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
  isEditing,
  editData,
  setEditData,
  onEdit,
  onSave,
  onCancel,
  saving,
}: {
  party: CaseParty
  label: string
  showLabel: boolean
  rowSpan: number
  clients: Client[]
  isEditing: boolean
  editData: { party_name: string; is_our_client: boolean; client_id: string | null; fee_allocation_amount: number | null } | null
  setEditData: (data: { party_name: string; is_our_client: boolean; client_id: string | null; fee_allocation_amount: number | null } | null) => void
  onEdit: () => void
  onSave: () => void
  onCancel: () => void
  saving: boolean
}) {
  // 의뢰인인 경우 실제 이름 사용, 아니면 SCOURT 이름 사용
  const displayName = party.is_our_client && party.clients?.name
    ? party.clients.name
    : party.party_name

  // 마스킹된 이름 감지 (예: 김OO, 이O수, 박OOO)
  const isMaskedName = /[가-힣]O{1,3}|O{1,3}[가-힣]/.test(party.party_name)

  // 수정 버튼 표시 조건: 의뢰인 연동 안 됨 OR 마스킹된 이름
  const showEditButton = !(party.is_our_client && party.client_id) || isMaskedName

  // 수정 버튼 항상 표시 여부 (마스킹된 이름이면 항상 표시)
  const alwaysShowEdit = isMaskedName || !party.is_our_client

  // 수정 모드일 때는 전체 행을 편집 폼으로 표시
  if (isEditing && editData) {
    return (
      <tr className="bg-sage-50">
        <td colSpan={3} className="px-5 py-3">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500 w-16">성명:</label>
              <input
                type="text"
                value={editData.party_name}
                onChange={(e) => setEditData({ ...editData, party_name: e.target.value })}
                className="text-sm border border-gray-200 rounded px-2 py-1 flex-1 font-medium"
              />
              {party.scourt_synced && (
                <span className="text-xs text-blue-500">(SCOURT)</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1 text-sm">
                <input
                  type="checkbox"
                  checked={editData.is_our_client}
                  onChange={(e) => setEditData({ ...editData, is_our_client: e.target.checked })}
                  className="rounded border-gray-300"
                />
                의뢰인으로 설정
              </label>
            </div>
            {editData.is_our_client && (
              <>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-500 w-16">의뢰인:</label>
                  <select
                    value={editData.client_id || ''}
                    onChange={(e) => setEditData({ ...editData, client_id: e.target.value || null })}
                    className="text-sm border border-gray-200 rounded px-2 py-1 flex-1"
                  >
                    <option value="">선택...</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-500 w-16">수임료:</label>
                  <input
                    type="number"
                    value={editData.fee_allocation_amount || ''}
                    onChange={(e) => setEditData({
                      ...editData,
                      fee_allocation_amount: e.target.value ? parseInt(e.target.value) : null
                    })}
                    placeholder="수임료 금액"
                    className="text-sm border border-gray-200 rounded px-2 py-1 flex-1"
                  />
                  <span className="text-xs text-gray-400">원</span>
                </div>
              </>
            )}
            <div className="flex justify-end gap-2 mt-1">
              <button onClick={onCancel} disabled={saving} className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1">취소</button>
              <button onClick={onSave} disabled={saving} className="text-xs bg-sage-600 text-white px-3 py-1 rounded hover:bg-sage-700 disabled:opacity-50">
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
