/**
 * 파일 파서 (CSV/Excel)
 * CSV, Excel 파일을 파싱하고 형식을 자동 감지
 */

import * as XLSX from 'xlsx'
import type { ParsedFile, FileFormat, StandardCaseRow } from '@/types/onboarding'
import { parseCasenoteCSV, type ParsedCaseFromCSV } from '@/lib/scourt/csv-parser'
import { normalizeColumnName, convertToStandardRow } from './csv-schema'

/**
 * 파일 형식 감지
 */
export function detectFileFormat(content: string, filename: string): FileFormat {
  const lower = content.toLowerCase()

  // 케이스노트 형식 감지
  if (
    content.includes('소송리스트') ||
    content.includes('사건명/사건번호') ||
    content.includes('의뢰인/상대방')
  ) {
    return 'casenote'
  }

  // 표준 형식 감지 (영문 또는 한글 헤더)
  const standardHeaders = [
    'court_case_number', '사건번호',
    'court_name', '법원명', '법원',
    'client_name', '의뢰인명', '의뢰인'
  ]

  for (const header of standardHeaders) {
    if (lower.includes(header.toLowerCase())) {
      return 'standard'
    }
  }

  // 그 외는 비표준 (AI 매핑 필요)
  return 'unknown'
}

/**
 * CSV 파싱 (범용)
 */
export function parseCSVContent(content: string): { columns: string[]; rows: Record<string, string>[] } {
  const lines = content.split(/\r?\n/).filter(line => line.trim())
  if (lines.length === 0) {
    return { columns: [], rows: [] }
  }

  // 첫 줄을 헤더로
  const columns = parseCSVLine(lines[0])
  const rows: Record<string, string>[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i])
    if (values.length === 0 || values.every(v => !v.trim())) continue

    const row: Record<string, string> = {}
    columns.forEach((col, idx) => {
      row[col] = values[idx] || ''
    })
    rows.push(row)
  }

  return { columns, rows }
}

/**
 * CSV 라인 파싱 (따옴표 처리)
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // 이스케이프된 따옴표
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  result.push(current.trim())

  return result
}

/**
 * Excel 파일 파싱
 */
export function parseExcelBuffer(buffer: ArrayBuffer): { columns: string[]; rows: Record<string, string>[] } {
  const workbook = XLSX.read(buffer, { type: 'array' })

  // 첫 번째 시트 사용
  const sheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]

  // 범위 확인
  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1')

  // 헤더 추출 (첫 행)
  const columns: string[] = []
  for (let col = range.s.c; col <= range.e.c; col++) {
    const cellAddress = XLSX.utils.encode_cell({ r: range.s.r, c: col })
    const cell = sheet[cellAddress]
    columns.push(cell ? String(cell.v || '').trim() : `Column${col + 1}`)
  }

  // 데이터 행 추출
  const rows: Record<string, string>[] = []
  for (let row = range.s.r + 1; row <= range.e.r; row++) {
    const rowData: Record<string, string> = {}
    let hasData = false

    for (let col = range.s.c; col <= range.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: row, c: col })
      const cell = sheet[cellAddress]
      const value = cell ? formatCellValue(cell) : ''
      rowData[columns[col - range.s.c]] = value
      if (value) hasData = true
    }

    if (hasData) {
      rows.push(rowData)
    }
  }

  return { columns, rows }
}

/**
 * 셀 값 포맷팅
 */
function formatCellValue(cell: XLSX.CellObject): string {
  if (cell.t === 'n' && cell.v !== undefined) {
    // 숫자
    return String(cell.v)
  } else if (cell.t === 'd' && cell.v instanceof Date) {
    // 날짜
    return cell.v.toISOString().split('T')[0]
  } else if (cell.w) {
    // 포맷된 텍스트
    return cell.w
  } else if (cell.v !== undefined) {
    return String(cell.v)
  }
  return ''
}

/**
 * 파일 파싱 (통합)
 */
export async function parseFile(
  file: File | { content: string; name: string; type?: 'csv' | 'xlsx' }
): Promise<ParsedFile> {
  let content: string | ArrayBuffer
  let filename: string
  let isExcel = false

  if (file instanceof File) {
    filename = file.name
    isExcel = /\.(xlsx?|xls)$/i.test(filename)

    if (isExcel) {
      content = await file.arrayBuffer()
    } else {
      content = await file.text()
    }
  } else {
    filename = file.name
    content = file.content
    isExcel = file.type === 'xlsx'
  }

  // Excel 파일
  if (isExcel && content instanceof ArrayBuffer) {
    const { columns, rows } = parseExcelBuffer(content)
    const format = detectFileFormat(
      rows.slice(0, 3).map(r => Object.values(r).join(',')).join('\n'),
      filename
    )

    return {
      columns,
      rows,
      file_type: 'xlsx',
      row_count: rows.length
    }
  }

  // CSV 파일
  const csvContent = content as string
  const format = detectFileFormat(csvContent, filename)

  if (format === 'casenote') {
    // 케이스노트 형식 → 표준 형식으로 변환
    const casenoteResults = parseCasenoteCSV(csvContent)
    const { columns, rows } = convertCasenoteToStandard(casenoteResults)

    return {
      columns,
      rows,
      file_type: 'casenote',
      row_count: rows.length
    }
  }

  // 표준 또는 비표준 CSV
  const { columns, rows } = parseCSVContent(csvContent)

  return {
    columns,
    rows,
    file_type: format === 'standard' ? 'csv' : 'csv',
    row_count: rows.length
  }
}

/**
 * 케이스노트 파싱 결과를 표준 형식으로 변환
 */
function convertCasenoteToStandard(results: ParsedCaseFromCSV[]): {
  columns: string[]
  rows: Record<string, string>[]
} {
  const columns = [
    'court_case_number',
    'court_name',
    'client_name',
    'case_name',
    'client_role',
    'opponent_name'
  ]

  const rows: Record<string, string>[] = results
    .filter(r => !r.parseError)
    .map(r => ({
      court_case_number: r.caseNumber,
      court_name: r.courtFullName,
      client_name: r.clientName,
      case_name: r.caseName,
      client_role: r.clientRole || '',
      opponent_name: r.opponentName
    }))

  return { columns, rows }
}

/**
 * 컬럼 자동 매핑 시도
 */
export function attemptAutoMapping(columns: string[]): Map<string, keyof StandardCaseRow> {
  const mapping = new Map<string, keyof StandardCaseRow>()

  for (const column of columns) {
    const normalized = normalizeColumnName(column)
    if (normalized) {
      mapping.set(column, normalized)
    }
  }

  return mapping
}

/**
 * 파일이 표준 형식인지 확인
 */
export function isStandardFormat(columns: string[]): boolean {
  const requiredFields = ['court_case_number', 'court_name', 'client_name']
  const mappedFields = columns.map(c => normalizeColumnName(c)).filter(Boolean)

  return requiredFields.every(f => mappedFields.includes(f as keyof StandardCaseRow))
}

/**
 * 파싱된 데이터를 StandardCaseRow 배열로 변환
 */
export function convertToStandardRows(
  rows: Record<string, string>[],
  columnMapping?: Map<string, keyof StandardCaseRow>
): Partial<StandardCaseRow>[] {
  return rows.map(row => convertToStandardRow(row, columnMapping))
}

/**
 * 인코딩 감지 (간단한 휴리스틱)
 */
export function detectEncoding(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)

  // BOM 체크
  if (bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) {
    return 'utf-8'
  }
  if (bytes[0] === 0xFF && bytes[1] === 0xFE) {
    return 'utf-16le'
  }
  if (bytes[0] === 0xFE && bytes[1] === 0xFF) {
    return 'utf-16be'
  }

  // EUC-KR 휴리스틱 (한글 바이트 범위 체크)
  let eucKrScore = 0
  let utf8Score = 0

  for (let i = 0; i < Math.min(bytes.length, 1000); i++) {
    // EUC-KR 한글 범위: 0xB0-0xC8 (첫 바이트), 0xA1-0xFE (둘째 바이트)
    if (bytes[i] >= 0xB0 && bytes[i] <= 0xC8 && i + 1 < bytes.length) {
      if (bytes[i + 1] >= 0xA1 && bytes[i + 1] <= 0xFE) {
        eucKrScore++
      }
    }

    // UTF-8 멀티바이트 체크
    if ((bytes[i] & 0xE0) === 0xC0 && i + 1 < bytes.length) {
      if ((bytes[i + 1] & 0xC0) === 0x80) {
        utf8Score++
      }
    }
    if ((bytes[i] & 0xF0) === 0xE0 && i + 2 < bytes.length) {
      if ((bytes[i + 1] & 0xC0) === 0x80 && (bytes[i + 2] & 0xC0) === 0x80) {
        utf8Score += 2
      }
    }
  }

  if (eucKrScore > utf8Score && eucKrScore > 5) {
    return 'euc-kr'
  }

  return 'utf-8'
}
