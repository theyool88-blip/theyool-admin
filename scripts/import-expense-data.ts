#!/usr/bin/env ts-node
// ============================================================================
// 법무법인 더율 - 지출 관리 시스템 CSV 임포트 스크립트
// ============================================================================
//
// 주의: 이 스크립트는 더율 전용 일회성 마이그레이션 스크립트입니다.
// SaaS 전환으로 인해 파트너 정산 관련 기능은 제거되었습니다.
//
// 제거된 기능:
// - importMonthlyAccounting(): partner_withdrawals, monthly_settlements 임포트
// - recalculateAccumulatedDebt(): 누적 채무 재계산
//
// 남은 기능:
// - importFixedExpenses(): recurring_templates 임포트 (고정 지출 템플릿)
// ============================================================================

import * as fs from 'fs'
import { parse } from 'csv-parse/sync'
import { createAdminClient } from '../lib/supabase/admin'

// ============================================================================
// CSV 경로 설정
// ============================================================================

const FIXED_EXPENSES_CSV = '/Users/hskim/Desktop/Private & Shared 4/더율 고정지출내역_all.csv'

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * CSV 파일 읽기
 */
function readCSV(filePath: string): any[] {
  const fileContent = fs.readFileSync(filePath, 'utf-8')
  const records = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  })
  return records
}

/**
 * 카테고리 매핑 (한글 → 시스템 카테고리)
 */
function mapCategory(category: string): string {
  const categoryMap: { [key: string]: string } = {
    '임대료': '임대료',
    '인건비': '인건비',
    '필수운영비': '필수운영비',
    '마케팅비': '마케팅비',
    '광고비': '광고비',
    '세금': '세금',
    '식대': '식대',
    '구독료': '구독료'
  }
  return categoryMap[category] || '기타'
}

/**
 * 지역 매핑
 */
function mapOfficeLocation(location: string): string | null {
  const locationMap: { [key: string]: string } = {
    '천안': '천안',
    '평택': '평택',
    '공통': '공통'
  }
  return locationMap[location] || null
}

/**
 * 숫자 파싱 (콤마 제거)
 */
function parseNumber(value: string | number): number {
  if (typeof value === 'number') return value
  if (!value || value === '') return 0
  return parseInt(String(value).replace(/,/g, ''), 10) || 0
}

// ============================================================================
// 고정 지출 템플릿 임포트
// ============================================================================

async function importFixedExpenses() {
  console.log('\n=== 고정 지출 템플릿 임포트 시작 ===\n')

  if (!fs.existsSync(FIXED_EXPENSES_CSV)) {
    console.error(`❌ 파일을 찾을 수 없습니다: ${FIXED_EXPENSES_CSV}`)
    return
  }

  const records = readCSV(FIXED_EXPENSES_CSV)
  console.log(`📄 ${records.length}개의 고정 지출 항목을 발견했습니다.`)

  const supabase = createAdminClient()
  let successCount = 0
  let errorCount = 0

  for (const record of records) {
    try {
      const templateData = {
        name: record.Name || '이름 없음',
        amount: parseNumber(record['금액']),
        expense_category: mapCategory(record.Select),
        office_location: mapOfficeLocation(record['지역']),
        is_active: true,
        start_date: '2024-01-01', // 기본 시작일
        day_of_month: 1, // 기본 매월 1일
        memo: `CSV 임포트: ${record.Name}`
      }

      const { data, error } = await supabase
        .from('recurring_templates')
        .insert([templateData])
        .select()
        .single()

      if (error) {
        console.error(`❌ 오류 발생 (${record.Name}):`, error.message)
        errorCount++
      } else {
        console.log(`✅ 생성 완료: ${record.Name} (${templateData.amount.toLocaleString()}원)`)
        successCount++
      }
    } catch (err: any) {
      console.error(`❌ 예외 발생 (${record.Name}):`, err.message)
      errorCount++
    }
  }

  console.log(`\n✅ 고정 지출 템플릿 임포트 완료: ${successCount}개 성공, ${errorCount}개 실패\n`)
}

// ============================================================================
// Main Execution
// ============================================================================

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════╗')
  console.log('║   법무법인 더율 - 고정 지출 템플릿 임포트                   ║')
  console.log('╚═══════════════════════════════════════════════════════════╝')

  try {
    await importFixedExpenses()
    console.log('\n✅ 임포트 작업이 완료되었습니다!\n')
  } catch (error: any) {
    console.error('\n❌ 임포트 중 오류 발생:', error.message)
    process.exit(1)
  }
}

// 스크립트 실행
if (require.main === module) {
  main()
}

export { importFixedExpenses }
