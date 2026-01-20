# 캘린더 시스템

**Last Updated**: 2026-01-20

법무법인 더율의 모든 일정을 통합 관리하는 캘린더 시스템입니다.

---

## 개요

### 주요 기능

| 기능 | 설명 |
|------|------|
| **Schedule-X 캘린더** | 월간/주간/일간 뷰 지원 |
| **통합 일정 조회** | 4개 테이블 통합 (일정, 법원기일, 데드라인, 상담) |
| **Google Calendar 동기화** | 양방향 동기화 |
| **공휴일 표시** | 한국 공휴일 자동 반영 (슈퍼 어드민 관리) |
| **색상 코딩** | 일정 유형별 구분 |
| **반응형 레이아웃** | 브라우저 크기에 따라 자동 조정 |

---

## Schedule-X 캘린더 (2026-01-20 추가)

### 도입 배경

기존 커스텀 캘린더 컴포넌트(WeeklyCalendar, MonthlyCalendar)를 Schedule-X 라이브러리로 통합했습니다.

### 장점

| 항목 | 설명 |
|------|------|
| **통합 뷰** | 월/주/일 뷰를 하나의 컴포넌트로 관리 |
| **드래그 앤 드롭** | 일정 이동 및 리사이즈 지원 |
| **커스텀 이벤트 렌더링** | 법무 특화 정보 표시 (사건번호, 법원 등) |
| **공휴일 통합** | 캘린더 내 공휴일 표시 |
| **유지보수 용이** | 라이브러리 업데이트로 버그 수정 |

### 사용 라이브러리

```json
{
  "@schedule-x/react": "^1.x",
  "@schedule-x/calendar": "^1.x",
  "@schedule-x/event-modal": "^1.x",
  "@schedule-x/resize": "^1.x",
  "@schedule-x/drag-and-drop": "^1.x"
}
```

### 반응형 크기 설정

**너비**: `max-w-screen-2xl` (1536px)
**높이**:
- 월간 뷰 셀: 140px (모바일: 90px)
- 캘린더 컨텐츠: 600px (lg: 750px)
- 주간/일간 뷰: 700px (lg: 800px)

```css
/* app/globals.css */
.sx__month-grid-day {
  min-height: 140px;
}

.sx__calendar-content {
  min-height: 600px;
}

@media (min-width: 1024px) {
  .sx__calendar-content {
    min-height: 750px;
  }
}
```

### 컴포넌트 구조

```
components/
├── ScheduleXCalendar.tsx    # 메인 캘린더 컴포넌트
└── calendar/
    └── CustomEventRenderer.tsx  # 커스텀 이벤트 렌더링
```

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

| 유형 | 상태 | 색상 | 클래스 |
|------|------|------|--------|
| 법원기일 | 일반 | Sage | `bg-sage-50 text-sage-700 border-l-sage-500` |
| | 변호사미팅 | Teal | `bg-teal-50 text-teal-700 border-l-teal-500` |
| | 연기됨 | Gray (흐림) | `bg-gray-100 text-gray-400 border-l-gray-300` |
| | 참석불필요 | Gray | `bg-gray-50 text-gray-600 border-l-gray-400` |
| 상담 | 확정 | Blue | `bg-blue-50 text-blue-700 border-l-blue-500` |
| | 미확정 | Blue + 점선 | `bg-blue-50 text-blue-700 border-l-blue-400 border-dashed` |
| 회의 | - | Gray | `bg-gray-50 text-gray-600 border-l-gray-400` |
| 데드라인 | - | Orange | `bg-orange-50 text-orange-700 border-l-orange-500` |

### 특수 조건

- **연기된 기일**: scourt_result_raw에 "기일변경", "연기", "취하", "취소" 포함 시
- **참석불필요 기일**: HEARING_JUDGMENT, HEARING_INVESTIGATION, HEARING_PARENTING
- **미확정 상담**: event_subtype이 `pending_`으로 시작

### 정렬 규칙

- **데드라인 최상단**: 같은 날짜 내에서 데드라인이 가장 위에 표시됨

### 도트 인디케이터

```tsx
const getScheduleTypeDot = (type: ScheduleType, hearingType?: string) => {
  if (type === 'court_hearing' && hearingType === 'HEARING_LAWYER_MEETING') {
    return 'bg-teal-500'
  }
  if (type === 'court_hearing' && (hearingType === 'HEARING_JUDGMENT' || hearingType === 'HEARING_PARENTING')) {
    return 'bg-gray-400'
  }
  switch (type) {
    case 'trial': return 'bg-sage-500'
    case 'consultation': return 'bg-blue-500'
    case 'meeting': return 'bg-gray-400'
    case 'court_hearing': return 'bg-sage-500'
    case 'deadline': return 'bg-orange-500'
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

### 권한 구조 (2026-01-20 변경)

| 역할 | 권한 |
|------|------|
| **슈퍼 어드민** | 공휴일 CRUD (추가, 수정, 삭제, 일괄 처리) |
| **테넌트 어드민** | 공휴일 조회만 가능 (읽기 전용) |

### 기능

- 한국 공휴일 등록/관리
- 상담 예약 시 반영
- 법정 기간 계산에 활용 (공휴일 제외)
- 캘린더에 공휴일 표시

### API 엔드포인트

**테넌트 어드민용 (읽기 전용)**

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/admin/holidays?year=2026` | 공휴일 목록 조회 |

**슈퍼 어드민용 (CRUD)**

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/superadmin/holidays` | 공휴일 목록 (페이징, 카운트) |
| POST | `/api/superadmin/holidays` | 공휴일 추가 |
| GET | `/api/superadmin/holidays/[id]` | 공휴일 상세 |
| PATCH | `/api/superadmin/holidays/[id]` | 공휴일 수정 |
| DELETE | `/api/superadmin/holidays/[id]` | 공휴일 삭제 |
| POST | `/api/superadmin/holidays/bulk` | 공휴일 일괄 추가 |
| DELETE | `/api/superadmin/holidays/bulk?year=2026` | 연도별 일괄 삭제 |

### 데이터베이스 스키마

```sql
CREATE TABLE holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  holiday_date DATE NOT NULL UNIQUE,
  holiday_name TEXT NOT NULL,
  year INTEGER GENERATED ALWAYS AS (EXTRACT(YEAR FROM holiday_date)) STORED,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- year 컬럼은 holiday_date에서 자동 계산 (트리거)
```

### UI 위치

- **슈퍼 어드민**: `/superadmin/settings` → 공휴일 관리 섹션
- **테넌트 어드민**: `/admin/settings` → 공휴일 탭 (조회만 가능)

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

## 화상기일 배지 (2026-01-16 추가)

### 개요

SCOURT에서 "화상장치" 기일 정보를 추출하여 캘린더에 [화상] 배지를 표시합니다. 의뢰인(우리 측)이 화상으로 참여하는 경우에만 배지가 표시됩니다.

### 화상기일 유형

| 유형 | SCOURT 표시 | video_participant_side | 배지 표시 |
|------|------------|----------------------|----------|
| 쌍방 화상 | `쌍방 화상장치` | `both` | ✅ [화상] |
| 우리측 화상 | `일방 화상장치` + 원고측/피고측 | `plaintiff_side` or `defendant_side` | ✅ [화상] (우리 측일 때만) |
| 상대방만 화상 | `일방 화상장치` + 상대방측 | `plaintiff_side` or `defendant_side` | ❌ (표시 안 함) |

### 데이터 흐름

```
SCOURT API (btprAgntList[].agntNm에 [화상장치] 마커)
        ↓
hearing-sync.ts (extractVideoParticipantFromRawData)
        ↓
court_hearings.video_participant_side
        ↓
unified_calendar VIEW (video_participant_side, our_client_side)
        ↓
MonthlyCalendar.tsx (getVideoBadgeInfo)
```

### 우리 측 판단 로직

```typescript
// unified_calendar VIEW의 our_client_side 컬럼
CASE
  WHEN party_type_label ILIKE '%원고%' OR '%청구인%' OR '%신청인%'
    THEN 'plaintiff_side'  -- 원고 측
  WHEN party_type_label ILIKE '%피고%' OR '%상대방%' OR '%피신청인%'
    THEN 'defendant_side'  -- 피고 측
END
```

### 배지 표시 로직

```typescript
// components/MonthlyCalendar.tsx
const getVideoBadgeInfo = (
  scourtTypeRaw?: string,
  videoParticipantSide?: string,
  ourClientSide?: string
) => {
  // 쌍방 화상 → 우리도 화상이므로 표시
  if (videoParticipantSide === 'both') {
    return { show: true, label: '화상', color: 'bg-purple-100 text-purple-700' }
  }

  // 일방 화상 - 우리(의뢰인)가 화상일 때만 표시
  if (videoParticipantSide && ourClientSide) {
    if (videoParticipantSide === ourClientSide) {
      return { show: true, label: '화상', color: 'bg-purple-100 text-purple-700' }
    }
    return null  // 상대방만 화상이면 표시 안 함
  }

  return null
}
```

### 관련 마이그레이션

| 파일 | 설명 |
|------|------|
| `20260114_court_hearings_video_participant.sql` | `video_participant_side` 컬럼 추가 |
| `20260114_unified_calendar_video_participant.sql` | VIEW에 `our_client_side` 컬럼 추가 |

### 백필 스크립트

기존 화상기일 데이터의 `video_participant_side`를 채우는 스크립트:

```bash
npx tsx scripts/backfill-video-participant.ts
```

---

## 출석 변호사 필드

### 개요

법원 기일(court_hearing)에만 출석 변호사를 지정할 수 있습니다. 단, 변호사 출석이 불필요한 기일 유형에서는 해당 필드가 표시되지 않습니다.

### 변호사 출석 불필요 기일

| 유형 | 코드 | 이유 |
|------|------|------|
| 선고기일 | `HEARING_JUDGMENT` | 판결 선고만 이루어짐 |
| 조사기일 | `HEARING_INVESTIGATION` | 당사자만 참석 (가사조사관 면담) |
| 상담/교육 기일 | `HEARING_PARENTING` | 당사자만 참석 (부모교육 등) |
| 조정조치기일 | `scourt_type_raw`에 "조정조치" 포함 | 당사자만 참석 |

### 구현 코드

```typescript
// components/MonthlyCalendar.tsx

// 기일 유형으로 체크
const NO_LAWYER_ATTENDANCE_TYPES = [
  'HEARING_JUDGMENT',
  'HEARING_INVESTIGATION',
  'HEARING_PARENTING',
] as const

// 키워드로 체크 (조정조치기일 등)
const NO_LAWYER_ATTENDANCE_KEYWORDS = ['조정조치']

function isNoLawyerAttendanceRequired(schedule: UnifiedSchedule): boolean {
  if (NO_LAWYER_ATTENDANCE_TYPES.includes(schedule.hearing_type)) {
    return true
  }
  if (schedule.scourt_type_raw?.includes('조정조치')) {
    return true
  }
  return false
}
```

### 렌더링 조건

```tsx
{schedule.type === 'court_hearing' &&
 tenantMembers.length > 0 &&
 !isNoLawyerAttendanceRequired(schedule) && (
  <div>출석 변호사 드롭다운</div>
)}
```

---

## 파일 구조

```
luseed/
├── components/
│   ├── ScheduleXCalendar.tsx     # 메인 Schedule-X 캘린더
│   ├── WeeklyCalendar.tsx        # 레거시 (참고용)
│   ├── MonthlyCalendar.tsx       # 레거시 (참고용)
│   ├── UnifiedScheduleModal.tsx
│   └── ScheduleListView.tsx
│
├── app/
│   ├── schedules/
│   │   └── page.tsx
│   ├── admin/
│   │   └── settings/
│   │       └── HolidayManagement.tsx  # 테넌트용 (읽기 전용)
│   ├── superadmin/
│   │   └── settings/
│   │       └── page.tsx              # 슈퍼어드민 공휴일 CRUD
│   └── api/
│       ├── admin/
│       │   ├── calendar/
│       │   ├── google-calendar/
│       │   └── holidays/             # GET only (읽기 전용)
│       └── superadmin/
│           └── holidays/             # 전체 CRUD
│               ├── route.ts          # GET, POST
│               ├── [id]/route.ts     # GET, PATCH, DELETE
│               └── bulk/route.ts     # POST, DELETE (일괄 처리)
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
