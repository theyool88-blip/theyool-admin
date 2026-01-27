# Case Detail Performance Optimization Plan (Revised v2)

## Context

### Original Request
사건 상세 페이지 '일반' 탭 로딩이 느림. 성능 최적화 필요.

### Problem Analysis

현재 사건 상세 페이지 로딩 시 다음과 같은 성능 병목이 발생:

1. **테넌트 전체 기일 조회 (CRITICAL - O(N) Query)**
   - 사건 1개 조회 시 테넌트의 모든 사건 ID를 먼저 조회한 후 기일 조회
   - 사건 수가 많아질수록 성능 저하
   - **File:** `/Users/hskim/luseed/app/api/admin/cases/[id]/route.ts` lines 315-345
   - **File:** `/Users/hskim/luseed/components/CaseDetail.tsx` lines 1189-1207

2. **10개 이상의 순차/병렬 API 호출**
   - Batch 1: schedules, scourt snapshot, parties, members (4개)
   - Batch 2: clients, payments, notices, related-cases, contracts (5개)
   - 총 9개 이상의 개별 API 호출
   - **File:** `/Users/hskim/luseed/components/CaseDetail.tsx` lines 1300-1395

3. **서버/클라이언트 중복 데이터 페칭**
   - 서버 컴포넌트에서 case_relations 조회
   - 클라이언트에서 동일한 데이터 재요청 (scourt snapshot의 relatedCases)

4. **Scourt Snapshot 비효율**
   - 전체 스냅샷(`select('*')`) 조회로 불필요한 JSONB 필드 전송
   - rawData 등 대용량 필드 포함 (XML 렌더링용, 일반 탭에서만 필요)
   - **File:** `/Users/hskim/luseed/app/api/admin/scourt/snapshot/route.ts` lines 34-40

### Critic Feedback (Addressed)

1. **Task 1.2 + Task 2.2 Disconnect** - ScourtGeneralInfoXml은 pure render component로 fetch 기능 없음
   - **해결:** CaseDetail에서 탭 전환 시 rawData 별도 페치 (Option A 적용)

2. **Task 2.3 Incomplete** - 기일 충돌 감지 실행 시점/표시 방법 불명확
   - **해결:** Lazy Load After Initial Render (Option D 적용) - 초기 렌더 후 즉시 allHearings 페치

3. **Breaking UX Change** - 즉각적인 충돌 감지 제거는 기능적 회귀
   - **해결:** 하이드레이션 후 1-2초 내에 충돌 알림 표시 (subtle animation)

### User Requirements
1. '일반' 탭 로딩 속도 개선
2. 다른 기능에 문제가 없는지 철저한 검증 필요
3. 기존 기능 회귀 방지
4. **기일 충돌 감지 기능 유지** (UX 회귀 방지)

---

## Work Objectives

### Core Objective
사건 상세 페이지 '일반' 탭의 초기 로딩 시간을 50% 이상 단축하면서 기일 충돌 감지 기능 유지

### Deliverables
1. 최적화된 Bundle API 엔드포인트 (thin wrapper with smart parallelization)
2. Lazy loading 패턴 적용 (allHearings, rawData)
3. 기존 기능의 완전한 동작 보장 (기일 충돌 감지 포함)

### Definition of Done
- [ ] '일반' 탭 초기 로딩 시간 50% 단축 (측정 기준: Network waterfall)
- [ ] 기일 충돌 알림이 페이지 로드 후 2초 이내에 표시됨
- [ ] rawData가 '일반' 탭 활성화 시에만 로드됨
- [ ] 기존 모든 기능 정상 동작 (당사자 표시, 일정, 결제, 알림 등)
- [ ] 테스트 사건 최소 3개에서 수동 검증 완료
- [ ] 콘솔 에러 없음

---

## Must Have / Must NOT Have

### Must Have
- 기존 UI/UX 완전 유지
- **기일 충돌 알림 기능 유지** (페이지 로드 후 2초 이내 표시)
- 모든 당사자 정보 정상 표시
- 일정/기일/기한 정보 정상 표시
- 알림 기능 정상 동작
- 결제 정보 정상 표시

### Must NOT Have
- UI 레이아웃 변경
- 새로운 라이브러리 추가
- 데이터베이스 스키마 변경
- 기존 API 응답 구조의 Breaking Change
- **기일 충돌 감지 기능 제거 또는 지연** (2초 이상)

---

## Task Flow and Dependencies

```
[Phase 1: Server-Side Optimization]
    |
    +-- Task 1.1: Bundle API 엔드포인트 생성 (Thin Wrapper)
    |       - /api/admin/cases/[id]/bundle
    |       - ?include= 파라미터로 유연한 데이터 요청
    |       - 기존 개별 엔드포인트 유지 (조합 레이어)
    |
    +-- Task 1.2: GET /api/admin/scourt/snapshot 최적화
            - rawData 기본 제외, includeRawData 파라미터 추가

[Phase 2: Client-Side Optimization]
    |
    +-- Task 2.1: CaseDetail.tsx 초기 로딩 최적화
    |       - Bundle API로 초기 데이터 통합 요청
    |       - allHearings는 초기 요청에서 제외
    |
    +-- Task 2.2: allHearings Lazy Loading (Option D)
    |       - 하이드레이션 후 즉시 allHearings 페치
    |       - 기일 충돌 감지 실행
    |       - CaseNoticeSection 업데이트 (subtle animation)
    |
    +-- Task 2.3: rawData 탭 전환 시 Lazy Loading
            - activeTab === 'general' 시 rawData 페치
            - ScourtGeneralInfoXml은 pure render 유지

[Phase 3: Verification]
    |
    +-- Task 3.1: 기능 회귀 테스트
    |       - 당사자 표시 검증
    |       - 일정/기일 표시 검증
    |       - **기일 충돌 알림 검증** (2초 이내 표시)
    |       - 알림 기능 검증
    |       - 결제 정보 검증
    |
    +-- Task 3.2: 성능 측정
            - 최적화 전/후 비교
            - Network waterfall 분석
```

---

## Detailed TODOs

### Phase 1: Server-Side Optimization

#### Task 1.1: Bundle API 엔드포인트 생성 (Thin Wrapper)
**File:** `/Users/hskim/luseed/app/api/admin/cases/[id]/bundle/route.ts` (NEW)

**Purpose:**
- 여러 개별 API 호출을 하나의 요청으로 통합
- `?include=` 파라미터로 필요한 데이터만 선택적 요청
- 기존 개별 엔드포인트 유지 (조합 레이어 역할)

**API Design:**
```typescript
// Initial load - fast (allHearings 제외)
GET /api/admin/cases/${id}/bundle?include=basic,hearings,deadlines,parties

// After hydration - conflict detection
GET /api/admin/cases/${id}/bundle?include=allHearings

// General tab activation
GET /api/admin/cases/${id}/bundle?include=snapshot,rawData

// 또는 개별 조합
GET /api/admin/cases/${id}/bundle?include=parties,paymentTotal,dismissedNotices,contracts
```

**Include Options:**
| Option | Description | 기존 Source |
|--------|-------------|-------------|
| `basic` | Case 기본 정보 (caseData에서 이미 제공) | server component |
| `hearings` | 해당 사건 기일 | court_hearings |
| `deadlines` | 해당 사건 기한 | case_deadlines |
| `parties` | 당사자 + caseClients | /api/admin/cases/[id]/parties |
| `allHearings` | 테넌트 전체 기일 (충돌 감지용) | court_hearings + legal_cases |
| `paymentTotal` | 결제 총액 (sum만) | payments |
| `dismissedNotices` | 해제된 알림 ID | /api/admin/cases/[id]/notices |
| `dismissedRelatedCases` | 해제된 관련사건 | /api/admin/cases/[id]/related-cases |
| `contracts` | 계약서 파일 | /api/admin/cases/[id]/contracts |
| `snapshot` | Scourt 스냅샷 (rawData 제외) | /api/admin/scourt/snapshot |
| `rawData` | Scourt rawData | scourt_case_snapshots.raw_data |
| `clients` | 전체 의뢰인 목록 (모달용) | /api/admin/clients |
| `members` | 테넌트 멤버 목록 | /api/admin/tenant/members |

**Implementation Steps:**
1. 새 route 파일 생성: `/Users/hskim/luseed/app/api/admin/cases/[id]/bundle/route.ts`
2. `include` 파라미터 파싱 및 validation
3. 요청된 데이터만 Promise.all로 병렬 조회
4. 각 조회 try-catch로 에러 격리
5. 통합 응답 객체 반환

**Acceptance Criteria:**
- [ ] `?include=` 파라미터로 필요한 데이터만 요청 가능
- [ ] 개별 조회 실패 시에도 부분 응답 가능 (에러 격리)
- [ ] 응답에 각 데이터 키별 성공/실패 상태 포함
- [ ] 기존 API 호출 대비 50% 이상 빠른 응답

**UX Impact:** 없음 (내부 API 변경)

---

#### Task 1.2: GET /api/admin/scourt/snapshot 최적화
**File:** `/Users/hskim/luseed/app/api/admin/scourt/snapshot/route.ts`
**Lines:** 34-40, 77, 82-92

**Current Problem:**
```typescript
// Line 36: 전체 스냅샷 조회 - 대용량 rawData JSONB 포함
.select('*')

// Line 77: rawData 항상 포함
const rawData = snapshot?.raw_data || extractRawData(snapshot?.basic_info) || null;
```

**Solution:**
- 기본 조회시 raw_data 컬럼 제외
- `?includeRawData=true` 파라미터로 rawData 포함 요청 가능

**Implementation Steps:**
1. Line 36 수정: `select('*')` → `select('id, scraped_at, case_type, basic_info, hearings, progress, documents, lower_court, related_cases')`
2. URL searchParams에서 `includeRawData` 파라미터 파싱 (Line 22 이후)
3. `includeRawData=true` 시에만 raw_data 조회 (별도 쿼리 또는 select 변경)
4. 응답의 rawData 필드는 `includeRawData=true` 시에만 값 포함, 아니면 undefined

**Code Changes:**
```typescript
// Line 22 이후 추가
const includeRawData = searchParams.get('includeRawData') === 'true';

// Line 34-40 수정
const selectFields = includeRawData
  ? '*'
  : 'id, scraped_at, case_type, basic_info, hearings, progress, documents, lower_court, related_cases';

const { data: snapshot, error: snapshotError } = await supabase
  .from('scourt_case_snapshots')
  .select(selectFields)
  .eq('legal_case_id', caseId)
  .order('scraped_at', { ascending: false })
  .limit(1)
  .single();

// Line 77 수정
const rawData = includeRawData
  ? (snapshot?.raw_data || extractRawData(snapshot?.basic_info) || null)
  : undefined;
```

**Acceptance Criteria:**
- [ ] 기본 조회시 rawData 제외 (응답 크기 감소)
- [ ] `?includeRawData=true` 파라미터로 rawData 포함 가능
- [ ] 기존 응답 구조 유지 (rawData 필드 optional)
- [ ] Breaking Change 없음

**UX Impact:** 없음 (내부 API 변경, '일반' 탭 활성화 시 rawData lazy load)

---

### Phase 2: Client-Side Optimization

#### Task 2.1: CaseDetail.tsx 초기 로딩 최적화
**File:** `/Users/hskim/luseed/components/CaseDetail.tsx`
**Lines:** 1300-1395 (Batch 1, Batch 2)

**Current Problem:**
```typescript
// Lines 1300-1316: Batch 1 - 4개 API 호출
await Promise.all([
  fetchAllSchedules(),     // allHearings 포함 (느림)
  fetchScourtSnapshot(),   // rawData 포함 (느림)
  fetchCaseParties(),
  fetchTenantMembers(),
]);

// Lines 1318-1395: Batch 2 - 5개 개별 fetch
await Promise.all([
  fetch("/api/admin/clients"),
  payments 조회,
  fetch(`/api/admin/cases/${caseData.id}/notices`),
  fetch(`/api/admin/cases/${caseData.id}/related-cases`),
  fetch(`/api/admin/cases/${caseData.id}/contracts`),
]);
```

**Solution:**
1. Bundle API로 초기 요청 통합 (allHearings, rawData 제외)
2. clients fetch는 모달 열 때만 지연 로딩
3. fetchAllSchedules에서 allHearings 조회 제거 (Task 2.2로 분리)

**Implementation Steps:**

1. **fetchAllSchedules 수정 (Line 1156-1298)**
   - allHearings 조회 로직 제거 (Lines 1189-1207)
   - 해당 사건의 hearings, deadlines, schedules만 조회

2. **새 함수 추가: fetchInitialBundle**
```typescript
const fetchInitialBundle = useCallback(async () => {
  try {
    const res = await fetch(
      `/api/admin/cases/${caseData.id}/bundle?include=parties,paymentTotal,dismissedNotices,dismissedRelatedCases,contracts,members`
    );
    const data = await res.json();

    if (data.parties) setCaseParties(data.parties);
    if (data.caseClients) setCaseClients(data.caseClients);
    if (data.paymentTotal !== undefined) setPaymentTotal(data.paymentTotal);
    if (data.dismissedNotices) setDismissedNoticeIds(new Set(data.dismissedNotices));
    if (data.dismissedRelatedCases) {
      const dismissedSet = new Set<string>(
        data.dismissedRelatedCases.map(
          (d: { related_case_no: string; related_case_type: string }) =>
            `${d.related_case_type}:${d.related_case_no}`
        )
      );
      setDismissedRelatedCases(dismissedSet);
    }
    if (data.contracts) setContractFiles(data.contracts);
    if (data.members) setTenantMembers(data.members);
  } catch (error) {
    console.error('Initial bundle fetch failed:', error);
  }
}, [caseData.id]);
```

3. **Batch 1 수정 (Lines 1300-1316)**
```typescript
useEffect(() => {
  const fetchCriticalData = async () => {
    await Promise.all([
      fetchAllSchedules(),     // allHearings 제외됨
      fetchScourtSnapshot(),   // rawData 제외됨 (Task 1.2)
      fetchInitialBundle(),    // parties, payments, notices 등 통합
    ]);
  };
  fetchCriticalData();
}, [fetchAllSchedules, fetchScourtSnapshot, fetchInitialBundle]);
```

4. **Batch 2 제거** - fetchInitialBundle로 통합됨

5. **clients fetch 지연 로딩**
   - Batch 2에서 clients fetch 제거
   - 모달 열 때만 clients 조회 (기존 코드 확인 후 적용)

**Acceptance Criteria:**
- [ ] 초기 API 호출 수 10개 -> 4개로 감소 (schedules, snapshot, bundle, fetchCaseParties 제거)
- [ ] allHearings는 초기 로딩에서 제외
- [ ] rawData는 초기 로딩에서 제외
- [ ] 모든 기존 상태 정상 업데이트

**UX Impact:** 없음 (동일한 데이터 표시, 더 빠른 로딩)

---

#### Task 2.2: allHearings Lazy Loading (Option D - Lazy Load After Initial Render)
**File:** `/Users/hskim/luseed/components/CaseDetail.tsx`

**Purpose:**
- 초기 페이지 렌더링 속도 향상
- 하이드레이션 후 즉시 allHearings 페치
- 기일 충돌 알림 1-2초 내에 표시 (UX 회귀 없음)

**Implementation Steps:**

1. **새 상태 추가 (Line 470 근처)**
```typescript
const [allHearingsLoading, setAllHearingsLoading] = useState(false);
const [noticesReady, setNoticesReady] = useState(false);
```

2. **새 함수 추가: fetchAllHearingsLazy**
```typescript
const fetchAllHearingsLazy = useCallback(async () => {
  setAllHearingsLoading(true);
  try {
    const res = await fetch(
      `/api/admin/cases/${caseData.id}/bundle?include=allHearings`
    );
    const data = await res.json();

    if (data.allHearings) {
      setAllHearings(data.allHearings);
    }
  } catch (error) {
    console.error('allHearings lazy fetch failed:', error);
  } finally {
    setAllHearingsLoading(false);
    setNoticesReady(true);
  }
}, [caseData.id]);
```

3. **하이드레이션 후 즉시 실행 (새 useEffect 추가)**
```typescript
// 하이드레이션 후 즉시 allHearings 페치 (기일 충돌 감지용)
useEffect(() => {
  // setTimeout(0)으로 초기 렌더링 완료 후 실행
  const timeoutId = setTimeout(() => {
    fetchAllHearingsLazy();
  }, 0);

  return () => clearTimeout(timeoutId);
}, [fetchAllHearingsLazy]);
```

4. **detectCaseNotices 호출 조건 수정 (Lines 1657-1693)**
   - allHearings가 로드된 후에만 충돌 감지 실행
   - noticesReady 상태로 애니메이션 트리거

5. **CaseNoticeSection 업데이트 (subtle animation)**
   - 충돌 알림이 추가될 때 fade-in 애니메이션 적용
   - **File:** `/Users/hskim/luseed/components/case/CaseNoticeSection.tsx`

**Execution Flow:**
```
Phase 1: 초기 렌더 (caseHearings만 사용)
  └─ detectCaseNotices({ allHearings: [] }) → 충돌 알림 없음

Phase 2: setTimeout(0) → fetchAllHearingsLazy()
  └─ setAllHearings(data.allHearings)

Phase 3: allHearings 업데이트 시 useEffect 트리거
  └─ detectCaseNotices({ allHearings: [...] }) → 충돌 알림 생성

Phase 4: CaseNoticeSection 리렌더
  └─ 새 충돌 알림 fade-in 애니메이션으로 표시
```

**Acceptance Criteria:**
- [ ] 초기 로딩 시 allHearings 쿼리 없음
- [ ] 페이지 로드 후 2초 이내에 기일 충돌 알림 표시
- [ ] 충돌 알림 추가 시 부드러운 fade-in 애니메이션
- [ ] 기존 기일 충돌 감지 로직 완전 유지

**UX Impact:**
- **변경:** 기일 충돌 알림이 즉시 → 1-2초 후 표시
- **완화:** fade-in 애니메이션으로 자연스러운 UX 유지
- **이점:** 초기 로딩 50% 이상 단축

---

#### Task 2.3: rawData 탭 전환 시 Lazy Loading
**File:** `/Users/hskim/luseed/components/CaseDetail.tsx`

**Purpose:**
- '일반' 탭 활성화 시에만 rawData 로드
- ScourtGeneralInfoXml은 pure render component 유지
- 초기 스냅샷은 rawData 없이 로드

**Implementation Steps:**

1. **새 상태 추가**
```typescript
const [rawDataLoaded, setRawDataLoaded] = useState(false);
const [rawDataLoading, setRawDataLoading] = useState(false);
```

2. **탭 전환 시 rawData 페치 (새 useEffect 추가)**
```typescript
// '일반' 탭 활성화 시 rawData lazy load
useEffect(() => {
  if (activeTab === 'general' && !rawDataLoaded && scourtSyncStatus?.isLinked) {
    const fetchRawData = async () => {
      setRawDataLoading(true);
      try {
        const res = await fetch(
          `/api/admin/scourt/snapshot?caseId=${caseData.id}&includeRawData=true`
        );
        const data = await res.json();

        if (data.success && data.snapshot?.rawData) {
          setScourtSnapshot(prev => prev ? {
            ...prev,
            rawData: data.snapshot.rawData
          } : null);
          setRawDataLoaded(true);
        }
      } catch (error) {
        console.error('rawData fetch failed:', error);
      } finally {
        setRawDataLoading(false);
      }
    };

    fetchRawData();
  }
}, [activeTab, rawDataLoaded, scourtSyncStatus?.isLinked, caseData.id]);
```

3. **ScourtGeneralInfoXml 렌더링 조건 수정 (Lines 3456-3484)**
```typescript
{activeTab === "general" && (
  <>
    {rawDataLoading ? (
      <div className="animate-pulse space-y-4">
        <div className="h-48 bg-[var(--bg-tertiary)] rounded-lg"></div>
        <div className="h-32 bg-[var(--bg-tertiary)] rounded-lg"></div>
      </div>
    ) : !scourtSnapshot?.rawData ? (
      <div className="text-[var(--text-tertiary)] text-sm p-4 bg-[var(--bg-primary)] rounded-lg">
        SCOURT 연동 데이터가 없습니다.
      </div>
    ) : (
      <ScourtGeneralInfoXml
        apiData={scourtSnapshot.rawData}
        // ... 기존 props
      />
    )}
  </>
)}
```

4. **fetchScourtSnapshot 수정 (Line 481-500)**
   - `includeRawData=true` 파라미터 제거 (기본값 false)
   - rawData 없이 스냅샷 로드

**Acceptance Criteria:**
- [ ] 초기 스냅샷 로드 시 rawData 미포함
- [ ] '일반' 탭 클릭 시에만 rawData 페치
- [ ] rawData 로딩 중 skeleton UI 표시
- [ ] rawData 로드 후 ScourtGeneralInfoXml 정상 렌더링
- [ ] ScourtGeneralInfoXml은 pure render component 유지 (fetch 로직 없음)

**UX Impact:**
- **변경:** '일반' 탭 클릭 시 1-2초 로딩 (skeleton 표시)
- **이점:** 초기 페이지 로딩 속도 향상
- **완화:** 탭 클릭 빈도가 낮으므로 영향 최소화

---

### Phase 3: Verification

#### Task 3.1: 기능 회귀 테스트
**Manual Testing Checklist:**

**당사자 표시 검증:**
- [ ] 원고/피고 당사자 목록 정상 표시
- [ ] 의뢰인 마킹 정상 표시
- [ ] 당사자 이름 수정 기능 동작
- [ ] 대리인 정보 표시

**일정/기일 표시 검증:**
- [ ] 기일 목록 정상 표시
- [ ] 기한 목록 정상 표시
- [ ] 일정 추가/수정/삭제 동작

**기일 충돌 알림 검증 (CRITICAL):**
- [ ] 페이지 로드 후 2초 이내에 충돌 알림 표시
- [ ] 충돌 알림 fade-in 애니메이션 정상 동작
- [ ] 충돌 알림 내용 정확 (날짜, 기일 유형)
- [ ] 충돌 알림 액션 (삭제, 변호사 변경 등) 정상 동작

**알림 기능 검증:**
- [ ] 사건 알림 표시
- [ ] 알림 해제 기능
- [ ] 관련사건 알림 표시

**결제 정보 검증:**
- [ ] 결제 총액 표시
- [ ] 결제 모달 동작

**Scourt 연동 검증:**
- [ ] 스냅샷 데이터 표시
- [ ] 진행내용 목록 표시
- [ ] '일반' 탭 클릭 시 XML 렌더링 정상 동작
- [ ] '일반' 탭 rawData 로딩 skeleton 표시

---

#### Task 3.2: 성능 측정
**Metrics to Capture:**

1. **Network Waterfall (Before/After)**
   - 총 API 요청 수
   - 총 전송 바이트
   - 가장 느린 요청 시간
   - DOMContentLoaded 시간

2. **측정 환경**
   - 테스트 사건: 최소 3개 (당사자 많은 사건, 스냅샷 있는 사건, 일반 사건)
   - 브라우저: Chrome DevTools Network 탭
   - 캐시: 비활성화 상태

3. **기일 충돌 알림 표시 시간**
   - 페이지 로드 완료 후 충돌 알림 표시까지 시간 측정
   - 목표: 2초 이내

**Success Criteria:**
- [ ] API 요청 수 50% 감소 (10개 -> 5개 이하)
- [ ] 총 전송 바이트 30% 감소
- [ ] 체감 로딩 시간 50% 단축
- [ ] 기일 충돌 알림 2초 이내 표시

---

## Commit Strategy

### Commit 1: Bundle API endpoint
```
feat(api): add case data bundle endpoint with include parameter

- Create /api/admin/cases/[id]/bundle route
- Support ?include= parameter for selective data fetching
- Combine parties, payments, notices, contracts in parallel
- Implement error isolation for partial responses
```

### Commit 2: Snapshot API optimization
```
perf(api): optimize scourt snapshot API with optional rawData

- Add includeRawData parameter to snapshot GET endpoint
- Exclude raw_data column by default
- Reduce default response size significantly
```

### Commit 3: Client-side initial loading optimization
```
perf(CaseDetail): optimize initial data fetching with bundle API

- Replace Batch 2 API calls with bundle endpoint
- Remove allHearings from initial fetchAllSchedules
- Defer clients list fetch to modal open
```

### Commit 4: allHearings lazy loading
```
perf(CaseDetail): implement lazy loading for allHearings

- Add fetchAllHearingsLazy for conflict detection
- Execute after hydration with setTimeout(0)
- Display conflict notices within 2 seconds
- Add fade-in animation for new notices
```

### Commit 5: rawData tab-based lazy loading
```
perf(CaseDetail): implement rawData lazy loading on tab activation

- Fetch rawData only when general tab is activated
- Keep ScourtGeneralInfoXml as pure render component
- Add loading skeleton for rawData fetch
```

### Commit 6: Verification and documentation
```
test: verify case detail performance optimization

- Add performance measurement baseline
- Document optimization results
- Verify all functionality including conflict detection
```

---

## Success Criteria Summary

| Metric | Before | Target | Method |
|--------|--------|--------|--------|
| API calls on load | 10+ | <= 5 | Count in Network tab |
| allHearings query | Always | Lazy (after hydration) | Code review |
| Scourt rawData | Always | Lazy (on tab click) | Code review |
| Batch 2 calls | 5 separate | 1 bundle | Code review |
| Page load time | Baseline | -50% | DevTools measurement |
| Conflict notice display | Immediate | <= 2 seconds | Manual timing |

---

## Risk Identification

### Risk 1: 기일 충돌 알림 지연 (UX 회귀)
**Impact:** Medium
**Mitigation:**
- setTimeout(0)으로 즉시 실행하여 지연 최소화 (1-2초 목표)
- fade-in 애니메이션으로 자연스러운 UX 제공
- 사용자 테스트로 수용 가능 여부 확인

### Risk 2: rawData 누락으로 XML 렌더링 실패
**Impact:** High
**Mitigation:**
- '일반' 탭 활성화 시 즉시 rawData 페치
- 로딩 중 skeleton UI 표시
- 에러 시 적절한 fallback 메시지

### Risk 3: Bundle API 부분 실패
**Impact:** Low
**Mitigation:**
- 개별 쿼리 try-catch로 격리
- 실패한 항목만 에러 표시, 성공한 항목은 정상 반환
- 응답에 각 항목별 성공/실패 상태 포함

### Risk 4: 기존 API 호출자 Breaking Change
**Impact:** High
**Mitigation:**
- 기존 API 엔드포인트 유지 (새 bundle API는 추가)
- snapshot API의 includeRawData는 opt-in (기본값 false)
- 기존 동작 유지, 새 파라미터만 opt-in

---

## Files Affected

### Modified Files
1. `/Users/hskim/luseed/app/api/admin/scourt/snapshot/route.ts`
   - Line 22: includeRawData 파라미터 파싱 추가
   - Lines 34-40: select 필드 조건부 설정
   - Line 77: rawData 조건부 포함

2. `/Users/hskim/luseed/components/CaseDetail.tsx`
   - Line 470: allHearingsLoading, noticesReady, rawDataLoaded, rawDataLoading 상태 추가
   - Lines 1156-1207: fetchAllSchedules에서 allHearings 제거
   - Lines 1300-1316: Batch 1 수정 (fetchInitialBundle 추가)
   - Lines 1318-1395: Batch 2 제거
   - New: fetchInitialBundle, fetchAllHearingsLazy 함수
   - New: allHearings lazy loading useEffect
   - New: rawData tab-based lazy loading useEffect
   - Lines 3456-3484: rawData 로딩 skeleton 추가

3. `/Users/hskim/luseed/components/case/CaseNoticeSection.tsx`
   - 새 알림 추가 시 fade-in 애니메이션

### New Files
1. `/Users/hskim/luseed/app/api/admin/cases/[id]/bundle/route.ts` - 통합 데이터 API

### Dependencies
- `lib/supabase/admin.ts` - 기존 어드민 클라이언트 사용
- `lib/auth/tenant-context.ts` - 테넌트 컨텍스트 유지
- `lib/case/notice-detector.ts` - detectScheduleConflicts 함수 (변경 없음)
