# 불변기한 시스템 (Case Deadline System)

## 개요

법무법인 더율의 불변기한(법정기한) 관리 시스템입니다. SCOURT 연동 또는 수동 입력을 통해 항소기한, 상고기한 등 법정 불변기간을 자동 계산하고 관리합니다.

## 법적 근거

### 민법 제161조 (기간 말일의 연장)
> 기간의 말일이 토요일 또는 공휴일에 해당한 때에는 기간은 그 익일로 만료한다.

### 민법 제157조 (초일불산입 원칙)
> 기간을 일, 주, 월 또는 연으로 정한 때에는 기간의 초일은 산입하지 아니한다. 그러나 그 기간이 오전 영시로부터 시작하는 때에는 그러하지 아니하다.

## 불변기간 유형

### 상소기간

| 코드 | 명칭 | 기간 | 기산일 | 법적 근거 |
|------|------|------|--------|----------|
| DL_APPEAL | 민사/가사 상소기간 | 14일 | 판결 **송달일** | 민소법 §396 |
| DL_CRIMINAL_APPEAL | 형사 상소기간 | 7일 | 판결 **선고일** | 형소법 §358 |
| DL_FAMILY_NONLIT | 가사비송 즉시항고 | 14일 | 심판 **고지일** | 가사소송법 |
| DL_IMM_APPEAL | 민사 즉시항고 | 7일 | 결정 **고지일** | 민소법 §444 |

### 항소이유서/상고이유서 제출기한

| 코드 | 명칭 | 기간 | 기산일 | 연장 | 법적 근거 |
|------|------|------|--------|------|----------|
| DL_APPEAL_BRIEF | 민사 항소이유서 | 40일 | 기록접수 **통지일** | 1회 30일 | 민소법 §402의2 (2025.3.1 시행) |
| DL_CRIMINAL_APPEAL_BRIEF | 형사 항소이유서 | 20일 | 기록접수 **통지일** | 불가 | 형소법 §361의3 |
| DL_FINAL_APPEAL_BRIEF | 민사 상고이유서 | 20일 | 기록접수 **통지일** | 불가 | 민소법 §427 |
| DL_CRIMINAL_FINAL_BRIEF | 형사 상고이유서 | 20일 | 기록접수 **통지일** | 불가 | 형소법 §379 |

> **중요**: 항소이유서/상고이유서 제출기한의 기산일은 "기록접수 통지일"로, 판결선고일이나 송달일과 다릅니다.
> SCOURT 자동등록 시 별도로 수동 입력해야 합니다.

### 기타 불변기간

| 코드 | 명칭 | 기간 | 기산일 | 법적 근거 |
|------|------|------|--------|----------|
| DL_MEDIATION_OBJ | 조정·화해 이의 | 14일 | 결정서 **송달일** | 민사조정법 §34 |
| DL_RETRIAL | 재심의 소 제기 | 30일 | 재심사유 **안 날** | 민소법 §456 |
| DL_PAYMENT_ORDER | 지급명령 이의신청 | 14일 | 지급명령 **송달일** | 민소법 §470 |

## 기산 방식

### 사건유형별 기산일 기준

```
형사사건 (criminal)
├── 기산일: 판결 선고일 (법정에서 직접 선고)
├── 기간: 7일
└── 예시: 1월 11일(목) 선고 → 1월 18일(목)까지

민사/가사소송 (civil, family)
├── 기산일: 판결 송달일 (등기우편 또는 전자송달)
├── 기간: 14일
└── 예시: 1월 11일(목) 송달 → 1월 25일(목)까지

가사비송 (family non-litigious)
├── 기산일: 심판 고지일
├── 기간: 14일
└── 해당 부호: 르, 브, 스, 조, 즈기, 즈단, 즈합, 호 계열
```

### 초일불산입 적용 여부

**계산 공식:**
- 일반 송달: 기산일 + N일 = 만료일 (초일불산입 반영)
- 전자송달(0시 의제): 기산일 + (N-1)일 = 만료일 (초일산입)

| 상황 | 법적 원칙 | 시스템 설정 | 예시 (14일 기간) |
|------|----------|------------|-----------------|
| 일반 우편 송달 | 초일불산입 | `is_electronic_service = false` | 4/8 + 14 = 4/22 |
| 전자송달 (0시 의제) | 초일산입 | `is_electronic_service = true` | 4/8 + 13 = 4/21 |
| 형사 선고 | 초일불산입 | `is_electronic_service = false` | 4/8 + 7 = 4/15 |

### 0시 도달 자동 감지 (2026.01.14 추가)

SCOURT 나의사건검색에서 "0시 도달"로 표시되는 경우 자동으로 초일산입이 적용됩니다.

#### 대상 케이스
| 유형 | 설명 | SCOURT 표시 |
|------|------|------------|
| 전자송달 의제 | 미열람 7일 후 자정(0시) 도달 | `2025.04.08 0시 도달` |
| 공시송달 | 2주 후 자정(0시) 도달 | `2025.04.08 0시 도달` |

#### 법적 근거
- 민법 제157조 단서: "그 기간이 오전 영시로부터 시작하는 때에는 그러하지 아니하다"
- 초일산입 적용으로 기한이 1일 단축됨

#### 자동 감지 로직

```typescript
// lib/scourt/deadline-auto-register.ts
function isZeroHourService(result: string | undefined | null): boolean {
  if (!result) return false;
  return result.includes('0시 도달');
}
```

#### 계산 예시
```typescript
// 일반 송달: 4/8 + 14일 = 4/22 (초일불산입)
calculateLegalDeadline(new Date('2025-04-08'), 14, false)
// → 2025-04-22

// 0시 도달: 4/8 + 13일 = 4/21 (초일산입)
calculateLegalDeadline(new Date('2025-04-08'), 14, true)
// → 2025-04-21 (1일 단축)
```

> **SCOURT 주의문**: "송달결과는 '0시 도달'로 나타나는 경우에는 기간 계산 시 초일이 산입된다"

#### UI 동작
- SCOURT 자동등록 시: "0시 도달" 패턴 자동 감지, `is_electronic_service = true` 설정
- 수동 등록 시: "전자송달 (0시 의제)" 체크박스 선택

## 당사자별 기한 관리 (2026-01-14 추가)

### 개념

민사/가사 사건에서는 원고와 피고에게 판결문이 각각 다른 날짜에 송달될 수 있습니다. 따라서 상소기간도 당사자별로 다르게 관리해야 합니다.

```
예시: 2024드단12345 사건
├── 원고 김OO: 판결도달일 2026-01-10 → 항소기간 만료 2026-01-24
└── 피고 이OO: 판결도달일 2026-01-12 → 항소기간 만료 2026-01-26
```

### 스키마 변경

`case_deadlines` 테이블에 당사자 연결 컬럼 추가:

```sql
-- 당사자 직접 연결
party_id UUID REFERENCES case_parties(id) ON DELETE SET NULL

-- 당사자 측 구분
party_side VARCHAR(30) -- 'plaintiff_side' | 'defendant_side' | NULL
```

### 판결도달일 (adjdoc_rch_ymd)

SCOURT API에서 당사자별 판결도달일을 제공합니다:

| 필드명 | 테이블 | 설명 |
|--------|--------|------|
| `adjdoc_rch_ymd` | `case_parties` | 해당 당사자에게 판결문이 도달한 날짜 |

### 자동 기한 생성 흐름

```
SCOURT API (당사자별 adjdocRchYmd)
        ↓
party-sync.ts (adjdoc_rch_ymd 변경 감지)
        ↓
deadline-auto-register.ts (updatePartyDeadline)
        ↓
case_deadlines (party_id, party_side 연결)
        ↓
unified_calendar VIEW (캘린더 표시)
```

### 캘린더 표시 형식

| party_side | 표시 형식 |
|------------|----------|
| `plaintiff_side` | `[기한/원고] 항소기간 - 김OO v 이OO(이혼사건)` |
| `defendant_side` | `[기한/피고] 항소기간 - 김OO v 이OO(이혼사건)` |
| `NULL` (전체) | `[기한] 항소기간 - 김OO v 이OO(이혼사건)` |

### 기한 유형 라벨

| deadline_type | 라벨 | 설명 |
|---------------|------|------|
| `DL_APPEAL` | 항소기간 | 민사/가사소송 1심→2심 (14일) |
| `DL_FAMILY_NONLIT` | 항고기간 | 가사비송 즉시항고 (14일) |
| `DL_CRIMINAL_APPEAL` | 형사항소기간 | 형사 (7일) |
| `DL_IMM_APPEAL` | 즉시항고기간 | 민사 결정/명령 (7일) |
| `DL_APPEAL_BRIEF` | 항소이유서제출기한 | 민사 (40일) |
| `DL_MEDIATION_OBJ` | 조정이의기간 | 조정·화해 이의 (14일) |
| `DL_PAYMENT_ORDER` | 지급명령이의기간 | 지급명령 (14일) |

### UI 지원

**QuickAddDeadlineModal.tsx**:
- 사건 선택 후 당사자 목록 표시
- 당사자 선택 시 해당 당사자에게 기한 연결
- 선택하지 않으면 사건 전체에 적용

## 시스템 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                        UI Layer                              │
├─────────────────────────────────────────────────────────────┤
│  QuickAddDeadlineModal.tsx    CaseDetail.tsx                │
│  └── calculateLegalDeadline()  └── 기한 표시                │
│  └── 당사자 선택 UI                                         │
├─────────────────────────────────────────────────────────────┤
│                      Business Logic                          │
├─────────────────────────────────────────────────────────────┤
│  lib/scourt/deadline-auto-register.ts                       │
│  └── SCOURT 업데이트 감지 시 자동 기한 등록                 │
│  └── updatePartyDeadline() - 당사자별 기한 생성/수정        │
│  └── createPartySpecificDeadlines() - 사건 전체 당사자 처리 │
│                                                              │
│  lib/scourt/party-sync.ts                                   │
│  └── adjdoc_rch_ymd 변경 감지                               │
│  └── 변경 시 updatePartyDeadline() 호출                     │
│                                                              │
│  lib/utils/korean-legal-dates.ts                            │
│  └── calculateLegalDeadline() - 민법 제161조 적용           │
│  └── isNonBusinessDay() - 토/공휴일 판정                    │
│  └── getNextBusinessDay() - 익영업일 계산                   │
├─────────────────────────────────────────────────────────────┤
│                      Database Layer                          │
├─────────────────────────────────────────────────────────────┤
│  deadline_types (마스터)     case_deadlines (트랜잭션)       │
│  korean_public_holidays      └── party_id (당사자 연결)      │
│                              └── party_side (당사자 측)      │
│                              calculate_deadline_dates()     │
│                              └── DB 트리거 (자동 계산)       │
└─────────────────────────────────────────────────────────────┘
```

## 공휴일 데이터

### 저장 위치

1. **TypeScript**: `lib/utils/korean-legal-dates.ts`
   - `KOREAN_PUBLIC_HOLIDAYS_2025`
   - `KOREAN_PUBLIC_HOLIDAYS_2026`
   - `KOREAN_PUBLIC_HOLIDAYS_ALL` (통합)

2. **Database**: `korean_public_holidays` 테이블
   - 마이그레이션: `20251122_enhanced_deadline_calculation.sql` (2025년)
   - 마이그레이션: `20251201_add_2026_holidays.sql` (2026년)

### 연간 유지보수

매년 12월에 다음 해 공휴일 데이터 추가 필요:

1. TypeScript 배열 추가 (`KOREAN_PUBLIC_HOLIDAYS_YYYY`)
2. `KOREAN_PUBLIC_HOLIDAYS_ALL`에 포함
3. DB 마이그레이션 파일 생성

## 자동 기한 등록 (SCOURT 연동)

### 트리거 이벤트

| SCOURT 이벤트 | 생성되는 기한 | 조건 |
|--------------|--------------|------|
| `result_announced` | 상소기간 | 사건유형에 따라 자동 판별 |
| `hearing_result` | 조정 이의기간 | 결과에 "조정", "화해" 포함 시 |

### 사건유형 자동 판별

```typescript
// lib/scourt/deadline-auto-register.ts
getCaseCategoryFromNumber("2024고단1234") // → 'criminal' → DL_CRIMINAL_APPEAL (7일)
getCaseCategoryFromNumber("2024드단1234") // → 'family' → DL_APPEAL (14일)
getCaseCategoryFromNumber("2024르1234")   // → 가사비송 → DL_FAMILY_NONLIT (14일)
```

## 관리 화면

### SCOURT 자동등록 기한 관리

**경로**: `/admin/scourt/deadlines`

SCOURT 연동으로 자동등록된 불변기한을 조회하고 수정할 수 있는 관리자 전용 화면입니다.

**기능:**
- 자동등록 기한 목록 조회 (notes에 "[SCOURT 자동등록]" 포함)
- 상태별/유형별 필터링
- D-day 표시 (긴급도별 색상 구분)
- 기산일 수정 (trigger_date 변경 시 만료일 자동 재계산)
- 상태 변경 (PENDING ↔ COMPLETED)
- 기한 삭제

**테이블 컬럼:**
| 컬럼 | 설명 |
|------|------|
| 사건번호 | case_number |
| 기한 유형 | deadline_type 한글명 |
| 기산일 | trigger_date (수정 가능) |
| 만료일 | deadline_date (자동 계산) |
| D-day | 남은 일수 (색상으로 긴급도 표시) |
| 상태 | PENDING/COMPLETED (수정 가능) |
| 0시도달 | is_electronic_service 여부 |

## API 엔드포인트

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/admin/case-deadlines` | 기한 목록 조회 |
| GET | `/api/admin/case-deadlines?auto_registered=true` | 자동등록 기한만 조회 |
| POST | `/api/admin/case-deadlines` | 기한 생성 |
| PATCH | `/api/admin/case-deadlines/[id]` | 기한 수정 |
| DELETE | `/api/admin/case-deadlines/[id]` | 기한 삭제 |
| POST | `/api/admin/case-deadlines/[id]/complete` | 기한 완료 처리 |
| GET | `/api/admin/deadline-types` | 기한 유형 목록 |

## 알림 시스템

### Cron Job

- **파일**: `app/api/cron/deadline-reminders/route.ts`
- **스케줄**: 매일 오전 9시
- **알림 대상**: D-7, D-3, D-1, D-day

## 자동 기한 등록 - 기산일 추출 로직

### 판결문 송달일 처리 (2025.01.14 개선)

SCOURT 연동 시 사건유형에 따라 기산일이 자동 결정됩니다:

```
형사 사건 (criminal)
├── 기산일: 선고일/결정일
├── 필드: details 내 YYYY.MM.DD 형식 날짜
└── 판결도달일 무시 (형사는 선고일 기준)

민사/가사/행정 사건
├── 기산일 우선순위:
│   1. 판결도달일 (jdgArvDt, 판결도달일, adjdocRchYmd)
│   2. 결정송달일 (dcsnstDlvrYmd, 결정송달일)
│   3. 선고일 (fallback - 송달일 없을 시)
└── 로그로 어떤 날짜를 사용했는지 기록
```

### 관련 SCOURT 필드

| 필드명 | 한글명 | 설명 |
|--------|--------|------|
| `adjdocRchYmd` | 판결도달일 | 판결문이 당사자에게 도달한 날 |
| `jdgArvDt` | 판결도달일 | 동일 (API 버전에 따라 다름) |
| `dcsnstDlvrYmd` | 결정송달일 | 결정문 송달일 |

### 주의사항

- 판결도달일이 SCOURT에 없는 경우 선고일이 사용되며, 이 경우 로그에 경고 메시지가 출력됩니다
- 실무에서는 직접 판결문 송달일을 확인하여 수정하는 것이 안전합니다

## 테스트

### Vitest 테스트

```bash
# 테스트 실행
npm run test:run

# 감시 모드
npm run test

# UI 모드
npm run test:ui
```

### 테스트 파일

`lib/utils/__tests__/korean-legal-dates.test.ts`:
- 기본 날짜 함수 테스트 (isSaturday, isSunday, isPublicHoliday)
- 민사 항소기간 (14일) 테스트
- 형사 항소기간 (7일) 테스트
- 전자송달 (0시 의제) 테스트
- 공휴일 연휴 케이스 테스트

`lib/scourt/__tests__/deadline-auto-register.test.ts`:
- isZeroHourService: 0시 도달 패턴 감지 테스트
- getCaseCategoryFromNumber: 사건 유형 판별 테스트
- getCaseTypeInfo: 사건 유형 정보 조회 테스트

## 유틸리티 스크립트

### 데드라인 조회/관리 스크립트

| 스크립트 | 설명 | 사용법 |
|---------|------|-------|
| `check-specific-case-deadline.ts` | 특정 사건의 데드라인 조회 | `npx tsx scripts/check-specific-case-deadline.ts` |
| `cleanup-incorrect-appeal-deadlines.ts` | 잘못 등록된 상소기간 정리 | `npx tsx scripts/cleanup-incorrect-appeal-deadlines.ts [--delete]` |
| `delete-backfill-deadlines.ts` | 백필로 생성된 데드라인 삭제 | `npx tsx scripts/delete-backfill-deadlines.ts [--delete]` |
| `find-incorrect-appeal-deadlines.sql` | 잘못된 데드라인 조회 SQL | Supabase SQL Editor에서 실행 |

### 잘못된 상소기간 데드라인 정리

SCOURT 자동등록 시 "선고기일 지정" 같은 진행내용이 "result_announced"로 잘못 분류되어 상소기간이 미리 등록되는 경우가 있습니다.

```bash
# 조회만 (안전)
npx tsx scripts/cleanup-incorrect-appeal-deadlines.ts

# 삭제 실행 (위험 - 확인 후 실행)
npx tsx scripts/cleanup-incorrect-appeal-deadlines.ts --delete
```

**의심 케이스 조건:**
- SCOURT 자동등록된 상소기간
- 해당 사건의 `종국결과`가 NULL (아직 판결 전 상태)

---

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-01-16 | 유틸리티 스크립트 문서화 (cleanup, backfill 스크립트) |
| 2026-01-14 | 당사자별 불변기한 관리 기능 추가 (party_id, party_side 컬럼) |
| 2026-01-14 | 판결도달일(adjdoc_rch_ymd) 변경 감지 및 기한 자동 생성 |
| 2026-01-14 | 캘린더 표시 형식 개선: [기한/원고], [기한/피고] 형식 |
| 2026-01-14 | 기한 유형 라벨 정확화: 상소기간→항소기간, 가사비송즉시항고→항고기간 |
| 2026-01-14 | QuickAddDeadlineModal에 당사자 선택 UI 추가 |
| 2026-01-14 | SCOURT 자동등록 기한 관리 페이지 추가 (/admin/scourt/deadlines) |
| 2026-01-14 | auto_registered 필터 파라미터 추가 (자동등록 기한 조회) |
| 2026-01-14 | 조정·화해 이의 기산일 수정 (성립일 → 결정서 송달일) |
| 2026-01-14 | 형사 항소이유서/상고이유서 제출기한 유형 추가 (DL_CRIMINAL_APPEAL_BRIEF, DL_CRIMINAL_FINAL_BRIEF) |
| 2026-01-14 | SCOURT "0시 도달" 패턴 자동 감지 - 전자송달 의제/공시송달 자동 처리 |
| 2026-01-15 | 전자송달(0시 의제) 지원 추가 - DB 스키마, UI, 계산 로직 |
| 2026-01-15 | Vitest 테스트 프레임워크 도입 및 테스트 케이스 작성 |
| 2026-01-15 | 타임존 문제 수정 - toLocalDateString 함수 추가 |
| 2026-01-15 | 코드 주석 및 문서화 개선 |
| 2025-01-14 | 민사/가사 기한 자동등록 시 판결도달일(송달일) 우선 사용 |
| 2025-01-14 | `served`/`document_served` 업데이트 유형 처리 추가 |
| 2025-01-14 | UI 미리보기에 민법 제161조 반영 |
| 2025-01-14 | 2026년 공휴일 데이터 추가 (대체공휴일 포함) |
| 2024-12-31 | 형사/가사비송/지급명령 기한 유형 추가 |
| 2024-11-22 | 향상된 법정기간 계산 시스템 도입 |
