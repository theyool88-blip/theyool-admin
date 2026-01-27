import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentTenantContext } from '@/lib/auth/tenant-context'
import Dashboard, { type Schedule } from '@/components/Dashboard'
import { HEARING_TYPE_LABELS, DEADLINE_TYPE_LABELS, HearingType, DeadlineType } from '@/types/court-hearing'

type UnifiedCalendarRow = {
  id: string
  title: string
  event_date: string
  event_time: string | null
  event_type: 'COURT_HEARING' | 'CONSULTATION' | 'DEADLINE' | string
  location: string | null
  reference_id: string | null
  tenant_id: string | null
}

export default async function Home() {
  // 테넌트 컨텍스트 조회 (impersonation 포함)
  const tenantContext = await getCurrentTenantContext()
  if (!tenantContext) {
    redirect('/login')
  }

  const adminClient = createAdminClient()

  // 프로필 생성 (impersonation이면 tenantContext에서 생성)
  const profile = {
    id: tenantContext.memberId || 'impersonation',
    name: tenantContext.memberDisplayName || tenantContext.tenantName,
    email: '',
    role: tenantContext.memberRole,
    is_active: true
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

  let calendarQuery = adminClient
    .from('unified_calendar')
    .select('*')
    .gte('event_date', weekStart.toISOString().split('T')[0])
    .lte('event_date', weekEnd.toISOString().split('T')[0])

  // 슈퍼 어드민이 아니면 테넌트 필터 적용
  if (!tenantContext.isSuperAdmin && tenantContext.tenantId) {
    calendarQuery = calendarQuery.eq('tenant_id', tenantContext.tenantId)
  }

  const { data: calendarData } = await calendarQuery
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
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <Dashboard profile={profile} initialSchedules={schedules} />
    </div>
  )
}
