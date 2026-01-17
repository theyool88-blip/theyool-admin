# 법원기일 및 법정기간 관리 시스템

**Last Updated**: 2026-01-17

법원 기일과 법정 기간(불변기간)을 통합 관리하는 시스템입니다.

---

## 개요

### 주요 기능

| 구분 | 기능 |
|------|------|
| **법원기일** | 변론기일, 조정기일, 선고기일 등 관리 |
| **법정기간** | 상소기간, 즉시항고기간 등 자동 계산 |
| **긴급 알림** | D-7 법원기일, D-3 데드라인 위젯 |
| **캘린더 통합** | 월간/주간 캘린더에 표시 |
| **사건 연동** | 사건 상세에서 탭으로 관리 |

---

## 법원기일 (Court Hearings)

### 기일 유형

| 코드 | 한글명 |
|------|--------|
| `HEARING_MAIN` | 변론기일 |
| `HEARING_INTERIM` | 사전/보전처분 심문기일 |
| `HEARING_MEDIATION` | 조정기일 |
| `HEARING_INVESTIGATION` | 조사기일 |
| `HEARING_PARENTING` | 상담/교육/프로그램 기일 |
| `HEARING_JUDGMENT` | 선고기일 |
| `HEARING_LAWYER_MEETING` | 변호사미팅 |

### 기일 상태

| 상태 | 설명 |
|------|------|
| `SCHEDULED` | 예정 |
| `COMPLETED` | 완료 |
| `POSTPONED` | 연기 |
| `CANCELLED` | 취소 |

### 데이터베이스 스키마

```sql
CREATE TABLE court_hearings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_number TEXT NOT NULL,
  hearing_type TEXT NOT NULL,
  hearing_date TIMESTAMPTZ NOT NULL,
  location TEXT,
  judge_name TEXT,
  notes TEXT,
  result TEXT,
  report TEXT,
  status TEXT DEFAULT 'SCHEDULED',
  -- SCOURT 원본 데이터 (2026-01-13 추가)
  scourt_type_raw TEXT,       -- 원본 기일명 (예: "제1회 변론기일")
  scourt_result_raw TEXT,     -- 원본 결과 (예: "다음기일지정(2025.02.15)")
  hearing_sequence INTEGER,   -- 기일 회차 (1, 2, 3...)
  scourt_hearing_hash TEXT,   -- 중복 방지용 해시
  -- 출석 변호사 (2026-01-17 추가)
  attending_lawyer_id UUID REFERENCES tenant_members(id),  -- 출석 변호사
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 다가오는 기일 VIEW
CREATE VIEW upcoming_hearings AS
SELECT *,
  DATE_PART('day', hearing_date - NOW()) as days_until_hearing
FROM court_hearings
WHERE status = 'SCHEDULED'
  AND hearing_date >= NOW()
  AND hearing_date <= NOW() + INTERVAL '30 days'
ORDER BY hearing_date ASC;
```

### SCOURT 원본 데이터 필드 (2026-01-13 추가)

SCOURT(나의사건검색) 데이터의 기일 정보를 원본 그대로 저장합니다.

| 필드 | 설명 | 예시 |
|------|------|------|
| `scourt_type_raw` | 원본 기일명 | "제1회 변론기일", "조정기일" |
| `scourt_result_raw` | 원본 결과 | "다음기일지정(2025.02.15)", "변론종결" |
| `hearing_sequence` | 기일 회차 | 1, 2, 3... (제N회에서 추출) |
| `scourt_hearing_hash` | 중복 방지 해시 | 날짜+시간+기일명 기반 SHA256 |

#### 회차 추출 로직

```typescript
// lib/scourt/hearing-sync.ts
export function extractHearingSequence(typeName: string): number | null {
  const match = typeName.match(/제(\d+)회/);
  return match ? parseInt(match[1]) : null;
}

// 예시
extractHearingSequence("제1회 변론기일")  // → 1
extractHearingSequence("제2회 변론준비기일")  // → 2
extractHearingSequence("조정기일")  // → null
```

#### 캘린더 표시

`unified_calendar` 뷰와 `MonthlyCalendar`에서 SCOURT 원본 기일명 우선 표시:

```
기존: "(변론기일) 김OO 이혼사건"
수정: "(제1회 변론기일) 김OO 이혼사건"
```

#### 배치 임포트 연동

`batch-create-stream` API에서 SCOURT 연동 시 기일 데이터도 자동 동기화:

```typescript
// 사건 생성 후 SCOURT 데이터 조회 시
if (scourtLinked && generalData.hearings) {
  await syncHearingsToCourtHearings(
    newCase.id,
    caseNumber,
    generalData.hearings.map(h => ({
      date: h.trmDt,
      time: h.trmHm,
      type: h.trmNm,        // → scourt_type_raw
      location: h.trmPntNm,
      result: h.rslt,       // → scourt_result_raw
    }))
  )
}
```

#### 관련 파일

| 파일 | 역할 |
|------|------|
| `lib/scourt/hearing-sync.ts` | 기일 동기화 로직 |
| `components/MonthlyCalendar.tsx` | 캘린더 UI |
| `supabase/migrations/20260111_hearing_scourt_raw_fields.sql` | DB 마이그레이션 |
| `supabase/migrations/20260111_update_unified_calendar_scourt_raw.sql` | 뷰 업데이트 |
| `scripts/backfill-court-hearings.ts` | 기존 데이터 백필 스크립트 |

---

## 법정기간 (Case Deadlines)

### 데드라인 유형

| 코드 | 한글명 | 일수 |
|------|--------|------|
| `DL_APPEAL` | 상소기간 | 14일 |
| `DL_MEDIATION_OBJ` | 조정/화해 이의기간 | 2일 |
| `DL_IMM_APPEAL` | 즉시항고기간 | 7일 |
| `DL_APPEAL_BRIEF` | 항소이유서 제출기한 | 20일 |
| `DL_RETRIAL` | 재심의 소 제기기한 | 30일 |

### 자동 계산 트리거

```sql
CREATE OR REPLACE FUNCTION calculate_deadline()
RETURNS TRIGGER AS $$
DECLARE
  deadline_days INTEGER;
BEGIN
  SELECT days INTO deadline_days
  FROM deadline_types
  WHERE type = NEW.deadline_type;

  NEW.deadline_date := NEW.trigger_date + (deadline_days || ' days')::INTERVAL;
  NEW.deadline_datetime := (NEW.deadline_date::DATE + INTERVAL '24 hours');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**작동 방식**:
1. `trigger_date`와 `deadline_type`만 입력
2. 트리거가 자동으로 `deadline_date`, `deadline_datetime` 계산

**예시**:
```
trigger_date: 2025-11-22
deadline_type: DL_APPEAL (14일)
→ deadline_date: 2025-12-06
→ deadline_datetime: 2025-12-07 00:00
```

### 데드라인 상태

| 상태 | 설명 |
|------|------|
| `PENDING` | 대기 중 |
| `COMPLETED` | 완료 |
| `OVERDUE` | 기한 초과 |

---

## API 엔드포인트

### 법원기일

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/admin/court-hearings` | 기일 목록 조회 |
| POST | `/api/admin/court-hearings` | 기일 생성 |
| GET | `/api/admin/court-hearings/[id]` | 기일 상세 |
| PUT | `/api/admin/court-hearings/[id]` | 기일 수정 |
| DELETE | `/api/admin/court-hearings/[id]` | 기일 삭제 |

### 데드라인

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/admin/case-deadlines` | 데드라인 목록 |
| POST | `/api/admin/case-deadlines` | 데드라인 생성 |
| GET | `/api/admin/case-deadlines/[id]` | 데드라인 상세 |
| PUT | `/api/admin/case-deadlines/[id]` | 데드라인 수정 |
| DELETE | `/api/admin/case-deadlines/[id]` | 데드라인 삭제 |

### 쿼리 파라미터

```
GET /api/admin/court-hearings?
  case_number=2024드단12345
  &hearing_type=HEARING_MAIN
  &status=SCHEDULED
  &from_date=2025-01-01
  &to_date=2025-12-31
  &limit=10
  &offset=0
```

---

## 대시보드 위젯

### 다가오는 법원 기일 (D-7 이내)

- `upcoming_hearings` VIEW 사용
- D-7 ~ D-day 기일 표시 (최대 5개)
- "+ 기일 추가" 버튼 → QuickAddHearingModal

### 긴급 데드라인 (D-3 이내)

- `urgent_deadlines` VIEW 사용
- D-3 ~ D-day 데드라인 표시 (최대 5개)
- "+ 데드라인 추가" 버튼 → QuickAddDeadlineModal

### 긴급도 색상

| 조건 | 색상 |
|------|------|
| D-1 이하 | 빨강 |
| D-3 이하 | 주황 |
| D-7 이하 | 노랑 |

---

## 사건 상세 탭

### 법원기일 탭

- 해당 사건의 모든 법원 기일 목록
- 기일 유형, 상태, 날짜/시간, 법정, 담당판사 표시
- 사건번호 미등록 시 안내 메시지

### 데드라인 탭

- 해당 사건의 모든 데드라인 목록
- D-day 표시 (D-1, D-3, D-7)
- 기산일, 만료일, 만료 일시 표시
- 완료 처리 정보

---

## 캘린더 통합

### 색상 코딩

| 일정 타입 | 색상 |
|----------|------|
| 변론 (trial) | sage (녹색) |
| 상담 (consultation) | 파랑 |
| 회의 (meeting) | 회색 |
| 법원기일 (court_hearing) | sage (녹색) |
| **연기 기일** | **amber (주황-노랑)** |
| 데드라인 (deadline) | 주황 |
| 변호사미팅 | 청록 (teal) |
| 선고/양육상담 | 회색 (참석 불필요) |

### 통합 조회

MonthlyCalendar에서 3개 테이블 통합:
- `case_schedules` (기존 일정)
- `court_hearings` (법원 기일)
- `case_deadlines` (데드라인)

### 캘린더 표시 최적화 (2026-01-13 추가)

#### 법원명 축약 표시

`shortenCourtLocation` 함수로 법원명을 축약하되 법정 정보는 유지:

| 원본 | 축약 |
|------|------|
| 수원가정법원 평택지원 제21호 법정 | 평택지원 제21호 법정 |
| 수원고등법원 제804호 법정 | 수원고법 제804호 법정 |
| 서울가정법원 본관 401호 | 서울가정 본관 401호 |
| 대전지방법원 제101호 법정 | 대전지법 제101호 법정 |

**축약 규칙:**
1. **지원 우선**: `[법원] [지원] [장소]` → `[지원] [장소]`
2. **고등법원**: `[도시]고등법원` → `[도시]고법`
3. **가정법원**: `[도시]가정법원` → `[도시]가정`
4. **지방법원**: `[도시]지방법원` → `[도시]지법`

#### 연기 기일 구분 표시

`isPostponedHearing` 함수로 연기된 기일 감지:

**감지 키워드** (`scourt_result_raw` 확인):
- `기일변경` (예: "기일변경", "기일변경(추후지정)")
- `연기`
- `취하`
- `취소`
- `변경지정`

**표시 변경:**
- 색상: amber (`bg-amber-50 text-amber-700 border-l-amber-500`)
- 라벨: 원본 기일명 대신 "기일연기"로 표시

#### 적용 위치

| 컴포넌트 | 위치 | 사용 함수 |
|----------|------|----------|
| MonthlyCalendar | 월간 그리드 작은 셀 | `getShortCourt` (도시명만) |
| MonthlyCalendar | 확장된 카드 뷰 | `shortenCourtLocation` |
| ScheduleListView | 장소 컬럼 | `shortenCourtLocation` |

---

## 파일 구조

```
theyool-admin/
├── components/
│   ├── QuickAddHearingModal.tsx
│   ├── QuickAddDeadlineModal.tsx
│   ├── HearingDetailModal.tsx
│   └── MonthlyCalendar.tsx
│
├── app/api/admin/
│   ├── court-hearings/
│   │   ├── route.ts
│   │   └── [id]/route.ts
│   ├── case-deadlines/
│   │   ├── route.ts
│   │   └── [id]/route.ts
│   └── deadline-types/
│       └── route.ts
│
├── lib/supabase/
│   ├── court-hearings.ts
│   ├── case-deadlines.ts
│   └── deadline-types.ts
│
└── types/
    └── court-hearing.ts
```

---

## 빠른 추가 모달

### QuickAddHearingModal

1. 사건번호 자동완성 검색
2. 기일 유형 선택
3. 날짜/시간 선택
4. 법정, 담당판사, 메모 입력
5. 저장 → 대시보드 자동 새로고침

### QuickAddDeadlineModal

1. 사건번호 자동완성 검색
2. 데드라인 유형 선택
3. 기산일 입력
4. **자동 계산 미리보기** 표시
5. 메모 입력 → 저장

---

## TypeScript 타입

```typescript
// 법원 기일
interface CourtHearing {
  id: string
  case_number: string
  hearing_type: HearingType
  hearing_date: string
  location: string | null
  judge_name: string | null
  notes: string | null
  status: HearingStatus
  created_at: string
  updated_at: string
  // SCOURT 원본 데이터 (2026-01-13 추가)
  scourt_type_raw: string | null     // 원본 기일명 (예: "제1회 변론기일")
  scourt_result_raw: string | null   // 원본 결과 (예: "다음기일지정(2025.02.15)")
  hearing_sequence: number | null    // 기일 회차 (1, 2, 3...)
  // 출석 변호사 (2026-01-17 추가)
  attending_lawyer_id?: string | null  // 출석 변호사 ID (tenant_members 참조)
}

// 데드라인
interface CaseDeadline {
  id: string
  case_number: string
  deadline_type: DeadlineType
  trigger_date: string
  deadline_date: string      // 자동 계산
  deadline_datetime: string  // 자동 계산
  notes: string | null
  status: DeadlineStatus
  completed_at: string | null
}
```
