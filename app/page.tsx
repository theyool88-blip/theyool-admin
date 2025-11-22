import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Dashboard from '@/components/Dashboard'

export default async function Home() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // 사용자 프로필 가져오기 (Service Role 사용)
  const adminClient = createAdminClient()
  const { data: profile } = await adminClient
    .from('users_profiles')
    .select('*')
    .eq('auth_user_id', user.id)
    .single()

  if (!profile) {
    redirect('/login')
  }

  // 이번 주 일정 가져오기
  const today = new Date()
  const weekStart = new Date(today)
  weekStart.setDate(today.getDate() - today.getDay() + 1) // 월요일
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6) // 일요일

  const { data: schedules } = await adminClient
    .from('case_schedules')
    .select('*')
    .gte('scheduled_date', weekStart.toISOString().split('T')[0])
    .lte('scheduled_date', weekEnd.toISOString().split('T')[0])
    .eq('status', 'scheduled')
    .order('scheduled_time', { ascending: true })

  return <Dashboard profile={profile} initialSchedules={schedules || []} />
}
