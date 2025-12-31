import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { withTenant } from '@/lib/api/with-tenant'

/**
 * GET /api/admin/calendar
 * 통합 캘린더 조회 (테넌트 격리)
 */
export const GET = withTenant(async (request, { tenant }) => {
  try {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

    const supabase = createAdminClient()

    // 통합 캘린더 조회 (정렬 순서: 날짜 → 시간 우선순위 → 시간)
    let query = supabase
      .from('unified_calendar')
      .select('*')
      .order('event_date', { ascending: true })
      .order('sort_priority', { ascending: true })
      .order('event_time', { ascending: true })

    // 테넌트 격리 필터
    if (!tenant.isSuperAdmin && tenant.tenantId) {
      query = query.eq('tenant_id', tenant.tenantId)
    }

    if (startDate) {
      query = query.gte('event_date', startDate)
    }

    if (endDate) {
      query = query.lte('event_date', endDate)
    }

    const { data, error } = await query

    if (error) {
      console.error('통합 캘린더 조회 실패:', error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: data || [],
      count: data?.length || 0
    })
  } catch (error) {
    console.error('통합 캘린더 조회 중 오류:', error)
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
})
