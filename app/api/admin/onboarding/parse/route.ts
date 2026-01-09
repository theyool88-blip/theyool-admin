/**
 * POST /api/admin/onboarding/parse
 * 파일 파싱 API
 */

import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/lib/api/with-tenant'
import { parseCSVContent, parseExcelBuffer, detectFileFormat, attemptAutoMapping, isStandardFormat } from '@/lib/onboarding/file-parser'
import { parseCasenoteCSV } from '@/lib/scourt/csv-parser'

export const POST = withTenant(async (request: NextRequest) => {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const csvContent = formData.get('csvContent') as string | null

    let columns: string[] = []
    let rows: Record<string, string>[] = []
    let fileType: 'csv' | 'xlsx' | 'casenote' = 'csv'
    let format: 'casenote' | 'standard' | 'unknown' = 'unknown'

    if (file) {
      const filename = file.name
      const isExcel = /\.(xlsx?|xls)$/i.test(filename)

      if (isExcel) {
        // Excel 파일 처리
        const buffer = await file.arrayBuffer()
        const result = parseExcelBuffer(buffer)
        columns = result.columns
        rows = result.rows
        fileType = 'xlsx'

        // 형식 감지
        const sampleContent = rows.slice(0, 3).map(r => Object.values(r).join(',')).join('\n')
        format = detectFileFormat(sampleContent, filename)
      } else {
        // CSV 파일 처리
        const content = await file.text()
        format = detectFileFormat(content, filename)

        if (format === 'casenote') {
          // 케이스노트 형식
          const casenoteResults = parseCasenoteCSV(content)
          columns = ['court_case_number', 'court_name', 'client_name', 'case_name', 'client_role', 'opponent_name']
          rows = casenoteResults
            .filter(r => !r.parseError)
            .map(r => ({
              court_case_number: r.caseNumber,
              court_name: r.courtFullName,
              client_name: r.clientName,
              case_name: r.caseName,
              client_role: r.clientRole || '',
              opponent_name: r.opponentName
            }))
          fileType = 'casenote'
        } else {
          // 일반 CSV
          const result = parseCSVContent(content)
          columns = result.columns
          rows = result.rows
          fileType = 'csv'
        }
      }
    } else if (csvContent) {
      // 직접 입력된 CSV 내용
      format = detectFileFormat(csvContent, 'input.csv')

      if (format === 'casenote') {
        const casenoteResults = parseCasenoteCSV(csvContent)
        columns = ['court_case_number', 'court_name', 'client_name', 'case_name', 'client_role', 'opponent_name']
        rows = casenoteResults
          .filter(r => !r.parseError)
          .map(r => ({
            court_case_number: r.caseNumber,
            court_name: r.courtFullName,
            client_name: r.clientName,
            case_name: r.caseName,
            client_role: r.clientRole || '',
            opponent_name: r.opponentName
          }))
        fileType = 'casenote'
      } else {
        const result = parseCSVContent(csvContent)
        columns = result.columns
        rows = result.rows
        fileType = 'csv'
      }
    } else {
      return NextResponse.json(
        { error: '파일 또는 CSV 내용이 필요합니다' },
        { status: 400 }
      )
    }

    // 자동 컬럼 매핑 시도
    const autoMapping = attemptAutoMapping(columns)
    const isStandard = isStandardFormat(columns)

    // AI 매핑 필요 여부
    const needsAIMapping = !isStandard && format !== 'casenote'

    return NextResponse.json({
      success: true,
      data: {
        columns,
        rows,
        fileType,
        format,
        rowCount: rows.length,
        isStandard,
        needsAIMapping,
        autoMapping: Object.fromEntries(autoMapping)
      }
    })
  } catch (error) {
    console.error('[Onboarding Parse] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '파일 파싱 실패' },
      { status: 500 }
    )
  }
})
