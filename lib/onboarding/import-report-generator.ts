/**
 * 가져오기 결과 보고서 생성기
 * CSV/Excel 형식으로 보고서 내보내기
 */

import * as XLSX from 'xlsx'
import type { ImportReport, ImportResult, ImportOptions } from '@/types/onboarding'

/**
 * 결과 요약 생성 (클라이언트/서버 공용)
 */
function summarizeResults(results: ImportResult[]): {
  total: number
  success: number
  failed: number
  partial: number
  skipped: number
  updated: number
  newClientsCreated: number
  existingClientsMatched: number
} {
  let success = 0
  let failed = 0
  let partial = 0
  let skipped = 0
  let updated = 0
  let newClientsCreated = 0
  let existingClientsMatched = 0

  for (const result of results) {
    switch (result.status) {
      case 'success':
        success++
        break
      case 'failed':
        failed++
        break
      case 'partial':
        partial++
        break
      case 'skipped':
        skipped++
        break
      case 'updated':
        updated++
        break
    }

    if (result.created?.clientId) {
      if (result.created.isNewClient) {
        newClientsCreated++
      } else {
        existingClientsMatched++
      }
    }
  }

  return {
    total: results.length,
    success,
    failed,
    partial,
    skipped,
    updated,
    newClientsCreated,
    existingClientsMatched
  }
}

/**
 * 가져오기 보고서 생성
 */
export function generateImportReport(
  results: ImportResult[],
  options: ImportOptions
): ImportReport {
  const summary = summarizeResults(results)

  // 부족한 정보 요약
  const missingInfoMap = new Map<string, number[]>()

  for (const result of results) {
    for (const warning of result.warnings) {
      if (warning.message.includes('없') || warning.message.includes('부족')) {
        const rows = missingInfoMap.get(warning.field) || []
        rows.push(result.rowIndex)
        missingInfoMap.set(warning.field, rows)
      }
    }
  }

  const missingInfoSummary = Array.from(missingInfoMap.entries()).map(([field, rows]) => ({
    field,
    count: rows.length,
    affectedRows: rows
  }))

  return {
    summary: {
      ...summary,
      scourtLinked: results.filter(r => r.scourtLinked).length,
      scourtFailed: results.filter(r =>
        options.linkScourt &&
        !r.scourtLinked &&
        (r.status === 'success' || r.status === 'partial')
      ).length
    },
    results,
    missingInfoSummary,
    createdAt: new Date().toISOString(),
    importOptions: options
  }
}

/**
 * 보고서를 CSV로 변환
 */
export function reportToCSV(report: ImportReport): string {
  const headers = [
    '행번호',
    '상태',
    '사건번호',
    '법원명',
    '의뢰인',
    '생성된사건ID',
    '오류',
    '경고'
  ]

  const rows = report.results.map(r => [
    r.rowIndex + 1,
    statusToKorean(r.status),
    r.originalData.court_case_number || '',
    r.originalData.court_name || '',
    r.originalData.client_name || '',
    r.created?.caseId || '',
    r.errors.map(e => e.message).join('; '),
    r.warnings.map(w => w.message).join('; ')
  ])

  // CSV 생성
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
  ].join('\n')

  // BOM 추가 (Excel에서 한글 인식용)
  return '\uFEFF' + csvContent
}

/**
 * 보고서를 Excel로 변환
 */
export function reportToExcel(report: ImportReport): ArrayBuffer {
  const workbook = XLSX.utils.book_new()

  // 1. 요약 시트
  const summaryData = [
    ['대량 사건 등록 보고서'],
    [''],
    ['생성일시', report.createdAt],
    [''],
    ['== 결과 요약 =='],
    ['전체', report.summary.total],
    ['성공', report.summary.success],
    ['부분 성공', report.summary.partial],
    ['실패', report.summary.failed],
    ['건너뜀', report.summary.skipped],
    ['업데이트', report.summary.updated],
    [''],
    ['== 의뢰인 =='],
    ['신규 생성', report.summary.newClientsCreated],
    ['기존 매칭', report.summary.existingClientsMatched],
    [''],
    ['== SCOURT =='],
    ['연동 성공', report.summary.scourtLinked],
    ['연동 실패', report.summary.scourtFailed],
    [''],
    ['== 옵션 =='],
    ['중복 처리', duplicateHandlingToKorean(report.importOptions.duplicateHandling)],
    ['신규 의뢰인 생성', report.importOptions.createNewClients ? '예' : '아니오'],
    ['SCOURT 연동', report.importOptions.linkScourt ? '예' : '아니오']
  ]

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData)
  XLSX.utils.book_append_sheet(workbook, summarySheet, '요약')

  // 2. 성공 목록 시트
  const successResults = report.results.filter(r =>
    r.status === 'success' || r.status === 'partial' || r.status === 'updated'
  )
  if (successResults.length > 0) {
    const successData = [
      ['행번호', '상태', '사건번호', '법원명', '의뢰인', '사건ID', '의뢰인ID', '신규의뢰인', '경고'],
      ...successResults.map(r => [
        r.rowIndex + 1,
        statusToKorean(r.status),
        r.originalData.court_case_number || '',
        r.originalData.court_name || '',
        r.originalData.client_name || '',
        r.created?.caseId || '',
        r.created?.clientId || '',
        r.created?.isNewClient ? '예' : '아니오',
        r.warnings.map(w => w.message).join('; ')
      ])
    ]
    const successSheet = XLSX.utils.aoa_to_sheet(successData)
    XLSX.utils.book_append_sheet(workbook, successSheet, '성공')
  }

  // 3. 실패 목록 시트
  const failedResults = report.results.filter(r => r.status === 'failed')
  if (failedResults.length > 0) {
    const failedData = [
      ['행번호', '사건번호', '법원명', '의뢰인', '오류코드', '오류메시지', '원본값'],
      ...failedResults.flatMap(r =>
        r.errors.length > 0
          ? r.errors.map(e => [
              r.rowIndex + 1,
              r.originalData.court_case_number || '',
              r.originalData.court_name || '',
              r.originalData.client_name || '',
              e.errorCode,
              e.message,
              e.originalValue || ''
            ])
          : [[
              r.rowIndex + 1,
              r.originalData.court_case_number || '',
              r.originalData.court_name || '',
              r.originalData.client_name || '',
              'UNKNOWN',
              '알 수 없는 오류',
              ''
            ]]
      )
    ]
    const failedSheet = XLSX.utils.aoa_to_sheet(failedData)
    XLSX.utils.book_append_sheet(workbook, failedSheet, '실패')
  }

  // 4. 건너뜀 목록 시트
  const skippedResults = report.results.filter(r => r.status === 'skipped')
  if (skippedResults.length > 0) {
    const skippedData = [
      ['행번호', '사건번호', '법원명', '의뢰인', '기존사건ID', '사유'],
      ...skippedResults.map(r => [
        r.rowIndex + 1,
        r.originalData.court_case_number || '',
        r.originalData.court_name || '',
        r.originalData.client_name || '',
        r.created?.caseId || '',
        r.warnings[0]?.message || '중복 사건'
      ])
    ]
    const skippedSheet = XLSX.utils.aoa_to_sheet(skippedData)
    XLSX.utils.book_append_sheet(workbook, skippedSheet, '건너뜀')
  }

  // 5. 부족정보 시트
  if (report.missingInfoSummary.length > 0) {
    const missingData = [
      ['필드', '건수', '해당 행번호'],
      ...report.missingInfoSummary.map(m => [
        fieldToKorean(m.field),
        m.count,
        m.affectedRows.map(r => r + 1).join(', ')
      ])
    ]
    const missingSheet = XLSX.utils.aoa_to_sheet(missingData)
    XLSX.utils.book_append_sheet(workbook, missingSheet, '부족정보')
  }

  // ArrayBuffer로 변환
  return XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })
}

/**
 * 상태 한글 변환
 */
function statusToKorean(status: ImportResult['status']): string {
  const map: Record<ImportResult['status'], string> = {
    success: '성공',
    failed: '실패',
    partial: '부분성공',
    skipped: '건너뜀',
    updated: '업데이트'
  }
  return map[status] || status
}

/**
 * 중복 처리 옵션 한글 변환
 */
function duplicateHandlingToKorean(handling: ImportOptions['duplicateHandling']): string {
  const map: Record<ImportOptions['duplicateHandling'], string> = {
    skip: '건너뛰기',
    update: '업데이트',
    error: '오류표시'
  }
  return map[handling] || handling
}

/**
 * 필드명 한글 변환
 */
function fieldToKorean(field: string): string {
  const map: Record<string, string> = {
    court_case_number: '사건번호',
    court_name: '법원명',
    client_name: '의뢰인명',
    case_name: '사건명',
    case_type: '사건유형',
    client_role: '의뢰인역할',
    opponent_name: '상대방명',
    assigned_lawyer: '담당변호사',
    assigned_staff: '담당직원',
    contract_date: '계약일',
    retainer_fee: '착수금',
    success_fee_agreement: '성공보수약정',
    notes: '메모',
    client_phone: '의뢰인연락처',
    client_email: '의뢰인이메일'
  }
  return map[field] || field
}

/**
 * 보고서 파일명 생성
 */
export function generateReportFilename(format: 'csv' | 'xlsx'): string {
  const now = new Date()
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '')
  const timeStr = now.toTimeString().slice(0, 5).replace(':', '')
  return `사건등록_보고서_${dateStr}_${timeStr}.${format}`
}

/**
 * 보고서 다운로드 (클라이언트용)
 */
export function downloadReport(report: ImportReport, format: 'csv' | 'xlsx'): void {
  const filename = generateReportFilename(format)

  if (format === 'csv') {
    const csvContent = reportToCSV(report)
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' })
    downloadBlob(blob, filename)
  } else {
    const excelBuffer = reportToExcel(report)
    const blob = new Blob([excelBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    })
    downloadBlob(blob, filename)
  }
}

/**
 * Blob 다운로드 헬퍼
 */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
