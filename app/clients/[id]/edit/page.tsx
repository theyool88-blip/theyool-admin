import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentTenantContext } from '@/lib/auth/tenant-context'
import ClientEditForm from '@/components/ClientEditForm'
import AdminLayoutClient from '@/components/AdminLayoutClient'

export default async function ClientEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  // 테넌트 컨텍스트 조회 (impersonation 포함)
  const tenantContext = await getCurrentTenantContext()
  if (!tenantContext) {
    redirect('/login')
  }

  const adminClient = createAdminClient()

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

  // ClientEditForm에 전달할 profile 형식으로 변환
  const profile = {
    id: tenantContext.memberId,
    name: tenantContext.memberDisplayName || tenantContext.tenantName || '',
    email: '', // Not available in tenantContext
    role: tenantContext.memberRole,
  }

  return (
    <AdminLayoutClient>
      <ClientEditForm profile={profile} clientData={clientData} />
    </AdminLayoutClient>
  )
}
