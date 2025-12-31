# 통합 캘린더 시스템 개선사항 적용 가이드

**작성일**: 2025-11-23
**목적**: 일정 정렬 순서 개선 및 사건명 연동

---

## 개선 사항 요약

### 1. 정렬 순서 개선
- **현재**: 날짜 → 시간 순서로만 정렬
- **개선**: 날짜 → 시간 우선순위 → 시간 순서
  - 시간 없는 일정 (00:00) → 맨 처음 표시
  - 시간 있는 일정 → 시간 순서대로 표시

### 2. 일정 표시 형식 개선
- **현재**: `HEARING_MAIN`, `DL_APPEAL` 등 영문 타입명
- **개선**: `(변론기일) 김OO 이혼사건` 형식
  - 괄호 안에 한글 종류명
  - 뒤에 사건명 (cases 테이블과 연동)

### 3. 사건 연동 기능 추가
- cases 테이블에 `case_number` 컬럼 추가
- court_hearings, case_deadlines와 case_number로 연결
- 통합 캘린더에서 사건명 자동 표시

---

## 적용 방법

### Step 1: Supabase SQL Editor 접속

1. Supabase Dashboard 접속: https://supabase.com/dashboard
2. 프로젝트 선택: `theyool-admin`
3. 좌측 메뉴 → `SQL Editor` 클릭

---

### Step 2: cases 테이블에 case_number 컬럼 추가

**파일**: `/Users/hskim/theyool-admin/scripts/manual-add-case-number.sql`

```sql
-- cases 테이블에 case_number 컬럼 추가
ALTER TABLE cases
ADD COLUMN IF NOT EXISTS case_number VARCHAR(100);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_cases_case_number ON cases(case_number);

-- 코멘트 추가
COMMENT ON COLUMN cases.case_number IS '사건번호 (예: 2024드단12345) - court_hearings, case_deadlines와 연동';

-- 검증 쿼리
SELECT id, title, case_number FROM cases LIMIT 5;
```

**실행 방법**:
1. SQL Editor에서 `New query` 클릭
2. 위 SQL 복사 후 붙여넣기
3. `Run` 버튼 클릭 (또는 Cmd/Ctrl + Enter)
4. 성공 메시지 확인

**예상 결과**:
```
Success. No rows returned
```

---

### Step 3: unified_calendar VIEW 업데이트

**파일**: `/Users/hskim/theyool-admin/supabase/migrations/20251123_update_unified_calendar_view.sql`

**주요 변경사항**:
- `event_type_kr`: 한글 종류명 추가 (변론기일, 상소기간 등)
- `event_subtype`: 원본 타입값 저장 (HEARING_MAIN 등)
- `case_name`: cases 테이블과 JOIN하여 사건명 조회
- `sort_priority`: 정렬 우선순위 (1: 시간없음, 2: 시간있음)
- `title`: "(종류) 사건명" 형식으로 자동 변환

**실행 방법**:
1. SQL Editor에서 `New query` 클릭
2. 파일 내용 전체 복사 후 붙여넣기
3. `Run` 버튼 클릭
4. 성공 메시지 확인

**예상 결과**:
```
Success. No rows returned
```

**검증 쿼리**:
```sql
-- VIEW 구조 확인
SELECT * FROM unified_calendar LIMIT 5;

-- 정렬 순서 확인
SELECT
  event_date,
  event_time,
  sort_priority,
  event_type_kr,
  title
FROM unified_calendar
WHERE event_date >= CURRENT_DATE
ORDER BY event_date ASC, sort_priority ASC, event_time ASC
LIMIT 20;
```

---

## 검증 방법

### 자동 검증 스크립트 실행

```bash
node scripts/verify-calendar-improvements.js
```

**검증 항목**:
1. ✅ cases 테이블에 case_number 컬럼 존재
2. ✅ unified_calendar VIEW 구조 확인
3. ✅ 정렬 순서 검증
4. ✅ 일정 제목 형식 검증
5. ✅ API 엔드포인트 동작 확인

**성공 시 출력**:
```
═══════════════════════════════════════════════════
  검증 결과 요약
═══════════════════════════════════════════════════

✅ 통과: 5/5

🎉 모든 검증 항목을 통과했습니다!

═══════════════════════════════════════════════════
```

---

## 수동 검증 방법

### 1. 데이터베이스 검증

```sql
-- 1. cases 테이블 확인
SELECT
  id,
  title,
  case_number
FROM cases
LIMIT 5;

-- 2. unified_calendar VIEW 확인
SELECT
  event_date,
  event_time,
  sort_priority,
  event_type,
  event_type_kr,
  title,
  case_name
FROM unified_calendar
WHERE event_date >= CURRENT_DATE
ORDER BY event_date ASC, sort_priority ASC, event_time ASC
LIMIT 10;

-- 3. 정렬 검증 (같은 날짜의 일정)
SELECT
  event_date,
  event_time,
  sort_priority,
  title
FROM unified_calendar
WHERE event_date = '2025-11-23'  -- 오늘 날짜로 변경
ORDER BY sort_priority ASC, event_time ASC;
```

**예상 결과**:
- sort_priority = 1 (시간 없음) 일정이 먼저 표시
- sort_priority = 2 (시간 있음) 일정이 나중에 표시
- 같은 priority 내에서는 시간순 정렬

### 2. 웹 UI 검증

1. **개발 서버 실행**:
```bash
npm run dev
```

2. **관리자 로그인**: http://localhost:3000/login

3. **대시보드 확인**: http://localhost:3000/
   - "이번 주 일정 (D-7 이내)" 섹션 확인
   - 일정 제목이 "(변론기일) 사건명" 형식인지 확인
   - 시간 없는 일정이 먼저 표시되는지 확인

4. **주간 캘린더 확인**:
   - 같은 날짜의 일정 정렬 순서 확인
   - 00:00 일정이 맨 위에 표시되는지 확인

5. **월간 캘린더 확인**: http://localhost:3000/schedules
   - 전체 일정 보기
   - 날짜별 일정 표시 확인

---

## 데이터 입력 가이드

### 1. cases 테이블에 case_number 추가

```sql
-- 기존 사건에 사건번호 추가
UPDATE cases
SET case_number = '2024드단12345'
WHERE title LIKE '%이혼사건%'
LIMIT 1;

-- 여러 건 업데이트 (예시)
UPDATE cases SET case_number = '2024드단12345' WHERE id = 'uuid-1';
UPDATE cases SET case_number = '2024드단12346' WHERE id = 'uuid-2';
UPDATE cases SET case_number = '2024드단12347' WHERE id = 'uuid-3';
```

### 2. court_hearings에 데이터 추가

```sql
-- 법원 기일 추가 (사건번호로 연결)
INSERT INTO court_hearings (
  case_number,
  hearing_type,
  hearing_date,
  location,
  judge_name,
  notes
) VALUES (
  '2024드단12345',
  'HEARING_MAIN',
  '2025-11-25 14:00:00',
  '서울가정법원 301호',
  '김법관',
  '변론기일 준비서면 제출 필요'
);
```

### 3. 통합 캘린더에서 확인

```sql
SELECT
  title,           -- "(변론기일) 이혼사건" 형식
  case_name,       -- cases.title
  event_date,
  event_time,
  event_type_kr,   -- "변론기일"
  location
FROM unified_calendar
WHERE case_number = '2024드단12345';
```

---

## 트러블슈팅

### 문제 1: "column cases.case_number does not exist"

**원인**: Step 2를 실행하지 않음
**해결**: `manual-add-case-number.sql` 실행

### 문제 2: "relation unified_calendar does not exist"

**원인**: 기존 VIEW가 없거나 삭제됨
**해결**: `20251123_create_unified_calendar_view.sql` 먼저 실행

### 문제 3: 일정 제목이 여전히 영문으로 표시됨

**원인**: VIEW가 업데이트되지 않음
**해결**:
1. 기존 VIEW 삭제: `DROP VIEW IF EXISTS unified_calendar CASCADE;`
2. 새 VIEW 생성: Step 3 재실행

### 문제 4: 사건명이 (없음)으로 표시됨

**원인**: cases 테이블의 case_number와 court_hearings의 case_number가 일치하지 않음
**해결**:
```sql
-- 연결 확인
SELECT
  ch.case_number,
  c.case_number as cases_case_number,
  c.title
FROM court_hearings ch
LEFT JOIN cases c ON ch.case_number = c.case_number
WHERE ch.case_number = '2024드단12345';
```

### 문제 5: 정렬이 제대로 안됨

**원인**: API 라우트에서 sort_priority 정렬을 빠뜨림
**해결**: `/app/api/admin/calendar/route.ts` 확인
```typescript
.order('event_date', { ascending: true })
.order('sort_priority', { ascending: true })  // 이 줄 필수!
.order('event_time', { ascending: true })
```

---

## 롤백 방법

문제 발생 시 이전 상태로 되돌리기:

```sql
-- 1. 새 VIEW 삭제
DROP VIEW IF EXISTS unified_calendar CASCADE;

-- 2. 기존 VIEW 복구
-- (이전 마이그레이션 파일 재실행)

-- 3. cases 테이블에서 case_number 컬럼 삭제 (선택사항)
ALTER TABLE cases DROP COLUMN IF EXISTS case_number;
```

---

## 파일 목록

### SQL 마이그레이션
- `/scripts/manual-add-case-number.sql` - cases 테이블 수정
- `/supabase/migrations/20251123_update_unified_calendar_view.sql` - VIEW 업데이트

### 업데이트된 컴포넌트
- `/app/api/admin/calendar/route.ts` - API 정렬 추가
- `/components/WeeklyCalendar.tsx` - 제목 형식 개선
- `/components/Dashboard.tsx` - 제목 형식 개선
- `/components/MonthlyCalendar.tsx` - 제목 형식 개선

### 검증 스크립트
- `/scripts/verify-calendar-improvements.js` - 자동 검증

---

## 문의

문제 발생 시:
1. 검증 스크립트 실행 결과 확인
2. Supabase Dashboard의 SQL Editor에서 직접 쿼리 실행
3. 브라우저 개발자 도구 콘솔 확인
4. 서버 로그 확인 (`npm run dev` 터미널)
