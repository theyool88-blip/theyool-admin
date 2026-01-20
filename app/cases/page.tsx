import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentTenantContext } from '@/lib/auth/tenant-context'
import CasesList from '@/components/CasesList'

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
      client:clients(id, name)
    `)

  // 슈퍼 어드민이 아니면 테넌트 필터 적용
  if (!tenantContext.isSuperAdmin && tenantContext.tenantId) {
    query = query.eq('tenant_id', tenantContext.tenantId)
  }

  const { data: casesData } = await query.order('created_at', { ascending: false })

  return <CasesList initialCases={casesData || []} />
}
