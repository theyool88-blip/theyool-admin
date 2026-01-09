import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentTenantContext } from '@/lib/auth/tenant-context'
import ClientsList from '@/components/ClientsList'
import AdminHeader from '@/components/AdminHeader'

export default async function ClientsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // 사용자 프로필 확인
  const adminClient = createAdminClient()
  const { data: profile } = await adminClient
    .from('users_profiles')
    .select('*')
    .eq('auth_user_id', user.id)
    .single()

  if (!profile) {
    redirect('/login')
  }

  // 테넌트 컨텍스트 조회
  const tenantContext = await getCurrentTenantContext()
  if (!tenantContext) {
    redirect('/login')
  }

  // 의뢰인 데이터 가져오기 (테넌트 필터 적용)
  let clientsQuery = adminClient
    .from('clients')
    .select('*')

  if (!tenantContext.isSuperAdmin && tenantContext.tenantId) {
    clientsQuery = clientsQuery.eq('tenant_id', tenantContext.tenantId)
  }

  const { data: clientsData } = await clientsQuery.order('created_at', { ascending: false })

  // 모든 사건 데이터를 한 번에 가져오기 (테넌트 필터 적용)
  let casesQuery = adminClient
    .from('legal_cases')
    .select('id, case_name, client_id, retainer_fee, calculated_success_fee, total_received, created_at')

  if (!tenantContext.isSuperAdmin && tenantContext.tenantId) {
    casesQuery = casesQuery.eq('tenant_id', tenantContext.tenantId)
  }

  const { data: allCases } = await casesQuery.order('created_at', { ascending: false })

  type ClientCaseSummary = {
    id: string
    case_name: string
    client_id: string
    retainer_fee: number | null
    calculated_success_fee: number | null
    total_received: number | null
    created_at: string
  }

  // 의뢰인별로 사건 데이터 그룹핑
  const casesByClient = new Map<string, ClientCaseSummary[]>()
  allCases?.forEach((c) => {
    if (!casesByClient.has(c.client_id)) {
      casesByClient.set(c.client_id, [])
    }
    casesByClient.get(c.client_id)?.push(c as ClientCaseSummary)
  })

  // 각 의뢰인에 대해 최상단 사건과 미수금 계산
  const clientsWithCalculations = (clientsData || []).map(client => {
    const clientCases = casesByClient.get(client.id) || []
    const latestCase = clientCases.length > 0 ? {
      id: clientCases[0].id,
      case_name: clientCases[0].case_name
    } : null
    const totalOutstanding = clientCases.reduce((sum: number, c: ClientCaseSummary) => {
      const retainer = c.retainer_fee || 0
      const successFee = c.calculated_success_fee || 0
      const received = c.total_received || 0
      return sum + (retainer + successFee - received)
    }, 0)

    // Return plain object without spreading to avoid any circular references
    return {
      id: client.id,
      name: client.name,
      phone: client.phone,
      email: client.email,
      address: client.address,
      birth_date: client.birth_date,
      gender: client.gender,
      notes: client.notes,
      created_at: client.created_at,
      total_outstanding: totalOutstanding,
      latest_case: latestCase
    }
  })

  return (
    <>
      <AdminHeader title="의뢰인 관리" subtitle="법무법인 더율 어드민" />
      <ClientsList profile={profile} initialClients={clientsWithCalculations} />
    </>
  )
}
