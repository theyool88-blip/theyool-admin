# SCOURT 관련사건 매핑 시스템

> 대법원 API의 관련사건 유형(`reltCsDvsNm`)을 시스템 관계유형으로 매핑

## 개요

SCOURT API에서 반환하는 연관사건 정보(`dlt_reltCsLst`)의 관계유형 명칭을 시스템 내부 관계유형 코드로 변환합니다.

## 관계유형 매핑 (SCOURT_RELATION_MAP)

**파일**: `lib/scourt/case-relations.ts`

### 심급 관계 (appeal)

| SCOURT 명칭 | 시스템 코드 | 설명 |
|-------------|-------------|------|
| 항소심 | appeal | 2심 |
| 상고심 | appeal | 3심 (대법원) |
| 항고심 | appeal | 항고 사건의 상급심 |
| 재항고심 | appeal | 재항고 |
| 특별항고 | appeal | 특별항고 (대법원) |
| 즉시항고 | appeal | 즉시항고 |
| 하심사건 | appeal | 원심 사건 |
| 원심 | appeal | 원심 사건 |
| 1심, 2심, 3심 | appeal | 심급 표시 |

### 본안/보전 관계 (provisional)

| SCOURT 명칭 | 시스템 코드 | 설명 |
|-------------|-------------|------|
| 본안사건 | provisional | 보전처분의 본안 사건 |
| 본사건 | provisional | 본안사건 동의어 |
| 신청사건 | provisional | 본안의 보전처분 신청 |
| 가처분 | provisional | 가처분 사건 |
| 가압류 | provisional | 가압류 사건 |

### 집행 관계 (execution)

| SCOURT 명칭 | 시스템 코드 | 설명 |
|-------------|-------------|------|
| 집행사건 | execution | 집행 사건 |
| 판결정본 | execution | 집행권원이 되는 판결 |
| 집행권원 | execution | 집행의 기초가 되는 권원 |
| 압류 | execution | 압류 사건 |
| 배당 | execution | 배당 사건 |
| 경매 | execution | 경매 사건 |
| 소송비용확정 | execution | 소송비용확정 결정 |
| 카확 | execution | 소송비용확정 (사건유형 코드) |
| 보전확정 | execution | 카확의 fullName |
| 확정 | execution | 확정 관련 |
| 강제집행 | execution | 강제집행 사건 |
| 인도명령 | execution | 인도명령 사건 |
| 추심 | execution | 추심 사건 |

### 독촉/지급명령 관계 (related)

| SCOURT 명칭 | 시스템 코드 | 설명 |
|-------------|-------------|------|
| 독촉사건 | related | 지급명령 사건 |
| 독촉 | related | 독촉 약칭 |
| 지급명령 | related | 지급명령 |
| 전차 | related | 지급명령 전 원래 사건 |
| 후차 | related | 지급명령 이의신청 후 사건 |
| 이의신청 | related | 이의신청 사건 |
| 차전 | related | 전자독촉 (사건유형 코드) |

### 이송 관계 (related)

| SCOURT 명칭 | 시스템 코드 | 설명 |
|-------------|-------------|------|
| 이송전사건 | related | 이송 전 원래 사건 |
| 이송후사건 | related | 이송 후 사건 |
| 이송 | related | 이송 (약칭) |

### 관련사건 (related)

| SCOURT 명칭 | 시스템 코드 | 설명 |
|-------------|-------------|------|
| 반소 | related | 반소 사건 |
| 병합 | related | 병합된 사건 |
| 분리 | related | 분리된 사건 |
| 관련사건 | related | 일반 관련사건 |
| 조정사건, 조정 | related | 조정 사건 |
| 중재사건 | related | 중재 사건 |
| 화해사건, 화해 | related | 화해 사건 |
| 파산사건, 파산 | related | 파산 사건 |
| 회생사건, 회생 | related | 회생 사건 |
| 개인회생 | related | 개인회생 사건 |
| 면책 | related | 파산 면책 |
| 기타 | related | 기타 관련사건 |

### 재심 관계 (retrial)

| SCOURT 명칭 | 시스템 코드 | 설명 |
|-------------|-------------|------|
| 재심 | retrial | 재심 사건 |
| 준재심 | retrial | 준재심 사건 |

---

## 관계 방향 결정 (determineRelationDirection)

연관사건과 현재 사건 간의 상하관계를 결정합니다.

### 방향 값

- `parent`: 현재 사건이 상위 (연관사건이 하위)
- `child`: 현재 사건이 하위 (연관사건이 상위)
- `sibling`: 대등 관계

### 방향 결정 규칙

```typescript
// 연관사건이 상위 심급 → child
['항소심', '상고심', '항고심', '재항고심', '특별항고', '즉시항고', '재심', '준재심']

// 연관사건이 하위 심급 → parent
['하심사건', '1심', '원심', '2심', '3심']

// 연관사건이 이송전 → child (현재가 이송받은 사건)
['이송전사건']

// 연관사건이 이송후 → parent (현재가 원래 사건)
['이송후사건', '이송']

// 연관사건이 본안 → child (현재가 보전)
['본안사건', '본사건']

// 연관사건이 보전 → parent (현재가 본안)
['신청사건', '가처분', '가압류']

// 연관사건이 판결 → child (현재가 집행)
['판결정본', '집행권원']

// 연관사건이 집행 → parent (현재가 판결)
['집행사건', '압류', '배당', '경매', '소송비용확정', '카확', '보전확정', ...]

// 그 외 → sibling (대등 관계)
['반소', '병합', '분리', '독촉', '조정', ...]
```

---

## 미등록 관련사건 알림 시스템

### 기능

동기화 시 발견된 미등록 관련사건/심급사건을 알림 탭에 표시합니다.

### 알림 카테고리

| 카테고리 | 아이콘 | 설명 |
|----------|--------|------|
| unlinked_related_case | 🔗 | 미등록 관련사건 |
| unlinked_lower_court | 📊 | 미등록 심급사건 |

### 구현 파일

- `lib/case/notice-detector.ts`: `detectUnlinkedRelatedCases()` 함수
- `types/case-notice.ts`: 카테고리 타입 정의
- `components/CaseDetail.tsx`: 알림 표시 연동

### 동작 방식

1. SCOURT 동기화 시 `relatedCases`, `lowerCourt` 데이터 수집
2. `linkedCaseId`가 없는 사건들을 미등록으로 판단
3. 알림 탭에 표시하여 사용자에게 등록 유도

```typescript
// notice-detector.ts
function detectUnlinkedRelatedCases(
  unlinkedRelatedCases: UnlinkedRelatedCase[],
  unlinkedLowerCourt: UnlinkedLowerCourt[]
): CaseNotice[] {
  // linkedCaseId가 null인 사건들을 필터링하여 알림 생성
}
```

---

## 관련 파일

| 파일 | 역할 |
|------|------|
| `lib/scourt/case-relations.ts` | SCOURT_RELATION_MAP, determineRelationDirection |
| `lib/scourt/related-case-linker.ts` | 관련사건 자동 연결 로직 |
| `lib/case/notice-detector.ts` | 미등록 사건 알림 감지 |
| `types/case-notice.ts` | 알림 타입 정의 |
| `components/CaseDetail.tsx` | 알림 UI 연동 |
