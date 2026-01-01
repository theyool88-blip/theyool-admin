# SeeD AI 시스템

## 개요

SeeD는 법률 사무소 운영을 위한 AI 지원 시스템입니다. Clio의 AI 서비스를 참고하여 다음 3가지 핵심 기능을 제공합니다:

- **SeeD Manage**: 사건 관리 AI (Planning, Scheduling)
- **SeeD Work**: AI 리서치 (THE0에서 구현)
- **SeeD Draft**: 문서 자동화 (THE0에서 구현)

이 문서는 theyool-admin에 구현된 SeeD Manage 시스템을 다룹니다.

---

## SeeD Manage

### 1. Planning 모듈

사건 우선순위 평가 및 다음 작업 추천 시스템입니다.

#### 핵심 파일

| 파일 | 설명 |
|-----|------|
| `lib/planning/priority-scorer.ts` | 사건 우선순위 점수 계산 |
| `lib/planning/task-recommender.ts` | 다음 작업 추천 |
| `lib/planning/types.ts` | 타입 정의 |

#### 우선순위 점수 계산

```typescript
// 점수 구성 (100점 만점)
- 긴급도 (Urgency): 40%
  - 7일 내 기한: +15점
  - 3일 내 기한: +30점
  - 지연된 기한: +40점

- 중요도 (Importance): 30%
  - 소송 금액 기반
  - 사건 유형별 가중치

- 리스크 (Risk): 30%
  - 미결제 상태
  - 기일 충돌
  - 서면 미제출
```

#### 등급 분류

| 등급 | 점수 | 의미 |
|-----|------|------|
| A | 80+ | 긴급 - 즉시 조치 필요 |
| B | 60-79 | 높음 - 금일 처리 권장 |
| C | 40-59 | 보통 - 주간 처리 |
| D | 0-39 | 낮음 - 일정에 따라 처리 |

#### API 엔드포인트

```
GET /api/admin/planning
  ?limit=10              # 조회 개수
  ?dashboard=true        # 대시보드 요약
  ?caseId=xxx           # 특정 사건 우선순위

GET /api/admin/planning/tasks
  ?today=true           # 오늘의 작업
  ?caseId=xxx          # 특정 사건 작업
  ?types=document,payment  # 작업 유형 필터
```

---

### 2. Communication 모듈

의뢰인 업데이트 메시지 자동 생성 시스템입니다.

#### 핵심 파일

| 파일 | 설명 |
|-----|------|
| `lib/communication/client-update-generator.ts` | 메시지 생성기 |
| `lib/communication/templates.ts` | 메시지 템플릿 |
| `lib/communication/types.ts` | 타입 정의 |

#### 지원 메시지 유형

| 유형 | 설명 | 필수 파라미터 |
|-----|------|-------------|
| `hearing_reminder` | 기일 안내 | hearingId |
| `deadline_reminder` | 기한 안내 | deadlineId |
| `payment_reminder` | 결제 안내 | - |
| `progress_report` | 진행상황 보고 | - |

#### 지원 채널

- `email`: 이메일 (제목 + 본문)
- `sms`: 문자 (90자 제한)
- `kakao`: 카카오 알림톡 (1000자)

#### API 엔드포인트

```
GET /api/admin/communication
  # 지원 메시지 유형 및 채널 목록

POST /api/admin/communication
  {
    "caseId": "uuid",
    "type": "progress_report",
    "channel": "kakao"
  }

POST /api/admin/communication/generate
  {
    "caseId": "uuid",
    "type": "hearing_reminder",
    "hearingId": "uuid",
    "channel": "email"
  }
```

---

### 3. 대시보드 위젯

Planning/Communication 데이터를 시각화하는 React 컴포넌트입니다.

#### 위젯 목록

| 컴포넌트 | 파일 | 기능 |
|---------|------|------|
| `PriorityCasesWidget` | `components/planning/PriorityCasesWidget.tsx` | 사건 우선순위 목록 |
| `UpcomingEventsWidget` | `components/planning/UpcomingEventsWidget.tsx` | 다가오는 기한/기일 |
| `RiskAlertsWidget` | `components/planning/RiskAlertsWidget.tsx` | 리스크 알림 |

#### 사용 예시

```tsx
import {
  PriorityCasesWidget,
  UpcomingEventsWidget,
  RiskAlertsWidget
} from '@/components/planning';

// 대시보드에서 사용
<div className="grid grid-cols-2 gap-4">
  <PriorityCasesWidget limit={5} />
  <UpcomingEventsWidget limit={7} />
</div>
<RiskAlertsWidget limit={5} />
```

---

## 기술 스택

### AI 모델

```typescript
// lib/ai/simple-ai-client.ts
- Provider: Google Gemini
- Model: gemini-2.0-flash-exp
- 용도: 메시지 생성, 요약

// 환경 변수
GOOGLE_AI_API_KEY=your-api-key
```

### 데이터 소스

Planning 모듈은 다음 테이블에서 데이터를 조회합니다:

- `cases`: 사건 정보
- `court_hearings`: 기일 정보
- `case_deadlines`: 기한 정보
- `payments`: 결제 정보
- `clients`: 의뢰인 정보

---

## case_id 기반 시스템

### 배경

일부 사건은 사건번호가 없거나 아직 배정되지 않은 상태입니다. 이를 지원하기 위해 `case_id` 기반으로 전환했습니다.

### 스키마 변경

```sql
-- court_hearings, case_deadlines
- case_number: NULL 허용
- case_id: 필수 (application level)

-- Migration: 20260101_case_id_based_schedules.sql
```

### 코드 변경

```typescript
// CreateCaseDeadlineRequest
interface CreateCaseDeadlineRequest {
  case_id: string;        // 필수
  case_number?: string;   // 선택적
  deadline_type: DeadlineType;
  trigger_date: string;
}

// 자동 기한 등록 시 case_id 조회 추가
const { data: caseData } = await supabase
  .from('cases')
  .select('id')
  .eq('case_number', caseNumber)
  .single();
```

---

## 향후 계획

### Phase 2: SeeD Work (THE0)
- 법률 리서치 인터페이스
- RAG 기반 판례 검색
- 질문-답변 시스템

### Phase 3: SeeD Draft (THE0)
- 서면 자동 작성
- 템플릿 시스템
- 반박문 생성

### Phase 4: 고급 기능
- 실시간 알림 (Push, 카카오톡)
- 일정 자동 조정
- 예측 분석
