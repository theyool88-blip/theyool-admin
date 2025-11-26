import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Dashboard, { type Schedule } from '@/components/Dashboard'
import AdminHeader from '@/components/AdminHeader'
import { HEARING_TYPE_LABELS, DEADLINE_TYPE_LABELS, HearingType, DeadlineType } from '@/types/court-hearing'

type UnifiedCalendarRow = {
  id: string
  title: string
  event_date: string
  event_time: string | null
  event_type: 'COURT_HEARING' | 'CONSULTATION' | 'DEADLINE' | string
  location: string | null
  reference_id: string | null
}

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

  // 이번 주 일정 가져오기 (통합 캘린더 사용)
  const today = new Date()
  const dayOfWeek = today.getDay() // 0=일요일, 1=월요일, ..., 6=토요일
  const weekStart = new Date(today)

  // 이번 주 월요일 계산
  if (dayOfWeek === 0) {
    // 일요일이면 6일 전이 월요일
    weekStart.setDate(today.getDate() - 6)
  } else {
    // 월~토요일이면 해당 요일-1만큼 빼면 월요일
    weekStart.setDate(today.getDate() - (dayOfWeek - 1))
  }

  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6) // 일요일

  const { data: calendarData } = await adminClient
    .from('unified_calendar')
    .select('*')
    .gte('event_date', weekStart.toISOString().split('T')[0])
    .lte('event_date', weekEnd.toISOString().split('T')[0])
    .order('event_date', { ascending: true })
    .order('event_time', { ascending: true })

  // unified_calendar 데이터를 기존 Schedule 형식으로 변환
  const schedules: Schedule[] = (calendarData || []).map((event: UnifiedCalendarRow) => {
    let title = event.title

    // 타입별 제목 변환
    if (event.event_type === 'COURT_HEARING') {
      title = HEARING_TYPE_LABELS[event.title as HearingType] || event.title
    } else if (event.event_type === 'DEADLINE') {
      title = DEADLINE_TYPE_LABELS[event.title as DeadlineType] || event.title
    }
    // CONSULTATION은 이미 "이름 상담" 형태로 저장됨

    return {
      id: event.id,
      title,
      scheduled_date: event.event_date,
      scheduled_time: event.event_time === '00:00' ? null : event.event_time,
      schedule_type: event.event_type === 'COURT_HEARING' ? 'trial' :
                     event.event_type === 'CONSULTATION' ? 'consultation' : 'meeting',
      location: event.location,
      case_id: event.reference_id
    }
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader title="대시보드" />
      <Dashboard profile={profile} initialSchedules={schedules} />
    </div>
  )
}
