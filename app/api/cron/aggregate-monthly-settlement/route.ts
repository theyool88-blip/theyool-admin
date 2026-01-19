import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * Cron Job: 매월 말일 자동 정산 집계
 *
 * Vercel Cron 설정:
 * - Schedule: "0 0 1 * *" (매월 1일 00:00 UTC - 전월 정산)
 * - 또는 수동 트리거: GET /api/cron/aggregate-monthly-settlement
 */
export async function GET(request: NextRequest) {
  // NOTE: monthly_settlements와 partner_withdrawals 테이블이 스키마에서 제거됨
  // SaaS 전환으로 더율 특화 기능 제거 - 이 크론은 더 이상 필요 없음
  // 정산 기능이 필요하면 테넌트별 설정으로 재구현 필요

  // Vercel Cron Secret 검증 (프로덕션에서만)
  const authHeader = request.headers.get('authorization')
  if (process.env.NODE_ENV === 'production' && process.env.CRON_SECRET) {
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  console.log('⚠️ aggregate-monthly-settlement cron is disabled (tables removed from schema)')

  return NextResponse.json({
    success: true,
    message: '월간 정산 크론이 비활성화되었습니다. monthly_settlements/partner_withdrawals 테이블이 스키마에서 제거되었습니다.',
    disabled: true
  })
}
