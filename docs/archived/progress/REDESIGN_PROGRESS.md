# Theyool Admin Sage Green Redesign Progress

**Last Updated**: 2025-11-23

## Completed Components ✅

### 1. Foundation (Phase 1)
- ✅ `tailwind.config.ts` - Sage color palette configured
- ✅ `app/globals.css` - `.form-input-standard` class added
- ✅ `components/AdminHeader.tsx` - Sage Green header

### 2. List/Table Components
- ✅ `components/CasesList.tsx` - Sage Green table redesign
- ✅ `components/ClientsList.tsx` - Sage Green table redesign
- ✅ `components/ScheduleListView.tsx` - Sage theme applied

### 3. Calendar Components
- ✅ `components/MonthlyCalendar.tsx` - Sage calendar grid, buttons, and filters

## Remaining Work 🚧

### Priority 1: Modal Components (7 files)
All modals need:
- Background overlay: `bg-black/50`
- Modal container: `bg-white rounded-xl border border-sage-200`
- ALL inputs/selects: `className="form-input-standard"`
- Primary buttons: `bg-sage-600 hover:bg-sage-700 text-white`
- Secondary buttons: `bg-sage-100 text-sage-800 hover:bg-sage-200`
- Labels: `text-sage-800`
- Helper text: `text-sage-600`

Files:
1. `components/HearingDetailModal.tsx`
2. `components/QuickAddHearingModal.tsx`
3. `components/UnifiedScheduleModal.tsx`
4. `components/ConsultationPaymentsModal.tsx`
5. `components/CasePaymentsModal.tsx`
6. `components/ClientPaymentsModal.tsx`
7. `components/QuickAddDeadlineModal.tsx`

### Priority 2: Calendar Component
- `components/WeeklyCalendar.tsx` - Apply same Sage theme as MonthlyCalendar

### Priority 3: Core Pages
- `components/Dashboard.tsx` - Sage KPI cards and charts
- `app/login/page.tsx` - Warm Sage welcome design

### Priority 4: Detail/Edit Forms
- `components/CaseDetail.tsx`
- `components/CaseEditForm.tsx`
- `components/ClientDetail.tsx`
- `components/ClientEditForm.tsx`

All forms need `form-input-standard` for inputs/selects.

### Priority 5: Admin Pages (15+ pages)
All pages in `app/` directory:
- `app/page.tsx` (root dashboard)
- `app/cases/page.tsx`
- `app/cases/[id]/page.tsx`
- `app/cases/[id]/edit/page.tsx`
- `app/clients/page.tsx`
- `app/clients/[id]/page.tsx`
- `app/clients/[id]/edit/page.tsx`
- `app/schedules/page.tsx`
- `app/admin/page.tsx`
- `app/admin/consultations/page.tsx`
- `app/admin/consultations/stats/page.tsx`
- `app/admin/payments/page.tsx`
- `app/admin/payments/stats/page.tsx`
- `app/admin/settings/page.tsx`
- `app/admin/cases/page.tsx`
- `app/admin/cases/stats/page.tsx`
- `app/admin/clients/page.tsx`

## Design Standards (Reference)

### Color Palette
```typescript
// Sage Green (Main Brand)
sage-50: #F0F9F7   // Background
sage-100: #E8F5F2  // Badge background, light elements
sage-200: #D1EBE5  // Borders
sage-500: #6DB5A4  // Icons, accents
sage-600: #5A9988  // Primary buttons
sage-700: #487A6C  // Hover states
sage-800: #365B51  // Text, headings
```

### Standard Input Class
```css
/* In globals.css */
.form-input-standard {
  @apply h-11 px-4 py-2.5 text-base border border-sage-200 rounded-lg;
  @apply focus:outline-none focus:ring-2 focus:ring-sage-500 focus:border-transparent;
  @apply disabled:bg-gray-100 disabled:cursor-not-allowed;
  @apply transition-all duration-200;
}
```

### Button Patterns
```tsx
// Primary CTA
className="bg-sage-600 hover:bg-sage-700 text-white px-4 py-2.5 rounded-lg transition-colors"

// Secondary
className="bg-sage-100 text-sage-800 hover:bg-sage-200 px-4 py-2.5 rounded-lg transition-colors"

// Danger (keep red)
className="bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 rounded-lg transition-colors"
```

### Table Headers
```tsx
className="bg-sage-50 border-b border-sage-200"
// Header cells
className="px-4 py-3 text-xs font-semibold text-sage-800 uppercase tracking-wider"
```

### Table Rows
```tsx
// Row hover
className="hover:bg-sage-50 cursor-pointer transition-colors"
// Dividers
className="divide-y divide-sage-100"
```

### Badges/Pills
```tsx
// Success/Active
className="bg-sage-100 text-sage-800 px-2.5 py-1 text-xs font-semibold rounded-md"

// Warning (keep orange)
className="bg-orange-100 text-orange-700 px-2.5 py-1 text-xs font-semibold rounded-md"

// Danger (keep red)
className="bg-red-100 text-red-700 px-2.5 py-1 text-xs font-semibold rounded-md"
```

## Replacement Patterns

### Find and Replace (Common Patterns)
1. **Blue to Sage (Primary Actions)**
   - `bg-blue-50` → `bg-sage-50`
   - `bg-blue-100` → `bg-sage-100`
   - `bg-blue-600` → `bg-sage-600`
   - `bg-blue-700` → `bg-sage-700`
   - `text-blue-600` → `text-sage-700`
   - `text-blue-700` → `text-sage-800`
   - `border-blue-200` → `border-sage-200`
   - `ring-blue-500` → `ring-sage-500`

2. **Gray Backgrounds to Sage**
   - `bg-gray-50` (page backgrounds) → `bg-sage-50`
   - `bg-gray-100` (card backgrounds) → keep as `bg-white` or use `bg-sage-50/30`
   - `border-gray-100` → `border-sage-100`
   - `border-gray-200` → `border-sage-200`

3. **Standard Inputs**
   - Any `<input>` or `<select>` with custom classes → `className="form-input-standard"`
   - Exception: Keep specialized inputs (checkboxes, radios, file uploads)

4. **Keep Status Colors**
   - Red (errors, danger, overdue): Keep as-is
   - Green (success, completed): Keep as-is
   - Orange (warnings, deadlines): Keep as-is
   - Yellow (pending, postponed): Keep as-is

## Verification Checklist

For each component/page, verify:
- [ ] All `<input>` and `<select>` use `form-input-standard`
- [ ] Primary buttons use `bg-sage-600 hover:bg-sage-700`
- [ ] Page background is `bg-sage-50`
- [ ] Card/section borders use `border-sage-100` or `border-sage-200`
- [ ] Table headers use `bg-sage-50 text-sage-800`
- [ ] Hover states use `hover:bg-sage-50`
- [ ] Status colors (red/green/orange) are preserved
- [ ] No blue colors remain (except external links if applicable)

## Next Session Instructions

To continue this redesign:

1. **Start with modals** (highest impact, ~7 files)
   - Read one modal file
   - Apply Sage theme to modal container, buttons, inputs
   - Use find/replace for color classes
   - Test that `form-input-standard` is applied to all inputs

2. **Then WeeklyCalendar** (similar to MonthlyCalendar)
   - Copy color function patterns from MonthlyCalendar
   - Update filters, buttons, grid colors

3. **Dashboard and Login pages** (user-facing)
   - Dashboard: KPI cards with Sage theme
   - Login: Warm, welcoming Sage design

4. **Detail/Edit forms** (lots of inputs)
   - Bulk replace input classes with `form-input-standard`
   - Update button colors

5. **Admin pages** (final polish)
   - Systematically update each page
   - Check for consistency across all pages

## Quick Commands

```bash
# Check for blue colors that need changing
cd /Users/hskim/theyool-admin
grep -r "bg-blue" components/ app/ | grep -v node_modules

# Check for gray backgrounds
grep -r "bg-gray-50\|bg-gray-100" components/ app/ | grep -v node_modules

# Find inputs without form-input-standard
grep -r "<input\|<select" components/ | grep -v "form-input-standard" | grep -v node_modules
```

## Estimated Completion

- Modals (7 files): 45 min
- WeeklyCalendar: 15 min
- Dashboard + Login: 30 min
- Detail/Edit forms (4 files): 30 min
- Admin pages (15+ files): 90 min

**Total remaining**: ~3.5 hours of focused work
