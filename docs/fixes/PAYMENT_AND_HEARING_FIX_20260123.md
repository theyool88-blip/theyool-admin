# 결제 PATCH 로직 및 HearingResult 타입 정합성 수정

**작성일**: 2026-01-23
**커밋**: `fix: 결제 PATCH 로직 및 HearingResult 타입 정합성 수정`

---

## 1. 결제 PATCH API 수정

### 문제점

#### 1.1 확인 상태 초기화 문제 (HIGH)

**위치**: `app/api/admin/payments/[id]/route.ts`

**기존 코드 문제**:
```typescript
const shouldConfirm = !!(body.case_id || body.consultation_id || body.is_confirmed)
```

**문제 시나리오**:
- 사용자가 금액만 수정: `PATCH { amount: 5000 }`
- `shouldConfirm = false` → 기존 확인 상태가 초기화됨

#### 1.2 case_id 변경 시 이전 사건 합계 누락 (HIGH)

**기존 코드 문제**:
```typescript
if (data.case_id) {
  // 새 case_id의 total_received만 재계산
  // 이전 case_id는 무시됨
}
```

**문제 시나리오**:
- 결제 10,000원이 case1에 연결 (case1.total_received = 10,000)
- case_id를 case2로 변경
- case2.total_received = 10,000 (정상)
- case1.total_received = 10,000 (오류! 0이어야 함)

### 수정 내용

#### 1.1 기존 결제 데이터 조회 추가
```typescript
// 기존 결제 데이터 조회 (부분 수정 시 기존 상태 유지를 위해)
const { data: existingPayment, error: existingError } = await supabase
  .from('payments')
  .select('case_id, is_confirmed, confirmed_at, confirmed_by')
  .eq('id', id)
  .single()

if (existingError || !existingPayment) {
  return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
}

const previousCaseId = existingPayment.case_id
```

#### 1.2 shouldConfirm 로직 개선
```typescript
// 기존 확인 상태 유지하면서, 명시적으로 case_id/consultation_id/is_confirmed를 보낸 경우만 확인 처리
const shouldConfirm = body.is_confirmed === true
  || (body.is_confirmed !== false && existingPayment.is_confirmed)
  || !!(body.case_id || body.consultation_id)
```

#### 1.3 확인 필드 업데이트 로직 개선
```typescript
is_confirmed: shouldConfirm,
confirmed_at: shouldConfirm
  ? (existingPayment.confirmed_at || new Date().toISOString())
  : null,
confirmed_by: shouldConfirm
  ? (existingPayment.confirmed_by || user?.email || user?.id || 'admin')
  : null,
```

#### 1.4 이전/새 case_id 모두 재계산
```typescript
// Update case total_received - 이전 case_id와 새 case_id 모두 처리
const caseIdsToUpdate = new Set<string>()
if (previousCaseId) caseIdsToUpdate.add(previousCaseId)
if (data.case_id) caseIdsToUpdate.add(data.case_id)

for (const caseId of caseIdsToUpdate) {
  const { data: sums, error: sumError } = await supabase
    .from('payments')
    .select('amount')
    .eq('case_id', caseId)

  if (!sumError && sums) {
    const total = sums.reduce((sum, p) => sum + p.amount, 0)
    await supabase
      .from('legal_cases')
      .update({ total_received: total })
      .eq('id', caseId)
  }
}
```

---

## 2. ClientPaymentsModal 에러 처리

### 문제점 (MEDIUM)

**위치**: `components/ClientPaymentsModal.tsx`

**기존 코드 문제**:
```typescript
const { data: cases } = await supabase  // error를 캡처하지 않음
```

### 수정 내용
```typescript
const { data: cases, error: casesErr } = await supabase
  .from('legal_cases')
  .select('id, case_name')
  .eq('client_id', clientId)

if (casesErr) {
  console.error('Failed to fetch client cases:', casesErr)
  // 첫 번째 조회 결과만으로 진행
}
```

---

## 3. HearingResult 타입 정합성 수정

### 문제점

TypeScript 타입과 데이터베이스 스키마 불일치:

| 구분 | 기존 TypeScript | 데이터베이스 |
|-----|----------------|-------------|
| 속행 | `CONTINUED` | `continued` |
| 종결 | `CONCLUDED` | `settled` |
| 연기 | `POSTPONED` | `adjourned` |
| 각하 | `DISMISSED` | `dismissed` |
| 판결 | - | `judgment` |
| 취하 | - | `withdrawn` |
| 기타 | - | `other` |

### 수정된 타입 정의

```typescript
// types/court-hearing.ts
export const HEARING_RESULT = {
  continued: 'continued',      // 속행
  settled: 'settled',          // 화해/조정 성립 (종결 포함)
  judgment: 'judgment',        // 판결 선고
  dismissed: 'dismissed',      // 각하/기각
  withdrawn: 'withdrawn',      // 취하
  adjourned: 'adjourned',      // 휴정/연기
  other: 'other',              // 기타
} as const;

export type HearingResult = keyof typeof HEARING_RESULT;

export const HEARING_RESULT_LABELS: Record<HearingResult, string> = {
  continued: '속행',
  settled: '종결/화해',
  judgment: '판결선고',
  dismissed: '각하/기각',
  withdrawn: '취하',
  adjourned: '휴정/연기',
  other: '기타',
};
```

### 수정된 파일 목록

| 파일 | 수정 내용 |
|-----|----------|
| `types/court-hearing.ts` | HearingResult 타입 정의 |
| `lib/scourt/hearing-sync.ts` | 이미 소문자 사용 (수정 불필요) |
| `components/HearingDetailModal.tsx` | result 비교 로직 |
| `components/UnifiedScheduleModal.tsx` | result 타입 및 옵션 |
| `app/admin/client-preview/[clientId]/page.tsx` | result 라벨 매핑 |
| `app/admin/client-preview/[clientId]/cases/[caseId]/page.tsx` | result 라벨 매핑 |
| `scripts/backfill-court-hearings.ts` | 마이그레이션 스크립트 |
| `scripts/backfill-deadlines.ts` | DB 쿼리 수정 |

---

## 4. 테스트 방법

### 4.1 결제 PATCH 확인 상태 유지 테스트
```bash
# 1. 확인된 결제 조회
curl GET /api/admin/payments/{id}
# → is_confirmed: true, confirmed_at: "2024-01-01T..."

# 2. 금액만 수정
curl PATCH /api/admin/payments/{id} -d '{"amount": 5000}'
# → is_confirmed: true 유지되어야 함

# 3. 명시적 취소
curl PATCH /api/admin/payments/{id} -d '{"is_confirmed": false}'
# → is_confirmed: false로 변경되어야 함
```

### 4.2 case_id 변경 시 합계 테스트
```bash
# 1. case1에 결제 10,000원 연결
# 2. case1.total_received 확인 → 10,000
# 3. 결제를 case2로 이동
curl PATCH /api/admin/payments/{id} -d '{"case_id": "case2-id"}'
# 4. 검증:
#    - case1.total_received = 0
#    - case2.total_received = 10,000
```

### 4.3 TypeScript 타입 체크
```bash
npx tsc --noEmit
# 에러 없어야 함
```

---

## 5. 주의사항

### HearingResult vs HearingStatus

| 타입 | 용도 | 값 형식 |
|-----|-----|--------|
| `HearingResult` | 기일 결과 (속행/종결/판결 등) | **소문자** |
| `HearingStatus` | 기일 상태 (예정/완료/연기/취소) | **대문자** |

```typescript
// HearingResult - 소문자
const result: HearingResult = 'continued' | 'settled' | 'judgment' | ...

// HearingStatus - 대문자
const status: HearingStatus = 'SCHEDULED' | 'COMPLETED' | 'POSTPONED' | 'CANCELLED'
```

이 구분은 데이터베이스 enum 정의를 그대로 따른 것입니다.
