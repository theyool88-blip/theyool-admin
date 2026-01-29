# Party Schema and Input System Improvement Plan

**Created**: 2026-01-28
**Status**: Approved
**Revision**: 6 (Schema state corrected, Data flow verification added)

---

## REVISION 6 CORRECTIONS (2026-01-28)

### Critical Corrections Based on Actual Schema Analysis

#### Correction 1: case_clients Table EXISTS

**Previous Assumption (WRONG):** Plan assumed `case_clients` table doesn't exist.

**Actual State (combined_schema_20260201.sql line 1015-1034):**
```sql
CREATE TABLE IF NOT EXISTS case_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  case_id UUID NOT NULL REFERENCES legal_cases(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  linked_party_id UUID,
  is_primary_client BOOLEAN DEFAULT FALSE,
  retainer_fee BIGINT,
  success_fee_terms TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(case_id, client_id)
);
```

**Impact:** Phase 0 decisions must be revised - no need to create `case_clients`, only verify production state.

#### Correction 2: receivables_summary Already Uses case_clients

**Previous Assumption (WRONG):** Plan claimed both views need recreation.

**Actual State (combined_schema_20260201.sql line 3370-3416):**
```sql
CREATE OR REPLACE VIEW receivables_summary AS
SELECT
  -- ...
  COALESCE((
    SELECT SUM(cc.retainer_fee)
    FROM case_clients cc   -- Already uses case_clients!
    WHERE cc.case_id = lc.id
  ), 0) as total_fee,
  -- ...
```

**Impact:** `receivables_summary` does NOT need modification.

#### Correction 3: unified_calendar Still Uses is_our_client

**Actual State (combined_schema_20260201.sql line 3193-3197):**
```sql
  (
    SELECT party_name
    FROM case_parties cp
    WHERE cp.case_id = ch.case_id AND cp.is_our_client = true  -- Still uses legacy!
    LIMIT 1
  )::TEXT AS our_client_name,
```

**Impact:** ONLY `unified_calendar` needs update (to use `case_clients` instead).

#### Correction 4: mapScourtPartyType Workaround Note

**Current workaround (types/case-party.ts line 253-256):**
```typescript
"항소인": "plaintiff",
"피항소인": "defendant",
"상고인": "plaintiff",
"피상고인": "defendant",
```

These are mapped to plaintiff/defendant because `appellant`/`appellee` are not in PartyType.
After T-NEW-1, these mappings should be updated to use the correct types.

---

## PHASE 0.1: DATA FLOW VERIFICATION (NEW - User Requested)

### Objective
사용자가 명시적으로 요청: "데이터를 쫓아가면서 입력 부분 및 처리 부분 하나하나 체크"

### T0.1: Document Party Data Flow (Entry Points)

**Task:** Map all party data entry points and their handlers.

| Entry Point | File | Handler | Notes |
|-------------|------|---------|-------|
| SCOURT Sync | `lib/scourt/party-sync.ts` | `syncPartiesFromScourtServer()` | Primary data source |
| Manual Entry | `components/CasePartiesSection.tsx` | `handleAddParty()` | Non-linked cases |
| Case Creation | `app/api/admin/cases/route.ts` | POST handler | Initial parties |
| Party Edit | `app/api/admin/cases/[id]/parties/route.ts` | PUT handler | Party updates |

**Verification Checklist:**
- [ ] Each entry point traced to DB write
- [ ] Data transformations documented
- [ ] Validation logic identified
- [ ] Error handling paths documented

### T0.2: Document Party Data Flow (Query Points)

**Task:** Map all party data query points.

| Query Point | File | Function | Notes |
|-------------|------|----------|-------|
| Case Detail | `components/CaseDetail.tsx` | `fetchCaseParties()` | Main display |
| Calendar View | `unified_calendar` VIEW | Subquery on case_parties | Our client name |
| Receivables | `receivables_summary` VIEW | Joins case_clients | Client info |
| Case List | `app/api/admin/cases/route.ts` | Inline query | Party summary |

**Verification Checklist:**
- [ ] Each query point returns expected data shape
- [ ] Null handling verified
- [ ] Performance (indexes) confirmed
- [ ] Legacy field usage identified

### T0.3: Verify is_our_client → case_clients Migration Completeness

**Task:** Ensure all data writes use new schema, all reads handle both.

**SQL Verification:**
```sql
-- Check if any records still use is_our_client without case_clients link
SELECT COUNT(*) FROM case_parties cp
WHERE cp.is_our_client = true
  AND NOT EXISTS (
    SELECT 1 FROM case_clients cc
    WHERE cc.linked_party_id = cp.id
  );

-- Expected: 0 (all is_our_client=true parties should have case_clients)
```

**Acceptance Criteria:**
- Data flow diagram created
- All entry/query points verified
- Migration completeness confirmed
- Gaps documented for Phase 0.5

---

## REVISION 5 ADDITIONS (2026-01-28)

### New Issues Discovered

#### Issue A: DB party_type ENUM vs TypeScript PartyType Mismatch

**DB party_type ENUM (8 values):**
```sql
CREATE TYPE party_type AS ENUM (
  'plaintiff', 'defendant', 'creditor', 'debtor',
  'applicant', 'respondent', 'appellant', 'appellee'
);
```

**TypeScript PartyType (15 values):**
```typescript
export type PartyType =
  | "plaintiff" | "defendant" | "creditor" | "debtor"
  | "applicant" | "respondent" | "third_debtor"
  | "actor" | "victim" | "assistant" | "juvenile" | "investigator"
  | "accused" | "crime_victim" | "related";
```

**Missing in DB:** `third_debtor`, `actor`, `victim`, `assistant`, `juvenile`, `investigator`, `accused`, `crime_victim`, `related`

**Missing in TypeScript:** `appellant`, `appellee`

**CRITICAL NOTE:** `case_parties.party_type` is VARCHAR(30), not ENUM. This provides flexibility but lacks DB-level validation.

#### Issue B: Duplicate getPartySide Definitions

**Location 1:** `/app/api/admin/cases/[id]/parties/route.ts` (lines 8-28)
```typescript
const PLAINTIFF_SIDE_TYPES = new Set(["plaintiff", "creditor", "applicant", "actor"]);
const DEFENDANT_SIDE_TYPES = new Set(["defendant", "debtor", "respondent", "third_debtor", "accused", "juvenile"]);
```

**Location 2:** `/lib/scourt/party-sync.ts` (lines 43-51)
```typescript
const PLAINTIFF_SIDE_TYPES: PartyType[] = ['plaintiff', 'creditor', 'applicant', 'actor'];
const DEFENDANT_SIDE_TYPES: PartyType[] = ['defendant', 'debtor', 'respondent', 'third_debtor', 'accused', 'juvenile'];
```

**Missing types in both:** `victim`, `assistant`, `investigator`, `crime_victim`, `related`, `appellant`, `appellee`

#### Issue C: Legacy client_role/opponent_name Field References

**CaseEditForm.tsx LegalCase interface (lines 41-42):** Still has `client_role`, `opponent_name`
**CaseDetail.tsx (lines 130-131, 1518-1520, 1629-1633, etc.):** Still references `client_role`

These fields were removed from `legal_cases` table and should use `case_parties`/`case_clients` instead.

### New Tasks for Revision 5

#### T-NEW-1: Sync PartyType with DB ENUM considerations

**File:** `/types/case-party.ts`

**Changes:**
1. Add `appellant`, `appellee` to TypeScript PartyType
2. Add corresponding entries to `PARTY_TYPE_LABELS`
3. Add corresponding entries to `OPPOSITE_PARTY_TYPE`

```typescript
export type PartyType =
  | "plaintiff" | "defendant" | "creditor" | "debtor"
  | "applicant" | "respondent" | "third_debtor"
  | "actor" | "victim" | "assistant" | "juvenile" | "investigator"
  | "accused" | "crime_victim" | "related"
  | "appellant" | "appellee";  // ADDED

export const PARTY_TYPE_LABELS: Record<PartyType, string> = {
  // ... existing
  appellant: "항소인",    // ADDED
  appellee: "피항소인",   // ADDED
};

export const OPPOSITE_PARTY_TYPE: Record<PartyType, PartyType> = {
  // ... existing
  appellant: "appellee",  // ADDED
  appellee: "appellant",  // ADDED
};
```

**ALSO UPDATE mapScourtPartyType (line 253-256):**
```typescript
// BEFORE (workaround):
"항소인": "plaintiff",
"피항소인": "defendant",

// AFTER (correct):
"항소인": "appellant",
"피항소인": "appellee",
```

#### T-NEW-2: Centralize getPartySide function

**File:** `/types/case-party.ts`

**Add new exports:**
```typescript
// Plaintiff side party types
export const PLAINTIFF_SIDE_TYPES: ReadonlySet<PartyType> = new Set([
  'plaintiff', 'creditor', 'applicant', 'actor', 'appellant', 'investigator'
]);

// Defendant side party types
export const DEFENDANT_SIDE_TYPES: ReadonlySet<PartyType> = new Set([
  'defendant', 'debtor', 'respondent', 'third_debtor', 'accused',
  'juvenile', 'appellee', 'victim', 'crime_victim'
]);

// Neutral types (no side)
export const NEUTRAL_PARTY_TYPES: ReadonlySet<PartyType> = new Set([
  'related', 'assistant'
]);

export function getPartySide(partyType: PartyType): 'plaintiff' | 'defendant' | null {
  if (PLAINTIFF_SIDE_TYPES.has(partyType)) return 'plaintiff';
  if (DEFENDANT_SIDE_TYPES.has(partyType)) return 'defendant';
  return null;
}
```

**Verification Command:**
```bash
# After implementation, verify single source:
grep -rn "PLAINTIFF_SIDE_TYPES\|DEFENDANT_SIDE_TYPES\|getPartySide" --include="*.ts" --include="*.tsx" | wc -l
# Expected: References in types/case-party.ts + import statements only
```

#### T-NEW-3: Update parties/route.ts to use centralized function

**File:** `/app/api/admin/cases/[id]/parties/route.ts`

**Changes:**
- Remove lines 8-28 (local PLAINTIFF_SIDE_TYPES, DEFENDANT_SIDE_TYPES, getPartySide)
- Add import: `import { getPartySide, PLAINTIFF_SIDE_TYPES, DEFENDANT_SIDE_TYPES } from '@/types/case-party'`

#### T-NEW-4: Update party-sync.ts to use centralized function

**File:** `/lib/scourt/party-sync.ts`

**Changes:**
- Remove lines 43-51 (local PLAINTIFF_SIDE_TYPES, DEFENDANT_SIDE_TYPES, getPartySide)
- Update import to include: `getPartySide, PLAINTIFF_SIDE_TYPES, DEFENDANT_SIDE_TYPES`

#### T-NEW-5: Add deprecated annotations for legacy field references

**Files to update with specific line numbers:**

**`/components/CaseEditForm.tsx` (lines 41-42):**
```typescript
// BEFORE:
interface LegalCase {
  // ...
  client_role?: string;
  opponent_name?: string;
  // ...
}

// AFTER:
interface LegalCase {
  // ...
  /** @deprecated Use case_clients table instead. Will be removed in future version. */
  client_role?: string;
  /** @deprecated Use case_parties table instead. Will be removed in future version. */
  opponent_name?: string;
  // ...
}
```

**`/components/CaseDetail.tsx` (lines 130-131):**
```typescript
// Add deprecation comment before usage:
/** @deprecated - client_role is legacy. Use case_clients for client info. */
```

**Note:** Full migration away from these fields is tracked separately. For now, add deprecation annotations.

### Updated Task Flow (Revision 6)

```
PHASE 0.1 (NEW - Data Flow Verification):
  T0.1 (Document entry points)
    ↓
  T0.2 (Document query points)
    ↓
  T0.3 (Verify migration completeness)

PHASE 0.5 (REVISED - Schema State Verification):
  T0.5 → T0.6 → T0.7 (Corrected for actual state)

PHASE 1 (API Parsing):
  T1.1 → T1.2 → T1.3 → T1.4

PHASE 1.5 (Type Sync):
  T-NEW-1 (PartyType sync + mapScourtPartyType update)
    ↓
  T-NEW-2 (Centralize getPartySide)
    ↓
  T-NEW-3 (Update parties/route.ts)
    ↓
  T-NEW-4 (Update party-sync.ts)
    ↓
  T-NEW-5 (Deprecation annotations)

PHASE 2 (Schema):
  T2.1 → T2.2 → T2.3

... (rest of phases unchanged)
```

### Updated Success Criteria

| Criterion | Measurement |
|-----------|-------------|
| Data flow documented | Entry/query point diagram exists in `.omc/notes/` |
| PartyType/ENUM sync | TypeScript PartyType contains all required values |
| mapScourtPartyType updated | "항소인" maps to "appellant", not "plaintiff" |
| getPartySide centralized | Single source in types/case-party.ts |
| No duplicate side definitions | grep confirms only one definition location |
| Type check passes | `npx tsc --noEmit` success |
| ESLint passes | No new errors |

---
### END REVISION 6 CORRECTIONS
---

## 1. Context

### 1.1 Original Requirements Summary

사용자가 사건을 입력할 때 세 가지 시나리오가 존재:
1. 대법원 사건연동이 되는 사건 (SCOURT 연동)
2. 사건연동이 되지 않는 사건 (수동 입력)
3. 나중에 연동이 되는 사건 (수동 입력 후 연동)

**당사자내용 구조 요구사항:**
- 역할별 구분: 원고, 피고, 보조참가, 사건본인 등
- 다수 당사자 시 번호 부여: 1. 홍길동, 2. 김철수
- 역할 및 번호 모두 저장 필요
- 원본에는 "성"만 나오고 이름은 마스킹됨 (홍OO)

**의뢰인 지정 요구사항:**
- 의뢰인의 이름 입력 (마스킹 해제)
- 다른 당사자들의 이름도 선택적 입력 가능
- 같은 측 당사자는 복수 의뢰인 가능 (원고1, 원고2 모두 의뢰인)
- 반대편 당사자는 동시 의뢰인 불가 (원고와 피고 동시 의뢰인 X)

**자동 처리:**
- 의뢰인 입력 시 자동으로 의뢰인/상대방 구분
- 성씨가 같은 경우 확인 절차 필요

**대리인 관계:**
- 대리인이 어느 당사자를 대리하는지 스키마에 저장

### 1.2 Current System Analysis (REVISED for Revision 6)

#### SCHEMA STATE SUMMARY (Verified from combined_schema_20260201.sql)

| Component | Status | Line Reference | Notes |
|-----------|--------|----------------|-------|
| `case_clients` table | **EXISTS** | 1015-1034 | M:N case-client relationship |
| `case_parties.is_our_client` | EXISTS (legacy) | ~1024 in parties section | Should be deprecated |
| `unified_calendar` view | Uses `is_our_client` | 3193-3197 | **NEEDS UPDATE** |
| `receivables_summary` view | Uses `case_clients` | 3378-3405 | **Already migrated** |
| `legal_cases.primary_client_name` | TBD | - | Needs verification |

#### Migration Status Assessment

**Migration `20260220_unify_parties_and_case_clients.sql` (in backup):**
- Some parts APPLIED: `case_clients` table exists
- Some parts PENDING: `unified_calendar` still uses `is_our_client`

**Actual Production State Verification Needed:**
```sql
-- Verify if is_our_client column still exists in case_parties
SELECT column_name FROM information_schema.columns
WHERE table_name = 'case_parties' AND column_name = 'is_our_client';

-- Verify unified_calendar view definition
SELECT pg_get_viewdef('unified_calendar'::regclass, true);
```

#### Current Issues Identified

1. **SCOURT API 응답 파싱 불완전 (CRITICAL)**
   - `lib/scourt/api-client.ts`에서 `btprtRnk`(순번), `btprtDvsCd`(구분코드) 미파싱
   - Raw SCOURT 응답(`dlt_btprtCttLst`)에는 해당 필드 존재하나 `CaseGeneralData.parties`에 미포함
   - 대리인 응답(`dlt_agntCttLst`)의 `btprtDvsCd`, `btprtRltnCtt` 필드도 미파싱
   - `CaseGeneralData.representatives`에 당사자 매핑 필드 부재

2. **대리인-당사자 연결 부재**
   - `representatives` JSONB가 첫 번째 당사자에만 저장됨
   - 대리인이 어느 당사자를 대리하는지 명확하지 않음
   - SCOURT API의 `btprtDvsCd` (당사자구분코드)로 연결 가능하나 미활용

3. **당사자 번호(순번) 처리 불완전**
   - `party_order`가 존재하나 SCOURT의 `btprtRnk`와 매핑 안됨
   - "1. 김OO"에서 번호와 이름 분리/재조합 로직이 UI에만 존재

4. **의뢰인 확인 절차 미구현**
   - 성씨가 같은 경우 어떤 당사자가 의뢰인인지 확인 필요
   - 현재는 당사자 클릭 후 수동 연결만 가능

5. **비연동 사건 당사자 입력 미흡**
   - SCOURT 연동 없는 사건의 당사자 수동 입력 UX 미흡
   - 나중에 연동될 때 기존 수동 입력과 병합 로직 존재하나 개선 필요

6. **unified_calendar 뷰 정합성 (NEW)**
   - `unified_calendar`가 여전히 `is_our_client = true` 조건 사용
   - `case_clients` 기반으로 업데이트 필요

---

## 2. Work Objectives

### 2.1 Core Objective

당사자 스키마를 개선하여 SCOURT 데이터의 구조(역할별 구분, 번호, 대리인 관계)를 정확히 반영하고, 의뢰인 지정 시 사용자 확인 절차를 포함한 입력 시스템을 구축한다.

### 2.2 Deliverables

| # | Deliverable | Priority |
|---|-------------|----------|
| 0.1 | **데이터 흐름 검증 및 문서화** | CRITICAL |
| 0 | **스키마 상태 확인 및 unified_calendar 뷰 업데이트** | CRITICAL |
| 1 | API Client 파싱 개선: btprtRnk, btprtDvsCd, btprtRltnCtt 추출 | CRITICAL |
| 2 | 스키마 개선: 대리인-당사자 연결 | HIGH |
| 3 | 스키마 개선: 당사자 순번(rank) 추가 | MEDIUM |
| 4 | 의뢰인 지정 확인 UI (성씨 동일 시) | HIGH |
| 5 | 비연동 사건 당사자 입력 개선 | MEDIUM |
| 6 | SCOURT 동기화 개선: 대리인-당사자 매핑 | HIGH |
| 7 | **레거시 코드 정리 (스크립트 및 문서)** | HIGH |

### 2.3 Definition of Done

- [ ] 데이터 흐름 문서화 완료: 입력/조회 포인트 모두 문서화됨
- [ ] unified_calendar 뷰가 case_clients 기반으로 업데이트됨
- [ ] receivables_summary 뷰 확인됨 (이미 case_clients 사용 중)
- [ ] SCOURT API 응답에서 btprtRnk, btprtDvsCd가 파싱되어 CaseGeneralData에 포함됨
- [ ] 대리인 응답에서 btprtDvsCd, btprtRltnCtt가 파싱되어 당사자 매핑에 사용됨
- [ ] 대리인이 어느 당사자를 대리하는지 스키마에 저장되고 UI에 표시됨
- [ ] 당사자 순번이 SCOURT 원본(`btprtRnk`)과 일치하게 저장됨
- [ ] 의뢰인 지정 시 성씨가 같은 당사자가 있으면 확인 모달 표시
- [ ] 비연동 사건에서도 역할별 당사자를 쉽게 입력 가능
- [ ] 모든 기존 테스트 통과, 새 기능에 대한 테스트 추가
- [ ] 레거시 스크립트에서 `is_our_client` 참조 제거/수정됨
- [ ] 관련 문서가 새 스키마 반영하여 업데이트됨
- [ ] `grep -r "is_our_client"` 결과에 코드 참조 없음 (스키마 제외)

---

## 3. Guardrails

### 3.1 Must Have

- 기존 데이터 마이그레이션 (하위 호환성)
- SCOURT 동기화 시 기존 의뢰인 정보 보존
- 성능 저하 없음 (인덱스 추가)
- Lazy re-sync 전략: 기존 데이터는 다음 SCOURT 동기화 시 자연스럽게 채워짐

### 3.2 Must NOT Have

- case_parties 테이블 구조 완전 변경 (기존 컬럼 유지)
- case_clients 테이블 변경 (의뢰인 연결은 그대로)
- 다른 시스템에 영향을 미치는 breaking change
- 강제 bulk 마이그레이션 (기존 데이터 자연 동기화로 처리)

### 3.3 Rollback Strategy

1. **Phase 0.1 (Data Flow)**: 문서화만, 롤백 불필요
2. **Phase 0.5 (View Update)**: 이전 뷰 정의 백업 후 적용, 롤백 시 복원
3. **Phase 1 (API Client)**: 타입 확장만이므로 이전 버전과 호환 (새 필드는 optional)
4. **Phase 2 (Schema)**: ALTER TABLE ADD COLUMN은 DROP으로 롤백 가능
5. **Phase 3 (Sync Logic)**: 기존 로직 보존, 새 로직은 추가적이므로 조건부 비활성화 가능
6. **Phase 4 (UI)**: 컴포넌트 단위 롤백 가능

---

## 4. Technical Design

### 4.0 Data Flow Verification (Phase 0.1 - NEW)

#### 4.0.0 Data Flow Documentation Structure

Create `.omc/notes/party-data-flow.md` with:

1. **Entry Points Table**: All places where party data is written
2. **Query Points Table**: All places where party data is read
3. **Transformation Map**: How data changes between layers
4. **Gap Analysis**: Identified inconsistencies

#### 4.0.0.1 Entry Points to Document

| Entry Point | Handler Location | Data Transformation |
|-------------|------------------|---------------------|
| SCOURT Sync | `lib/scourt/party-sync.ts:syncPartiesFromScourtServer()` | Raw SCOURT → CaseParty |
| Manual Add | `app/api/admin/cases/[id]/parties/route.ts:POST` | Form data → CaseParty |
| Party Update | `app/api/admin/cases/[id]/parties/route.ts:PUT` | Partial update → CaseParty |
| Client Link | `app/api/admin/cases/[id]/parties/route.ts:linkClient()` | Client → CaseClient + Party |

#### 4.0.0.2 Query Points to Document

| Query Point | Source Location | Data Shape |
|-------------|-----------------|------------|
| Case Detail | `components/CaseDetail.tsx:fetchCaseParties()` | CaseParty[] |
| Parties Section | `components/CasePartiesSection.tsx` | CaseParty[] with representatives |
| Calendar | `unified_calendar` VIEW | party_name via subquery |
| Receivables | `receivables_summary` VIEW | client_name via case_clients |

### 4.0.5 Migration State Verification (REVISED)

#### 4.0.5.1 Actual State Verification SQL

**Run in production DB:**
```sql
-- 1. Verify case_clients table exists (EXPECTED: true)
SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'case_clients');

-- 2. Verify case_parties columns
SELECT column_name FROM information_schema.columns
WHERE table_name = 'case_parties'
ORDER BY ordinal_position;

-- 3. Check unified_calendar view for is_our_client usage
SELECT pg_get_viewdef('unified_calendar'::regclass, true) LIKE '%is_our_client%' as uses_legacy;

-- 4. Check receivables_summary view (EXPECTED: uses case_clients, not is_our_client)
SELECT pg_get_viewdef('receivables_summary'::regclass, true) LIKE '%case_clients%' as uses_case_clients;
```

#### 4.0.5.2 Decision Matrix

| Query Result | Action |
|--------------|--------|
| unified_calendar uses is_our_client | Apply T0.6 (view update) |
| unified_calendar uses case_clients | Skip T0.6 |
| case_clients missing | ERROR - escalate (should not happen per schema) |

### 4.0.6 Update unified_calendar View Only

**File:** New migration `supabase/migrations/20260128300000_update_unified_calendar_view.sql`

```sql
-- Update unified_calendar to use case_clients instead of is_our_client
-- Note: receivables_summary already uses case_clients (no change needed)

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
  ch.case_id::TEXT AS case_id,
  lc.tenant_id::TEXT AS tenant_id,
  -- 출석변호사 정보
  COALESCE(ch.attending_lawyer_id, lc.assigned_to)::TEXT AS attending_lawyer_id,
  COALESCE(tm_attending.display_name, tm_assigned.display_name)::TEXT AS attending_lawyer_name,
  -- 화상기일 정보
  ch.video_participant_side::TEXT AS video_participant_side,
  -- 당사자 정보 (의뢰인) - UPDATED: use case_clients instead of is_our_client
  (
    SELECT c.name
    FROM case_clients cc
    JOIN clients c ON cc.client_id = c.id
    WHERE cc.case_id = ch.case_id AND cc.is_primary_client = true
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

-- [Rest of the view definition remains the same - DEADLINE, DOCUMENT, etc.]
-- Copy from existing combined_schema_20260201.sql lines 3211-3368
;

COMMENT ON VIEW unified_calendar IS '통합 캘린더 뷰 - case_clients 기반';
```

**Note:** Full view definition should copy lines 3211-3368 from combined_schema for DEADLINE, DOCUMENT, TASK, REMINDER sections.

### 4.1 API Client Parsing Updates (Phase 1)

#### 4.1.1 CaseGeneralData.parties 타입 확장

**File**: `lib/scourt/api-client.ts` (line ~122-127)

현재 구조:
```typescript
parties?: Array<{
  btprNm: string;        // 당사자명
  btprDvsNm: string;     // 당사자구분 (원고, 피고 등)
  adjdocRchYmd?: string; // 판결도달일
  indvdCfmtnYmd?: string; // 확정일
}>;
```

개선된 구조:
```typescript
parties?: Array<{
  btprNm: string;         // 당사자명
  btprDvsNm: string;      // 당사자구분 (원고, 피고 등)
  adjdocRchYmd?: string;  // 판결도달일
  indvdCfmtnYmd?: string; // 확정일
  // 새로운 필드 (SCOURT raw에서 추출)
  btprtRnk?: number;      // 당사자 순번 (같은 역할 내 순서)
  btprtDvsCd?: string;    // 당사자구분코드 (예: "10" = 청구인, "20" = 상대방)
}>;
```

#### 4.1.2 CaseGeneralData.representatives 타입 확장

**File**: `lib/scourt/api-client.ts` (line ~129-134)

현재 구조:
```typescript
representatives?: Array<{
  agntDvsNm: string;     // 구분 (원고 소송대리인 등)
  agntNm: string;        // 대리인명
  jdafrCorpNm?: string;  // 법무법인명
}>;
```

개선된 구조:
```typescript
representatives?: Array<{
  agntDvsNm: string;      // 구분 (원고 소송대리인 등)
  agntNm: string;         // 대리인명
  jdafrCorpNm?: string;   // 법무법인명
  // 새로운 필드 (SCOURT raw에서 추출)
  btprtDvsCd?: string;    // 대리하는 당사자의 구분코드 (예: "10")
  btprtRltnCtt?: string;  // 당사자관계 (예: "  소송대리인")
}>;
```

#### 4.1.3 파싱 로직 업데이트

**File**: `lib/scourt/api-client.ts` (line ~1150 parties 파싱 부분)

```typescript
// 기존: btprNm, btprDvsNm, adjdocRchYmd, indvdCfmtnYmd만 추출
// 개선: btprtRnk, btprtDvsCd도 추출

result.parties = partiesList.map((p, idx: number) => {
  // ... 기존 partyLabel 추론 로직 ...

  return {
    btprNm: p.btprNm || p.btprtNm || '',
    btprDvsNm: partyLabel || '',
    adjdocRchYmd: p.adjdocRchYmd,
    indvdCfmtnYmd: p.indvdCfmtnYmd,
    // 새로운 필드
    btprtRnk: p.btprtRnk ? parseInt(String(p.btprtRnk), 10) : undefined,
    btprtDvsCd: p.btprtDvsCd || p.btprtStndngCd || undefined,  // 코드 필드명 확인 필요
  };
});
```

**File**: `lib/scourt/api-client.ts` (line ~1214 representatives 파싱 부분)

```typescript
// 기존: agntDvsNm, agntNm, jdafrCorpNm만 추출
// 개선: btprtDvsCd, btprtRltnCtt도 추출

interface AgentItem {
  agntDvsNm?: string;
  agntNm?: string;
  jdafrCorpNm?: string;
  btprtDvsCd?: string;    // 추가
  btprtRltnCtt?: string;  // 추가
}

result.representatives = agentsList.map((a) => ({
  agntDvsNm: a.agntDvsNm || '',
  agntNm: a.agntNm || '',
  jdafrCorpNm: a.jdafrCorpNm || '',
  // 새로운 필드
  btprtDvsCd: a.btprtDvsCd || undefined,
  btprtRltnCtt: a.btprtRltnCtt || undefined,
}));
```

### 4.2 Schema Changes (Phase 2)

#### 4.2.1 case_parties 테이블 수정

```sql
-- 1. 당사자 순번 컬럼 추가 (SCOURT btprtRnk)
ALTER TABLE case_parties
  ADD COLUMN IF NOT EXISTS scourt_rank INTEGER;

COMMENT ON COLUMN case_parties.scourt_rank IS 'SCOURT 당사자 순번 (btprtRnk) - 같은 역할 내 순서';

-- 2. 당사자 지위 코드 추가 (대리인 매핑용)
ALTER TABLE case_parties
  ADD COLUMN IF NOT EXISTS scourt_dvs_cd VARCHAR(10);

COMMENT ON COLUMN case_parties.scourt_dvs_cd IS 'SCOURT 당사자구분코드 (btprtDvsCd) - 대리인 연결에 사용';
```

#### 4.2.2 representatives JSONB 구조 개선

현재 구조:
```typescript
interface PartyRepresentative {
  name: string;
  type_label: string | null;  // "원고 소송대리인"
  law_firm: string | null;
  is_our_firm: boolean;
  scourt_synced: boolean;
}
```

개선된 구조:
```typescript
interface PartyRepresentative {
  name: string;
  type_label: string | null;     // "청구인 소송대리인" (SCOURT 원본)
  law_firm: string | null;
  is_our_firm: boolean;
  scourt_synced: boolean;
  // 새로운 필드
  party_dvs_cd: string | null;   // 대리하는 당사자의 btprtDvsCd (예: "10" = 청구인)
  party_relation: string | null; // btprtRltnCtt (예: "  소송대리인")
}
```

#### 4.2.3 대리인 저장 방식 변경

현재: 모든 대리인을 첫 번째 당사자에 저장

개선: 각 당사자별로 해당하는 대리인만 저장
- SCOURT API 응답의 `btprtDvsCd`로 당사자와 직접 매칭
- Fallback: `agntDvsNm` (예: "청구인 소송대리인")에서 당사자 구분 추출

### 4.3 API Changes (Phase 3)

#### 4.3.1 SCOURT 동기화 (lib/scourt/party-sync.ts)

```typescript
// syncPartiesFromScourtServer 함수 수정
// 1. scourt_rank 저장 추가 (CaseGeneralData.parties[].btprtRnk에서)
// 2. scourt_dvs_cd 저장 추가 (CaseGeneralData.parties[].btprtDvsCd에서)
// 3. 대리인을 해당 당사자에 연결 (CaseGeneralData.representatives[].btprtDvsCd로 매핑)

// 대리인 → 당사자 매핑 로직
function mapRepresentativeToParty(
  rep: { agntDvsNm: string; btprtDvsCd?: string },
  parties: { scourt_dvs_cd: string }[]
): number | null {
  // 방법 1: btprtDvsCd 직접 매칭 (우선)
  if (rep.btprtDvsCd) {
    const idx = parties.findIndex(p => p.scourt_dvs_cd === rep.btprtDvsCd);
    if (idx >= 0) return idx;
  }

  // 방법 2: agntDvsNm에서 당사자 유형 추출 (fallback)
  // "청구인 소송대리인" → "청구인"
  const labelMatch = rep.agntDvsNm.match(/^([가-힣]+)\s/);
  if (labelMatch) {
    const partyLabel = labelMatch[1];
    const idx = parties.findIndex(p =>
      p.party_type_label?.includes(partyLabel)
    );
    if (idx >= 0) return idx;
  }

  return null;
}
```

#### 4.3.2 당사자 API (app/api/admin/cases/[id]/parties/route.ts)

변경 사항 없음 - 기존 API 구조 유지

### 4.4 UI Changes (Phase 4)

#### 4.4.1 의뢰인 확인 모달 (성씨 동일 시)

```tsx
// components/ClientMatchConfirmModal.tsx
interface ClientMatchCandidate {
  partyId: string;
  partyName: string;      // "1. 김OO"
  partyTypeLabel: string; // "청구인"
  scourt_rank: number;
}

interface Props {
  isOpen: boolean;
  clientName: string;     // 사용자가 입력한 "김철수"
  candidates: ClientMatchCandidate[];
  onConfirm: (partyId: string) => void;
  onCancel: () => void;
}
```

표시 조건:
1. 의뢰인 이름의 성씨가 2명 이상의 당사자와 일치
2. 모두 같은 측(원고측/피고측) 당사자인 경우에만 표시
3. 반대측이면 자동으로 구분 가능

#### 4.4.2 CasePartiesSection.tsx 대리인 표시 변경 (DETAILED)

**File**: `/Users/hskim/luseed/components/CasePartiesSection.tsx`

**제거할 코드 (line 339-387):**
```tsx
{/* 대리인 - 각 당사자의 representatives JSONB에서 표시 */}
{(() => {
  // 모든 당사자의 대리인을 구분별로 그룹화
  const allReps: Array<PartyRepresentative & { partyLabel: string }> = []
  realParties.forEach(party => {
    const reps = party.representatives || []
    reps.forEach(rep => {
      allReps.push({
        ...rep,
        partyLabel: rep.type_label || '소송대리인'
      })
    })
  })

  // 구분별 그룹화
  const repGroups = allReps.reduce((groups, rep) => {
    const label = rep.partyLabel
    if (!groups[label]) groups[label] = []
    groups[label].push(rep)
    return groups
  }, {} as Record<string, Array<PartyRepresentative & { partyLabel: string }>>)

  return Object.entries(repGroups).map(([label, groupReps]) =>
    groupReps.map((rep, idx) => (
      <tr key={`${label}-${idx}`} className="hover:bg-[var(--bg-hover)]">
        {idx === 0 && (
          <td
            className="px-5 py-3 text-sm text-[var(--text-tertiary)] align-top border-r border-[var(--border-subtle)]"
            rowSpan={groupReps.length}
          >
            {label}
          </td>
        )}
        <td className="px-5 py-3 text-sm text-[var(--text-primary)]">
          <span className={rep.is_our_firm ? 'font-medium' : ''}>
            {rep.name}
          </span>
          {rep.law_firm && (
            <span className="ml-1.5 text-xs text-[var(--text-tertiary)]">({rep.law_firm})</span>
          )}
          {rep.is_our_firm && (
            <span className="ml-1.5 text-xs text-[var(--sage-primary)]">(당 사무소)</span>
          )}
        </td>
        <td className="px-3 py-3 text-center" />
      </tr>
    ))
  )
})()}
```

**추가할 코드 (각 PartyTableRow 렌더링 직후, line 336 이후):**
```tsx
{/* 당사자 대리인 서브행 */}
{party.representatives && party.representatives.length > 0 && (
  <tr key={`${party.id}-reps`} className="bg-[var(--bg-secondary)]">
    <td></td>
    <td colSpan={2} className="px-5 py-1 text-sm text-[var(--text-secondary)]">
      {party.representatives.map((rep, repIdx) => (
        <div key={repIdx} className="pl-4 flex items-center gap-2 py-0.5">
          <span className="text-[var(--text-tertiary)]">+</span>
          <span className={rep.is_our_firm ? 'font-medium' : ''}>
            {rep.type_label || '대리인'}: {rep.name}
          </span>
          {rep.law_firm && (
            <span className="text-xs text-[var(--text-tertiary)]">
              ({rep.law_firm})
            </span>
          )}
          {rep.is_our_firm && (
            <span className="ml-1 text-xs text-[var(--sage-primary)]">
              (당 사무소)
            </span>
          )}
        </div>
      ))}
    </td>
  </tr>
)}
```

**수정 결과 시각화:**
```
기존:
┌──────────┬────────────────────┬────┐
│ 청구인   │ 1. 김OO            │    │
│          │ 2. 박OO            │    │
├──────────┼────────────────────┼────┤
│ 상대방   │ 1. 윤OO            │    │
├──────────┼────────────────────┼────┤
│ 청구인   │ 임은지 (법무법인)  │    │  <-- 대리인 별도 섹션
│ 소송대리인│                    │    │
└──────────┴────────────────────┴────┘

개선:
┌──────────┬────────────────────┬────┐
│ 청구인   │ 1. 김OO            │    │
│          │   └ 소송대리인: 임은지 (법무법인) (당 사무소)
│          │ 2. 박OO            │    │
│          │   └ 소송대리인: 임은지 (법무법인) (당 사무소)
├──────────┼────────────────────┼────┤
│ 상대방   │ 1. 윤OO            │    │
│          │   └ 소송대리인: 법무법인 와이케이
└──────────┴────────────────────┴────┘
```

#### 4.4.3 CaseDetail.tsx 연동 코드 (DETAILED)

**File**: `/Users/hskim/luseed/components/CaseDetail.tsx`

**1. 상태 추가 (line ~390 근처, `caseClients` 상태 선언 이후):**
```typescript
// ClientMatchConfirmModal 상태
const [showClientMatchModal, setShowClientMatchModal] = useState(false);
const [clientMatchCandidates, setClientMatchCandidates] = useState<{
  partyId: string;
  partyName: string;
  partyTypeLabel: string;
  scourt_rank: number;
}[]>([]);
const [pendingClientLink, setPendingClientLink] = useState<{
  clientId: string;
  clientName: string;
} | null>(null);
```

**2. 성씨 확인 로직 (새 함수, line ~407 이후):**
```typescript
// 성씨가 같은 당사자 확인
const checkSameSurnameParties = useCallback((
  clientName: string,
  _targetPartyId?: string
): boolean => {
  if (!clientName || clientName.length === 0) return false;

  const surname = clientName.charAt(0);

  // 같은 성씨의 당사자 필터링
  const sameSurnameParties = caseParties.filter(p => {
    // 당사자명에서 번호 제거 (예: "1. 김OO" → "김OO")
    const partyName = (p.party_name || '').replace(/^\d+\.\s*/, '');
    return partyName.length > 0 && partyName.charAt(0) === surname;
  });

  // 2명 이상이고, 모두 같은 측인 경우에만 모달 표시
  if (sameSurnameParties.length >= 2) {
    // party_type으로 측 확인 (plaintiff, defendant 등)
    const sides = new Set(sameSurnameParties.map(p => {
      const type = p.party_type || '';
      // 원고측: plaintiff, applicant, creditor, claimant
      // 피고측: defendant, respondent, debtor
      if (['plaintiff', 'applicant', 'creditor', 'claimant'].includes(type)) return 'plaintiff_side';
      if (['defendant', 'respondent', 'debtor'].includes(type)) return 'defendant_side';
      return type;
    }));

    if (sides.size === 1) {
      // 모두 같은 측이면 모달 표시
      setClientMatchCandidates(sameSurnameParties.map(p => ({
        partyId: p.id,
        partyName: p.party_name || '',
        partyTypeLabel: p.party_type_label || p.party_type || '',
        scourt_rank: p.scourt_rank || p.party_order || 0
      })));
      setShowClientMatchModal(true);
      return true; // 모달 표시됨
    }
  }

  return false; // 모달 불필요
}, [caseParties]);
```

**3. 의뢰인 연결 핸들러 수정 (기존 handleLinkClientToParty 래핑):**
```typescript
// 의뢰인 연결 전 성씨 확인
const handleLinkClientWithConfirm = useCallback((
  clientId: string,
  clientName: string,
  partyId?: string
) => {
  // 특정 당사자가 지정된 경우 직접 연결
  if (partyId) {
    handleLinkClientToParty(clientId, partyId);
    return;
  }

  // 성씨 확인 필요 여부 체크
  if (checkSameSurnameParties(clientName)) {
    // 모달이 표시됨 - pending 상태 저장
    setPendingClientLink({ clientId, clientName });
  } else {
    // 모달 불필요 - 자동 매칭 또는 기본 연결
    handleLinkClientToParty(clientId, undefined);
  }
}, [checkSameSurnameParties, handleLinkClientToParty]);
```

**4. 모달 렌더링 (JSX 최하단, return 직전):**
```tsx
{/* ClientMatchConfirmModal */}
{showClientMatchModal && pendingClientLink && (
  <ClientMatchConfirmModal
    isOpen={showClientMatchModal}
    clientName={pendingClientLink.clientName}
    candidates={clientMatchCandidates}
    onConfirm={(partyId) => {
      // 선택된 당사자와 연결
      handleLinkClientToParty(pendingClientLink.clientId, partyId);
      setShowClientMatchModal(false);
      setPendingClientLink(null);
    }}
    onCancel={() => {
      setShowClientMatchModal(false);
      setPendingClientLink(null);
    }}
  />
)}
```

#### 4.4.4 비연동 사건 당사자 추가 UI 개선

**File**: `components/CasePartiesSection.tsx`

비연동 사건용 당사자 추가 버튼 및 폼:
- 역할 선택 (사건유형에 따라 옵션 결정)
- 이름 입력
- 순번 자동 증가

---

## 5. Task Flow (REVISED for Revision 6)

### Phase 0.1: Data Flow Verification (NEW - First)

```
[T0.1] Document Party Data Entry Points
    - Map all write operations
    - Trace data transformations
    - Create entry point table
    ↓
[T0.2] Document Party Data Query Points
    - Map all read operations
    - Identify null handling
    - Create query point table
    ↓
[T0.3] Verify is_our_client → case_clients Migration Completeness
    - Run migration verification SQL
    - Document gaps
    - Create remediation plan if needed
```

### Phase 0.5: Schema State Verification (REVISED)

```
[T0.5] Verify Production DB Schema State
    - Run verification SQL
    - Confirm case_clients exists (expected: YES)
    - Check unified_calendar view (expected: still uses is_our_client)
    - Check receivables_summary view (expected: uses case_clients)
    ↓
[T0.6] Update unified_calendar View ONLY
    - Create migration: 20260128300000_update_unified_calendar_view.sql
    - Change is_our_client subquery to case_clients JOIN
    - receivables_summary: NO CHANGE NEEDED (already correct)
    - Apply migration
    ↓
[T0.7] Verify View Updates
    - unified_calendar uses case_clients
    - receivables_summary unchanged
    - Both views return correct data
```

### Phase 1: API Client Parsing (After Phase 0)

```
[T1.1] CaseGeneralData.parties 타입 확장 (btprtRnk, btprtDvsCd 추가)
    ↓
[T1.2] parties 파싱 로직 업데이트 (~line 1150)
    ↓
[T1.3] CaseGeneralData.representatives 타입 확장 (btprtDvsCd, btprtRltnCtt 추가)
    ↓
[T1.4] representatives 파싱 로직 업데이트 (~line 1214)
```

### Phase 1.5: Type Sync (NEW)

```
[T-NEW-1] Sync PartyType with DB ENUM considerations
    - Add appellant, appellee to PartyType
    - Update PARTY_TYPE_LABELS
    - Update OPPOSITE_PARTY_TYPE
    - Update mapScourtPartyType (line 253-256): "항소인" → "appellant"
    ↓
[T-NEW-2] Centralize getPartySide function
    - Add PLAINTIFF_SIDE_TYPES, DEFENDANT_SIDE_TYPES, NEUTRAL_PARTY_TYPES
    - Add getPartySide() function
    - Verification: grep shows single source
    ↓
[T-NEW-3] Update parties/route.ts
    - Remove lines 8-28 (local definitions)
    - Import from @/types/case-party
    ↓
[T-NEW-4] Update party-sync.ts
    - Remove lines 43-51 (local definitions)
    - Import from @/types/case-party
    ↓
[T-NEW-5] Add deprecation annotations
    - CaseEditForm.tsx lines 41-42: @deprecated on client_role, opponent_name
    - CaseDetail.tsx lines 130-131: @deprecated comment
```

### Phase 2: Schema Migration (스키마 변경)

```
[T2.1] case_parties 테이블에 scourt_rank, scourt_dvs_cd 컬럼 추가
    ↓
[T2.2] 기존 데이터 백필: party_name에서 scourt_rank 근사값 추출 (참고용)
    ↓
[T2.3] types/case-party.ts 타입 정의 업데이트
```

### Phase 3: SCOURT Sync (동기화 개선)

```
[T3.1] party-sync.ts: scourt_rank, scourt_dvs_cd 저장 로직 추가
    ↓
[T3.2] party-sync.ts: 대리인-당사자 매핑 로직 구현 (btprtDvsCd 기반)
    ↓
[T3.3] 대리인을 해당 당사자의 representatives JSONB에 저장
```

### Phase 4: UI Improvements (UI 개선)

```
[T4.1] CasePartiesSection: 대리인을 당사자별로 표시 (상세 지침 참조)
    - 제거: line 339-387 (allReps 수집 및 별도 표시 로직)
    - 추가: 각 PartyTableRow 직후에 대리인 서브행 렌더링
    ↓
[T4.2] ClientMatchConfirmModal 컴포넌트 생성
    ↓
[T4.3] CaseDetail.tsx: 의뢰인 지정 시 성씨 동일 확인 로직 추가 (상세 지침 참조)
    - 상태 추가 (showClientMatchModal, clientMatchCandidates, pendingClientLink)
    - checkSameSurnameParties 함수 추가
    - handleLinkClientWithConfirm 래퍼 함수 추가
    - 모달 렌더링 JSX 추가
    ↓
[T4.4] 비연동 사건 당사자 추가 UI 개선
```

### Phase 5: Testing & Verification

```
[T5.1] 기존 SCOURT 동기화 테스트 (regression)
    ↓
[T5.2] 새 대리인-당사자 매핑 테스트
    ↓
[T5.3] 의뢰인 확인 모달 테스트
    ↓
[T5.4] 레거시 컬럼 참조 검증
    - grep -r "is_our_client" --include="*.ts" --include="*.tsx" 실행
    - 코드에 is_our_client 참조가 없는지 확인
    - NOTE 주석 외에 실제 사용처가 없어야 함
```

### Phase 6: Legacy Code Cleanup

```
[T6.1] 레거시 스크립트 정리
    - scripts/cleanup-duplicate-parties.ts: is_our_client → is_primary 변경
    - scripts/check-parties.ts: is_our_client → is_primary 변경
    - scripts/sync-case-with-scourt.ts: is_our_client 참조 제거
    - scripts/check-migration.ts: is_our_client → is_primary 변경
    - scripts/check-case-parties-columns.ts: is_our_client 체크 제거
    - scripts/check-db-schema-detail.ts: is_our_client 체크 제거
    ↓
[T6.2] 문서 업데이트
    - docs/systems/CLIENT_PARTY_SYNC_SYSTEM.md: 새 스키마 반영
    - docs/systems/CALENDAR_SYSTEM.md: 새 스키마 반영
    - docs/systems/CLIENT_ROLE_CONFIRMATION.md: 새 스키마 반영
    - docs/SCHEMA_MIGRATION_API_CHANGES.md: 최신화
```

---

## 6. Detailed TODOs

### T0.1: Document Party Data Entry Points

**Deliverable:** `.omc/notes/party-data-flow.md`

**Entry Points to Document:**

| # | Entry Point | File | Handler | Trace Path |
|---|-------------|------|---------|------------|
| 1 | SCOURT Sync | `lib/scourt/party-sync.ts` | `syncPartiesFromScourtServer()` | API call → parse → upsert to case_parties |
| 2 | Manual Add | `app/api/admin/cases/[id]/parties/route.ts` | POST handler | Request body → validate → insert case_parties |
| 3 | Party Update | `app/api/admin/cases/[id]/parties/route.ts` | PUT handler | Request body → validate → update case_parties |
| 4 | Client Link | `app/api/admin/cases/[id]/parties/route.ts` | linkClient() | Client ID → insert case_clients |
| 5 | Case Creation | `app/api/admin/cases/route.ts` | POST handler | Initial parties in request → bulk insert |

**Acceptance Criteria:**
- All entry points documented with data flow
- Transformation logic noted
- Validation logic identified

---

### T0.2: Document Party Data Query Points

**Deliverable:** `.omc/notes/party-data-flow.md` (append)

**Query Points to Document:**

| # | Query Point | File | Function | Data Shape |
|---|-------------|------|----------|------------|
| 1 | Case Detail | `components/CaseDetail.tsx` | `fetchCaseParties()` | CaseParty[] |
| 2 | Parties Section | `components/CasePartiesSection.tsx` | props.parties | CaseParty[] with representatives |
| 3 | Calendar | `unified_calendar` VIEW | Subquery | party_name as our_client_name |
| 4 | Receivables | `receivables_summary` VIEW | JOIN | client_name via case_clients |
| 5 | Case List | `app/api/admin/cases/route.ts` | Inline query | Summary info |

**Acceptance Criteria:**
- All query points documented
- Null handling verified
- Index usage confirmed

---

### T0.3: Verify Migration Completeness

**SQL to Execute:**
```sql
-- Count is_our_client=true parties without case_clients link
SELECT COUNT(*) as orphaned_client_flags FROM case_parties cp
WHERE cp.is_our_client = true
  AND NOT EXISTS (
    SELECT 1 FROM case_clients cc
    WHERE cc.linked_party_id = cp.id
  );
```

**Expected Result:** 0

**If > 0:** Document for remediation in Phase 0.5

---

### T0.5: DB Schema State Check (REVISED)

**SQL Commands:**
```sql
-- 1. case_clients 테이블 확인 (EXPECTED: exists)
SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'case_clients');

-- 2. case_parties 컬럼 확인
SELECT column_name FROM information_schema.columns
WHERE table_name = 'case_parties' AND column_name IN ('is_our_client', 'client_id', 'fee_allocation_amount');

-- 3. unified_calendar 뷰에서 is_our_client 사용 여부 (EXPECTED: true = still uses legacy)
SELECT pg_get_viewdef('unified_calendar'::regclass, true) LIKE '%is_our_client%' as uses_legacy;

-- 4. receivables_summary 뷰에서 case_clients 사용 여부 (EXPECTED: true = already migrated)
SELECT pg_get_viewdef('receivables_summary'::regclass, true) LIKE '%case_clients%' as uses_case_clients;
```

**Expected Results:**
1. case_clients EXISTS: true
2. is_our_client EXISTS: likely true (legacy)
3. unified_calendar uses_legacy: true (needs update)
4. receivables_summary uses_case_clients: true (no change needed)

**Acceptance Criteria:**
- Current state documented
- Decision made: update unified_calendar only

---

### T0.6: Update unified_calendar View Only (REVISED)

**File:** `supabase/migrations/20260128300000_update_unified_calendar_view.sql`

**Key Change (line 3193-3197 equivalent):**
```sql
-- BEFORE (current):
(
  SELECT party_name
  FROM case_parties cp
  WHERE cp.case_id = ch.case_id AND cp.is_our_client = true
  LIMIT 1
)::TEXT AS our_client_name,

-- AFTER (new):
(
  SELECT c.name
  FROM case_clients cc
  JOIN clients c ON cc.client_id = c.id
  WHERE cc.case_id = ch.case_id AND cc.is_primary_client = true
  LIMIT 1
)::TEXT AS our_client_name,
```

**NOTE:** `receivables_summary` does NOT need modification - it already uses case_clients.

**Acceptance Criteria:**
- Migration file created
- Only unified_calendar updated
- receivables_summary unchanged
- `supabase db push` success

---

### T0.7: Verify View Updates (REVISED)

**Verification SQL:**
```sql
-- unified_calendar no longer uses is_our_client
SELECT pg_get_viewdef('unified_calendar'::regclass, true) NOT LIKE '%is_our_client%' as migrated;

-- receivables_summary still uses case_clients (unchanged)
SELECT pg_get_viewdef('receivables_summary'::regclass, true) LIKE '%case_clients%' as uses_case_clients;

-- Test query: unified_calendar returns data
SELECT event_type, title, our_client_name FROM unified_calendar LIMIT 5;
```

**Acceptance Criteria:**
- unified_calendar migrated = true
- receivables_summary uses_case_clients = true
- Test query returns data

---

### T-NEW-1: Sync PartyType (UPDATED with mapScourtPartyType)

**File**: `/types/case-party.ts`

**Changes:**

1. **Add to PartyType (around line 10):**
```typescript
export type PartyType =
  | "plaintiff" | "defendant" | "creditor" | "debtor"
  | "applicant" | "respondent" | "third_debtor"
  | "actor" | "victim" | "assistant" | "juvenile" | "investigator"
  | "accused" | "crime_victim" | "related"
  | "appellant" | "appellee";  // ADDED
```

2. **Add to PARTY_TYPE_LABELS:**
```typescript
export const PARTY_TYPE_LABELS: Record<PartyType, string> = {
  // ... existing entries ...
  appellant: "항소인",    // ADDED
  appellee: "피항소인",   // ADDED
};
```

3. **Add to OPPOSITE_PARTY_TYPE:**
```typescript
export const OPPOSITE_PARTY_TYPE: Record<PartyType, PartyType> = {
  // ... existing entries ...
  appellant: "appellee",  // ADDED
  appellee: "appellant",  // ADDED
};
```

4. **Update mapScourtPartyType (line 253-256):**
```typescript
// BEFORE (workaround mapping):
"항소인": "plaintiff",
"피항소인": "defendant",
"상고인": "plaintiff",
"피상고인": "defendant",

// AFTER (correct mapping):
"항소인": "appellant",
"피항소인": "appellee",
"상고인": "appellant",   // 상고인 also maps to appellant
"피상고인": "appellee",  // 피상고인 also maps to appellee
```

**Acceptance Criteria:**
- PartyType includes appellant, appellee
- PARTY_TYPE_LABELS has Korean labels
- OPPOSITE_PARTY_TYPE has correct opposites
- mapScourtPartyType correctly maps 항소인/피항소인

---

### T-NEW-2: Centralize getPartySide

**File**: `/types/case-party.ts`

**Add after OPPOSITE_PARTY_TYPE:**
```typescript
// Plaintiff side party types
export const PLAINTIFF_SIDE_TYPES: ReadonlySet<PartyType> = new Set([
  'plaintiff', 'creditor', 'applicant', 'actor', 'appellant', 'investigator'
]);

// Defendant side party types
export const DEFENDANT_SIDE_TYPES: ReadonlySet<PartyType> = new Set([
  'defendant', 'debtor', 'respondent', 'third_debtor', 'accused',
  'juvenile', 'appellee', 'victim', 'crime_victim'
]);

// Neutral types (no side)
export const NEUTRAL_PARTY_TYPES: ReadonlySet<PartyType> = new Set([
  'related', 'assistant'
]);

/**
 * Determines which side a party type belongs to
 * @param partyType - The party type to check
 * @returns 'plaintiff' | 'defendant' | null
 */
export function getPartySide(partyType: PartyType): 'plaintiff' | 'defendant' | null {
  if (PLAINTIFF_SIDE_TYPES.has(partyType)) return 'plaintiff';
  if (DEFENDANT_SIDE_TYPES.has(partyType)) return 'defendant';
  return null;
}
```

**Verification Command:**
```bash
grep -rn "PLAINTIFF_SIDE_TYPES\|DEFENDANT_SIDE_TYPES\|getPartySide" --include="*.ts" --include="*.tsx" .
# After T-NEW-3 and T-NEW-4: should show only types/case-party.ts as definition source
```

**Acceptance Criteria:**
- All side-related constants exported from types/case-party.ts
- getPartySide function handles all PartyType values
- Neutral types return null

---

### T-NEW-3: Update parties/route.ts

**File**: `/app/api/admin/cases/[id]/parties/route.ts`

**Remove lines 8-28:**
```typescript
// REMOVE THIS ENTIRE BLOCK:
const PLAINTIFF_SIDE_TYPES = new Set(["plaintiff", "creditor", "applicant", "actor"]);
const DEFENDANT_SIDE_TYPES = new Set(["defendant", "debtor", "respondent", "third_debtor", "accused", "juvenile"]);

function getPartySide(partyType: string): 'plaintiff' | 'defendant' | null {
  if (PLAINTIFF_SIDE_TYPES.has(partyType)) return 'plaintiff';
  if (DEFENDANT_SIDE_TYPES.has(partyType)) return 'defendant';
  return null;
}
```

**Add import at top:**
```typescript
import { getPartySide, PLAINTIFF_SIDE_TYPES, DEFENDANT_SIDE_TYPES, PartyType } from '@/types/case-party';
```

**Acceptance Criteria:**
- Local definitions removed
- Import statement added
- Code still works (type check passes)

---

### T-NEW-4: Update party-sync.ts

**File**: `/lib/scourt/party-sync.ts`

**Remove lines 43-51:**
```typescript
// REMOVE THIS ENTIRE BLOCK:
const PLAINTIFF_SIDE_TYPES: PartyType[] = ['plaintiff', 'creditor', 'applicant', 'actor'];
const DEFENDANT_SIDE_TYPES: PartyType[] = ['defendant', 'debtor', 'respondent', 'third_debtor', 'accused', 'juvenile'];

function getPartySide(partyType: PartyType): 'plaintiff' | 'defendant' | null {
  // ...
}
```

**Update import (around line 1-10):**
```typescript
import {
  PartyType,
  // ... existing imports ...
  getPartySide,           // ADDED
  PLAINTIFF_SIDE_TYPES,   // ADDED
  DEFENDANT_SIDE_TYPES    // ADDED
} from '@/types/case-party';
```

**Acceptance Criteria:**
- Local definitions removed
- Import statement updated
- Code still works (type check passes)

---

### T-NEW-5: Add Deprecation Annotations

**File 1**: `/components/CaseEditForm.tsx` (lines 41-42)

**Before:**
```typescript
interface LegalCase {
  // ...
  client_role?: string;
  opponent_name?: string;
  // ...
}
```

**After:**
```typescript
interface LegalCase {
  // ...
  /** @deprecated Use case_clients table for client info. Migration planned. */
  client_role?: string;
  /** @deprecated Use case_parties table for opponent info. Migration planned. */
  opponent_name?: string;
  // ...
}
```

**File 2**: `/components/CaseDetail.tsx` (lines 130-131)

**Add comment before usage:**
```typescript
// @deprecated - client_role is legacy. Use case_clients table for client information.
// This field will be removed in a future migration.
```

**Acceptance Criteria:**
- @deprecated JSDoc comments added
- Comments explain migration path
- No runtime changes

---

### T1.1 - T6.2: (Unchanged from Revision 5)

See previous sections for detailed specifications.

---

## 7. Commit Strategy

```
1. docs(data-flow): document party data entry and query points
2. fix(views): update unified_calendar to use case_clients instead of is_our_client
3. feat(api-client): parse btprtRnk and btprtDvsCd from SCOURT parties response
4. feat(api-client): parse btprtDvsCd and btprtRltnCtt from SCOURT representatives response
5. feat(types): add appellant/appellee to PartyType and update mapScourtPartyType
6. refactor(types): centralize getPartySide function in types/case-party.ts
7. refactor(api): use centralized getPartySide in parties route
8. refactor(sync): use centralized getPartySide in party-sync
9. chore(types): add deprecation annotations for legacy fields
10. feat(schema): add scourt_rank and scourt_dvs_cd to case_parties
11. feat(sync): map representatives to specific parties using btprtDvsCd
12. feat(ui): display representatives per party in CasePartiesSection
13. feat(ui): add ClientMatchConfirmModal for same-surname confirmation
14. feat(ui): improve non-linked case party input
15. test: add tests for representative mapping
16. chore(scripts): cleanup legacy is_our_client references in scripts
17. docs: update system documentation to reflect new schema
```

---

## 8. Success Criteria (REVISED)

| Criterion | Measurement |
|-----------|-------------|
| 데이터 흐름 문서화 | `.omc/notes/party-data-flow.md` 존재 및 완성 |
| unified_calendar 업데이트 | `is_our_client` 사용 안함, `case_clients` 사용 |
| receivables_summary 확인 | 변경 없음 (이미 case_clients 사용) |
| PartyType 동기화 | appellant, appellee 포함 |
| mapScourtPartyType 수정 | "항소인" → "appellant" 매핑 |
| getPartySide 중앙화 | types/case-party.ts에 단일 정의 |
| API 파싱 완전성 | btprtRnk, btprtDvsCd가 CaseGeneralData에 포함됨 |
| 대리인-당사자 연결 정확도 | SCOURT 연동 사건에서 대리인이 올바른 당사자에 표시됨 |
| 의뢰인 확인 UX | 성씨 동일 시 확인 모달이 표시되고 올바른 당사자 선택 가능 |
| 기존 기능 유지 | 기존 테스트 100% 통과 |
| 성능 | 캘린더/사건 목록 로딩 시간 변화 없음 |
| 레거시 코드 정리 | `grep -r "is_our_client" --include="*.ts"` 결과에 실제 사용처 없음 |
| 문서 정합성 | 모든 시스템 문서가 새 스키마 반영 |

---

## 9. Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| unified_calendar 뷰 업데이트 실패 | 이전 뷰 정의 백업, 트랜잭션 내 실행 |
| SCOURT API에 btprtDvsCd가 없는 응답 | agntDvsNm 파싱으로 fallback |
| 기존 representatives JSONB와 호환성 | 신규 필드는 optional로 추가 |
| 마이그레이션 시 데이터 손실 | 컬럼 추가만, 삭제는 신중히 |
| 기존 데이터 정합성 | Lazy re-sync 전략으로 자연스럽게 채워짐 |
| 레거시 스크립트 수정 누락 | T5.4 검증 단계에서 grep으로 확인 |
| appellant/appellee 추가 시 기존 코드 영향 | Optional 타입으로 추가, 기존 코드 호환 |

---

## 10. Data Migration Strategy

### Lazy Re-sync (Recommended)

1. **즉시 마이그레이션 없음**: 기존 데이터는 NULL 상태로 유지
2. **자연 동기화**: 사용자가 사건을 열거나, 일정 동기화 시 새 필드 채워짐
3. **Admin API (선택적)**: 필요 시 bulk re-sync API 제공
   - `POST /api/admin/cases/bulk-resync` - 특정 tenant의 모든 사건 재동기화
4. **UI 처리**: `scourt_rank`, `scourt_dvs_cd`가 NULL인 경우 graceful 처리
   - 순번 표시: NULL이면 party_order 사용
   - 대리인 매핑: NULL이면 agntDvsNm 파싱 fallback

---

## 11. Future Considerations

1. **대리인 별도 테이블 분리**: 현재는 JSONB로 관리하나, 복잡해지면 별도 테이블 고려
2. **당사자 변동 이력**: 당사자 변경(소송수계 등) 이력 추적
3. **다자간 소송**: 공동소송에서 복수 원고/피고 그룹 지원

---

## 12. Questions Resolved (Critic Q&A)

### Q1: Has the migration been partially applied?

**Answer:** YES, partially applied.
- `case_clients` table: EXISTS (migration applied)
- `receivables_summary` view: USES case_clients (migration applied)
- `unified_calendar` view: STILL uses is_our_client (migration NOT applied)

**Action:** Only update unified_calendar view in Phase 0.6.

### Q2: Should we add explicit data flow verification tasks?

**Answer:** YES. Added Phase 0.1 with T0.1, T0.2, T0.3 for explicit data flow documentation as user requested.

### Q3: Should unified_calendar view be updated separately?

**Answer:** YES. Updated in Phase 0.6. receivables_summary is already correct and needs no change.
