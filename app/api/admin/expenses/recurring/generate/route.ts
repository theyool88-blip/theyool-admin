import { NextRequest, NextResponse } from 'next/server'
import { generateRecurringExpenses } from '@/lib/supabase/expenses'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { monthKey } = body

    if (!monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) {
      return NextResponse.json(
        { error: 'Invalid month format. Use YYYY-MM' },
        { status: 400 }
      )
    }

    const expenses = await generateRecurringExpenses(monthKey)

    return NextResponse.json({
      success: true,
      count: expenses.length,
      expenses: expenses
    })
  } catch (error) {
    console.error('Error generating recurring expenses:', error)
    return NextResponse.json(
      { error: 'Failed to generate recurring expenses' },
      { status: 500 }
    )
  }
}
