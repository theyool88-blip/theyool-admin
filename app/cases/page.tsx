import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentTenantContext } from '@/lib/auth/tenant-context'
import CasesList from '@/components/CasesList'
import AdminLayoutClient from '@/components/AdminLayoutClient'

interface CaseParty {
  id: string
  party_name: string
  party_type: string
  party_type_label: string
  is_primary: boolean
}

interface CaseClient {
  client_id: string
  linked_party_id: string
  is_primary_client: boolean
}

interface RawCaseAssignee {
  id: string
  member_id: string
  is_primary: boolean
  member: {
    id: string
    display_name: string
    role: string
  } | null
}

export default async function CasesPage() {
  // 테넌트 컨텍스트 조회 (impersonation 포함)
  const tenantContext = await getCurrentTenantContext()
  if (!tenantContext) {
    redirect('/login')
  }

  const adminClient = createAdminClient()

  // 사건 데이터 미리 가져오기 (Service Role Key 사용)
  let query = adminClient
    .from('legal_cases')
    .select(`
      *,
      client:clients(id, name),
      case_parties(id, party_name, party_type, party_type_label, is_primary),
      case_clients(client_id, linked_party_id, is_primary_client),
      case_assignees(
        id,
        member_id,
        is_primary,
        member:tenant_members(id, display_name, role)
      )
    `)

  // 슈퍼 어드민이 아니면 테넌트 필터 적용
  if (!tenantContext.isSuperAdmin && tenantContext.tenantId) {
    query = query.eq('tenant_id', tenantContext.tenantId)
  }

  const { data: casesData } = await query.order('created_at', { ascending: false })

  // Fetch next hearings for all cases
  const caseIds = (casesData || []).map(c => c.id)
  const { data: nextHearings } = caseIds.length > 0
    ? await adminClient
        .from('court_hearings')
        .select('case_id, hearing_date, hearing_type')
        .in('case_id', caseIds)
        .gte('hearing_date', new Date().toISOString().split('T')[0])
        .eq('status', 'SCHEDULED')
        .order('hearing_date', { ascending: true })
    : { data: [] }

  // Create map of case_id -> next hearing
  const nextHearingMap = new Map<string, { date: string; type: string }>()
  for (const h of nextHearings || []) {
    if (!nextHearingMap.has(h.case_id)) {
      nextHearingMap.set(h.case_id, { date: h.hearing_date, type: h.hearing_type })
    }
  }

  // casesData 변환: parties 객체 추가
  const casesWithParties = (casesData || []).map((c) => {
    const parties = (c.case_parties || []) as CaseParty[]
    const clients = (c.case_clients || []) as CaseClient[]
    const caseAssignees = (c.case_assignees || []) as RawCaseAssignee[]

    // Transform assignees
    const transformedAssignees = caseAssignees.map(ca => ({
      id: ca.id,
      memberId: ca.member_id,
      isPrimary: ca.is_primary,
      displayName: ca.member?.display_name || '',
      role: ca.member?.role || ''
    }))

    // 의뢰인: 캐시 필드 사용 (fallback: client JOIN)
    const clientData = c.client as { id: string; name: string } | null
    const ourClientName = c.primary_client_name || clientData?.name

    // 상대방: case_clients → case_parties 연결로 조회
    const primaryClientLink = clients.find((cc) => cc.is_primary_client)
    const clientPartyId = primaryClientLink?.linked_party_id
    const clientParty = parties.find((p) => p.id === clientPartyId)
    const clientPartyType = clientParty?.party_type

    let opponent: string | null = null
    let opponentLabel: string | null = null
    if (clientPartyType) {
      const opponentType = clientPartyType === 'plaintiff' ? 'defendant' : 'plaintiff'
      const opponentParty = parties.find((p) =>
        p.party_type === opponentType && p.is_primary
      ) || parties.find((p) => p.party_type === opponentType)
      opponent = opponentParty?.party_name || null
      opponentLabel = opponentParty?.party_type_label || null
    } else {
      // Fallback: 레거시 데이터 - 의뢰인명과 다른 당사자를 상대방으로
      const opponentParty = parties.find((p) =>
        p.party_name !== ourClientName
      )
      opponent = opponentParty?.party_name || null
      opponentLabel = opponentParty?.party_type_label || null
    }

    // case_parties, case_clients, case_assignees는 제외하고 나머지 필드 유지
    const { case_parties: _, case_clients: __, case_assignees: ___, ...rest } = c

    return {
      ...rest,
      parties: {
        ourClient: ourClientName || null,
        ourClientLabel: clientParty?.party_type_label || null,
        opponent,
        opponentLabel,
      },
      assignees: transformedAssignees,
      next_hearing: nextHearingMap.get(c.id) || null
    }
  })

  return (
    <AdminLayoutClient>
      <CasesList initialCases={casesWithParties} />
    </AdminLayoutClient>
  )
}
