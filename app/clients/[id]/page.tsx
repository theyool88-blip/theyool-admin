import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentTenantContext } from '@/lib/auth/tenant-context'
import ClientDetail from '@/components/ClientDetail'
import AdminLayoutClient from '@/components/AdminLayoutClient'

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  // 테넌트 컨텍스트 조회 (impersonation 포함)
  const tenantContext = await getCurrentTenantContext()
  if (!tenantContext) {
    redirect('/login')
  }

  const adminClient = createAdminClient()

  // 의뢰인 상세 정보 가져오기 (테넌트 필터 적용)
  let clientQuery = adminClient
    .from('clients')
    .select('*')
    .eq('id', id)

  if (!tenantContext.isSuperAdmin && tenantContext.tenantId) {
    clientQuery = clientQuery.eq('tenant_id', tenantContext.tenantId)
  }

  const { data: clientData, error: clientError } = await clientQuery.single()

  if (!clientData) {
    console.error('Client not found:', id, clientError)
    redirect('/clients')
  }

  // 의뢰인의 사건 목록 가져오기 (재무 정보 포함) - 테넌트 필터 적용
  // NOTE: legal_cases.client_id 컬럼이 case_clients 테이블로 이동됨
  let caseClientsQuery = adminClient
    .from('case_clients')
    .select(`
      retainer_fee,
      legal_cases!inner (
        id,
        contract_number,
        case_name,
        status,
        contract_date,
        case_type,
        created_at
      )
    `)
    .eq('client_id', id)

  if (!tenantContext.isSuperAdmin && tenantContext.tenantId) {
    caseClientsQuery = caseClientsQuery.eq('tenant_id', tenantContext.tenantId)
  }

  const { data: caseClientsData } = await caseClientsQuery

  // case_clients 데이터를 기존 형식으로 변환
  // NOTE: calculated_success_fee, total_received 컬럼이 legal_cases에 존재하지 않음
  const cases = (caseClientsData || [])
    .map((cc: any) => ({
      id: cc.legal_cases.id,
      contract_number: cc.legal_cases.contract_number,
      case_name: cc.legal_cases.case_name,
      status: cc.legal_cases.status,
      contract_date: cc.legal_cases.contract_date,
      case_type: cc.legal_cases.case_type,
      retainer_fee: cc.retainer_fee,
      created_at: cc.legal_cases.created_at
    }))
    .sort((a: any, b: any) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )

  const clientWithCases = {
    ...clientData,
    cases: cases || []
  }

  return (
    <AdminLayoutClient>
      <ClientDetail clientData={clientWithCases} />
    </AdminLayoutClient>
  )
}
