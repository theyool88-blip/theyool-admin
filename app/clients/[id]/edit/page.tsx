import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentTenantContext } from '@/lib/auth/tenant-context'
import ClientEditForm from '@/components/ClientEditForm'

export default async function ClientEditPage({ params }: { params: Promise<{ id: string }> }) {
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

  // 의뢰인 정보 가져오기 (테넌트 필터 적용)
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

  return <ClientEditForm profile={profile} clientData={clientData} />
}
