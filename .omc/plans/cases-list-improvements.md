# Work Plan: Cases List Page Improvements

## Context

### Original Request
사건 목록 페이지(/cases) 6가지 개선:
1. "심급"이 모두 1심으로 표시됨 - 올바른 심급 표시 필요
2. 사건명은 나의사건검색에 나오는 사건명을 써야 함 - "하심사건 사건" 같은 건 다른 로직에서 나온 것
3. 담당자필드 → 담당변호사 - 변호사 이름이 나와야 함
4. 필터기능 - 담당변호사별(및 전체)로 볼 수 있도록 해야 함
5. 다음기일도 표시
6. 속도에 큰 영향이 없다면, 사용자가 각종 항목을 선택해서 볼 수 있도록 하자

### Research Findings

#### Data Flow Analysis (CRITICAL)
**Primary Data Source:** `/app/cases/page.tsx` (Server Component)
- Uses `adminClient.from('legal_cases').select(*)` to fetch data
- Transforms data and passes to `CasesList` component
- Does NOT use `/api/admin/cases/route.ts` for listing

**Current SELECT in page.tsx (lines 31-38):**
```typescript
.select(`
  *,
  client:clients(id, name),
  case_parties(id, party_name, party_type, party_type_label, is_primary),
  case_clients(client_id, linked_party_id, is_primary_client)
`)
```

**Missing:** `case_assignees` JOIN - MUST be added for lawyer display and filter

#### Issue 1: 심급이 모두 1심으로 표시됨
**Root Cause:** The `select(*)` in `page.tsx` DOES include `case_level` from `legal_cases` table. The issue is likely data-related (some cases have NULL `case_level`), not a code issue. Need to verify database values.

**Current State:**
- Database has `case_level` column with values: '1심', '2심(항소심)', '3심(상고심)'
- `CasesList.tsx` line 267-269 renders `CaseLevelBadge` expecting `item.case_level`
- `case_level` is properly set when syncing with SCOURT via `lib/scourt/case-storage.ts`
- `select(*)` should include this field - verify data not NULL

#### Issue 2: 사건명 이슈
**Root Cause:** The case_name is stored in `legal_cases.case_name` and comes from user input or SCOURT sync. The "하심사건 사건" pattern appears in case_relations logic for appeal chain cases, NOT in the display logic.

**Current State:**
- SCOURT provides `csNm` (사건명) field via `api-client.ts`
- `case_name` should come from SCOURT's `csNm` field during sync
- This is likely a data issue, not display issue

#### Issue 3: 담당자 → 담당변호사
**Current State:**
- Column header says "담당자" (line 299)
- `AssigneeCell` component shows ALL assignees (no role filter)
- **CRITICAL:** `page.tsx` does NOT fetch `case_assignees` - need to add JOIN
- Need to filter to show only lawyers (roles: 'lawyer', 'owner', 'admin') and rename header

#### Issue 4: 담당변호사별 필터
**Current State:**
- Only status filter exists (line 348-362)
- No lawyer filter dropdown
- **REQUIRES:** `case_assignees` data to be fetched first

#### Issue 5: 다음기일 표시
**Current State:**
- `legal_cases.scourt_next_hearing` JSONB field exists but may not be populated
- `court_hearings` table has all hearing data
- **MUST add:** Separate query for next hearings in `page.tsx`

#### Issue 6: 사용자가 항목 선택해서 볼 수 있도록
**Current State:**
- Fixed 8 columns (lines 233-312)
- No column visibility toggle
- Need to add column selector dropdown (native HTML, no Radix UI Popover)

---

## Work Objectives

### Core Objective
Improve the cases list page with correct data display, filtering, and user customization.

### Deliverables
1. Verify and fix 심급 display (may be data issue)
2. Proper case_name from SCOURT sync (verify data)
3. Add `case_assignees` to page.tsx query
4. Renamed and filtered 담당변호사 column (lawyers only)
5. Lawyer filter dropdown
6. Next hearing date column
7. Column visibility selector

### Definition of Done
- All 6 issues addressed
- No performance regression (query stays under 500ms)
- TypeScript/ESLint errors resolved
- Existing functionality preserved

---

## Must Have / Must NOT Have (Guardrails)

### Must Have
- [ ] `case_assignees` JOIN added to page.tsx query
- [ ] case_level verified and displayed correctly
- [ ] Lawyer-only assignee display (roles: 'lawyer', 'owner', 'admin')
- [ ] Lawyer filter with "전체" option
- [ ] Next hearing date column
- [ ] Column visibility toggle (localStorage persisted)

### Must NOT Have
- Breaking changes to existing data structure
- Additional database migrations (use existing schema)
- Changes to SCOURT sync logic (Issue 2 is display-only)
- Performance degradation (N+1 queries)
- Radix UI dependencies (use native HTML for column selector)

---

## Task Flow and Dependencies

```
[T1] Add case_assignees to page.tsx SELECT
         ↓
[T2] Transform case_assignees data in page.tsx
         ↓
[T3] Add next_hearing query to page.tsx
         ↓
[T4] Update CasesList interface for new fields
         ↓
[T5] Rename "담당자" → "담당변호사" + filter lawyers only
         ↓
[T6] Add lawyer filter dropdown
         ↓
[T7] Add next hearing column
         ↓
[T8] Add column visibility selector
         ↓
[T9] Verify & Test
```

---

## Detailed TODOs

### T1: Add case_assignees to page.tsx SELECT
**File:** `/Users/hskim/luseed/app/cases/page.tsx`
**Lines:** 31-38

**Change:**
Add `case_assignees` JOIN to the SELECT statement.

```typescript
// Lines 31-38: Update select to include case_assignees
let query = adminClient
  .from('legal_cases')
  .select(`
    *,
    client:clients(id, name),
    case_parties(id, party_name, party_type, party_type_label, is_primary),
    case_clients(client_id, linked_party_id, is_primary_client),
    case_assignees(
      id,
      member_id,
      is_primary,
      member:tenant_members(id, display_name, role)
    )
  `)
```

**Acceptance Criteria:**
- [ ] case_assignees data included in query result
- [ ] No query errors
- [ ] Member info (display_name, role) available

---

### T2: Transform case_assignees data in page.tsx
**File:** `/Users/hskim/luseed/app/cases/page.tsx`
**After line 80 (in casesWithParties map function)**

**Change:**
Add interface and transform case_assignees to match CasesList expected format.

```typescript
// Add interface for raw case_assignee
interface RawCaseAssignee {
  id: string
  member_id: string
  is_primary: boolean
  member: {
    id: string
    display_name: string
    role: string
  }
}

// In casesWithParties map function, transform case_assignees:
const caseAssignees = (c.case_assignees || []) as RawCaseAssignee[]
const transformedAssignees = caseAssignees.map(ca => ({
  id: ca.id,
  memberId: ca.member_id,
  isPrimary: ca.is_primary,
  displayName: ca.member?.display_name || '',
  role: ca.member?.role || ''
}))

// In return object, add:
return {
  ...rest,
  parties: { ... },
  assignees: transformedAssignees,  // Add this
}
```

**Acceptance Criteria:**
- [ ] assignees array passed to CasesList
- [ ] Each assignee has id, memberId, isPrimary, displayName, role
- [ ] TypeScript compiles without errors

---

### T3: Add next_hearing query to page.tsx
**File:** `/Users/hskim/luseed/app/cases/page.tsx`
**After line 45 (after cases query)**

**Change:**
Fetch next hearings for all cases in a single query.

```typescript
// After fetching cases, get next hearings
const caseIds = (casesData || []).map(c => c.id)
const { data: nextHearings } = await adminClient
  .from('court_hearings')
  .select('case_id, hearing_date, hearing_type')
  .in('case_id', caseIds)
  .gte('hearing_date', new Date().toISOString().split('T')[0])  // Today or future
  .eq('status', 'SCHEDULED')
  .order('hearing_date', { ascending: true })

// Create map of case_id -> next hearing (first one for each case)
const nextHearingMap = new Map<string, { date: string; type: string }>()
for (const h of nextHearings || []) {
  if (!nextHearingMap.has(h.case_id)) {
    nextHearingMap.set(h.case_id, { date: h.hearing_date, type: h.hearing_type })
  }
}

// In casesWithParties map, add:
return {
  ...rest,
  parties: { ... },
  assignees: transformedAssignees,
  next_hearing: nextHearingMap.get(c.id) || null,  // Add this
}
```

**Acceptance Criteria:**
- [ ] next_hearing object included in data
- [ ] Only SCHEDULED hearings in the future
- [ ] Earliest hearing per case
- [ ] Single query, not N+1

---

### T4: Update CasesList interface
**File:** `/Users/hskim/luseed/components/CasesList.tsx`
**Lines:** 37-69

**Change:**
Add next_hearing to LegalCase interface.

```typescript
interface LegalCase {
  // ... existing fields (lines 37-68)
  next_hearing?: {
    date: string
    type: string
  } | null
}
```

**Acceptance Criteria:**
- [ ] TypeScript compiles without errors
- [ ] Interface matches data from page.tsx

---

### T5: Rename "담당자" → "담당변호사" + filter lawyers
**File:** `/Users/hskim/luseed/components/CasesList.tsx`
**Lines:** 297-303, 522-559

**Change 1:** Rename header (line 299)
```typescript
{
  key: 'assignee',
  header: '담당변호사',  // Changed from '담당자'
  // ...
}
```

**Change 2:** Filter to show only lawyers in AssigneeCell (lines 522-559)
```typescript
function AssigneeCell({ assignees, assignedMember }: AssigneeCellProps) {
  // Filter to only show lawyers (role in ['lawyer', 'owner', 'admin'])
  const LAWYER_ROLES = ['lawyer', 'owner', 'admin']
  const lawyers = assignees?.filter(a => LAWYER_ROLES.includes(a.role)) || []
  const primary = lawyers.find(a => a.isPrimary)
  const others = lawyers.filter(a => !a.isPrimary)

  if (lawyers.length > 0) {
    return (
      <div className="flex items-center gap-1 flex-wrap justify-center">
        {primary && (
          <span
            className="inline-flex items-center px-2 py-0.5 text-caption font-medium rounded bg-[var(--sage-muted)] text-[var(--sage-primary)]"
            title={`주담당: ${primary.displayName}`}
          >
            {primary.displayName} ★
          </span>
        )}
        {others.length > 0 && (
          <span
            className="inline-flex px-1.5 py-0.5 text-caption font-medium rounded bg-[var(--bg-tertiary)] text-[var(--text-secondary)] cursor-help"
            title={others.map(a => a.displayName).join(', ')}
          >
            +{others.length}
          </span>
        )}
      </div>
    )
  }

  // Legacy fallback
  if (assignedMember?.display_name) {
    return (
      <span className="inline-flex px-2 py-0.5 text-caption font-medium rounded bg-[var(--color-info)]/10 text-[var(--color-info)]">
        {assignedMember.display_name}
      </span>
    )
  }

  return <span className="text-[var(--text-muted)]">-</span>
}
```

**Change 3:** Update CaseCard担当者 label (line 621)
```typescript
<span className="text-[var(--text-muted)]">담당변호사</span>
```

**Acceptance Criteria:**
- [ ] Column header shows "담당변호사"
- [ ] Only lawyers displayed (staff excluded)
- [ ] Primary lawyer still marked with star
- [ ] Card view also updated

---

### T6: Add lawyer filter dropdown
**File:** `/Users/hskim/luseed/components/CasesList.tsx`
**After line 362 (after status filter), add state around line 88**

**Change:**
1. Add state for lawyer filter
2. Add dropdown with lawyer list
3. Filter cases by selected lawyer

```typescript
// State (add after line 88)
const [lawyerFilter, setLawyerFilter] = useState<string>('all')

// Get unique lawyers from cases (add in useMemo section)
const allLawyers = useMemo(() => {
  const LAWYER_ROLES = ['lawyer', 'owner', 'admin']
  const lawyerMap = new Map<string, string>()
  cases.forEach(c => {
    c.assignees?.filter(a => LAWYER_ROLES.includes(a.role)).forEach(a => {
      lawyerMap.set(a.memberId, a.displayName)
    })
  })
  return Array.from(lawyerMap.entries()).map(([id, name]) => ({ id, name }))
}, [cases])

// Filter logic (add to processedCases useMemo, after statusFilter)
if (lawyerFilter !== 'all') {
  filtered = filtered.filter(c =>
    c.assignees?.some(a => a.memberId === lawyerFilter)
  )
}

// Dropdown JSX (add after line 362, after status filter)
{/* Lawyer Filter */}
<div className="relative">
  <select
    value={lawyerFilter}
    onChange={(e) => {
      setLawyerFilter(e.target.value)
      setCurrentPage(1)
    }}
    className="form-input pr-8 appearance-none"
  >
    <option value="all">전체 변호사</option>
    {allLawyers.map(l => (
      <option key={l.id} value={l.id}>{l.name}</option>
    ))}
  </select>
  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] pointer-events-none" />
</div>
```

**Acceptance Criteria:**
- [ ] Lawyer filter dropdown visible
- [ ] "전체 변호사" as default option
- [ ] Filters cases correctly
- [ ] Page resets to 1 when filter changes

---

### T7: Add next hearing column
**File:** `/Users/hskim/luseed/components/CasesList.tsx`
**Lines:** 304-311 (add after status column)**

**Change:**
Add new column for next hearing date.

```typescript
// Add after status column (line 311)
{
  key: 'next_hearing',
  header: '다음기일',
  width: '100px',
  render: (item) => {
    if (!item.next_hearing) return <span className="text-[var(--text-muted)]">-</span>
    const date = new Date(item.next_hearing.date)
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return (
      <span className="text-body text-sm" title={item.next_hearing.type}>
        {month}/{day}
      </span>
    )
  }
},
```

**Acceptance Criteria:**
- [ ] Column displays next hearing date (MM/DD format)
- [ ] Shows "-" when no upcoming hearing
- [ ] Hover shows hearing type

---

### T8: Add column visibility selector
**File:** `/Users/hskim/luseed/components/CasesList.tsx`
**Add new state, constant, and component**

**Change:**
1. Add state for visible columns (persist to localStorage)
2. Add dropdown to toggle columns (native HTML, no Radix)
3. Filter columns array by visibility

```typescript
// Constants (add near top)
const COLUMN_DEFINITIONS = [
  { id: 'contract_date', label: '계약일' },
  { id: 'court_case_number', label: '사건번호' },
  { id: 'court_name', label: '법원' },
  { id: 'case_level', label: '심급' },
  { id: 'case_name', label: '사건명' },
  { id: 'parties', label: '당사자' },
  { id: 'assignee', label: '담당변호사' },
  { id: 'status', label: '상태' },
  { id: 'next_hearing', label: '다음기일' },
]

const DEFAULT_VISIBLE_COLUMNS = [
  'contract_date', 'court_case_number', 'court_name',
  'case_level', 'case_name', 'parties', 'assignee', 'status'
]

// State (add after line 88)
const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('cases-visible-columns')
    return saved ? JSON.parse(saved) : DEFAULT_VISIBLE_COLUMNS
  }
  return DEFAULT_VISIBLE_COLUMNS
})
const [showColumnSelector, setShowColumnSelector] = useState(false)

// Save to localStorage effect
useEffect(() => {
  localStorage.setItem('cases-visible-columns', JSON.stringify(visibleColumns))
}, [visibleColumns])

// Filter columns
const displayedColumns = columns.filter(c => visibleColumns.includes(c.key))

// Column Selector component (native dropdown)
function ColumnSelector() {
  return (
    <div className="relative">
      <button
        onClick={() => setShowColumnSelector(!showColumnSelector)}
        className="p-1.5 rounded transition-colors text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]"
        title="컬럼 설정"
      >
        <Columns className="w-4 h-4" />
      </button>
      {showColumnSelector && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowColumnSelector(false)}
          />
          <div className="absolute right-0 top-full mt-1 z-50 bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-lg shadow-lg py-2 min-w-[160px]">
            {COLUMN_DEFINITIONS.map(col => (
              <label
                key={col.id}
                className="flex items-center gap-2 px-3 py-1.5 hover:bg-[var(--bg-tertiary)] cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={visibleColumns.includes(col.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setVisibleColumns([...visibleColumns, col.id])
                    } else {
                      // Ensure at least one column visible
                      if (visibleColumns.length > 1) {
                        setVisibleColumns(visibleColumns.filter(v => v !== col.id))
                      }
                    }
                  }}
                  className="form-checkbox"
                />
                <span className="text-caption">{col.label}</span>
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// Add import for Columns icon (line 13)
import { ..., Columns } from 'lucide-react'

// Use displayedColumns in DataTable (replace columns with displayedColumns)
<DataTable
  columns={displayedColumns}  // Changed from columns
  ...
/>

// Add ColumnSelector to toolbar (after view mode toggle, around line 398)
<ColumnSelector />
```

**Acceptance Criteria:**
- [ ] Column selector dropdown in toolbar
- [ ] Columns toggle on/off
- [ ] Settings persist across page reloads
- [ ] At least one column always visible

---

### T9: Verification & Testing
**Manual Testing Checklist:**

1. **심급 표시**
   - [ ] 1심 사건이 "1심" 표시
   - [ ] 항소심 사건이 "항소심" 표시
   - [ ] 상고심 사건이 "상고심" 표시
   - [ ] NULL인 경우 "-" 표시

2. **사건명**
   - [ ] SCOURT 연동된 사건의 사건명이 올바르게 표시
   - [ ] "하심사건 사건" 같은 잘못된 패턴 없음

3. **담당변호사**
   - [ ] 헤더가 "담당변호사"로 표시
   - [ ] 변호사만 표시 (staff 제외)
   - [ ] owner, admin 역할도 표시됨

4. **필터**
   - [ ] 담당변호사 필터 작동
   - [ ] 상태 필터와 함께 작동
   - [ ] 필터 변경시 페이지 1로 리셋

5. **다음기일**
   - [ ] 기일 있는 사건에 날짜 표시
   - [ ] 기일 없는 사건에 "-" 표시
   - [ ] 호버시 기일 유형 표시

6. **컬럼 선택**
   - [ ] 토글 작동
   - [ ] localStorage 저장 확인
   - [ ] 최소 1개 컬럼 유지

**Acceptance Criteria:**
- [ ] All 6 features working
- [ ] No console errors
- [ ] Page load under 2 seconds

---

## Commit Strategy

### Commit 1: Backend data fetch changes
```
feat: add case_assignees and next_hearing to cases page query

- Add case_assignees JOIN with member info to page.tsx
- Add next_hearing query for upcoming court dates
- Transform data for CasesList component
```

### Commit 2: Frontend display fixes
```
feat: improve cases list display

- Rename 담당자 → 담당변호사
- Filter to show only lawyers (lawyer, owner, admin roles)
- Add lawyer filter dropdown
- Add next hearing column
```

### Commit 3: Column visibility
```
feat: add column visibility selector

- Add column selector dropdown (native HTML)
- Persist settings to localStorage
- Default visible columns defined
```

---

## Success Criteria

1. **Functional:** All 6 issues resolved
2. **Performance:** No query regression (< 500ms)
3. **UX:** Intuitive filters and column selection
4. **Code Quality:** No TypeScript/ESLint errors
5. **Compatibility:** Existing data and workflows unaffected

---

## Risk Identification and Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| N+1 query for next_hearing | Low | High | Single aggregated query with IN clause |
| Column visibility breaks table | Low | Medium | Minimum 1 column enforced |
| Lawyer filter empty | Low | Low | Show "전체" as default |
| localStorage not available (SSR) | Medium | Low | Check typeof window before access |
| case_level is NULL in DB | Medium | Low | Display "-" for NULL values |

---

## Notes

- **Data Flow Correction:** This plan targets `page.tsx` (the actual data source), NOT `/api/admin/cases/route.ts`
- Issue 2 (사건명) may not require code changes if the data is already correct in the database
- The `scourt_next_hearing` JSONB field exists but we use `court_hearings` table for reliability
- Column visibility uses native HTML dropdown (no Radix UI Popover in codebase)
- Lawyer roles include 'lawyer', 'owner', 'admin' per business logic
