# 데이터 흐름 검증 및 스키마 정합성 개선

**날짜:** 2026-01-28
**커밋:** `06438c9` fix: 법원명 표시 일관성 및 ESLint 에러 전면 수정

## 개요

Ralph 자동화 모드로 데이터 흐름을 논리적으로 검증하고, 스키마와 코드 간 불일치를 수정했습니다.

## 분석된 데이터 흐름

### 1. case_parties 데이터 흐름
- **DB → API → Frontend** 경로 추적
- `scourt_label_raw`, `scourt_name_raw` 등 SCOURT 원본 데이터 필드 검증
- `manual_override`, `is_primary`, `representatives` 필드 스키마 정의 확인

### 2. unified_calendar 데이터 흐름
- 캘린더 뷰 → API → 프론트엔드 컴포넌트 경로 검증
- `hearing_status` vs `hearing_result` ENUM 구분 확인
- `status === 'POSTPONED'` (상태) vs `result === 'adjourned'` (결과) 분리

### 3. legal_cases 데이터 흐름
- `primary_client_id`, `primary_client_name` 비정규화 필드 검증
- `case_clients` M:N 관계 테이블 구조 확인

## 수정 사항

### 스키마 업데이트 (`combined_schema_20260201.sql`)

| 테이블 | 변경 내용 |
|--------|----------|
| `case_clients` | 신규 테이블 추가 (M:N 관계) |
| `legal_cases` | `primary_client_id`, `primary_client_name` 추가 |
| `case_parties` | `manual_override`, `scourt_label_raw`, `scourt_name_raw`, `is_primary`, `representatives` 추가 |
| `case_parties` | `client_id`, `fee_allocation_amount` 제거 (case_clients로 이전) |
| `receivables_summary` | `case_clients` 테이블 사용하도록 수정 |

### Calendar 버그 수정 (6개 파일)

**문제:** `status === 'adjourned'`가 항상 false
- `adjourned`는 `hearing_result` ENUM 값
- `status` 필드는 `hearing_status` ENUM 사용 (`POSTPONED`)

**수정된 파일:**
1. `components/calendar/components/EventPopup.tsx`
2. `components/calendar/components/MonthEvent.tsx`
3. `components/calendar/components/WeekDayEvent.tsx`
4. `components/calendar/BigCalendar.tsx`
5. `components/calendar/utils/eventTransformers.ts`
6. `components/MonthlyCalendar.tsx`

```typescript
// Before (버그)
if (status === 'adjourned') { ... }

// After (수정)
if (status === 'POSTPONED') { ... }
```

### TypeScript 타입 수정 (4개 파일)

**문제:** Supabase 조인 결과가 배열인데 단일 객체로 타입 정의

**수정된 파일:**
1. `app/clients/[id]/page.tsx` - `legal_cases: { ... }[]`
2. `app/clients/page.tsx` - `legal_cases: { ... }[]`
3. `app/api/superadmin/tenants/[id]/route.ts` - `users: { ... }[] | null`
4. `app/cases/[id]/edit/page.tsx` - `RelatedCaseRecord` 타입 수정

### 불필요 필드 제거

| 파일 | 제거된 필드 |
|------|------------|
| `types/court-hearing.ts` | `scourt_result_raw` |
| `components/calendar/types.ts` | `scourt_result_raw`, `scourtResultRaw` |
| `app/api/client/cases/[id]/route.ts` | API 쿼리에서 `scourt_result_raw` 제거 |

## ENUM 구분 정리

### `hearing_status` (기일 상태)
```sql
CREATE TYPE hearing_status AS ENUM (
  'SCHEDULED',    -- 예정됨
  'COMPLETED',    -- 완료됨
  'CANCELLED',    -- 취소됨
  'POSTPONED'     -- 연기됨 ← status 필드에서 사용
);
```

### `hearing_result` (기일 결과)
```sql
CREATE TYPE hearing_result AS ENUM (
  'continued',    -- 속행
  'concluded',    -- 종결
  'adjourned',    -- 연기 ← result 필드에서 사용
  'settled'       -- 화해
);
```

**중요:**
- `status === 'POSTPONED'` → 기일이 연기된 **상태**
- `result === 'adjourned'` → 기일 진행 후 연기된 **결과**

## 검증 결과

| 항목 | 결과 |
|------|------|
| TypeScript 컴파일 | ✅ 성공 (0 errors) |
| Next.js 빌드 | ✅ 성공 (173 pages) |
| ESLint | ✅ 성공 (0 errors) |
| Architect 검증 | ✅ APPROVED |

## 영향 범위

- 캘린더 컴포넌트: 연기된 기일이 올바르게 회색으로 표시됨
- 클라이언트 페이지: Supabase 조인 결과 타입 안전성 확보
- 수임료 요약 뷰: `case_clients` 테이블 기반으로 정확한 계산
