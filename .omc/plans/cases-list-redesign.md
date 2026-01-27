# Cases List View Redesign

## Context

### Original Request
사건 목록 뷰(/cases) 개선:
1. 추가 컬럼: 계약일, 사건번호, 법원, 결과, 담당변호사, 사건명, 의뢰인 v 상대방
2. 주사건 중심 그룹화 정렬 옵션 (주사건 아래 서브사건 표시)

### Interview Summary
- 사용자 요구: 더 많은 사건 정보를 한 눈에 파악
- 주사건 그룹화로 관련 심급(항소심, 상고심) 사건 관계 파악 용이하게

### Research Findings

**현재 구조 분석:**
- `app/cases/page.tsx`: Server component, legal_cases + clients JOIN (직접 Supabase 쿼리)
- `components/CasesList.tsx`: Client component, DataTable 사용
- 현재 컬럼: 계약일, 유형, 의뢰인, 사건명, 담당자, 상태
- **⚠️ page.tsx가 API route를 사용하지 않고 직접 쿼리 → 반드시 확장 필요**

**DB 스키마 (마이그레이션 적용 완료 상태 - 20260214, 20260220):**
```sql
-- legal_cases 관련 필드 (이미 /api/admin/cases에서 SELECT됨)
court_case_number VARCHAR(100)   -- 법원 사건번호 ✅
court_name VARCHAR(200)          -- 법원명 (추가 필요)
case_level VARCHAR(10)           -- 1심, 2심(항소심), 3심(상고심) (추가 필요)
main_case_id UUID                -- 주사건 ID (추가 필요)
status VARCHAR(20)               -- 진행중, 종결 ✅
primary_client_id UUID           -- ⭐ 주 의뢰인 ID (캐시) ✅
primary_client_name TEXT         -- ⭐ 주 의뢰인 이름 (캐시) ✅

-- case_parties 당사자 정보 (20260220: is_our_client 삭제, 20260214: is_primary 추가)
party_name TEXT
party_type VARCHAR(30)           -- plaintiff, defendant 등
party_type_label VARCHAR(30)     -- 원고, 피고 등
is_primary BOOLEAN DEFAULT false -- ⭐ 대표 당사자 여부 (20260214에서 추가됨!)
representatives JSONB            -- 대리인 정보

-- case_clients 테이블 (20260220에서 추가됨)
case_id UUID
client_id UUID
linked_party_id UUID             -- case_parties FK (의뢰인 당사자 연결)
is_primary_client BOOLEAN        -- 주 의뢰인 여부
```

**⚠️ 의뢰인 v 상대방 구분 방법 (v4 - 확정):**
1. **의뢰인**: `legal_cases.primary_client_name` 캐시 필드 사용 (가장 간단!)
   - Fallback: `client:clients!primary_client_id(name)` JOIN
2. **상대방**:
   - `case_clients.linked_party_id`로 의뢰인 당사자 찾기 → party_type 확인
   - 반대 party_type의 당사자 중 `is_primary=true` 우선 조회
3. **레거시 Fallback**: case_clients 없는 경우 → 기존 `client` JOIN 사용

**case_assignees 테이블:**
- `member_id`, `is_primary`, `assignee_role` 포함
- 이미 /api/admin/cases에서 JOIN 처리됨

---

## Work Objectives

### Core Objective
사건 목록 뷰를 개선하여 더 많은 정보(사건번호, 법원, 결과, 당사자)를 표시하고, 주사건 중심 그룹화 정렬 옵션을 추가한다.

### Deliverables
1. **API 확장**: case_parties JOIN으로 당사자 정보 포함
2. **컬럼 추가**: 사건번호, 법원, 결과, 의뢰인v상대방
3. **그룹화 정렬**: main_case_id 기반 그룹화 토글 옵션
4. **UI 개선**: 서브사건 인덴트 표시, 심급 뱃지

### Definition of Done
- [ ] 사건 목록에 사건번호, 법원, 결과 컬럼 표시
- [ ] "의뢰인 v 상대방" 형식으로 당사자 표시
- [ ] 주사건 그룹화 토글 동작
- [ ] 서브사건이 주사건 아래 인덴트되어 표시
- [ ] 기존 검색/필터 기능 정상 동작
- [ ] 3000건 기준 성능 유지 (페이지네이션)

---

## Guardrails

### Must Have
- 기존 테이블/카드 뷰 유지
- 반응형 레이아웃 (모바일 대응)
- 정렬 가능 컬럼 유지

### Must NOT Have
- case_parties 생성/수정 기능 (읽기 전용)
- 새로운 API 엔드포인트 (기존 확장)
- 복잡한 쿼리로 인한 성능 저하

---

## Task Flow

```
[1] API 확장 (case_parties JOIN)
         |
         v
[2] 타입 정의 확장 (LegalCase interface)
         |
         v
[3] 컬럼 추가 (CasesList.tsx)
         |
         v
[4] 주사건 그룹화 로직
         |
         v
[5] 그룹화 UI (토글 + 인덴트)
         |
         v
[6] 테스트 및 최적화
```

---

## Detailed TODOs

### Task 1: API 확장 - case_parties, case_clients JOIN (선택적)
**File:** `app/api/admin/cases/route.ts`

**⚠️ 참고:** 현재 page.tsx가 API를 사용하지 않고 직접 Supabase 쿼리를 함.
따라서 Task 1은 선택적이며, Task 8이 필수임.
Task 1은 향후 API 사용자를 위한 확장으로 구현.

**Changes:**
1. SELECT에 case_parties 추가 (v3: is_our_client 삭제됨!):
```typescript
.select(`
  id, contract_number, case_name, case_type, status, contract_date,
  court_case_number, court_name, case_level, main_case_id,
  tenant_id, assigned_to,
  primary_client_id, primary_client_name,
  client:clients(id, name),
  assigned_member:tenant_members!assigned_to (...),
  case_assignees (...),
  case_parties (
    id, party_name, party_type, party_type_label, is_primary
  ),
  case_clients (
    client_id, linked_party_id, is_primary_client
  )
`)
// Note: client:clients = 레거시 fallback
// Note: court_name, case_level, main_case_id = 새로 추가
```

2. 응답 변환에서 당사자 정보 포맷팅 (**v3: 캐시 필드 + case_clients 사용**):
```typescript
// ⭐ 의뢰인: 캐시 필드 사용! (fallback: client JOIN)
const ourClientName = legalCase.primary_client_name || legalCase.client?.name

// ⭐ 상대방: case_clients.linked_party_id로 의뢰인 당사자 찾고, 반대측 조회
const clientPartyLink = case_clients?.find(cc => cc.is_primary_client)
const clientPartyId = clientPartyLink?.linked_party_id
const clientParty = case_parties?.find(p => p.id === clientPartyId)
const clientPartyType = clientParty?.party_type  // 'plaintiff' or 'defendant'

// 상대방 = 의뢰인과 반대 party_type 중 is_primary=true (대표)
let opponent = null
let opponentLabel = null
if (clientPartyType) {
  const opponentType = clientPartyType === 'plaintiff' ? 'defendant' : 'plaintiff'
  const opponentParty = case_parties?.find(p =>
    p.party_type === opponentType && p.is_primary
  ) || case_parties?.find(p => p.party_type === opponentType)
  opponent = opponentParty?.party_name || null
  opponentLabel = opponentParty?.party_type_label || null
} else {
  // ⭐ Fallback: case_clients가 없는 레거시 데이터
  const opponentParty = case_parties?.find(p => !p.is_primary)
  opponent = opponentParty?.party_name || null
  opponentLabel = opponentParty?.party_type_label || null
}

return {
  ...legalCase,
  parties: {
    ourClient: ourClientName || null,
    ourClientLabel: clientParty?.party_type_label || null,
    opponent,
    opponentLabel,
  }
}
```

**Acceptance Criteria:**
- API 응답에 `parties`, `court_name`, `case_level`, `main_case_id` 포함
- 의뢰인: **primary_client_name 캐시 필드** 사용
- 상대방: case_clients → case_parties 연결로 반대측 당사자 조회
- 기존 필드 그대로 유지

---

### Task 2: 타입 정의 확장
**File:** `components/CasesList.tsx`

**Changes:**
```typescript
interface LegalCase {
  // 기존 필드...
  court_name: string | null
  case_result: string | null
  case_result_date: string | null
  case_level: string | null
  main_case_id: string | null
  parties?: {
    ourClient: string | null
    ourClientLabel: string | null
    opponent: string | null
    opponentLabel: string | null
  }
}
```

**Acceptance Criteria:**
- TypeScript 컴파일 에러 없음

---

### Task 3: 컬럼 추가
**File:** `components/CasesList.tsx`

**New Columns:**
```typescript
const columns: Column<LegalCase>[] = [
  // 계약일 (기존)
  { key: 'contract_date', header: '계약일', width: '90px', sortable: true },

  // 사건번호 (NEW)
  {
    key: 'court_case_number',
    header: '사건번호',
    width: '140px',
    render: (item) => (
      <span className="text-body font-mono text-sm">
        {item.court_case_number || '-'}
      </span>
    )
  },

  // 법원 (NEW)
  {
    key: 'court_name',
    header: '법원',
    width: '100px',
    render: (item) => (
      <span className="text-caption truncate" title={item.court_name || ''}>
        {shortenCourtName(item.court_name) || '-'}
      </span>
    )
  },

  // 심급 (NEW - case_level 사용, status는 기존 상태 컬럼에서 표시)
  {
    key: 'case_level',
    header: '심급',
    width: '70px',
    render: (item) => item.case_level
      ? <CaseLevelBadge level={item.case_level} />
      : <span className="text-muted">-</span>
  },

  // 담당변호사 (기존 assignee 컬럼)
  { key: 'assignee', header: '담당', width: '100px' },

  // 사건명 (기존)
  { key: 'case_name', header: '사건명', sortable: true },

  // 의뢰인 v 상대방 (NEW - 기존 의뢰인 컬럼 대체)
  {
    key: 'parties',
    header: '당사자',
    width: '200px',
    render: (item) => <PartiesCell parties={item.parties} />
  },

  // 상태 (기존)
  { key: 'status', header: '상태', width: '70px' },
]
```

**Helper Components:**
```typescript
// 법원명 축약
function shortenCourtName(name: string | null): string | null {
  if (!name) return null
  return name
    .replace('지방법원', '지법')
    .replace('고등법원', '고법')
    .replace('대법원', '대법')
}

// 심급 뱃지 (case_level 값: '1심', '2심(항소심)', '3심(상고심)')
function CaseLevelBadge({ level }: { level: string }) {
  const colorMap: Record<string, string> = {
    '1심': 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)]',
    '2심(항소심)': 'bg-[var(--color-warning)]/10 text-[var(--color-warning)]',
    '3심(상고심)': 'bg-[var(--color-error)]/10 text-[var(--color-error)]',
  }
  // 축약 표시
  const shortLabel = level.replace('2심(항소심)', '항소심').replace('3심(상고심)', '상고심')
  return (
    <span className={`px-1.5 py-0.5 text-xs rounded ${colorMap[level] || ''}`}>
      {shortLabel}
    </span>
  )
}

// 당사자 셀
function PartiesCell({ parties }: { parties?: LegalCase['parties'] }) {
  if (!parties?.ourClient) return <span className="text-muted">-</span>

  return (
    <div className="text-body text-sm">
      <span className="font-medium">{parties.ourClient}</span>
      {parties.opponent && (
        <>
          <span className="text-muted mx-1">v</span>
          <span>{parties.opponent}</span>
        </>
      )}
    </div>
  )
}
```

**Acceptance Criteria:**
- 모든 컬럼 정상 렌더링
- 반응형 대응 (좁은 화면에서 truncate)

---

### Task 4: 주사건 그룹화 로직
**File:** `components/CasesList.tsx`

**State 추가:**
```typescript
const [groupByMainCase, setGroupByMainCase] = useState(false)
```

**그룹화 로직:**
```typescript
const processedCases = useMemo(() => {
  let filtered = [...cases]

  // 기존 필터/검색 로직...

  if (!groupByMainCase) {
    // 기존 정렬 로직
    return sortCases(filtered)
  }

  // 주사건 그룹화
  // 1. 주사건 (main_case_id가 null)과 서브사건 분리
  const mainCases = filtered.filter(c => !c.main_case_id)
  const subCases = filtered.filter(c => c.main_case_id)

  // 2. 서브사건을 main_case_id로 그룹화
  const subCaseMap = new Map<string, LegalCase[]>()
  for (const sub of subCases) {
    const mainId = sub.main_case_id!
    if (!subCaseMap.has(mainId)) {
      subCaseMap.set(mainId, [])
    }
    subCaseMap.get(mainId)!.push(sub)
  }

  // 3. 주사건 정렬 후 각 주사건 아래에 서브사건 삽입
  const sorted = sortCases(mainCases)
  const result: (LegalCase & { _isSubCase?: boolean })[] = []

  for (const main of sorted) {
    result.push(main)
    const subs = subCaseMap.get(main.id) || []
    // 서브사건도 정렬 (심급 순서)
    // 실제 DB 값: '1심', '2심(항소심)', '3심(상고심)'
    const sortedSubs = subs.sort((a, b) => {
      const levelOrder: Record<string, number> = {
        '1심': 1,
        '2심(항소심)': 2,
        '3심(상고심)': 3,
      }
      return (levelOrder[a.case_level || ''] || 0)
           - (levelOrder[b.case_level || ''] || 0)
    })
    for (const sub of sortedSubs) {
      result.push({ ...sub, _isSubCase: true })
    }
  }

  // 4. 주사건 없이 떠도는 서브사건 추가 (main_case_id가 필터링된 경우)
  const includedMainIds = new Set(sorted.map(m => m.id))
  const orphanSubs = subCases.filter(s => !includedMainIds.has(s.main_case_id!))
  result.push(...orphanSubs)

  return result
}, [cases, searchTerm, statusFilter, groupByMainCase, sortColumn, sortDirection])
```

**Acceptance Criteria:**
- 그룹화 ON: 주사건 아래 서브사건 정렬
- 그룹화 OFF: 기존 정렬 유지
- 필터링된 주사건의 서브사건은 별도 표시

---

### Task 5: 그룹화 UI
**File:** `components/CasesList.tsx`

**토글 버튼 추가 (Toolbar):**
```typescript
{/* Group Toggle */}
<button
  onClick={() => setGroupByMainCase(!groupByMainCase)}
  className={`btn btn-ghost btn-sm ${
    groupByMainCase ? 'bg-[var(--sage-muted)] text-[var(--sage-primary)]' : ''
  }`}
  title="주사건 그룹화"
>
  <Layers className="w-4 h-4" />
  <span className="hidden sm:inline ml-1">그룹화</span>
</button>
```

**서브사건 인덴트 표시:**
DataTable에서 직접 지원하지 않으므로, 사건명 컬럼에서 처리:
```typescript
{
  key: 'case_name',
  header: '사건명',
  sortable: !groupByMainCase,  // 그룹화 시 정렬 비활성화
  render: (item) => (
    <div className={`flex items-center gap-1.5 ${
      (item as any)._isSubCase ? 'pl-6' : ''
    }`}>
      {(item as any)._isSubCase && (
        <CornerDownRight className="w-3.5 h-3.5 text-muted flex-shrink-0" />
      )}
      {item.case_level && item.case_level !== '1심' && (
        <CaseLevelBadge level={item.case_level} />
      )}
      <span className="truncate max-w-[250px]">{item.case_name}</span>
      {item.onedrive_folder_url && (
        <Cloud className="w-4 h-4 text-[var(--color-info)] flex-shrink-0" />
      )}
    </div>
  ),
}
```

**Acceptance Criteria:**
- 그룹화 토글 버튼 동작
- 서브사건 인덴트 및 화살표 아이콘 표시
- 심급 뱃지 표시 (항소심, 상고심)

---

### Task 6: 카드 뷰 업데이트
**File:** `components/CasesList.tsx` - CaseCard 컴포넌트

**추가 표시 항목:**
```typescript
function CaseCard({ legalCase, formatDate, onClick, onPayment, onSchedule }: CaseCardProps) {
  return (
    <div onClick={onClick} className="card p-4 cursor-pointer hover:border-[var(--sage-primary)]">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {legalCase.case_level && legalCase.case_level !== '1심' && (
              <span className="px-1.5 py-0.5 text-xs rounded bg-[var(--color-warning)]/10 text-[var(--color-warning)]">
                {legalCase.case_level}
              </span>
            )}
            <h3 className="text-body font-semibold truncate">{legalCase.case_name}</h3>
          </div>
          {/* 당사자 표시 */}
          {legalCase.parties?.ourClient && (
            <p className="text-caption mt-0.5">
              {legalCase.parties.ourClient}
              {legalCase.parties.opponent && ` v ${legalCase.parties.opponent}`}
            </p>
          )}
        </div>
        <CaseStatusBadge status={legalCase.status} />
      </div>

      {/* Meta */}
      <div className="space-y-2 mb-4">
        {legalCase.court_case_number && (
          <div className="flex items-center justify-between text-caption">
            <span className="text-muted">사건번호</span>
            <span className="font-mono">{legalCase.court_case_number}</span>
          </div>
        )}
        {legalCase.court_name && (
          <div className="flex items-center justify-between text-caption">
            <span className="text-muted">법원</span>
            <span>{shortenCourtName(legalCase.court_name)}</span>
          </div>
        )}
        {legalCase.case_result && (
          <div className="flex items-center justify-between text-caption">
            <span className="text-muted">결과</span>
            <CaseResultBadge result={legalCase.case_result} />
          </div>
        )}
        {/* 기존: 계약일, 담당자 */}
      </div>

      {/* Actions */}
      ...
    </div>
  )
}
```

**Acceptance Criteria:**
- 카드 뷰에서 사건번호, 법원, 결과, 당사자 표시
- 심급 뱃지 표시

---

### Task 7: 검색 필터 확장
**File:** `components/CasesList.tsx`

**검색 대상 확장:**
```typescript
if (searchTerm) {
  const term = searchTerm.toLowerCase()
  filtered = filtered.filter(c =>
    c.contract_number?.toLowerCase().includes(term) ||
    c.case_name?.toLowerCase().includes(term) ||
    c.client?.name?.toLowerCase().includes(term) ||
    c.court_case_number?.toLowerCase().includes(term) ||  // NEW
    c.court_name?.toLowerCase().includes(term) ||         // NEW
    c.parties?.ourClient?.toLowerCase().includes(term) || // NEW
    c.parties?.opponent?.toLowerCase().includes(term)     // NEW
  )
}
```

**Acceptance Criteria:**
- 사건번호, 법원명, 당사자명으로 검색 가능

---

### Task 8: page.tsx 데이터 페칭 수정 (⭐ 필수)
**File:** `app/cases/page.tsx`

**⚠️ 이 태스크는 선택이 아닌 필수! 현재 page.tsx가 직접 Supabase 쿼리를 하고 있어 새 필드들이 누락됨.**

**Option B 적용 (쿼리 확장 - v3: 현재 스키마 반영):**
```typescript
let query = adminClient
  .from('legal_cases')
  .select(`
    *,
    client:clients(id, name),
    case_parties(id, party_name, party_type, party_type_label, is_primary),
    case_clients(client_id, linked_party_id, is_primary_client)
  `)
// Note: client:clients 유지 = 레거시 fallback용
```

**데이터 변환 로직 추가 (page.tsx 또는 CasesList):**
```typescript
// casesData에서 parties 필드 생성 (v4: 캐시 필드 + case_clients + 레거시 fallback)
const casesWithParties = casesData?.map(c => {
  const parties = c.case_parties || []
  const clients = c.case_clients || []

  // ⭐ 의뢰인: 캐시 필드 사용! (fallback: 기존 client JOIN)
  const ourClientName = c.primary_client_name || c.client?.name

  // ⭐ 상대방: case_clients → case_parties 연결로 조회
  const primaryClientLink = clients.find((cc: any) => cc.is_primary_client)
  const clientPartyId = primaryClientLink?.linked_party_id
  const clientParty = parties.find((p: any) => p.id === clientPartyId)
  const clientPartyType = clientParty?.party_type

  // 반대측 당사자 중 대표 (is_primary=true)
  let opponent = null
  let opponentLabel = null
  if (clientPartyType) {
    const opponentType = clientPartyType === 'plaintiff' ? 'defendant' : 'plaintiff'
    const opponentParty = parties.find((p: any) =>
      p.party_type === opponentType && p.is_primary
    ) || parties.find((p: any) => p.party_type === opponentType)
    opponent = opponentParty?.party_name || null
    opponentLabel = opponentParty?.party_type_label || null
  } else {
    // ⭐ Fallback: case_clients가 없는 레거시 데이터
    // 의뢰인이 아닌 첫 번째 당사자를 상대방으로 간주
    const opponentParty = parties.find((p: any) => !p.is_primary)
      || (parties.length > 1 ? parties[1] : null)
    opponent = opponentParty?.party_name || null
    opponentLabel = opponentParty?.party_type_label || null
  }

  return {
    ...c,
    parties: {
      ourClient: ourClientName || null,
      ourClientLabel: clientParty?.party_type_label || null,
      opponent,
      opponentLabel,
    }
  }
}) || []
```

**Acceptance Criteria:**
- ⭐ 초기 데이터에 `case_parties`, `court_name`, `case_level`, `main_case_id` 포함
- ⭐ `parties` 객체로 변환되어 CasesList에 전달
- 이 태스크 없이는 컬럼 추가가 동작하지 않음

---

## Commit Strategy

1. **API 확장 커밋**
   - `feat(api): add case_parties join to cases list API`

2. **컬럼 추가 커밋**
   - `feat(cases): add court_case_number, court_name, case_result columns`

3. **당사자 표시 커밋**
   - `feat(cases): display parties as "client v opponent" format`

4. **그룹화 기능 커밋**
   - `feat(cases): add main case grouping toggle`

5. **카드 뷰 업데이트 커밋**
   - `feat(cases): update card view with new fields`

---

## Success Criteria

### Functional
- [ ] 사건 목록에 8개 컬럼 표시 (계약일, 사건번호, 법원, 심급, 담당, 사건명, 당사자, 상태)
- [ ] 당사자 "의뢰인 v 상대방" 형식 표시 (**primary_client_name 캐시 기반**)
- [ ] 그룹화 토글 ON 시 주사건-서브사건 그룹핑
- [ ] 서브사건 인덴트 및 심급 뱃지 표시
- [ ] 검색에서 사건번호, 법원, 당사자 검색 가능

### Performance
- [ ] 3000건 목록 로딩 3초 이내
- [ ] 페이지네이션 정상 동작
- [ ] 그룹화 토글 반응 즉시 (클라이언트 처리)

### UX
- [ ] 컬럼 너비 적절
- [ ] 긴 텍스트 truncate + tooltip
- [ ] 모바일 반응형 대응

### Critical Data Flow (v3)
- [ ] ⭐ page.tsx에서 case_parties, case_clients JOIN 쿼리 적용
- [ ] ⭐ 의뢰인: `primary_client_name` 캐시 필드 사용
- [ ] ⭐ 상대방: case_clients.linked_party_id → 반대 party_type 조회

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| case_parties JOIN 성능 저하 | Medium | High | 필요한 필드만 SELECT, 인덱스 확인 |
| 컬럼 과다로 가독성 저하 | Medium | Medium | 반응형 숨김, 컬럼 너비 최적화 |
| 그룹화 로직 복잡도 | Low | Medium | 클라이언트 메모리 처리, 대량 데이터 시 서버 처리 검토 |

---

## Notes

- ⭐ **의뢰인: `primary_client_name` 캐시 필드 사용** (JOIN 불필요, 트리거 동기화)
- ⭐ **상대방: case_clients → case_parties 연결로 반대측 party_type 조회**
- `main_case_id`가 NULL이면 주사건, 값이 있으면 해당 ID의 서브사건
- `case_level` 실제 값: '1심', '2심(항소심)', '3심(상고심)'
- `is_our_client` 필드는 20260220 마이그레이션에서 **삭제됨** → `is_primary`로 대체

## v4 Changes (Critic v3 Feedback 반영 - 최종)

### 마이그레이션 상태 확인
- ✅ `20260214_case_parties_scourt_schema.sql`: `is_primary` 컬럼 추가됨
- ✅ `20260220_unify_parties_and_case_clients.sql`: `is_our_client` 삭제, `case_clients` 생성
- ✅ `supabase migration list`에서 20260220 적용 확인됨

### v4 수정 사항
1. ✅ `is_primary` 컬럼이 `20260214`에서 case_parties에 추가된 것 확인
2. ✅ 의뢰인: `primary_client_name` 캐시 필드 사용
3. ✅ 상대방: case_clients → linked_party_id → party_type → 반대측 조회
4. ✅ Task 1, 8: 기존 API가 이미 `primary_client_name` 사용 중 확인
5. ✅ 레거시 Fallback 추가 (case_clients 없는 경우 대응)
6. ✅ Success Criteria 수정 ("is_our_client 기반" → "primary_client_name 기반")

**참조 문서**: `/docs/CASE_CLIENTS_MIGRATION.md`
