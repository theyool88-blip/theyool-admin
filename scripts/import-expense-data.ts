#!/usr/bin/env ts-node
// ============================================================================
// 법무법인 더율 - 지출 관리 시스템 CSV 임포트 스크립트
// ============================================================================

import * as fs from 'fs'
import * as path from 'path'
import { parse } from 'csv-parse/sync'
import { createAdminClient } from '../lib/supabase/admin'
import type {
  RecurringTemplate,
  PartnerWithdrawal,
  MonthlySettlement
} from '../types/expense'

// ============================================================================
// CSV 경로 설정
// ============================================================================

const FIXED_EXPENSES_CSV = '/Users/hskim/Desktop/Private & Shared 4/더율 고정지출내역_all.csv'
const MONTHLY_ACCOUNTING_CSV = '/Users/hskim/Desktop/Private & Shared 5/더율 월별 회계내역_all.csv'

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
// 1. 고정 지출 템플릿 임포트
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
// 2. 월별 회계 데이터 임포트
// ============================================================================

async function importMonthlyAccounting() {
  console.log('\n=== 월별 회계 데이터 임포트 시작 ===\n')

  if (!fs.existsSync(MONTHLY_ACCOUNTING_CSV)) {
    console.error(`❌ 파일을 찾을 수 없습니다: ${MONTHLY_ACCOUNTING_CSV}`)
    return
  }

  const records = readCSV(MONTHLY_ACCOUNTING_CSV)
  console.log(`📄 ${records.length}개의 월별 회계 데이터를 발견했습니다.`)

  const supabase = createAdminClient()
  let settlementSuccessCount = 0
  let withdrawalSuccessCount = 0
  let errorCount = 0

  for (const record of records) {
    try {
      const monthKey = record['결산월'] // "YYYY-MM" 형식

      if (!monthKey || monthKey === '') {
        console.log('⏭️  결산월이 없는 행 건너뛰기')
        continue
      }

      // -------------------------
      // A. 변호사 인출 데이터 생성
      // -------------------------
      const withdrawals = []

      // 김현성 변호사 인출
      const kimDeposit = parseNumber(record['김변-입금'])
      const kimCard = parseNumber(record['김변-카드'])
      const kimCash = parseNumber(record['김변-현금'])
      const kimCorporate = parseNumber(record['김변법인지출'])

      if (kimDeposit > 0) {
        withdrawals.push({
          withdrawal_date: `${monthKey}-15`, // 임의 날짜
          partner_name: '김현성',
          amount: kimDeposit,
          withdrawal_type: '입금',
          month_key: monthKey,
          description: 'CSV 임포트 - 입금'
        })
      }
      if (kimCard > 0) {
        withdrawals.push({
          withdrawal_date: `${monthKey}-15`,
          partner_name: '김현성',
          amount: kimCard,
          withdrawal_type: '카드',
          month_key: monthKey,
          description: 'CSV 임포트 - 카드'
        })
      }
      if (kimCash > 0) {
        withdrawals.push({
          withdrawal_date: `${monthKey}-15`,
          partner_name: '김현성',
          amount: kimCash,
          withdrawal_type: '현금',
          month_key: monthKey,
          description: 'CSV 임포트 - 현금'
        })
      }
      if (kimCorporate > 0) {
        withdrawals.push({
          withdrawal_date: `${monthKey}-15`,
          partner_name: '김현성',
          amount: kimCorporate,
          withdrawal_type: '법인지출',
          month_key: monthKey,
          description: 'CSV 임포트 - 법인지출'
        })
      }

      // 임은지 변호사 인출
      const limDeposit = parseNumber(record['임변-입금'])
      const limCard = parseNumber(record['임변-카드'])
      const limCash = parseNumber(record['임변-현금'])
      const limCorporate = parseNumber(record['임변법인지출'])

      if (limDeposit > 0) {
        withdrawals.push({
          withdrawal_date: `${monthKey}-15`,
          partner_name: '임은지',
          amount: limDeposit,
          withdrawal_type: '입금',
          month_key: monthKey,
          description: 'CSV 임포트 - 입금'
        })
      }
      if (limCard > 0) {
        withdrawals.push({
          withdrawal_date: `${monthKey}-15`,
          partner_name: '임은지',
          amount: limCard,
          withdrawal_type: '카드',
          month_key: monthKey,
          description: 'CSV 임포트 - 카드'
        })
      }
      if (limCash > 0) {
        withdrawals.push({
          withdrawal_date: `${monthKey}-15`,
          partner_name: '임은지',
          amount: limCash,
          withdrawal_type: '현금',
          month_key: monthKey,
          description: 'CSV 임포트 - 현금'
        })
      }
      if (limCorporate > 0) {
        withdrawals.push({
          withdrawal_date: `${monthKey}-15`,
          partner_name: '임은지',
          amount: limCorporate,
          withdrawal_type: '법인지출',
          month_key: monthKey,
          description: 'CSV 임포트 - 법인지출'
        })
      }

      // 변호사 인출 데이터 삽입
      if (withdrawals.length > 0) {
        const { data: withdrawalData, error: withdrawalError } = await supabase
          .from('partner_withdrawals')
          .insert(withdrawals)
          .select()

        if (withdrawalError) {
          console.error(`❌ 인출 데이터 삽입 오류 (${monthKey}):`, withdrawalError.message)
          errorCount++
        } else {
          withdrawalSuccessCount += withdrawals.length
          console.log(`  ✅ ${monthKey}: ${withdrawals.length}개 인출 데이터 생성`)
        }
      }

      // -------------------------
      // B. 월별 정산 데이터 생성
      // -------------------------
      const cheonanRevenue = parseNumber(record['매출-천안'])
      const pyeongtaekRevenue = parseNumber(record['매출-평택'])
      const totalRevenue = cheonanRevenue + pyeongtaekRevenue

      const kimTotalWithdrawals = kimDeposit + kimCard + kimCash + kimCorporate
      const limTotalWithdrawals = limDeposit + limCard + limCash + limCorporate

      // CSV에서 정산 관련 데이터 추출
      const kimDebt = parseNumber(record['정산(김변채권+)'] || record['정산(김변채무)'] || 0)
      const isKimDebt = record['정산(김변채권+)'] ? false : true // 채권이면 false (회사가 지급할 금액), 채무면 true

      const settlementData = {
        settlement_month: monthKey,
        total_revenue: totalRevenue,
        cheonan_revenue: cheonanRevenue,
        pyeongtaek_revenue: pyeongtaekRevenue,
        kim_withdrawals: kimTotalWithdrawals,
        lim_withdrawals: limTotalWithdrawals,
        kim_accumulated_debt: isKimDebt ? kimDebt : -kimDebt, // 채무는 양수, 채권은 음수
        is_settled: record['정산여부'] === 'O' || record['정산여부'] === 'o',
        settlement_notes: 'CSV 임포트'
      }

      const { data: settlementResult, error: settlementError } = await supabase
        .from('monthly_settlements')
        .insert([settlementData])
        .select()
        .single()

      if (settlementError) {
        console.error(`❌ 정산 데이터 삽입 오류 (${monthKey}):`, settlementError.message)
        errorCount++
      } else {
        settlementSuccessCount++
        console.log(`✅ ${monthKey}: 정산 데이터 생성 (매출: ${totalRevenue.toLocaleString()}원)`)
      }
    } catch (err: any) {
      console.error(`❌ 예외 발생 (${record['결산월']}):`, err.message)
      errorCount++
    }
  }

  console.log(`\n✅ 월별 회계 데이터 임포트 완료:`)
  console.log(`   - 정산 데이터: ${settlementSuccessCount}개 성공`)
  console.log(`   - 인출 데이터: ${withdrawalSuccessCount}개 성공`)
  console.log(`   - 오류: ${errorCount}개\n`)
}

// ============================================================================
// 3. 누적 채무 재계산
// ============================================================================

async function recalculateAccumulatedDebt() {
  console.log('\n=== 누적 채무 재계산 시작 ===\n')

  const supabase = createAdminClient()

  // 모든 정산 데이터를 날짜순으로 가져오기
  const { data: settlements, error } = await supabase
    .from('monthly_settlements')
    .select('*')
    .order('settlement_month', { ascending: true })

  if (error) {
    console.error('❌ 정산 데이터 조회 실패:', error.message)
    return
  }

  let kimAccumulated = 0
  let limAccumulated = 0

  for (const settlement of settlements as MonthlySettlement[]) {
    // 이번 달 순수익 계산 (DB의 generated column과 동일)
    const netProfit = settlement.total_revenue - settlement.total_expenses
    const kimShare = Math.floor(netProfit / 2)
    const limShare = Math.floor(netProfit / 2)

    // 이번 달 수령액 계산
    const kimNetBalance = kimShare - settlement.kim_withdrawals
    const limNetBalance = limShare - settlement.lim_withdrawals

    // 누적 채무 업데이트 (이전 누적 + 이번 달 수령액)
    kimAccumulated += kimNetBalance
    limAccumulated += limNetBalance

    // DB 업데이트
    const { error: updateError } = await supabase
      .from('monthly_settlements')
      .update({
        kim_accumulated_debt: kimAccumulated,
        lim_accumulated_debt: limAccumulated
      })
      .eq('id', settlement.id)

    if (updateError) {
      console.error(`❌ 업데이트 실패 (${settlement.settlement_month}):`, updateError.message)
    } else {
      console.log(`✅ ${settlement.settlement_month}: 김변 누적=${kimAccumulated.toLocaleString()}, 임변 누적=${limAccumulated.toLocaleString()}`)
    }
  }

  console.log(`\n✅ 누적 채무 재계산 완료\n`)
  console.log(`📊 최종 누적 현황:`)
  console.log(`   - 김현성 변호사: ${kimAccumulated.toLocaleString()}원`)
  console.log(`   - 임은지 변호사: ${limAccumulated.toLocaleString()}원\n`)
}

// ============================================================================
// Main Execution
// ============================================================================

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════╗')
  console.log('║   법무법인 더율 - 지출 관리 시스템 데이터 임포트           ║')
  console.log('╚═══════════════════════════════════════════════════════════╝')

  try {
    // Step 1: 고정 지출 템플릿 임포트
    await importFixedExpenses()

    // Step 2: 월별 회계 데이터 임포트
    await importMonthlyAccounting()

    // Step 3: 누적 채무 재계산
    await recalculateAccumulatedDebt()

    console.log('\n✅ 모든 임포트 작업이 완료되었습니다!\n')
  } catch (error: any) {
    console.error('\n❌ 임포트 중 오류 발생:', error.message)
    process.exit(1)
  }
}

// 스크립트 실행
if (require.main === module) {
  main()
}

export { importFixedExpenses, importMonthlyAccounting, recalculateAccumulatedDebt }
