import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import MonthlyCalendar from '@/components/MonthlyCalendar'
import AdminHeader from '@/components/AdminHeader'

export default async function SchedulesPage() {
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

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader title="일정 관리" />
      <MonthlyCalendar profile={profile} />
    </div>
  )
}
