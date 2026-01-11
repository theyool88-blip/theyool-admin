# 의뢰인 연락처 선택 입력 시스템

## 개요

사건 등록 시 의뢰인 연락처를 필수에서 선택으로 변경하여, 대법원 연동만으로 빠른 사건 등록이 가능하도록 개선했습니다.

## 변경 전후 비교

| 구분 | 변경 전 | 변경 후 |
|------|---------|---------|
| 연락처 입력 | 필수 | **선택** |
| 이해충돌 검색 | 이름 + 연락처 필수 | **이름만으로도 검색** |
| 동명이인 경고 | 연락처 일치 시에만 | **이름 일치 시에도** |

## 동작 흐름

### 1. 사건 등록 시

```
의뢰인 이름 입력
    ↓
이해충돌 검색 (이름 기준)
    ↓
동명이인 발견 시:
  - 연락처까지 일치: "동일한 연락처의 의뢰인이 등록되어 있습니다" (주황색 경고)
  - 이름만 일치: "동일한 이름의 의뢰인이 있습니다" (파란색 안내)
    ↓
사건 등록 (연락처 없이도 가능)
```

### 2. 사건 상세 페이지

```
연락처 미입력 의뢰인 감지
    ↓
알림탭에 배너 표시:
  "의뢰인 연락처가 등록되지 않았습니다"
  "알림톡/SMS 발송을 위해 연락처를 입력해주세요"
    ↓
[입력하기] 버튼 → 사건 수정 페이지로 이동
```

## 영향 분석

### 기능별 영향

| 기능 | 영향 | 동작 |
|------|------|------|
| 이해충돌 검색 | **변경** | 이름만으로도 검색 실행 |
| 알림톡/SMS 발송 | 영향 있음 | 연락처 없으면 발송 불가 |
| 의뢰인 목록 | 영향 없음 | 연락처 없으면 빈 값 표시 |
| 사건 등록 | **변경** | 연락처 없이 등록 가능 |

### 이해충돌 검색 경고 분기

```typescript
// 연락처 일치 여부 확인
const isPhoneMatch = conflictResult.client.phone && formData.client_phone &&
  conflictResult.client.phone.replace(/-/g, '') === formData.client_phone.replace(/-/g, '')

// 경고 메시지 분기
if (isPhoneMatch) {
  // 강한 경고 (주황색): 동일한 연락처의 의뢰인이 등록되어 있습니다
} else {
  // 안내 (파란색): 동일한 이름의 의뢰인이 있습니다. 확인해주세요.
}
```

## API 변경

### POST /api/admin/cases

**요청 (new_client)**
```typescript
new_client: {
  name: string        // 필수
  phone: string | null  // 선택 (변경됨)
  email?: string
  birth_date?: string
  address?: string
  bank_account?: string
}
```

**검증 로직**
```typescript
// 변경 전: 이름과 연락처 모두 필수
if (!body.new_client.name || !body.new_client.phone) {
  return error('Client name and phone are required')
}

// 변경 후: 이름만 필수
if (!body.new_client.name) {
  return error('Client name is required')
}
```

## 관련 파일

| 파일 | 역할 |
|------|------|
| `components/NewCaseForm.tsx` | 폼 검증, 이해충돌 검색, 경고 UI |
| `app/api/admin/cases/route.ts` | 사건 생성 API, 연락처 검증 |
| `components/CaseDetail.tsx` | 연락처 미입력 알림 배너 |
| `app/api/admin/clients/search/route.ts` | 의뢰인 검색 API (이름만 검색 지원) |

## UI 변경 사항

### 1. 연락처 입력 필드

```tsx
// 변경 전
<FormField label="연락처" required>
  <input type="tel" required={isNewClient} ... />
</FormField>

// 변경 후
<FormField label="연락처">
  <input type="tel" ... />  // required 제거
</FormField>
```

### 2. 이해충돌 경고 색상

| 상황 | 색상 | 배경 |
|------|------|------|
| 연락처 일치 | 주황색 (amber) | `bg-amber-50` |
| 이름만 일치 | 파란색 (blue) | `bg-blue-50` |

### 3. 연락처 미입력 알림 배너

```tsx
{caseData.client && !caseData.client.phone && (
  <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
    <p>의뢰인 연락처가 등록되지 않았습니다</p>
    <p>알림톡/SMS 발송을 위해 연락처를 입력해주세요</p>
    <button>[입력하기]</button>
  </div>
)}
```

## 주의사항

1. **연락처 없이 등록된 의뢰인**은 알림톡/SMS 발송이 불가능합니다.
2. **동명이인 의뢰인**이 여러 명 있을 수 있으므로, 기존 의뢰인 선택 시 주의가 필요합니다.
3. **CSV 일괄 import** 시에도 연락처는 선택입니다 (기존과 동일).
