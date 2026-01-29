# Work Plan: Case Level (심급) Display Bug Fix

## Context

### Original Request
사건의 "심급"이 1심, 2심, 3심으로 표시되지 않고 모두 "1심"으로 표시되는 버그 수정

### Interview Summary
N/A - Direct planning mode from exploration context

### Research Findings

#### Root Cause Analysis

After thorough investigation, I identified the following root cause:

**The Bug Location:** The `case_level` column in `legal_cases` table is NOT being set when cases are created. It is only updated during SCOURT sync.

**Evidence:**

1. **Database Schema** (`/Users/hskim/luseed/supabase/combined_schema_20260201.sql:955`):
   ```sql
   case_level VARCHAR(10) DEFAULT '1심'
   ```
   The column has a default value of '1심', which is used for ALL new cases.

2. **Case Creation** (`/Users/hskim/luseed/app/api/admin/cases/route.ts:401-416`):
   ```typescript
   const { data: newCase, error } = await adminClient
     .from('legal_cases')
     .insert([withTenantId({
       case_name: body.case_name,
       case_type: body.case_type || '기타',
       // ... other fields
       // NOTE: case_level is NOT set here!
     }, tenant)])
   ```
   The case creation endpoint does NOT set `case_level`. It relies on the database default '1심'.

3. **SCOURT Sync** (`/Users/hskim/luseed/app/api/admin/scourt/sync/route.ts:984`):
   ```typescript
   updateData.case_level = shouldSetCaseLevel ? (generalData?.caseLevelDesc || null) : null;
   ```
   The `case_level` is only updated when SCOURT sync runs and `generalData?.caseLevelDesc` has a value.

4. **Case Level Determination** (`/Users/hskim/luseed/lib/scourt/api-client.ts:1365-1375`):
   ```typescript
   const caseTypeName = result.csDvsNm || (caseInfo?.csDvsNm as string | undefined);
   if (caseTypeName) {
     const levelInfo = getCaseLevel(caseTypeName);
     result.caseLevelDesc = levelInfo.description;
   }
   ```
   The API client extracts `csDvsNm` (case type code like "나", "다", "느단") and uses `getCaseLevel()` to determine the level.

5. **getCaseLevel Function** (`/Users/hskim/luseed/lib/scourt/case-relations.ts:540-565`):
   ```typescript
   export function getCaseLevel(caseType: string): { level: 1 | 2 | 3 | 'special'; description: string }
   ```
   Uses `getCaseTypeByCode()` to look up case type info from the comprehensive mapping in `lib/scourt/case-types.ts`.

6. **Case Type Mapping** (`/Users/hskim/luseed/lib/scourt/case-types.ts`):
   Contains 244 case types with their correct levels (1심, 항소심, 상고심, etc.)

**Why It Appears All Cases Show "1심":**

1. When a case is created manually (without SCOURT sync), it gets the default '1심' value
2. When SCOURT sync runs but `csDvsNm` is not extracted from the API response, `caseLevelDesc` remains undefined
3. Even when SCOURT sync runs successfully, if the case is a "신청/집행/가사신청/보호" type, `case_level` is explicitly set to `null` (line 956)
4. The `getCaseLevel()` function correctly determines levels, but the flow to save it to DB may be interrupted

**The Real Issue (Two-fold):**

1. **On Case Creation:** `case_level` should be inferred from `court_case_number` if provided
2. **On SCOURT Sync:** Need to verify `csDvsNm` is being extracted correctly for all case types

---

## Work Objectives

### Core Objective
Fix the case level (심급) display so that cases correctly show their appropriate level (1심, 항소심, 상고심, etc.) based on their case type code.

### Deliverables
1. Case creation endpoint sets `case_level` based on `court_case_number` when provided
2. SCOURT sync reliably extracts and saves `case_level`
3. Existing cases with incorrect `case_level` can be fixed via a migration script

### Definition of Done
- [ ] New cases created with court_case_number automatically get correct case_level
- [ ] SCOURT sync correctly updates case_level for all case types
- [ ] UI displays correct case level (1심/항소심/상고심) based on actual case type
- [ ] Existing cases can be bulk-updated with correct case_level

---

## Guardrails

### Must Have
- [x] Use existing `getCaseLevel()` and `getCaseTypeByCode()` functions
- [x] Maintain backward compatibility with existing data
- [x] Follow existing code patterns and conventions
- [x] Add proper logging for debugging

### Must NOT Have
- [ ] Break existing SCOURT sync functionality
- [ ] Change database schema (case_level column already exists)
- [ ] Affect case creation for cases without court_case_number

---

## Task Flow

```
[Task 1: Fix Case Creation]
         │
         ▼
[Task 2: Fix SCOURT Sync]
         │
         ▼
[Task 3: Create Migration Script]
         │
         ▼
[Task 4: Verify & Test]
```

---

## Detailed TODOs

### Task 1: Fix Case Creation Endpoint

**File:** `/Users/hskim/luseed/app/api/admin/cases/route.ts`

**Changes:**
1. Import `inferCaseLevelFromType` from `lib/scourt/case-relations.ts`
2. After parsing `court_case_number`, determine `case_level` using the case type code
3. Add `case_level` to the insert payload

**Implementation:**

```typescript
// At top of file, add import:
import { inferCaseLevelFromType } from '@/lib/scourt/case-relations'

// Around line 361, after parsedCourtNumber:
// inferCaseLevelFromType accepts Korean case type codes (e.g., '나', '다', '가단', '느단')
const inferredCaseLevel = parsedCourtNumber?.valid && parsedCourtNumber.caseType
  ? inferCaseLevelFromType(parsedCourtNumber.caseType)
  : null;

// In the insert payload (around line 411), add:
case_level: inferredCaseLevel || null,  // 심급 (사건번호에서 추론)
```

**Note on Function Inputs:**
- `parseCaseNumber()` returns a parsed object with `caseType` as Korean code (e.g., '나', '다', '가단')
- `inferCaseLevelFromType()` accepts these Korean case type codes directly
- Example mappings: '나'→항소심, '다'→상고심, '가단'→1심

**Acceptance Criteria:**
- [ ] New cases with court_case_number get correct case_level
- [ ] New cases without court_case_number get null (not '1심' default)
- [ ] Case types like '나', '다', '느단', '므' correctly map to 항소심/상고심

---

### Task 2: Fix SCOURT Sync Case Level Extraction

**File:** `/Users/hskim/luseed/app/api/admin/scourt/sync/route.ts`

**Investigation Points:**
1. Verify `generalData?.caseLevelDesc` is being set correctly
2. Add fallback: if `caseLevelDesc` is missing, infer from case number

**Changes:**

```typescript
// At top of file, add import:
import { inferCaseLevelFromType } from '@/lib/scourt/case-relations';

// Around line 980-985, enhance case_level logic:
// 심급 결정: API 응답 우선, 없으면 사건번호에서 추론
let resolvedCaseLevel: string | null = null;
if (shouldSetCaseLevel) {
  if (generalData?.caseLevelDesc) {
    resolvedCaseLevel = generalData.caseLevelDesc;
  } else {
    // Fallback: infer from case type code (Korean codes like '나', '다', '가단')
    const parsed = parseCaseNumber(caseNumber);
    if (parsed.valid && parsed.caseType) {
      resolvedCaseLevel = inferCaseLevelFromType(parsed.caseType);
    }
  }
}
updateData.case_level = resolvedCaseLevel;
```

**Acceptance Criteria:**
- [ ] SCOURT sync sets correct case_level even when API doesn't return caseLevelDesc
- [ ] Logging shows case level determination process

---

### Task 3: Create Migration Script for Existing Cases

**New File:** `/Users/hskim/luseed/scripts/fix-case-levels.ts`

**Purpose:** Update existing cases that have incorrect '1심' values

**Execution:**
```bash
# Run with tsconfig-paths to resolve @/ aliases
npx tsx --tsconfig tsconfig.json scripts/fix-case-levels.ts
```

**Implementation:**

```typescript
/**
 * Fix case_level for existing cases based on their court_case_number
 *
 * NOTE: Uses @/ path aliases. Run with tsx and tsconfig.json:
 *   npx tsx --tsconfig tsconfig.json scripts/fix-case-levels.ts
 *
 * The functions parseCaseNumber() and inferCaseLevelFromType() accept
 * Korean case type codes such as '나', '다', '가단', '느단', '므' etc.
 */
import { createClient } from '@supabase/supabase-js';
import { parseCaseNumber } from '@/lib/scourt/case-number-utils';
import { inferCaseLevelFromType } from '@/lib/scourt/case-relations';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function main() {
  // Fetch all cases with court_case_number
  const { data: cases, error } = await supabase
    .from('legal_cases')
    .select('id, court_case_number, case_level')
    .not('court_case_number', 'is', null);

  if (error) {
    console.error('Error fetching cases:', error);
    return;
  }

  console.log(`Found ${cases?.length || 0} cases with court_case_number`);

  let updated = 0;
  let skipped = 0;

  for (const c of cases || []) {
    const parsed = parseCaseNumber(c.court_case_number);
    if (!parsed.valid || !parsed.caseType) {
      skipped++;
      continue;
    }

    // inferCaseLevelFromType accepts Korean case type codes (e.g., '나', '다', '가단')
    const correctLevel = inferCaseLevelFromType(parsed.caseType);

    // Skip if already correct
    if (c.case_level === correctLevel) {
      skipped++;
      continue;
    }

    // Update
    const { error: updateError } = await supabase
      .from('legal_cases')
      .update({ case_level: correctLevel })
      .eq('id', c.id);

    if (updateError) {
      console.error(`Error updating ${c.id}:`, updateError);
    } else {
      console.log(`Updated ${c.court_case_number}: ${c.case_level} -> ${correctLevel}`);
      updated++;
    }
  }

  console.log(`\nDone: ${updated} updated, ${skipped} skipped`);
}

main().catch(console.error);
```

**Acceptance Criteria:**
- [ ] Script runs without errors
- [ ] Correctly identifies and updates cases with wrong case_level
- [ ] Logs changes for audit trail

---

### Task 4: Verify Database Default Change

**File:** Consider updating database default

**Note:** The current default `'1심'` is problematic because:
1. Not all cases are 1심
2. Cases without court_case_number shouldn't have any case_level

**Recommendation:** Change default from `'1심'` to `NULL`

**Migration:**
```sql
ALTER TABLE legal_cases
ALTER COLUMN case_level SET DEFAULT NULL;
```

**Acceptance Criteria:**
- [ ] New cases without court_case_number have NULL case_level (not '1심')

---

## Commit Strategy

1. **Commit 1:** Fix case creation endpoint to set case_level
2. **Commit 2:** Fix SCOURT sync case level extraction with fallback
3. **Commit 3:** Add migration script for existing cases
4. **Commit 4:** Update database default (optional, separate PR)

---

## Success Criteria

1. **Functional:**
   - Cases display correct case level based on their case type code
   - 항소심 cases (나, 느단, 느합, 노, 누, etc.) show "항소심"
   - 상고심 cases (다, 므, 도, 두, etc.) show "상고심"
   - 1심 cases (가단, 가합, 드단, 고단, etc.) show "1심"

2. **Technical:**
   - No regression in existing functionality
   - Proper error handling and logging
   - Migration script can safely update existing data

3. **Verification:**
   - Manual test: Create new case with "2025나12345" → shows "항소심"
   - Manual test: Create new case with "2025다12345" → shows "상고심"
   - Run migration script on test data → existing cases corrected

---

## File References

| File | Purpose | Lines of Interest |
|------|---------|-------------------|
| `/Users/hskim/luseed/app/api/admin/cases/route.ts` | Case creation | 401-416 (insert) |
| `/Users/hskim/luseed/app/api/admin/scourt/sync/route.ts` | SCOURT sync | 980-985 (case_level update) |
| `/Users/hskim/luseed/lib/scourt/case-relations.ts` | Case level inference | 540-565 (getCaseLevel), 854-869 (inferCaseLevelFromType) |
| `/Users/hskim/luseed/lib/scourt/case-types.ts` | Case type mapping | 26-35 (CaseLevel type), 54-2316 (CASE_TYPES array) |
| `/Users/hskim/luseed/lib/scourt/api-client.ts` | API client | 1365-1375 (caseLevelDesc extraction) |
| `/Users/hskim/luseed/supabase/combined_schema_20260201.sql` | DB schema | 955 (case_level column) |
