# Plan: SCOURT Hearing Result Update Logic Fix

## Context

### Original Request
Fix three interconnected bugs in the SCOURT hearing sync logic that prevent hearing results (like "변론재개", "쌍방조사") from being properly stored and displayed in the calendar.

### Problem Summary
When SCOURT reports a new result for an existing hearing, the result is silently dropped due to three cascading bugs:
1. `scourt_raw_data` is only written when `scourt_type_raw` is missing (first sync only)
2. `mapScourtResult()` returns null for unmapped Korean result strings
3. `needsUpdate` check fails to detect when `scourt_raw_data.result` has changed

### Root Cause Analysis

**Bug 1: `scourt_raw_data` never updated after first sync** (Critical)
- File: `lib/scourt/hearing-sync.ts`, lines 424-433
- The UPDATE path only writes `scourt_raw_data` when `!existing.scourt_type_raw && hearing.type`
- After the first sync sets `scourt_type_raw`, subsequent syncs NEVER update `scourt_raw_data`
- This means new results from SCOURT (e.g., "변론재개") are permanently lost

**Bug 2: Missing SCOURT result values in `SCOURT_RESULT_MAP`** (High)
- File: `lib/scourt/hearing-sync.ts`, lines 89-108
- Known missing values: "변론재개", "쌍방조사", "조정불성립", "조정에갈음하는결정"
- When `mapScourtResult()` returns null, the enum `result` column stays null
- The `fix-corrupted-hearing-results.sql` script already documents "쌍방조사" as a known unmapped value

**Bug 3: Change detection misses raw result changes** (High)
- File: `lib/scourt/hearing-sync.ts`, lines 401-414
- SELECT query (line 401-406) fetches `scourt_type_raw` but NOT `scourt_raw_data`
- `needsUpdate` does not check if `scourt_raw_data.result` differs from `hearing.result`
- When `mapScourtResult()` returns null AND `scourt_type_raw` already exists, ALL three conditions fail

### Data Flow
```
SCOURT API -> hearing.result (Korean string, e.g., "변론재개")
    |
    v
mapScourtResult() -> HearingResult enum or null
    |
    v
court_hearings table:
  - result: HearingResult enum (mapped)     <-- Bug 2: null for unmapped
  - scourt_raw_data.result: raw Korean text  <-- Bug 1: never updated
    |
    v
unified_calendar view:
  - scourt_result_raw: (scourt_raw_data->>'result')  <-- Shows nothing if Bug 1
```

### Research Findings
- The `unified_calendar` view already correctly extracts `(ch.scourt_raw_data->>'result')::TEXT AS scourt_result_raw` (confirmed in migration `20260128700000`)
- The frontend calendar components already consume `scourt_result_raw` (confirmed in `calendar-result-column.md` plan)
- A previous `fix-corrupted-hearing-results.sql` script documents the "쌍방조사" problem -- result was incorrectly set to 'adjourned' for unmapped values
- The `HearingResult` type includes an `'other'` value that can be used as fallback

---

## Work Objectives

### Core Objective
Ensure that every SCOURT hearing result is faithfully stored in `scourt_raw_data.result` and properly mapped to the `result` enum column, so the calendar displays accurate hearing outcomes.

### Deliverables
1. Fixed UPDATE path that always updates `scourt_raw_data` when the SCOURT result changes
2. Expanded `SCOURT_RESULT_MAP` with missing result values
3. Fixed `needsUpdate` logic that detects raw result changes
4. Updated SELECT query that includes `scourt_raw_data` for comparison

### Definition of Done
- [x] When SCOURT reports "변론재개" for an existing hearing, it appears in `scourt_raw_data.result`
- [x] The `result` enum column is set to the correct mapped value (or `'other'` for unmapped)
- [x] Calendar UI shows the SCOURT original result text via `scourt_result_raw`
- [x] Existing hearings with stale `scourt_raw_data` get updated on next sync cycle
- [x] No regression in existing result mappings (continued, settled, judgment, etc.)

---

## Guardrails

### MUST Have
- Always update `scourt_raw_data` when `hearing.result` differs from stored value
- Add `scourt_raw_data` to the SELECT query for existing hearings
- Map "변론재개" to `'continued'` (it means hearing continues/reopens)
- Use `'other'` as fallback for completely unknown results instead of null
- Keep backward compatibility with existing data

### MUST NOT Have
- Do NOT refactor the Google Calendar sync logic
- Do NOT change the `unified_calendar` view or migration files
- Do NOT change the frontend calendar components
- Do NOT alter the INSERT path (line 460-480) -- it already works correctly
- Do NOT change the hash generation logic
- Do NOT modify any unrelated functions (extractVideoType, parseHearingDateTime, etc.)

---

## Task Flow

```
Task 1 (Expand Result Map)
    |
    v
Task 2 (Fix SELECT query)
    |
    v
Task 3 (Fix needsUpdate logic)
    |
    v
Task 4 (Fix scourt_raw_data update)
    |
    v
Task 5 (Verify & test)
```

All tasks are in the same file (`lib/scourt/hearing-sync.ts`), and each builds on the previous, so they must be sequential.

---

## Detailed TODOs

### Task 1: Expand `SCOURT_RESULT_MAP` with missing values
**File:** `lib/scourt/hearing-sync.ts`, lines 89-108
**Complexity:** Low
**Risk:** Low

**Changes:**
Add the following entries to `SCOURT_RESULT_MAP`:
```typescript
// Currently missing - add these:
'변론재개': 'continued',        // Hearing reopened (continues)
'쌍방조사': 'other',            // Both-party investigation (procedural, not a final result)
'조정불성립': 'dismissed',       // Mediation failed
'조정에갈음하는결정': 'judgment', // Decision in lieu of mediation
'불출석': 'other',              // No-show / non-appearance
'출석': 'other',                // Attendance (procedural)
```

Also add partial matching in `mapScourtResult()` for "재개":
```typescript
if (resultLC.includes('재개')) return 'continued';
if (resultLC.includes('불성립')) return 'dismissed';
```

**Acceptance Criteria:**
- `mapScourtResult('변론재개')` returns `'continued'`
- `mapScourtResult('쌍방조사')` returns `'other'`
- `mapScourtResult('조정불성립')` returns `'dismissed'`
- `mapScourtResult('조정에갈음하는결정')` returns `'judgment'`
- All existing mappings remain unchanged

**Consideration: Fallback to 'other' instead of null**
At the end of `mapScourtResult()`, change `return null` to `return 'other'` so that ANY non-empty SCOURT result gets at least an `'other'` classification. This prevents future unmapped values from silently disappearing.

However, returning `'other'` for every unmapped string changes the semantics -- currently null means "no result yet" vs "unknown result". The safer approach: only return `'other'` if the input is a non-empty string that didn't match anything. This is actually what the function should do, since it already returns null for empty/undefined input at the top.

**Decision:** Change the final `return null` to `return 'other'` in `mapScourtResult()`. The function already handles null/empty inputs at the top (lines 174-176), so the final return only executes for non-empty strings that didn't match -- these are legitimate results that should be classified as 'other'.

---

### Task 2: Add `scourt_raw_data` to the SELECT query
**File:** `lib/scourt/hearing-sync.ts`, lines 401-406
**Complexity:** Low
**Risk:** Low

**Current code (line 403):**
```typescript
.select('id, result, status, scourt_type_raw')
```

**New code:**
```typescript
.select('id, result, status, scourt_type_raw, scourt_raw_data')
```

**Acceptance Criteria:**
- The `existing` object now includes `scourt_raw_data` with the stored JSONB value
- No additional database calls needed for comparison

---

### Task 3: Fix `needsUpdate` change detection logic
**File:** `lib/scourt/hearing-sync.ts`, lines 411-414
**Complexity:** Medium
**Risk:** Medium (core logic change)

**Current code:**
```typescript
const needsUpdate =
  (hearingResult && existing.result !== hearingResult) ||
  (hearingStatus !== existing.status) ||
  (!existing.scourt_type_raw && hearing.type);
```

**New code:**
```typescript
// Check if the raw SCOURT result has changed
const existingRawResult = (existing.scourt_raw_data as Record<string, unknown>)?.result as string | undefined;
const rawResultChanged = hearing.result !== undefined && hearing.result !== (existingRawResult || '');

const needsUpdate =
  (hearingResult && existing.result !== hearingResult) ||
  (hearingStatus !== existing.status) ||
  (!existing.scourt_type_raw && hearing.type) ||
  rawResultChanged;
```

**Acceptance Criteria:**
- When SCOURT reports a new result (e.g., "변론재개") and `scourt_raw_data.result` was previously empty, `needsUpdate` is true
- When SCOURT reports a changed result (e.g., was "속행", now "변론종결"), `needsUpdate` is true
- When nothing has changed, `needsUpdate` is false (no unnecessary updates)
- When `hearing.result` is undefined/empty and stored is also empty, `needsUpdate` is false

---

### Task 4: Fix `scourt_raw_data` update in the UPDATE path
**File:** `lib/scourt/hearing-sync.ts`, lines 424-433
**Complexity:** Medium
**Risk:** Medium (core logic change)

**Current code:**
```typescript
// SCOURT 원본 데이터 업데이트
if (!existing.scourt_type_raw && hearing.type) {
  updateData.scourt_type_raw = hearing.type;
  updateData.scourt_raw_data = {
    type: hearing.type,
    result: hearing.result,
    location: hearing.location,
    sequence: extractHearingSequence(hearing.type),
  };
}
```

**New code:**
```typescript
// SCOURT 원본 기일명이 없으면 채워주기 (마이그레이션 전 데이터 대응)
if (!existing.scourt_type_raw && hearing.type) {
  updateData.scourt_type_raw = hearing.type;
}

// SCOURT 원본 데이터는 항상 최신으로 업데이트 (결과 변경 반영)
if (rawResultChanged || (!existing.scourt_type_raw && hearing.type)) {
  updateData.scourt_raw_data = {
    type: hearing.type,
    result: hearing.result,
    location: hearing.location,
    sequence: extractHearingSequence(hearing.type || ''),
  };
}
```

Note: `rawResultChanged` is the variable defined in Task 3. This ensures:
1. `scourt_type_raw` is still only set when missing (preserving original behavior)
2. `scourt_raw_data` is updated whenever the raw result changes OR when `scourt_type_raw` was missing
3. The latest `hearing.result` from SCOURT is always stored in `scourt_raw_data.result`

**Also update the `result` column when mapScourtResult now returns 'other' instead of null:**
Since Task 1 changes the fallback from null to 'other', the existing condition `(hearingResult && existing.result !== hearingResult)` will now correctly trigger for previously unmapped values. No additional change needed here.

**Acceptance Criteria:**
- Existing hearing with `scourt_type_raw` set but no result: gets `scourt_raw_data.result` updated
- Existing hearing with `scourt_type_raw` set and old result: gets `scourt_raw_data.result` updated to new value
- Existing hearing with `scourt_type_raw` missing: gets both `scourt_type_raw` and `scourt_raw_data` set (unchanged behavior)
- `scourt_raw_data` always reflects the latest SCOURT data after sync

---

### Task 5: Verification
**Complexity:** Low
**Risk:** None

**Steps:**
1. Run TypeScript compiler check: `npx tsc --noEmit lib/scourt/hearing-sync.ts` (or project-wide)
2. Verify no ESLint errors on the modified file
3. Manual trace through the code with these scenarios:
   - Scenario A: New hearing with result "변론재개" -> INSERT path (should work, unchanged)
   - Scenario B: Existing hearing, no previous result, SCOURT now reports "변론재개" -> UPDATE path should set `result='continued'` and `scourt_raw_data.result='변론재개'`
   - Scenario C: Existing hearing, previous result "속행", SCOURT now reports "변론종결" -> UPDATE path should set `result='settled'` and `scourt_raw_data.result='변론종결'`
   - Scenario D: Existing hearing, previous result "속행", SCOURT still reports "속행" -> Should be skipped (no update)
   - Scenario E: Existing hearing, unknown result "쌍방조사" -> should set `result='other'` and `scourt_raw_data.result='쌍방조사'`
4. Verify the `unified_calendar` view will now correctly show `scourt_result_raw` from the updated `scourt_raw_data`

**Acceptance Criteria:**
- TypeScript compilation passes with no errors
- All five scenarios produce expected results in code trace
- No regression in existing sync behavior

---

## Commit Strategy

**Single commit** -- all changes are in one file and are tightly coupled.

```
fix: SCOURT 기일결과 업데이트 로직 수정

- scourt_raw_data를 결과 변경 시 항상 업데이트하도록 수정
- SCOURT_RESULT_MAP에 누락된 결과값 추가 (변론재개, 쌍방조사 등)
- needsUpdate 조건에 scourt_raw_data.result 변경 감지 추가
- SELECT 쿼리에 scourt_raw_data 컬럼 추가
- mapScourtResult() 미매핑 결과를 'other'로 분류 (null 대신)
```

---

## Success Criteria

| Criterion | Verification Method |
|-----------|-------------------|
| "변론재개" stored in scourt_raw_data.result | Code trace through UPDATE path |
| result enum correctly mapped | Unit check: mapScourtResult('변론재개') === 'continued' |
| Calendar shows raw result text | scourt_result_raw derived from scourt_raw_data->>'result' (view already works) |
| Stale data updated on next sync | needsUpdate detects rawResultChanged |
| No regression | Existing SCOURT_RESULT_MAP entries unchanged |
| TypeScript compiles | `npx tsc --noEmit` passes |

---

## Files Modified

| File | Lines Changed | Nature |
|------|--------------|--------|
| `lib/scourt/hearing-sync.ts` | ~30 lines | Bug fix (3 bugs in one file) |

**No other files need modification.** The unified_calendar view and frontend already handle `scourt_result_raw` correctly.

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Unmapped result gets wrong enum | Low | Low | Fallback to 'other' instead of null |
| Extra DB writes for unchanged data | Low | Low | rawResultChanged check prevents unnecessary updates |
| Type mismatch on scourt_raw_data cast | Low | Medium | Use safe cast with `as Record<string, unknown>` |
| Existing 'adjourned' results overwritten | None | N/A | Only updates when SCOURT reports a NEW result |
