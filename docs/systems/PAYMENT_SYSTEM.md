# 입금/지출 관리 시스템

**Last Updated**: 2025-12-02

법무법인 더율의 입금 및 지출을 통합 관리하는 시스템입니다. 변호사 2인(임은지, 김현성) 파트너십의 5:5 지분 구조에 맞춘 자동 정산 기능을 포함합니다.

---

## 개요

### 주요 기능

| 구분 | 기능 | 설명 |
|------|------|------|
| **입금** | 입금 내역 관리 | 사건/상담별 입금 기록 |
| | 통계 대시보드 | 사무실별, 명목별, 월별 통계 |
| | 사건 연동 | 사건 목록에서 입금 현황 확인 |
| **지출** | 지출 내역 관리 | 카테고리별, 지역별 관리 |
| | 고정 지출 자동화 | 월 단위 자동 생성 |
| | 5:5 정산 | 파트너십 자동 분배 계산 |

### 기술 스택

- **DB**: Supabase PostgreSQL
- **API**: Next.js App Router
- **차트**: Recharts
- **Excel**: xlsx 라이브러리

---

## 데이터베이스 구조

### 입금 테이블 (payments)

```sql
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_date DATE NOT NULL,
  depositor_name TEXT NOT NULL,
  amount INTEGER NOT NULL,
  office_location TEXT CHECK (office_location IN ('평택', '천안')),
  payment_category TEXT NOT NULL CHECK (payment_category IN (
    '착수금', '잔금', '성공보수', '모든 상담',
    '내용증명', '집행(소송비용)', '기타'
  )),
  case_id UUID REFERENCES legal_cases(id),
  consultation_id UUID REFERENCES consultations(id),
  phone TEXT,
  memo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 지출 테이블 (expenses)

```sql
CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_date DATE NOT NULL,
  amount BIGINT NOT NULL,
  expense_category VARCHAR(50) NOT NULL,
  subcategory VARCHAR(100),
  office_location VARCHAR(20) CHECK (office_location IN ('평택', '천안', '공통')),
  vendor_name VARCHAR(200),
  is_recurring BOOLEAN DEFAULT FALSE,
  recurring_template_id UUID REFERENCES recurring_templates(id),
  memo TEXT,
  payment_method VARCHAR(50)
);
```

### 월별 정산 테이블 (monthly_settlements)

```sql
CREATE TABLE monthly_settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_month VARCHAR(7) UNIQUE NOT NULL,
  total_revenue BIGINT,
  total_expenses BIGINT,
  -- 자동 계산 필드
  net_profit BIGINT GENERATED ALWAYS AS (total_revenue - total_expenses) STORED,
  kim_share BIGINT GENERATED ALWAYS AS ((total_revenue - total_expenses) / 2) STORED,
  lim_share BIGINT GENERATED ALWAYS AS ((total_revenue - total_expenses) / 2) STORED,
  -- 인출 및 잔액
  kim_withdrawals BIGINT DEFAULT 0,
  lim_withdrawals BIGINT DEFAULT 0,
  kim_net_balance BIGINT GENERATED ALWAYS AS (kim_share - kim_withdrawals) STORED,
  lim_net_balance BIGINT GENERATED ALWAYS AS (lim_share - lim_withdrawals) STORED,
  -- 누적 채권/채무
  kim_accumulated_debt BIGINT DEFAULT 0,
  lim_accumulated_debt BIGINT DEFAULT 0,
  is_settled BOOLEAN DEFAULT FALSE
);
```

### 통계 뷰

| 뷰 이름 | 용도 |
|---------|------|
| `payment_stats_by_office` | 사무실별 입금 통계 |
| `payment_stats_by_category` | 명목별 입금 통계 |
| `payment_stats_by_month` | 월별 입금 통계 |
| `case_payment_summary` | 사건별 입금 합계 |
| `partner_debt_status` | 변호사별 채권/채무 현황 |
| `settlement_dashboard` | 정산 대시보드 |

---

## API 엔드포인트

### 입금 API

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/admin/payments` | 입금 목록 조회 |
| POST | `/api/admin/payments` | 입금 등록 |
| GET | `/api/admin/payments/[id]` | 입금 상세 |
| PATCH | `/api/admin/payments/[id]` | 입금 수정 |
| DELETE | `/api/admin/payments/[id]` | 입금 삭제 |
| GET | `/api/admin/payments/stats` | 통계 데이터 |

### 지출 API

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/admin/expenses` | 지출 목록 조회 |
| POST | `/api/admin/expenses` | 지출 등록 |
| GET | `/api/admin/expenses/summary` | 대시보드 통계 |
| GET | `/api/admin/expenses/charts` | 차트 데이터 |
| GET | `/api/admin/expenses/recurring` | 고정 지출 템플릿 |
| POST | `/api/admin/expenses/recurring/generate` | 고정 지출 자동 생성 |
| GET | `/api/admin/expenses/settlements` | 정산 목록 |
| GET | `/api/admin/expenses/settlements/debt-status` | 누적 채권/채무 현황 |

### Cron Jobs

| Endpoint | 스케줄 | 설명 |
|----------|--------|------|
| `/api/cron/generate-monthly-expenses` | 매월 1일 00:00 | 고정 지출 자동 생성 |
| `/api/cron/aggregate-monthly-settlement` | 매월 1일 01:00 | 정산 자동 집계 |

---

## 관리자 페이지

### 입금 관리

| 경로 | 기능 |
|------|------|
| `/admin/payments` | 입금 목록, CRUD, 필터링 |
| `/admin/payments/stats` | 통계 대시보드 |

**입금 목록 기능**:
- 사무실별/명목별/날짜 필터
- 입금인 검색
- 페이지네이션 (50건/페이지)
- 입금 추가/수정/삭제 모달

**통계 대시보드**:
- 총 입금액, 사무실별 입금액
- 명목별 상세 통계
- 월별 추세 (최근 12개월)

### 지출 관리

| 경로 | 기능 |
|------|------|
| `/admin/expenses` | 대시보드 (차트) |
| `/admin/expenses/list` | 지출 목록 |
| `/admin/expenses/recurring` | 고정 지출 템플릿 |
| `/admin/expenses/withdrawals` | 변호사 인출 관리 |
| `/admin/expenses/settlements` | 월별 정산 |
| `/admin/expenses/settlements/[id]` | 정산 상세 |

**지출 대시보드**:
- 월별 수익/지출 추이 (Line Chart)
- 카테고리별 분포 (Pie Chart)
- Excel 다운로드

---

## 사건 목록 연동

### CasePaymentsModal

사건 목록에서 입금 현황을 바로 확인하고 관리할 수 있습니다.

```tsx
import CasePaymentsModal from '@/components/CasePaymentsModal'

<CasePaymentsModal
  isOpen={showModal}
  onClose={() => setShowModal(false)}
  caseId="uuid-of-case"
  caseName="홍길동v김철수"
  onPaymentAdded={() => fetchPaymentInfo()}
/>
```

**기능**:
- 사건별 입금 내역 목록
- 총 입금액/건수 요약
- 입금 추가/삭제
- 실시간 데이터 동기화

---

## 5:5 정산 로직

### 계산 순서

1. **총 매출 입력** (수동)
2. **총 지출 집계** (expenses 테이블에서 자동)
3. **순수익 계산**: 총 매출 - 총 지출
4. **배분**: 순수익 / 2 (각 변호사)
5. **인출 집계**: partner_withdrawals 테이블에서 자동
6. **당월 잔액**: 배분 - 인출
7. **누적 채권/채무**: 전월 누적 + 당월 잔액

### 자동 생성 필드

PostgreSQL GENERATED 컬럼으로 자동 계산:
- `net_profit` = total_revenue - total_expenses
- `kim_share` = net_profit / 2
- `lim_share` = net_profit / 2
- `kim_net_balance` = kim_share - kim_withdrawals
- `lim_net_balance` = lim_share - lim_withdrawals

---

## 설치 및 설정

### 1. 마이그레이션 실행

```bash
# Supabase Dashboard SQL Editor에서 실행
supabase/migrations/20251124_create_payments_table.sql
supabase/migrations/20251124_create_expense_management_system.sql
```

### 2. CSV 데이터 임포트 (선택)

```bash
node scripts/import-payments-csv.js
node scripts/import-expense-data.js
```

### 3. Vercel Cron 설정

```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/cron/generate-monthly-expenses",
      "schedule": "0 0 1 * *"
    },
    {
      "path": "/api/cron/aggregate-monthly-settlement",
      "schedule": "0 1 1 * *"
    }
  ]
}
```

---

## 파일 구조

```
theyool-admin/
├── app/
│   ├── admin/
│   │   ├── payments/
│   │   │   ├── page.tsx          # 입금 목록
│   │   │   └── stats/page.tsx    # 통계 대시보드
│   │   └── expenses/
│   │       ├── page.tsx          # 지출 대시보드
│   │       ├── list/page.tsx     # 지출 목록
│   │       ├── recurring/        # 고정 지출
│   │       ├── withdrawals/      # 변호사 인출
│   │       └── settlements/      # 월별 정산
│   └── api/
│       ├── admin/
│       │   ├── payments/
│       │   └── expenses/
│       └── cron/
│
├── components/
│   ├── CasePaymentsModal.tsx
│   ├── ExpenseFormModal.tsx
│   └── ExpenseCharts.tsx
│
├── lib/supabase/
│   ├── payments.ts
│   └── expenses.ts
│
└── types/
    ├── payment.ts
    └── expense.ts
```

---

## 데이터 현황 (2025-11-24 기준)

### 입금 데이터
- 총 641건, ₩875,468,545
- 착수금 59.5%, 성공보수 33.2%, 잔금 4.7%

### 정산 데이터
- 고정 지출 템플릿 17개
- 월별 정산 23개월
- 변호사 인출 90건
- 김현성 누적 채권: 83,082,859원 (2025-10-31 기준)
