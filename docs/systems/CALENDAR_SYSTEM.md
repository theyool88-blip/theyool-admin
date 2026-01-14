# 캘린더 시스템

**Last Updated**: 2026-01-13

법무법인 더율의 모든 일정을 통합 관리하는 캘린더 시스템입니다.

---

## 개요

### 주요 기능

| 기능 | 설명 |
|------|------|
| **월간/주간 캘린더** | 다양한 뷰 제공 |
| **통합 일정 조회** | 3개 테이블 통합 (일정, 법원기일, 데드라인) |
| **Google Calendar 동기화** | 양방향 동기화 |
| **공휴일 관리** | 한국 공휴일 자동 반영 |
| **색상 코딩** | 일정 유형별 구분 |

---

## 캘린더 뷰

### WeeklyCalendar

- 주간 뷰 (7일)
- 시간대별 일정 표시
- 일정 카드 hover 효과

### MonthlyCalendar

- 월간 뷰 (그리드)
- 도트 인디케이터
- 날짜 클릭 시 세부 패널
- 오늘 날짜 원형 배지

---

## 색상 코딩

### 일정 유형별 색상

| 유형 | 색상 | 클래스 |
|------|------|--------|
| 변론 (trial) | 보라 | `bg-purple-50 text-purple-700 border-l-purple-400` |
| 상담 (consultation) | 파랑 | `bg-blue-50 text-blue-700 border-l-blue-400` |
| 회의 (meeting) | 초록 | `bg-emerald-50 text-emerald-700 border-l-emerald-400` |
| 법원기일 (court_hearing) | 빨강 | `bg-red-50 text-red-700 border-l-red-400` |
| 데드라인 (deadline) | 주황 | `bg-orange-50 text-orange-700 border-l-orange-400` |

### 도트 인디케이터

```tsx
const getScheduleTypeDot = (type: string) => {
  switch (type) {
    case 'trial': return 'bg-purple-400'
    case 'consultation': return 'bg-blue-400'
    case 'meeting': return 'bg-emerald-400'
    case 'court_hearing': return 'bg-red-400'
    case 'deadline': return 'bg-orange-400'
    default: return 'bg-gray-400'
  }
}
```

---

## 통합 일정 조회

### 데이터 소스

| 테이블 | 설명 |
|--------|------|
| `case_schedules` | 기존 일정 (변론, 상담, 회의) |
| `court_hearings` | 법원 기일 |
| `case_deadlines` | 데드라인 |

### UnifiedSchedule 타입

```typescript
interface UnifiedSchedule {
  id: string
  date: string
  time?: string
  title: string
  schedule_type: 'trial' | 'consultation' | 'meeting' | 'court_hearing' | 'deadline'
  case_number?: string
  location?: string
  memo?: string
  days_until?: number  // D-day (데드라인용)
}
```

### 일정 Title 표시 형식

캘린더에 표시되는 일정 제목은 다음 형식을 따릅니다:

```
(기일명) 의뢰인v상대방(사건명)
```

**예시:**
- `(제1회 변론기일) 김철수v이영희(이혼)`
- `(조정기일) 박민수v최지연(양육권)`
- `(상소기간) 홍길동v김영수(재산분할)`

**당사자 선택 우선순위:**
1. `is_primary = true` 인 당사자 우선
2. `party_order` 순서대로
3. 의뢰인: `is_our_client = true`
4. 상대방: `is_our_client = false`

**폴백 로직:**
- 당사자 정보 없으면 → `case_name` 표시
- `case_name`도 없으면 → `case_number` 표시

---

## Google Calendar 동기화

### 기능

- OAuth 2.0 인증
- 양방향 동기화
- 웹훅 지원 (실시간)
- 동기화 범위: 1년 전 ~ 6개월 후

### API 엔드포인트

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/auth/google-calendar` | OAuth 시작 |
| GET | `/api/auth/callback/google-calendar` | OAuth 콜백 |
| POST | `/api/admin/google-calendar/sync` | 수동 동기화 |
| POST | `/api/webhooks/google-calendar` | 웹훅 수신 |

### 설정

```env
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_CALENDAR_ID=...
```

---

## 공휴일 관리

### 기능

- 한국 공휴일 자동 등록
- 사용자 정의 휴일 추가
- 상담 예약 시 반영

### API 엔드포인트

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/admin/holidays` | 공휴일 목록 |
| POST | `/api/admin/holidays` | 공휴일 추가 |
| DELETE | `/api/admin/holidays/[id]` | 공휴일 삭제 |

---

## 통합 스케줄 모달

### UnifiedScheduleModal

78KB 규모의 통합 일정 관리 모달

**기능**:
- 모든 일정 유형 통합 조회
- 필터링 (유형별, 상태별)
- 일정 상세 정보 표시
- 빠른 상태 변경

---

## 디자인 가이드

### Container Pattern

```tsx
// 권장 스타일
<div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
```

### Today Indicator

```tsx
<div className={`inline-flex items-center justify-center w-8 h-8 rounded-full ${
  isToday ? 'bg-blue-600 text-white font-semibold' : 'text-gray-900'
}`}>
  {format(day, 'd')}
</div>
```

### Schedule Card

```tsx
<div className={`px-2.5 py-2 rounded-md border-l-4 ${getScheduleTypeColor(type)}
  hover:shadow-sm transition-shadow cursor-pointer`}>
  <span className="text-[10px] font-semibold uppercase">{label}</span>
  <p className="text-xs font-medium truncate">{title}</p>
</div>
```

### Empty State

```tsx
<div className="text-center py-12">
  <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
    <span className="text-2xl">📭</span>
  </div>
  <p className="text-gray-600 font-medium">등록된 일정이 없습니다.</p>
</div>
```

---

## 법원 지역 표시 로직

### getShortCourt 함수

월간 캘린더에서 법원 지역을 축약형으로 표시합니다.

```typescript
// components/MonthlyCalendar.tsx
const getShortCourt = (location?: string) => {
  if (!location) return ''

  // 1. "OO지원" 패턴 우선 (예: "대전가정법원 서산지원" → "서산")
  const jiwonMatch = location.match(/([가-힣]{2,4})지원/)
  if (jiwonMatch) return jiwonMatch[1]

  // 2. "OO시법원" 패턴 (예: "수원지방법원 안성시법원" → "안성")
  const siMatch = location.match(/([가-힣]{2,4})시법원/)
  if (siMatch) return siMatch[1]

  // 3. 주요 법원명 배열에서 매칭
  const courtNames = ['서울', '수원', '평택', '천안', '대전', ...]
  for (const name of courtNames) {
    if (location.includes(name)) return name
  }

  return location.slice(0, 2)
}
```

### 변환 예시

| 입력 (location) | 출력 |
|-----------------|------|
| `대전가정법원 서산지원 제21호 법정` | **서산** |
| `수원가정법원 평택지원 제402호 법정` | **평택** |
| `수원지방법원 안성시법원` | **안성** |
| `대전가정법원` | **대전** |
| `서울가정법원 본관 401호 법정` | **서울** |

### 데이터 흐름

```
SCOURT API (cortNm)
       ↓
legal_cases.court_name ("대전가정법원 서산지원")
       ↓
unified_calendar VIEW (court_name + location)
       ↓
"대전가정법원 서산지원 제21호 법정"
       ↓
getShortCourt() → "서산"
```

---

## 파일 구조

```
theyool-admin/
├── components/
│   ├── WeeklyCalendar.tsx
│   ├── MonthlyCalendar.tsx
│   ├── UnifiedScheduleModal.tsx
│   └── ScheduleListView.tsx
│
├── app/
│   ├── schedules/
│   │   └── page.tsx
│   └── api/
│       └── admin/
│           ├── calendar/
│           ├── google-calendar/
│           └── holidays/
│
├── lib/
│   ├── google-calendar.ts
│   ├── google-calendar-sync.ts
│   └── utils/
│       └── korean-legal-dates.ts
│
└── types/
    └── schedule.ts
```

---

## 접근성

### 색상 대비 (WCAG AA 충족)

- `text-purple-700` on `bg-purple-50`: 7.5:1
- `text-blue-700` on `bg-blue-50`: 8.2:1
- `text-emerald-700` on `bg-emerald-50`: 6.8:1

### 키보드 내비게이션

```tsx
<button
  className="focus:outline-none focus:ring-2 focus:ring-blue-500"
  tabIndex={0}
>
```

### 스크린 리더

```tsx
<button aria-label="닫기" onClick={onClose}>
  <svg>...</svg>
</button>
```

---

## 성능 최적화

### Memoization

```tsx
const daySchedules = useMemo(
  () => getSchedulesForDay(day),
  [day, schedules]
)
```

### Debounce (검색/필터링)

```tsx
const debouncedSearch = useDebouncedCallback(
  (value) => setSearchQuery(value),
  300
)
```
