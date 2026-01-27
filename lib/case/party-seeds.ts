import {
  PARTY_TYPE_LABELS,
  getOppositePartyType,
  mapScourtPartyType,
  getPartyLabels,
  type PartyType,
} from '@/types/case-party'

export interface ManualPartySeedInput {
  clientName?: string | null
  opponentName?: string | null
  clientRole?: PartyType | null
  caseNumber?: string | null
  clientId?: string | null
}

export interface ManualPartySeed {
  party_name: string
  party_type: PartyType
  party_type_label: string
  is_primary: boolean  // NOTE: is_our_client → is_primary로 변경됨
}

export function buildManualPartySeeds({
  clientName,
  opponentName,
  clientRole,
  caseNumber,
  clientId,
}: ManualPartySeedInput): ManualPartySeed[] {
  const seeds: ManualPartySeed[] = []
  const trimmedClientName = clientName?.trim() || ''
  const trimmedOpponentName = opponentName?.trim() || ''

  if (!trimmedClientName && !trimmedOpponentName) return seeds

  const labels = getPartyLabels(caseNumber || '')
  let clientLabel = ''
  let opponentLabel = ''
  let resolvedClientRole: PartyType
  let resolvedOpponentRole: PartyType

  if (clientRole) {
    resolvedClientRole = clientRole
    resolvedOpponentRole = getOppositePartyType(resolvedClientRole)
    if (clientRole === 'plaintiff') {
      clientLabel = labels.plaintiff || PARTY_TYPE_LABELS[resolvedClientRole] || '원고'
      opponentLabel = labels.defendant || PARTY_TYPE_LABELS[resolvedOpponentRole] || '피고'
    } else if (clientRole === 'defendant') {
      clientLabel = labels.defendant || PARTY_TYPE_LABELS[resolvedClientRole] || '피고'
      opponentLabel = labels.plaintiff || PARTY_TYPE_LABELS[resolvedOpponentRole] || '원고'
    } else {
      clientLabel = PARTY_TYPE_LABELS[resolvedClientRole] || labels.plaintiff || labels.defendant || '원고'
      opponentLabel = PARTY_TYPE_LABELS[resolvedOpponentRole] || labels.defendant || labels.plaintiff || '피고'
    }
  } else {
    clientLabel = labels.plaintiff || labels.defendant || '원고'
    opponentLabel = labels.defendant && labels.defendant !== clientLabel ? labels.defendant : ''
    resolvedClientRole = mapScourtPartyType(clientLabel)
    resolvedOpponentRole = opponentLabel
      ? mapScourtPartyType(opponentLabel)
      : getOppositePartyType(resolvedClientRole)
    if (!opponentLabel) {
      opponentLabel = PARTY_TYPE_LABELS[resolvedOpponentRole] || labels.defendant || '피고'
    }
  }

  if (trimmedClientName) {
    seeds.push({
      party_name: trimmedClientName,
      party_type: resolvedClientRole,
      party_type_label: clientLabel,
      is_primary: true,  // 의뢰인 측 대표 당사자
    })
  }

  if (trimmedOpponentName) {
    seeds.push({
      party_name: trimmedOpponentName,
      party_type: resolvedOpponentRole,
      party_type_label: opponentLabel,
      is_primary: false,  // 상대방 측 (대표 아님)
    })
  }

  return seeds
}
