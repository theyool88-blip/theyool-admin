import { NextResponse } from 'next/server'
import { getPartnerDebtStatus } from '@/lib/supabase/expenses'

export async function GET() {
  try {
    const result = await getPartnerDebtStatus()

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to fetch debt status' },
        { status: 500 }
      )
    }

    return NextResponse.json(result.data)
  } catch (error) {
    console.error('Error fetching debt status:', error)
    return NextResponse.json(
      { error: 'Failed to fetch debt status' },
      { status: 500 }
    )
  }
}
