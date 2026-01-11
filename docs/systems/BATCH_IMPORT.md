# 배치 임포트 시스템

## 개요

CSV/Excel 파일을 통해 다수의 사건을 일괄 등록하는 시스템입니다. 대법원 나의사건검색과 자동 연동되며, SSE(Server-Sent Events)를 통해 실시간 진행 상황을 표시합니다.

## 주요 기능

### 1. 파일 업로드 및 파싱
- 지원 형식: CSV, Excel (.xlsx, .xls)
- 자동 컬럼 매핑: 파일의 컬럼명을 시스템 필드에 자동 매핑
- 미리보기: 업로드된 데이터를 등록 전 확인

### 2. 대법원 나의사건 자동 연동
- 사건번호와 당사자명으로 대법원에서 사건 검색
- 연동 성공 시: 사건 상세정보, 기일, 진행내용 자동 동기화
- 연동 실패 시: 사건은 등록되고, 나중에 수동 연동 가능

### 3. 실시간 진행 표시
- SSE 스트리밍으로 실시간 진행 상황 표시
- 경과 시간 및 예상 남은 시간 표시
- 실패한 건만 상태 표시 (성공은 표시 안 함)

## 파일 구조

```
app/
├── admin/onboarding/import/
│   └── page.tsx              # 배치 임포트 UI
└── api/admin/onboarding/
    ├── preview/route.ts       # 파일 파싱 및 미리보기
    ├── batch-create/route.ts  # 일괄 생성 (비스트리밍)
    └── batch-create-stream/route.ts  # 일괄 생성 (SSE 스트리밍)

lib/onboarding/
├── csv-schema.ts             # CSV 스키마 정의
├── file-parser.ts            # 파일 파싱 로직
├── batch-case-creator.ts     # 사건 생성 로직
├── import-report-generator.ts # 결과 보고서 생성
└── template-generator.ts     # 템플릿 다운로드

types/
└── onboarding.ts             # 타입 정의
```

## 필수 컬럼

| 컬럼명 | 설명 | 필수 |
|--------|------|------|
| court_case_number | 사건번호 (예: 2024가단12345) | O |
| court_name | 법원명 | O |
| client_name | 의뢰인명 | O |
| client_phone | 의뢰인 연락처 | - |
| opponent_name | 상대방명 | - |
| contract_date | 계약일 | - |
| retainer_fee | 착수금 | - |

## SSE 이벤트 타입

### phase
처리 단계 변경 시 전송
```typescript
{
  phase: 'processing',
  message: '사건 등록 중...',
  total: 279
}
```

### progress
각 사건 처리 시 전송
```typescript
{
  current: 1,
  total: 279,
  phase: 'processing',
  status: 'success' | 'failed' | 'skipped' | 'processing',
  caseName: '2024가단12345'
}
```

### complete
모든 처리 완료 시 전송
```typescript
{
  summary: { total, success, failed, skipped, ... },
  results: [...],
  missingInfoSummary: [...],
  createdAt: '2024-01-11T...'
}
```

### error
오류 발생 시 전송
```typescript
{
  message: '오류 메시지'
}
```

## 스트림 에러 처리

### 클라이언트 연결 끊김 감지

장시간 처리 시 브라우저가 연결을 끊을 수 있습니다. 이를 처리하기 위해:

```typescript
let streamClosed = false

const stream = new ReadableStream({
  async start(controller) {
    const sendEvent = (event: string, data: unknown) => {
      if (streamClosed) return // 이미 닫혔으면 무시
      try {
        controller.enqueue(encoder.encode(`...`))
      } catch {
        streamClosed = true
      }
    }
    // ...
  },
  cancel() {
    // 클라이언트가 연결을 끊었을 때 호출
    streamClosed = true
  }
})
```

## 대법원 연동 로직

### 처리 흐름

1. 사건번호 파싱 (`parseCaseNumber`)
2. 중복 사건 체크
3. 대법원 연동 시도 (`searchAndRegisterCase`)
4. 의뢰인 생성/매칭
5. 사건 생성 (DB insert)
6. 당사자 정보 저장
7. 스냅샷 저장 (대법원 연동 성공 시)

### 연동 실패 시 처리

대법원 연동에 실패해도 사건은 등록됩니다:

```typescript
// 대법원 연동 시도
let scourtLinked = false
try {
  scourtResult = await apiClient.searchAndRegisterCase({...})
  if (scourtResult.success && scourtResult.encCsNo) {
    scourtLinked = true
  }
} catch (error) {
  scourtError = error.message
}

// 연동 실패해도 사건 생성 진행
const caseData = { ... }
if (scourtLinked && scourtResult) {
  caseData.enc_cs_no = scourtResult.encCsNo
  caseData.scourt_wmonid = scourtResult.wmonid
}
await adminClient.from('legal_cases').insert([caseData])
```

## UI 표시

### 진행 화면

- 진행률 바: 현재/전체 건수
- 현재 처리 중인 사건번호
- 실패 시에만 "실패" 배지 표시
- 경과 시간 및 예상 남은 시간

### 결과 화면

- 성공/실패/건너뜀/신규 의뢰인 수
- 대법원 연동 성공/실패 수
- 연동 안된 사건 목록 (최대 20건 표시)
- Excel 보고서 다운로드

## 법원코드 매핑

`lib/scourt/court-codes.ts`에서 법원명을 대법원 코드로 변환합니다:

```typescript
const COURT_CODES: Record<string, string> = {
  '서울중앙지방법원': '000203',
  '수원지방법원 안성시법원': '250821',
  '대전지방법원 아산시법원': '283877',
  // ...
}
```

새 법원이 필요한 경우 이 파일에 추가하세요.

## 성능 고려사항

- 대법원 API 호출 간격: 건당 2.5초 (rate limiting 방지)
- 279건 처리 시 약 12분 소요
- SSE 연결 타임아웃 대비 `cancel` 콜백 구현
- 결과 데이터는 메모리에 보관 후 완료 시 일괄 전송

## 관련 문서

- [SCOURT_INTEGRATION.md](./SCOURT_INTEGRATION.md) - 대법원 연동 시스템
- [CLIENT_ROLE_CONFIRMATION.md](./CLIENT_ROLE_CONFIRMATION.md) - 의뢰인 역할 확인 시스템
