# 상담 관리 시스템

**Last Updated**: 2025-12-02

법무법인 더율의 상담 접수부터 완료까지 전 과정을 관리하는 통합 시스템입니다.

---

## 개요

### 주요 기능

| 기능 | 설명 |
|------|------|
| **4가지 상담 유형** | 콜백, 방문, 화상, 정보문의 |
| **9개 상태 워크플로우** | 대기 → 연락 → 확정 → 진행 → 완료 |
| **리드 스코어링** | 긴급도 기반 우선순위 자동 산정 |
| **담당 변호사 지정** | 육심원, 임은지 배정 |
| **상담 유입 경로 관리** | 마케팅 채널별 통계 |
| **상담 시간 관리** | 예약 가능 시간대 설정 |

---

## 상담 유형

### 1. callback (콜백 요청)
- 단순 전화 회신 요청
- 필수: 이름, 전화번호
- 상태 흐름: `pending → contacted → completed`

### 2. visit (방문 상담)
- 사무소 방문 상담
- 필수: 이름, 전화번호, 희망 날짜/시간, 사무소
- 상태 흐름: `pending → contacted → confirmed → in_progress → completed`

### 3. video (화상 상담)
- Zoom/Meet 화상 상담
- 필수: 이름, 전화번호, 희망 날짜/시간
- 상태 흐름: `pending → contacted → confirmed → in_progress → completed`

### 4. info (정보 문의)
- 정보만 요청 (후속 조치 불필요)
- 필수: 이름, 전화번호
- 상태 흐름: `pending → completed`

---

## 상태 워크플로우

### 9가지 상태

| 상태 | 한글 | 설명 |
|------|------|------|
| `pending` | 대기중 | 신규 접수, 관리자 확인 대기 |
| `contacted` | 연락완료 | 관리자가 고객에게 연락함 |
| `confirmed` | 확정 | 방문/화상 상담 일정 확정 |
| `payment_pending` | 결제대기 | 결제 대기 (향후 활용) |
| `payment_completed` | 결제완료 | 결제 완료 |
| `in_progress` | 진행중 | 상담 진행 중 |
| `completed` | 완료 | 상담 완료 |
| `cancelled` | 취소 | 고객/관리자가 취소 |
| `no_show` | 노쇼 | 고객이 나타나지 않음 |

### 상태 전환 규칙

```
pending → contacted → confirmed → in_progress → completed
       ↘ cancelled              ↘ cancelled    ↘ cancelled
                                 ↘ no_show (재확정 가능)
```

---

## 리드 스코어링

### 점수 산정 기준 (최대 7점)

| 조건 | 점수 |
|------|------|
| 메시지 100자 이상 | +2점 |
| 메시지 50-99자 | +1점 |
| 이메일 제공 | +1점 |
| 카테고리 선택 | +1점 |
| 긴급 키워드 포함 | +3점 |

**긴급 키워드**: '긴급', '급함', '빨리', '즉시', '오늘', '내일', '시급'

### 우선순위 표시

| 점수 | 표시 | 설명 |
|------|------|------|
| 5점 이상 | 빨강 | 최우선 처리 |
| 3-4점 | 주황 | 우선 처리 |
| 0-2점 | 회색 | 일반 처리 |

---

## 데이터베이스 스키마

### consultations 테이블

```sql
CREATE TABLE consultations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- 기본 정보
  request_type TEXT NOT NULL,  -- callback, visit, video, info
  status TEXT NOT NULL DEFAULT 'pending',
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  category TEXT,
  message TEXT,

  -- 일정 정보
  preferred_date DATE,
  preferred_time TIME,
  confirmed_date DATE,
  confirmed_time TIME,
  office_location TEXT,  -- 천안, 평택
  video_link TEXT,

  -- 변호사 정보
  preferred_lawyer TEXT,
  assigned_lawyer TEXT,

  -- 관리 정보
  admin_notes TEXT,
  contacted_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,

  -- 마케팅 정보
  source TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  lead_score INTEGER DEFAULT 0
);

-- 인덱스
CREATE INDEX idx_consultations_request_type ON consultations(request_type);
CREATE INDEX idx_consultations_status ON consultations(status);
CREATE INDEX idx_consultations_assigned_lawyer ON consultations(assigned_lawyer);
CREATE INDEX idx_consultations_created_at ON consultations(created_at DESC);
```

---

## API 엔드포인트

### 상담 관리

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/admin/consultations` | 상담 목록 조회 |
| GET | `/api/admin/consultations/stats` | 통계 조회 |
| GET | `/api/admin/consultations/[id]` | 상담 상세 |
| PATCH | `/api/admin/consultations/[id]` | 상담 수정 |
| DELETE | `/api/admin/consultations/[id]` | 상담 삭제 |

### 상담 유입 경로

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/admin/consultation-sources` | 유입 경로 목록 |
| POST | `/api/admin/consultation-sources` | 유입 경로 생성 |
| PATCH | `/api/admin/consultation-sources/[id]` | 유입 경로 수정 |
| DELETE | `/api/admin/consultation-sources/[id]` | 유입 경로 삭제 |

### 상담 가능 시간

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/admin/availability` | 가능 시간 조회 |
| POST | `/api/admin/availability` | 가능 시간 설정 |
| DELETE | `/api/admin/availability/[id]` | 가능 시간 삭제 |

### 쿼리 파라미터 (목록 조회)

```
GET /api/admin/consultations?
  request_type=visit
  &status=pending
  &assigned_lawyer=육심원
  &date_from=2025-01-01
  &date_to=2025-12-31
  &office_location=천안
  &search=홍길동
```

---

## 관리자 페이지

### 경로

| 경로 | 기능 |
|------|------|
| `/admin/consultations` | 상담 목록 및 관리 |
| `/admin/consultations/stats` | 상담 통계 |
| `/admin/settings/sources` | 유입 경로 설정 |

### 기능

**상담 목록 페이지**:
- 통계 대시보드 (상단)
- 검색 및 필터링
- 테이블 뷰 (상태 인라인 변경)
- 상세 모달
- CSV 내보내기

**통계 대시보드**:
- 총 상담 건수 (이번 달)
- 상태별 현황
- 유형별 통계
- 변호사별 담당 현황
- 평균 리드 스코어

---

## 파일 구조

```
theyool-admin/
├── app/
│   ├── admin/
│   │   ├── consultations/
│   │   │   ├── page.tsx          # 상담 목록
│   │   │   └── stats/page.tsx    # 상담 통계
│   │   └── settings/
│   │       └── sources/page.tsx  # 유입 경로 설정
│   └── api/
│       └── admin/
│           ├── consultations/
│           │   ├── route.ts
│           │   ├── [id]/route.ts
│           │   └── stats/route.ts
│           ├── consultation-sources/
│           └── availability/
│
├── components/
│   ├── ConsultationSourceSelector.tsx
│   ├── ConsultationScheduleModal.tsx
│   └── ConsultationActivityTimeline.tsx
│
├── lib/supabase/
│   ├── consultations.ts
│   └── consultation-sources.ts
│
└── types/
    ├── consultation.ts
    └── consultation-source.ts
```

---

## 사용 가이드

### 콜백 요청 처리

1. 테이블에서 상담 클릭 → 상세보기
2. 전화번호 클릭하여 고객에게 전화
3. 통화 후 상태를 '연락완료'로 변경
4. 관리자 메모에 통화 내용 기록
5. 상담 완료 시 상태를 '완료'로 변경

### 방문/화상 상담 처리

1. 상세보기에서 희망 날짜/시간 확인
2. 사무소 일정 확인 후 전화 연결
3. 일정 확정 시 상태를 '확정'으로 변경
4. 담당 변호사 지정
5. 상담 당일: '진행중' → '완료'

### CSV 내보내기

1. "CSV 내보내기" 버튼 클릭
2. 현재 필터 적용된 결과만 내보내기
3. Excel에서 바로 열기 가능 (UTF-8 BOM)
