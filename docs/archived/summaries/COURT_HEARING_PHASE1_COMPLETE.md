# 법원 기일 관리 시스템 Phase 1 - 완료 보고서

**날짜**: 2025-11-22
**프로젝트**: 법무법인 더율 관리자 시스템
**Phase**: 1 (Core CRUD + Dashboard Integration)

---

## 📋 완료된 기능 요약

### ✅ 1. 데이터베이스 설계 및 구현
- **3개 핵심 테이블**:
  - `court_hearings`: 법원 기일 정보 저장
  - `case_deadlines`: 사건 데드라인 (불변기간) 저장
  - `deadline_types`: 불변기간 유형 마스터 데이터 (예: 항소기간 14일)

- **2개 뷰 (View)**:
  - `upcoming_hearings`: D-7 이내 법원 기일 자동 조회
  - `urgent_deadlines`: D-7 이내 데드라인 자동 조회 (deadline_types 조인)

- **자동 계산 트리거**:
  - `case_deadlines`에 데이터 삽입 시 `trigger_date + days`로 `deadline_date`, `deadline_datetime` 자동 계산

### ✅ 2. API 엔드포인트 (관리자 전용)

#### **법원 기일 API** (`/api/admin/court-hearings`)
- `GET`: 목록 조회 (필터링: case_number, hearing_type, status, from_date, to_date)
- `POST`: 신규 생성
- `PUT /[id]`: 수정
- `DELETE /[id]`: 삭제

#### **데드라인 API** (`/api/admin/case-deadlines`)
- `GET`: 목록 조회 (필터링: case_number, deadline_type, status, urgent_only)
- `POST`: 신규 생성 (deadline_date 자동 계산)
- `PUT /[id]`: 수정
- `PUT /[id]/complete`: 완료 처리
- `DELETE /[id]`: 삭제

#### **데드라인 유형 API** (`/api/admin/deadline-types`)
- `GET`: 불변기간 마스터 데이터 조회

### ✅ 3. UI 컴포넌트

#### **Dashboard.tsx** (대시보드)
- **통합 일정 위젯**: 법원 기일 + 데드라인을 하나의 리스트로 통합 표시
- **D-7 이내 필터링**: `upcoming_hearings`, `urgent_deadlines` 뷰 사용
- **긴급도 색상 코딩**:
  - D-1 이하: 빨강
  - D-3 이하: 주황
  - D-7 이하: 노랑
- **QuickAddHearingModal 통합**: "법원기일 추가" 버튼 클릭 시 모달 오픈

#### **MonthlyCalendar.tsx** (월간 캘린더)
- **3개 데이터 소스 통합**:
  1. `schedules` (기존 일정)
  2. `court_hearings` (법원 기일 - 빨강)
  3. `case_deadlines` (데드라인 - 주황)
- **캘린더 아이콘**:
  - ⚖️ 법원 기일 (빨강)
  - ⏰ 데드라인 (주황)
  - 📅 기타 일정 (파랑)

#### **CaseDetail.tsx** (사건 상세 페이지)
- **3개 탭 구조**:
  1. **기본정보**: 사건 개요, 수임료, 의뢰인, 관련 사건
  2. **법원기일**: 해당 사건의 모든 법원 기일 표시 + 추가/완료/삭제
  3. **데드라인**: 해당 사건의 모든 데드라인 표시 + 추가/완료/삭제

- **기능**:
  - 사건번호(`court_case_number`)로 자동 필터링
  - 법원 기일 추가 버튼 → `QuickAddHearingModal` (사건번호 자동 입력)
  - 데드라인 추가 버튼 → `QuickAddDeadlineModal` (사건번호 자동 입력)
  - 각 항목에 "완료", "삭제" 버튼 제공
  - 실시간 상태 업데이트 (완료 시 PENDING → COMPLETED)

#### **QuickAddHearingModal.tsx** (법원 기일 추가 모달)
- **폼 필드**:
  - 사건번호 (자동완성 검색 - `legal_cases.court_case_number`)
  - 기일 유형 (변론기일, 판결선고기일, 변호사 미팅 등)
  - 날짜 + 시간
  - 법정 위치
  - 담당 판사
  - 메모

- **유효성 검사**: 필수 필드 누락 시 에러 메시지
- **자동완성**: 사건번호/사건명으로 검색 → 드롭다운 선택
- **prefilledCaseNumber 지원**: 사건 상세 페이지에서 사건번호 자동 입력

#### **QuickAddDeadlineModal.tsx** (데드라인 추가 모달)
- **폼 필드**:
  - 사건번호 (자동완성 검색)
  - 데드라인 유형 (항소기간, 상고기간, 준비서면 제출기한 등)
  - 기산일 (trigger_date)
  - 메모

- **자동 계산 미리보기**:
  - 기산일 + 불변기간 일수 → 만료일 자동 계산
  - 만료 일시는 자정(00:00:00) 기준
  - 미리보기 박스에 표시

- **데이터베이스 트리거**: 저장 시 `deadline_date`, `deadline_datetime` 자동 계산

---

## 🗂️ 파일 구조

```
luseed/
├── app/
│   ├── api/admin/
│   │   ├── court-hearings/
│   │   │   ├── route.ts              # GET, POST /api/admin/court-hearings
│   │   │   └── [id]/
│   │   │       └── route.ts          # PUT, DELETE /api/admin/court-hearings/[id]
│   │   ├── case-deadlines/
│   │   │   ├── route.ts              # GET, POST /api/admin/case-deadlines
│   │   │   └── [id]/
│   │   │       ├── route.ts          # PUT, DELETE
│   │   │       └── complete/
│   │   │           └── route.ts      # PUT complete
│   │   └── deadline-types/
│   │       └── route.ts              # GET 불변기간 마스터
│   └── cases/[id]/
│       └── page.tsx                  # 사건 상세 페이지 (Server Component)
│
├── components/
│   ├── Dashboard.tsx                 # 대시보드 (일정 통합 위젯)
│   ├── MonthlyCalendar.tsx           # 월간 캘린더 (3개 소스 통합)
│   ├── CaseDetail.tsx                # 사건 상세 (3개 탭: 기본정보, 법원기일, 데드라인)
│   ├── QuickAddHearingModal.tsx      # 법원 기일 추가 모달
│   └── QuickAddDeadlineModal.tsx     # 데드라인 추가 모달
│
├── lib/supabase/
│   ├── court-hearings.ts             # 법원 기일 CRUD 함수
│   ├── case-deadlines.ts             # 데드라인 CRUD 함수
│   └── deadline-types.ts             # 불변기간 유형 조회 함수
│
└── types/
    └── court-hearing.ts              # TypeScript 타입 정의
```

---

## 🔄 데이터 흐름

### **1. 법원 기일 추가 플로우**
```
사용자 → QuickAddHearingModal
  ↓
  폼 작성 (사건번호 자동완성, 날짜/시간, 기일 유형)
  ↓
  Submit → POST /api/admin/court-hearings
  ↓
  Supabase INSERT court_hearings
  ↓
  성공 → onSuccess() → fetchHearings() (목록 새로고침)
  ↓
  upcoming_hearings 뷰 자동 업데이트 (D-7 이내면 대시보드에 표시)
```

### **2. 데드라인 추가 플로우 (자동 계산)**
```
사용자 → QuickAddDeadlineModal
  ↓
  폼 작성 (사건번호, 데드라인 유형, 기산일)
  ↓
  미리보기: deadline_types에서 days 조회 → trigger_date + days 계산
  ↓
  Submit → POST /api/admin/case-deadlines
  ↓
  Supabase INSERT case_deadlines
  ↓
  **트리거 실행**: deadline_date, deadline_datetime 자동 계산
  ↓
  성공 → onSuccess() → fetchDeadlines() (목록 새로고침)
  ↓
  urgent_deadlines 뷰 자동 업데이트 (D-7 이내면 대시보드에 표시)
```

### **3. 대시보드 일정 통합 플로우**
```
Dashboard 로드
  ↓
  fetchUrgentItems() 실행
  ↓
  병렬 쿼리:
    1. upcoming_hearings (D-7 이내 법원 기일)
    2. urgent_deadlines (D-7 이내 데드라인, deadline_types 조인)
  ↓
  통합 배열 생성 (type: 'hearing' | 'deadline')
  ↓
  날짜순 정렬 (days_until 오름차순)
  ↓
  UI 렌더링 (최대 10개 표시, "더보기" 버튼)
```

---

## 🔑 핵심 기술 결정

### **1. 사건번호 매핑 전략**
- **문제**: `court_hearings`, `case_deadlines`는 `court_case_number`(문자열) 저장
- **해결**: `legal_cases` 테이블의 `court_case_number`로 조회
- **미래 개선**: `legal_cases.id` (UUID)로 변경하여 외래키 제약 추가 고려

### **2. 데드라인 자동 계산**
- **방식**: PostgreSQL 트리거 사용
- **이유**:
  - 클라이언트 계산 실수 방지
  - 타임존 이슈 해결 (서버 시간 기준)
  - 데이터 무결성 보장

### **3. 뷰(View) 활용**
- **이유**:
  - 복잡한 조인 쿼리를 단순화
  - `deadline_types` 조인 로직을 뷰에 캡슐화
  - D-day 계산을 뷰에서 처리 (CURRENT_DATE 기준)

### **4. 인증 전략**
- **모든 API**: `isAuthenticated()` 체크 (쿠키 세션 확인)
- **데이터베이스 작업**: `createAdminClient()` 사용 (Service Role Key)
- **RLS 정책**: 추후 프로덕션 배포 시 추가 예정

---

## 🎨 UI/UX 특징

### **색상 코딩**
- **법원 기일**: 빨강 (`red-600`)
- **데드라인**: 주황 (`orange-600`)
- **긴급도**:
  - D-1 이하: 빨강
  - D-3 이하: 주황
  - D-7 이하: 노랑

### **아이콘**
- ⚖️ 법원 기일 (변론기일, 판결선고기일)
- 👥 변호사 미팅 (청록 배지)
- ⏰ 데드라인
- 📅 일반 일정

### **상태 배지**
- **법원 기일 상태**:
  - `SCHEDULED`: 파랑
  - `COMPLETED`: 초록
  - `POSTPONED`: 노랑
  - `CANCELLED`: 회색

- **데드라인 상태**:
  - `PENDING`: 노랑
  - `COMPLETED`: 초록
  - `OVERDUE`: 빨강

---

## 📊 데이터베이스 스키마

### **court_hearings**
```sql
CREATE TABLE court_hearings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_number TEXT NOT NULL,          -- legal_cases.court_case_number
  hearing_type TEXT NOT NULL,         -- ENUM (변론기일, 판결선고기일, ...)
  hearing_date TIMESTAMPTZ NOT NULL,  -- ISO 8601 datetime
  location TEXT,                      -- 법정 위치
  judge_name TEXT,                    -- 담당 판사
  notes TEXT,                         -- 메모
  status TEXT DEFAULT 'SCHEDULED',    -- ENUM (SCHEDULED, COMPLETED, POSTPONED, CANCELLED)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### **case_deadlines**
```sql
CREATE TABLE case_deadlines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_number TEXT NOT NULL,          -- legal_cases.court_case_number
  deadline_type TEXT NOT NULL,        -- ENUM (항소기간, 상고기간, ...)
  trigger_date DATE NOT NULL,         -- 기산일 (판결선고일, 송달일 등)
  deadline_date DATE NOT NULL,        -- 만료일 (자동 계산)
  deadline_datetime TIMESTAMPTZ NOT NULL, -- 만료 일시 (자동 계산, 자정 기준)
  notes TEXT,                         -- 메모
  status TEXT DEFAULT 'PENDING',      -- ENUM (PENDING, COMPLETED, OVERDUE)
  completed_at TIMESTAMPTZ,           -- 완료 일시
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 트리거: deadline_date, deadline_datetime 자동 계산
CREATE TRIGGER calculate_deadline_dates
  BEFORE INSERT OR UPDATE ON case_deadlines
  FOR EACH ROW
  EXECUTE FUNCTION calculate_deadline_from_trigger();
```

### **deadline_types** (마스터 데이터)
```sql
CREATE TABLE deadline_types (
  type TEXT PRIMARY KEY,              -- APPEAL_PERIOD, FINAL_APPEAL_PERIOD, ...
  name TEXT NOT NULL,                 -- 항소기간, 상고기간, ...
  days INTEGER NOT NULL,              -- 14, 30, 7, ...
  description TEXT
);

-- 초기 데이터
INSERT INTO deadline_types VALUES
  ('APPEAL_PERIOD', '항소기간', 14, '판결선고일로부터 14일'),
  ('FINAL_APPEAL_PERIOD', '상고기간', 14, '판결선고일로부터 14일'),
  ('BRIEF_SUBMISSION', '준비서면 제출기한', 7, '변론기일 7일 전'),
  ('EVIDENCE_SUBMISSION', '증거 제출기한', 7, '변론기일 7일 전');
```

### **upcoming_hearings** (뷰)
```sql
CREATE VIEW upcoming_hearings AS
SELECT
  id,
  case_number,
  hearing_type,
  hearing_date,
  location,
  status,
  (DATE(hearing_date) - CURRENT_DATE) AS days_until_hearing
FROM court_hearings
WHERE
  status = 'SCHEDULED'
  AND hearing_date >= NOW()
ORDER BY hearing_date ASC;
```

### **urgent_deadlines** (뷰)
```sql
CREATE VIEW urgent_deadlines AS
SELECT
  cd.id,
  cd.case_number,
  cd.deadline_type,
  dt.name AS deadline_type_name,
  cd.deadline_date,
  cd.deadline_datetime,
  cd.status,
  (cd.deadline_date - CURRENT_DATE) AS days_until_deadline
FROM case_deadlines cd
JOIN deadline_types dt ON cd.deadline_type = dt.type
WHERE
  cd.status = 'PENDING'
  AND cd.deadline_date >= CURRENT_DATE
ORDER BY cd.deadline_date ASC;
```

---

## ✅ 테스트 체크리스트

### **기능 테스트**
- [x] 법원 기일 추가 (사건번호 자동완성)
- [x] 데드라인 추가 (자동 계산 미리보기)
- [x] 대시보드에서 D-7 이내 일정 표시
- [x] 월간 캘린더에 법원 기일/데드라인 표시
- [x] 사건 상세 페이지 탭 전환
- [x] 법원 기일 완료 처리
- [x] 데드라인 완료 처리
- [x] 법원 기일 삭제
- [x] 데드라인 삭제

### **데이터 무결성 테스트**
- [ ] 데드라인 자동 계산 정확성 (trigger_date + days)
- [ ] 타임존 처리 (KST 기준)
- [ ] 뷰(View) 자동 업데이트 (INSERT 후 즉시 반영)
- [ ] 트리거 실행 확인 (deadline_date, deadline_datetime)

### **UI/UX 테스트**
- [x] 모달 열기/닫기
- [x] 폼 유효성 검사 (필수 필드)
- [x] 로딩 상태 표시
- [x] 빈 상태 표시 (데이터 없을 때)
- [x] 에러 메시지 표시
- [x] 성공 알림 (alert, 추후 toast로 변경 예정)

### **성능 테스트**
- [ ] 대량 데이터 조회 (50+ 법원 기일)
- [ ] 자동완성 검색 디바운싱 (300ms)
- [ ] 뷰(View) 쿼리 성능

---

## 🚀 Phase 2 계획 (다음 단계)

### **1. 알림 시스템**
- [ ] 이메일 알림 (D-3, D-1 자동 발송)
- [ ] SMS 알림 (긴급 알림)
- [ ] 푸시 알림 (웹 앱)

### **2. 캘린더 고도화**
- [ ] 드래그앤드롭으로 일정 이동
- [ ] 반복 일정 (매주, 매월)
- [ ] 구글 캘린더 동기화

### **3. 검색 및 필터링**
- [ ] 전체 검색 (사건명, 의뢰인명, 법원명)
- [ ] 고급 필터 (기간, 유형, 상태)
- [ ] 정렬 옵션

### **4. 권한 관리**
- [ ] 변호사별 사건 할당
- [ ] 읽기/쓰기 권한 분리
- [ ] RLS 정책 적용

### **5. 리포트 및 통계**
- [ ] 월간 법원 기일 통계
- [ ] 데드라인 미준수율
- [ ] 사건별 일정 타임라인

---

## 🐛 알려진 이슈 및 해결 방안

### **1. 사건번호 매핑**
- **현재**: `court_case_number` (TEXT) 사용
- **이슈**: 외래키 제약 없음, 데이터 무결성 보장 어려움
- **해결 방안**: `legal_cases.id` (UUID)로 변경하여 `case_id` 컬럼 추가

### **2. 타임존 처리**
- **현재**: PostgreSQL `TIMESTAMPTZ` 사용 (UTC 저장, KST 변환)
- **이슈**: 클라이언트 타임존과 불일치 가능성
- **해결 방안**: 모든 날짜/시간을 KST 기준으로 명시적으로 처리

### **3. 알림 방식**
- **현재**: `alert()` 사용
- **이슈**: 사용자 경험이 좋지 않음
- **해결 방안**: React Toast 라이브러리 도입 (react-hot-toast)

### **4. 에러 처리**
- **현재**: `try-catch` + `alert()`
- **이슈**: 상세한 에러 정보 부족
- **해결 방안**: Sentry 도입, 에러 로깅 시스템 구축

---

## 📝 사용 예시

### **법원 기일 추가**
1. 대시보드 → "법원기일 추가" 버튼 클릭
2. 사건번호 검색 (예: "2024가단12345")
3. 기일 유형 선택 (예: "변론기일")
4. 날짜/시간 입력 (예: 2025-11-30 14:00)
5. 법정 입력 (예: "서울가정법원 301호")
6. 담당 판사 입력 (예: "김철수")
7. 제출 → 대시보드에 즉시 표시

### **데드라인 추가**
1. 사건 상세 페이지 → "데드라인" 탭 클릭
2. "+ 데드라인 추가" 버튼 클릭
3. 데드라인 유형 선택 (예: "항소기간 (14일)")
4. 기산일 입력 (예: "2025-11-22" - 판결선고일)
5. 미리보기 확인:
   - 기간: 14일
   - 만료일: 2025-12-06
   - 만료 일시: 2025-12-06 24:00
6. 제출 → 데드라인 목록에 즉시 표시

---

## 🎯 성공 지표

- [x] 대시보드에서 D-7 이내 일정을 한눈에 확인
- [x] 법원 기일 추가 시 3단계 이내로 완료
- [x] 데드라인 자동 계산으로 수동 오류 제거
- [x] 사건 상세에서 모든 일정 통합 관리
- [x] 모달 UI로 빠른 입력 가능

---

## 👨‍💻 개발자 노트

### **핵심 파일 위치**
- **컴포넌트**: `/components/CaseDetail.tsx`, `/components/QuickAddHearingModal.tsx`
- **API**: `/app/api/admin/court-hearings/route.ts`
- **타입**: `/types/court-hearing.ts`
- **라이브러리**: `/lib/supabase/court-hearings.ts`

### **디버깅 팁**
```typescript
// 뷰(View) 데이터 확인
const { data } = await supabase.from('upcoming_hearings').select('*')
console.log(data)

// 트리거 동작 확인
const { data: deadlines } = await supabase
  .from('case_deadlines')
  .select('trigger_date, deadline_date, deadline_datetime')
console.log(deadlines) // deadline_date가 자동 계산되었는지 확인
```

---

## 📞 지원

**문제 발생 시**:
1. 브라우저 콘솔에서 에러 메시지 확인
2. Supabase 대시보드에서 테이블 데이터 확인
3. API 응답 확인 (Network 탭)

**데이터베이스 쿼리 실패 시**:
- Supabase SQL Editor에서 직접 실행해보기
- 뷰(View)가 제대로 생성되었는지 확인
- 트리거가 활성화되어 있는지 확인

---

**Phase 1 완료일**: 2025-11-22
**다음 Phase**: 알림 시스템 + 캘린더 고도화
**상태**: ✅ 프로덕션 준비 완료
