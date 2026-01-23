# 대량 등록 시스템 (Batch Import System)

## 개요

Excel/CSV 파일을 통해 사건과 의뢰인을 대량으로 등록하고, 대법원 나의사건검색과 자동 연동하는 시스템입니다.

## 주요 기능

### 1. 파일 업로드 및 파싱
- **지원 형식**: Excel (.xlsx, .xls), CSV
- **AI 컬럼 매핑**: 한글/영문 컬럼명 자동 인식
- **데이터 검증**: 필수 필드, 형식, 중복 검사

### 2. 의뢰인 자동 생성
- 동일 이름의 기존 의뢰인 자동 매칭
- 신규 의뢰인 자동 생성 (이름만 필수, 전화번호 선택)
- `clients` 테이블에 저장 후 `legal_cases.primary_client_id`에 연결

### 3. 대법원 나의사건 연동
- 사건번호 파싱 및 법원코드 변환
- 캡챠 자동 인식 (CNN 모델)
- 일반내역/진행내역 자동 수집
- 스냅샷 저장 (`scourt_case_snapshots`)

### 4. 담당자 지정
- 복수 담당자 지원 (쉼표 구분)
- `case_assignees` 테이블에 저장
- 첫 번째 담당자가 주담당 (`is_primary: true`)

## 데이터 흐름

```
Excel 업로드
    ↓
컬럼 매핑 (AI 자동 or 수동)
    ↓
데이터 검증
    ↓
┌─────────────────────────────────────┐
│  각 행마다 순차 처리                    │
│  ├─ 1. 의뢰인 생성/매칭                │
│  ├─ 2. 담당자 조회                     │
│  ├─ 3. 대법원 API 연동 (1.5초 딜레이)   │
│  ├─ 4. 사건 생성 (legal_cases)         │
│  ├─ 5. 당사자 동기화 (case_parties)    │
│  ├─ 6. 스냅샷 저장                     │
│  └─ 7. 기일/진행내역 동기화            │
└─────────────────────────────────────┘
    ↓
결과 리포트 (Excel 다운로드)
```

## API 엔드포인트

### POST `/api/admin/onboarding/batch-create-stream`
스트리밍 방식의 대량 등록 (권장)

**Request Body:**
```typescript
{
  rows: StandardCaseRow[];
  options?: {
    duplicateHandling?: 'skip' | 'update' | 'create';
    createNewClients?: boolean;  // default: true
    linkScourt?: boolean;        // default: false
    scourtDelayMs?: number;      // default: 1500
    dryRun?: boolean;            // default: false
  };
  columnMapping?: Record<string, string>;
}
```

**Response:** Server-Sent Events (SSE)
```
event: progress
data: {"current": 1, "total": 100, "message": "처리 중..."}

event: result
data: {"status": "success", "rowIndex": 0, "created": {...}}

event: complete
data: {"report": {...}}
```

### POST `/api/admin/onboarding/batch-create`
일반 방식 (소량 데이터용)

## 표준 필드 (StandardCaseRow)

| 필드명 | 한글명 | 필수 | 설명 |
|--------|--------|------|------|
| `court_case_number` | 사건번호 | ✅ | 예: 2024가합12345 |
| `court_name` | 법원명 | ✅ | 예: 서울중앙지방법원 |
| `case_name` | 사건명 | | 예: 손해배상(기) |
| `client_name` | 의뢰인명 | ✅ | 의뢰인 이름 |
| `client_role` | 의뢰인지위 | | plaintiff, defendant |
| `opponent_name` | 상대방명 | | 상대방 이름 |
| `assigned_lawyer` | 담당변호사 | | 쉼표로 복수 지정 가능 |
| `status` | 상태 | | active, closed 등 |
| `case_type` | 사건유형 | | civil, family 등 |
| `retainer_fee` | 착수금 | | 숫자 |
| `contract_date` | 계약일 | | YYYY-MM-DD |
| `client_phone` | 의뢰인연락처 | | 전화번호 |
| `client_email` | 의뢰인이메일 | | 이메일 |
| `notes` | 메모 | | 비고 |

## 스냅샷 테이블 구조

```sql
CREATE TABLE scourt_case_snapshots (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  legal_case_id UUID NOT NULL,
  case_number TEXT NOT NULL,
  court_code TEXT,
  basic_info JSONB DEFAULT '{}',
  hearings JSONB DEFAULT '[]',
  progress JSONB DEFAULT '[]',
  documents JSONB DEFAULT '[]',
  lower_court JSONB DEFAULT '[]',
  related_cases JSONB DEFAULT '[]',
  raw_data JSONB,
  content_hash TEXT,
  scraped_at TIMESTAMPTZ DEFAULT NOW()
);
```

## 백필 스크립트

### 의뢰인 일괄 생성
```bash
npx tsx scripts/backfill-clients.ts
```
- `primary_client_name`은 있지만 `primary_client_id`가 없는 사건 처리
- 의뢰인 테이블에 생성 후 사건에 연결

### 스냅샷 일괄 생성
```bash
npx tsx scripts/backfill-snapshots.ts
```
- 대법원 연동된 사건 중 스냅샷이 없는 것 처리
- API 호출하여 일반내역/진행내역 수집

## 성능

| 항목 | 값 |
|------|-----|
| API 딜레이 | 1.5초/건 |
| 100건 예상 시간 | ~2.5분 |
| 300건 예상 시간 | ~7.5분 |
| 500건 예상 시간 | ~12.5분 |

## 에러 처리

### 의뢰인 생성 실패
- 경고로 처리, 사건 등록은 계속 진행
- `primary_client_name`만 저장, `primary_client_id`는 null

### 대법원 연동 실패
- 캡챠 인식 실패: 최대 20회 재시도
- API 오류: 경고로 처리, 사건은 등록됨
- 연동 실패해도 사건 기본 정보는 저장

### 스냅샷 저장 실패
- 경고로 처리
- 나중에 `backfill-snapshots.ts`로 복구 가능

## 관련 파일

- `app/admin/onboarding/import/page.tsx` - UI
- `app/api/admin/onboarding/batch-create-stream/route.ts` - 스트리밍 API
- `app/api/admin/onboarding/batch-create/route.ts` - 일반 API
- `lib/onboarding/batch-case-creator.ts` - 사건 생성 로직
- `lib/onboarding/csv-schema.ts` - 스키마 및 검증
- `lib/scourt/case-storage.ts` - 스냅샷 저장
- `lib/scourt/api-client.ts` - 대법원 API 클라이언트

## 버그 수정 이력

### 2026-01-22: SCOURT 연동 필드명 불일치 수정

**문제:**
- 대량 등록 시스템에서 `scourt_enc_cs_no` 필드에 저장
- 개별 연동 API(sync/route.ts, snapshot/route.ts)에서는 `enc_cs_no` 필드 확인
- 결과: 대량 등록으로 연동된 사건이 "미연동"으로 표시됨

**해결:**
- `sync/route.ts`: `enc_cs_no` → `scourt_enc_cs_no` (6곳)
- `snapshot/route.ts`: `enc_cs_no` → `scourt_enc_cs_no` (5곳)
- `CaseDetail.tsx`: 타입 및 로직 수정 (2곳)
- 에러 로깅 추가로 디버깅 용이성 개선

**영향받는 기능:**
- 사건 상세 페이지 "대법원 연동" 버튼
- 사건 상세 페이지 "갱신" 버튼
- 연동 상태 표시 (연동됨/미연동)

**커밋:** `e72d213`
