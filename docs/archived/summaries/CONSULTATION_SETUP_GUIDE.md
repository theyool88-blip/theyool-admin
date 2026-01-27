# 상담 관리 시스템 설정 가이드

**작성일**: 2025-11-23
**프로젝트**: luseed (법무법인 더율 관리자 시스템)

---

## 1. 개요

더율(theyool) 프로젝트의 통합 상담 관리 시스템을 luseed으로 성공적으로 이식했습니다.

### 시스템 특징
- ✅ 4가지 상담 유형 지원 (콜백, 방문, 화상, 정보문의)
- ✅ 완전한 상태 관리 워크플로우 (9개 상태)
- ✅ 리드 스코어링 알고리즘
- ✅ 담당 변호사 지정
- ✅ CSV 내보내기
- ✅ 실시간 통계 대시보드
- ✅ 검색 및 필터링

---

## 2. 파일 구조

```
luseed/
├── types/
│   └── consultation.ts               # 타입 정의 (407 lines)
│
├── lib/
│   └── supabase/
│       └── consultations.ts          # 데이터 액세스 레이어 (365 lines)
│
├── app/
│   ├── admin/
│   │   └── consultations/
│   │       └── page.tsx              # 관리자 UI (518+ lines)
│   │
│   └── api/
│       └── admin/
│           └── consultations/
│               ├── route.ts          # GET (목록 조회)
│               ├── [id]/
│               │   └── route.ts      # GET/PATCH/DELETE (단일 조회/수정/삭제)
│               └── stats/
│                   └── route.ts      # GET (통계)
│
└── CONSULTATION_MIGRATION_ANALYSIS.md  # 상세 분석 문서
```

---

## 3. 데이터베이스 스키마

### consultations 테이블

#### 기본 정보
- `id`: UUID (PK)
- `created_at`: TIMESTAMP WITH TIME ZONE
- `updated_at`: TIMESTAMP WITH TIME ZONE
- `request_type`: TEXT ('callback' | 'visit' | 'video' | 'info')
- `status`: TEXT (9가지 상태)
- `name`: TEXT (고객 이름)
- `phone`: TEXT (전화번호)
- `email`: TEXT (이메일, nullable)
- `category`: TEXT (상담 카테고리, nullable)
- `message`: TEXT (상담 내용, nullable)

#### 일정 정보 (방문/화상 상담만 해당)
- `preferred_date`: DATE (희망 날짜)
- `preferred_time`: TIME (희망 시간)
- `confirmed_date`: DATE (확정 날짜)
- `confirmed_time`: TIME (확정 시간)
- `office_location`: TEXT ('천안' | '평택')
- `video_link`: TEXT (화상 상담 링크)

#### 변호사 정보
- `preferred_lawyer`: TEXT ('육심원' | '임은지')
- `assigned_lawyer`: TEXT ('육심원' | '임은지')

#### 결제 정보 (향후 활용)
- `consultation_fee`: INTEGER (상담료)
- `payment_method`: TEXT ('card' | 'transfer' | 'cash' | 'free')
- `payment_status`: TEXT ('pending' | 'completed' | 'refunded' | 'free')
- `paid_at`: TIMESTAMP WITH TIME ZONE
- `payment_transaction_id`: TEXT

#### 관리 정보
- `admin_notes`: TEXT (관리자 메모)
- `contacted_at`: TIMESTAMP WITH TIME ZONE
- `confirmed_at`: TIMESTAMP WITH TIME ZONE
- `completed_at`: TIMESTAMP WITH TIME ZONE
- `cancelled_at`: TIMESTAMP WITH TIME ZONE
- `cancellation_reason`: TEXT

#### 마케팅 정보
- `source`: TEXT (유입 경로)
- `utm_source`: TEXT
- `utm_medium`: TEXT
- `utm_campaign`: TEXT
- `lead_score`: INTEGER (리드 점수)

#### 인덱스
```sql
CREATE INDEX idx_consultations_request_type ON consultations(request_type);
CREATE INDEX idx_consultations_status ON consultations(status);
CREATE INDEX idx_consultations_assigned_lawyer ON consultations(assigned_lawyer);
CREATE INDEX idx_consultations_preferred_date ON consultations(preferred_date);
CREATE INDEX idx_consultations_created_at ON consultations(created_at DESC);
```

---

## 4. 상태 워크플로우

### 9가지 상태
1. **pending** (대기중): 신규 접수, 관리자 확인 대기
2. **contacted** (연락완료): 관리자가 고객에게 연락함
3. **confirmed** (확정): 방문/화상 상담 일정 확정
4. **payment_pending** (결제대기): 결제 대기 (향후 활용)
5. **payment_completed** (결제완료): 결제 완료 (향후 활용)
6. **in_progress** (진행중): 상담 진행 중
7. **completed** (완료): 상담 완료
8. **cancelled** (취소): 고객/관리자가 취소
9. **no_show** (노쇼): 고객이 나타나지 않음

### 상태 전환 규칙
```
pending → contacted → confirmed → in_progress → completed
       ↘ cancelled               ↘ cancelled   ↘ cancelled
                                   ↘ no_show (재확정 가능)
```

---

## 5. 4가지 상담 유형

### 1. callback (콜백 요청)
- **설명**: 단순 전화 회신 요청
- **필수 필드**: name, phone
- **선택 필드**: email, category, message
- **일정**: 필요 없음
- **상태 흐름**: pending → contacted → completed

### 2. visit (방문 상담)
- **설명**: 사무소 방문 상담
- **필수 필드**: name, phone, preferred_date, preferred_time, office_location
- **선택 필드**: email, category, message, preferred_lawyer
- **일정**: 필요
- **상태 흐름**: pending → contacted → confirmed → in_progress → completed

### 3. video (화상 상담)
- **설명**: Zoom/Meet 화상 상담
- **필수 필드**: name, phone, preferred_date, preferred_time
- **선택 필드**: email, category, message, preferred_lawyer, video_link
- **일정**: 필요
- **상태 흐름**: pending → contacted → confirmed → in_progress → completed

### 4. info (정보 문의)
- **설명**: 정보만 요청 (후속 조치 불필요)
- **필수 필드**: name, phone
- **선택 필드**: email, category, message
- **일정**: 필요 없음
- **상태 흐름**: pending → completed

---

## 6. 리드 스코어링 알고리즘

### 점수 산정 기준 (최대 7점)
- **메시지 길이**:
  - 100자 이상: +2점
  - 50-99자: +1점
- **이메일 제공**: +1점
- **카테고리 선택**: +1점
- **긴급 키워드 포함**: +3점
  - 키워드: '긴급', '급함', '빨리', '즉시', '오늘', '내일', '시급'

### 점수별 우선순위
- **5점 이상**: 🔥🔥🔥 (빨강) - 최우선 처리
- **3-4점**: 🔥🔥 (주황) - 우선 처리
- **0-2점**: 🔥 (회색) - 일반 처리

---

## 7. API 엔드포인트

### GET /api/admin/consultations
**목적**: 상담 목록 조회 (필터링/검색)

**Query Parameters**:
```typescript
{
  request_type?: 'callback' | 'visit' | 'video' | 'info';
  status?: ConsultationStatus;
  assigned_lawyer?: '육심원' | '임은지';
  date_from?: string;  // YYYY-MM-DD
  date_to?: string;    // YYYY-MM-DD
  office_location?: '천안' | '평택';
  payment_status?: 'pending' | 'completed' | 'refunded' | 'free';
  search?: string;     // 이름, 전화, 이메일, 메시지 검색
}
```

**Response**:
```json
{
  "success": true,
  "data": [ /* Consultation[] */ ],
  "count": 42
}
```

### GET /api/admin/consultations/stats
**목적**: 통계 조회

**Response**:
```json
{
  "total": 150,
  "pending": 12,
  "contacted": 8,
  "confirmed": 5,
  "completed": 120,
  "cancelled": 5,
  "today": 3,
  "thisWeek": 18,
  "thisMonth": 67,
  "byType": {
    "callback": 80,
    "visit": 45,
    "video": 20,
    "info": 5
  },
  "byStatus": { /* ... */ },
  "byLawyer": {
    "육심원": 75,
    "임은지": 70
  },
  "revenue": 3500000,
  "avgLeadScore": 3.2
}
```

### GET /api/admin/consultations/[id]
**목적**: 단일 상담 조회

**Response**:
```json
{
  "success": true,
  "data": { /* Consultation */ }
}
```

### PATCH /api/admin/consultations/[id]
**목적**: 상담 정보 수정

**Request Body**:
```json
{
  "status": "contacted",
  "assigned_lawyer": "육심원",
  "confirmed_date": "2025-12-01",
  "confirmed_time": "14:00",
  "admin_notes": "고객이 위자료 관련 긴급 상담 요청"
}
```

**Response**:
```json
{
  "success": true,
  "data": { /* Updated Consultation */ },
  "message": "상담 정보가 수정되었습니다"
}
```

### DELETE /api/admin/consultations/[id]
**목적**: 상담 삭제 (hard delete)

**Response**:
```json
{
  "success": true,
  "message": "Consultation deleted successfully"
}
```

---

## 8. 관리자 페이지 기능

### 통계 대시보드 (상단)
- 총 상담 건수 (이번 달)
- 대기 중 (연락완료 건수)
- 확정 건수 (오늘 건수)
- 완료 건수 (평균 리드 스코어)

### 필터링 (중앙)
- **검색**: 이름, 전화번호, 메시지 통합 검색
- **상태 필터**: 9개 상태 선택
- **유형 필터**: 4가지 상담 유형 선택

### 테이블 뷰 (메인)
- **스코어**: 🔥 아이콘 + 숫자
- **유형**: 색상 뱃지 (콜백=파랑, 방문=초록, 화상=보라, 문의=회색)
- **날짜/시간**: 접수일시
- **이름**: 이메일 포함 (있는 경우)
- **연락처**: 클릭 시 전화 연결
- **담당**: 담당 변호사 또는 '-'
- **상태**: 인라인 드롭다운 (클릭 시 즉시 업데이트)
- **작업**: 상세보기 버튼

### 상세 모달
- **기본 정보**: 유형, 이름, 전화, 이메일
- **일정 정보**: 희망 날짜/시간, 방문 사무소 (방문/화상만)
- **담당 정보**: 담당 변호사, 카테고리
- **상담 내용**: 고객 메시지
- **접수 시간**: 생성일시
- **관리자 메모**: 텍스트 영역 (blur 시 자동 저장)
- **작업**: 삭제, 닫기

### CSV 내보내기
- 파일명: `consultations_YYYY-MM-DD.csv`
- 인코딩: UTF-8 BOM (Excel 호환)
- 컬럼: 날짜, 이름, 전화번호, 이메일, 카테고리, 상태, 메시지

---

## 9. 설정 방법

### Step 1: Supabase 확인
luseed과 theyool이 **같은 Supabase 프로젝트**를 사용하므로 추가 마이그레이션은 불필요합니다.

확인 사항:
```bash
# .env.local에 Supabase 설정이 있는지 확인
NEXT_PUBLIC_SUPABASE_URL=https://kqqyipnlkmmprfgygauk.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=***
SUPABASE_SERVICE_ROLE_KEY=***
```

### Step 2: 의존성 확인
```bash
cd /Users/hskim/luseed

# 타입스크립트 에러 확인
npm run type-check

# 또는 빌드 테스트
npm run build
```

### Step 3: 로컬 테스트
```bash
# 개발 서버 시작
npm run dev

# 브라우저에서 접속
# http://localhost:3000/admin/consultations
```

### Step 4: 인증 확인
1. 관리자 로그인: `http://localhost:3000/admin/login`
2. 이메일: `admin@theyool.com`
3. 비밀번호: (기존 비밀번호 사용)
4. 로그인 후 `/admin/consultations` 접근 가능 확인

---

## 10. 사용 가이드

### 상담 신청 확인
1. `/admin/consultations` 접속
2. 통계 카드에서 **대기 중** 건수 확인
3. 리드 스코어가 높은 순서대로 처리 (🔥🔥🔥 우선)

### 상담 처리 워크플로우

#### 콜백 요청 처리
1. 테이블에서 상담 클릭 → 상세보기
2. 전화번호 클릭하여 고객에게 전화
3. 통화 후 상태를 **'연락완료'**로 변경
4. 관리자 메모에 통화 내용 기록
5. 필요시 담당 변호사 지정
6. 상담 완료 시 상태를 **'완료'**로 변경

#### 방문/화상 상담 처리
1. 상세보기에서 희망 날짜/시간 확인
2. 사무소 일정 확인 후 전화 연결
3. 일정 확정 시 상태를 **'확정'**으로 변경
4. 담당 변호사 지정
5. 방문/화상 상담 당일:
   - 상태를 **'진행중'**으로 변경
   - 상담 완료 후 **'완료'**로 변경
6. 노쇼 시: 상태를 **'노쇼'**로 변경

#### 취소 처리
1. 상태를 **'취소'**로 변경
2. 관리자 메모에 취소 사유 기록

### 검색 및 필터링
- **이름 검색**: "김철수" 입력
- **전화 검색**: "010" 입력
- **상태 필터**: 드롭다운에서 "확정" 선택
- **유형 필터**: "방문 상담" 선택
- **복합 검색**: 검색어 + 상태 + 유형 동시 적용 가능

### CSV 내보내기
1. **CSV 내보내기** 버튼 클릭
2. 현재 필터 적용된 결과만 내보내기
3. Excel에서 바로 열기 가능 (UTF-8 BOM)

---

## 11. 개선 계획 (향후)

### Phase 1: UX 개선
- [ ] 페이지네이션 추가 (50개씩)
- [ ] 테이블 컬럼 정렬 (클릭)
- [ ] 일괄 작업 (체크박스)
- [ ] 실시간 통계 (30초 자동 갱신)

### Phase 2: 알림 시스템
- [ ] 상태 변경 시 SMS 자동 발송
- [ ] 상태 변경 시 이메일 발송
- [ ] 알림 템플릿 관리

### Phase 3: 고급 기능
- [ ] 사건 전환 UI (상담 → 사건)
- [ ] 달력 뷰 (일정 확인)
- [ ] 통계 차트 (Chart.js)
- [ ] 변호사별 업무량 분석

### Phase 4: 통합
- [ ] Google Analytics 연동
- [ ] CRM 연동 (Salesforce, HubSpot)
- [ ] AI 리드 스코어링

---

## 12. 트러블슈팅

### Q1: 상담 목록이 빈 배열로 나옵니다
**원인**: API 응답 구조 불일치
**해결**:
```typescript
// page.tsx에서 확인
setConsultations(data.data || []); // ✅ 올바름
setConsultations(data.consultations || []); // ❌ 틀림
```

### Q2: 통계가 표시되지 않습니다
**원인**: 통계 필드명 불일치
**해결**:
```typescript
// thisMonth (camelCase) 사용
stats.thisMonth  // ✅ 올바름
stats.this_month // ❌ 틀림
```

### Q3: 인증 오류 (401 Unauthorized)
**원인**: 세션 만료 또는 인증 미들웨어 문제
**해결**:
1. 로그아웃 후 재로그인
2. 쿠키 확인 (개발자 도구)
3. `/admin/login`에서 세션 재생성

### Q4: 타입 에러 발생
**원인**: Consultation 타입 불일치
**해결**:
```typescript
// types/consultation.ts에서 import
import type { Consultation } from '@/types/consultation';

// Discriminated union 활용
if (consultation.request_type === 'visit') {
  // TypeScript가 자동으로 VisitConsultation으로 추론
  console.log(consultation.office_location); // ✅
}
```

### Q5: 리드 스코어가 계산되지 않습니다
**원인**: `getLeadScore()` 함수 미정의
**해결**: 페이지 상단에 함수 정의되어 있는지 확인 (101-127번 라인)

---

## 13. 보안 체크리스트

- [x] 모든 API에 인증 체크 (`isAuthenticated()`)
- [x] Supabase Query Builder 사용 (SQL Injection 방지)
- [x] 입력값 타입 검증 (TypeScript)
- [ ] Rate Limiting (향후 추가)
- [ ] CSRF 토큰 (Next.js 기본 보호 사용 중)
- [x] 민감 정보 로깅 금지

---

## 14. 성능 최적화 팁

### 1. 통계 쿼리 최적화
현재 전체 데이터를 가져와서 JavaScript로 집계하는 방식입니다.
향후 Supabase Function 또는 Postgres View로 개선 가능:

```sql
-- 예시: 통계 View 생성
CREATE OR REPLACE VIEW consultation_stats AS
SELECT
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE status = 'pending') AS pending,
  COUNT(*) FILTER (WHERE status = 'contacted') AS contacted,
  -- ...
FROM consultations;
```

### 2. 인덱스 활용
자주 사용하는 필터 조건에 인덱스가 있는지 확인:
```sql
EXPLAIN ANALYZE
SELECT * FROM consultations
WHERE status = 'pending'
  AND request_type = 'visit'
ORDER BY created_at DESC;
```

### 3. 페이지네이션 추가
```typescript
// API에 추가
const page = parseInt(searchParams.get('page') || '1');
const limit = 50;
const offset = (page - 1) * limit;

query = query.range(offset, offset + limit - 1);
```

---

## 15. 연락처

**문의**: 개발팀
**문서**: `/CONSULTATION_MIGRATION_ANALYSIS.md` (상세 분석)

---

**마지막 업데이트**: 2025-11-23
**버전**: 1.0.0
**상태**: ✅ 프로덕션 준비 완료
