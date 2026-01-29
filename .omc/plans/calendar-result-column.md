# Work Plan: unified_calendar 뷰에 result 컬럼 추가

## Context

### Original Request
캘린더 성능 최적화 과정에서 제거된 `scourt_result_raw` 컬럼을 복구하여 이벤트 결과를 표시할 수 있도록 수정

### Background
- 2026-01-28 캘린더 성능 최적화에서 `scourt_result_raw` 컬럼이 unified_calendar 뷰에서 제거됨
- 현재 UI에서는 `status === 'adjourned'`로 연기 여부만 판단 가능
- 사용자는 더 상세한 기일 결과(속행, 종결, 판결선고, 각하, 취하, 연기 등)를 보고 싶어함
- `court_hearings` 테이블에는 `result` (hearing_result ENUM) 컬럼이 존재

### Research Findings

#### 현재 unified_calendar 뷰 컬럼 (supabase/combined_schema_20260201.sql:3074-3253)
```
id, event_type, event_type_kr, event_subtype, title, case_name,
event_date, event_time, event_datetime, reference_id, location,
description, status, case_id, tenant_id, attending_lawyer_id,
attending_lawyer_name, video_participant_side, our_client_name, sort_priority
```

#### court_hearings 테이블의 result 컬럼 (line 1312)
- 타입: `hearing_result` ENUM
- 값: `continued`, `settled`, `judgment`, `dismissed`, `withdrawn`, `adjourned`, `other`

#### 현재 UI 연기 판단 로직
```typescript
// components/calendar/components/EventPopup.tsx, WeekDayEvent.tsx, MonthEvent.tsx
const isPostponed = status === 'adjourned'
```

#### RESULT_LABELS 매핑 (EventPopup.tsx lines 15-23)
```typescript
const RESULT_LABELS: Record<string, string> = {
  continued: '속행',
  settled: '종결',
  judgment: '판결선고',
  dismissed: '각하',
  withdrawn: '취하',
  adjourned: '연기',
  other: '기타',
}
```
**NOTE**: RESULT_LABELS가 이미 EventPopup.tsx에 정의되어 있음. 중복 생성하지 말 것.

## Work Objectives

### Core Objective
unified_calendar 뷰에 `result` 컬럼을 추가하여 법원기일의 상세 결과를 API와 UI에서 표시

### Deliverables
1. **DB Migration**: unified_calendar 뷰에 `result` 컬럼 추가
2. **API 수정**: `/api/admin/calendar` 응답에 result 컬럼 포함
3. **Type 정의 업데이트**: ApiEvent, BigCalendarEvent, UnifiedSchedule에 result 추가
4. **UI 업데이트**: EventPopup에서 result 값 표시

### Definition of Done
- [ ] DB 마이그레이션 파일 생성 및 적용 가능
- [ ] API에서 result 값 반환
- [ ] TypeScript 타입에 result 필드 추가
- [ ] EventPopup에서 결과 뱃지 표시 (adjourned가 아닌 다른 결과도 표시)
- [ ] 기존 연기 판단 로직 유지 (status === 'adjourned' || result === 'adjourned')

## Guardrails

### Must Have
- unified_calendar 뷰의 기존 컬럼/로직 유지
- 성능 영향 최소화 (JOIN 추가 없이 ch.result만 참조)
- 다른 이벤트 타입(DEADLINE, CONSULTATION, GENERAL_SCHEDULE)은 NULL 반환
- 타입 안전성 유지

### Must NOT Have
- scourt_result_raw 컬럼 복구 (불필요 - result ENUM으로 충분)
- 복잡한 JOIN 추가
- 기존 UI 레이아웃 변경
- RESULT_LABELS 중복 정의 (이미 EventPopup.tsx line 15-23에 존재)

## Detailed TODOs

### TODO 1: DB Migration 생성
**File**: `supabase/migrations/20260128100000_add_result_to_unified_calendar.sql`

**COMPLETE SQL (실행 가능)**:
```sql
-- unified_calendar 뷰 수정: result 컬럼 추가
DROP VIEW IF EXISTS unified_calendar;

CREATE OR REPLACE VIEW unified_calendar AS
-- 1. 법원기일 (COURT_HEARING)
SELECT
  ch.id,
  'COURT_HEARING'::TEXT AS event_type,
  '법원기일'::TEXT AS event_type_kr,
  ch.hearing_type::TEXT AS event_subtype,
  CONCAT('(',
    CASE ch.hearing_type::TEXT
      WHEN 'HEARING_MAIN' THEN '변론기일'
      WHEN 'HEARING_INTERIM' THEN '중간심문'
      WHEN 'HEARING_MEDIATION' THEN '조정기일'
      WHEN 'HEARING_INVESTIGATION' THEN '심문기일'
      WHEN 'HEARING_PARENTING' THEN '양육상담'
      WHEN 'HEARING_JUDGMENT' THEN '선고기일'
      WHEN 'HEARING_LAWYER_MEETING' THEN '변호사 미팅'
      WHEN 'HEARING_SENTENCE' THEN '형사 선고'
      WHEN 'HEARING_TRIAL' THEN '공판기일'
      WHEN 'HEARING_EXAMINATION' THEN '증인신문'
      ELSE ch.hearing_type::TEXT
    END,
    ') ', COALESCE(lc.case_name, ch.case_number, '미지정 사건')
  )::TEXT AS title,
  COALESCE(lc.case_name, ch.case_number)::TEXT AS case_name,
  DATE(ch.hearing_date AT TIME ZONE 'Asia/Seoul') AS event_date,
  TO_CHAR(ch.hearing_date AT TIME ZONE 'Asia/Seoul', 'HH24:MI')::TEXT AS event_time,
  ch.hearing_date AS event_datetime,
  COALESCE(ch.case_number, lc.court_case_number)::TEXT AS reference_id,
  CASE
    WHEN lc.court_name IS NOT NULL AND ch.location IS NOT NULL THEN lc.court_name || ' ' || ch.location
    WHEN lc.court_name IS NOT NULL THEN lc.court_name
    ELSE ch.location
  END::TEXT AS location,
  ch.notes::TEXT AS description,
  ch.status::TEXT AS status,
  ch.result::TEXT AS result,  -- 추가: 기일 결과
  ch.case_id::TEXT AS case_id,
  lc.tenant_id::TEXT AS tenant_id,
  -- 출석변호사 정보
  COALESCE(ch.attending_lawyer_id, lc.assigned_to)::TEXT AS attending_lawyer_id,
  COALESCE(tm_attending.display_name, tm_assigned.display_name)::TEXT AS attending_lawyer_name,
  -- 화상기일 정보
  ch.video_participant_side::TEXT AS video_participant_side,
  -- 당사자 정보 (의뢰인)
  (
    SELECT party_name
    FROM case_parties cp
    WHERE cp.case_id = ch.case_id AND cp.is_our_client = true
    LIMIT 1
  )::TEXT AS our_client_name,
  -- 정렬 우선순위
  CASE
    WHEN TO_CHAR(ch.hearing_date AT TIME ZONE 'Asia/Seoul', 'HH24:MI') = '00:00' THEN 1
    ELSE 2
  END AS sort_priority
FROM court_hearings ch
LEFT JOIN legal_cases lc ON ch.case_id = lc.id
LEFT JOIN tenant_members tm_attending ON ch.attending_lawyer_id = tm_attending.id
LEFT JOIN tenant_members tm_assigned ON lc.assigned_to = tm_assigned.id

UNION ALL

-- 2. 사건 데드라인 (DEADLINE)
SELECT
  cd.id,
  'DEADLINE'::TEXT AS event_type,
  '데드라인'::TEXT AS event_type_kr,
  cd.deadline_type::TEXT AS event_subtype,
  CONCAT('(',
    CASE cd.deadline_type::TEXT
      WHEN 'DL_APPEAL' THEN '상소기간'
      WHEN 'DL_MEDIATION_OBJ' THEN '조정이의기간'
      WHEN 'DL_IMM_APPEAL' THEN '즉시항고'
      WHEN 'DL_APPEAL_BRIEF' THEN '항소이유서'
      WHEN 'DL_APPEAL_BRIEF_HIGH' THEN '상고이유서'
      WHEN 'DL_RETRIAL' THEN '재심기한'
      WHEN 'DL_CRIMINAL_APPEAL' THEN '형사상소기간'
      WHEN 'DL_FAMILY_NONLIT' THEN '비송즉시항고'
      WHEN 'DL_PAYMENT_ORDER' THEN '지급명령이의'
      WHEN 'DL_ELEC_SERVICE' THEN '전자송달'
      WHEN 'DL_CUSTOM' THEN COALESCE(cd.custom_deadline_name, '사용자정의')
      ELSE cd.deadline_type::TEXT
    END,
    ') ', COALESCE(lc.case_name, cd.case_number, '미지정 사건')
  )::TEXT AS title,
  COALESCE(lc.case_name, cd.case_number)::TEXT AS case_name,
  cd.deadline_date::DATE AS event_date,
  '00:00'::TEXT AS event_time,
  (cd.deadline_date::TEXT || ' 00:00:00')::TIMESTAMP AS event_datetime,
  COALESCE(cd.case_number, lc.court_case_number)::TEXT AS reference_id,
  NULL::TEXT AS location,
  cd.notes::TEXT AS description,
  cd.status::TEXT AS status,
  NULL::TEXT AS result,  -- DEADLINE은 결과 없음
  cd.case_id::TEXT AS case_id,
  lc.tenant_id::TEXT AS tenant_id,
  -- 담당변호사 (사건 담당자)
  lc.assigned_to::TEXT AS attending_lawyer_id,
  tm_assigned.display_name::TEXT AS attending_lawyer_name,
  -- 화상기일 정보 (해당없음)
  NULL::TEXT AS video_participant_side,
  -- 당사자 정보 (데드라인에 연결된 당사자 또는 의뢰인)
  COALESCE(
    (SELECT cp.party_name FROM case_parties cp WHERE cp.id = cd.case_party_id),
    (SELECT cp.party_name FROM case_parties cp WHERE cp.case_id = cd.case_id AND cp.is_our_client = true LIMIT 1)
  )::TEXT AS our_client_name,
  -- 정렬 우선순위
  1 AS sort_priority
FROM case_deadlines cd
LEFT JOIN legal_cases lc ON cd.case_id = lc.id
LEFT JOIN tenant_members tm_assigned ON lc.assigned_to = tm_assigned.id

UNION ALL

-- 3. 상담 (CONSULTATION)
SELECT
  c.id,
  'CONSULTATION'::TEXT AS event_type,
  '상담'::TEXT AS event_type_kr,
  c.request_type::TEXT AS event_subtype,
  ('(상담) ' || c.name)::TEXT AS title,
  c.name::TEXT AS case_name,
  c.preferred_date::DATE AS event_date,
  COALESCE(c.preferred_time, '00:00')::TEXT AS event_time,
  (c.preferred_date::TEXT || ' ' || COALESCE(c.preferred_time, '00:00') || ':00')::TIMESTAMP AS event_datetime,
  c.phone::TEXT AS reference_id,
  NULL::TEXT AS location,
  c.message::TEXT AS description,
  c.status::TEXT AS status,
  NULL::TEXT AS result,  -- CONSULTATION은 결과 없음
  NULL::TEXT AS case_id,
  c.tenant_id::TEXT AS tenant_id,
  -- 담당자
  c.assigned_to::TEXT AS attending_lawyer_id,
  tm_assigned.display_name::TEXT AS attending_lawyer_name,
  -- 화상기일 정보 (해당없음)
  NULL::TEXT AS video_participant_side,
  -- 당사자 정보 (상담자 본인)
  c.name::TEXT AS our_client_name,
  -- 정렬 우선순위
  CASE
    WHEN c.preferred_time IS NULL OR c.preferred_time = '00:00' THEN 1
    ELSE 2
  END AS sort_priority
FROM consultations c
LEFT JOIN tenant_members tm_assigned ON c.assigned_to = tm_assigned.id
WHERE c.preferred_date IS NOT NULL

UNION ALL

-- 4. 일반 일정 (GENERAL_SCHEDULE)
SELECT
  gs.id,
  'GENERAL_SCHEDULE'::TEXT AS event_type,
  '일반일정'::TEXT AS event_type_kr,
  gs.schedule_type::TEXT AS event_subtype,
  gs.title::TEXT AS title,
  NULL::TEXT AS case_name,
  gs.schedule_date AS event_date,
  COALESCE(gs.schedule_time::TEXT, '00:00') AS event_time,
  (gs.schedule_date::TEXT || ' ' || COALESCE(gs.schedule_time::TEXT, '00:00') || ':00')::TIMESTAMP AS event_datetime,
  NULL::TEXT AS reference_id,
  gs.location::TEXT AS location,
  gs.description::TEXT AS description,
  gs.status::TEXT AS status,
  NULL::TEXT AS result,  -- GENERAL_SCHEDULE은 결과 없음
  NULL::TEXT AS case_id,
  gs.tenant_id::TEXT AS tenant_id,
  -- 담당자
  gs.assigned_to::TEXT AS attending_lawyer_id,
  tm_assigned.display_name::TEXT AS attending_lawyer_name,
  -- 화상기일 정보 (해당없음)
  NULL::TEXT AS video_participant_side,
  -- 당사자 정보 (해당없음)
  NULL::TEXT AS our_client_name,
  -- 정렬 우선순위
  CASE
    WHEN gs.schedule_time IS NULL THEN 1
    ELSE 2
  END AS sort_priority
FROM general_schedules gs
LEFT JOIN tenant_members tm_assigned ON gs.assigned_to = tm_assigned.id;

COMMENT ON VIEW unified_calendar IS '법원기일, 데드라인, 상담, 일반일정을 통합한 캘린더 뷰';
```

**Acceptance Criteria**:
- 뷰가 정상 생성됨
- COURT_HEARING 이벤트에만 result 값 반환
- 기존 쿼리 호환성 유지

### TODO 2: API 컬럼 추가
**File**: `app/api/admin/calendar/route.ts`

**Changes**:
```typescript
const CALENDAR_COLUMNS = [
  'id',
  'event_type',
  'event_subtype',
  'title',
  'event_date',
  'event_time',
  'location',
  'case_id',
  'reference_id',
  'case_name',
  'description',
  'status',
  'attending_lawyer_id',
  'attending_lawyer_name',
  'video_participant_side',
  'our_client_name',
  'result',  // 추가
  'sort_priority',
].join(', ')
```

**Acceptance Criteria**:
- API 응답에 result 필드 포함
- 기존 필드 순서/동작 유지

### TODO 3: Type 정의 업데이트
**File**: `components/calendar/types.ts`

**Changes**:
```typescript
export interface ApiEvent {
  // ... 기존 필드들
  result?: string | null  // 추가: 기일 결과
}

export interface BigCalendarEvent {
  // ... 기존 필드들
  result?: string  // 추가: 기일 결과
}

export interface UnifiedSchedule {
  // ... 기존 필드들
  result?: string  // 추가: 기일 결과
}
```

**Acceptance Criteria**:
- 타입 정의 일관성 유지
- 선택적 필드로 정의 (하위 호환성)

### TODO 4: Event Transformer 업데이트
**File**: `components/calendar/utils/eventTransformers.ts`

**Changes**:
```typescript
// convertToBigCalendarEvent 함수 수정
export function convertToBigCalendarEvent(event: ApiEvent): BigCalendarEvent {
  // ... 기존 코드
  return {
    // ... 기존 필드들
    result: event.result || undefined,  // 추가
  }
}

// convertToUnifiedSchedule 함수 수정
export function convertToUnifiedSchedule(event: BigCalendarEvent): UnifiedSchedule {
  // ... 기존 코드
  return {
    // ... 기존 필드들
    result: event.result,  // 추가
  }
}
```

**Acceptance Criteria**:
- API -> BigCalendarEvent -> UnifiedSchedule 변환 시 result 전달

### TODO 5: EventPopup UI 업데이트
**File**: `components/calendar/components/EventPopup.tsx`

**Insertion Point**: Line 141 (daysUntil destructuring 뒤에 result 추가)

**Change 1 - Destructuring (line 126-141)**:
```typescript
const {
  title,
  start,
  allDay,
  eventType,
  eventSubtype,
  location,
  caseNumber,
  caseId,
  caseName,
  status,
  attendingLawyerName,
  videoParticipantSide,
  ourClientName,
  daysUntil,
  result,  // 추가 (line 141 뒤)
} = event
```

**Change 2 - 결과 표시 UI (line 253 뒤, 담당변호사 섹션 다음, 뱃지 섹션 이전)**:
```typescript
{/* 기일 결과 - COURT_HEARING이고 result가 있을 때만 표시 */}
{eventType === 'COURT_HEARING' && result && (
  <div className="flex items-center gap-2 text-sm">
    <svg className="w-4 h-4 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
    <span className="text-[var(--text-primary)]">
      결과: {RESULT_LABELS[result] || result}
    </span>
  </div>
)}
```

**NOTE**: RESULT_LABELS는 이미 EventPopup.tsx lines 15-23에 정의되어 있음. 새로 정의하지 말 것.

**Acceptance Criteria**:
- COURT_HEARING 타입일 때만 결과 표시
- result 값이 있을 때만 표시
- 기존 RESULT_LABELS 상수 사용하여 한글 라벨로 변환

## Task Flow and Dependencies

```
[TODO 1: DB Migration]
        |
        v
[TODO 2: API 컬럼 추가]
        |
        v
[TODO 3: Type 정의] ---> [TODO 4: Transformer]
                                |
                                v
                        [TODO 5: UI 업데이트]
```

## Commit Strategy

1. **Commit 1**: DB Migration
   - `feat(db): unified_calendar 뷰에 result 컬럼 추가`

2. **Commit 2**: API + Types + Transformer
   - `feat(calendar): API와 타입에 result 필드 추가`

3. **Commit 3**: UI
   - `feat(calendar): EventPopup에 기일 결과 표시`

## Success Criteria

1. **기능 검증**
   - [ ] COURT_HEARING 이벤트 클릭 시 결과 표시됨
   - [ ] DEADLINE, CONSULTATION, GENERAL_SCHEDULE은 결과 표시 없음
   - [ ] 결과가 없는 기일도 정상 표시

2. **성능 검증**
   - [ ] API 응답 시간 기존과 동일 (추가 JOIN 없음)
   - [ ] 뷰 쿼리 플랜 변화 없음

3. **타입 안전성**
   - [ ] TypeScript 빌드 에러 없음
   - [ ] lsp_diagnostics 패스

## Notes

### Migration 적용 방법
```bash
# Supabase CLI
npx supabase db push

# 또는 수동 적용
psql -h <host> -U <user> -d <database> -f supabase/migrations/20260128100000_add_result_to_unified_calendar.sql
```

### 관련 문서
- `/docs/archived/summaries/CALENDAR_PERFORMANCE_OPTIMIZATION.md`
- `/docs/systems/CALENDAR_SYSTEM.md`
