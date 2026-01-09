/**
 * POST /api/admin/onboarding/preview
 * 가져오기 미리보기 API
 */

import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/lib/api/with-tenant'
import type { StandardCaseRow } from '@/types/onboarding'
import { generatePreview } from '@/lib/onboarding/batch-case-creator'
import { convertToStandardRow, applyDefaults, validateRow } from '@/lib/onboarding/csv-schema'

export const POST = withTenant(async (request: NextRequest, { tenant }) => {
  try {
    const body = await request.json() as {
      rows: Record<string, string>[]
      columnMapping?: Record<string, string>
    }

    const { rows, columnMapping } = body

    if (!rows || rows.length === 0) {
      return NextResponse.json(
        { error: '데이터가 필요합니다' },
        { status: 400 }
      )
    }

    // 컬럼 매핑 적용하여 표준 형식으로 변환
    const mapping = columnMapping ? new Map(Object.entries(columnMapping)) : undefined
    const standardRows: Partial<StandardCaseRow>[] = rows.map(row =>
      convertToStandardRow(row, mapping as Map<string, keyof StandardCaseRow> | undefined)
    )

    // 미리보기 생성
    const preview = await generatePreview(standardRows, {
      tenantId: tenant.tenantId!,
      isSuperAdmin: tenant.isSuperAdmin
    })

    return NextResponse.json({
      success: true,
      data: preview
    })
  } catch (error) {
    console.error('[Onboarding Preview] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '미리보기 생성 실패' },
      { status: 500 }
    )
  }
})
