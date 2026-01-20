import { redirect } from 'next/navigation'
import { getCurrentTenantContext } from '@/lib/auth/tenant-context'
import MonthlyCalendar from '@/components/MonthlyCalendar'
import AdminHeader from '@/components/AdminHeader'

export default async function SchedulesPage() {
  // 테넌트 컨텍스트 조회 (impersonation 포함)
  const tenantContext = await getCurrentTenantContext()
  if (!tenantContext) {
    redirect('/login')
  }

  // MonthlyCalendar에 전달할 profile 형식으로 변환
  const profile = {
    id: tenantContext.memberId,
    tenant_id: tenantContext.tenantId,
    role: tenantContext.memberRole,
    display_name: tenantContext.memberDisplayName || tenantContext.tenantName,
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader title="일정 관리" />
      <MonthlyCalendar profile={profile as any} />
    </div>
  )
}
