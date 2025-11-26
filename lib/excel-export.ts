import * as XLSX from 'xlsx'
import type { Expense, MonthlySettlement, PartnerWithdrawal } from '@/types/expense'
import type { Payment } from '@/types/payment'

/**
 * 지출 데이터를 Excel로 다운로드
 */
export function exportExpensesToExcel(expenses: Expense[], filename: string = 'expenses.xlsx') {
  const data = expenses.map(expense => ({
    '지출일': expense.expense_date,
    '카테고리': expense.expense_category,
    '세부카테고리': expense.subcategory || '-',
    '금액': expense.amount,
    '지역': expense.office_location || '-',
    '공급업체': expense.vendor_name || '-',
    '결제방법': expense.payment_method || '-',
    '고정지출': expense.is_recurring ? 'Y' : 'N',
    '정산월': expense.month_key,
    '메모': expense.memo || '-'
  }))

  const worksheet = XLSX.utils.json_to_sheet(data)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, '지출내역')

  worksheet['!cols'] = [
    { wch: 12 }, // 지출일
    { wch: 15 }, // 카테고리
    { wch: 15 }, // 세부카테고리
    { wch: 15 }, // 금액
    { wch: 10 }, // 지역
    { wch: 20 }, // 공급업체
    { wch: 12 }, // 결제방법
    { wch: 10 }, // 고정지출
    { wch: 10 }, // 정산월
    { wch: 30 }  // 메모
  ]

  XLSX.writeFile(workbook, filename)
}

/**
 * 월별 정산 데이터를 Excel로 다운로드
 */
export function exportSettlementsToExcel(settlements: MonthlySettlement[], filename: string = 'settlements.xlsx') {
  const data = settlements.map(settlement => ({
    '정산월': settlement.settlement_month,
    '총매출': settlement.total_revenue,
    '천안매출': settlement.cheonan_revenue || 0,
    '평택매출': settlement.pyeongtaek_revenue || 0,
    '총지출': settlement.total_expenses,
    '순수익': settlement.total_revenue - settlement.total_expenses,
    '김현성_배분': Math.floor((settlement.total_revenue - settlement.total_expenses) / 2),
    '임은지_배분': Math.floor((settlement.total_revenue - settlement.total_expenses) / 2),
    '김현성_인출': settlement.kim_withdrawals,
    '임은지_인출': settlement.lim_withdrawals,
    '김현성_잔액': Math.floor((settlement.total_revenue - settlement.total_expenses) / 2) - settlement.kim_withdrawals,
    '임은지_잔액': Math.floor((settlement.total_revenue - settlement.total_expenses) / 2) - settlement.lim_withdrawals,
    '김현성_누적': settlement.kim_accumulated_debt,
    '임은지_누적': settlement.lim_accumulated_debt,
    '정산여부': settlement.is_settled ? '완료' : '대기'
  }))

  const worksheet = XLSX.utils.json_to_sheet(data)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, '월별정산')

  // 컬럼 너비 자동 조정
  worksheet['!cols'] = [
    { wch: 10 }, // 정산월
    { wch: 15 }, // 총매출
    { wch: 15 }, // 천안매출
    { wch: 15 }, // 평택매출
    { wch: 15 }, // 총지출
    { wch: 15 }, // 순수익
    { wch: 15 }, // 김현성_배분
    { wch: 15 }, // 임은지_배분
    { wch: 15 }, // 김현성_인출
    { wch: 15 }, // 임은지_인출
    { wch: 15 }, // 김현성_잔액
    { wch: 15 }, // 임은지_잔액
    { wch: 15 }, // 김현성_누적
    { wch: 15 }, // 임은지_누적
    { wch: 10 }  // 정산여부
  ]

  XLSX.writeFile(workbook, filename)
}

/**
 * 변호사 인출 데이터를 Excel로 다운로드
 */
export function exportWithdrawalsToExcel(withdrawals: PartnerWithdrawal[], filename: string = 'withdrawals.xlsx') {
  const data = withdrawals.map(withdrawal => ({
    '인출일': withdrawal.withdrawal_date,
    '변호사': withdrawal.partner_name,
    '금액': withdrawal.amount,
    '유형': withdrawal.withdrawal_type,
    '정산월': withdrawal.month_key,
    '설명': withdrawal.description || '-'
  }))

  const worksheet = XLSX.utils.json_to_sheet(data)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, '변호사인출')

  // 컬럼 너비 자동 조정
  worksheet['!cols'] = [
    { wch: 12 }, // 인출일
    { wch: 12 }, // 변호사
    { wch: 15 }, // 금액
    { wch: 12 }, // 유형
    { wch: 10 }, // 정산월
    { wch: 30 }  // 설명
  ]

  XLSX.writeFile(workbook, filename)
}

/**
 * 카테고리별 지출 통계를 Excel로 다운로드
 */
export function exportCategoryStatsToExcel(
  stats: Array<{ category: string; amount: number; count: number; percentage: number }>,
  filename: string = 'category-stats.xlsx'
) {
  const data = stats.map(stat => ({
    '카테고리': stat.category,
    '총금액': stat.amount,
    '건수': stat.count,
    '비율': `${stat.percentage.toFixed(1)}%`
  }))

  const worksheet = XLSX.utils.json_to_sheet(data)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, '카테고리별통계')

  worksheet['!cols'] = [
    { wch: 20 }, // 카테고리
    { wch: 15 }, // 총금액
    { wch: 10 }, // 건수
    { wch: 10 }  // 비율
  ]

  XLSX.writeFile(workbook, filename)
}

/**
 * 입금 데이터를 Excel로 다운로드
 */
export function exportPaymentsToExcel(payments: Payment[], filename: string = 'payments.xlsx') {
  const data = payments.map(payment => ({
    '입금일': payment.payment_date,
    '입금자명': payment.depositor_name,
    '금액': payment.amount,
    '지역': payment.office_location || '-',
    '카테고리': payment.payment_category,
    '사건명': payment.case_name || '-',
    '영수증유형': payment.receipt_type || '-',
    '연락처': payment.phone || '-',
    '정산월': payment.month_key || '-',
    '확인상태': payment.is_confirmed ? '확인' : '미확인',
    '확인일시': payment.confirmed_at ? new Date(payment.confirmed_at).toLocaleString('ko-KR') : '-',
    '확인자': payment.confirmed_by || '-',
    '메모': payment.memo || '-'
  }))

  const worksheet = XLSX.utils.json_to_sheet(data)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, '입금내역')

  // 컬럼 너비 자동 조정
  worksheet['!cols'] = [
    { wch: 12 }, // 입금일
    { wch: 15 }, // 입금자명
    { wch: 15 }, // 금액
    { wch: 10 }, // 지역
    { wch: 15 }, // 카테고리
    { wch: 25 }, // 사건명
    { wch: 12 }, // 영수증유형
    { wch: 15 }, // 연락처
    { wch: 10 }, // 정산월
    { wch: 10 }, // 확인상태
    { wch: 20 }, // 확인일시
    { wch: 20 }, // 확인자
    { wch: 30 }  // 메모
  ]

  XLSX.writeFile(workbook, filename)
}

/**
 * 통합 재무 리포트 생성 (입금 + 지출)
 */
export function exportFinancialReportToExcel(
  payments: Payment[],
  expenses: Expense[],
  monthKey: string,
  filename: string = `financial-report-${monthKey}.xlsx`
) {
  const workbook = XLSX.utils.book_new()

  // 1. 입금 시트
  const paymentData = payments.map(payment => ({
    '입금일': payment.payment_date,
    '입금자명': payment.depositor_name,
    '금액': payment.amount,
    '지역': payment.office_location || '-',
    '카테고리': payment.payment_category,
    '확인상태': payment.is_confirmed ? '확인' : '미확인'
  }))
  const paymentSheet = XLSX.utils.json_to_sheet(paymentData)
  paymentSheet['!cols'] = [
    { wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 10 }, { wch: 15 }, { wch: 10 }
  ]
  XLSX.utils.book_append_sheet(workbook, paymentSheet, '입금내역')

  // 2. 지출 시트
  const expenseData = expenses.map(expense => ({
    '지출일': expense.expense_date,
    '카테고리': expense.expense_category,
    '금액': expense.amount,
    '지역': expense.office_location || '-',
    '공급업체': expense.vendor_name || '-',
    '고정지출': expense.is_recurring ? 'Y' : 'N'
  }))
  const expenseSheet = XLSX.utils.json_to_sheet(expenseData)
  expenseSheet['!cols'] = [
    { wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 10 }, { wch: 20 }, { wch: 10 }
  ]
  XLSX.utils.book_append_sheet(workbook, expenseSheet, '지출내역')

  // 3. 요약 시트
  const totalRevenue = payments.reduce((sum, p) => sum + p.amount, 0)
  const confirmedRevenue = payments.filter(p => p.is_confirmed).reduce((sum, p) => sum + p.amount, 0)
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0)
  const netProfit = totalRevenue - totalExpenses

  const summaryData = [
    { '항목': '총 입금액', '금액': totalRevenue },
    { '항목': '확인된 입금액', '금액': confirmedRevenue },
    { '항목': '미확인 입금액', '금액': totalRevenue - confirmedRevenue },
    { '항목': '총 지출액', '금액': totalExpenses },
    { '항목': '순수익', '금액': netProfit },
    { '항목': '수익률', '금액': totalRevenue > 0 ? `${((netProfit / totalRevenue) * 100).toFixed(1)}%` : '0%' }
  ]
  const summarySheet = XLSX.utils.json_to_sheet(summaryData)
  summarySheet['!cols'] = [{ wch: 20 }, { wch: 20 }]
  XLSX.utils.book_append_sheet(workbook, summarySheet, '요약')

  XLSX.writeFile(workbook, filename)
}
