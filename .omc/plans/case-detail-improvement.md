# Case Detail Page Improvement Plan

## Context

### Original Request
사건 상세 페이지 개선:
1. 다른 국내/외국 법률사건관리 프로그램에서 사건정보를 표현하는 방식 연구
2. 심플하고 직관적인 UI 적용
3. 버그 수정:
   - 가. 히어로에 나오는 원고, 피고 등 당사자에 의뢰인 표시가 나오지 않음
   - 나. 일반 탭에 당사자의 이름을 아는 경우에도 마스킹이 되는 경우가 있음
   - 다. 관련사건, 심급사건의 경우 바로 연동하지 않고, 모두 알림탭의 관련사건에 연동할지 말지 선택하도록 하기
   - 관련사건을 누르면, 그 관련사건의 일반내역과 진행내역을 볼 수 있는 팝업이 뜨도록 하기
4. 성능개선
5. 알림에 뜨는 아이콘이 세련되어야 함 (현재는 촌스러움)

### Interview Summary
N/A - Direct RALPLAN session

### Research Findings (Legal Case Management UI Best Practices)

Based on industry research (Clio, MyCase, PracticePanther, Linear):

1. **Efficient Elegance Design**: Clean interface with optimized navigation and intelligent visual data representation
2. **Visual Hierarchy**: Clear hierarchy using font size, color, layout - key elements receive appropriate emphasis
3. **Dashboard Patterns**: At-a-glance overview of pending tasks, quick links to essential sections
4. **Case Detail Features**: Maximum information in case record including documents, notes, contact data
5. **Interactive Data**: Graphs with hover interactions, clean interfaces that display information on demand
6. **Modern Icon Systems**: Lucide React, Heroicons, or Phosphor icons instead of emoji icons
7. **Performance**: Lazy loading, efficient data fetching, React Query/SWR patterns

---

## Work Objectives

### Core Objective
Improve the case detail page (`/cases/[id]`) to be more intuitive, performant, bug-free, and visually refined while following modern legal tech UI best practices.

### Deliverables
1. **Bug Fix 3a**: Hero section client indicator display
2. **Bug Fix 3b**: Party name masking logic fix in general tab
3. **Bug Fix 3c+d**: Related case linking workflow + preview popup
4. **UI Enhancement**: Replace emoji icons with professional SVG icons
5. **UI Improvement**: Simplified, modern layout following best practices
6. **Performance**: Code splitting, optimized data fetching, reduced re-renders

### Definition of Done
- All 4 bugs are fixed and verified
- UI passes visual review against mockups
- Page load time < 2s on standard connection
- No TypeScript errors
- Existing test coverage maintained

---

## Guardrails

### Must Have
- Maintain full backward compatibility with existing data
- Preserve all current functionality
- Follow existing design system (`globals.css` variables)
- Support both light and dark themes
- Mobile responsive behavior

### Must NOT Have
- New npm dependencies without justification
- Breaking changes to API contracts
- Changes to database schema (this plan is UI-only)
- Remove any existing features

---

## Task Flow and Dependencies

```
[Phase 1: Bug Fixes] ─────────────────────────────────────────────────────────>
     │
     ├─ Task 1.1: Hero client indicator (independent)
     ├─ Task 1.2: Party masking logic (independent)
     └─ Task 1.3: Related case workflow + popup (depends on new API)

[Phase 2: Icon Modernization] ────────────────────────────────────────────────>
     │
     └─ Task 2.1: Replace emoji icons with SVG/Lucide icons

[Phase 3: UI Simplification] ─────────────────────────────────────────────────>
     │
     ├─ Task 3.1: Hero section refinement
     └─ Task 3.2: Tab content optimization

[Phase 4: Performance] ───────────────────────────────────────────────────────>
     │
     ├─ Task 4.1: Component splitting
     └─ Task 4.2: Data fetching optimization
```

---

## Detailed TODOs

### Phase 1: Bug Fixes

#### Task 1.1: Fix Hero Section Client Indicator
**Priority**: HIGH | **Estimated**: 1 hour

**Problem Analysis**:
The `renderPartyInfo()` function (lines 1721-1996 in CaseDetail.tsx) builds party groups. The `buildSideGroup()` function (lines 1886-1942) determines client side via `isClientSide` logic at line 1894:
```typescript
const isClientSide = primaryParties.clientSide ? side === primaryParties.clientSide : parties.some(p => p.is_primary)
```
This may not correctly set when `primaryParties.clientSide` is undefined and no party has `is_primary === true`.

**Files to Modify**:
- `components/CaseDetail.tsx` (lines 1886-1942, `buildSideGroup()` function)

**Implementation Steps**:
1. In `buildSideGroup()` function at line 1894, enhance `isClientSide` determination:
   - Check `primaryParties.clientSide` first (current behavior)
   - Fallback to checking if any party in the side has `is_primary === true` (current behavior)
   - **ADD**: Fallback to checking if `caseData.client_role` matches the side (e.g., 'plaintiff' or 'defendant')
   - **ADD**: Fallback to checking if `caseData.primary_client_id` exists and matches any party's linked client
2. Ensure the client indicator badge renders when `isClientSide` is true (lines 1956-1981)
3. Test with cases where:
   - `client_role` is set explicitly
   - `client_role` is null but `primary_client_id` exists
   - Multiple parties on the same side

**Acceptance Criteria**:
- [ ] Hero section shows "(의뢰인)" badge next to client party label
- [ ] Works with both `client_role` set and unset cases
- [ ] Consistent with party table in "일반" tab

---

#### Task 1.2: Fix Party Name Masking in General Tab
**Priority**: HIGH | **Estimated**: 1.5 hours

**Problem Analysis**:
The `ScourtGeneralInfoXml` component (1269 lines) displays party names with masking (e.g., "김OO") even when the actual name is known. The masking override logic exists but may not be properly applied in all cases.

**Key Code Locations in ScourtGeneralInfoXml.tsx**:
- `substitutePartyListNames()` function at lines 423-457: Substitutes masked names in party lists using `scourt_party_index`
- `confirmedParties` useMemo at lines 699-728: Extracts confirmed party names from `caseParties` prop
- `overriddenBasicInfo` useMemo at lines 738-762: Overrides masked names in basic info fields
- `effectiveApiData` memo at lines 770-830: Combines all overrides into final data for rendering

**Files to Modify**:
- `components/scourt/ScourtGeneralInfoXml.tsx` (lines 699-830)
- `components/CaseDetail.tsx` (ensure `caseParties` prop is correctly passed)

**Implementation Steps**:
1. Verify `caseParties` data is correctly passed to `ScourtGeneralInfoXml` component:
   - Check that `caseParties` includes `party_name` (non-masked), `scourt_party_index`, and `is_primary` fields
   - Check that `case_clients` linked names are resolved before passing
2. In `confirmedParties` useMemo (lines 699-728):
   - Ensure `resolveCasePartyName()` correctly checks for non-masked names
   - Verify that linked client names from `case_clients` are included
3. In `substitutePartyListNames()` (lines 423-457):
   - Verify `scourt_party_index` matching works correctly
   - Ensure `isMaskedPartyName()` detection handles all masking patterns
4. In `effectiveApiData` memo (lines 770-830):
   - Verify all party list fields are being substituted (`dlt_btprtCttLst`, `dlt_acsCttLst`)
5. Add visual indicator for manually overridden names

**Acceptance Criteria**:
- [ ] Known party names display without masking in general tab
- [ ] Linked client names from `case_clients` display correctly
- [ ] Manual overrides are preserved and displayed
- [ ] Unlinked/unknown parties still show masked names from SCOURT

---

#### Task 1.3: Related Case Workflow and Preview Popup
**Priority**: HIGH | **Estimated**: 4 hours

**Problem Analysis**:
Currently, related cases and appeal cases (심급사건) are detected by `detectUnlinkedRelatedCases()` in `notice-detector.ts` (lines 580-633) and displayed in the notice tab. The existing flow:
1. Notice detector finds unlinked cases (lines 587-632)
2. Notice section displays with "확인" action (view_related)
3. `RelatedCaseConfirmModal.tsx` exists for linking workflow

**CLARIFICATION**: Part A (consolidation to notice tab) is **already implemented** via `notice-detector.ts` lines 580-618. Task 1.3 Part A is **verification/refinement only**.

**New Requirement**: Add preview popup when clicking a related case number to show "일반내역" and "진행내역" before deciding to link.

**API Strategy for Preview Modal**:
Unlinked related cases only have `encCsNo` (encrypted case number from SCOURT) - no `legalCaseId`. To fetch preview data:
1. **Create new API endpoint**: `/api/admin/scourt/preview-related`
2. This API will:
   - Accept `encCsNo`, `caseNo`, `courtName`, and optionally `caseCategory`
   - Use `ScourtApiClient` to fetch general info and progress via `encCsNo`
   - Return structured data for preview display
3. **Implementation**: The SCOURT API client already supports fetching by `encCsNo` (see `api-client.ts` lines 700-810 for progress fetching pattern)

**Files to Create/Modify**:
- **CREATE**: `app/api/admin/scourt/preview-related/route.ts` - New API endpoint
- **CREATE**: `components/RelatedCasePreviewModal.tsx` - Preview modal component
- `components/case/CaseNoticeSection.tsx` - Wire click handler for case number
- `components/CaseDetail.tsx` - Add modal state and handlers
- `lib/case/notice-detector.ts` - Verify current behavior (lines 580-633)

**Implementation Steps**:

**Part A: Verify Current Related Case Notice Flow (ALREADY IMPLEMENTED)**
1. Verify `detectUnlinkedRelatedCases()` (lines 587-632) correctly detects unlinked cases
2. Verify notice displays in "알림" tab with "확인" action
3. Ensure "연동" button triggers existing `RelatedCaseConfirmModal` flow
4. Ensure "연동안함" calls `/api/admin/cases/[id]/related-cases` POST endpoint (lines 54-110)
5. Test with various case types

**Part B: Create Preview API Endpoint**
1. Create `/api/admin/scourt/preview-related/route.ts`:
   ```typescript
   // POST /api/admin/scourt/preview-related
   interface PreviewRequest {
     encCsNo: string           // Required: SCOURT encrypted case number
     caseNo: string            // e.g., "2025가소6582"
     courtName?: string        // e.g., "수원지방법원"
     caseCategory?: string     // e.g., "civil", "family"
   }

   interface PreviewResponse {
     success: boolean
     generalInfo?: {
       csNm: string            // 사건명
       cortNm: string          // 법원명
       prcdStsNm: string       // 진행상태
       rcptDt: string          // 접수일
       jdgNm: string           // 재판부
       parties: Array<{label: string, name: string}>
     }
     progress?: Array<{
       date: string
       event: string
       result?: string
     }>
     error?: string
   }
   ```
2. Use existing `ScourtApiClient` methods with stored WMONID for the source case
3. Parse and return structured preview data

**Part C: Create Related Case Preview Modal**
1. Create `RelatedCasePreviewModal.tsx` with:
   - Modal overlay with backdrop
   - Two-tab layout: "일반" and "진행"
   - Loading state while fetching
   - Error handling for failed fetches
   - Action buttons: "연동" and "연동안함"
2. Component interface:
   ```tsx
   interface RelatedCasePreviewModalProps {
     isOpen: boolean
     onClose: () => void
     relatedCaseInfo: {
       caseNo: string          // "2025가소6582"
       courtName: string       // "수원지방법원 평택지원"
       relationType: string    // "이의신청", "반소", "항소심" 등
       encCsNo?: string        // SCOURT 암호화된 사건번호
     }
     onLink: () => void        // Trigger linking
     onDismiss: () => void     // Dismiss (연동안함)
   }
   ```
3. Fetch preview data on modal open using new API
4. Display basic info in "일반" tab
5. Display progress history in "진행" tab

**Part D: Wire Modal to Notice Section**
1. In `CaseNoticeSection.tsx`, add click handler for related case notices
2. In `CaseDetail.tsx`:
   - Add state for preview modal: `previewModalOpen`, `selectedRelatedCase`
   - Add handler for opening preview
   - Add handlers for link/dismiss actions
3. Pass case number click to open preview instead of immediate action

**Acceptance Criteria**:
- [ ] All unlinked related cases appear in notice tab only (verify existing)
- [ ] Clicking case number opens preview modal
- [ ] Modal shows "일반" tab with basic case info from SCOURT
- [ ] Modal shows "진행" tab with progress history from SCOURT
- [ ] "연동" button in modal creates link and closes modal
- [ ] "연동안함" button dismisses the case from notices

**Test Cases**:
- [ ] Related case with valid `encCsNo` - preview should load
- [ ] Related case without `encCsNo` - show error/fallback message
- [ ] Preview after linking - modal should close, notice should disappear
- [ ] Preview after dismissing - modal should close, notice should disappear
- [ ] Network error during preview - show error state with retry

---

### Phase 2: Icon Modernization

#### Task 2.1: Replace Emoji Icons with Professional SVG Icons
**Priority**: MEDIUM | **Estimated**: 2 hours

**Problem Analysis**:
Current notification icons use emojis (defined in `types/case-notice.ts` lines 62-72):
```typescript
export const NOTICE_CATEGORY_ICONS: Record<NoticeCategory, string> = {
  next_hearing: '📅',
  deadline: '⏰',
  brief_required: '📝',
  document_issue: '📋',
  // ... etc
}
```

These appear unprofessional and inconsistent across platforms.

**BREAKING CHANGE WARNING**:
Changing `NOTICE_CATEGORY_ICONS` value type from `string` to `ReactNode` is a breaking change. Both the type definition and all consumers must be updated together.

**Files to Modify**:
- `types/case-notice.ts` (lines 62-72) - Change type from `string` to icon component type
- `components/case/CaseNoticeSection.tsx` (line 69) - Update icon rendering
- Create: `lib/icons/notice-icons.tsx` - New icon mapping file

**Implementation Steps**:
1. Create icon mapping file using Lucide React icons:
   ```tsx
   // lib/icons/notice-icons.tsx
   import { Calendar, Clock, FileText, FileWarning, Mail, AlertTriangle, User, Link2, BarChart } from 'lucide-react'
   import { LucideIcon } from 'lucide-react'

   export const NOTICE_ICONS: Record<NoticeCategory, LucideIcon> = {
     next_hearing: Calendar,
     deadline: Clock,
     brief_required: FileText,
     document_issue: FileWarning,
     evidence_pending: Mail,
     schedule_conflict: AlertTriangle,
     client_role_confirm: User,
     unlinked_related_case: Link2,
     unlinked_lower_court: BarChart,
   }
   ```
2. Update `types/case-notice.ts`:
   - Change `NOTICE_CATEGORY_ICONS` type from `Record<NoticeCategory, string>` to use icon components
   - OR deprecate the emoji mapping and use new icon file instead
3. Update `CaseNoticeSection.tsx` (line 69):
   - Change from rendering emoji string to rendering Lucide component
   - Before: `{icon}` (string)
   - After: `<Icon className="w-4 h-4 text-[var(--color-info)]" />` (component)
4. Style icons with appropriate colors using design system variables
5. Ensure icons work in both light and dark themes

**Icon Color Mapping**:
| Category | Icon | Color Variable |
|----------|------|----------------|
| next_hearing | Calendar | `--sage-primary` |
| deadline | Clock | `--color-warning` |
| brief_required | FileText | `--color-info` |
| document_issue | FileWarning | `--color-danger` |
| evidence_pending | Mail | `--color-info` |
| schedule_conflict | AlertTriangle | `--color-warning` |
| client_role_confirm | User | `--sage-primary` |
| unlinked_related_case | Link2 | `--color-info` |
| unlinked_lower_court | BarChart | `--color-info` |

**Acceptance Criteria**:
- [ ] All emoji icons replaced with Lucide React SVG icons
- [ ] Icons have appropriate semantic colors
- [ ] Icons render correctly in both themes
- [ ] Icon size is consistent (16-20px)
- [ ] No visual regression in notice items
- [ ] TypeScript compilation passes with no type errors

---

### Phase 3: UI Simplification

#### Task 3.1: Hero Section Refinement
**Priority**: MEDIUM | **Estimated**: 1.5 hours

**Problem Analysis**:
Current hero section is information-dense but could be more scannable. Apply Clio/Linear design patterns.

**Files to Modify**:
- `components/CaseDetail.tsx` (hero section, lines 2133-2321)

**Implementation Steps**:
1. Reorganize hero section layout:
   - Top row: Status badges (as-is)
   - Main title: Court + Case number (as-is)
   - Case name subtitle (as-is)
   - **Improved**: Party info with clear visual grouping
   - Action bar with cleaner button styling
2. Add subtle visual separators between sections
3. Improve badge styling for better hierarchy
4. Ensure touch targets are adequate on mobile

**Acceptance Criteria**:
- [ ] Hero section is more scannable
- [ ] Clear visual hierarchy established
- [ ] Action buttons have consistent styling
- [ ] Mobile-friendly touch targets

---

#### Task 3.2: Tab Content Optimization
**Priority**: LOW | **Estimated**: 1 hour

**Problem Analysis**:
Tab content areas can be simplified for better readability.

**Files to Modify**:
- `components/CaseDetail.tsx` (tab content sections)

**Implementation Steps**:
1. Add subtle section headers within tabs
2. Improve table cell padding consistency
3. Add empty state illustrations for empty sections
4. Ensure consistent card styling

**Acceptance Criteria**:
- [ ] Tab content has consistent padding/margins
- [ ] Empty states are user-friendly
- [ ] Tables are easier to scan

---

### Phase 4: Performance Optimization

#### Task 4.1: Component Code Splitting
**Priority**: MEDIUM | **Estimated**: 2 hours

**Problem Analysis**:
`CaseDetail.tsx` is 3000+ lines. This causes:
- Large bundle size
- Slow hot module replacement during development
- Difficult maintenance

**Files to Create/Modify**:
- Create: `components/case/CaseHeroSection.tsx`
- Create: `components/case/CaseNoticeTab.tsx`
- Create: `components/case/CaseGeneralTab.tsx`
- Create: `components/case/CaseProgressTab.tsx`
- Modify: `components/CaseDetail.tsx` (orchestrator)

**Implementation Steps**:
1. Extract hero section to `CaseHeroSection.tsx`
2. Extract notice tab content to `CaseNoticeTab.tsx`
3. Extract general tab content to `CaseGeneralTab.tsx`
4. Extract progress tab content to `CaseProgressTab.tsx`
5. Use `React.lazy` with `Suspense` for tab content
6. Keep shared state in parent `CaseDetail.tsx`

**Acceptance Criteria**:
- [ ] Each extracted component is < 500 lines
- [ ] No functionality regression
- [ ] Initial load includes only hero + active tab
- [ ] Tab switching feels instant

---

#### Task 4.2: Data Fetching Optimization
**Priority**: LOW | **Estimated**: 1.5 hours

**Problem Analysis**:
Multiple `useEffect` hooks fetch data independently, causing waterfall requests.

**Files to Modify**:
- `components/CaseDetail.tsx`
- Potentially create: `hooks/useCaseDetailData.ts`

**Implementation Steps**:
1. Consolidate related fetches into parallel batches:
   - Batch 1 (critical): schedules, parties, snapshot
   - Batch 2 (secondary): payments, contracts, dismissed notices
2. Use `Promise.all` for parallel fetching within batches
3. Consider using SWR/React Query pattern for caching (optional, if already in project)
4. Add loading skeletons for better perceived performance

**Acceptance Criteria**:
- [ ] Network waterfall reduced
- [ ] Loading states provide feedback
- [ ] No unnecessary re-fetches on tab switch

---

## Commit Strategy

| Commit | Description | Tasks |
|--------|-------------|-------|
| 1 | fix: hero section client indicator display | Task 1.1 |
| 2 | fix: party name masking in general tab | Task 1.2 |
| 3 | feat: related case preview API endpoint | Task 1.3 (Part B) |
| 4 | feat: related case preview modal and workflow | Task 1.3 (Parts A, C, D) |
| 5 | style: replace emoji icons with Lucide SVG icons | Task 2.1 |
| 6 | refactor: extract case detail sub-components | Task 4.1 |
| 7 | perf: optimize data fetching patterns | Task 4.2 |
| 8 | style: hero section and tab UI refinements | Task 3.1, 3.2 |

---

## Success Criteria

### Functional
- [ ] All 4 reported bugs are fixed
- [ ] Related case preview modal works as specified
- [ ] Icons are professional and themed

### Performance
- [ ] Initial page load < 2 seconds
- [ ] Tab switching < 200ms
- [ ] No jank during scroll

### Quality
- [ ] TypeScript strict mode passes
- [ ] No new console errors
- [ ] Lighthouse accessibility score maintained

### User Experience
- [ ] UI follows legal tech best practices (Clio, MyCase patterns)
- [ ] Mobile experience is not degraded
- [ ] Dark mode works correctly

---

## Risk Identification

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Breaking existing party display logic | HIGH | MEDIUM | Comprehensive testing with various case types |
| Related case preview API missing data | MEDIUM | MEDIUM | Fallback to basic info display; handle missing encCsNo gracefully |
| Component extraction breaks state | MEDIUM | MEDIUM | Incremental extraction with testing |
| Icon type change breaks consumers | MEDIUM | LOW | Update both types and consumers in same commit |
| SCOURT API rate limiting on preview | LOW | MEDIUM | Add caching for preview data |

---

## Verification Steps

1. **Manual Testing**:
   - Test hero section with 10+ different case types
   - Test general tab party masking with linked/unlinked clients
   - Test related case popup with both linked and unlinked cases
   - Test preview modal with valid/invalid encCsNo
   - Verify icons in light and dark themes

2. **Regression Testing**:
   - All existing case operations still work
   - SCOURT sync functionality unaffected
   - Payment modal still accessible
   - Related case linking still works via existing flow

3. **Performance Testing**:
   - Lighthouse audit before/after
   - Network tab waterfall comparison

4. **Edge Case Testing**:
   - Related case with no encCsNo
   - Related case from different court
   - Multiple related cases (batch preview)
   - Network failure during preview fetch

---

## References

- **Codebase Files**:
  - `/Users/hskim/luseed/components/CaseDetail.tsx` - Main component (3000+ lines)
    - `renderPartyInfo()`: lines 1721-1996
    - `buildSideGroup()`: lines 1886-1942
    - `isClientSide` logic: line 1894
  - `/Users/hskim/luseed/components/CasePartiesSection.tsx` - Party display
  - `/Users/hskim/luseed/components/case/CaseNoticeSection.tsx` - Notice rendering
  - `/Users/hskim/luseed/types/case-notice.ts` - Notice types and icons (lines 62-72)
  - `/Users/hskim/luseed/components/scourt/ScourtGeneralInfoXml.tsx` - General tab content (1269 lines)
    - `substitutePartyListNames()`: lines 423-457
    - `confirmedParties`: lines 699-728
    - `overriddenBasicInfo`: lines 738-762
    - `effectiveApiData`: lines 770-830
  - `/Users/hskim/luseed/components/scourt/RelatedCaseConfirmModal.tsx` - Existing modal pattern
  - `/Users/hskim/luseed/lib/case/notice-detector.ts` - Notice detection
    - `detectUnlinkedRelatedCases()`: lines 580-633
  - `/Users/hskim/luseed/app/api/admin/cases/[id]/related-cases/route.ts` - Related case dismiss API
  - `/Users/hskim/luseed/lib/scourt/api-client.ts` - SCOURT API client
    - Progress fetching pattern: lines 700-810

- **External Research**:
  - [MyCase Legal Practice Management](https://www.mycase.com/blog/legal-case-management/best-legal-practice-management-software/)
  - [UI/UX Case Study - JB Law Firm](https://medium.com/@karolinasass12/a-ui-ux-case-study-jb-law-firms-admin-dashboard-15c01c5e626b)
  - [UI/UX Design for LegalTech](https://djangostars.com/blog/ux-ui-cases-for-legaltech/)

---

*Plan created: 2026-01-26*
*Plan revised: 2026-01-26 (Critic feedback incorporated)*
*Estimated total effort: ~15.5 hours*
