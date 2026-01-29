# 사건 폼 수정 계획 (Case Form Fixes) - v2

## 개요

**작성일**: 2026-01-29
**버전**: v2 (Critic 피드백 반영)
**대상 시스템**: Luseed 사건 관리 시스템
**수정 범위**: CaseEditForm, API 라우트

---

## 문제 분석 (수정됨)

### 문제 3: 저장 오류 - "Could not find the 'application_type' column"

**근본 원인 (정확한 분석)**:

| 위치 | 코드 | 문제 |
|------|------|------|
| `app/api/admin/cases/[id]/route.ts` Line 66 | `application_type: body.application_type \|\| null` | DB에 존재하지 않는 컬럼에 쓰려고 함 |
| DB 스키마 | `scourt_application_type VARCHAR(20)` | 실제 컬럼명 |

**핵심 발견 (Critic 검증 결과)**:
- `CaseEditForm.tsx`의 `submitCaseUpdate` 함수 (459-480줄)는 **`application_type`을 API로 전송하지 않음**
- 문제는 **API 측에서만** 발생: body에 없는 `application_type`을 DB에 쓰려고 시도
- CaseEditForm의 LegalCase interface (Line 37)와 formData 초기화 (Line 210)에는 `application_type`이 있지만, **API 전송에서는 제외됨**

---

### 문제 1: 담당변호사 선택이 안됨

**현재 상태**:
- `AssigneeMultiSelect` 컴포넌트: 정상 구현
- `CaseEditForm.tsx`: 담당자 목록 로딩 (304-311줄) 정상 구현
- 저장 로직 (489-507줄) 정상 구현

**잠재적 원인**:
1. API `/api/admin/tenant/members?role=lawyer,admin,owner` 응답 문제
2. `lawyerMembers` 상태가 빈 배열일 가능성
3. 컴포넌트 렌더링 조건 문제

**해결 방안**: 디버깅 로그 추가하여 실제 원인 파악

---

### 문제 2: 전화번호, 계좌번호 등 입력 필드 누락

**설계 의도 분석**:
- `CaseEditForm`은 **사건 수정** 전용 폼
- 의뢰인 상세 정보(전화번호, 계좌번호 등)는 **의뢰인 수정 페이지**에서 관리
- 현재 의뢰인 선택 시 상세 정보 확인 불가

**해결 방안**: 선택된 의뢰인 정보 표시 및 수정 페이지 링크 제공

---

## 수정 계획 (정정됨)

### Task 1: API route.ts에서 application_type 참조 제거

**우선순위**: HIGH (저장 오류 직접 원인)
**위험도**: LOW (단순 삭제)
**파일**: `/Users/hskim/luseed/app/api/admin/cases/[id]/route.ts`

| 라인 | 변경 전 | 변경 후 |
|------|---------|---------|
| 66 | `application_type: body.application_type \|\| null,` | **삭제** |

**이유**:
- DB 스키마에 `application_type` 컬럼 없음 (→ `scourt_application_type`만 존재)
- 클라이언트가 해당 필드를 전송하지 않음
- 불필요한 필드 참조로 인한 Supabase 스키마 캐시 오류 발생

---

### Task 2: CaseEditForm에서 application_type 타입 정리 (선택사항)

**우선순위**: LOW (직접적인 오류 원인 아님)
**위험도**: LOW

**파일**: `/Users/hskim/luseed/components/CaseEditForm.tsx`

API에서 제거된 필드이므로 클라이언트 코드에서도 정리:

| 라인 | 변경 전 | 변경 후 |
|------|---------|---------|
| 37 | `application_type: string \| null` | **삭제** (또는 `scourt_application_type`로 변경) |
| 210 | `application_type: caseData.application_type \|\| ''` | **삭제** |

**참고**: 이 수정은 선택사항. API에서 제거하면 오류는 해결됨. 하지만 코드 일관성을 위해 정리 권장.

---

### Task 3: 담당변호사 선택 문제 디버깅 로그 추가

**우선순위**: HIGH (기능 장애 원인 파악)
**위험도**: LOW (로깅만 추가)

**파일**: `/Users/hskim/luseed/components/CaseEditForm.tsx`

**위치**: Line 304-311 (담당자 목록 로딩)

**수정 코드**:
```tsx
// Line 304-311 수정
fetch('/api/admin/tenant/members?role=lawyer,admin,owner')
  .then(res => {
    console.log('[CaseEditForm] tenant members response status:', res.status)
    return res.json()
  })
  .then(data => {
    console.log('[CaseEditForm] tenant members data:', data)
    if (data.members && data.members.length > 0) {
      console.log('[CaseEditForm] Setting lawyerMembers:', data.members.length, 'members')
      setLawyerMembers(data.members)
    } else {
      console.warn('[CaseEditForm] No members found in response')
    }
  })
  .catch(err => console.error('[CaseEditForm] 담당자 목록 조회 실패:', err))
```

**파일**: `/Users/hskim/luseed/components/ui/AssigneeMultiSelect.tsx`

**위치**: 컴포넌트 내부 (Line 38 근처)

**추가 코드**:
```tsx
useEffect(() => {
  console.log('[AssigneeMultiSelect] Render - members:', members.length, 'value:', value)
}, [members, value])
```

---

### Task 4: 의뢰인 정보 표시 개선 (선택사항)

**우선순위**: MEDIUM (편의성 개선)
**위험도**: LOW

**파일**: `/Users/hskim/luseed/components/CaseEditForm.tsx`

**사전 확인 필요**:
1. Client 인터페이스 (Line 15-19)에 phone, email, bank_account 등 필드 존재 여부
2. `/api/admin/clients` API가 해당 필드 반환 여부

**현재 Client 인터페이스** (Line 15-19):
```tsx
interface Client {
  id: string
  name: string
  phone?: string  // 이미 있음
}
```

**구현 계획**:
- 선택된 의뢰인의 phone 정보 표시
- 의뢰인 상세 페이지로 이동하는 링크 추가
- 위치: 의뢰인 선택 영역 (Line 751-814) 하단

---

## 수정 순서 (의존성 고려)

```
1. Task 1: API route.ts Line 66 삭제 (필수 - 오류 해결)
   ↓
2. Task 2: CaseEditForm 타입 정리 (선택 - 코드 일관성)
   ↓
3. Task 3: 디버깅 로그 추가 (병렬 가능 - 문제 1 원인 파악)
   ↓
4. Task 4: 의뢰인 정보 표시 (병렬 가능 - 문제 2 편의성)
```

---

## 검증 방법

### Task 1 검증 (필수)
1. 사건 수정 페이지 접속
2. 아무 필드나 수정 후 저장 클릭
3. **"Could not find the 'application_type' column" 에러가 발생하지 않아야 함**
4. 저장 성공 메시지 확인
5. `npm run build` 성공 확인

### Task 2 검증
1. TypeScript 컴파일 오류 없음 (`npm run build`)
2. IDE에서 타입 에러 없음

### Task 3 검증
1. 브라우저 개발자 도구 콘솔 열기
2. 사건 수정 페이지 접속
3. `[CaseEditForm] tenant members` 로그 확인
4. members 배열 내용 확인:
   - 비어있으면 → API 문제
   - 있으면 → 컴포넌트 렌더링 문제

### Task 4 검증
1. 의뢰인 선택 시 연락처 표시 확인
2. "의뢰인 정보 수정" 링크 동작 확인

---

## 위험 요소 및 롤백 전략

### 위험 요소

1. **Task 1**: 위험도 없음 - 사용하지 않는 필드 제거
2. **Task 2**: 위험도 낮음 - 타입 정리만
3. **Task 3**: 위험도 없음 - 디버깅 로그만 추가
4. **Task 4**: 위험도 낮음 - UI 추가만

### 롤백 전략
```bash
git checkout HEAD~1 -- app/api/admin/cases/[id]/route.ts components/CaseEditForm.tsx
```

---

## 정의된 완료 조건 (Definition of Done)

**필수**:
- [x] 사건 수정 시 "application_type" 컬럼 오류 없이 저장 성공
- [x] TypeScript 빌드 오류 없음

**권장**:
- [ ] 담당변호사 선택 원인 파악 (디버깅 로그 통해)
- [ ] 의뢰인 연락처 정보 표시 개선

---

## 커밋 전략

**1차 커밋 (필수)**:
```
fix: API에서 존재하지 않는 application_type 컬럼 참조 제거

- PATCH /api/admin/cases/[id]에서 application_type 필드 제거
- DB 스키마에 해당 컬럼 없음 (scourt_application_type만 존재)
- 사건 저장 시 "Could not find column" 오류 해결

Fixes: 저장 오류 - "Could not find the 'application_type' column"
```

**2차 커밋 (선택)**:
```
chore: CaseEditForm에서 사용하지 않는 application_type 타입 정리

- LegalCase interface에서 application_type 제거
- formData 초기화에서 application_type 제거
```

**3차 커밋 (디버깅)**:
```
debug: 담당변호사 선택 문제 디버깅 로그 추가

- CaseEditForm: tenant members API 응답 로깅
- AssigneeMultiSelect: props 상태 로깅
```
