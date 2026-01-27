import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentTenantContext } from '@/lib/auth/tenant-context'
import NewCaseForm from '@/components/NewCaseForm'
import AdminLayoutClient from '@/components/AdminLayoutClient'

interface PageProps {
  searchParams: Promise<{
    caseNumber?: string
    courtName?: string
    clientId?: string
    partyName?: string  // 대법원 연동용 당사자명
    sourceCaseId?: string
    relationType?: string
    relationEncCsNo?: string
  }>
}

export default async function NewCasePage({ searchParams }: PageProps) {
  const params = await searchParams

  // 테넌트 컨텍스트 조회 (impersonation 포함)
  const tenantContext = await getCurrentTenantContext()
  if (!tenantContext) {
    redirect('/login')
  }

  const adminClient = createAdminClient()

  // 의뢰인 목록 가져오기 (사건 등록 시 선택할 수 있도록) - 테넌트 필터 적용
  let clientsQuery = adminClient
    .from('clients')
    .select('id, name, phone, email')

  if (!tenantContext.isSuperAdmin && tenantContext.tenantId) {
    clientsQuery = clientsQuery.eq('tenant_id', tenantContext.tenantId)
  }

  const { data: clients } = await clientsQuery.order('created_at', { ascending: false })
  let sourceCase: { client_role?: 'plaintiff' | 'defendant' | null; opponent_name?: string | null } | null = null

  if (params.sourceCaseId) {
    // case_clients + case_parties에서 client_role 조회
    const { data: caseClient } = await adminClient
      .from('case_clients')
      .select('linked_party_id')
      .eq('case_id', params.sourceCaseId)
      .eq('is_primary_client', true)
      .maybeSingle()

    let clientRole: 'plaintiff' | 'defendant' | null = null

    if (caseClient?.linked_party_id) {
      const { data: clientParty } = await adminClient
        .from('case_parties')
        .select('party_type')
        .eq('id', caseClient.linked_party_id)
        .single()

      if (clientParty) {
        clientRole = clientParty.party_type === 'plaintiff' ? 'plaintiff' : 'defendant'
      }
    } else {
      // linked_party_id가 없으면 is_primary=true인 당사자의 party_type 사용
      // NOTE: is_our_client 컬럼이 스키마에서 제거됨
      const { data: primaryParty } = await adminClient
        .from('case_parties')
        .select('party_type')
        .eq('case_id', params.sourceCaseId)
        .eq('is_primary', true)
        .maybeSingle()

      if (primaryParty) {
        clientRole = primaryParty.party_type === 'plaintiff' ? 'plaintiff' : 'defendant'
      }
    }

    // case_parties에서 상대방(is_primary=false) 이름 조회
    const { data: opponentParty } = await adminClient
      .from('case_parties')
      .select('party_name')
      .eq('case_id', params.sourceCaseId)
      .eq('is_primary', false)
      .order('party_order', { ascending: true })
      .limit(1)
      .maybeSingle()

    sourceCase = {
      client_role: clientRole,
      opponent_name: opponentParty?.party_name || null
    }
  }

  return (
    <AdminLayoutClient>
      <NewCaseForm
        clients={clients || []}
        initialCaseNumber={params.caseNumber}
        initialCourtName={params.courtName}
        initialClientId={params.clientId}
        initialPartyName={params.partyName}
        sourceCaseId={params.sourceCaseId}
        initialClientRole={sourceCase?.client_role || null}
        initialOpponentName={sourceCase?.opponent_name || null}
        sourceRelationType={params.relationType}
        sourceRelationEncCsNo={params.relationEncCsNo}
      />
    </AdminLayoutClient>
  )
}
