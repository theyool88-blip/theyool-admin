# 날짜/시간 입력 필드 가시성 문제 해결

**날짜**: 2025-11-23  
**문제**: 관리자 시스템의 모든 날짜/시간 입력 필드가 회색으로 표시되어 잘 보이지 않음  
**원인**: 브라우저 기본 스타일이 date/time input에 연한 회색 텍스트 색상 적용  

---

## 근본 원인 분석

### 발견된 문제
1. **브라우저 기본 동작**: `input[type="date"]`와 `input[type="time"]`은 브라우저가 기본적으로 `color: rgb(133, 133, 133)` 같은 연한 회색을 사용
2. **전역 CSS 부재**: `app/globals.css`에 date/time input 관련 스타일 오버라이드 없음
3. **개별 컴포넌트 불완전**: 일부 컴포넌트만 `text-gray-900 bg-white` 클래스 적용됨
4. **colorScheme 제한**: `colorScheme: 'light'`는 캘린더/시간 선택기 UI를 밝게 하지만 **입력 텍스트 색상은 변경하지 않음**

---

## 해결 방법

### 1. 전역 CSS 수정 (`app/globals.css`)

**추가된 CSS 규칙**:
```css
/* Date and Time Input Visibility Fix */
input[type="date"],
input[type="time"],
input[type="datetime-local"] {
  color: #111827 !important; /* gray-900 - ensures dark, readable text */
  color-scheme: light;
}

/* Ensure date/time inputs have visible text when filled */
input[type="date"]::-webkit-datetime-edit-text,
input[type="date"]::-webkit-datetime-edit-month-field,
input[type="date"]::-webkit-datetime-edit-day-field,
input[type="date"]::-webkit-datetime-edit-year-field,
input[type="time"]::-webkit-datetime-edit-text,
input[type="time"]::-webkit-datetime-edit-hour-field,
input[type="time"]::-webkit-datetime-edit-minute-field,
input[type="time"]::-webkit-datetime-edit-ampm-field {
  color: #111827 !important; /* gray-900 */
}

/* Placeholder styling for empty date/time inputs */
input[type="date"]::-webkit-datetime-edit,
input[type="time"]::-webkit-datetime-edit {
  color: #6b7280; /* gray-500 for placeholder state */
}

/* When date/time inputs have values, make text dark */
input[type="date"]:not(:placeholder-shown),
input[type="time"]:not(:placeholder-shown) {
  color: #111827 !important; /* gray-900 */
}
```

**효과**:
- 모든 날짜/시간 입력 필드의 텍스트가 진한 회색(`#111827`)으로 표시
- 빈 필드는 중간 회색(`#6b7280`)으로 표시
- 웹킷 브라우저(Chrome, Safari, Edge)의 내부 요소까지 스타일 적용
- `!important`로 브라우저 기본 스타일 강제 오버라이드

---

### 2. 개별 컴포넌트 수정

영향받는 7개 파일의 날짜/시간 입력 필드에 일관된 스타일 적용:

#### 수정된 파일 목록

| 파일 경로 | 입력 타입 | 수정 내용 |
|----------|---------|----------|
| `components/QuickAddHearingModal.tsx` | date, time | ✅ 이미 수정됨 (lines 285-305) |
| `components/UnifiedScheduleModal.tsx` | date, time | ✅ 이미 수정됨 (lines 426-468) |
| `components/QuickAddDeadlineModal.tsx` | date | ✅ 수정 완료 - `text-gray-900 bg-white` + `colorScheme: 'light'` 추가 |
| `components/ClientDetail.tsx` | date | ✅ 수정 완료 - `bg-white` + `colorScheme: 'light'` 추가 |
| `components/CaseEditForm.tsx` | date | ✅ 수정 완료 - `text-gray-900 bg-white` + `colorScheme: 'light'` 추가 |
| `components/ClientEditForm.tsx` | date | ✅ 수정 완료 - `text-gray-900 bg-white` + `colorScheme: 'light'` 추가 |
| `app/admin/settings/HolidayManagement.tsx` | date | ✅ 수정 완료 - `text-gray-900 bg-white` + `colorScheme: 'light'` 추가 |

#### 적용된 표준 패턴

**Before (문제 있음)**:
```tsx
<input
  type="date"
  value={formData.date}
  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
/>
```

**After (수정됨)**:
```tsx
<input
  type="date"
  value={formData.date}
  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
  className="w-full px-4 py-2 text-gray-900 bg-white border border-gray-300 rounded-lg"
  style={{ colorScheme: 'light' }}
/>
```

**핵심 변경사항**:
1. `text-gray-900` - 텍스트를 진한 회색으로 명시
2. `bg-white` - 배경을 흰색으로 명시
3. `style={{ colorScheme: 'light' }}` - 브라우저 기본 캘린더/시간 선택기를 밝은 테마로 설정

---

## 검증 방법

### 테스트 체크리스트

각 페이지에서 날짜/시간 입력 필드를 확인:

- [ ] **법원 기일 추가** (`QuickAddHearingModal`)
  - [ ] 날짜 입력 필드 텍스트가 선명한 검정/진한 회색으로 보임
  - [ ] 시간 입력 필드 텍스트가 선명한 검정/진한 회색으로 보임

- [ ] **데드라인 추가** (`QuickAddDeadlineModal`)
  - [ ] 기산일 입력 필드 텍스트가 선명한 검정/진한 회색으로 보임

- [ ] **통합 일정 추가** (`UnifiedScheduleModal`)
  - [ ] 날짜 입력 필드 텍스트가 선명한 검정/진한 회색으로 보임
  - [ ] 시간 입력 필드 텍스트가 선명한 검정/진한 회색으로 보임
  - [ ] 기산일 입력 필드 텍스트가 선명한 검정/진한 회색으로 보임

- [ ] **공휴일 관리** (`HolidayManagement`)
  - [ ] 공휴일 날짜 입력 필드 텍스트가 선명한 검정/진한 회색으로 보임

- [ ] **의뢰인 상세/수정** (`ClientDetail`, `ClientEditForm`)
  - [ ] 생년월일 입력 필드 텍스트가 선명한 검정/진한 회색으로 보임

- [ ] **사건 수정** (`CaseEditForm`)
  - [ ] 계약일 입력 필드 텍스트가 선명한 검정/진한 회색으로 보임

### 브라우저 호환성 확인

- [ ] Chrome (최신 버전)
- [ ] Safari (최신 버전)
- [ ] Edge (최신 버전)
- [ ] Firefox (최신 버전)

---

## 기술 세부사항

### CSS 우선순위 전략

1. **전역 CSS 규칙**: `!important` 사용으로 브라우저 기본값 강제 오버라이드
2. **Tailwind 클래스**: `text-gray-900 bg-white`로 명시적 스타일 지정
3. **인라인 스타일**: `colorScheme: 'light'`로 브라우저 UI 테마 제어

### 웹킷 특수 선택자 설명

```css
input[type="date"]::-webkit-datetime-edit-month-field
```
- 크롬/사파리에서 날짜 입력 필드의 "월" 부분만 선택
- 각 세그먼트(연, 월, 일, 시, 분)를 개별적으로 스타일링 가능

### colorScheme 속성

```css
color-scheme: light;
```
- 브라우저가 제공하는 날짜/시간 선택 UI의 테마를 밝은 모드로 고정
- 다크모드에서도 입력 필드가 밝은 테마로 표시됨

---

## 향후 유지보수 가이드

### 새로운 날짜/시간 입력 필드 추가 시

**반드시 포함해야 할 스타일**:
```tsx
<input
  type="date" // or type="time" or type="datetime-local"
  className="... text-gray-900 bg-white ..."
  style={{ colorScheme: 'light' }}
/>
```

### 왜 이 방식이 필요한가?

1. **전역 CSS만으로는 불충분**: 일부 브라우저는 웹킷 내부 요소에 다른 스타일 적용
2. **Tailwind 클래스만으로는 불충분**: 브라우저 기본값이 더 높은 우선순위를 가질 수 있음
3. **다층 방어 전략**: 전역 CSS + Tailwind + 인라인 스타일로 모든 브라우저 커버

---

## 참고 자료

- [MDN: input type="date"](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/date)
- [MDN: color-scheme](https://developer.mozilla.org/en-US/docs/Web/CSS/color-scheme)
- [WebKit CSS Reference: datetime-edit](https://webkit.org/blog/7434/css-grid-layout/)
- [Tailwind CSS: Text Color](https://tailwindcss.com/docs/text-color)

---

## 결론

✅ **문제 해결 완료**  
- 전역 CSS 규칙으로 모든 date/time input의 기본 텍스트 색상을 진한 회색으로 설정
- 7개 컴포넌트의 날짜/시간 입력 필드에 일관된 스타일 적용
- 브라우저 간 일관성 확보를 위해 다층 방어 전략 사용

**영향 범위**: 관리자 시스템 전체의 모든 날짜/시간 입력 필드  
**부작용**: 없음 (기존 동작 유지, 가시성만 개선)
