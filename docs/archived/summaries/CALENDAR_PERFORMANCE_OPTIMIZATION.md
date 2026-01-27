# 캘린더 성능 최적화 문서

## 개요

일정 페이지(`/schedules`)의 로딩 속도를 개선하기 위한 최적화 작업.
월 이동 시 느린 로딩 문제를 해결하고, 3000명 테넌트 지원을 위한 효율화 구현.

**작업일**: 2026-01-28

## 구현 내용

### Phase 1: 클라이언트 캐싱 (SWR 패턴)

#### 파일: `components/calendar/hooks/useCalendarEvents.ts`

**주요 변경:**
- 글로벌 Map 기반 인메모리 캐시 구현
- TTL: 5분 (CACHE_TTL)
- Stale 임계값: 30초 (STALE_TTL)
- 캐시 사이즈 제한: 최대 12개월

**SWR 패턴 동작:**
1. 캐시 히트 (fresh): 즉시 렌더링, 네트워크 요청 없음
2. 캐시 히트 (stale): 즉시 렌더링 + 백그라운드 재검증
3. 캐시 미스: 로딩 표시 + 네트워크 요청

**Race Condition 방지:**
```typescript
const currentCacheKeyRef = useRef(cacheKey)

// 백그라운드 재검증 완료 시
if (currentCacheKeyRef.current === revalidatingCacheKey) {
  setAllEvents(freshData)  // 현재 월과 같을 때만 상태 업데이트
}
```

**인접 월 프리페치:**
- 현재 월 로딩 완료 후 500ms 지연
- 이전/다음 월 데이터 백그라운드 프리페치

#### 파일: `components/calendar/BigCalendar.tsx`

- `isValidating` 상태 추가로 백그라운드 재검증 표시
- 캐시 데이터 존재 시 로딩 스피너 대신 데이터 표시

#### 파일: `components/calendar/components/CalendarToolbar.tsx`

- "갱신 중..." 인디케이터 (우측 상단)
- 백그라운드 재검증 중일 때만 표시

### Phase 2: API 최적화

#### 파일: `app/api/admin/calendar/route.ts`

**SELECT 최적화:**
```typescript
const CALENDAR_COLUMNS = [
  'id', 'event_type', 'event_subtype', 'title', 'event_date', 'event_time',
  'location', 'case_id', 'reference_id', 'case_name', 'description', 'status',
  'attending_lawyer_id', 'attending_lawyer_name', 'video_participant_side',
  'our_client_name', 'sort_priority'
].join(', ')
```

**Cache-Control 헤더:**
```
Cache-Control: private, max-age=300, stale-while-revalidate=60
```

### Phase 3: DB 인덱스

#### 파일: `supabase/migrations/20260128000001_calendar_performance_indexes.sql`

| 인덱스명 | 테이블 | 복합키 | 목적 |
|---------|--------|-------|------|
| `idx_court_hearings_case_date_covering` | court_hearings | (case_id, hearing_date) | 기일 조회 최적화 |
| `idx_case_deadlines_case_date_covering` | case_deadlines | (case_id, deadline_date) | 마감일 조회 최적화 |
| `idx_consultations_tenant_date_covering` | consultations | (tenant_id, preferred_date) | 상담 조회 최적화 |
| `idx_general_schedules_tenant_date_covering` | general_schedules | (tenant_id, schedule_date) | 일정 조회 최적화 |
| `idx_legal_cases_tenant_covering` | legal_cases | (tenant_id, id) | JOIN 최적화 |
| `idx_tenant_members_id_covering` | tenant_members | (id) | 변호사명 조회 |
| `idx_case_parties_case_order_covering` | case_parties | (case_id, party_order) | 의뢰인 서브쿼리 |

**Covering Index 패턴:**
- `INCLUDE` 절로 자주 조회되는 컬럼 포함
- Index-Only Scan 가능하게 하여 디스크 I/O 최소화

## API-View 컬럼 정합성

### unified_calendar 뷰 제공 컬럼

```
id, event_type, event_type_kr, event_subtype, title, case_name,
event_date, event_time, event_datetime, reference_id, location,
description, status, case_id, tenant_id, attending_lawyer_id,
attending_lawyer_name, video_participant_side, our_client_name, sort_priority
```

### 제거된 컬럼 (뷰에 미존재)

- `client_name`
- `deadline_type_label`
- `scourt_type_raw`
- `scourt_result_raw`
- `our_client_side` (→ `our_client_name`으로 변경)

### 연기 판단 로직 변경

**변경 전:**
```typescript
isPostponedHearing(schedule.scourt_result_raw)
```

**변경 후:**
```typescript
status === 'adjourned'
```

## 수정된 파일 목록

| 파일 | 변경 내용 |
|------|----------|
| `components/calendar/hooks/useCalendarEvents.ts` | SWR 캐싱, 프리페치, race condition 방지 |
| `components/calendar/BigCalendar.tsx` | isValidating 상태 처리 |
| `components/calendar/components/CalendarToolbar.tsx` | 갱신 중 인디케이터 |
| `app/api/admin/calendar/route.ts` | 컬럼 최적화, Cache-Control |
| `components/calendar/types.ts` | 타입 정의 정리 |
| `components/calendar/utils/eventTransformers.ts` | 변환 로직 수정 |
| `components/calendar/components/EventPopup.tsx` | 연기 판단 로직 수정 |
| `components/calendar/components/MonthEvent.tsx` | 컬럼명 수정 |
| `components/calendar/components/WeekDayEvent.tsx` | 연기 판단 로직 수정 |
| `components/MonthlyCalendar.tsx` | 레거시 캘린더 수정 |

## 마이그레이션 적용

```bash
# Supabase CLI 사용
npx supabase db push

# 또는 수동 적용
psql -h <host> -U <user> -d <database> -f supabase/migrations/20260128000001_calendar_performance_indexes.sql
```

## 예상 성능 개선

| 시나리오 | 개선 전 | 개선 후 |
|---------|--------|--------|
| 초기 로딩 (캐시 미스) | 2-3초 | 1-2초 (인덱스 효과) |
| 월 이동 (캐시 히트) | 2-3초 | 즉시 (0ms) |
| 월 이동 (캐시 stale) | 2-3초 | 즉시 + 백그라운드 갱신 |
| 인접 월 이동 | 2-3초 | 즉시 (프리페치 효과) |

## 후속 권장 작업

1. 프로덕션 DB에 인덱스 마이그레이션 적용
2. `EXPLAIN ANALYZE`로 쿼리 플랜 개선 확인
3. 실제 사용 패턴 모니터링 후 캐시 TTL 조정 검토
