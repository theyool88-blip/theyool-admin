# 상담 시간 관리 시스템 사용 가이드

## 개요

이 시스템은 **theyool 홈페이지**에서 상담 신청 시 표시되는 예약 가능 시간을 **theyool-admin**에서 관리할 수 있도록 합니다.

## 주요 기능

### 1. 주간 반복 일정 관리
- 요일별 기본 상담 가능 시간 설정
- 변호사별, 사무소별 시간대 설정 가능
- 예약 단위 시간 설정 (기본 30분)
- 동시 예약 가능 수 설정

### 2. 예외 날짜 관리
- 특정 날짜의 휴무 설정
- 특정 날짜의 특별 운영 시간 설정
- 사유 기록 가능

### 3. 실시간 예약 현황 반영
- 이미 예약된 시간대 자동 차단
- 남은 예약 가능 자리 수 표시

---

## 설치 및 설정

### 1. 데이터베이스 마이그레이션 실행

```bash
# theyool-admin 프로젝트 디렉토리에서
cd /Users/hskim/theyool-admin
```

Supabase 대시보드에서 SQL Editor를 열고 다음 파일의 내용을 실행:
```
supabase/migrations/20251125_create_consultation_availability.sql
```

또는 마이그레이션 스크립트가 있다면:
```bash
node scripts/apply-migration.js supabase/migrations/20251125_create_consultation_availability.sql
```

### 2. 홈페이지 컴포넌트 교체

홈페이지 프로젝트에서 Step3DateTime 컴포넌트를 동적 버전으로 교체:

```bash
cd /Users/hskim/theyool

# 기존 파일 백업
mv components/features/ConsultationBooking/steps/Step3DateTime.tsx \
   components/features/ConsultationBooking/steps/Step3DateTime.tsx.backup

# 새 파일 복사
cp /Users/hskim/theyool-admin/Step3DateTime-dynamic.tsx \
   components/features/ConsultationBooking/steps/Step3DateTime.tsx
```

또는 직접 복사:
- 소스: `/Users/hskim/theyool/components/features/ConsultationBooking/steps/Step3DateTime-dynamic.tsx`
- 대상: `/Users/hskim/theyool/components/features/ConsultationBooking/steps/Step3DateTime.tsx`

---

## 사용 방법

### 어드민에서 상담 시간 관리하기

1. **어드민 로그인**
   - http://localhost:3000/admin (개발 환경)
   - 또는 배포된 어드민 URL

2. **설정 페이지 접속**
   - 좌측 메뉴 또는 상단 메뉴에서 "설정" 클릭
   - "상담 시간 관리" 탭 선택

3. **주간 일정 설정**
   - "주간 반복 일정" 탭에서 "+ 일정 추가" 클릭
   - 요일, 시작/종료 시간, 예약 단위 등 입력
   - 필요시 특정 변호사나 사무소 지정 가능
   - "추가" 버튼 클릭

4. **예외 날짜 설정**
   - "예외 날짜" 탭에서 "+ 예외 추가" 클릭
   - 날짜 선택, 휴무/특별 운영 선택
   - 사유 입력 (예: "설날 연휴", "특별 상담 가능")
   - "추가" 버튼 클릭

### 기본 설정 예시

마이그레이션 실행 시 다음 기본 일정이 자동으로 생성됩니다:

```
월요일~금요일:
- 오전: 09:00 - 12:00 (30분 단위)
- 오후: 13:00 - 18:00 (30분 단위)

토요일, 일요일: 휴무
```

---

## 데이터 구조

### consultation_weekly_schedule (주간 일정)

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | 고유 ID |
| day_of_week | INTEGER | 요일 (0=일요일, 1=월요일, ..., 6=토요일) |
| start_time | TIME | 시작 시간 (HH:MM) |
| end_time | TIME | 종료 시간 (HH:MM) |
| slot_duration_minutes | INTEGER | 예약 단위 시간 (기본 30분) |
| is_available | BOOLEAN | 활성화 여부 |
| office_location | TEXT | 사무소 ('천안', '평택', NULL=모든 사무소) |
| lawyer_name | TEXT | 변호사 ('육심원', '임은지', NULL=모든 변호사) |
| consultation_type | TEXT | 상담 유형 ('visit', 'video', NULL=모든 유형) |
| max_bookings_per_slot | INTEGER | 동시 예약 가능 수 (기본 1) |
| notes | TEXT | 메모 |

### consultation_date_exceptions (예외 날짜)

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | 고유 ID |
| exception_date | DATE | 예외 날짜 (YYYY-MM-DD) |
| start_time | TIME | 시작 시간 (NULL이면 종일) |
| end_time | TIME | 종료 시간 |
| is_blocked | BOOLEAN | true=휴무, false=특별 운영 |
| reason | TEXT | 사유 |
| office_location | TEXT | 사무소 (NULL=모든 사무소) |
| lawyer_name | TEXT | 변호사 (NULL=모든 변호사) |
| consultation_type | TEXT | 상담 유형 (NULL=모든 유형) |

---

## API 엔드포인트

### 어드민 API (인증 필요)

#### 주간 일정
- `GET /api/admin/availability/weekly` - 주간 일정 목록 조회
- `POST /api/admin/availability/weekly` - 주간 일정 추가
- `GET /api/admin/availability/weekly/[id]` - 특정 일정 조회
- `PATCH /api/admin/availability/weekly/[id]` - 일정 수정
- `DELETE /api/admin/availability/weekly/[id]` - 일정 삭제

#### 예외 날짜
- `GET /api/admin/availability/exceptions` - 예외 목록 조회
- `POST /api/admin/availability/exceptions` - 예외 추가
- `GET /api/admin/availability/exceptions/[id]` - 특정 예외 조회
- `PATCH /api/admin/availability/exceptions/[id]` - 예외 수정
- `DELETE /api/admin/availability/exceptions/[id]` - 예외 삭제

### 홈페이지 API (공개)

- `GET /api/bookings/available-slots` - 예약 가능 시간대 조회

Query Parameters:
- `start_date` (필수): 시작 날짜 (YYYY-MM-DD)
- `end_date` (필수): 종료 날짜 (YYYY-MM-DD)
- `office_location` (선택): 사무소 ('천안' | '평택')
- `lawyer_name` (선택): 변호사 ('육심원' | '임은지')
- `consultation_type` (선택): 상담 유형 ('visit' | 'video' | 'callback')

---

## 동작 원리

### 홈페이지에서 예약 가능 시간 표시 흐름

1. **사용자가 상담 예약 모달 오픈**
   - Step3DateTime 컴포넌트 로드

2. **API 호출**
   - `/api/bookings/available-slots` 호출
   - 오늘부터 2주간의 예약 가능 시간 조회

3. **서버에서 처리**
   - 주간 일정 조회
   - 예외 날짜 조회
   - 기존 예약 조회
   - 날짜별 시간대 계산
   - 남은 capacity 계산

4. **클라이언트에서 표시**
   - 예약 가능한 날짜 버튼 표시
   - 선택한 날짜의 시간대 버튼 표시
   - 마감된 시간대는 비활성화

---

## 문제 해결

### 1. 홈페이지에서 예약 가능 시간이 표시되지 않아요

**확인 사항:**
- 데이터베이스 마이그레이션이 실행되었는지 확인
- 어드민에서 주간 일정이 설정되어 있는지 확인
- 브라우저 개발자 도구에서 API 호출 오류 확인

**해결 방법:**
```bash
# Supabase 대시보드 > SQL Editor에서 확인
SELECT * FROM consultation_weekly_schedule;
SELECT * FROM consultation_date_exceptions;
```

### 2. 어드민에서 일정 추가가 안 돼요

**확인 사항:**
- 시작 시간이 종료 시간보다 빠른지 확인
- 요일 값이 0-6 범위인지 확인
- 네트워크 탭에서 API 응답 오류 확인

### 3. 특정 날짜만 휴무 처리하고 싶어요

**방법:**
1. 설정 > 상담 시간 관리 > 예외 날짜 탭
2. "+ 예외 추가" 클릭
3. 날짜 선택, "휴무 (예약 불가)" 선택
4. 시작/종료 시간을 비워두면 종일 휴무
5. 사유 입력 (예: "임시 휴무")

### 4. 특정 변호사만 특정 시간에 상담하게 하고 싶어요

**방법:**
1. 주간 일정 추가 시 "변호사" 필드에서 선택
2. 같은 시간대에 여러 변호사 일정을 각각 추가 가능

---

## 고급 설정

### 변호사별 다른 일정 설정

```
예시: 육심원 변호사는 월수금, 임은지 변호사는 화목에 상담

1. 월요일 09:00-18:00 (변호사: 육심원)
2. 화요일 09:00-18:00 (변호사: 임은지)
3. 수요일 09:00-18:00 (변호사: 육심원)
4. 목요일 09:00-18:00 (변호사: 임은지)
5. 금요일 09:00-18:00 (변호사: 육심원)
```

### 사무소별 다른 운영 시간

```
예시: 천안은 평일 9-6시, 평택은 평일 10-5시

천안:
1. 월~금 09:00-18:00 (사무소: 천안)

평택:
1. 월~금 10:00-17:00 (사무소: 평택)
```

### 동시 예약 가능 수 늘리기

```
예시: 화상 상담은 동시에 2명까지 가능

1. 일정 추가 시 "동시 예약 가능 수"를 2로 설정
2. "상담 유형"을 "video"로 설정
```

---

## 유지보수

### 정기적으로 해야 할 일

1. **휴일 설정**
   - 공휴일, 법정 휴일 미리 설정
   - 특별 휴무일 설정

2. **예약 현황 모니터링**
   - 예약이 몰리는 시간대 확인
   - 필요시 추가 시간대 오픈

3. **데이터 정리**
   - 지난 예외 설정 삭제 (선택사항)

---

## 참고 사항

- 모든 시간은 24시간 형식 (HH:MM)
- 날짜는 YYYY-MM-DD 형식
- 기본 예약 단위는 30분
- 주말 기본 설정은 휴무
- 점심시간(12:00-13:00)은 기본적으로 제외됨

---

## 문의

시스템 관련 문제나 기능 추가 요청은 개발자에게 문의하세요.
