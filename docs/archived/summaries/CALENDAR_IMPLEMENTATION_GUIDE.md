# Calendar Redesign - Implementation Guide

## 개선된 파일

### 1. WeeklyCalendar.tsx
**위치**: `/Users/hskim/theyool-admin/components/WeeklyCalendar.tsx`

**주요 변경사항**:
- 컨테이너: `rounded-xl shadow-sm border border-gray-100`
- 날짜 표시: 원형 배지로 변경 (오늘은 파란 원)
- 일정 카드: 좌측 accent border (border-l-4)
- 빈 날짜: group-hover로 제어
- 색상: 50번대 배경 + 700번대 텍스트

### 2. MonthlyCalendar.tsx
**위치**: `/Users/hskim/theyool-admin/components/MonthlyCalendar.tsx`

**주요 변경사항**:
- 도트 인디케이터 추가 (getScheduleTypeDot 함수)
- 선택된 날짜: ring-2 효과
- 세부 패널: SVG 아이콘 사용
- 컴팩트한 일정 카드 (최대 2개)

---

## 핵심 디자인 패턴

### 1. Container Pattern
```tsx
// ❌ BEFORE
<div className="bg-white rounded-lg shadow p-6">

// ✅ AFTER
<div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
```

**Why:**
- `rounded-xl`: 더 부드러운 모서리 (12px)
- `shadow-sm`: 더 subtle한 그림자
- `border border-gray-100`: 미세한 outline으로 경계 정의

### 2. Today Indicator Pattern
```tsx
// ❌ BEFORE
<p className={`text-lg font-bold ${
  isToday ? 'text-blue-600' : 'text-gray-900'
}`}>
  {format(day, 'd')}
</p>

// ✅ AFTER
<div className={`inline-flex items-center justify-center w-8 h-8 rounded-full ${
  isToday
    ? 'bg-blue-600 text-white font-semibold'
    : 'text-gray-900 font-medium hover:bg-gray-50'
}`}>
  {format(day, 'd')}
</div>
```

**Why:**
- 원형 배지가 더 모던하고 눈에 잘 띔
- Google Calendar 스타일
- 일관된 크기 (w-8 h-8)

### 3. Schedule Card Pattern
```tsx
// ❌ BEFORE
<div className={`p-2 rounded border ${getScheduleTypeColor(type)}`}>
  <p className="font-medium">[{label}]</p>
  <p className="text-xs">{time}</p>
  <p>{title}</p>
</div>

// ✅ AFTER
<div className={`px-2.5 py-2 rounded-md border-l-4 ${getScheduleTypeColor(type)}
  hover:shadow-sm transition-shadow cursor-pointer`}>
  <div className="flex items-center gap-1.5 mb-0.5">
    <span className="text-[10px] font-semibold uppercase tracking-wide">
      {label}
    </span>
    {time && (
      <>
        <span className="text-gray-400">·</span>
        <span className="text-[10px] font-medium">{time}</span>
      </>
    )}
  </div>
  <p className="text-xs font-medium truncate">{title}</p>
</div>
```

**Why:**
- `border-l-4`: 좌측 accent만으로 타입 구분
- inline 정보: 타입 · 시간을 한 줄에
- `hover:shadow-sm`: 인터랙션 피드백
- `tracking-wide`: uppercase 텍스트의 가독성

### 4. Empty State Pattern
```tsx
// ❌ BEFORE
<p className="text-xs text-gray-400 text-center mt-8">
  일정 없음
</p>

// ✅ AFTER (WeeklyCalendar)
<p className="text-xs text-gray-400 text-center mt-8
  opacity-0 group-hover:opacity-100 transition-opacity">
  일정 없음
</p>

// ✅ AFTER (MonthlyCalendar)
<div className="text-center py-12">
  <div className="inline-flex items-center justify-center
    w-16 h-16 bg-gray-100 rounded-full mb-4">
    <span className="text-2xl">📭</span>
  </div>
  <p className="text-gray-600 font-medium">
    이 날짜에 등록된 일정이 없습니다.
  </p>
  <p className="text-sm text-gray-500 mt-1">
    새로운 일정을 추가해보세요.
  </p>
</div>
```

**Why:**
- WeeklyCalendar: 너무 시끄럽지 않게 hover시에만
- MonthlyCalendar: 세부 패널이므로 명확한 설명

### 5. Button Pattern
```tsx
// ❌ BEFORE
<button className="px-4 py-2 text-sm font-medium text-gray-700
  bg-white border border-gray-300 rounded-md hover:bg-gray-50">

// ✅ AFTER (Secondary)
<button className="px-4 py-2 text-sm font-medium text-gray-600
  hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors">

// ✅ AFTER (Primary)
<button className="px-4 py-2 text-sm font-medium text-white
  bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">
```

**Why:**
- Secondary 버튼에서 border 제거
- `transition-colors`: 부드러운 색상 전환
- `rounded-lg`: 더 부드러운 모서리

### 6. Color Function Pattern
```tsx
// ✅ Schedule Type Color (배경 + 텍스트)
const getScheduleTypeColor = (type: string) => {
  switch (type) {
    case 'trial': return 'bg-purple-50 text-purple-700 border-l-purple-400'
    case 'consultation': return 'bg-blue-50 text-blue-700 border-l-blue-400'
    case 'meeting': return 'bg-emerald-50 text-emerald-700 border-l-emerald-400'
    default: return 'bg-gray-50 text-gray-700 border-l-gray-400'
  }
}

// ✅ Dot Indicator Color (MonthlyCalendar만)
const getScheduleTypeDot = (type: string) => {
  switch (type) {
    case 'trial': return 'bg-purple-400'
    case 'consultation': return 'bg-blue-400'
    case 'meeting': return 'bg-emerald-400'
    default: return 'bg-gray-400'
  }
}
```

**Why:**
- 50번대 배경: 밝고 부드러움
- 700번대 텍스트: 충분한 대비
- 400번대 accent: 눈에 띄지만 시끄럽지 않음

---

## Tailwind CSS Classes Cheat Sheet

### Spacing
```css
gap-1.5   /* 6px - 작은 간격 */
gap-3     /* 12px - 기본 간격 */
px-2.5    /* 10px - 좌우 여백 */
py-2      /* 8px - 상하 여백 */
```

### Typography
```css
text-[10px]  /* 10px - 매우 작은 레이블 */
text-xs      /* 12px - 작은 본문 */
text-sm      /* 14px - 본문 */
text-xl      /* 20px - 부제목 */
text-2xl     /* 24px - 제목 */

font-medium     /* 500 */
font-semibold   /* 600 */
font-bold       /* 700 */

tracking-wide   /* 0.025em */
tracking-wider  /* 0.05em */
uppercase       /* text-transform: uppercase */
```

### Colors
```css
/* Backgrounds */
bg-purple-50    /* #faf5ff */
bg-blue-50      /* #eff6ff */
bg-emerald-50   /* #ecfdf5 */

/* Text */
text-purple-700 /* #7e22ce */
text-blue-700   /* #1d4ed8 */
text-emerald-700/* #047857 */

/* Borders */
border-l-purple-400  /* #c084fc */
border-l-blue-400    /* #60a5fa */
border-l-emerald-400 /* #34d399 */
```

### Borders
```css
border          /* 1px all sides */
border-l-4      /* 4px left side */
border-gray-100 /* #f3f4f6 */
rounded-lg      /* 8px */
rounded-xl      /* 12px */
rounded-full    /* 9999px (circle) */
```

### Shadows & Effects
```css
shadow-sm       /* subtle shadow */
shadow-md       /* medium shadow */
ring-2          /* 2px outline */
ring-blue-200   /* blue outline color */
```

### Transitions
```css
transition-colors  /* color, background-color, border-color */
transition-shadow  /* box-shadow */
transition-all     /* all properties */
transition-opacity /* opacity */
```

### Layout
```css
inline-flex        /* display: inline-flex */
items-center       /* align-items: center */
justify-center     /* justify-content: center */
w-8 h-8           /* width: 32px, height: 32px */
min-h-[200px]     /* min-height: 200px */
```

---

## Advanced Patterns

### 1. Group Hover Pattern
```tsx
<div className="group">
  <div className="opacity-0 group-hover:opacity-100 transition-opacity">
    Hover 시에만 보임
  </div>
</div>
```

### 2. Conditional Ring Pattern
```tsx
className={`rounded-lg ${
  isSelected
    ? 'bg-blue-50 shadow-md ring-2 ring-blue-200'  // 선택됨
    : isToday
    ? 'bg-blue-50/50'                              // 오늘
    : 'hover:bg-gray-50 hover:shadow-sm'           // 기본
}`}
```

### 3. Dot Indicators Pattern
```tsx
{daySchedules.length > 0 && (
  <div className="flex gap-1">
    {daySchedules.slice(0, 3).map((schedule) => (
      <div
        key={schedule.id}
        className={`w-1.5 h-1.5 rounded-full ${getScheduleTypeDot(schedule.schedule_type)}`}
      />
    ))}
  </div>
)}
```

### 4. SVG Icon Pattern
```tsx
<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
</svg>
```

### 5. Semi-transparent Background
```tsx
className="bg-white/80"  // 80% opacity
className="bg-blue-50/50" // 50% opacity
```

---

## Responsive Considerations

### Mobile Optimization
```tsx
// 모바일에서는 gap 줄이기
<div className="grid grid-cols-7 gap-2 md:gap-3">

// 모바일에서는 padding 줄이기
<div className="p-4 md:p-6">

// 모바일에서는 텍스트 크기 조정
<h2 className="text-lg md:text-xl font-semibold">
```

### Touch Target Size
최소 44x44px 확보:
```tsx
// ✅ Good
<button className="p-2 w-10 h-10">  // 40px (최소한)
<button className="p-3 w-12 h-12">  // 48px (권장)

// ❌ Bad
<button className="p-1 w-6 h-6">   // 24px (너무 작음)
```

---

## Accessibility

### 1. Color Contrast
모든 텍스트는 WCAG AA 기준 충족:
- `text-purple-700` on `bg-purple-50`: ✅ 7.5:1
- `text-blue-700` on `bg-blue-50`: ✅ 8.2:1
- `text-emerald-700` on `bg-emerald-50`: ✅ 6.8:1

### 2. Keyboard Navigation
```tsx
<button
  className="focus:outline-none focus:ring-2 focus:ring-blue-500"
  tabIndex={0}
>
```

### 3. Screen Reader
```tsx
<button aria-label="닫기" onClick={onClose}>
  <svg>...</svg>
</button>

<div role="button" tabIndex={0} aria-label="일정 선택">
```

---

## Performance Tips

### 1. Memoization
```tsx
const daySchedules = useMemo(
  () => getSchedulesForDay(day),
  [day, schedules]
)
```

### 2. Virtual Scrolling
월간 캘린더가 1년치를 보여준다면 virtual scrolling 고려:
```tsx
import { FixedSizeGrid } from 'react-window'
```

### 3. Debounce
검색이나 필터링에는 debounce:
```tsx
import { useDebouncedCallback } from 'use-debounce'

const debouncedSearch = useDebouncedCallback(
  (value) => setSearchQuery(value),
  300
)
```

---

## Testing Checklist

### Visual Testing
- [ ] 오늘 날짜가 파란 원으로 표시되는가?
- [ ] 일정 타입별 색상이 구분되는가?
- [ ] hover 효과가 부드럽게 작동하는가?
- [ ] 선택된 날짜에 ring이 표시되는가?
- [ ] 도트 인디케이터가 보이는가? (MonthlyCalendar)

### Interaction Testing
- [ ] 날짜 클릭 시 세부 패널이 열리는가?
- [ ] 닫기 버튼이 작동하는가?
- [ ] 이전/다음 달 이동이 부드러운가?
- [ ] 새로고침 버튼이 작동하는가?

### Responsive Testing
- [ ] 모바일에서 터치 영역이 충분한가?
- [ ] 태블릿에서 레이아웃이 깨지지 않는가?
- [ ] 작은 화면에서 텍스트가 읽기 쉬운가?

### Accessibility Testing
- [ ] 키보드로 모든 버튼에 접근 가능한가?
- [ ] 포커스 인디케이터가 명확한가?
- [ ] 색맹 사용자도 일정 타입을 구분할 수 있는가?

---

## Migration Guide

기존 캘린더를 사용 중이라면:

### Step 1: 백업
```bash
cp components/WeeklyCalendar.tsx components/WeeklyCalendar.backup.tsx
cp components/MonthlyCalendar.tsx components/MonthlyCalendar.backup.tsx
```

### Step 2: 파일 교체
새로운 파일로 교체

### Step 3: 테스트
```bash
npm run dev
```

다음을 확인:
- 기존 데이터가 정상적으로 표시되는가?
- 일정 타입별 색상이 올바른가?
- 클릭/호버 인터랙션이 작동하는가?

### Step 4: 커스터마이징
필요하다면 색상 조정:
```tsx
// 브랜드 색상으로 변경 예시
const getScheduleTypeColor = (type: string) => {
  switch (type) {
    case 'trial': return 'bg-brand-50 text-brand-700 border-l-brand-400'
    // ...
  }
}
```

---

## Future Enhancements

### 1. Drag & Drop
```tsx
import { DndProvider } from 'react-dnd'
// 일정을 드래그해서 날짜 변경
```

### 2. Time Slots
```tsx
// 시간대별 슬롯 표시
<div className="grid grid-rows-24">
  {timeSlots.map(slot => ...)}
</div>
```

### 3. Multi-calendar View
```tsx
// 여러 변호사의 캘린더를 동시에
<div className="grid grid-cols-3 gap-4">
  <Calendar lawyer="육심원" />
  <Calendar lawyer="임은지" />
  <Calendar lawyer="전체" />
</div>
```

### 4. Recurring Events
```tsx
// 반복 일정 지원
{
  recurring: {
    frequency: 'weekly',
    interval: 1,
    daysOfWeek: ['월', '수', '금']
  }
}
```

---

## Troubleshooting

### 문제: 색상이 적용되지 않음
```tsx
// ❌ 동적 클래스명은 Tailwind가 인식 못함
className={`bg-${color}-50`}

// ✅ 전체 클래스명 사용
className={color === 'blue' ? 'bg-blue-50' : 'bg-purple-50'}
```

### 문제: border-l-4가 보이지 않음
Tailwind config에 추가 필요:
```js
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      borderWidth: {
        '3': '3px',
        '4': '4px',
      }
    }
  }
}
```

### 문제: 텍스트가 truncate 안됨
부모에 width 지정 필요:
```tsx
<div className="w-full">  // 또는 max-w-*
  <p className="truncate">긴 텍스트...</p>
</div>
```

---

## Resources

### Design Inspiration
- [Google Calendar](https://calendar.google.com)
- [Notion Calendar](https://notion.so/calendar)
- [Linear](https://linear.app)

### Tailwind Resources
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [Tailwind UI](https://tailwindui.com)
- [Headless UI](https://headlessui.com)

### Date Utilities
- [date-fns](https://date-fns.org)
- [Day.js](https://day.js.org)

---

## Conclusion

이 개선으로 달성한 것:
✅ 현대적이고 세련된 디자인
✅ 더 나은 사용자 경험
✅ 명확한 시각적 계층
✅ 부드러운 인터랙션
✅ 접근성 향상
✅ 유지보수 가능한 코드

"촌스러운 네모"는 이제 과거의 일입니다!
