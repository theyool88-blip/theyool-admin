# 상담 관리 시스템 마이그레이션 분석

**작성일**: 2025-11-23
**작성자**: Backend Specialist
**목적**: 더율(theyool) 프로젝트의 상담 관리 시스템을 theyool-admin으로 이식

---

## 1. 현재 시스템 개요

### 1.1 데이터베이스 구조
- **테이블**: `consultations` (통합 상담 테이블)
- **주요 컬럼**:
  - 기본 정보: `id`, `name`, `phone`, `email`, `category`, `message`
  - 상담 유형: `request_type` ('callback', 'visit', 'video', 'info')
  - 상태: `status` (pending, contacted, confirmed, payment_pending, payment_completed, in_progress, completed, cancelled, no_show)
  - 일정: `preferred_date`, `preferred_time`, `confirmed_date`, `confirmed_time`
  - 사무소: `office_location` ('천안', '평택')
  - 변호사: `preferred_lawyer`, `assigned_lawyer` ('육심원', '임은지')
  - 결제: `consultation_fee`, `payment_method`, `payment_status`, `paid_at`, `payment_transaction_id`
  - 관리: `admin_notes`, `contacted_at`, `confirmed_at`, `completed_at`, `cancelled_at`, `cancellation_reason`
  - 메타데이터: `source`, `utm_source`, `utm_medium`, `utm_campaign`, `lead_score`

### 1.2 기능 구성

#### Frontend (/app/admin/consultations/page.tsx)
- **통계 대시보드**:
  - 총 상담, 대기 중, 처리 중, 완료
  - 이번 달/주/오늘 통계
  - 긴급 상담 수 (🔥 표시)
  - 평균 응답 시간

- **필터링 기능**:
  - 검색: 이름, 전화번호, 메시지 검색
  - 상태 필터: 전체/대기중/처리중/완료
  - 카테고리 필터: 동적으로 카테고리 목록 생성

- **테이블 뷰**:
  - 리드 스코어 (🔥 1-3개로 표시)
  - 날짜/시간, 이름, 연락처, 카테고리, 상태
  - 인라인 상태 변경 (select dropdown)
  - 상세보기 모달

- **리드 스코어링 알고리즘**:
  - 메시지 길이 (50자 이상 +1, 100자 이상 +2)
  - 이메일 제공 (+1)
  - 카테고리 선택 (+1)
  - 긴급 키워드 (+3): '긴급', '급함', '빨리', '즉시', '오늘', '내일', '시급'
  - 최대 점수: 7점

- **상세 모달**:
  - 전체 상담 정보 표시
  - 관리자 메모 (텍스트 영역, blur 시 자동 저장)
  - 전화/이메일 클릭 가능 링크
  - 삭제 기능

- **CSV 내보내기**:
  - 날짜, 이름, 전화번호, 이메일, 카테고리, 상태, 메시지
  - UTF-8 BOM 포함 (Excel 호환)

#### Backend API

##### GET /api/admin/consultations
- **필터 파라미터**:
  - `request_type`: 상담 유형
  - `status`: 상담 상태
  - `assigned_lawyer`: 담당 변호사
  - `date_from`, `date_to`: 날짜 범위
  - `office_location`: 사무소 위치
  - `payment_status`: 결제 상태
  - `search`: 통합 검색 (name, phone, email, message, category)

##### GET /api/admin/consultations/stats
- **통계 데이터**:
  - 전체/대기/연락완료/확정/완료/취소 건수
  - 오늘/이번주/이번달 건수
  - 상담 유형별 건수 (callback, visit, video, info)
  - 상태별 건수
  - 변호사별 건수
  - 총 매출 (consultation_fee 합계)
  - 평균 리드 스코어

##### PATCH /api/admin/consultations/[id]
- **수정 가능 필드**:
  - `status`: 상태 변경
  - `assigned_lawyer`: 담당 변호사 지정
  - `confirmed_date`, `confirmed_time`: 확정 일시
  - `video_link`: 화상 상담 링크
  - `admin_notes`: 관리자 메모
  - `cancellation_reason`: 취소 사유
  - `office_location`: 사무소 위치
  - `consultation_fee`, `payment_method`, `payment_status`, `payment_transaction_id`: 결제 정보
- **TODO**: 상태 변경 시 알림 (SMS/이메일) - 현재 미구현

##### DELETE /api/admin/consultations/[id]
- 상담 삭제 (soft delete 아님)

#### Data Access Layer (lib/supabase/consultations.ts)
- `createConsultation()`: 새 상담 생성 (PUBLIC)
- `getConsultations()`: 필터링된 상담 목록 조회 (ADMIN)
- `getConsultationById()`: 단일 상담 조회 (ADMIN)
- `updateConsultation()`: 상담 정보 수정 (ADMIN)
- `deleteConsultation()`: 상담 삭제 (ADMIN)
- `getConsultationStats()`: 통계 조회 (ADMIN)
- `checkSlotAvailability()`: 예약 시간 중복 확인 (ADMIN)
- `getUpcomingConsultations()`: 오늘/내일 예정된 상담 조회 (ADMIN)

---

## 2. 타입 시스템 (types/consultation.ts)

### 2.1 Discriminated Union 패턴
- 4가지 상담 유형을 discriminated union으로 정의
- TypeScript의 타입 가드를 활용하여 타입 안전성 보장

### 2.2 Type Guards
- `isCallbackConsultation()`, `isVisitConsultation()`, `isVideoConsultation()`, `isInfoConsultation()`
- `isScheduledConsultation()`: 일정이 필요한 상담인지 확인
- `requiresPayment()`, `isPaid()`: 결제 관련 체크

### 2.3 Helper Functions
- `formatPhoneNumber()`: 전화번호 포맷 (010-XXXX-XXXX)
- `formatDateKorean()`: 날짜 한글 포맷 (YYYY년 MM월 DD일)
- `formatTimeKorean()`: 시간 한글 포맷 (오전/오후 HH:MM)
- `getNextStatuses()`: 상태 전환 워크플로우 정의
- `isValidStatusTransition()`: 상태 전환 유효성 검증

### 2.4 Display Constants
- `REQUEST_TYPE_LABELS`, `REQUEST_TYPE_COLORS`: 상담 유형 표시
- `STATUS_LABELS`, `STATUS_COLORS`: 상태 표시
- `OFFICE_LOCATIONS`, `LAWYER_NAMES`: 선택 옵션
- `CONSULTATION_CATEGORIES`: 상담 카테고리 목록

---

## 3. 개선 사항 제안

### 3.1 보안
- ✅ 인증 체크: 모든 관리자 API에 `getSession()` 체크 존재
- ⚠️ CSRF 보호: Next.js의 기본 CSRF 보호에 의존 (명시적 토큰 없음)
- ✅ SQL Injection 방지: Supabase Query Builder 사용으로 방지
- ⚠️ Rate Limiting: 현재 미구현
- ⚠️ Input Validation: Zod 스키마 미사용 (관리자 신뢰 가정)

### 3.2 성능
- ⚠️ N+1 문제: 통계 계산 시 전체 데이터 조회 (개선 필요)
- ⚠️ 캐싱: 통계 데이터 캐싱 없음
- ⚠️ 페이지네이션: 무한 스크롤/페이지네이션 없음
- ✅ 인덱스: `status`, `assigned_lawyer`, `scheduled_date` 등 필수 인덱스 존재

### 3.3 UX 개선
- ⚠️ 실시간 업데이트: WebSocket/polling 없음 (수동 새로고침)
- ⚠️ 알림 시스템: 상태 변경 시 SMS/이메일 알림 미구현 (TODO 주석만 존재)
- ✅ CSV 내보내기: Excel 호환 (UTF-8 BOM)
- ⚠️ 일괄 작업: 여러 상담 동시 처리 기능 없음
- ⚠️ 정렬: 테이블 컬럼 정렬 기능 없음

### 3.4 비즈니스 로직
- ⚠️ 상태 전환 검증: `isValidStatusTransition()` 정의되어 있으나 API에서 미사용
- ⚠️ 예약 시간 중복 방지: `checkSlotAvailability()` 존재하나 프론트엔드에서 미호출
- ✅ 리드 스코어링: 알고리즘 구현되어 있음 (긴급도 자동 판단)
- ⚠️ 사건 전환: `converted_to_case_id` 컬럼 존재하나 UI 없음

---

## 4. theyool-admin 이식 계획

### 4.1 디렉토리 구조
```
theyool-admin/
├── app/
│   ├── admin/
│   │   └── consultations/
│   │       └── page.tsx          # 상담 목록 페이지
│   └── api/
│       └── admin/
│           └── consultations/
│               ├── route.ts       # GET (목록)
│               ├── [id]/
│               │   └── route.ts   # GET/PATCH/DELETE (단일)
│               └── stats/
│                   └── route.ts   # GET (통계)
├── lib/
│   └── supabase/
│       └── consultations.ts       # 데이터 액세스 레이어
├── types/
│   └── consultation.ts            # 타입 정의
└── components/
    └── consultations/
        ├── ConsultationTable.tsx  # 테이블 컴포넌트 (분리)
        ├── ConsultationFilters.tsx # 필터 컴포넌트 (분리)
        ├── ConsultationStats.tsx  # 통계 카드 (분리)
        └── ConsultationDetailModal.tsx # 상세 모달 (분리)
```

### 4.2 개선 사항 적용
1. **컴포넌트 분리**: 550줄의 단일 파일을 4-5개 컴포넌트로 분리
2. **Zod 검증 추가**: API 입력값 검증 (관리자라도 타입 안전성 유지)
3. **페이지네이션 추가**: 대량 데이터 처리 대비
4. **정렬 기능 추가**: 테이블 헤더 클릭으로 정렬
5. **일괄 작업 추가**: 체크박스로 여러 상담 동시 처리
6. **실시간 통계**: 자동 갱신 (30초마다)
7. **알림 시스템 준비**: SMS/이메일 알림 인터페이스 구현
8. **사건 전환 UI**: 상담을 사건으로 전환하는 버튼 추가

### 4.3 마이그레이션 체크리스트
- [ ] 타입 정의 복사 및 검증 (types/consultation.ts)
- [ ] Supabase 데이터 액세스 레이어 복사 (lib/supabase/consultations.ts)
- [ ] API 라우트 복사 (route.ts, [id]/route.ts, stats/route.ts)
- [ ] 관리자 페이지 복사 및 리팩토링 (page.tsx)
- [ ] 컴포넌트 분리 (Table, Filters, Stats, DetailModal)
- [ ] Zod 스키마 추가
- [ ] 페이지네이션 구현
- [ ] 정렬 기능 구현
- [ ] 일괄 작업 구현
- [ ] 통합 테스트

---

## 5. 코드 품질 평가

### 5.1 강점
- ✅ TypeScript 타입 안전성: Discriminated union, type guards 활용
- ✅ 명확한 책임 분리: API → Service Layer → DB
- ✅ RESTful API 설계: 명확한 엔드포인트 구조
- ✅ 에러 핸들링: try-catch 블록 및 사용자 친화적 메시지
- ✅ 리드 스코어링: 비즈니스 로직이 명확하게 구현됨
- ✅ CSV 내보내기: Excel 호환성 고려 (UTF-8 BOM)

### 5.2 약점
- ⚠️ 코드 중복: 프론트엔드에 모든 로직이 단일 파일에 집중
- ⚠️ 성능 최적화 부족: 통계 계산 시 전체 데이터 조회
- ⚠️ 입력 검증 부족: Zod 스키마 미사용
- ⚠️ 테스트 부재: 단위 테스트/통합 테스트 없음
- ⚠️ 알림 미구현: TODO 주석만 존재
- ⚠️ 접근성: 키보드 내비게이션, ARIA 속성 부족

### 5.3 보안 등급
- **전체 등급**: B+ (안전하나 개선 여지 있음)
- **인증**: A (모든 관리자 API에 세션 체크)
- **SQL Injection**: A (Query Builder 사용)
- **XSS**: B (React의 자동 이스케이프에 의존)
- **CSRF**: B (Next.js 기본 보호에 의존)
- **Rate Limiting**: C (미구현)

---

## 6. 추천 개선 사항

### 6.1 즉시 적용 가능
1. **컴포넌트 분리**: 가독성 및 유지보수성 향상
2. **Zod 검증**: 타입 안전성 강화
3. **페이지네이션**: 성능 개선
4. **정렬 기능**: UX 개선

### 6.2 중기 계획
1. **알림 시스템**: SMS/이메일 자동 발송
2. **실시간 업데이트**: WebSocket 또는 polling
3. **사건 전환 UI**: 상담 → 사건 워크플로우
4. **통계 캐싱**: Redis 등 캐싱 레이어 추가

### 6.3 장기 계획
1. **Analytics 통합**: Google Analytics, Mixpanel 등
2. **A/B 테스팅**: 상담 전환율 개선
3. **AI 리드 스코어링**: 머신러닝 기반 우선순위 판단
4. **CRM 통합**: Salesforce, HubSpot 등 연동

---

## 7. 결론

더율 프로젝트의 상담 관리 시스템은 **견고한 기반**을 가지고 있으며, **타입 안전성**과 **명확한 구조**가 장점입니다.

theyool-admin으로 이식 시:
1. 기존 코드 99% 재사용 가능
2. 컴포넌트 분리로 가독성 향상
3. 페이지네이션/정렬/일괄작업으로 관리 효율성 증대
4. Zod 검증 추가로 안정성 강화

**예상 작업 시간**: 3-4시간
**복잡도**: 중 (코드 품질이 좋아 이식 난이도 낮음)
**리스크**: 낮음 (같은 Supabase 프로젝트 사용, 데이터 호환성 보장)
