'use client'

import { useState, useEffect, useCallback } from 'react'
import type {
  CaseParty,
  CaseRepresentative,
  PartyType,
} from '@/types/case-party'
import { PARTY_TYPE_LABELS, getOppositePartyType } from '@/types/case-party'

// 날짜 포맷 함수 (YYYYMMDD → YYYY.MM.DD)
function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr || dateStr.length !== 8) return '-'
  return `${dateStr.slice(0, 4)}.${dateStr.slice(4, 6)}.${dateStr.slice(6, 8)}`
}

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

// SCOURT 스냅샷 대리인 타입
interface ScourtSnapshotRep {
  agntNm: string
  agntDvsNm: string
  jdafrCorpNm?: string
}

interface CasePartiesSectionProps {
  caseId: string
  clientId?: string | null
  clientName?: string | null
  clientRole?: PartyType | null
  opponentName?: string | null
  onPartiesUpdate?: () => void
  // SCOURT 스냅샷 데이터 (case_parties 비어있을 때 표시용)
  scourtParties?: ScourtSnapshotParty[]
  scourtRepresentatives?: ScourtSnapshotRep[]
}

export default function CasePartiesSection({
  caseId,
  clientId,
  clientName,
  clientRole,
  opponentName,
  onPartiesUpdate,
  scourtParties = [],
  scourtRepresentatives = [],
}: CasePartiesSectionProps) {
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
    fee_allocation_amount: number | null
  } | null>(null)

  // 새 당사자 추가 폼
  const [showAddForm, setShowAddForm] = useState(false)
  const [newPartyType, setNewPartyType] = useState<PartyType>('plaintiff')
  const [newPartyName, setNewPartyName] = useState('')
  const [newIsClient, setNewIsClient] = useState(false)
  const [newClientId, setNewClientId] = useState<string | null>(null)
  const [newFeeAmount, setNewFeeAmount] = useState<number | null>(null)

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

  // 당사자 유형별 그룹화 (party_type_label 기준)
  // 표준 라벨 목록 - 이 목록에 없는 라벨은 party_type 기반으로 정규화
  const standardLabels = ['원고', '피고', '채권자', '채무자', '신청인', '피신청인', '항소인', '피항소인', '상고인', '피상고인', '사건본인']

  const partyGroups = parties.reduce((groups, party) => {
    const rawLabel = party.party_type_label || ''
    // 표준 라벨이거나 사건본인으로 시작하면 그대로 사용, 아니면 party_type 기반 라벨
    const label = standardLabels.includes(rawLabel) || rawLabel.startsWith('사건본인')
      ? rawLabel
      : PARTY_TYPE_LABELS[party.party_type] || '기타'
    if (!groups[label]) {
      groups[label] = []
    }
    groups[label].push(party)
    return groups
  }, {} as Record<string, CaseParty[]>)

  // 의뢰인 수
  const clientCount = parties.filter(p => p.is_our_client).length

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

  // 새 당사자 추가
  const handleAddParty = async () => {
    if (!newPartyName.trim()) {
      setError('당사자명을 입력해주세요.')
      return
    }

    setSaving(true)
    try {
      const res = await fetch(`/api/admin/cases/${caseId}/parties`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          party_name: newPartyName.trim(),
          party_type: newPartyType,
          party_type_label: PARTY_TYPE_LABELS[newPartyType],
          is_our_client: newIsClient,
          client_id: newIsClient ? newClientId : null,
          fee_allocation_amount: newIsClient ? newFeeAmount : null,
        }),
      })

      if (res.ok) {
        await fetchParties()
        setShowAddForm(false)
        setNewPartyName('')
        setNewIsClient(false)
        setNewClientId(null)
        setNewFeeAmount(null)
        onPartiesUpdate?.()
      } else {
        const data = await res.json()
        setError(data.error || '추가 실패')
      }
    } catch (err) {
      setError('추가 중 오류 발생')
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  // 당사자 삭제
  const handleDeleteParty = async (partyId: string) => {
    if (!confirm('이 당사자를 삭제하시겠습니까?')) return

    try {
      const res = await fetch(`/api/admin/cases/${caseId}/parties?partyId=${partyId}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        await fetchParties()
        onPartiesUpdate?.()
      } else {
        const data = await res.json()
        setError(data.error || '삭제 실패')
      }
    } catch (err) {
      setError('삭제 중 오류 발생')
      console.error(err)
    }
  }

  // 금액 포맷팅
  const formatAmount = (amount: number | null) => {
    if (amount === null || amount === undefined) return '-'
    return new Intl.NumberFormat('ko-KR').format(amount) + '원'
  }

  // 로딩 중
  if (loading) {
    return (
      <div className="text-gray-500 text-sm py-2">당사자 정보 로딩 중...</div>
    )
  }

  // case_parties에 데이터가 없으면 SCOURT 스냅샷 또는 기존 데이터 표시
  if (parties.length === 0) {
    // SCOURT 스냅샷 데이터가 있으면 그것을 표시
    if (scourtParties.length > 0 || scourtRepresentatives.length > 0) {
      return (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button
              onClick={() => setShowAddForm(true)}
              className="text-xs text-sage-600 hover:text-sage-700"
            >
              + 추가
            </button>
          </div>

          {/* SCOURT 당사자 목록 */}
          {scourtParties.length > 0 && (
            <div className="space-y-1">
              {scourtParties.map((party, idx) => (
                <div key={`scourt-party-${idx}`} className="flex items-center gap-2 py-1.5 px-2 bg-gray-50 rounded text-sm">
                  <span className="text-gray-500 w-20 shrink-0">{party.btprDvsNm}</span>
                  <span className="font-medium">{party.btprNm}</span>
                  {party.adjdocRchYmd && (
                    <span className="text-xs text-gray-400">도달 {formatDate(party.adjdocRchYmd)}</span>
                  )}
                  {party.indvdCfmtnYmd && (
                    <span className="text-xs text-orange-500">확정 {formatDate(party.indvdCfmtnYmd)}</span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* SCOURT 대리인 목록 */}
          {scourtRepresentatives.length > 0 && (
            <div className="space-y-1">
              <div className="text-xs text-gray-500 mb-1">대리인</div>
              {scourtRepresentatives.map((rep, idx) => (
                <div key={`scourt-rep-${idx}`} className="flex items-center gap-2 py-1 px-2 bg-gray-50 rounded text-sm">
                  <span className="text-gray-500 text-xs">{rep.agntDvsNm}</span>
                  <span>{rep.agntNm}</span>
                  {rep.jdafrCorpNm && (
                    <span className="text-xs text-gray-400">({rep.jdafrCorpNm})</span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* 새 당사자 추가 폼 */}
          {showAddForm && (
            <AddPartyForm
              newPartyType={newPartyType}
              setNewPartyType={setNewPartyType}
              newPartyName={newPartyName}
              setNewPartyName={setNewPartyName}
              newIsClient={newIsClient}
              setNewIsClient={setNewIsClient}
              newClientId={newClientId}
              setNewClientId={setNewClientId}
              newFeeAmount={newFeeAmount}
              setNewFeeAmount={setNewFeeAmount}
              clients={clients}
              saving={saving}
              onSave={handleAddParty}
              onCancel={() => setShowAddForm(false)}
            />
          )}

          {error && (
            <div className="mt-2 text-xs text-red-500">{error}</div>
          )}
        </div>
      )
    }

    // SCOURT 데이터도 없으면 기존 client/opponent 표시
    return (
      <div className="space-y-3">
        <div className="flex justify-end">
          <button
            onClick={() => setShowAddForm(true)}
            className="text-xs text-sage-600 hover:text-sage-700"
          >
            + 당사자 추가
          </button>
        </div>

        {/* 기존 데이터 기반 표시 */}
        <div className="text-sm space-y-2">
          {clientName && (
            <div className="flex items-center gap-2 py-1.5 px-2 bg-gray-50 rounded">
              <span className="text-gray-500 w-20 shrink-0">
                {clientRole ? PARTY_TYPE_LABELS[clientRole] : '원고'}
              </span>
              <span className="font-medium">{clientName}</span>
              <span className="text-xs text-sage-600">(의뢰인)</span>
            </div>
          )}
          {opponentName && (
            <div className="flex items-center gap-2 py-1.5 px-2 bg-gray-50 rounded">
              <span className="text-gray-500 w-20 shrink-0">
                {clientRole ? PARTY_TYPE_LABELS[getOppositePartyType(clientRole)] : '피고'}
              </span>
              <span>{opponentName}</span>
            </div>
          )}
          {!clientName && !opponentName && (
            <div className="text-gray-400 text-sm py-2">
              등록된 당사자 정보가 없습니다.
            </div>
          )}
        </div>

        {/* 새 당사자 추가 폼 */}
        {showAddForm && (
          <AddPartyForm
            newPartyType={newPartyType}
            setNewPartyType={setNewPartyType}
            newPartyName={newPartyName}
            setNewPartyName={setNewPartyName}
            newIsClient={newIsClient}
            setNewIsClient={setNewIsClient}
            newClientId={newClientId}
            setNewClientId={setNewClientId}
            newFeeAmount={newFeeAmount}
            setNewFeeAmount={setNewFeeAmount}
            clients={clients}
            saving={saving}
            onSave={handleAddParty}
            onCancel={() => setShowAddForm(false)}
          />
        )}

        {error && (
          <div className="mt-2 text-xs text-red-500">{error}</div>
        )}
      </div>
    )
  }

  // 당사자 데이터가 있으면 전체 표시
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => setShowAddForm(true)}
          className="text-xs text-sage-600 hover:text-sage-700"
        >
          + 추가
        </button>
      </div>

      {/* 당사자 유형별 표시 */}
      {Object.entries(partyGroups).map(([label, groupParties]) => (
        <div key={label}>
          <div className="text-xs text-gray-500 mb-2">
            {label} ({groupParties.length}명)
          </div>
          <div className="space-y-2">
            {groupParties.map((party) => (
              <PartyRow
                key={party.id}
                party={party}
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
                onDelete={() => handleDeleteParty(party.id)}
                saving={saving}
                formatAmount={formatAmount}
              />
            ))}
          </div>
        </div>
      ))}

      {/* 대리인 정보 */}
      {representatives.length > 0 && (
        <div>
          <div className="text-xs text-gray-500 mb-2">
            대리인 ({representatives.length}명)
          </div>
          <div className="space-y-1">
            {representatives.map((rep) => (
              <div key={rep.id} className="flex items-center gap-2 text-sm py-1 px-2 bg-gray-50 rounded">
                <span className="text-gray-500 text-xs">
                  {rep.representative_type_label}
                </span>
                <span>{rep.representative_name}</span>
                {rep.law_firm_name && (
                  <span className="text-gray-400 text-xs">({rep.law_firm_name})</span>
                )}
                {rep.is_our_firm && (
                  <span className="text-xs text-sage-600">(우리사무소)</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 새 당사자 추가 폼 */}
      {showAddForm && (
        <AddPartyForm
          newPartyType={newPartyType}
          setNewPartyType={setNewPartyType}
          newPartyName={newPartyName}
          setNewPartyName={setNewPartyName}
          newIsClient={newIsClient}
          setNewIsClient={setNewIsClient}
          newClientId={newClientId}
          setNewClientId={setNewClientId}
          newFeeAmount={newFeeAmount}
          setNewFeeAmount={setNewFeeAmount}
          clients={clients}
          saving={saving}
          onSave={handleAddParty}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      {error && (
        <div className="mt-2 text-xs text-red-500">{error}</div>
      )}
    </div>
  )
}

// 당사자 행 컴포넌트
function PartyRow({
  party,
  clients,
  isEditing,
  editData,
  setEditData,
  onEdit,
  onSave,
  onCancel,
  onDelete,
  saving,
  formatAmount,
}: {
  party: CaseParty
  clients: Client[]
  isEditing: boolean
  editData: { party_name: string; is_our_client: boolean; client_id: string | null; fee_allocation_amount: number | null } | null
  setEditData: (data: { party_name: string; is_our_client: boolean; client_id: string | null; fee_allocation_amount: number | null } | null) => void
  onEdit: () => void
  onSave: () => void
  onCancel: () => void
  onDelete: () => void
  saving: boolean
  formatAmount: (amount: number | null) => string
}) {
  if (isEditing && editData) {
    return (
      <div className="flex flex-col gap-2 p-3 bg-sage-50 rounded border border-sage-200">
        {/* 당사자명 수정 */}
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
        {/* 의뢰인 체크박스 */}
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
          <button
            onClick={onCancel}
            disabled={saving}
            className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1"
          >
            취소
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className="text-xs bg-sage-600 text-white px-3 py-1 rounded hover:bg-sage-700 disabled:opacity-50"
          >
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    )
  }

  // 의뢰인인 경우 실제 이름 사용, 아니면 SCOURT 이름 사용
  const displayName = party.is_our_client && party.clients?.name
    ? party.clients.name
    : party.party_name

  return (
    <div className="flex items-center justify-between py-1.5 px-2 bg-gray-50 rounded group">
      <div className="flex items-center gap-2 flex-wrap">
        {/* 당사자명 - 의뢰인이면 실제 이름 표시 */}
        <span className={party.is_our_client ? 'font-medium' : ''}>
          {displayName}
        </span>
        {/* 의뢰인 표시 */}
        {party.is_our_client && (
          <span className="text-xs text-sage-600">(의뢰인)</span>
        )}
        {/* 수임료 - 0이 아닌 경우에만 표시 */}
        {party.is_our_client && party.fee_allocation_amount !== null && party.fee_allocation_amount > 0 && (
          <span className="text-xs text-gray-500">
            {formatAmount(party.fee_allocation_amount)}
          </span>
        )}
        {/* 판결도달일 */}
        {party.adjdoc_rch_ymd && (
          <span className="text-xs text-gray-400">
            도달 {formatDate(party.adjdoc_rch_ymd)}
          </span>
        )}
        {/* 확정일 */}
        {party.indvd_cfmtn_ymd && (
          <span className="text-xs text-orange-500">
            확정 {formatDate(party.indvd_cfmtn_ymd)}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={onEdit}
          className="text-xs text-gray-400 hover:text-gray-600 px-1"
        >
          수정
        </button>
        {!party.scourt_synced && (
          <button
            onClick={onDelete}
            className="text-xs text-red-400 hover:text-red-600 px-1"
          >
            삭제
          </button>
        )}
      </div>
    </div>
  )
}

// 새 당사자 추가 폼 컴포넌트
function AddPartyForm({
  newPartyType,
  setNewPartyType,
  newPartyName,
  setNewPartyName,
  newIsClient,
  setNewIsClient,
  newClientId,
  setNewClientId,
  newFeeAmount,
  setNewFeeAmount,
  clients,
  saving,
  onSave,
  onCancel,
}: {
  newPartyType: PartyType
  setNewPartyType: (type: PartyType) => void
  newPartyName: string
  setNewPartyName: (name: string) => void
  newIsClient: boolean
  setNewIsClient: (isClient: boolean) => void
  newClientId: string | null
  setNewClientId: (id: string | null) => void
  newFeeAmount: number | null
  setNewFeeAmount: (amount: number | null) => void
  clients: Client[]
  saving: boolean
  onSave: () => void
  onCancel: () => void
}) {
  return (
    <div className="mt-3 p-3 border border-sage-200 rounded bg-sage-50">
      <div className="text-sm font-medium mb-2">새 당사자 추가</div>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500 w-16">유형:</label>
          <select
            value={newPartyType}
            onChange={(e) => setNewPartyType(e.target.value as PartyType)}
            className="text-sm border border-gray-200 rounded px-2 py-1 flex-1"
          >
            {Object.entries(PARTY_TYPE_LABELS).map(([type, label]) => (
              <option key={type} value={type}>{label}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500 w-16">이름:</label>
          <input
            type="text"
            value={newPartyName}
            onChange={(e) => setNewPartyName(e.target.value)}
            placeholder="당사자명"
            className="text-sm border border-gray-200 rounded px-2 py-1 flex-1"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 text-sm">
            <input
              type="checkbox"
              checked={newIsClient}
              onChange={(e) => setNewIsClient(e.target.checked)}
              className="rounded border-gray-300"
            />
            의뢰인으로 설정
          </label>
        </div>
        {newIsClient && (
          <>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500 w-16">의뢰인:</label>
              <select
                value={newClientId || ''}
                onChange={(e) => setNewClientId(e.target.value || null)}
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
                value={newFeeAmount || ''}
                onChange={(e) => setNewFeeAmount(e.target.value ? parseInt(e.target.value) : null)}
                placeholder="수임료 금액"
                className="text-sm border border-gray-200 rounded px-2 py-1 flex-1"
              />
              <span className="text-xs text-gray-400">원</span>
            </div>
          </>
        )}
      </div>
      <div className="flex justify-end gap-2 mt-3">
        <button
          onClick={onCancel}
          disabled={saving}
          className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1"
        >
          취소
        </button>
        <button
          onClick={onSave}
          disabled={saving}
          className="text-xs bg-sage-600 text-white px-3 py-1 rounded hover:bg-sage-700 disabled:opacity-50"
        >
          {saving ? '추가 중...' : '추가'}
        </button>
      </div>
    </div>
  )
}
