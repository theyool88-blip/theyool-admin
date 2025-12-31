# 법무법인 더율 - 지출 관리 시스템

## 📋 시스템 개요

변호사 2인 (임은지, 김현성) 파트너십의 5:5 지분 구조에 맞춘 지출 관리 및 월별 정산 시스템

### 핵심 기능
- ✅ 지출 내역 관리 (카테고리별, 지역별)
- ✅ 고정 지출 자동 생성 (월 단위)
- ✅ 변호사별 인출/지급 관리
- ✅ 월별 정산 자동 계산 (5:5 분배)
- ✅ 누적 채권/채무 추적

---

## 🚀 설치 및 실행

### 1단계: 데이터베이스 마이그레이션

#### 방법 A: Supabase Dashboard (권장) ⭐

1. **SQL Editor 접속**
   ```
   https://supabase.com/dashboard/project/kqqyipnlkmmprfgygauk/sql/new
   ```

2. **마이그레이션 SQL 복사**
   ```bash
   # Mac에서 클립보드로 복사
   cat supabase/migrations/20251124_create_expense_management_system.sql | pbcopy

   # 또는 파일 내용 출력
   cat supabase/migrations/20251124_create_expense_management_system.sql
   ```

3. **SQL Editor에 붙여넣고 "Run" 클릭**

#### 방법 B: Supabase CLI

```bash
# 1. Supabase CLI 로그인
supabase login

# 2. 프로젝트 연결
supabase link --project-ref kqqyipnlkmmprfgygauk

# 3. 마이그레이션 푸시
supabase db push
```

#### 방법 C: psql 직접 실행

```bash
PGPASSWORD='Soofm9856!' psql \
  -h aws-0-ap-northeast-2.pooler.supabase.com \
  -p 6543 \
  -d postgres \
  -U postgres.kqqyipnlkmmprfgygauk \
  -f supabase/migrations/20251124_create_expense_management_system.sql
```

### 2단계: 마이그레이션 검증

```sql
-- Table Editor 또는 SQL Editor에서 확인
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('expenses', 'recurring_templates', 'partner_withdrawals', 'monthly_settlements');

-- View 확인
SELECT * FROM partner_debt_status;
SELECT * FROM settlement_dashboard;
```

### 3단계: CSV 데이터 임포트

```bash
# CSV 파서 설치
npm install csv-parse

# 데이터 임포트 실행
npx ts-node scripts/import-expense-data.ts
```

#### 임포트 결과 확인

```sql
-- 고정 지출 템플릿 확인
SELECT name, amount, expense_category, office_location
FROM recurring_templates
ORDER BY name;

-- 월별 정산 확인
SELECT settlement_month, total_revenue, total_expenses,
       kim_accumulated_debt, lim_accumulated_debt
FROM monthly_settlements
ORDER BY settlement_month DESC
LIMIT 12;

-- 현재 채권/채무 상태
SELECT * FROM partner_debt_status;
```

---

## 📊 데이터베이스 구조

### 테이블

#### 1. expenses (지출 내역)
```sql
- id: UUID (PK)
- expense_date: 지출 일자
- amount: 금액
- expense_category: 카테고리 (임대료, 인건비, 필수운영비, 마케팅비, 광고비, 세금, 식대, 구독료, 기타)
- subcategory: 세부 카테고리
- office_location: 지역 (평택, 천안, 공통, 안쓰는 서비스)
- is_recurring: 고정 지출 여부
- recurring_template_id: 고정 지출 템플릿 ID
- vendor_name: 공급업체명
- memo: 메모
- receipt_url: 영수증 URL
- payment_method: 결제 수단 (카드, 현금, 계좌이체, 자동이체, 기타)
```

#### 2. recurring_templates (고정 지출 템플릿)
```sql
- id: UUID (PK)
- name: 템플릿 이름
- amount: 금액
- expense_category: 카테고리
- is_active: 활성화 여부
- start_date: 시작일
- end_date: 종료일 (null이면 무기한)
- day_of_month: 매월 지출 발생일 (1~28)
```

#### 3. partner_withdrawals (변호사 인출/지급)
```sql
- id: UUID (PK)
- withdrawal_date: 인출일
- partner_name: 변호사명 (임은지, 김현성)
- amount: 금액
- withdrawal_type: 인출 유형 (입금, 카드, 현금, 법인지출)
- month_key: 정산 월 (YYYY-MM)
- settlement_id: 월별 정산 ID
```

#### 4. monthly_settlements (월별 정산)
```sql
- id: UUID (PK)
- settlement_month: 정산 월 (YYYY-MM)
- total_revenue: 총 매출
- pyeongtaek_revenue: 평택 매출
- cheonan_revenue: 천안 매출
- total_expenses: 총 지출
- kim_withdrawals: 김현성 인출액
- lim_withdrawals: 임은지 인출액

-- 자동 계산 필드 (GENERATED ALWAYS AS)
- net_profit: 순수익 (매출 - 지출)
- kim_share: 김현성 분배액 (순수익 / 2)
- lim_share: 임은지 분배액 (순수익 / 2)
- kim_net_balance: 김현성 수령액 (분배액 - 인출액)
- lim_net_balance: 임은지 수령액 (분배액 - 인출액)

-- 누적 필드
- kim_accumulated_debt: 김현성 누적 채권/채무
- lim_accumulated_debt: 임은지 누적 채권/채무

- is_settled: 정산 완료 여부
- excel_file_url: Excel 파일 URL
```

### View (통계)

#### 1. monthly_revenue_summary
월별 수입 합계 (지역별, 카테고리별)

#### 2. monthly_expense_summary
월별 지출 합계 (지역별, 카테고리별, 고정지출 구분)

#### 3. partner_debt_status
변호사별 현재 채권/채무 상태

#### 4. expense_stats_by_category
카테고리별 지출 통계

#### 5. settlement_dashboard
정산 대시보드 (최근 12개월)

---

## 💻 API 사용법

### TypeScript Import

```typescript
import {
  // CRUD Functions
  getExpenses,
  createExpense,
  updateExpense,
  deleteExpense,

  getRecurringTemplates,
  createRecurringTemplate,
  generateRecurringExpenses,

  getPartnerWithdrawals,
  createPartnerWithdrawal,

  getMonthlySettlements,
  createMonthlySettlement,
  autoGenerateMonthlySettlement,

  // Statistics
  getMonthlyExpenseSummary,
  getPartnerDebtStatus,
  getSettlementDashboard
} from '@/lib/supabase/expenses'

// Types
import type {
  Expense,
  RecurringTemplate,
  PartnerWithdrawal,
  MonthlySettlement
} from '@/types/expense'
```

### 사용 예시

```typescript
// 지출 조회
const { data: expenses, count } = await getExpenses({
  startDate: '2025-01-01',
  endDate: '2025-01-31',
  category: '마케팅비',
  officeLocation: '평택'
})

// 지출 생성
const newExpense = await createExpense({
  expense_date: '2025-01-15',
  amount: 100000,
  expense_category: '광고비',
  office_location: '평택',
  vendor_name: '네이버',
  memo: '키워드 광고'
})

// 고정 지출 자동 생성 (특정 월)
const generatedExpenses = await generateRecurringExpenses('2025-02')

// 월별 정산 자동 생성
const settlement = await autoGenerateMonthlySettlement('2025-01', {
  total_revenue: 50000000,
  pyeongtaek_revenue: 30000000,
  cheonan_revenue: 20000000
})

// 채권/채무 현황 조회
const debtStatus = await getPartnerDebtStatus()
console.log(debtStatus)
// [
//   { partner_name: '김현성', accumulated_debt: 83082859, ... },
//   { partner_name: '임은지', accumulated_debt: -5000000, ... }
// ]
```

---

## 🔧 자동화 기능

### 1. 고정 지출 자동 생성

매월 1일에 활성화된 고정 지출 템플릿을 기반으로 지출 자동 생성

```typescript
// 수동 실행
await generateRecurringExpenses('2025-02')

// Cron Job 설정 (예: Vercel Cron)
// app/api/cron/generate-recurring-expenses/route.ts
export async function GET() {
  const monthKey = new Date().toISOString().slice(0, 7) // "YYYY-MM"
  await generateRecurringExpenses(monthKey)
  return Response.json({ success: true })
}
```

### 2. 월별 정산 자동 집계

매월 말일 또는 관리자가 수동으로 정산 생성

```typescript
// payments 테이블에서 매출 집계 후 자동 정산 생성
const settlement = await autoGenerateMonthlySettlement('2025-01', {
  total_revenue: 계산된_총매출,
  pyeongtaek_revenue: 평택_매출,
  cheonan_revenue: 천안_매출
})

// 정산 완료 후 확정 처리
await settleMonthlySettlement(settlement.id, true, '관리자이름')
```

### 3. 누적 채무 재계산

정산 데이터가 수정되었을 때 전체 누적 채무 재계산

```typescript
// scripts/import-expense-data.ts의 recalculateAccumulatedDebt 함수 참조
await recalculateAccumulatedDebt()
```

---

## 📱 Admin UI 개발 계획

### 1. 지출 관리 페이지
`/app/admin/expenses/page.tsx`

- 지출 목록 (테이블)
- 필터: 날짜 범위, 카테고리, 지역
- 검색: 공급업체명, 메모
- CRUD: 생성, 수정, 삭제
- 영수증 업로드

### 2. 고정 지출 관리
`/app/admin/expenses/recurring/page.tsx`

- 템플릿 목록
- 활성/비활성 토글
- 다음 달 자동 생성 미리보기
- 수동 생성 버튼

### 3. 변호사 인출 관리
`/app/admin/expenses/withdrawals/page.tsx`

- 인출 내역 조회
- 변호사별 필터
- 월별 통계 차트
- 인출 등록

### 4. 월별 정산
`/app/admin/expenses/settlements/page.tsx`

- 정산 대시보드
- 자동 집계 버튼
- Excel 업로드/다운로드
- 정산 확정 (is_settled = true)
- 누적 채권/채무 현황

---

## 🎯 다음 단계

1. ✅ 데이터베이스 마이그레이션 실행
2. ✅ CSV 데이터 임포트
3. ⬜ Admin UI 개발 (Phase 4)
   - 지출 관리 페이지
   - 고정 지출 관리
   - 변호사 인출 관리
   - 월별 정산 페이지
4. ⬜ 자동화 구현 (Phase 5)
   - Cron Job 설정
   - 알림 시스템
5. ⬜ 리포트 기능
   - PDF 정산서 생성
   - Excel 다운로드
   - 대시보드 차트

---

## 📞 문제 해결

### 마이그레이션 오류

**"relation already exists"**
```sql
-- 기존 테이블 삭제 후 재시도
DROP TABLE IF EXISTS expenses CASCADE;
DROP TABLE IF EXISTS recurring_templates CASCADE;
DROP TABLE IF EXISTS partner_withdrawals CASCADE;
DROP TABLE IF EXISTS monthly_settlements CASCADE;
```

### 임포트 오류

**CSV 파일을 찾을 수 없음**
- CSV 파일 경로 확인: `/Users/hskim/Desktop/Private & Shared 4/` 또는 `Private & Shared 5/`
- 파일명 확인: `더율 고정지출내역_all.csv`, `더율 월별 회계내역_all.csv`

**누적 채무 금액이 맞지 않음**
```bash
# 누적 채무 재계산 실행
npx ts-node -e "
import { recalculateAccumulatedDebt } from './scripts/import-expense-data';
recalculateAccumulatedDebt();
"
```

---

**작성일**: 2025-11-24
**버전**: 1.0.0
**작성자**: Claude Code
