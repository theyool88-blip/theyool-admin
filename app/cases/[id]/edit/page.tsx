import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentTenantContext } from '@/lib/auth/tenant-context'
import CaseEditForm from '@/components/CaseEditForm'

type RelatedCaseRecord = {
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

export default async function CaseEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  // 테넌트 컨텍스트 조회 (impersonation 포함)
  const tenantContext = await getCurrentTenantContext()
  if (!tenantContext) {
    redirect('/login')
  }

  const adminClient = createAdminClient()

  // 사건 상세 정보 가져오기 (테넌트 필터 적용)
  let caseQuery = adminClient
    .from('legal_cases')
    .select(`
      *,
      client:clients(*)
    `)
    .eq('id', id)

  if (!tenantContext.isSuperAdmin && tenantContext.tenantId) {
    caseQuery = caseQuery.eq('tenant_id', tenantContext.tenantId)
  }

  const { data: caseData } = await caseQuery.single()

  if (!caseData) {
    redirect('/cases')
  }

  // 모든 사건 목록 (관련 사건 연결용) - 테넌트 필터 적용
  let allCasesQuery = adminClient
    .from('legal_cases')
    .select('id, case_name, contract_number, status')
    .neq('id', id)

  if (!tenantContext.isSuperAdmin && tenantContext.tenantId) {
    allCasesQuery = allCasesQuery.eq('tenant_id', tenantContext.tenantId)
  }

  const { data: allCases } = await allCasesQuery.order('created_at', { ascending: false })

  // 현재 사건의 관련 사건
  const { data: relatedCasesData } = await adminClient
    .from('case_relations')
    .select(`
      id,
      related_case_id,
      relation_type,
      notes,
      related_case:legal_cases!case_relations_related_case_id_fkey(
        id,
        case_name,
        contract_number
      )
    `)
    .eq('case_id', id)

  // Transform join result: related_case is returned as array from Supabase
  const relatedCases: RelatedCaseRecord[] = (relatedCasesData ?? []).map(item => ({
    ...item,
    related_case: Array.isArray(item.related_case) ? item.related_case[0] : item.related_case
  }))

  // CaseEditForm에 전달할 profile 형식으로 변환
  const profile = {
    id: tenantContext.memberId,
    tenant_id: tenantContext.tenantId,
    role: tenantContext.memberRole,
    display_name: tenantContext.memberDisplayName || tenantContext.tenantName,
  }

  return <CaseEditForm profile={profile as any} caseData={caseData} allCases={allCases || []} relatedCases={relatedCases} />
}
