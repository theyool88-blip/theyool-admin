# Sage Green 디자인 시스템

**Last Updated**: 2025-12-02

법무법인 더율 관리자 시스템의 Sage Green 테마 디자인 가이드입니다.

---

## 색상 팔레트

### Sage Green (메인 브랜드)

| 변수 | HEX | 용도 |
|------|-----|------|
| sage-50 | #F0F9F7 | 페이지 배경 |
| sage-100 | #E8F5F2 | 카드 배경, 프로그레스 바 |
| sage-200 | #D1EBE5 | 기본 보더 |
| sage-400 | #8CCABE | 호버 보더 |
| sage-500 | #6DB5A4 | 아이콘, 액센트 |
| sage-600 | #5A9988 | 주요 버튼 |
| sage-700 | #487A6C | 제목, 강조 텍스트 |
| sage-800 | #365B51 | 본문 텍스트 |

### Coral Pink (보조/에러)

| 변수 | HEX | 용도 |
|------|-----|------|
| coral-50 | #FEF2F4 | 에러 배경 |
| coral-200 | #FECDD3 | 에러 보더 |
| coral-500 | #F4A5B0 | 경고 아이콘 |
| coral-600 | #EF7E90 | 에러 텍스트, 삭제 버튼 |

### 시맨틱 색상

| 용도 | 색상 |
|------|------|
| 매출/긍정 | green-500, green-600 |
| 사건 수 | purple-500, purple-600 |
| 긴급/경고 | coral-500, orange-500 |
| 정보 | blue-500 |

---

## CSS 변수 (globals.css)

```css
:root {
  /* Sage Green */
  --color-sage-50: #F0F9F7;
  --color-sage-100: #E8F5F2;
  --color-sage-200: #D1EBE5;
  --color-sage-500: #6DB5A4;
  --color-sage-600: #5A9988;
  --color-sage-700: #487A6C;
  --color-sage-800: #365B51;

  /* Coral Pink */
  --color-coral-500: #F4A5B0;
  --color-coral-600: #EF7E90;

  /* Form Standards */
  --input-height: 44px;
  --input-padding: 10px 16px;
}
```

---

## 유틸리티 클래스

### 폼 요소

```css
/* 모든 input, select 필드 */
.form-input-standard {
  height: 44px;
  padding: 10px 16px;
  border: 1px solid var(--color-sage-200);
  border-radius: 8px;
  background: white;
  color: var(--color-sage-800);
}

.form-input-standard:focus {
  border-color: var(--color-sage-500);
  outline: none;
  ring: 2px var(--color-sage-500);
}

/* textarea 필드 */
.form-textarea-standard {
  padding: 12px 16px;
  border: 1px solid var(--color-sage-200);
  border-radius: 8px;
}
```

### 카드

```css
.card-sage {
  background: white;
  border-radius: 16px;
  border: 1px solid var(--color-sage-200);
  padding: 24px;
}

.shadow-sage {
  box-shadow: 0 4px 6px -1px rgba(93, 153, 136, 0.1),
              0 2px 4px -1px rgba(93, 153, 136, 0.06);
}
```

### 배지

```css
.badge-sage {
  padding: 6px 12px;
  background: var(--color-sage-100);
  color: var(--color-sage-700);
  border-radius: 8px;
  border: 1px solid var(--color-sage-200);
}
```

---

## 컴포넌트 패턴

### 버튼

```tsx
// 주요 버튼
<button className="h-11 px-4 text-sm font-semibold text-white
  bg-sage-600 hover:bg-sage-700 rounded-lg
  transition-all shadow-sm hover:shadow-md">
  저장
</button>

// 보조 버튼
<button className="h-11 px-4 text-sm font-medium text-sage-700
  bg-white border border-sage-300 hover:bg-sage-50 rounded-lg">
  취소
</button>

// 위험 버튼
<button className="h-11 px-4 text-sm font-medium text-coral-600
  bg-white border border-coral-300 hover:bg-coral-50 rounded-lg">
  삭제
</button>
```

### 입력 필드

```tsx
<input
  type="text"
  className="form-input-standard w-full"
  placeholder="입력하세요"
/>

<select className="form-input-standard w-full">
  <option>선택하세요</option>
</select>

<textarea
  className="form-textarea-standard w-full"
  rows={4}
/>
```

### 카드

```tsx
<div className="card-sage shadow-sage hover:shadow-lg transition-all">
  <h3 className="text-lg font-bold text-sage-800">제목</h3>
  <p className="text-sage-600">내용</p>
</div>
```

### 에러 메시지

```tsx
<p className="mt-1.5 text-sm text-coral-600 flex items-center gap-1">
  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" />
  </svg>
  에러 메시지
</p>
```

---

## 호버 효과

### 카드 호버

```tsx
// 기본 호버
className="border-sage-200 hover:border-sage-400
  hover:shadow-lg transition-all duration-300"

// 리프트 효과
className="group-hover:-translate-y-1"

// 퀵 액션 버튼
className="hover:shadow-sm border-sage-100 hover:border-sage-300"
```

### 일정 유형별 색상

| 유형 | 배경 | 텍스트 | 보더 |
|------|------|--------|------|
| 변론 (trial) | bg-purple-50 | text-purple-700 | border-l-purple-400 |
| 상담 (consultation) | bg-blue-50 | text-blue-700 | border-l-blue-400 |
| 회의 (meeting) | bg-emerald-50 | text-emerald-700 | border-l-emerald-400 |
| 법원기일 (court_hearing) | bg-red-50 | text-red-700 | border-l-red-400 |
| 데드라인 (deadline) | bg-orange-50 | text-orange-700 | border-l-orange-400 |

---

## 타이포그래피

### 계층 구조

| 요소 | 스타일 |
|------|--------|
| 페이지 제목 | text-2xl font-bold text-sage-800 |
| 섹션 제목 | text-xl font-bold text-sage-800 |
| 카드 제목 | text-lg font-semibold text-sage-700 |
| 레이블 | text-sm font-medium text-sage-700 |
| 본문 | text-base text-sage-800 |
| 보조 텍스트 | text-sm text-sage-600 |

---

## 레이아웃

### 페이지 구조

```tsx
<div className="min-h-screen bg-sage-50">
  <AdminHeader />

  <main className="pt-16 max-w-[1200px] mx-auto px-8 sm:px-16 md:px-20 py-8">
    {/* 컨텐츠 */}
  </main>
</div>
```

### 컨테이너

```tsx
// 기본 컨테이너
<div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">

// Sage 컨테이너
<div className="card-sage shadow-sage p-6">
```

---

## 접근성 (WCAG AA)

### 색상 대비

| 조합 | 대비율 |
|------|--------|
| text-purple-700 on bg-purple-50 | 7.5:1 |
| text-blue-700 on bg-blue-50 | 8.2:1 |
| text-emerald-700 on bg-emerald-50 | 6.8:1 |
| text-sage-800 on bg-sage-50 | 7.1:1 |

### 포커스 상태

```tsx
<button className="focus:outline-none focus:ring-2 focus:ring-sage-500">
```

### 키보드 네비게이션

```tsx
<button
  tabIndex={0}
  onKeyDown={(e) => e.key === 'Enter' && onClick()}
>
```

---

## 변환 가이드

### Blue → Sage

| 기존 | 변환 |
|------|------|
| bg-blue-600 | bg-sage-600 |
| bg-blue-700 | bg-sage-700 |
| text-blue-600 | text-sage-600 |
| border-blue-500 | border-sage-500 |
| ring-blue-500 | ring-sage-500 |

### Gray → Sage

| 기존 | 변환 |
|------|------|
| bg-gray-50 | bg-sage-50 |
| text-gray-700 | text-sage-700 |
| border-gray-300 | border-sage-200 |

### Red → Coral

| 기존 | 변환 |
|------|------|
| text-red-600 | text-coral-600 |
| bg-red-50 | bg-coral-50 |
| border-red-300 | border-coral-300 |

---

## 체크리스트

### 폼 요소
- [ ] 모든 input: form-input-standard
- [ ] 모든 textarea: form-textarea-standard
- [ ] 모든 select: form-input-standard
- [ ] 날짜/시간 입력 가시성 확인

### 버튼
- [ ] 주요 버튼: bg-sage-600 hover:bg-sage-700
- [ ] 보조 버튼: border-sage-300 hover:bg-sage-50
- [ ] 위험 버튼: text-coral-600 border-coral-300
- [ ] 일관된 높이 (h-11)

### 색상
- [ ] 헤더: text-sage-800
- [ ] 레이블: text-sage-700
- [ ] 본문: text-sage-800
- [ ] 보조 텍스트: text-sage-600
- [ ] 보더: border-sage-200

### 카드
- [ ] card-sage 클래스 사용
- [ ] shadow-sage 적용
- [ ] rounded-xl 또는 rounded-2xl
- [ ] 적절한 패딩 (p-4 또는 p-6)

---

## 파일 참조

- **CSS 변수**: `/app/globals.css`
- **완료된 컴포넌트**: `/components/AdminHeader.tsx`
- **캘린더 예시**: `/components/WeeklyCalendar.tsx`
- **모달 예시**: `/components/UnifiedScheduleModal.tsx`

