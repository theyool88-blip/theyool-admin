# Repository Guidelines

**Last Updated**: 2025-12-02

법무법인 더율 관리자 시스템 (theyool-admin) 개발 가이드라인입니다.

---

## Documentation

문서는 `docs/` 폴더에 체계적으로 정리되어 있습니다:

```
docs/
├── systems/           # 시스템 설명서
│   ├── PAYMENT_SYSTEM.md      # 입금/지출 관리
│   ├── CONSULTATION_SYSTEM.md # 상담 관리
│   ├── COURT_HEARING_SYSTEM.md # 법원기일/데드라인
│   ├── CALENDAR_SYSTEM.md     # 캘린더 시스템
│   └── CLIENT_PORTAL.md       # 의뢰인 포털
│
├── guides/            # 개발 가이드
│   ├── SETUP_GUIDE.md         # 초기 설정
│   ├── DEPLOYMENT_GUIDE.md    # 배포 가이드
│   ├── MIGRATION_GUIDE.md     # DB 마이그레이션
│   └── API_REFERENCE.md       # API 레퍼런스
│
├── design/            # 디자인 시스템
│   └── SAGE_GREEN_THEME.md    # Sage Green 테마
│
└── archived/          # 완료된 과거 문서
    ├── plans/
    ├── progress/
    └── summaries/
```

---

## Project Structure & Module Organization

- `app/`: Next.js App Router pages for admin/login/cases/clients/schedules plus API handlers in `app/api`.
- `components/`: Reusable UI (dashboards, modals, calendars, forms) plus feature subfolders (`components/admin`, `components/consultations`).
- `hooks/` and `lib/`: Shared state/data utilities, Supabase clients (`lib/supabase`), Excel export helpers, and general helpers.
- `types/`: Central models/enums for schedules, hearings, payments, and consultations.
- `scripts/`: Node-based integration checks that call Supabase; use for data-flow validation.
- `supabase/`: SQL assets for database views/tests (e.g., unified calendar).
- `public/` and `app/globals.css`: Static assets and Tailwind v4 theme tokens (sage/coral palette).
- `docs/`: 프로젝트 문서 (시스템, 가이드, 디자인)

## Build, Test, and Development Commands
- `npm run dev`: Start the app at `http://localhost:3000`; requires `.env.local` Supabase keys.
- `npm run build`: Production build into `.next`.
- `npm run start`: Serve the built app (run after `build`).
- `npm run lint`: ESLint (Next.js core-web-vitals + TypeScript rules).
- Supabase integration checks: `node scripts/test-components.js`, `node scripts/test-weekly-calendar.js`, or `node scripts/test-calendar-api.js` (hit live data and log summaries).

## Coding Style & Naming Conventions
- TypeScript + React function components; mark client components with `use client` only when needed.
- Prefer 2-space indentation, single quotes, and no semicolons; order imports external → internal (`@/` alias for src root).
- Components are PascalCase, helpers camelCase, route/API folders lowercase.
- Use Tailwind utilities plus shared CSS variables from `app/globals.css` for spacing, colors, and form dimensions.

## Testing Guidelines
- Primary checks are the Supabase-backed scripts in `scripts/`; run the ones relevant to your change and capture console output.
- `.env.local` must define `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and for server-side scripts `SUPABASE_SERVICE_ROLE_KEY`; avoid production data unless coordinated.
- For database view changes, reference `supabase/test_unified_calendar.sql` before altering schema-dependent code.
- Run `npm run lint` before PRs; add focused unit/integration tests when introducing new data flows or transformations.

## Commit & Pull Request Guidelines
- Follow the existing Git style: `<type>: <short summary>` (e.g., `feat: 공휴일 관리 시스템 구축`, `refactor: 관리자 설정 페이지 구조화`). Keep a single language per message.
- PRs should include what changed/why, linked issue IDs, screenshots or GIFs for UI tweaks, notes on env or DB migrations (scripts or SQL paths), and the commands/tests you ran.

## Security & Configuration Tips
- Keep Supabase keys in `.env.local`; do not commit secrets.
- When running scripts that mutate data, point to staging or a dedicated schema and reset any fixtures noted in `scripts/` comments.

## Database Structure (핵심 테이블 관계)

### 주요 테이블 관계도
```
clients (의뢰인)
    │
    ├──< legal_cases (사건) [client_id]
    │       │
    │       ├──< payments (입금) [case_id]
    │       │       └── client_id (직접 연결, 자동 설정)
    │       │
    │       ├──< court_hearings (법원기일) [case_number]
    │       │
    │       └──< case_deadlines (데드라인) [case_number]
    │
    └──< consultations (상담) [client_id - optional]
            │
            └──< payments (입금) [consultation_id]
```

### payments 테이블 구조
| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | UUID | PK |
| `payment_date` | DATE | 입금일 |
| `depositor_name` | TEXT | 입금자명 |
| `amount` | INTEGER | 금액 (환불 시 음수) |
| `payment_category` | TEXT | 착수금/잔금/성공보수/모든 상담/내용증명/집행(소송비용)/기타/환불 |
| `office_location` | TEXT | 평택/천안 |
| `case_id` | UUID | FK → legal_cases (선택) |
| `client_id` | UUID | FK → clients (자동 설정) |
| `consultation_id` | UUID | FK → consultations (선택) |
| `receipt_type` | TEXT | 현금영수증/카드결제/세금계산서/현금/네이버페이/자진발급 |
| `is_confirmed` | BOOLEAN | 확인 여부 |
| `memo` | TEXT | 메모 |

### 입금 생성 시 자동 처리
```typescript
// lib/supabase/payments.ts createPayment()
1. case_id 입력 시 → legal_cases에서 client_id 자동 조회 & 설정
2. case_id 입력 시 → legal_cases에서 office 자동 조회 & 설정
3. payment_category === '환불' → amount를 음수로 저장
4. 저장 후 → legal_cases.total_received 자동 업데이트
```

### CRUD 구현 패턴

#### 입금 추가 (Create)
```typescript
// POST /api/admin/payments
const payload = {
  payment_date: '2024-01-15',
  depositor_name: '홍길동',
  amount: 1000000,  // 환불 시 음수
  payment_category: '착수금',
  case_id: 'uuid-...',  // 선택
  consultation_id: null,  // 선택
  is_confirmed: true,
}
// client_id는 백엔드에서 case_id 기반으로 자동 설정됨
```

#### 입금 수정 (Update)
```typescript
// PUT /api/admin/payments/[id]
// 동일한 payload 구조, case_id 변경 시 client_id도 자동 업데이트
```

#### 입금 삭제 (Delete)
```typescript
// DELETE /api/admin/payments/[id]
// 삭제 후 legal_cases.total_received 재계산 필요
```

#### 의뢰인별 입금 조회
```typescript
// 방법 1: client_id 직접 조회 (권장)
supabase.from('payments').select('*').eq('client_id', clientId)

// 방법 2: 사건 경유 조회 (기존 데이터 호환)
const cases = await supabase.from('legal_cases').select('id').eq('client_id', clientId)
supabase.from('payments').select('*').in('case_id', caseIds)
```

### 미수금 계산
```typescript
// 사건별 미수금 = 착수금 + 성공보수 - 총입금액
const outstanding = (retainer_fee || 0) + (calculated_success_fee || 0) - (total_received || 0)
```

### 환불 처리
- payment_category: '환불'
- amount: 음수 값 (예: -1000000)
- UI에서 양수 입력 → 저장 시 자동 음수 변환
- 총액 계산 시 자동 차감됨

### 관련 파일
- `types/payment.ts`: 타입 정의, PAYMENT_CATEGORIES
- `lib/supabase/payments.ts`: CRUD 함수
- `components/CasePaymentsModal.tsx`: 사건별 입금 관리
- `components/ClientPaymentsModal.tsx`: 의뢰인별 입금 조회
- `components/UnifiedScheduleModal.tsx`: 통합 입력 (입금 탭)
- `supabase/migrations/20251126_add_client_id_to_payments.sql`: client_id 마이그레이션
