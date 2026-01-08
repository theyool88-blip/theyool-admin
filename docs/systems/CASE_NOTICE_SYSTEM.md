# 사건 알림 시스템 (Case Notice System)

## 개요

사건 상세 페이지의 "알림" 탭에서 변호사가 확인해야 할 중요 사항들을 자동으로 감지하여 표시합니다.

## 알림 카테고리 (6가지)

### 1. 다음 기일 안내 (`next_hearing`)
| 조건 | 메시지 |
|-----|--------|
| 예정된 기일 존재 | "다음 기일: {날짜} {시간} {장소}" |
| D-7 이내 | D-day 강조 표시 |

**데이터 소스**: `court_hearings` 테이블

---

### 2. 기한 관리 (`deadline`)
| 조건 | 메시지 |
|-----|--------|
| 상소기한 임박 | "항소기한 {N}일 남음" |
| 보정명령 기한 임박 | "보정명령 기한 {N}일 남음" |
| 기한 초과 | "기한 초과 (D+{N})" |

**데이터 소스**: `case_deadlines` 테이블

---

### 3. 준비서면 제출 알람 (`brief_required`)
| 조건 | 메시지 |
|-----|--------|
| 재판 2주전 + 마지막 제출이 상대방 서면 | "반박서면 제출 필요" |

**데이터 소스**: SCOURT `dlt_rcntSbmsnDocmtLst` (제출서류)

**감지 로직**:
```
if (다음기일 - today <= 14일) {
  if (상대방 최근 서면 접수일 > 우리 최근 서면 접수일) {
    → "반박서면 제출 필요"
  }
}
```

---

### 4. 서류 송달 문제 (`document_issue`)

#### 4-1. 우리 서류 미송달
| 조건 | 메시지 |
|-----|--------|
| 송달 시도 + 도달 안됨 | "서류 미송달: {서류명} (이사불명 등)" |
| 송달 반환 | "서류 반송됨: {서류명} - 재송달 필요" |

#### 4-2. 보정명령 미이행
| 조건 | 메시지 |
|-----|--------|
| 보정명령 수령 + 보정 미제출 | "보정명령 미이행 - 기한: {날짜}" |

**데이터 소스**: SCOURT progress/documents

---

### 5. 증거신청 회신 미수령 (`evidence_pending`)
| 조건 | 메시지 |
|-----|--------|
| 재판 2주전 + 증거회신 미수령 | "증거신청 회신 미수령: {증거명}" |

**데이터 소스**: SCOURT documents + progress

**감지 로직**:
```
if (다음기일 - today <= 14일) {
  증거신청목록 = documents where 우리측 + 포함('증거신청', '사실조회', '문서제출명령')
  for each 증거신청 {
    if (해당 증거에 대한 회신 없음) {
      → "증거신청 회신 미수령: {증거명}"
    }
  }
}
```

---

### 6. 기일 충돌 경고 (`schedule_conflict`)
| 조건 | 메시지 |
|-----|--------|
| 같은 날 다른 법원 기일 | "기일 충돌: {사건A} vs {사건B}" |

**충돌 판정 조건**:
- 같은 날짜
- 다른 법원 (court_name이 다름)
- 시간과 무관하게 무조건 표시

**처리 옵션** (4가지 버튼):
1. **삭제** - 경고 무시
2. **변호사 변경** - 담당 변호사 변경
3. **기일변경 신청** - 신청서 작성 안내
4. **복대리인** - 복대리인 지정

**데이터 소스**: `court_hearings` 테이블 (전체 사건, 향후 30일)

---

## UI 설계

```
┌──────────────────────────────────────────────────────────────┐
│ 알림                                                총 5건  │
├──────────────────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────────────────┐ │
│  │ 📅 다음 기일: 변론기일                         D-14   │ │
│  │    2024.01.20 14:00 서울가정법원 301호                 │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ ⏰ 항소기한 7일 남음                            D-7    │ │
│  │    2024.01.13 까지 (기산일: 2023.12.30)               │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌───────────────────────────────────────── bg-red-50 ────┐ │
│  │ ⚠️ 기일 충돌                                   D-14   │ │
│  │    2024.01.20 서울가정 vs 수원지법                     │ │
│  │    ┌──────┐ ┌──────────┐ ┌──────────┐ ┌────────┐      │ │
│  │    │ 삭제 │ │변호사변경│ │기일변경  │ │복대리인│      │ │
│  │    └──────┘ └──────────┘ └──────────┘ └────────┘      │ │
│  └────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

### D-day 색상 표시
| 조건 | 배경색 | 텍스트 |
|-----|--------|--------|
| 기한 초과 (D+N) | `bg-red-50` | `text-red-600 font-semibold` |
| D-3 이내 | `bg-amber-50` | `text-amber-600 font-semibold` |
| D-7 이내 | `bg-yellow-50` | `text-yellow-600` |
| 그 외 | `bg-white` | `text-gray-500` |

---

## 파일 구조

```
types/
└── case-notice.ts          # 타입 정의

lib/case/
└── notice-detector.ts      # 알림 감지 로직

components/case/
└── CaseNoticeSection.tsx   # 알림 UI 컴포넌트

components/
└── CaseDetail.tsx          # 사건 상세 (알림 탭 통합)
```

---

## 타입 정의

```typescript
// types/case-notice.ts

type NoticeCategory =
  | 'next_hearing'      // 다음기일
  | 'deadline'          // 기한
  | 'brief_required'    // 준비서면 제출
  | 'document_issue'    // 서류 송달 문제
  | 'evidence_pending'  // 증거회신 대기
  | 'schedule_conflict' // 기일 충돌

interface CaseNotice {
  id: string
  category: NoticeCategory
  title: string
  description: string
  dueDate?: string
  daysRemaining?: number
  actions?: NoticeAction[]
  metadata?: Record<string, any>
}

interface NoticeAction {
  label: string
  type: 'dismiss' | 'change_lawyer' | 'change_date' | 'deputy' | 'view' | 'edit'
  metadata?: Record<string, any>
}
```

---

## 사용법

### 알림 감지

```typescript
import { detectCaseNotices } from '@/lib/case/notice-detector'

const notices = detectCaseNotices({
  caseId: 'case-123',
  courtName: '서울가정법원',
  deadlines: caseDeadlines,
  hearings: caseHearings,
  allHearings: allCasesHearings,  // 충돌 감지용
  // 아래는 SCOURT 연동 시 추가
  scourtDocuments: [],
  scourtProgress: []
})
```

### 컴포넌트 사용

```tsx
import CaseNoticeSection from '@/components/case/CaseNoticeSection'

<CaseNoticeSection
  notices={caseNotices}
  onAction={(notice, actionType) => {
    // 액션 처리 (기일충돌 버튼 등)
  }}
/>
```

---

## 데이터 흐름

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  court_hearings │────▶│                 │     │                 │
│  case_deadlines │────▶│ detectCaseNotices│────▶│ CaseNoticeSection│
│  SCOURT data    │────▶│                 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

---

## SCOURT 데이터 연동 (2026-01-08 완료)

### 연동된 데이터

| 데이터 | 소스 | 용도 |
|--------|------|------|
| `scourtProgress` | `scourt_case_snapshots.progress` | 송달 실패 감지 |
| `scourtDocuments` | `scourt_case_snapshots.documents` | 준비서면/증거회신 감지 |
| `clientPartyType` | `legal_cases.client_role` | 우리측/상대방 구분 |

### 제출서류 데이터 구조

```typescript
{
  date: string        // 접수일 (ofdocRcptYmd)
  content: string     // 서류명 (content2)
  submitter: string   // 제출자 (content1) - 원고/피고/신청인 등
}
```

### 제출자 구분 로직

```typescript
const ourSide = clientPartyType === 'plaintiff'
  ? ['원고', '신청인', '채권자']
  : ['피고', '피신청인', '채무자']

const isOurs = ourSide.some(s => submitter.includes(s))
```

---

## 향후 확장

- [ ] 알림 읽음/처리 상태 저장 (`case_notices` 테이블)
- [ ] 대시보드에서 모든 사건 알림 통합 조회
- [x] SCOURT 데이터 연동 (준비서면, 서류송달, 증거회신) - **완료 (2026-01-08)**
- [ ] 기일충돌 액션 핸들러 구현

---

## 관련 문서

- [COURT_HEARING_SYSTEM.md](./COURT_HEARING_SYSTEM.md) - 기일 관리 시스템
- [SCOURT_INTEGRATION.md](./SCOURT_INTEGRATION.md) - 대법원 나의사건 연동
