'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import type {
  CaseParty,
  CaseClient,
  PartyRepresentative,
  PartyType,
} from '@/types/case-party'
import { PARTY_TYPE_LABELS, getOppositePartyType, isMaskedPartyName, normalizePartyLabel, getPartyLabels } from '@/types/case-party'

// SCOURT 스냅샷 당사자 타입
interface ScourtSnapshotParty {
  btprNm: string
  btprDvsNm: string
  adjdocRchYmd?: string
  indvdCfmtnYmd?: string
}

// 실제 당사자 유형 (사건본인, 제3자 등 비의뢰인 유형 제외)
const REAL_PARTY_LABELS = [
  '원고', '피고', '채권자', '채무자', '신청인', '피신청인',
  '항소인', '피항소인', '상고인', '피상고인', '항고인', '상대방',
  '청구인', '피청구인', '소송수계인'
]

function isRealParty(label: string): boolean {
  const normalized = normalizePartyLabel(label)
  return REAL_PARTY_LABELS.some(l => normalized.includes(l))
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
  clientId: _clientId,
  clientName,
  clientRole,
  opponentName,
  onPartiesUpdate,
  scourtParties = [],
}: CasePartiesSectionProps) {
  // 사건유형 기반 당사자 라벨 결정
  const partyLabels = getPartyLabels(courtCaseNumber || '')
  const [parties, setParties] = useState<CaseParty[]>([])
  const [caseClients, setCaseClients] = useState<CaseClient[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 수정 중인 당사자
  const [editingPartyId, setEditingPartyId] = useState<string | null>(null)
  const [editData, setEditData] = useState<{
    party_name: string
  } | null>(null)

  // 당사자 및 의뢰인 목록 조회
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
        setCaseClients(data.caseClients || [])
      }
    } catch (err) {
      setError('당사자 목록 조회 실패')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [caseId])

  useEffect(() => {
    fetchParties()
  }, [fetchParties])

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

  // 당사자 이름 수정 저장
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

  // 의뢰인 연결 여부 확인 (case_clients에서)
  const getLinkedCaseClient = useCallback((partyId: string): CaseClient | undefined => {
    return caseClients.find(cc => cc.linked_party_id === partyId)
  }, [caseClients])

  // 로딩 중
  if (loading) {
    return (
      <div className="text-[var(--text-tertiary)] text-sm py-2">당사자 정보 로딩 중...</div>
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
              <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-primary)]">
                <th className="px-5 py-2 text-xs font-medium text-[var(--text-tertiary)] text-left w-24">구분</th>
                <th className="px-5 py-2 text-xs font-medium text-[var(--text-tertiary)] text-left">성명</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {realScourtParties.map((party, idx) => (
                <tr key={`scourt-party-${idx}`} className="hover:bg-[var(--bg-hover)]">
                  <td className="px-5 py-3 text-sm text-[var(--text-tertiary)]">{party.btprDvsNm}</td>
                  <td className="px-5 py-3 text-sm text-[var(--text-primary)]">{party.btprNm}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {error && <div className="px-5 py-2 text-xs text-[var(--color-danger)]">{error}</div>}
        </>
      )
    }

    // SCOURT 데이터도 없으면 기존 client/opponent 표시
    if (clientName || opponentName) {
      return (
        <>
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-primary)]">
                <th className="px-5 py-2 text-xs font-medium text-[var(--text-tertiary)] text-left w-24">구분</th>
                <th className="px-5 py-2 text-xs font-medium text-[var(--text-tertiary)] text-left">성명</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {clientName && (
                <tr className="hover:bg-[var(--bg-hover)]">
                  <td className="px-5 py-3 text-sm text-[var(--text-tertiary)]">
                    {clientRole ? PARTY_TYPE_LABELS[clientRole] : partyLabels.plaintiff}
                  </td>
                  <td className="px-5 py-3 text-sm">
                    <span className="font-medium text-[var(--text-primary)]">{clientName}</span>
                    <span className="ml-1.5 text-xs text-[var(--sage-primary)]">(의뢰인)</span>
                  </td>
                </tr>
              )}
              {opponentName && (
                <tr className="hover:bg-[var(--bg-hover)]">
                  <td className="px-5 py-3 text-sm text-[var(--text-tertiary)]">
                    {clientRole ? PARTY_TYPE_LABELS[getOppositePartyType(clientRole)] : partyLabels.defendant}
                  </td>
                  <td className="px-5 py-3 text-sm text-[var(--text-primary)]">{opponentName}</td>
                </tr>
              )}
            </tbody>
          </table>
          {error && <div className="px-5 py-2 text-xs text-[var(--color-danger)]">{error}</div>}
        </>
      )
    }

    // 데이터 없음
    return (
      <div className="text-[var(--text-muted)] text-sm px-5 py-6 text-center">
        등록된 당사자 정보가 없습니다.
      </div>
    )
  }

  // 당사자 데이터가 있으면 테이블 형식으로 표시
  return (
    <>
      <table className="w-full">
        <thead>
          <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-primary)]">
            <th className="px-5 py-2 text-xs font-medium text-[var(--text-tertiary)] text-left w-24">구분</th>
            <th className="px-5 py-2 text-xs font-medium text-[var(--text-tertiary)] text-left">성명</th>
            <th className="px-5 py-2 text-xs font-medium text-[var(--text-tertiary)] text-center w-16"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border-subtle)]">
          {/* 당사자 */}
          {Object.entries(partyGroups).map(([label, groupParties]) =>
            groupParties.map((party, idx) => {
              const linkedClient = getLinkedCaseClient(party.id)
              return (
                <PartyTableRow
                  key={party.id}
                  party={party}
                  label={label}
                  showLabel={idx === 0}
                  rowSpan={groupParties.length}
                  linkedClient={linkedClient}
                  isEditing={editingPartyId === party.id}
                  editData={editData}
                  setEditData={setEditData}
                  onEdit={() => {
                    setEditingPartyId(party.id)
                    setEditData({
                      party_name: party.party_name,
                    })
                  }}
                  onSave={() => handleSaveParty(party.id)}
                  onCancel={() => {
                    setEditingPartyId(null)
                    setEditData(null)
                  }}
                  saving={saving}
                />
              )
            })
          )}

          {/* 대리인 - 각 당사자의 representatives JSONB에서 표시 */}
          {(() => {
            // 모든 당사자의 대리인을 구분별로 그룹화
            const allReps: Array<PartyRepresentative & { partyLabel: string }> = []
            realParties.forEach(party => {
              const reps = party.representatives || []
              reps.forEach(rep => {
                allReps.push({
                  ...rep,
                  partyLabel: rep.type_label || '소송대리인'
                })
              })
            })

            // 구분별 그룹화
            const repGroups = allReps.reduce((groups, rep) => {
              const label = rep.partyLabel
              if (!groups[label]) groups[label] = []
              groups[label].push(rep)
              return groups
            }, {} as Record<string, Array<PartyRepresentative & { partyLabel: string }>>)

            return Object.entries(repGroups).map(([label, groupReps]) =>
              groupReps.map((rep, idx) => (
                <tr key={`${label}-${idx}`} className="hover:bg-[var(--bg-hover)]">
                  {idx === 0 && (
                    <td
                      className="px-5 py-3 text-sm text-[var(--text-tertiary)] align-top border-r border-[var(--border-subtle)]"
                      rowSpan={groupReps.length}
                    >
                      {label}
                    </td>
                  )}
                  <td className="px-5 py-3 text-sm text-[var(--text-primary)]">
                    <span className={rep.is_our_firm ? 'font-medium' : ''}>
                      {rep.name}
                    </span>
                    {rep.law_firm && (
                      <span className="ml-1.5 text-xs text-[var(--text-tertiary)]">({rep.law_firm})</span>
                    )}
                    {rep.is_our_firm && (
                      <span className="ml-1.5 text-xs text-[var(--sage-primary)]">(당 사무소)</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-center" />
                </tr>
              ))
            )
          })()}
        </tbody>
      </table>

      {error && (
        <div className="px-5 py-2 text-xs text-[var(--color-danger)]">{error}</div>
      )}
    </>
  )
}

// 당사자 테이블 행 컴포넌트 (간소화 - 의뢰인 관리는 case_clients에서 처리)
function PartyTableRow({
  party,
  label,
  showLabel,
  rowSpan,
  linkedClient,
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
  linkedClient?: CaseClient
  isEditing: boolean
  editData: { party_name: string } | null
  setEditData: (data: { party_name: string } | null) => void
  onEdit: () => void
  onSave: () => void
  onCancel: () => void
  saving: boolean
}) {
  // 번호 prefix 추출 (예: "1. " 또는 "1.")
  const numberPrefixMatch = party.party_name.match(/^(\d+\.\s*)/)
  const numberPrefix = numberPrefixMatch ? numberPrefixMatch[1] : ''

  // 의뢰인 연결이 있으면 의뢰인 이름 표시, 없으면 당사자 이름 사용
  const displayName = linkedClient?.client?.name
    ? `${numberPrefix}${linkedClient.client.name}`
    : party.party_name

  // 마스킹된 이름 감지 (예: 김OO, 이O수, 박OOO)
  const isMaskedName = isMaskedPartyName(party.party_name)

  // 수정 버튼 표시 조건: 마스킹된 이름
  const showEditButton = isMaskedName

  // 수정 모드일 때는 전체 행을 편집 폼으로 표시
  if (isEditing && editData) {
    const currentParsed = parsePartyName(editData.party_name)

    return (
      <tr className="bg-[var(--sage-muted)]">
        <td colSpan={3} className="px-5 py-4">
          <div className="space-y-3">
            {/* 성명 입력 */}
            <div className="flex items-center gap-3">
              <label className="form-label w-20 flex-shrink-0">성명</label>
              <div className="flex items-center flex-1 bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-lg overflow-hidden h-10 focus-within:border-[var(--sage-primary)] focus-within:ring-1 focus-within:ring-[var(--sage-primary)]">
                {currentParsed.prefix && (
                  <span className="text-sm font-medium text-[var(--text-tertiary)] bg-[var(--bg-primary)] px-3 h-full flex items-center border-r border-[var(--border-default)]">
                    {currentParsed.prefix}
                  </span>
                )}
                <input
                  type="text"
                  value={currentParsed.editable}
                  onChange={(e) => setEditData({
                    party_name: combinePartyName(currentParsed.prefix, e.target.value)
                  })}
                  className="text-sm px-3 flex-1 h-full font-medium outline-none bg-transparent"
                  placeholder="이름 입력"
                />
              </div>
            </div>

            {/* 버튼 영역 */}
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={onCancel}
                disabled={saving}
                className="btn btn-ghost text-sm"
              >
                취소
              </button>
              <button
                onClick={onSave}
                disabled={saving}
                className="btn btn-primary text-sm"
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
    <tr className="hover:bg-[var(--bg-hover)] group">
      {/* 구분 - rowSpan으로 그룹 표시 */}
      {showLabel && (
        <td
          className="px-5 py-3 text-sm text-[var(--text-tertiary)] align-top border-r border-[var(--border-subtle)]"
          rowSpan={rowSpan}
        >
          {label}
        </td>
      )}
      {/* 성명 */}
      <td className="px-5 py-3 text-sm text-[var(--text-primary)]">
        <span className={linkedClient ? 'font-medium' : ''}>
          {displayName}
        </span>
        {linkedClient && (
          <span className="ml-1.5 text-xs text-[var(--sage-primary)]">(의뢰인)</span>
        )}
      </td>
      {/* 수정 버튼 */}
      <td className="px-3 py-3 text-center">
        {showEditButton && (
          <button
            onClick={onEdit}
            className="text-xs px-2 py-0.5 rounded text-[var(--sage-primary)] hover:text-[var(--sage-primary)] hover:bg-[var(--sage-muted)]"
          >
            수정
          </button>
        )}
      </td>
    </tr>
  )
}
