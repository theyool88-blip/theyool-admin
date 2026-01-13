# 데이터 흐름 일관성 시스템

**Last Updated**: 2026-01-13

사건 등록 시 데이터 일관성을 보장하는 시스템입니다.

---

## 개요

### 주요 원칙

| 원칙 | 설명 |
|------|------|
| **사건번호 정제** | `stripCourtPrefix`로 법원명 접두사 제거 |
| **법원명 정규화** | `getCourtFullName`으로 표준 법원명 변환 |
| **당사자 정보** | `case_parties` 테이블에서 통합 관리 |
| **중복 검사** | 정제된 사건번호 + 정규화된 법원명으로 검사 |

---

## 사건번호 정제

### stripCourtPrefix

법원명 접두사를 제거하여 순수 사건번호만 추출합니다.

```typescript
import { stripCourtPrefix } from '@/lib/scourt/case-number-utils'

// 예시
stripCourtPrefix("평택지원2023타경864")  // → "2023타경864"
stripCourtPrefix("수원가정2024드단12345")  // → "2024드단12345"
stripCourtPrefix("2023가합12345")  // → "2023가합12345" (변경 없음)
```

### 적용 위치

| 등록 경로 | 파일 | 적용 |
|----------|------|------|
| 배치 임포트 | `lib/onboarding/batch-case-creator.ts` | ✅ |
| 스트림 임포트 | `app/api/admin/onboarding/batch-create-stream/route.ts` | ✅ |
| 수동 등록 | `app/api/admin/cases/route.ts` | ✅ |

---

## 법원명 정규화

### getCourtFullName

축약형 법원명을 표준 법원명으로 변환합니다.

```typescript
import { getCourtFullName } from '@/lib/scourt/court-codes'

// 예시
getCourtFullName("평택", "드단")  // → "수원가정법원 평택지원"
getCourtFullName("수원가정", "드단")  // → "수원가정법원"
getCourtFullName("서울가정법원")  // → "서울가정법원" (변경 없음)
```

### 적용 위치

| 등록 경로 | 파일 | 적용 |
|----------|------|------|
| 배치 임포트 | `lib/onboarding/batch-case-creator.ts` | ✅ |
| 스트림 임포트 | `app/api/admin/onboarding/batch-create-stream/route.ts` | ✅ |
| 수동 등록 | `app/api/admin/cases/route.ts` | ✅ |

---

## 중복 검사

### 검사 로직

```typescript
// 정제된 사건번호 + 정규화된 법원명으로 검색
const { data: existingCase } = await adminClient
  .from('legal_cases')
  .select('id, case_name')
  .eq('tenant_id', tenant.tenantId)
  .eq('court_case_number', cleanedCaseNumber)
  .eq('court_name', normalizedCourtName)
  .maybeSingle()

if (existingCase) {
  return NextResponse.json({
    error: '이미 등록된 사건입니다',
    existingCase: { id: existingCase.id, name: existingCase.case_name }
  }, { status: 409 })
}
```

### 중복 처리 옵션

| 옵션 | 동작 |
|------|------|
| `skip` | 건너뛰기 (기본값) |
| `error` | 오류 반환 |
| `update` | 기존 사건 업데이트 |

---

## 당사자 정보 (case_parties)

### 저장 원칙

- `legal_cases.opponent_name`은 **항상 null**
- 모든 당사자 정보는 `case_parties` 테이블에서 관리
- `buildManualPartySeeds` 함수로 초기 당사자 생성

### buildManualPartySeeds

```typescript
import { buildManualPartySeeds } from '@/lib/case/party-seeds'

const partySeeds = buildManualPartySeeds({
  clientName: '홍길동',
  opponentName: '김철수',
  clientRole: 'plaintiff',
  caseNumber: '2024드단12345',
  clientId: 'uuid...',
})

// 결과: 원고(홍길동), 피고(김철수) 레코드 생성
```

### 적용 위치

| 등록 경로 | 파일 | 적용 |
|----------|------|------|
| 배치 임포트 | `lib/onboarding/batch-case-creator.ts` | ✅ |
| 스트림 임포트 | `app/api/admin/onboarding/batch-create-stream/route.ts` | ✅ |
| 수동 등록 | `app/api/admin/cases/route.ts` | ✅ |

---

## 데이터 흐름도

```
┌─────────────────┐
│   입력 데이터    │
│ (Excel/수동)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ stripCourtPrefix │  ← 사건번호 정제
│ "평택지원2023..."│
│    → "2023..."  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ getCourtFullName │  ← 법원명 정규화
│   "평택"        │
│    → "수원가정   │
│      법원 평택지원"│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   중복 검사     │
│ (court_case_number │
│  + court_name)  │
└────────┬────────┘
         │
    ┌────┴────┐
    │ 중복?   │
    └────┬────┘
    Yes  │  No
    ↓    │
┌───────┐│
│ 409   ││
│ 반환  ││
└───────┘│
         ▼
┌─────────────────┐
│  legal_cases    │
│    INSERT       │
│ (opponent_name  │
│   = null)       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  case_parties   │
│    INSERT       │
│ (buildManual    │
│  PartySeeds)    │
└─────────────────┘
```

---

## 의뢰인 포털 스키마

### court_hearings 컬럼

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `hearing_date` | TIMESTAMPTZ | 기일 일시 (시간 포함) |
| `location` | TEXT | 법정 위치 |
| `result` | TEXT | 기일 결과 |
| `report` | TEXT | 기일 보고서 |
| `judge_name` | TEXT | 담당 판사 |

**주의**: `hearing_time`, `court_name`, `hearing_result`, `hearing_report` 컬럼은 존재하지 않음

### case_deadlines 컬럼

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `notes` | TEXT | 메모 |
| `status` | ENUM | 상태 (PENDING/COMPLETED/OVERDUE) |

**주의**: `description`, `is_completed` 컬럼은 존재하지 않음

---

## 관련 파일

| 파일 | 역할 |
|------|------|
| `lib/scourt/case-number-utils.ts` | 사건번호 유틸리티 |
| `lib/scourt/court-codes.ts` | 법원 코드 매핑 |
| `lib/case/party-seeds.ts` | 당사자 초기화 |
| `lib/case/client-role-utils.ts` | 의뢰인 역할 유틸리티 |
| `app/api/admin/cases/route.ts` | 수동 등록 API |
| `app/api/admin/onboarding/batch-create-stream/route.ts` | 스트림 임포트 |
| `lib/onboarding/batch-case-creator.ts` | 배치 임포트 로직 |
| `app/api/client/cases/[id]/route.ts` | 의뢰인 포털 사건 상세 |
| `app/api/client/dashboard/route.ts` | 의뢰인 포털 대시보드 |

---

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-01-13 | 데이터 흐름 일관성 시스템 구축 |
| | - 스트림 임포트 사건번호 정제/법원명 정규화 추가 |
| | - 수동 등록 API 사건번호 정제/중복 검사 추가 |
| | - 배치 임포트 case_parties 생성 추가 |
| | - 의뢰인 포털 API 컬럼명 수정 |
