# Plan: Calendar Result Raw Display Fix

## Context

### Original Request
1. EventPopup should display the ORIGINAL SCOURT result text (e.g., "쌍방조사", "기일변경") instead of enum labels (e.g., "휴정")
2. Fix corrupted data where "쌍방조사" records incorrectly have `result='adjourned'`

### Root Cause Analysis (VERIFIED)

**Critical Discovery:** The database has corrupted data from a batch update earlier today.

**Case 2025드단20616 조사기일:**
```json
{
  "id": "eeb3bc2b-40d7-452d-a1b5-42b974f8258c",
  "result": "adjourned",  // WRONG! Should be null
  "status": "COMPLETED",
  "scourt_raw_data": {
    "result": "쌍방조사"  // Original SCOURT text
  }
}
```

**Root Cause:** A batch update incorrectly set `result='adjourned'` for records that should have been left as null. The mapping function `mapScourtResult("쌍방조사")` correctly returns `null` - the code is correct, but the data was corrupted.

### Two Problems to Fix

| Problem | Root Cause | Solution |
|---------|------------|----------|
| Wrong result displayed | EventPopup shows enum labels not raw SCOURT text | Add `scourt_result_raw` column to view, display in UI |
| "쌍방조사" styled as postponed | Corrupted data has `result='adjourned'` incorrectly | Fix corrupted records via SQL |

---

## Work Objectives

### Core Objective
1. Display SCOURT original result text in calendar EventPopup
2. Fix corrupted court_hearings data where `result` doesn't match `scourt_raw_data.result` mapping

### Deliverables
1. **Data fix:** SQL script to correct corrupted records
2. **Database view update:** Add `scourt_result_raw` column to unified_calendar view (NEW migration)
3. **Type updates:** Add `scourtResultRaw` to ApiEvent and BigCalendarEvent types
4. **Transformer update:** Map new field in eventTransformers.ts
5. **UI update:** EventPopup displays raw SCOURT result text

### Definition of Done
- [ ] Corrupted records fixed: "쌍방조사" records have `result=NULL` not `result='adjourned'`
- [ ] EventPopup shows "쌍방조사", "기일변경" etc. instead of enum labels
- [ ] Hearings with result="쌍방조사" are NOT styled as postponed
- [ ] TypeScript compiles without errors
- [ ] Existing calendar functionality preserved

---

## Guardrails

### Must Have
- Use existing `scourt_raw_data.result` field (already populated by hearing-sync.ts)
- Maintain backward compatibility (fallback to enum label if raw not available)
- Keep isPostponed check for status='POSTPONED' (system-set status)
- Create NEW migration file `20260128700000_add_scourt_result_raw_to_unified_calendar.sql`

### Must NOT Have
- Do NOT modify the SCOURT_RESULT_MAP mapping logic (it correctly maps postponement-related terms)
- Do NOT change the `result` enum column behavior
- Do NOT remove HEARING_RESULT_LABELS (still needed for other parts of the app)
- Do NOT modify existing migration `20260128500000_add_result_to_unified_calendar.sql`

---

## Task Flow

```
Task 0: Fix corrupted data (SQL)
    |
    v
Task 1: Create NEW migration for scourt_result_raw column
    |
    v
Task 2: Update TypeScript types
    |
    v
Task 3: Update eventTransformers.ts
    |
    v
Task 4: Update EventPopup.tsx display logic
    |
    v
Task 5: Verification and testing
```

---

## Detailed TODOs

### Task 0: Fix Corrupted Data

**Priority:** CRITICAL - Must do first to restore data integrity

**Action:** Run SQL to reset `result` to NULL for records where:
- `scourt_raw_data->>'result'` exists AND
- `scourt_raw_data->>'result'` is NOT a valid postponement keyword AND
- `result = 'adjourned'`

**SQL Script:**
```sql
-- Step 1: Identify corrupted records
SELECT
  id,
  case_number,
  result,
  scourt_raw_data->>'result' as scourt_result
FROM court_hearings
WHERE result = 'adjourned'
  AND scourt_raw_data->>'result' IS NOT NULL
  AND scourt_raw_data->>'result' NOT IN ('기일변경', '연기', '휴정');

-- Step 2: Fix corrupted records (reset to NULL)
UPDATE court_hearings
SET result = NULL
WHERE result = 'adjourned'
  AND scourt_raw_data->>'result' IS NOT NULL
  AND scourt_raw_data->>'result' NOT IN ('기일변경', '연기', '휴정');

-- Step 3: Verify fix
SELECT
  id,
  case_number,
  result,
  scourt_raw_data->>'result' as scourt_result
FROM court_hearings
WHERE scourt_raw_data->>'result' = '쌍방조사';
```

**Acceptance Criteria:**
- [ ] Records with "쌍방조사" have `result = NULL`
- [ ] Records with "기일변경", "연기", "휴정" retain `result = 'adjourned'`
- [ ] No other hearing results affected

---

### Task 1: Create NEW Migration for scourt_result_raw Column

**File:** `supabase/migrations/20260128700000_add_scourt_result_raw_to_unified_calendar.sql` (NEW FILE)

**Base Migration:** `20260128600000_fix_unified_calendar_client_name.sql`
- The only change is adding `scourt_result_raw` column
- **CRITICAL:** Uses `lc.primary_client_name::TEXT AS our_client_name` (NOT the deprecated case_clients subqueries)

**Action:** Create a new migration that recreates the unified_calendar view with the additional `scourt_result_raw` column

**Migration Content:**
```sql
-- ============================================================================
-- Migration: Add scourt_result_raw column to unified_calendar view
-- Date: 2026-01-28
-- Base: 20260128600000_fix_unified_calendar_client_name.sql
-- Description: Expose original SCOURT result text for calendar display
-- Changes: Added scourt_result_raw column for raw SCOURT result text
-- ============================================================================

-- Drop existing view (required since we're changing columns)
DROP VIEW IF EXISTS unified_calendar;

-- Recreate unified_calendar view with scourt_result_raw column
CREATE VIEW unified_calendar AS
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
  ch.result::TEXT AS result,
  (ch.scourt_raw_data->>'result')::TEXT AS scourt_result_raw,  -- NEW: SCOURT 원본 결과 텍스트
  ch.case_id::TEXT AS case_id,
  lc.tenant_id::TEXT AS tenant_id,
  -- 출석변호사 정보
  COALESCE(ch.attending_lawyer_id, lc.assigned_to)::TEXT AS attending_lawyer_id,
  COALESCE(tm_attending.display_name, tm_assigned.display_name)::TEXT AS attending_lawyer_name,
  -- 화상기일 정보
  ch.video_participant_side::TEXT AS video_participant_side,
  -- 의뢰인 정보 (legal_cases.primary_client_name 사용)
  lc.primary_client_name::TEXT AS our_client_name,
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
  NULL::TEXT AS result,
  NULL::TEXT AS scourt_result_raw,  -- NEW: DEADLINE은 해당없음
  cd.case_id::TEXT AS case_id,
  lc.tenant_id::TEXT AS tenant_id,
  -- 담당변호사 (사건 담당자)
  lc.assigned_to::TEXT AS attending_lawyer_id,
  tm_assigned.display_name::TEXT AS attending_lawyer_name,
  -- 화상기일 정보 (해당없음)
  NULL::TEXT AS video_participant_side,
  -- 의뢰인 정보 (legal_cases.primary_client_name 사용)
  lc.primary_client_name::TEXT AS our_client_name,
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
  NULL::TEXT AS result,
  NULL::TEXT AS scourt_result_raw,  -- NEW: CONSULTATION은 해당없음
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
  NULL::TEXT AS result,
  NULL::TEXT AS scourt_result_raw,  -- NEW: GENERAL_SCHEDULE은 해당없음
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

COMMENT ON VIEW unified_calendar IS '법원기일, 데드라인, 상담, 일반일정을 통합한 캘린더 뷰 (scourt_result_raw 컬럼 포함, legal_cases.primary_client_name 사용)';

-- ============================================================================
-- Change Summary (vs base 20260128600000):
-- 1. Added (ch.scourt_raw_data->>'result')::TEXT AS scourt_result_raw to COURT_HEARING section
-- 2. Added NULL::TEXT AS scourt_result_raw to DEADLINE, CONSULTATION, GENERAL_SCHEDULE sections
-- 3. This enables calendar UI to show original SCOURT result text
-- ============================================================================
```

**Acceptance Criteria:**
- [ ] NEW migration file created at correct path
- [ ] View includes `scourt_result_raw` column
- [ ] Returns original SCOURT text for COURT_HEARING events
- [ ] Returns NULL for other event types

---

### Task 2: Update TypeScript Types

**File:** `components/calendar/types.ts`

**Changes at ApiEvent interface (around line 50):**
```typescript
result?: string | null  // 기일 결과 enum (continued, settled, judgment, adjourned 등)
scourt_result_raw?: string | null  // SCOURT 원본 결과 텍스트 ("쌍방조사", "기일변경" 등) - NEW
```

**Changes at BigCalendarEvent interface (around line 78):**
```typescript
result?: string  // 기일 결과 enum
scourtResultRaw?: string  // SCOURT 원본 결과 텍스트 - NEW
```

**Changes at UnifiedSchedule interface (around line 129):**
```typescript
result?: string  // 기일 결과 enum
scourt_result_raw?: string  // SCOURT 원본 결과 텍스트 - NEW
```

**Acceptance Criteria:**
- [ ] ApiEvent has `scourt_result_raw?: string | null`
- [ ] BigCalendarEvent has `scourtResultRaw?: string`
- [ ] UnifiedSchedule has `scourt_result_raw?: string`
- [ ] TypeScript compiles without errors

---

### Task 3: Update eventTransformers.ts

**File:** `components/calendar/utils/eventTransformers.ts`

**Changes at convertToBigCalendarEvent function (around line 55):**
```typescript
result: event.result || undefined,
scourtResultRaw: event.scourt_result_raw || undefined,  // NEW
```

**Changes at convertToUnifiedSchedule function (around line 89):**
```typescript
result: event.result,
scourt_result_raw: event.scourtResultRaw,  // NEW
```

**Acceptance Criteria:**
- [ ] `scourtResultRaw` is mapped from API response
- [ ] `scourt_result_raw` is mapped to UnifiedSchedule
- [ ] Handles null/undefined gracefully

---

### Task 4: Update EventPopup.tsx Display Logic

**File:** `components/calendar/components/EventPopup.tsx`

**Changes at destructuring (around line 117-133):**
```typescript
const {
  ...existing fields,
  result,
  scourtResultRaw,  // NEW
} = event
```

**Changes at result display (around line 248-257):**

Current:
```tsx
{eventType === 'COURT_HEARING' && result && (
  <div className="flex items-center gap-2 text-sm">
    ...
    <span className="text-[var(--text-primary)]">
      결과: {HEARING_RESULT_LABELS[result as keyof typeof HEARING_RESULT_LABELS] || result}
    </span>
  </div>
)}
```

Updated:
```tsx
{eventType === 'COURT_HEARING' && (result || scourtResultRaw) && (
  <div className="flex items-center gap-2 text-sm">
    <svg className="w-4 h-4 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
    <span className="text-[var(--text-primary)]">
      결과: {scourtResultRaw || HEARING_RESULT_LABELS[result as keyof typeof HEARING_RESULT_LABELS] || result}
    </span>
  </div>
)}
```

**Acceptance Criteria:**
- [ ] EventPopup shows "쌍방조사" when that's the SCOURT result
- [ ] Falls back to enum label if scourt_result_raw is not available
- [ ] Display works for both new and legacy hearings

---

### Task 5: Verification and Testing

**Database Verification:**
```sql
-- Verify scourt_result_raw column exists and returns correct data
SELECT id, result, scourt_result_raw
FROM unified_calendar
WHERE event_type = 'COURT_HEARING'
AND scourt_result_raw IS NOT NULL
LIMIT 10;

-- Verify corrupted data was fixed
SELECT id, result, scourt_result_raw
FROM unified_calendar
WHERE scourt_result_raw = '쌍방조사';
-- Expected: result should be NULL for these records
```

**Manual Test Cases:**
1. View a hearing with scourt_result_raw="기일변경" -> Should show "기일변경" in popup, styled as postponed (result='adjourned')
2. View a hearing with scourt_result_raw="쌍방조사" -> Should show "쌍방조사" in popup, NOT styled as postponed (result=NULL)
3. View a hearing with scourt_result_raw="속행" -> Should show "속행" in popup, NOT styled as postponed (result=NULL)
4. View a legacy hearing (no scourt_raw_data) -> Should fall back to enum label display

**Build Verification:**
- [ ] `npm run build` passes
- [ ] No TypeScript errors
- [ ] No ESLint warnings

---

## Commit Strategy

### Commit 1: Data fix (manual via SQL)
```
fix(calendar): correct corrupted court_hearings result values

- Reset result=NULL for records where scourt_raw_data.result is not a postponement keyword
- Affected records: "쌍방조사" incorrectly had result='adjourned'
```

### Commit 2: Database migration
```
feat(calendar): add scourt_result_raw column to unified_calendar view

- Expose original SCOURT result text in calendar view
- Fallback to NULL for non-COURT_HEARING events
```

### Commit 3: Frontend updates
```
feat(calendar): display original SCOURT result in EventPopup

- Add scourtResultRaw to calendar types
- Update eventTransformers to map new field
- EventPopup shows raw SCOURT text instead of enum labels
```

---

## Success Criteria

| Criterion | Measurement |
|-----------|-------------|
| Data integrity restored | "쌍방조사" records have result=NULL |
| Raw result displayed | EventPopup shows "쌍방조사" not enum label |
| Postponed styling correct | Only "기일변경", "연기", "휴정" hearings are grayed out |
| Backward compatible | Old hearings without scourt_raw_data still display correctly |
| Build passes | `npm run build` exits 0 |
| Type-safe | No TypeScript errors |

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Missing scourt_raw_data for old hearings | Medium | Low | Fallback to enum label display |
| Migration breaks existing queries | Low | High | Use COALESCE for null safety, create NEW migration file |
| Other corrupted records exist | Medium | Medium | SQL query identifies all affected records before fix |

---

## Dependencies

- No external dependencies
- Requires Supabase migration to be applied before frontend changes take effect
- Frontend changes can be deployed independently (graceful degradation)
- Task 0 (data fix) should be run BEFORE migration to avoid confusion

---

## Files Changed Summary

| File | Action |
|------|--------|
| SQL (run manually) | Fix corrupted records |
| `supabase/migrations/20260128700000_add_scourt_result_raw_to_unified_calendar.sql` | NEW FILE |
| `components/calendar/types.ts` | Add scourt_result_raw / scourtResultRaw fields |
| `components/calendar/utils/eventTransformers.ts` | Map new field |
| `components/calendar/components/EventPopup.tsx` | Display raw result text |
