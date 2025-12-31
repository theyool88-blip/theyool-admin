# unified_calendar VIEW 마이그레이션 오류 수정 완료

## 문제 원인
PostgreSQL이 CASE 문에서 enum 타입을 한글 문자열로 변환할 때, 타입 추론 과정에서 오류 발생:
```
ERROR: 22P02: invalid input value for enum hearing_type: "변론기일"
```

### 핵심 이슈
- `hearing_type` enum: `HEARING_MAIN`, `HEARING_JUDGMENT` 등
- `deadline_type` enum: `DL_APPEAL`, `DL_RETRIAL` 등
- CASE 문에서 한글 문자열을 반환하는데, PostgreSQL이 이를 enum 값으로 해석하려고 시도

## 해결 방법
**enum 타입을 명시적으로 TEXT로 캐스팅**

### 수정 전 (오류 발생)
```sql
ch.hearing_type AS event_subtype,
CASE ch.hearing_type
  WHEN 'HEARING_MAIN' THEN '변론기일'
  ...
END
```

### 수정 후 (정상 작동)
```sql
ch.hearing_type::text AS event_subtype,
CASE ch.hearing_type
  WHEN 'HEARING_MAIN' THEN '변론기일'
  ...
  ELSE ch.hearing_type::text  -- ELSE 절도 ::text 캐스팅
END
```

## 적용된 수정사항

### 1. 법원기일 (COURT_HEARING)
- `ch.hearing_type AS event_subtype` → `ch.hearing_type::text AS event_subtype`
- `ELSE ch.hearing_type` → `ELSE ch.hearing_type::text`

### 2. 사건 데드라인 (DEADLINE)
- `cd.deadline_type AS event_subtype` → `cd.deadline_type::text AS event_subtype`
- `ELSE cd.deadline_type` → `ELSE cd.deadline_type::text`

### 3. 상담 (CONSULTATION)
- `c.request_type`는 TEXT 타입이므로 수정 불필요
- 모든 타입(callback, visit, video, info) 포함
- `WHERE c.preferred_date IS NOT NULL` 조건 유지

### 4. 일반 일정 (GENERAL_SCHEDULE)
- `gs.schedule_type`는 TEXT 타입이므로 수정 불필요

## 마이그레이션 파일
- **경로**: `/Users/hskim/theyool-admin/supabase/migrations/20251124_fix_unified_calendar_consultations.sql`
- **상태**: 수정 완료, 실행 준비 완료

## 실행 방법

### 로컬 환경 (Docker 필요)
```bash
npx supabase db reset
```

### Supabase 대시보드 SQL 에디터
1. Supabase 대시보드 접속
2. SQL Editor 메뉴 선택
3. 마이그레이션 파일 내용 복사하여 실행
4. 검증 쿼리 실행:
```sql
SELECT event_type, event_type_kr, event_subtype, title, event_date, event_time
FROM unified_calendar
ORDER BY event_date DESC, event_time DESC
LIMIT 20;
```

## VIEW 스키마

### unified_calendar 컬럼
- `id`: UUID (각 테이블의 PK)
- `event_type`: TEXT (COURT_HEARING, DEADLINE, CONSULTATION, GENERAL_SCHEDULE)
- `event_type_kr`: TEXT (법원기일, 데드라인, 상담, 일반일정)
- `event_subtype`: TEXT (enum 값의 TEXT 캐스팅)
- `title`: TEXT (한글 설명 + 사건명/이름)
- `case_name`: TEXT (사건명 또는 이름)
- `event_date`: DATE
- `event_time`: TEXT (HH:MI 형식)
- `event_datetime`: TIMESTAMP
- `reference_id`: TEXT (case_number, phone 등)
- `location`: TEXT
- `description`: TEXT
- `status`: TEXT
- `sort_priority`: INTEGER (1-4)

## 예상 결과

### 법원기일
```
event_type: COURT_HEARING
event_type_kr: 법원기일
event_subtype: HEARING_MAIN
title: (변론기일) 김철수 이혼 사건
```

### 상담
```
event_type: CONSULTATION
event_type_kr: 상담
event_subtype: visit
title: (방문) 홍길동
```

### 데드라인
```
event_type: DEADLINE
event_type_kr: 데드라인
event_subtype: DL_APPEAL
title: (상소기간) 박영희 이혼 사건
```

## 다음 단계
1. 마이그레이션 실행
2. 캘린더 API 엔드포인트에서 VIEW 조회
3. 프론트엔드 캘린더 컴포넌트에 데이터 연결
4. 각 event_type별 색상 및 UI 스타일 적용

## 기술 노트

### PostgreSQL enum 타입 캐스팅
- enum → text: `enum_column::text`
- text → enum: `text_column::enum_type_name` (유효한 enum 값만 가능)
- CASE 문에서 타입 불일치 방지를 위해 명시적 캐스팅 필수

### Supabase VIEW 제한사항
- RLS (Row Level Security)는 기본 테이블에만 적용됨
- VIEW 자체에는 RLS 정책 적용 불가
- 필요 시 API 엔드포인트에서 추가 필터링 적용

### 성능 고려사항
- 4개 테이블을 UNION ALL로 결합
- 각 쿼리는 인덱스 활용 가능 (date, case_id 등)
- preferred_date 조건으로 불필요한 상담 데이터 제외
- 프론트엔드에서 날짜 범위 필터링 권장 (WHERE event_date BETWEEN ... AND ...)
