# Schema Migration - API Compatibility Changes

> **마이그레이션 대상**: 새 Supabase 프로젝트 `feqxrodutqwliucfllgr.supabase.co`
> **문서 생성일**: 2026-01-16

---

## 1. 개요

새 스키마에서 제거되거나 변경된 컬럼/테이블로 인해 API 코드 수정이 필요합니다.

### 1.1 제거된 테이블
| 테이블 | 대체 방안 |
|--------|----------|
| `users_profiles` | `tenant_members`로 통합 |
| `partner_withdrawals` | 제거 (더율 특화, SaaS 불필요) |
| `monthly_settlements` | 제거 (더율 특화, SaaS 불필요) |

### 1.2 제거된 컬럼 (legal_cases)
| 컬럼 | 대체 방안 |
|------|----------|
| `retainer_fee` | `case_parties.fee_allocation_amount` 사용 |
| `opponent_name` | `case_parties`에서 `is_our_client = false`인 당사자 조회 |
| `client_role` | `case_parties.party_type`으로 대체 |

### 1.3 제거된 CONSTRAINT (동적 설정으로 대체)
| 테이블 | CONSTRAINT | 대체 |
|--------|------------|------|
| `payments` | `chk_payment_category` | `tenant_settings.payments.categories` |
| `payments` | `chk_office_location` | `tenant_settings.payments.officeLocations` |
| `expenses` | `chk_expense_category` | `tenant_settings.expenses.categories` |
| `bookings` | office_location CHECK | `tenant_settings.consultations.officeLocations` |

---

## 2. 수정 필요 파일 목록

### 2.1 사건 관리 API (29개 파일에서 레거시 필드 참조)

#### 핵심 수정 대상
```
app/api/admin/cases/route.ts
app/api/admin/cases/[id]/route.ts
app/api/admin/cases/[id]/parties/route.ts
app/api/admin/cases/[id]/client-role/route.ts
app/api/admin/receivables/route.ts
```

#### 온보딩/가져오기
```
lib/onboarding/batch-case-creator.ts
lib/onboarding/file-parser.ts
lib/onboarding/csv-schema.ts
lib/onboarding/template-generator.ts
lib/onboarding/ai-column-mapper.ts
lib/onboarding/import-report-generator.ts
app/api/admin/onboarding/batch-create/route.ts
app/api/admin/onboarding/batch-create-stream/route.ts
app/api/admin/onboarding/parse/route.ts
types/onboarding.ts
```

#### 대법원 연동
```
app/api/admin/scourt/sync/route.ts
app/api/admin/scourt/search/route.ts
app/api/admin/scourt/link-related/route.ts
lib/case/notice-detector.ts
lib/case/client-role-utils.ts
types/case-notice.ts
```

#### 클라이언트 포털
```
app/api/client/dashboard/route.ts
app/api/client/cases/[id]/route.ts
```

#### 테스트/스크립트
```
scripts/setup-test-environment.ts
scripts/check-snapshot.ts
scripts/check-migration.ts
scripts/test-open-case.ts
scripts/e2e-saas-tests.ts
```

---

## 3. 마이그레이션 가이드

### 3.1 `retainer_fee` → `case_parties.fee_allocation_amount`

**Before:**
```typescript
const { data } = await supabase
  .from('legal_cases')
  .select('id, case_name, retainer_fee')
  .single();

const fee = data.retainer_fee;
```

**After:**
```typescript
const { data } = await supabase
  .from('legal_cases')
  .select(`
    id,
    case_name,
    case_parties!inner(fee_allocation_amount)
  `)
  .eq('case_parties.is_our_client', true)
  .single();

// 의뢰인들의 수임료 합계
const totalFee = data.case_parties.reduce(
  (sum, p) => sum + (p.fee_allocation_amount || 0), 0
);
```

### 3.2 `opponent_name` → `case_parties` 조회

**Before:**
```typescript
const opponentName = legalCase.opponent_name;
```

**After:**
```typescript
const { data: opponents } = await supabase
  .from('case_parties')
  .select('party_name')
  .eq('case_id', caseId)
  .eq('is_our_client', false);

const opponentNames = opponents?.map(p => p.party_name).join(', ');
```

### 3.3 `client_role` → `case_parties.party_type`

**Before:**
```typescript
const clientRole = legalCase.client_role; // 'plaintiff' | 'defendant' | ...
```

**After:**
```typescript
const { data: ourClient } = await supabase
  .from('case_parties')
  .select('party_type')
  .eq('case_id', caseId)
  .eq('is_our_client', true)
  .single();

const clientRole = ourClient?.party_type;
```

### 3.4 동적 카테고리 검증

**Before (하드코딩):**
```typescript
const validCategories = ['착수금', '잔금', '성공보수', '상담료', '기타'];
if (!validCategories.includes(category)) {
  throw new Error('Invalid category');
}
```

**After (테넌트 설정 조회):**
```typescript
const { data: settings } = await supabase
  .from('tenant_settings')
  .select('value')
  .eq('key', 'payments')
  .single();

const validCategories = settings?.value?.categories || [];
if (!validCategories.includes(category)) {
  throw new Error('Invalid category');
}
```

---

## 4. 뷰 변경 사항

### 4.1 `unified_calendar` 뷰

새 스키마에서 `unified_calendar` 뷰가 재정의되었습니다:

- `video_participant_side` 컬럼 추가 (화상기일 정보)
- `our_client_name` 컬럼 추가 (당사자 정보)
- `attending_lawyer_name` 컬럼 추가 (출석변호사)
- 데드라인에 당사자 정보 연결

### 4.2 새 뷰 추가

| 뷰 | 용도 |
|----|------|
| `receivables_summary` | 사건별 미수금 요약 |
| `monthly_revenue_summary` | 월별 수입 합계 |
| `monthly_expense_summary` | 월별 지출 합계 |
| `upcoming_hearings` | 7일 이내 예정 기일 |
| `urgent_deadlines` | 3일 이내 마감 데드라인 |

---

## 5. RLS 정책 변경

### 5.1 표준 패턴 적용

모든 테이블에 일관된 RLS 정책 패턴 적용:

```sql
-- 패턴 1: 직접 테넌트 격리
CREATE POLICY "tenant_isolation_{table}" ON {table}
  FOR ALL TO authenticated
  USING (is_super_admin() OR tenant_id = get_current_tenant_id())
  WITH CHECK (is_super_admin() OR tenant_id = get_current_tenant_id());
```

### 5.2 공개 INSERT 테이블

상담/예약은 비인증 사용자도 INSERT 가능:

```sql
-- consultations, bookings
CREATE POLICY "public_insert_{table}" ON {table}
  FOR INSERT
  WITH CHECK (true);
```

---

## 6. 마이그레이션 체크리스트

### Phase 1: 코드 준비
- [ ] `retainer_fee` 참조 제거 (29개 파일)
- [ ] `opponent_name` 참조 제거
- [ ] `client_role` 참조 제거
- [ ] 하드코딩된 카테고리 검증 → 테넌트 설정 조회로 변경
- [ ] 새 뷰 쿼리 적용

### Phase 2: 환경 설정
- [ ] `.env.local` 새 프로젝트 URL/키 업데이트
- [ ] `supabase link --project-ref feqxrodutqwliucfllgr`

### Phase 3: 스키마 적용
- [ ] `supabase db push` 또는 Dashboard에서 SQL 실행
- [ ] RLS 정책 확인
- [ ] 기본 데이터 삽입 확인 (deadline_types, holidays 등)

### Phase 4: 검증
- [ ] `npm run dev` 실행
- [ ] 사건 목록 조회 테스트
- [ ] 입금/지출 등록 테스트
- [ ] 캘린더 조회 테스트
- [ ] 클라이언트 포털 테스트

---

## 7. 추가 스키마 불일치 수정 (2026-01-19)

> **커밋**: `d479c94` - fix: 스키마 불일치 추가 오류 수정

### 7.1 상담(consultations) 컬럼명 불일치

**문제**: `consultations` 테이블에 `confirmed_date`, `confirmed_time`, `assigned_lawyer` 컬럼이 존재하지 않음

| 기존 코드 | 실제 스키마 | 변경 내용 |
|----------|-----------|----------|
| `confirmed_date` | `preferred_date` | 컬럼명 변경 |
| `confirmed_time` | `preferred_time` | 컬럼명 변경 |
| `assigned_lawyer` (string) | `assigned_to` (UUID) | 타입 및 컬럼명 변경 |

**수정된 파일:**
| 파일 | 수정 내용 |
|------|----------|
| `app/api/admin/consultations/[id]/route.ts` | PATCH 요청에서 필드명 변경 |
| `app/api/admin/consultations/route.ts` | 필터 파라미터 `assigned_lawyer` → `assigned_to` |
| `app/api/admin/availability/slots/route.ts` | SELECT/필터에서 `preferred_date/time` 사용 |
| `app/api/cron/consultation-reminders/route.ts` | 리마인더 조회에서 `preferred_date` 사용 |
| `lib/supabase/consultations.ts` | 필터 함수에서 `assigned_to` 사용 |
| `components/MonthlyCalendar.tsx` | 캘린더 UI에서 `confirmed_date/time` 참조 제거 |
| `types/consultation.ts` | `UpdateConsultationInput`, `ConsultationFilters` 타입 수정 |

### 7.2 제거된 재무 테이블 대응

**제거된 테이블** (SaaS 전환으로 더율 특화 기능 비활성화):
- `monthly_settlements`
- `partner_withdrawals`

**수정된 파일:**
| 파일 | 수정 내용 |
|------|----------|
| `app/api/admin/financial/dashboard/route.ts` | 테이블 쿼리 제거, 기본값 반환 (50:50 분배) |
| `app/api/cron/aggregate-monthly-settlement/route.ts` | 크론 전체 비활성화 |

### 7.3 입금(payments) 컬럼 불일치

**문제 1**: `payments` 테이블에서 제거된 컬럼
- `is_confirmed`
- `confirmed_at`
- `confirmed_by`

**문제 2**: `legal_cases.client_id` 컬럼이 `case_clients` 테이블로 이동됨

**수정된 파일:**
| 파일 | 수정 내용 |
|------|----------|
| `lib/supabase/payments.ts` | `is_confirmed` 관련 로직 제거, `client_id` 조회 수정 |
| `app/api/admin/payments/route.ts` | `is_confirmed` 필터 및 INSERT 필드 제거 |

### 7.4 기타 제거된 테이블 대응

| 테이블 | 파일 | 처리 방법 |
|-------|------|----------|
| `korean_public_holidays` | `app/api/admin/holidays/route.ts` | 빈 응답 반환, 501 상태 코드 |
| `scourt_user_settings` | `app/api/admin/scourt/status/route.ts` | 기본값 사용 (maxProfiles=5, maxCasesPerProfile=50) |

### 7.5 타입 정의 변경

**`types/consultation.ts` 변경:**

```typescript
// Before
export interface UpdateConsultationInput {
  assigned_lawyer?: LawyerName;
  confirmed_date?: string;
  confirmed_time?: string;
  // ...
}

export interface ConsultationFilters {
  assigned_lawyer?: LawyerName;
  // ...
}

// After
export interface UpdateConsultationInput {
  assigned_to?: string;  // UUID (tenant_members.id 참조)
  preferred_date?: string | null;
  preferred_time?: string | null;
  // ...
}

export interface ConsultationFilters {
  assigned_to?: string;  // UUID
  // ...
}
```

---

## 8. 롤백 계획

문제 발생 시:
1. `.env.local`을 이전 프로젝트 URL로 복구
2. 필요시 이전 프로젝트의 백업에서 데이터 복구

```bash
# 이전 프로젝트로 복구
NEXT_PUBLIC_SUPABASE_URL=https://kqqyipnlkmmprfgygauk.supabase.co
```

---

## 9. 변경 이력

| 날짜 | 커밋 | 설명 |
|------|------|------|
| 2026-01-16 | - | 초기 마이그레이션 문서 작성 |
| 2026-01-18 | `4faddbe` | 스키마 불일치로 인한 API 오류 수정 |
| 2026-01-19 | `d479c94` | 스키마 불일치 추가 오류 수정 (상담/재무/입금/공휴일/스코트)
