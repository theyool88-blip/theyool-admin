import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { withTenant } from '@/lib/api/with-tenant'

// 캘린더에서 실제로 사용하는 컬럼만 정의 (unified_calendar 뷰 기준)
const CALENDAR_COLUMNS = [
  'id',
  'event_type',
  'event_subtype',
  'title',
  'event_date',
  'event_time',
  'location',
  'case_id',
  'reference_id',
  'case_name',
  'description',
  'status',
  'attending_lawyer_id',
  'attending_lawyer_name',
  'video_participant_side',
  'our_client_name',
  'sort_priority',
].join(', ')

/**
 * GET /api/admin/calendar
 * 통합 캘린더 조회 (테넌트 격리)
 */
export const GET = withTenant(async (request, { tenant }) => {
  try {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

    if (!startDate || !endDate) {
      return NextResponse.json(
        { success: false, error: 'start_date and end_date are required' },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()

    // 필요한 컬럼만 선택 (SELECT * 대신)
    let query = supabase
      .from('unified_calendar')
      .select(CALENDAR_COLUMNS)
      .gte('event_date', startDate)
      .lte('event_date', endDate)
      .order('event_date', { ascending: true })
      .order('sort_priority', { ascending: true })
      .order('event_time', { ascending: true })

    // 테넌트 격리 필터
    if (!tenant.isSuperAdmin && tenant.tenantId) {
      query = query.eq('tenant_id', tenant.tenantId)
    }

    const { data, error } = await query

    if (error) {
      console.error('통합 캘린더 조회 실패:', error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    // 응답 헤더에 캐시 힌트 추가
    const response = NextResponse.json({
      success: true,
      data: data || [],
      count: data?.length || 0
    })

    // 브라우저 캐싱 (5분, stale-while-revalidate 1분)
    response.headers.set('Cache-Control', 'private, max-age=300, stale-while-revalidate=60')

    return response
  } catch (error) {
    console.error('통합 캘린더 조회 중 오류:', error)
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
})
