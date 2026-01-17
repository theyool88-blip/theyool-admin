import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentTenantContext } from '@/lib/auth/tenant-context'
import ClientDetail from '@/components/ClientDetail'

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
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
    .from('tenant_members')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single()

  if (!profile) {
    redirect('/login')
  }

  // 테넌트 컨텍스트 조회
  const tenantContext = await getCurrentTenantContext()
  if (!tenantContext) {
    redirect('/login')
  }

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
  let casesQuery = adminClient
    .from('legal_cases')
    .select('id, contract_number, case_name, status, contract_date, case_type, retainer_fee, calculated_success_fee, total_received')
    .eq('client_id', id)

  if (!tenantContext.isSuperAdmin && tenantContext.tenantId) {
    casesQuery = casesQuery.eq('tenant_id', tenantContext.tenantId)
  }

  const { data: cases } = await casesQuery.order('created_at', { ascending: false })

  const clientWithCases = {
    ...clientData,
    cases: cases || []
  }

  return <ClientDetail clientData={clientWithCases} />
}
