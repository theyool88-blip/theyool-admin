import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

/**
 * Cron Job: 매월 1일 자동 고정 지출 생성
 *
 * Vercel Cron 설정:
 * - Schedule: "0 0 1 * *" (매월 1일 00:00 UTC)
 * - 또는 수동 트리거: GET /api/cron/generate-monthly-expenses
 */
export async function GET(request: NextRequest) {
  try {
    // Vercel Cron Secret 검증 (프로덕션에서만)
    const authHeader = request.headers.get('authorization')
    if (process.env.NODE_ENV === 'production' && process.env.CRON_SECRET) {
      if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    const supabase = createAdminClient()
    const now = new Date()
    const monthKey = now.toISOString().slice(0, 7) // "YYYY-MM"

    // 1. 활성화된 템플릿 조회
    const { data: templates, error: templatesError } = await supabase
      .from('recurring_templates')
      .select('*')
      .eq('is_active', true)
      .lte('start_date', now.toISOString().split('T')[0])
      .or(`end_date.is.null,end_date.gte.${now.toISOString().split('T')[0]}`)

    if (templatesError) {
      console.error('Templates fetch error:', templatesError)
      return NextResponse.json(
        { error: 'Failed to fetch templates', details: templatesError },
        { status: 500 }
      )
    }

    if (!templates || templates.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No active templates found',
        count: 0
      })
    }

    // 2. 이미 생성된 지출이 있는지 확인
    const { data: existingExpenses } = await supabase
      .from('expenses')
      .select('recurring_template_id')
      .eq('month_key', monthKey)
      .not('recurring_template_id', 'is', null)

    const existingTemplateIds = new Set(
      existingExpenses?.map(e => e.recurring_template_id) || []
    )

    // 3. 아직 생성되지 않은 템플릿만 필터링
    const templatesToCreate = templates.filter(
      t => !existingTemplateIds.has(t.id)
    )

    if (templatesToCreate.length === 0) {
      return NextResponse.json({
        success: true,
        message: `All recurring expenses for ${monthKey} already exist`,
        count: 0,
        skipped: templates.length
      })
    }

    // 4. 지출 데이터 생성
    const expensesToInsert = templatesToCreate.map(template => {
      const dayOfMonth = Math.min(template.day_of_month, new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate())
      const expenseDate = `${monthKey}-${String(dayOfMonth).padStart(2, '0')}`

      return {
        expense_date: expenseDate,
        amount: template.amount,
        expense_category: template.expense_category,
        subcategory: template.subcategory,
        office_location: template.office_location,
        vendor_name: template.vendor_name,
        month_key: monthKey,
        memo: template.memo || `[자동생성] ${template.name}`,
        payment_method: '자동이체',
        is_recurring: true,
        recurring_template_id: template.id
      }
    })

    // 5. 지출 삽입
    const { data: insertedExpenses, error: insertError } = await supabase
      .from('expenses')
      .insert(expensesToInsert)
      .select()

    if (insertError) {
      console.error('Insert error:', insertError)
      return NextResponse.json(
        { error: 'Failed to insert expenses', details: insertError },
        { status: 500 }
      )
    }

    console.log(`✅ Cron: Generated ${insertedExpenses?.length || 0} recurring expenses for ${monthKey}`)

    return NextResponse.json({
      success: true,
      message: `Successfully generated recurring expenses for ${monthKey}`,
      count: insertedExpenses?.length || 0,
      month: monthKey,
      expenses: insertedExpenses
    })
  } catch (error) {
    console.error('Cron job error:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}
