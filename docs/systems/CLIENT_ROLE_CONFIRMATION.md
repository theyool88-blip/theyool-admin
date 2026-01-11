# 의뢰인 역할 사후 확인 시스템

## 개요

사건 등록 시 의뢰인과 상대방의 성씨가 동일한 경우 역할(원고/피고)을 즉시 선택하도록 강제하던 방식을 제거하고, 기본값으로 "원고측"을 임시 지정한 후 알림탭에서 사후 확인/변경할 수 있도록 변경했습니다.

## 변경 전후 비교

| 구분 | 변경 전 | 변경 후 |
|------|---------|---------|
| 등록 시 역할 질문 | 성씨 동일 시 모달 표시 | **제거** |
| 기본값 | 없음 (질문 필수) | `plaintiff` (원고측) |
| 역할 상태 | 없음 | `provisional` / `confirmed` |
| 확정 방법 | 등록 시 선택 | 알림탭에서 사후 확인 |

## 데이터베이스 스키마

### legal_cases 테이블

```sql
-- 기존 컬럼
client_role VARCHAR(20) CHECK (client_role IN ('plaintiff', 'defendant'))

-- 신규 컬럼
client_role_status VARCHAR(20) DEFAULT 'provisional'
  CHECK (client_role_status IN ('provisional', 'confirmed'))
```

### 상태 정의

| 상태 | 설명 |
|------|------|
| `provisional` | 임시 지정 상태. 사용자 확인 필요 |
| `confirmed` | 확정 상태. 사용자가 명시적으로 확인함 |

## 동작 흐름

### 1. 사건 등록 시

```
사건 등록 폼 제출
    ↓
client_role = body.client_role ?? 'plaintiff'
    ↓
의뢰인-상대방 성씨 비교
    ↓
client_role_status = 성씨가 같으면 'provisional', 다르면 'confirmed'
    ↓
DB 저장
```

- 사용자가 명시적으로 `client_role`을 지정한 경우: `confirmed`
- 원본 사건에서 `client_role`이 복사된 경우: `confirmed`
- 의뢰인과 상대방 성씨가 **같은** 경우: `provisional` (역할 확인 필요)
- 의뢰인과 상대방 성씨가 **다른** 경우: `confirmed` (자동 확정)

### 2. 알림탭 표시

```
detectCaseNotices()
    ↓
client_role_status === 'provisional' ?
    ↓ Yes
"의뢰인 역할 확인 필요" 알림 생성
    ↓
CaseNoticeSection에 표시
```

### 3. 역할 확정

```
사용자가 "원고측 확정" 또는 "피고측으로 변경" 버튼 클릭
    ↓
PATCH /api/admin/cases/{id}/client-role
    ↓
client_role = 선택한 역할
client_role_status = 'confirmed'
    ↓
case_parties 동기화 (party_type 업데이트)
    ↓
알림 자동 삭제 (provisional 해제)
```

## API 엔드포인트

### GET /api/admin/cases/{id}/client-role

현재 의뢰인 역할 조회

**응답**
```json
{
  "success": true,
  "client_role": "plaintiff",
  "client_role_status": "provisional"
}
```

### PATCH /api/admin/cases/{id}/client-role

의뢰인 역할 확정/변경

**요청**
```json
{
  "client_role": "plaintiff" | "defendant",
  "status": "confirmed"
}
```

**응답**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "client_role": "plaintiff",
    "client_role_status": "confirmed"
  }
}
```

**부수 효과**
- `case_parties` 테이블의 `party_type` 자동 업데이트
- 의뢰인 당사자: `client_role`과 동일하게 설정
- 상대방 당사자: 반대 역할로 설정 (manual_override=false인 경우만)

## 알림 시스템

### NoticeCategory

```typescript
type NoticeCategory =
  | 'client_role_confirm'  // 의뢰인 역할 확인
  | ... // 기타 카테고리
```

### 알림 UI

- **아이콘**: 👤
- **제목**: "의뢰인 역할 확인 필요"
- **설명**:
  - 상대방 이름이 있는 경우: "현재 {의뢰인명}님이 '원고측'으로 임시 지정되어 있습니다. (상대방: {상대방명})"
  - 상대방 이름이 없는 경우: "현재 {의뢰인명}님이 '원고측'으로 임시 지정되어 있습니다. 상대방 이름을 입력하고 역할을 확정해주세요."
- **상대방 이름 입력**: 상대방 이름이 미입력된 경우 입력 필드 표시
- **액션 버튼**:
  - "원고측 확정" (파란색)
  - "피고측으로 변경" (주황색)
  - 상대방 이름 미입력 시 버튼 비활성화 (입력 필수)

## 관련 파일

| 파일 | 역할 |
|------|------|
| `supabase/migrations/20260110_client_role_status.sql` | DB 마이그레이션 |
| `types/case-notice.ts` | 알림 타입 정의 |
| `lib/case/notice-detector.ts` | 알림 감지 로직 |
| `app/api/admin/cases/[id]/client-role/route.ts` | 역할 변경 API |
| `app/api/admin/cases/route.ts` | 사건 생성 시 기본값 처리 |
| `components/case/CaseNoticeSection.tsx` | 알림 UI |
| `components/CaseDetail.tsx` | 액션 핸들러 통합 |
| `components/NewCaseForm.tsx` | 성씨 비교 로직 제거됨 |

## 마이그레이션

### 기존 데이터 처리

```sql
-- client_role이 있는 경우: 이미 명시적으로 선택된 것이므로 confirmed
UPDATE legal_cases SET client_role_status = 'confirmed'
WHERE client_role IS NOT NULL;

-- client_role이 NULL인 경우: plaintiff로 설정하고 provisional
UPDATE legal_cases SET
  client_role = 'plaintiff',
  client_role_status = 'provisional'
WHERE client_role IS NULL;
```

## 주의사항

1. **알림 표시 조건**: `client_role_status`가 `provisional`인 경우에만 역할 확인 알림이 표시됩니다.

2. **case_parties 동기화**: 역할 변경 시 `is_our_client=true`인 당사자의 `party_type`이 자동으로 업데이트됩니다. 단, `manual_override=true`인 당사자는 영향받지 않습니다.

3. **SCOURT 연동**: SCOURT에서 가져온 당사자 정보와 별개로 `client_role`은 사용자가 명시적으로 확정한 값을 사용합니다.
