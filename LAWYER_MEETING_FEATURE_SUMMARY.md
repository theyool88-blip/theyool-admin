# 변호사미팅 기일 타입 추가 완료

**작업일**: 2025-11-22
**작업자**: Claude Code (Backend & SEO Specialist)

## 개요

법원기일 타입에 "변호사미팅" (HEARING_LAWYER_MEETING)을 추가하여, 변호사와 의뢰인 간의 상담 및 미팅을 법원 기일 시스템에 등록할 수 있도록 구현했습니다.

---

## 수정된 파일 목록

### 1. 데이터베이스 마이그레이션
**파일**: `/supabase/migrations/20251122_add_lawyer_meeting_type.sql`

```sql
ALTER TYPE hearing_type ADD VALUE IF NOT EXISTS 'HEARING_LAWYER_MEETING';
```

- ENUM 타입에 새로운 값 추가
- 기존 데이터에 영향 없음
- PostgreSQL 14+ IF NOT EXISTS 구문 사용

**실행 방법**:
```bash
# Supabase SQL Editor에서 실행
1. Supabase Dashboard → SQL Editor 이동
2. 파일 내용 복사 & 붙여넣기
3. Run 버튼 클릭
```

**검증 쿼리**:
```sql
-- ENUM 값 확인
SELECT enumlabel FROM pg_enum
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'hearing_type')
ORDER BY enumsortorder;

-- 예상 결과:
-- HEARING_MAIN
-- HEARING_INTERIM
-- HEARING_MEDIATION
-- HEARING_INVESTIGATION
-- HEARING_PARENTING
-- HEARING_JUDGMENT
-- HEARING_LAWYER_MEETING ← 신규 추가
```

---

### 2. TypeScript 타입 정의
**파일**: `/types/court-hearing.ts`

#### 수정 내용:

**2-1. HEARING_TYPES 상수 추가**
```typescript
export const HEARING_TYPES = {
  HEARING_MAIN: 'HEARING_MAIN',
  HEARING_INTERIM: 'HEARING_INTERIM',
  HEARING_MEDIATION: 'HEARING_MEDIATION',
  HEARING_INVESTIGATION: 'HEARING_INVESTIGATION',
  HEARING_PARENTING: 'HEARING_PARENTING',
  HEARING_JUDGMENT: 'HEARING_JUDGMENT',
  HEARING_LAWYER_MEETING: 'HEARING_LAWYER_MEETING', // ← 신규 추가
} as const;
```

**2-2. 한글 라벨 추가**
```typescript
export const HEARING_TYPE_LABELS: Record<HearingType, string> = {
  HEARING_MAIN: '변론기일',
  HEARING_INTERIM: '사전·보전처분 심문기일',
  HEARING_MEDIATION: '조정기일',
  HEARING_INVESTIGATION: '조사기일',
  HEARING_PARENTING: '상담·교육·프로그램 기일',
  HEARING_JUDGMENT: '선고기일',
  HEARING_LAWYER_MEETING: '변호사미팅', // ← 신규 추가
};
```

**2-3. 세부 기일명 옵션 추가**
```typescript
export const HEARING_DETAIL_OPTIONS: Record<HearingType, string[]> = {
  // ... 기존 옵션들 ...
  HEARING_LAWYER_MEETING: [ // ← 신규 추가
    '변호사 상담',
    '의뢰인 미팅',
    '사건 협의',
    '전략 회의',
  ],
};
```

---

### 3. UI 컴포넌트 업데이트

#### 3-1. QuickAddHearingModal.tsx
**파일**: `/components/QuickAddHearingModal.tsx`

**수정 불필요**: 이미 `HEARING_TYPE_LABELS`를 사용하여 동적으로 옵션을 생성하므로, TypeScript 타입만 업데이트하면 자동으로 "변호사미팅" 옵션이 표시됩니다.

```typescript
// 이미 구현된 코드 (수정 불필요)
<select value={formData.hearing_type} onChange={...}>
  <option value="">선택하세요</option>
  {Object.entries(HEARING_TYPE_LABELS).map(([key, label]) => (
    <option key={key} value={key}>
      {label}  {/* "변호사미팅" 자동 표시 */}
    </option>
  ))}
</select>
```

---

#### 3-2. CaseDetail.tsx
**파일**: `/components/CaseDetail.tsx`

**수정 내용**: 변호사미팅을 청록색(teal)으로 구분

```typescript
// 신규 함수 추가
const getHearingTypeColor = (type: HearingType) => {
  // 변호사미팅은 청록색(teal), 일반 법원기일은 빨강색
  if (type === 'HEARING_LAWYER_MEETING') {
    return 'bg-teal-50 text-teal-700'
  }
  return 'bg-red-50 text-red-700'
}

// UI 적용 (기존 하드코딩된 색상 → 동적 함수 호출)
<span className={`px-3 py-1.5 rounded-md text-sm font-semibold ${getHearingTypeColor(hearing.hearing_type as HearingType)}`}>
  {HEARING_TYPE_LABELS[hearing.hearing_type as HearingType]}
</span>
```

**시각적 차이**:
- 일반 법원기일: 빨강색 배지 (`bg-red-50 text-red-700`)
- 변호사미팅: 청록색 배지 (`bg-teal-50 text-teal-700`)

---

#### 3-3. MonthlyCalendar.tsx
**파일**: `/components/MonthlyCalendar.tsx`

**수정 내용**:

**3-3-1. UnifiedSchedule 인터페이스 확장**
```typescript
interface UnifiedSchedule {
  // ... 기존 필드 ...
  hearing_type?: string  // ← 신규 추가: court_hearing 타입일 경우 hearing_type 저장
}
```

**3-3-2. 법원기일 데이터 조회 시 hearing_type 포함**
```typescript
if (hearings) {
  hearings.forEach((hearing) => {
    const hearingDateTime = new Date(hearing.hearing_date)
    allSchedules.push({
      id: `hearing_${hearing.id}`,
      type: 'court_hearing',
      title: HEARING_TYPE_LABELS[hearing.hearing_type as keyof typeof HEARING_TYPE_LABELS],
      // ... 기존 필드 ...
      hearing_type: hearing.hearing_type, // ← 신규 추가: 변호사미팅 구분용
    })
  })
}
```

**3-3-3. 색상 함수 업데이트**
```typescript
const getScheduleTypeColor = (type: ScheduleType, hearingType?: string) => {
  // 변호사미팅은 청록색(teal)으로 구분
  if (type === 'court_hearing' && hearingType === 'HEARING_LAWYER_MEETING') {
    return 'bg-teal-50 text-teal-700 border-l-teal-400'
  }

  switch (type) {
    case 'court_hearing': return 'bg-red-50 text-red-700 border-l-red-400'
    // ... 기타 타입 ...
  }
}

const getScheduleTypeDot = (type: ScheduleType, hearingType?: string) => {
  // 변호사미팅은 청록색(teal) 점으로 구분
  if (type === 'court_hearing' && hearingType === 'HEARING_LAWYER_MEETING') {
    return 'bg-teal-400'
  }

  switch (type) {
    case 'court_hearing': return 'bg-red-400'
    // ... 기타 타입 ...
  }
}
```

**3-3-4. 함수 호출 부분 업데이트**
```typescript
// 캘린더 그리드의 점 표시
<div className={`w-1.5 h-1.5 rounded-full ${getScheduleTypeDot(schedule.type, schedule.hearing_type)}`} />

// 캘린더 그리드의 일정 미리보기
<div className={`text-[10px] px-2 py-1.5 rounded border-l-2 ${getScheduleTypeColor(schedule.type, schedule.hearing_type)} ...`}>

// 상세 일정 카드
<div className={`p-4 rounded-lg border-l-4 ${getScheduleTypeColor(schedule.type, schedule.hearing_type)} ...`}>
```

**시각적 차이**:
- 일반 법원기일:
  - 점: 빨강색 (`bg-red-400`)
  - 배경: 빨강 계열 (`bg-red-50 text-red-700 border-l-red-400`)
- 변호사미팅:
  - 점: 청록색 (`bg-teal-400`)
  - 배경: 청록 계열 (`bg-teal-50 text-teal-700 border-l-teal-400`)

---

## 색상 가이드

| 기일 타입 | 배지 색상 | 점 색상 | Tailwind 클래스 |
|----------|----------|--------|----------------|
| 변론기일 | 빨강 | 빨강 | `bg-red-50 text-red-700`, `bg-red-400` |
| 사전·보전처분 심문기일 | 빨강 | 빨강 | `bg-red-50 text-red-700`, `bg-red-400` |
| 조정기일 | 빨강 | 빨강 | `bg-red-50 text-red-700`, `bg-red-400` |
| 조사기일 | 빨강 | 빨강 | `bg-red-50 text-red-700`, `bg-red-400` |
| 상담·교육·프로그램 기일 | 빨강 | 빨강 | `bg-red-50 text-red-700`, `bg-red-400` |
| 선고기일 | 빨강 | 빨강 | `bg-red-50 text-red-700`, `bg-red-400` |
| **변호사미팅** | **청록** | **청록** | `bg-teal-50 text-teal-700`, `bg-teal-400` |

---

## 사용 예시

### 1. 법원 기일 추가 (QuickAddHearingModal)

```
기일 유형 선택:
  - 변론기일
  - 사전·보전처분 심문기일
  - 조정기일
  - 조사기일
  - 상담·교육·프로그램 기일
  - 선고기일
  - 변호사미팅 ← 신규 추가!
```

### 2. 사건 상세 페이지 (CaseDetail)

```
[청록색 배지] 변호사미팅  [파란색 배지] 예정
2025.11.25 14:00

법정: 법무법인 더율 사무실
담당 판사: -
메모: 사건 진행 상황 논의 및 전략 수립
```

### 3. 월간 캘린더 (MonthlyCalendar)

```
11월 25일 (월)

[청록색 점] 14:00 변호사미팅
[빨강색 점] 10:00 변론기일
```

---

## 테스트 시나리오

### 시나리오 1: 변호사미팅 추가
1. QuickAddHearingModal 열기
2. "기일 유형"에서 "변호사미팅" 선택
3. 날짜/시간 입력 (예: 2025-11-25 14:00)
4. 법정 입력 (예: "법무법인 더율 평택사무실")
5. 메모 입력 (예: "위자료 청구 전략 협의")
6. 저장 → 청록색 배지로 표시됨

### 시나리오 2: 캘린더에서 구분 확인
1. MonthlyCalendar에서 11월 25일 확인
2. 청록색 점이 표시됨 (변호사미팅)
3. 빨강색 점과 구분되어 보임 (일반 법원기일)
4. 날짜 클릭 시 상세 일정에서 청록색 테두리로 표시됨

### 시나리오 3: 사건 상세에서 확인
1. 사건 상세 페이지 → "법원기일" 탭
2. 변호사미팅: 청록색 배지
3. 일반 법원기일: 빨강색 배지
4. 시각적 구분 명확함

---

## 데이터베이스 마이그레이션 실행 안내

### Supabase SQL Editor에서 실행

1. **Supabase Dashboard 접속**
   - URL: https://supabase.com/dashboard/project/kqqyipnlkmmprfgygauk
   - 로그인

2. **SQL Editor 이동**
   - 좌측 메뉴 → "SQL Editor" 클릭

3. **새 쿼리 생성**
   - "New query" 버튼 클릭

4. **마이그레이션 SQL 붙여넣기**
   ```sql
   -- 파일: /supabase/migrations/20251122_add_lawyer_meeting_type.sql
   ALTER TYPE hearing_type ADD VALUE IF NOT EXISTS 'HEARING_LAWYER_MEETING';
   ```

5. **실행**
   - "Run" 버튼 클릭 (또는 Cmd/Ctrl + Enter)

6. **결과 확인**
   - Success 메시지 확인
   - 에러 발생 시: "value already exists" 에러는 무시 가능 (이미 추가됨)

7. **검증**
   ```sql
   SELECT enumlabel FROM pg_enum
   WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'hearing_type')
   ORDER BY enumsortorder;
   ```
   - 결과에 `HEARING_LAWYER_MEETING` 포함 확인

---

## 주의사항

### 1. ENUM 값 추가 특성
- **삭제 불가**: ENUM에 추가된 값은 삭제할 수 없습니다
- **순서 고정**: 추가된 값은 마지막에 추가됩니다
- **트랜잭션 제약**: ENUM 값 추가는 트랜잭션 외부에서 실행해야 합니다

### 2. 기존 데이터 영향
- **영향 없음**: 기존 데이터는 그대로 유지됩니다
- **후방 호환성**: 기존 코드는 정상 작동합니다

### 3. TypeScript 타입 동기화
- 마이그레이션 실행 후 TypeScript 타입을 업데이트했으므로, 타입 불일치 문제가 없습니다

---

## 파일 경로 요약

```
/Users/hskim/theyool-admin/
├── supabase/migrations/
│   └── 20251122_add_lawyer_meeting_type.sql  ← 마이그레이션 SQL
├── types/
│   └── court-hearing.ts                      ← TypeScript 타입 정의
└── components/
    ├── QuickAddHearingModal.tsx              ← 기일 추가 모달 (자동 반영)
    ├── CaseDetail.tsx                        ← 사건 상세 (청록 색상 추가)
    └── MonthlyCalendar.tsx                   ← 월간 캘린더 (청록 색상 추가)
```

---

## 다음 단계

1. **마이그레이션 실행**: Supabase SQL Editor에서 마이그레이션 SQL 실행
2. **테스트**: 변호사미팅 기일 추가 및 캘린더 표시 확인
3. **배포**: 프론트엔드 코드 배포 (이미 커밋 가능 상태)

---

## 완료 체크리스트

- [x] 데이터베이스 마이그레이션 SQL 생성
- [x] TypeScript 타입 정의 업데이트
  - [x] HEARING_TYPES 추가
  - [x] HEARING_TYPE_LABELS 추가
  - [x] HEARING_DETAIL_OPTIONS 추가
- [x] QuickAddHearingModal 자동 반영 확인
- [x] CaseDetail 청록 색상 추가
- [x] MonthlyCalendar 청록 색상 추가
- [ ] Supabase 마이그레이션 실행 (사용자 작업)
- [ ] 프로덕션 배포
- [ ] 실제 환경 테스트

---

**작업 완료**: 2025-11-22
**문서 작성**: Claude Code
