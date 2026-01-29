'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo } from 'react'
import {
  getPartyLabels as getPartyLabelsFromSchema,
  getCaseCategory,
  isMaskedPartyName,
  normalizePartyLabel,
  normalizePartyNameForMatch,
  PARTY_TYPE_LABELS,
  preservePrefix,
  PLAINTIFF_SIDE_TYPES,
  DEFENDANT_SIDE_TYPES,
  getPartySide,
} from '@/types/case-party'
import { getCourtAbbrev } from '@/lib/scourt/court-codes'

// Party side classification (labels only - types imported from @/types/case-party)
const PLAINTIFF_SIDE_LABELS = new Set([
  '원고', '채권자', '신청인', '항고인', '항소인', '상고인', '행위자', '청구인',
].map(label => normalizePartyLabel(label)))
const DEFENDANT_SIDE_LABELS = new Set([
  '피고', '채무자', '피신청인', '상대방', '피항고인', '피항소인', '피상고인',
  '보호소년', '피고인', '피고인명', '제3채무자', '피청구인', '피해아동', '피해자',
].map(label => normalizePartyLabel(label)))

interface Client {
  id: string
  name: string
  phone: string | null
  email: string | null
  address: string | null
  birth_date: string | null
  notes: string | null
}

interface CaseParty {
  id: string
  party_name: string
  party_type: string
  party_type_label: string | null
  scourt_label_raw?: string | null
  scourt_name_raw?: string | null
  party_order?: number | null
  is_primary?: boolean
  manual_override?: boolean
  scourt_party_index?: number | null
  clients?: {
    id: string
    name: string
    phone?: string | null
    email?: string | null
  } | null
  representatives?: Array<{
    name: string
    type_label: string | null
    law_firm: string | null
    is_our_firm: boolean
  }>
}

interface ScourtSnapshot {
  id: string
  scrapedAt: string
  caseType?: string
  basicInfo: Record<string, unknown>
  hearings: { date: string; time?: string; type: string; location?: string; result?: string }[]
  progress: { date: string; content: string; result?: string | null; progCttDvs?: string }[]
  documents: { date: string; content: string; submitter?: string }[]
  lowerCourt: { courtName?: string; court?: string; caseNo: string; result?: string; resultDate?: string; linkedCaseId?: string | null }[]
  relatedCases: { caseNo: string; caseName?: string; relation?: string; linkedCaseId?: string | null }[]
  rawData?: Record<string, unknown>
}

interface ScourtSyncStatus {
  lastSync: string | null
  status: string | null
  caseNumber: string | null
  isLinked: boolean
  profileId: string | null
}

interface CaseData {
  id: string
  contract_number: string | null
  case_name: string
  primary_client_id: string | null
  primary_client_name: string | null
  status: '진행중' | '종결'
  office: string | null
  court_case_number: string | null
  court_name: string | null
  scourt_case_name?: string | null
  scourt_enc_cs_no?: string | null
  client_role?: 'plaintiff' | 'defendant' | null
  case_level?: string | null
  case_result?: string | null
  onedrive_folder_url: string | null
  client?: Client
}

interface PrimaryParties {
  clientParty: CaseParty | null
  opponentParty: CaseParty | null
  clientSide: 'plaintiff' | 'defendant' | null
}

interface CaseClientLink {
  id: string
  client_id: string
  linked_party_id: string | null
  is_primary_client: boolean
  client?: {
    id: string
    name: string
    phone?: string | null
    email?: string | null
  } | null
}

// Next hearing info for metrics
interface NextHearingInfo {
  date: string
  type: string
  daysUntil: number
}

export interface CaseHeroSectionProps {
  caseData: CaseData
  casePartiesForDisplay: CaseParty[]
  primaryParties: PrimaryParties
  scourtSnapshot: ScourtSnapshot | null
  scourtSyncStatus: ScourtSyncStatus | null
  isLinked: boolean
  scourtSyncing: boolean
  onScourtSync: () => void
  onFinalize: () => void
  onDelete: () => void
  caseClients?: CaseClientLink[]
  // Next hearing info for prominent D-day display
  nextHearing?: NextHearingInfo | null
}

// Helper: Format progress date (YYYYMMDD -> YY.MM.DD)
function formatProgressDate(dateStr: string | null): string {
  if (!dateStr) return '-'
  if (dateStr.length === 8 && /^\d{8}$/.test(dateStr)) {
    return `${dateStr.slice(2,4)}.${dateStr.slice(4,6)}.${dateStr.slice(6,8)}`
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
    return `${dateStr.slice(2,4)}.${dateStr.slice(5,7)}.${dateStr.slice(8,10)}`
  }
  if (/^\d{4}\.\d{2}\.\d{2}/.test(dateStr)) {
    return `${dateStr.slice(2,4)}.${dateStr.slice(5,7)}.${dateStr.slice(8,10)}`
  }
  const match = dateStr.match(/(\d{4})\.(\d{2})\.(\d{2})/)
  if (match) {
    return dateStr.replace(match[0], `${match[1].slice(2)}.${match[2]}.${match[3]}`)
  }
  return dateStr
}

export default function CaseHeroSection({
  caseData,
  casePartiesForDisplay,
  primaryParties,
  scourtSnapshot,
  scourtSyncStatus,
  isLinked,
  scourtSyncing,
  onScourtSync,
  onFinalize,
  onDelete,
  caseClients = [],
  nextHearing,
}: CaseHeroSectionProps) {
  const router = useRouter()

  // Helper: Get basic info from snapshot
  const getBasicInfo = (koreanKey: string, apiKey?: string): string | number | undefined => {
    if (!scourtSnapshot?.basicInfo) return undefined
    const info = scourtSnapshot.basicInfo as Record<string, unknown>
    const value = info[koreanKey] || (apiKey ? info[apiKey] : undefined)
    if (typeof value === 'string' || typeof value === 'number') return value
    return undefined
  }

  // Helper: Get party labels from case number
  const getPartyLabels = (): { plaintiff: string; defendant: string; isCriminal: boolean } => {
    const courtCaseNum = caseData.court_case_number || ''
    return getPartyLabelsFromSchema(courtCaseNum)
  }

  // Helper: Get case status info
  const getCaseStatusInfo = () => {
    if (getBasicInfo('종국결과', 'endRslt') || caseData.case_result) {
      return null
    }
    return caseData.status === '진행중'
      ? { label: '진행중', style: 'bg-[var(--sage-muted)] text-[var(--sage-primary)]' }
      : { label: caseData.status, style: 'bg-[var(--bg-tertiary)] text-[var(--text-tertiary)]' }
  }

  // Helper: Get party name with client check (fallback when casePartiesForDisplay is empty)
  const getPartyName = (role: 'plaintiff' | 'defendant', scourtName?: string) => {
    const isClient = caseData.client_role === role
    const clientName = caseData.client?.name
    const hasUnmaskedClientName = clientName && !isMaskedPartyName(clientName)

    // 의뢰인 측이고 마스킹되지 않은 이름이 있으면 사용
    if (isClient && hasUnmaskedClientName) {
      return { name: clientName, isClient: true }
    }

    // client_role이 없을 때: 첫 글자 매칭으로 의뢰인 판단
    if (!caseData.client_role && hasUnmaskedClientName && scourtName) {
      const clientFirstChar = clientName.charAt(0)
      const cleanedScourtName = scourtName.replace(/^\d+\.\s*/, '').trim()
      const scourtFirstChar = cleanedScourtName.charAt(0)

      interface PartyItem { btprNm?: string }
      const basicInfo = scourtSnapshot?.basicInfo as { parties?: PartyItem[] } | undefined
      const partiesArr = basicInfo?.parties || []
      const matchingParties = partiesArr.filter((p: PartyItem) => {
        const cleaned = (p.btprNm || '').replace(/^\d+\.\s*/, '').trim()
        return cleaned.charAt(0) === clientFirstChar && isMaskedPartyName(cleaned)
      })

      if (matchingParties.length === 1 && clientFirstChar === scourtFirstChar && isMaskedPartyName(cleanedScourtName)) {
        return { name: clientName, isClient: true }
      }
    }

    if (scourtName) {
      return { name: scourtName, isClient: false }
    }
    return { name: '-', isClient: false }
  }

  // Render party info (simplified)
  const renderPartyInfo = () => {
    const partyLabels = getPartyLabels()
    const removeNumberPrefix = (name: string) => name.replace(/^\d+\.\s*/, '')
    const PARTY_NAME_SUFFIX_REGEX = /\s*외\s*\d+\s*(?:명)?\s*$/

    const resolveCasePartyName = (party: CaseParty) => {
      // 1순위: linked_party_id로 연결된 의뢰인 이름
      const clientName = party.clients?.name?.trim()
      if (clientName && !isMaskedPartyName(clientName)) return removeNumberPrefix(clientName)
      // 2순위: party_name (마스킹 안된 경우)
      const partyName = party.party_name?.trim()
      if (partyName && !isMaskedPartyName(partyName)) return removeNumberPrefix(partyName)
      return null
    }

    const applyDisplayName = (originalName: string, fullName: string) => {
      const combined = originalName ? preservePrefix(originalName, fullName) : fullName
      return removeNumberPrefix(combined)
    }

    const getSideFromLabel = (label: string): 'plaintiff' | 'defendant' | null => {
      const normalized = normalizePartyLabel(label)
      if (PLAINTIFF_SIDE_LABELS.has(normalized)) return 'plaintiff'
      if (DEFENDANT_SIDE_LABELS.has(normalized)) return 'defendant'
      return null
    }

    const getCasePartyLabel = (party: CaseParty) => (
      normalizePartyLabel(
        party.scourt_label_raw ||
        party.party_type_label ||
        PARTY_TYPE_LABELS[party.party_type as keyof typeof PARTY_TYPE_LABELS] ||
        ''
      )
    )

    const getCasePartySide = (party: CaseParty) => {
      const labelSide = getSideFromLabel(getCasePartyLabel(party))
      if (labelSide) return labelSide
      // Use imported getPartySide function with type assertion
      return getPartySide(party.party_type as import('@/types/case-party').PartyType)
    }

    const heroPartyLabels = new Set([
      '원고', '피고', '채권자', '채무자', '신청인', '피신청인',
      '항소인', '피항소인', '상고인', '피상고인', '항고인', '피항고인', '상대방',
      '행위자', '보호소년', '피고인', '피고인명', '피해아동', '피해자', '제3채무자'
    ].map(label => normalizePartyLabel(label)))

    interface RawPartyItem {
      btprDvsNm?: string
      btprtDvsNm?: string
      btprtStndngNm?: string
      btprNm?: string
      btprtNm?: string
    }
    interface BasicInfoWithLabelsAndParties {
      parties?: RawPartyItem[]
      titRprsPtnr?: string
      titRprsRqstr?: string
    }
    interface RawDataWithParties {
      data?: { dlt_btprtCttLst?: RawPartyItem[] }
      dlt_btprtCttLst?: RawPartyItem[]
    }
    const scourtBasicInfo = scourtSnapshot?.basicInfo as BasicInfoWithLabelsAndParties | undefined
    const scourtRawData = scourtSnapshot?.rawData as RawDataWithParties | undefined
    const rawParties = scourtRawData?.data?.dlt_btprtCttLst || scourtRawData?.dlt_btprtCttLst || scourtBasicInfo?.parties || []

    const scourtLabelByIndex = new Map<number, string>()
    const scourtLabelByNormalized = new Map<string, string>()

    rawParties.forEach((p, index) => {
      const rawLabel = p.btprtDvsNm || p.btprDvsNm || p.btprtStndngNm || ''
      const normalizedLabel = normalizePartyLabel(rawLabel)
      if (!normalizedLabel || normalizedLabel.startsWith('사건본인')) return
      const displayLabel = rawLabel.trim() || normalizedLabel
      scourtLabelByIndex.set(index, displayLabel)
      if (!scourtLabelByNormalized.has(normalizedLabel)) {
        scourtLabelByNormalized.set(normalizedLabel, displayLabel)
      }
    })

    const heroPartyTypes = new Set([
      'plaintiff', 'defendant', 'creditor', 'debtor', 'applicant',
      'respondent', 'actor', 'juvenile', 'accused', 'third_debtor',
    ])

    const getFallbackLabel = (party: CaseParty) => (
      party.scourt_label_raw ||
      party.party_type_label ||
      PARTY_TYPE_LABELS[party.party_type as keyof typeof PARTY_TYPE_LABELS] ||
      ''
    )

    const getDisplayLabelForParty = (party: CaseParty) => {
      const fallbackLabel = getFallbackLabel(party)
      const normalizedLabel = normalizePartyLabel(fallbackLabel)
      if (party.scourt_party_index !== null && party.scourt_party_index !== undefined) {
        const scourtLabel = scourtLabelByIndex.get(party.scourt_party_index)
        if (scourtLabel) return scourtLabel
      }
      if (normalizedLabel && scourtLabelByNormalized.has(normalizedLabel)) {
        return scourtLabelByNormalized.get(normalizedLabel) || fallbackLabel
      }
      return fallbackLabel
    }

    if (casePartiesForDisplay.length > 0) {
      const sideGroups: Record<'plaintiff' | 'defendant', CaseParty[]> = {
        plaintiff: [],
        defendant: [],
      }

      casePartiesForDisplay.forEach(party => {
        const displayLabel = getDisplayLabelForParty(party)
        if (!displayLabel) return

        const normalizedLabel = normalizePartyLabel(displayLabel)
        if (normalizedLabel.startsWith('사건본인')) return

        if (!heroPartyLabels.has(normalizedLabel) && !heroPartyTypes.has(party.party_type || '')) {
          return
        }

        const side = getSideFromLabel(displayLabel) || getCasePartySide(party)
        if (!side) return
        sideGroups[side].push(party)
      })

      const resolveSideLabel = (side: 'plaintiff' | 'defendant', parties: CaseParty[]) => {
        const scourtLabel = side === 'plaintiff'
          ? scourtBasicInfo?.titRprsPtnr?.trim()
          : scourtBasicInfo?.titRprsRqstr?.trim()
        if (scourtLabel) return scourtLabel

        const labelFromParties = parties
          .map(p => getDisplayLabelForParty(p))
          .find(label => !!label)
        if (labelFromParties) return labelFromParties

        return side === 'plaintiff' ? partyLabels.plaintiff : partyLabels.defendant
      }

      const buildSideGroup = (side: 'plaintiff' | 'defendant') => {
        const parties = sideGroups[side]
        if (parties.length === 0) return null

        const label = resolveSideLabel(side, parties)
        if (!label) return null

        const isClientSide = (() => {
          // 1순위: primaryParties.clientSide 사용 (이미 case_clients.linked_party_id 반영됨)
          if (primaryParties.clientSide) {
            return side === primaryParties.clientSide
          }

          // 2순위: caseClients의 linked_party_id로 판단
          if (caseClients.length > 0) {
            const linkedPartyId = caseClients.find(cc => cc.linked_party_id)?.linked_party_id
            if (linkedPartyId) {
              const linkedParty = parties.find(p => p.id === linkedPartyId)
              if (linkedParty) {
                const linkedPartySide = getCasePartySide(linkedParty)
                return side === linkedPartySide
              }
            }
          }

          // 3순위: is_primary로 판단
          if (parties.some(p => p.is_primary)) {
            return true
          }

          // 4순위: client_role (레거시)
          if (caseData.client_role) {
            return caseData.client_role === side
          }
          return false
        })()
        const primaryParty = parties.find(p => p.is_primary)
        const preferredParty = primaryParty || parties.find(p => resolveCasePartyName(p)) || parties[0]
        const baseName = preferredParty?.party_name || ''

        let displayName = preferredParty?.party_name || '-'
        // 1순위: party.clients?.name (새 스키마 - linked_party_id 연결)
        const resolvedName = preferredParty ? resolveCasePartyName(preferredParty) : null
        if (resolvedName) {
          displayName = applyDisplayName(baseName, resolvedName)
        } else if (isClientSide && caseData.client?.name && !isMaskedPartyName(caseData.client.name)) {
          // 2순위: caseData.client?.name (레거시 폴백)
          displayName = applyDisplayName(baseName, caseData.client.name)
        } else if (preferredParty?.party_name) {
          displayName = removeNumberPrefix(preferredParty.party_name)
        }

        const uniqueNames = new Set<string>()
        parties.forEach(party => {
          let nameForCount = party.party_name || ''
          // 1순위: party.clients?.name (새 스키마)
          const resolvedName = resolveCasePartyName(party)
          if (resolvedName) {
            nameForCount = resolvedName
          } else if (party.is_primary && caseData.client?.name && !isMaskedPartyName(caseData.client.name)) {
            // 2순위: caseData.client?.name (레거시 폴백)
            nameForCount = caseData.client.name
          }
          const normalized = normalizePartyNameForMatch(nameForCount)
          if (normalized) uniqueNames.add(normalized)
        })
        const uniqueCount = uniqueNames.size
        const otherCount = Math.max(0, (uniqueCount || parties.length) - 1)

        if (otherCount === 0) {
          displayName = displayName.replace(PARTY_NAME_SUFFIX_REGEX, '').trim() || displayName
        }

        const hasOtherSuffix = PARTY_NAME_SUFFIX_REGEX.test(displayName)

        return { label, name: displayName, isClient: isClientSide, otherCount, hasOtherSuffix }
      }

      const groups = [buildSideGroup('plaintiff'), buildSideGroup('defendant')]
        .filter((group): group is NonNullable<typeof group> => Boolean(group))

      if (groups.length > 0) {
        groups.sort((a, b) => {
          if (a.isClient && !b.isClient) return -1
          if (!a.isClient && b.isClient) return 1
          return 0
        })

        return groups.map((group, idx) => (
          <div key={idx} className="flex items-center gap-2">
            {group.isClient ? (
              <>
                <span className="text-xs px-2 py-0.5 bg-[var(--sage-muted)] text-[var(--sage-primary)] rounded font-medium">
                  의뢰인 {group.label}
                </span>
                {caseData.primary_client_id ? (
                  <Link
                    href={`/clients/${caseData.primary_client_id}`}
                    className="text-sm font-semibold text-[var(--text-primary)] hover:text-[var(--sage-primary)] hover:underline"
                  >
                    {group.name}
                    {caseData.client?.phone && (
                      <span className="ml-2 font-normal text-[var(--text-tertiary)]">{caseData.client.phone}</span>
                    )}
                    {group.otherCount > 0 && !group.hasOtherSuffix && (
                      <span className="font-normal text-[var(--text-tertiary)] ml-1">외 {group.otherCount}</span>
                    )}
                  </Link>
                ) : (
                  <span className="text-sm font-semibold text-[var(--text-primary)]">
                    {group.name}
                    {group.otherCount > 0 && !group.hasOtherSuffix && (
                      <span className="font-normal text-[var(--text-tertiary)] ml-1">외 {group.otherCount}</span>
                    )}
                  </span>
                )}
              </>
            ) : (
              <>
                <span className="text-xs px-2 py-0.5 bg-[var(--bg-tertiary)] text-[var(--text-secondary)] rounded">{group.label}</span>
                <span className="text-sm text-[var(--text-secondary)]">
                  {group.name}
                  {group.otherCount > 0 && !group.hasOtherSuffix && (
                    <span className="text-[var(--text-tertiary)] ml-1">외 {group.otherCount}</span>
                  )}
                </span>
              </>
            )}
          </div>
        ))
      }
    }

    // Fallback for criminal cases
    if (partyLabels.isCriminal) {
      const defendantName = String(getBasicInfo('피고인명', 'dfndtNm') || getBasicInfo('피고', 'rspNm') || '-')
      const isClient = caseData.client_role === 'defendant'
      return (
        <div className="flex items-center gap-2">
          {isClient ? (
            <>
              <span className="text-xs px-2 py-0.5 bg-[var(--sage-muted)] text-[var(--sage-primary)] rounded font-medium">
                의뢰인 {partyLabels.defendant}
              </span>
              <span className="text-sm font-semibold text-[var(--text-primary)]">
                {caseData.client?.name || defendantName}
              </span>
            </>
          ) : (
            <>
              <span className="text-xs px-2 py-0.5 bg-[var(--bg-tertiary)] text-[var(--text-secondary)] rounded">{partyLabels.defendant}</span>
              <span className="text-sm text-[var(--text-secondary)]">{defendantName}</span>
            </>
          )}
        </div>
      )
    }

    // SCOURT snapshot based fallback
    interface ScourtParty { btprDvsNm?: string; btprNm?: string }
    const partiesBasicInfo = scourtSnapshot?.basicInfo as { parties?: ScourtParty[] } | undefined
    const partiesArray = partiesBasicInfo?.parties || []
    const plaintiffSideLabels = ['원고', '채권자', '신청인', '항고인', '항소인', '상고인']
    const defendantSideLabels = ['피고', '채무자', '피신청인', '상대방', '피항고인', '피항소인', '피상고인']

    const findPartyByType = (types: string[]): { label: string; name: string } | null => {
      const found = partiesArray.find((p: ScourtParty) =>
        types.some(t => p.btprDvsNm?.includes(t))
      )
      if (found) {
        return { label: found.btprDvsNm || '', name: found.btprNm || '' }
      }
      return null
    }

    const getPlaintiffInfo = (): { label: string; name: string } => {
      const fromParties = findPartyByType(plaintiffSideLabels)
      if (fromParties?.name) {
        return { label: fromParties.label, name: fromParties.name }
      }
      const fromBasicInfo =
        getBasicInfo('채권자', 'crdtNm') ||
        getBasicInfo('신청인', 'aplcNm') ||
        getBasicInfo('원고', 'aplNm')
      if (fromBasicInfo) {
        return { label: partyLabels.plaintiff, name: String(fromBasicInfo) }
      }
      if (partiesArray[0]) {
        return { label: partiesArray[0].btprDvsNm || partyLabels.plaintiff, name: partiesArray[0].btprNm || '-' }
      }
      return { label: partyLabels.plaintiff, name: '-' }
    }

    const getDefendantInfo = (): { label: string; name: string } => {
      const fromParties = findPartyByType(defendantSideLabels)
      if (fromParties?.name) {
        return { label: fromParties.label, name: fromParties.name }
      }
      const fromBasicInfo =
        getBasicInfo('채무자', 'dbtNm') ||
        getBasicInfo('피신청인', 'rspNm') ||
        getBasicInfo('피고', 'rspNm')
      if (fromBasicInfo) {
        return { label: partyLabels.defendant, name: String(fromBasicInfo) }
      }
      if (partiesArray[1]) {
        return { label: partiesArray[1].btprDvsNm || partyLabels.defendant, name: partiesArray[1].btprNm || '-' }
      }
      return { label: partyLabels.defendant, name: '-' }
    }

    const plaintiffData = getPlaintiffInfo()
    const defendantData = getDefendantInfo()
    const plaintiffInfo = getPartyName('plaintiff', plaintiffData.name)
    const defendantInfo = getPartyName('defendant', defendantData.name)

    const parties = [
      { role: 'plaintiff', label: plaintiffData.label, info: plaintiffInfo },
      { role: 'defendant', label: defendantData.label, info: defendantInfo }
    ]

    parties.sort((a, b) => {
      if (a.info.isClient && !b.info.isClient) return -1
      if (!a.info.isClient && b.info.isClient) return 1
      return 0
    })

    return parties.map((party) => (
      <div key={party.role} className="flex items-center gap-2">
        {party.info.isClient ? (
          <>
            <span className="text-xs px-2 py-0.5 bg-[var(--sage-muted)] text-[var(--sage-primary)] rounded font-medium">
              의뢰인 {party.label}
            </span>
            {caseData.primary_client_id ? (
              <Link
                href={`/clients/${caseData.primary_client_id}`}
                className="text-sm font-semibold text-[var(--text-primary)] hover:text-[var(--sage-primary)] hover:underline"
              >
                {party.info.name}
                {caseData.client?.phone && (
                  <span className="ml-2 font-normal text-[var(--text-tertiary)]">{caseData.client.phone}</span>
                )}
              </Link>
            ) : (
              <span className="text-sm font-semibold text-[var(--text-primary)]">
                {party.info.name}
              </span>
            )}
          </>
        ) : (
          <>
            <span className="text-xs px-2 py-0.5 bg-[var(--bg-tertiary)] text-[var(--text-secondary)] rounded">{party.label}</span>
            <span className="text-sm text-[var(--text-secondary)]">{party.info.name}</span>
          </>
        )}
      </div>
    ))
  }

  // Format D-day display
  const formatDDay = (days: number) => {
    if (days === 0) return 'D-Day'
    if (days > 0) return `D-${days}`
    return `D+${Math.abs(days)}`
  }

  // Get D-day styling based on urgency
  const getDDayStyle = (days: number) => {
    if (days < 0) return {
      bg: 'bg-[var(--color-danger)]',
      text: 'text-white',
      ring: 'ring-[var(--color-danger)]/20'
    }
    if (days <= 3) return {
      bg: 'bg-[var(--color-warning)]',
      text: 'text-white',
      ring: 'ring-[var(--color-warning)]/20'
    }
    if (days <= 7) return {
      bg: 'bg-[var(--sage-primary)]',
      text: 'text-white',
      ring: 'ring-[var(--sage-primary)]/20'
    }
    return {
      bg: 'bg-[var(--bg-tertiary)]',
      text: 'text-[var(--text-primary)]',
      ring: 'ring-[var(--border-default)]'
    }
  }

  // Format hearing date
  const formatHearingDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const month = date.getMonth() + 1
    const day = date.getDate()
    const weekdays = ['일', '월', '화', '수', '목', '금', '토']
    const weekday = weekdays[date.getDay()]
    return `${month}/${day} (${weekday})`
  }

  return (
    <div className="card p-0 mb-6 overflow-hidden">
      {/* Next Hearing Banner - Prominent D-day Display */}
      {nextHearing && (
        <div className="px-6 py-4 bg-[var(--bg-tertiary)] border-b border-[var(--border-subtle)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* D-day Badge - Large and prominent */}
              <div className={`
                flex items-center justify-center min-w-[72px] h-[72px] rounded-2xl
                ${getDDayStyle(nextHearing.daysUntil).bg} ${getDDayStyle(nextHearing.daysUntil).text}
                ring-4 ${getDDayStyle(nextHearing.daysUntil).ring}
                shadow-lg
              `}>
                <span className="text-2xl font-bold tracking-tight">
                  {formatDDay(nextHearing.daysUntil)}
                </span>
              </div>

              {/* Hearing Info */}
              <div>
                <p className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider mb-1">
                  다음 기일
                </p>
                <p className="text-lg font-semibold text-[var(--text-primary)]">
                  {formatHearingDate(nextHearing.date)}
                </p>
                <p className="text-sm text-[var(--text-secondary)]">
                  {nextHearing.type}
                </p>
              </div>
            </div>

            {/* Calendar icon */}
            <div className="hidden sm:flex items-center justify-center w-10 h-10 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
              <svg className="w-5 h-5 text-[var(--text-tertiary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="p-6 sm:p-8">
        {/* Top row: Badges */}
        <div className="flex items-center flex-wrap gap-2 mb-4">
          {caseData.office && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-[var(--bg-tertiary)] text-[var(--text-secondary)]">
              {caseData.office}
            </span>
          )}
          {(() => {
            const statusInfo = getCaseStatusInfo()
            if (!statusInfo) return null
            return (
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                caseData.status === '진행중'
                  ? 'bg-[var(--sage-muted)] text-[var(--sage-primary)]'
                  : 'bg-[var(--bg-tertiary)] text-[var(--text-tertiary)]'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${
                  caseData.status === '진행중' ? 'bg-[var(--sage-primary)]' : 'bg-[var(--text-tertiary)]'
                }`} />
                {statusInfo.label}
              </span>
            )
          })()}
          {/* Case level badge */}
          {(() => {
            const category = getCaseCategory(caseData.court_case_number || '')
            const isApplicationCase = ['신청', '집행', '가사신청'].includes(category)
            if (isApplicationCase || !caseData.case_level || ['신청', '기타'].includes(caseData.case_level)) {
              return null
            }
            return (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-[var(--color-info-muted)] text-[var(--color-info)]">
                {caseData.case_level}
              </span>
            )
          })()}
          {/* Merge division badge */}
          {(() => {
            const mrgrDvs = (scourtSnapshot?.basicInfo as Record<string, string> | undefined)?.['병합구분'] ||
                            (scourtSnapshot?.basicInfo as Record<string, string> | undefined)?.mrgrDvs
            return mrgrDvs && mrgrDvs !== '없음' && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-[var(--color-info-muted)] text-[var(--color-info)]">
                {mrgrDvs}
              </span>
            )
          })()}
          {/* Result badge */}
          {(getBasicInfo('종국결과', 'endRslt') || caseData.case_result) && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-[var(--color-warning-muted)] text-[var(--color-warning)]">
              {getBasicInfo('종국결과', 'endRslt') || caseData.case_result}
              {getBasicInfo('종국일', 'endDt') && (
                <span className="ml-1 opacity-75">({formatProgressDate(String(getBasicInfo('종국일', 'endDt')))})</span>
              )}
            </span>
          )}
          {getBasicInfo('확정일', 'cfrmDt') && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-[var(--sage-muted)] text-[var(--sage-primary)]">
              {formatProgressDate(String(getBasicInfo('확정일', 'cfrmDt')))} 확정
            </span>
          )}
        </div>

        {/* Main title: Court case number */}
        <h1 className="text-display text-[var(--text-primary)] mb-2">
          {getCourtAbbrev(caseData.court_name)} {caseData.court_case_number}
        </h1>

        {/* Case name */}
        <p className="text-subheading text-[var(--text-secondary)] mb-5">
          {getBasicInfo('사건명', 'csNm') || caseData.scourt_case_name || caseData.case_name}
        </p>

        {/* Party info - simplified */}
        <div className="flex flex-wrap gap-4 mb-6">
          {renderPartyInfo()}
        </div>

        {/* Quick Actions Bar */}
        <div className="flex items-center flex-wrap gap-3 pt-5 border-t border-[var(--border-default)]">
          {/* Document folder */}
          {caseData.onedrive_folder_url && (
            <a
              href={caseData.onedrive_folder_url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M7.71 3.5l1.6 1.5h5.36a1.5 1.5 0 0 1 1.5 1.5v1h2.33a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5H5.5A1.5 1.5 0 0 1 4 17V5a1.5 1.5 0 0 1 1.5-1.5h2.21z"/>
              </svg>
              서류 폴더
            </a>
          )}

          {/* SCOURT sync/link button */}
          {isLinked ? (
            <button
              onClick={onScourtSync}
              disabled={scourtSyncing}
              className="btn btn-secondary disabled:opacity-50"
            >
              {scourtSyncing ? (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              )}
              {scourtSyncing ? '갱신 중...' : '갱신'}
            </button>
          ) : (
            <button
              onClick={onScourtSync}
              disabled={scourtSyncing}
              className="btn btn-secondary disabled:opacity-50"
            >
              {scourtSyncing ? (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                </svg>
              )}
              {scourtSyncing ? '연동 중...' : '대법원 연동'}
            </button>
          )}

          {/* Right button group */}
          <div className="flex items-center gap-2 ml-auto">
            {/* Last sync time */}
            {scourtSyncStatus?.lastSync && (
              <span className="text-xs text-[var(--text-muted)] mr-2 hidden sm:inline">
                {(() => {
                  const d = new Date(scourtSyncStatus.lastSync)
                  const now = new Date()
                  const diffMs = now.getTime() - d.getTime()
                  const diffMins = Math.floor(diffMs / 60000)
                  const diffHours = Math.floor(diffMs / 3600000)
                  const diffDays = Math.floor(diffMs / 86400000)

                  if (diffMins < 1) return '방금 전 갱신'
                  if (diffMins < 60) return `${diffMins}분 전 갱신`
                  if (diffHours < 24) return `${diffHours}시간 전 갱신`
                  if (diffDays < 7) return `${diffDays}일 전 갱신`
                  return `${d.getMonth() + 1}/${d.getDate()} 갱신`
                })()}
              </span>
            )}

            {/* Finalize button (only when in progress) */}
            {caseData.status === '진행중' && (
              <button
                onClick={onFinalize}
                className="btn btn-ghost"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="hidden sm:inline">종결</span>
              </button>
            )}

            {/* Delete button */}
            <button
              onClick={onDelete}
              className="btn btn-danger-ghost"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              <span className="hidden sm:inline">삭제</span>
            </button>

            {/* Edit button */}
            <button
              onClick={() => router.push(`/cases/${caseData.id}/edit`)}
              className="btn btn-ghost"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              <span className="hidden sm:inline">수정</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
