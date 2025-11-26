import { NextRequest, NextResponse } from 'next/server'
import { isAuthenticated } from '@/lib/auth/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  const authCheck = await isAuthenticated()
  if (!authCheck) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

    const supabase = createAdminClient()

    // 통합 캘린더 조회 (정렬 순서: 날짜 → 시간 우선순위 → 시간)
    // sort_priority: 1 (시간 없음, 00:00) → 2 (시간 있음)
    let query = supabase
      .from('unified_calendar')
      .select('*')
      .order('event_date', { ascending: true })
      .order('sort_priority', { ascending: true })
      .order('event_time', { ascending: true })

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
}
