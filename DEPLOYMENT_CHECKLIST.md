# 법원 기일 관리 시스템 - 배포 전 체크리스트

**Phase 1 완료 후 프로덕션 배포를 위한 최종 점검 사항**

---

## 🗄️ 데이터베이스 설정

### **테이블 생성 확인**
```sql
-- Supabase SQL Editor에서 실행하여 확인
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('court_hearings', 'case_deadlines', 'deadline_types');
```

**예상 결과**: 3개 행 반환
- [x] `court_hearings`
- [x] `case_deadlines`
- [x] `deadline_types`

---

### **뷰(View) 생성 확인**
```sql
-- Supabase SQL Editor에서 실행
SELECT table_name
FROM information_schema.views
WHERE table_schema = 'public'
  AND table_name IN ('upcoming_hearings', 'urgent_deadlines');
```

**예상 결과**: 2개 행 반환
- [x] `upcoming_hearings`
- [x] `urgent_deadlines`

**생성되지 않았다면**:
```sql
-- upcoming_hearings 뷰 생성
CREATE OR REPLACE VIEW upcoming_hearings AS
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

-- urgent_deadlines 뷰 생성
CREATE OR REPLACE VIEW urgent_deadlines AS
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

### **트리거 생성 확인**
```sql
-- 트리거 존재 확인
SELECT trigger_name, event_object_table, action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND trigger_name LIKE '%deadline%';
```

**예상 결과**: `calculate_deadline_dates` 트리거 존재

**생성되지 않았다면**:
```sql
-- 트리거 함수 생성
CREATE OR REPLACE FUNCTION calculate_deadline_from_trigger()
RETURNS TRIGGER AS $$
DECLARE
  v_days INTEGER;
BEGIN
  -- deadline_types에서 해당 유형의 일수 조회
  SELECT days INTO v_days
  FROM deadline_types
  WHERE type = NEW.deadline_type;

  -- deadline_date 계산 (trigger_date + days)
  NEW.deadline_date := NEW.trigger_date + v_days;

  -- deadline_datetime 계산 (deadline_date 자정)
  NEW.deadline_datetime := (NEW.deadline_date::TIMESTAMP + INTERVAL '1 day')::TIMESTAMPTZ;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 생성
CREATE TRIGGER calculate_deadline_dates
  BEFORE INSERT OR UPDATE ON case_deadlines
  FOR EACH ROW
  EXECUTE FUNCTION calculate_deadline_from_trigger();
```

---

### **마스터 데이터 삽입 확인**
```sql
-- deadline_types 데이터 확인
SELECT * FROM deadline_types ORDER BY days DESC;
```

**예상 결과**: 최소 4개 이상의 불변기간 유형

**데이터가 없다면**:
```sql
INSERT INTO deadline_types (type, name, days, description) VALUES
  ('APPEAL_PERIOD', '항소기간', 14, '판결선고일로부터 14일'),
  ('FINAL_APPEAL_PERIOD', '상고기간', 14, '판결선고일로부터 14일'),
  ('BRIEF_SUBMISSION', '준비서면 제출기한', 7, '변론기일 7일 전'),
  ('EVIDENCE_SUBMISSION', '증거 제출기한', 7, '변론기일 7일 전'),
  ('OBJECTION_PERIOD', '이의신청기간', 7, '결정일로부터 7일'),
  ('MEDIATION_REPLY', '조정회신기간', 14, '조정안 송달일로부터 14일')
ON CONFLICT (type) DO NOTHING;
```

---

## 🔐 권한 및 보안

### **RLS (Row Level Security) 설정 (선택사항)**
```sql
-- 프로덕션 환경에서는 RLS 활성화 권장

-- court_hearings RLS
ALTER TABLE court_hearings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "관리자만 조회 가능" ON court_hearings
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "관리자만 수정 가능" ON court_hearings
  FOR ALL
  USING (auth.role() = 'authenticated');

-- case_deadlines RLS (동일하게 적용)
ALTER TABLE case_deadlines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "관리자만 조회 가능" ON case_deadlines
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "관리자만 수정 가능" ON case_deadlines
  FOR ALL
  USING (auth.role() = 'authenticated');
```

---

## 🔍 데이터 검증

### **1. 트리거 동작 테스트**
```sql
-- 테스트 데이터 삽입
INSERT INTO case_deadlines (
  case_number,
  deadline_type,
  trigger_date,
  notes,
  status
) VALUES (
  'TEST-2025-00001',
  'APPEAL_PERIOD',
  CURRENT_DATE,
  '트리거 테스트',
  'PENDING'
) RETURNING *;

-- deadline_date가 trigger_date + 14일인지 확인
-- deadline_datetime이 설정되었는지 확인

-- 테스트 데이터 삭제
DELETE FROM case_deadlines WHERE case_number = 'TEST-2025-00001';
```

---

### **2. 뷰(View) 동작 테스트**
```sql
-- D-7 이내 법원 기일 조회
SELECT * FROM upcoming_hearings WHERE days_until_hearing <= 7;

-- D-7 이내 데드라인 조회
SELECT * FROM urgent_deadlines WHERE days_until_deadline <= 7;
```

---

## 🌐 API 테스트

### **로컬 환경에서 테스트**
```bash
# 개발 서버 실행
npm run dev

# 브라우저에서 테스트
# 1. 로그인: http://localhost:3000/login
# 2. 대시보드: http://localhost:3000
# 3. 사건 상세: http://localhost:3000/cases/[id]
```

### **API 엔드포인트 확인**
- [x] `GET /api/admin/court-hearings` - 법원 기일 목록
- [x] `POST /api/admin/court-hearings` - 법원 기일 생성
- [x] `PUT /api/admin/court-hearings/[id]` - 법원 기일 수정
- [x] `DELETE /api/admin/court-hearings/[id]` - 법원 기일 삭제
- [x] `GET /api/admin/case-deadlines` - 데드라인 목록
- [x] `POST /api/admin/case-deadlines` - 데드라인 생성
- [x] `PUT /api/admin/case-deadlines/[id]/complete` - 데드라인 완료
- [x] `DELETE /api/admin/case-deadlines/[id]` - 데드라인 삭제
- [x] `GET /api/admin/deadline-types` - 불변기간 유형 조회

---

## 🎨 UI 컴포넌트 테스트

### **대시보드 (Dashboard.tsx)**
- [x] 통합 일정 위젯 표시
- [x] D-7 이내 법원 기일 + 데드라인 표시
- [x] "법원기일 추가" 버튼 클릭 → 모달 열림
- [x] 긴급도 색상 코딩 (빨강/주황/노랑)

### **월간 캘린더 (MonthlyCalendar.tsx)**
- [x] 법원 기일 표시 (빨강 배경, ⚖️ 아이콘)
- [x] 데드라인 표시 (주황 배경, ⏰ 아이콘)
- [x] 기존 일정 표시 (파랑 배경)

### **사건 상세 (CaseDetail.tsx)**
- [x] 3개 탭 정상 동작 (기본정보, 법원기일, 데드라인)
- [x] 법원 기일 추가 버튼 → 모달 열림 (사건번호 자동 입력)
- [x] 데드라인 추가 버튼 → 모달 열림 (사건번호 자동 입력)
- [x] 각 항목의 "완료" 버튼 동작
- [x] 각 항목의 "삭제" 버튼 동작

### **QuickAddHearingModal**
- [x] 사건번호 자동완성 검색 동작
- [x] 필수 필드 유효성 검사
- [x] 날짜/시간 입력 정상
- [x] 제출 시 API 호출 성공

### **QuickAddDeadlineModal**
- [x] 사건번호 자동완성 검색 동작
- [x] 데드라인 유형 선택 시 일수 표시
- [x] 자동 계산 미리보기 정확
- [x] 제출 시 API 호출 성공

---

## 📦 환경 변수 확인

### **.env.local 파일**
```bash
# 필수 환경 변수
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# 관리자 계정
ADMIN_EMAIL=admin@theyool.com
ADMIN_PASSWORD=your-password
```

**확인 방법**:
```bash
# .env.local 파일 존재 확인
ls -la .env.local

# 환경 변수 값이 설정되었는지 확인 (민감 정보 주의)
cat .env.local | grep SUPABASE
```

---

## 🚀 프로덕션 배포

### **Vercel 배포 전 확인**
- [x] 모든 환경 변수를 Vercel 프로젝트 설정에 추가
- [x] `npm run build` 정상 완료
- [x] TypeScript 에러 없음
- [x] ESLint 경고 해결

### **배포 후 확인**
- [x] 프로덕션 URL에서 로그인 가능
- [x] 대시보드 로딩 정상
- [x] 법원 기일 추가 정상 동작
- [x] 데드라인 추가 정상 동작
- [x] 데이터베이스 연결 정상

---

## 🐛 알려진 이슈 및 해결 방안

### **이슈 1: 사건번호 자동완성이 안됨**
- **원인**: `legal_cases` 테이블에 `court_case_number`가 NULL
- **해결**: 사건 편집 페이지에서 사건번호 입력

### **이슈 2: 데드라인 자동 계산 안됨**
- **원인**: 트리거가 생성되지 않음 또는 `deadline_types`에 데이터 없음
- **해결**: 위의 SQL 스크립트 실행

### **이슈 3: 대시보드에 일정이 표시되지 않음**
- **원인**: D-7 이내에 일정이 없음
- **해결**: 테스트용 데이터를 오늘부터 3일 후로 생성

### **이슈 4: 뷰(View)에서 데이터가 조회되지 않음**
- **원인**: 뷰가 생성되지 않음
- **해결**: 위의 뷰 생성 SQL 실행

---

## ✅ 최종 체크리스트

### **데이터베이스**
- [ ] `court_hearings` 테이블 생성
- [ ] `case_deadlines` 테이블 생성
- [ ] `deadline_types` 테이블 생성 및 데이터 삽입
- [ ] `upcoming_hearings` 뷰 생성
- [ ] `urgent_deadlines` 뷰 생성
- [ ] `calculate_deadline_dates` 트리거 생성
- [ ] RLS 정책 설정 (선택사항)

### **코드**
- [ ] 모든 컴포넌트 파일 존재 확인
- [ ] TypeScript 에러 없음
- [ ] ESLint 경고 해결
- [ ] `npm run build` 성공

### **기능 테스트**
- [ ] 법원 기일 추가 (사건번호 자동완성)
- [ ] 데드라인 추가 (자동 계산 미리보기)
- [ ] 대시보드 D-7 이내 일정 표시
- [ ] 월간 캘린더 통합 표시
- [ ] 법원 기일 완료 처리
- [ ] 데드라인 완료 처리
- [ ] 법원 기일 삭제
- [ ] 데드라인 삭제

### **환경 설정**
- [ ] `.env.local` 환경 변수 설정
- [ ] Vercel 환경 변수 설정 (프로덕션 배포 시)
- [ ] Supabase 프로젝트 연결 확인

---

## 🎯 배포 후 모니터링

### **1주일 동안 확인할 사항**
- [ ] 사용자 피드백 수집
- [ ] 에러 로그 확인 (Vercel Dashboard)
- [ ] 데이터베이스 성능 모니터링 (Supabase Dashboard)
- [ ] API 응답 시간 확인

### **성능 지표**
- 법원 기일 추가 시 3초 이내 완료
- 대시보드 로딩 시 2초 이내
- 사건번호 자동완성 1초 이내

---

## 📞 긴급 연락처

**데이터베이스 이슈**: Supabase Support
**배포 이슈**: Vercel Support
**코드 이슈**: 개발 팀

---

**배포 준비 완료 날짜**: _________
**배포 담당자**: _________
**최종 확인자**: _________

---

*이 체크리스트를 모두 확인한 후 프로덕션 배포를 진행하세요.*
