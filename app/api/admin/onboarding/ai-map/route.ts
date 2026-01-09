/**
 * POST /api/admin/onboarding/ai-map
 * AI 컬럼 매핑 API
 */

import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/lib/api/with-tenant'
import {
  analyzeColumnMapping,
  calculateOverallConfidence,
  hasRequiredFieldsMapped
} from '@/lib/onboarding/ai-column-mapper'
import { isAIAvailable } from '@/lib/ai/simple-ai-client'

export const POST = withTenant(async (request: NextRequest) => {
  try {
    const body = await request.json() as {
      columns: string[]
      sampleRows: Record<string, string>[]
    }

    const { columns, sampleRows } = body

    if (!columns || columns.length === 0) {
      return NextResponse.json(
        { error: '컬럼 정보가 필요합니다' },
        { status: 400 }
      )
    }

    if (!sampleRows || sampleRows.length === 0) {
      return NextResponse.json(
        { error: '샘플 데이터가 필요합니다' },
        { status: 400 }
      )
    }

    // AI 매핑 분석
    const mappingResult = await analyzeColumnMapping(columns, sampleRows)

    // 매핑 품질 평가
    const overallConfidence = calculateOverallConfidence(mappingResult)
    const hasRequired = hasRequiredFieldsMapped(mappingResult)

    return NextResponse.json({
      success: true,
      data: {
        mappings: mappingResult.mappings,
        unmappedColumns: mappingResult.unmappedColumns,
        suggestions: mappingResult.suggestions,
        overallConfidence,
        hasRequiredFields: hasRequired,
        aiUsed: isAIAvailable()
      }
    })
  } catch (error) {
    console.error('[Onboarding AI Map] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'AI 매핑 실패' },
      { status: 500 }
    )
  }
})
