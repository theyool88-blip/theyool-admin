import { redirect } from 'next/navigation'
import { getCurrentTenantContext } from '@/lib/auth/tenant-context'
import BigCalendar from '@/components/calendar/BigCalendar'
import AdminLayoutClient from '@/components/AdminLayoutClient'
import type { Profile } from '@/components/calendar/types'

export const metadata = {
  title: '일정 관리 | Luseed',
  description: '법무법인 일정 캘린더',
}

export default async function SchedulesPage() {
  // 테넌트 컨텍스트 조회 (impersonation 포함)
  const tenantContext = await getCurrentTenantContext()
  if (!tenantContext) {
    redirect('/login')
  }

  // BigCalendar에 전달할 profile 형식으로 변환
  const profile: Profile = {
    id: tenantContext.memberId,
    tenant_id: tenantContext.tenantId,
    role: tenantContext.memberRole,
    display_name: tenantContext.memberDisplayName || tenantContext.tenantName,
  }

  return (
    <AdminLayoutClient fullHeight>
      <BigCalendar profile={profile} />
    </AdminLayoutClient>
  )
}
