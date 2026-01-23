import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentTenantContext } from '@/lib/auth/tenant-context'
import ClientsList from '@/components/ClientsList'
import AdminLayoutClient from '@/components/AdminLayoutClient'

export default async function ClientsPage() {
  // 테넌트 컨텍스트 조회 (impersonation 포함)
  const tenantContext = await getCurrentTenantContext()
  if (!tenantContext) {
    redirect('/login')
  }

  const adminClient = createAdminClient()

  // 의뢰인 데이터 가져오기 (테넌트 필터 적용)
  let clientsQuery = adminClient
    .from('clients')
    .select('*')

  if (!tenantContext.isSuperAdmin && tenantContext.tenantId) {
    clientsQuery = clientsQuery.eq('tenant_id', tenantContext.tenantId)
  }

  const { data: clientsData } = await clientsQuery.order('created_at', { ascending: false })

  // case_clients를 통해 의뢰인별 사건 데이터 가져오기
  // NOTE: legal_cases.client_id 컬럼이 case_clients 테이블로 이동됨
  let caseClientsQuery = adminClient
    .from('case_clients')
    .select(`
      client_id,
      retainer_fee,
      legal_cases!inner (
        id,
        case_name,
        created_at
      )
    `)

  if (!tenantContext.isSuperAdmin && tenantContext.tenantId) {
    caseClientsQuery = caseClientsQuery.eq('tenant_id', tenantContext.tenantId)
  }

  const { data: caseClientsData } = await caseClientsQuery

  type ClientCaseSummary = {
    id: string
    case_name: string
    retainer_fee: number | null
    created_at: string
  }

  // 의뢰인별로 사건 데이터 그룹핑
  const casesByClient = new Map<string, ClientCaseSummary[]>()
  caseClientsData?.forEach((cc: any) => {
    const clientId = cc.client_id
    const caseInfo = cc.legal_cases
    if (clientId && caseInfo) {
      if (!casesByClient.has(clientId)) {
        casesByClient.set(clientId, [])
      }
      casesByClient.get(clientId)?.push({
        id: caseInfo.id,
        case_name: caseInfo.case_name,
        retainer_fee: cc.retainer_fee,
        created_at: caseInfo.created_at
      })
    }
  })

  // 각 의뢰인에 대해 최상단 사건과 총 수임료 계산
  // NOTE: calculated_success_fee, total_received 컬럼이 legal_cases에 존재하지 않음
  // 미수금은 payments 테이블과 조인하여 실시간 계산 필요 (향후 개선)
  const clientsWithCalculations = (clientsData || []).map(client => {
    const clientCases = casesByClient.get(client.id) || []
    // 최신 사건 (created_at 기준 정렬)
    const sortedCases = [...clientCases].sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
    const latestCase = sortedCases.length > 0 ? {
      id: sortedCases[0].id,
      case_name: sortedCases[0].case_name
    } : null
    // 총 수임료 (retainer_fee 합계)
    const totalOutstanding = clientCases.reduce((sum: number, c: ClientCaseSummary) => {
      const retainer = c.retainer_fee || 0
      return sum + retainer
    }, 0)

    // Return plain object without spreading to avoid any circular references
    return {
      id: client.id,
      name: client.name,
      phone: client.phone,
      email: client.email,
      address: client.address,
      birth_date: client.birth_date,
      notes: client.notes,
      created_at: client.created_at,
      total_outstanding: totalOutstanding,
      client_type: client.client_type || 'individual',
      company_name: client.company_name,
      latest_case: latestCase
    }
  })

  // ClientsList에 전달할 profile 형식으로 변환
  const profile = {
    id: tenantContext.memberId,
    tenant_id: tenantContext.tenantId,
    role: tenantContext.memberRole,
    display_name: tenantContext.memberDisplayName || tenantContext.tenantName,
  }

  return (
    <AdminLayoutClient>
      <ClientsList profile={profile as any} initialClients={clientsWithCalculations} />
    </AdminLayoutClient>
  )
}
