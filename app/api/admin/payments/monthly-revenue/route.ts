import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { calculateMonthlyRevenue } from '@/lib/supabase/payments-aggregation'

/**
 * GET /api/admin/payments/monthly-revenue?month=YYYY-MM
 *
 * 특정 월의 입금 집계 데이터 조회
 */
export async function GET(request: NextRequest) {
  // Auth check
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = request.nextUrl
    const month = searchParams.get('month') || new Date().toISOString().slice(0, 7)

    // Validate month format (YYYY-MM)
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json(
        { error: 'Invalid month format. Use YYYY-MM' },
        { status: 400 }
      )
    }

    const data = await calculateMonthlyRevenue(month)

    if (!data) {
      return NextResponse.json(
        { error: 'Failed to calculate monthly revenue' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data,
      month,
    })
  } catch (error) {
    console.error('Monthly revenue API error:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
