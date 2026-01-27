# Main Case Grouping Implementation - Learnings

## Implementation Date
2026-01-27

## What Was Implemented

### Task 4: Grouping Logic
1. **State Management**
   - Added `groupByMainCase` boolean state to control grouping mode
   - Renamed `filteredCases` to `processedCases` to reflect the additional processing

2. **Search Enhancement**
   - Extended search to include: court_case_number, court_name, parties.ourClient, parties.opponent
   - Search now covers all major case identification fields

3. **Grouping Algorithm**
   - Separates cases into main cases (no main_case_id) and sub-cases (has main_case_id)
   - Groups sub-cases by their main_case_id using a Map
   - Sorts main cases by contract_date (newest first)
   - Sorts sub-cases within each group by case_level (1심 -> 2심 -> 3심)
   - Handles orphan sub-cases (sub-cases whose main case is filtered out)

4. **Conditional Behavior**
   - When grouping is OFF: Normal sorting applies
   - When grouping is ON: Custom grouping logic overrides sorting

### Task 5: Grouping UI
1. **Icons**
   - Added `Layers` icon for the group toggle button
   - Added `CornerDownRight` icon for sub-case indentation indicator

2. **Toolbar**
   - Added group toggle button between status filter and view mode toggle
   - Button shows active state with sage color scheme
   - Updated search placeholder to reflect expanded search capabilities

3. **Table Rendering**
   - Added `_isSubCase` flag to mark sub-cases in the data
   - Sub-cases have 20px left padding (pl-5)
   - Sub-cases show corner-down-right arrow icon
   - Sub-cases cannot be sorted when in grouping mode (sortable: !groupByMainCase)

## Technical Decisions

### Why rename filteredCases to processedCases?
The variable now does more than just filtering - it also applies grouping and hierarchical sorting. The new name better reflects its purpose.

### Why disable sorting in grouping mode?
When grouping is active, the hierarchical structure (main -> subs) is more important than column-based sorting. Allowing column sorting would break the visual hierarchy.

### Why use _isSubCase flag?
Added as a runtime flag rather than modifying the LegalCase type. This keeps the type definition clean and the flag is only used for rendering purposes.

## Patterns Used

### Hierarchical Data Grouping
```typescript
const mainCases = filtered.filter(c => !c.main_case_id)
const subCases = filtered.filter(c => c.main_case_id)

const subCaseMap = new Map<string, typeof filtered>()
for (const sub of subCases) {
  const mainId = sub.main_case_id!
  if (!subCaseMap.has(mainId)) {
    subCaseMap.set(mainId, [])
  }
  subCaseMap.get(mainId)!.push(sub)
}
```

### Conditional Rendering with Runtime Flags
```typescript
render: (item) => (
  <div className={`flex items-center gap-1.5 ${
    (item as any)._isSubCase ? 'pl-5' : ''
  }`}>
    {(item as any)._isSubCase && (
      <CornerDownRight className="w-3.5 h-3.5 text-[var(--text-muted)] flex-shrink-0" />
    )}
    {/* ... */}
  </div>
)
```

## Files Modified
- `/Users/hskim/luseed/components/CasesList.tsx`

## Verification Status
- TypeScript compilation: PASSED
- Build errors: UNRELATED (Next.js build issues with other files)
- Lint: NOT CHECKED
