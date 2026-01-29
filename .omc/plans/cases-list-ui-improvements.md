# 사건 목록 페이지 UI 개선 계획

## 개요

**요청자:** 사용자
**작성일:** 2026-01-29
**대상 파일:**
- `/Users/hskim/luseed/components/CasesList.tsx` (주요 변경)
- `/Users/hskim/luseed/lib/excel-export.ts` (신규 함수 추가)

---

## 수정사항 목록

### 1. 담당변호사 이름만 표시 (별표, +숫자 제거)

**현재 상태 (lines 653-679):**
```typescript
function AssigneeCell({ assignees, assignedMember }: AssigneeCellProps) {
  // ...
  if (lawyers.length > 0) {
    return (
      <div className="flex items-center gap-1 flex-wrap justify-center">
        {primary && (
          <span
            className="inline-flex items-center px-2 py-0.5 text-caption font-medium rounded bg-[var(--sage-muted)] text-[var(--sage-primary)]"
            title={`주담당: ${primary.displayName}`}
          >
            {primary.displayName} ★
          </span>
        )}
        {others.length > 0 && (
          <span
            className="inline-flex px-1.5 py-0.5 text-caption font-medium rounded bg-[var(--bg-tertiary)] text-[var(--text-secondary)] cursor-help"
            title={others.map(a => a.displayName).join(', ')}
          >
            +{others.length}
          </span>
        )}
      </div>
    )
  }
  // ...
}
```

**변경 후:**
```typescript
function AssigneeCell({ assignees, assignedMember }: AssigneeCellProps) {
  const LAWYER_ROLES = ['lawyer', 'owner', 'admin']
  const lawyers = assignees?.filter(a => LAWYER_ROLES.includes(a.role)) || []
  const primary = lawyers.find(a => a.isPrimary)
  const others = lawyers.filter(a => !a.isPrimary)

  if (lawyers.length > 0) {
    // 모든 변호사 이름을 콤마로 연결 (주담당 우선)
    const allNames = primary
      ? [primary.displayName, ...others.map(a => a.displayName)]
      : others.map(a => a.displayName)

    return (
      <span className="text-body text-sm">
        {allNames.join(', ')}
      </span>
    )
  }

  // Legacy fallback
  if (assignedMember?.display_name) {
    return (
      <span className="text-body text-sm">
        {assignedMember.display_name}
      </span>
    )
  }

  return <span className="text-[var(--text-muted)]">-</span>
}
```

**변경 요점:**
- 별표(★) 제거
- +숫자 배지 제거
- 모든 담당 변호사 이름을 콤마로 연결하여 표시
- 배지 스타일 제거, 일반 텍스트로 변경

---

### 2. 다음기일에 기일 종류도 함께 표시

**현재 상태 (lines 364-379):**
```typescript
{
  key: 'next_hearing',
  header: '다음기일',
  width: '100px',
  render: (item) => {
    if (!item.next_hearing) return <span className="text-[var(--text-muted)]">-</span>
    const date = new Date(item.next_hearing.date)
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return (
      <span className="text-body text-sm" title={item.next_hearing.type}>
        {month}/{day}
      </span>
    )
  },
},
```

**변경 후:**
```typescript
{
  key: 'next_hearing',
  header: '다음기일',
  width: '130px',  // 너비 증가
  render: (item) => {
    if (!item.next_hearing) return <span className="text-[var(--text-muted)]">-</span>
    const date = new Date(item.next_hearing.date)
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return (
      <div className="text-body text-sm">
        <span>{month}/{day}</span>
        <span className="text-[var(--text-muted)] ml-1">({item.next_hearing.type})</span>
      </div>
    )
  },
},
```

**변경 요점:**
- 날짜 옆에 기일 유형을 괄호로 표시
- 컬럼 너비 100px → 130px 증가
- title 속성 대신 실제 텍스트로 표시

---

### 3. 컬럼 순서 변경 + 계약번호 추가 (통합)

**현재 순서:** 계약일 → 사건번호 → 법원 → 심급 → 사건명 → 당사자 → 담당변호사 → 상태 → 다음기일

**최종 순서 (요청사항 3, 5 통합):** 상태 → 계약번호(신규) → 계약일 → 법원 → 사건번호 → 심급 → 사건명 → 당사자 → 다음기일 → 담당변호사 → 미수금(신규)

**COLUMN_DEFINITIONS 변경 (lines 79-89):**
```typescript
// 현재
const COLUMN_DEFINITIONS = [
  { id: 'contract_date', label: '계약일' },
  { id: 'court_case_number', label: '사건번호' },
  { id: 'court_name', label: '법원' },
  { id: 'case_level', label: '심급' },
  { id: 'case_name', label: '사건명' },
  { id: 'parties', label: '당사자' },
  { id: 'assignee', label: '담당변호사' },
  { id: 'status', label: '상태' },
  { id: 'next_hearing', label: '다음기일' },
]

// 변경 후 (계약번호, 미수금 포함)
const COLUMN_DEFINITIONS = [
  { id: 'status', label: '상태' },
  { id: 'contract_number', label: '계약번호' },  // 신규 추가
  { id: 'contract_date', label: '계약일' },
  { id: 'court_name', label: '법원' },
  { id: 'court_case_number', label: '사건번호' },
  { id: 'case_level', label: '심급' },
  { id: 'case_name', label: '사건명' },
  { id: 'parties', label: '당사자' },
  { id: 'next_hearing', label: '다음기일' },
  { id: 'assignee', label: '담당변호사' },
  { id: 'outstanding_amount', label: '미수금' },  // 신규 추가
]
```

**DEFAULT_VISIBLE_COLUMNS 변경 (lines 91-94):**
```typescript
// 현재
const DEFAULT_VISIBLE_COLUMNS = [
  'contract_date', 'court_case_number', 'court_name',
  'case_level', 'case_name', 'parties', 'assignee', 'status', 'next_hearing'
]

// 변경 후 (계약번호, 미수금 포함)
const DEFAULT_VISIBLE_COLUMNS = [
  'status', 'contract_number', 'contract_date', 'court_name', 'court_case_number',
  'case_level', 'case_name', 'parties', 'next_hearing', 'assignee', 'outstanding_amount'
]
```

**columns 배열 순서 변경 (lines 285-380):**
columns 배열의 객체 순서를 아래 순서로 재배치:
1. status
2. contract_number (신규)
3. contract_date
4. court_name
5. court_case_number
6. case_level
7. case_name
8. parties
9. next_hearing
10. assignee
11. outstanding_amount (신규)

**계약번호 컬럼 추가:**
```typescript
{
  key: 'contract_number',
  header: '계약번호',
  width: '100px',
  render: (item) => (
    <span className="text-body font-mono text-sm">
      {item.contract_number || '-'}
    </span>
  ),
},
```

**미수금 컬럼 추가:**
```typescript
{
  key: 'outstanding_amount',
  header: '미수금',
  width: '100px',
  align: 'right' as const,
  render: (item) => {
    // TODO: 미수금 계산 로직 필요 (total_fee - paid_amount)
    // 현재 데이터에 미수금 필드가 없으므로 서버에서 계산 필요
    return <span className="text-[var(--text-muted)]">-</span>
  },
},
```

**주의:** 미수금 데이터는 현재 `page.tsx`에서 조회하지 않음. 서버 측에서 계산하여 전달하거나 클라이언트에서 추가 API 호출 필요.

---

### 4. 엑셀로 내보내기 기능 추가

#### 4.1 lib/excel-export.ts에 함수 추가

**NOTE:** CasesList.tsx의 LegalCase 인터페이스에 `export` 키워드 추가 필요 (line 38)

```typescript
// CasesList.tsx line 38 수정:
export interface LegalCase {

// excel-export.ts에서 import:
import type { LegalCase } from '@/components/CasesList'

/**
 * 사건 목록을 Excel로 다운로드
 */
export function exportCasesToExcel(cases: LegalCase[], filename: string = 'cases.xlsx') {
  const data = cases.map(c => ({
    '상태': c.status,
    '계약일': c.contract_date || '-',
    '계약번호': c.contract_number || '-',
    '법원': c.court_name || '-',
    '사건번호': c.court_case_number || '-',
    '심급': c.case_level || '-',
    '사건명': c.case_name,
    '의뢰인': c.parties?.ourClient || c.client?.name || '-',
    '상대방': c.parties?.opponent || '-',
    '다음기일': c.next_hearing ? `${c.next_hearing.date} (${c.next_hearing.type})` : '-',
    '담당변호사': c.assignees?.filter(a => ['lawyer', 'owner', 'admin'].includes(a.role))
      .map(a => a.displayName).join(', ') || c.assigned_member?.display_name || '-',
  }))

  const worksheet = XLSX.utils.json_to_sheet(data)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, '사건목록')

  worksheet['!cols'] = [
    { wch: 8 },   // 상태
    { wch: 12 },  // 계약일
    { wch: 12 },  // 계약번호
    { wch: 15 },  // 법원
    { wch: 18 },  // 사건번호
    { wch: 10 },  // 심급
    { wch: 30 },  // 사건명
    { wch: 15 },  // 의뢰인
    { wch: 15 },  // 상대방
    { wch: 20 },  // 다음기일
    { wch: 15 },  // 담당변호사
  ]

  XLSX.writeFile(workbook, filename)
}
```

#### 4.2 CasesList.tsx에 내보내기 버튼 추가

**import 추가 (line 1 이후):**
```typescript
import { Download } from 'lucide-react'
import { exportCasesToExcel } from '@/lib/excel-export'
```

**핸들러 함수 추가 (handleSort 근처):**
```typescript
const handleExportExcel = () => {
  const filename = `cases-${new Date().toISOString().slice(0, 10)}.xlsx`
  exportCasesToExcel(processedCases, filename)
}
```

**버튼 추가 (사건 추가 버튼 옆, line 392-398 근처):**
```typescript
<div className="flex gap-2">
  <button
    onClick={handleExportExcel}
    className="btn btn-secondary"
    title="엑셀로 내보내기"
  >
    <Download className="w-4 h-4" />
    내보내기
  </button>
  <button
    onClick={() => router.push('/cases/new')}
    className="btn btn-primary"
  >
    <Plus className="w-4 h-4" />
    사건 추가
  </button>
</div>
```

---

### 5. LegalCase 인터페이스 export 추가

**CasesList.tsx line 38 수정:**
```typescript
// 변경 전
interface LegalCase {

// 변경 후
export interface LegalCase {
```

이 수정은 excel-export.ts에서 타입을 import하기 위해 필요합니다.

---

## 최종 컬럼 순서

| 순번 | 컬럼 ID | 컬럼명 | 너비 | 비고 |
|------|---------|--------|------|------|
| 1 | status | 상태 | 80px | - |
| 2 | contract_number | 계약번호 | 100px | 신규 추가 |
| 3 | contract_date | 계약일 | 100px | - |
| 4 | court_name | 법원 | 90px | - |
| 5 | court_case_number | 사건번호 | 140px | - |
| 6 | case_level | 심급 | 70px | - |
| 7 | case_name | 사건명 | auto | - |
| 8 | parties | 당사자 | 180px | - |
| 9 | next_hearing | 다음기일 | 130px | 기일유형 추가 |
| 10 | assignee | 담당변호사 | 140px | 이름만 표시 |
| 11 | outstanding_amount | 미수금 | 100px | 신규 추가 (데이터 확인 필요) |

---

## 검증 방법

1. **담당변호사 표시 확인:**
   - 별표(★) 없이 이름만 표시되는지 확인
   - 복수 담당자가 콤마로 구분되는지 확인

2. **다음기일 표시 확인:**
   - 날짜와 기일유형이 함께 표시되는지 확인 (예: `01/15 (변론)`)

3. **컬럼 순서 확인:**
   - 상태가 첫 번째 컬럼인지 확인
   - 계약번호 컬럼이 상태 다음에 표시되는지 확인

4. **엑셀 내보내기 확인:**
   - 내보내기 버튼 클릭 시 xlsx 파일 다운로드
   - 파일 열어서 모든 컬럼 데이터 확인

5. **컬럼 선택기 확인:**
   - 컬럼 설정 드롭다운에 새 컬럼들이 표시되는지 확인

---

## 위험 요소

| 위험 | 영향도 | 완화 방안 |
|------|--------|-----------|
| localStorage에 저장된 visibleColumns 호환성 | 중 | 새 컬럼 ID가 없으면 기본값 사용하도록 처리 |
| 미수금 데이터 없음 | 중 | 서버 측 쿼리 수정 또는 별도 API 필요 |
| xlsx 라이브러리 의존성 | 저 | 이미 설치되어 있음 |

---

## TODO 체크리스트

- [ ] AssigneeCell 컴포넌트 수정 (별표, +숫자 제거)
- [ ] next_hearing 컬럼 렌더러 수정 (기일유형 추가)
- [ ] COLUMN_DEFINITIONS 순서 변경 및 신규 컬럼 추가
- [ ] DEFAULT_VISIBLE_COLUMNS 업데이트
- [ ] columns 배열 순서 재배치 및 신규 컬럼 추가
- [ ] lib/excel-export.ts에 exportCasesToExcel 함수 추가
- [ ] CasesList.tsx에 내보내기 버튼 추가
- [ ] 타입 정의 업데이트 (필요시)
- [ ] 미수금 데이터 조회 로직 추가 (후속 작업)

---

## 예상 작업 시간

- 총 예상 시간: 1-2시간
- 복잡도: 중간

---

## 커밋 전략

```
feat: 사건 목록 페이지 UI 개선

- 담당변호사 이름만 표시 (별표, +숫자 제거)
- 다음기일에 기일 종류 함께 표시
- 컬럼 순서 변경 (상태→계약번호→계약일→법원→...)
- 엑셀 내보내기 기능 추가
- 계약번호 컬럼 추가
```
