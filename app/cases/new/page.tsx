import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentTenantContext } from '@/lib/auth/tenant-context'
import NewCaseForm from '@/components/NewCaseForm'

interface PageProps {
  searchParams: Promise<{
    caseNumber?: string
    courtName?: string
    clientId?: string
    partyName?: string  // 대법원 연동용 당사자명
  }>
}

export default async function NewCasePage({ searchParams }: PageProps) {
  const params = await searchParams
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

  // 의뢰인 목록 가져오기 (사건 등록 시 선택할 수 있도록) - 테넌트 필터 적용
  let clientsQuery = adminClient
    .from('clients')
    .select('id, name, phone, email')

  if (!tenantContext.isSuperAdmin && tenantContext.tenantId) {
    clientsQuery = clientsQuery.eq('tenant_id', tenantContext.tenantId)
  }

  const { data: clients } = await clientsQuery.order('created_at', { ascending: false })

  return (
    <NewCaseForm
      clients={clients || []}
      initialCaseNumber={params.caseNumber}
      initialCourtName={params.courtName}
      initialClientId={params.clientId}
      initialPartyName={params.partyName}
    />
  )
}
