# 법정 기간 계산 시스템 (Legal Deadline Calculation System)

**최종 업데이트**: 2025-11-22
**버전**: 2.0 (민법 제161조 완전 적용)

---

## 📋 목차

1. [개요](#개요)
2. [법적 근거](#법적-근거)
3. [시스템 구조](#시스템-구조)
4. [불변기간 종류](#불변기간-종류)
5. [마이그레이션 가이드](#마이그레이션-가이드)
6. [사용 방법](#사용-방법)
7. [테스트](#테스트)

---

## 개요

법무법인 더율의 법원 기일 및 데드라인 관리 시스템입니다.
**민법 제161조**와 **민사소송법** 불변기간 규정을 완전히 준수하여 자동으로 정확한 만료일을 계산합니다.

### 주요 기능

- ✅ **민법 제161조 자동 적용**: 만료일이 토요일/공휴일이면 다음 영업일로 연장
- ✅ **대한민국 공휴일 자동 반영**: 2025년 법정 공휴일 17개 등록
- ✅ **13가지 불변기간 지원**: 상소, 항소이유서, 재심, 즉시항고 등
- ✅ **자동 데드라인 생성**: 선고일 입력 시 상소기간 자동 생성
- ✅ **초일불산입 옵션**: 특정 기간 계산 시 초일 제외 가능
- ✅ **연장 이력 관리**: 항소이유서 등 연장 가능 기간 추적

---

## 법적 근거

### 민법 제161조 (기간의 만료점)

> 기간을 일, 주, 월 또는 연으로 정한 때에는 기간말일의 종료로 기간이 만료한다.
> **기간의 말일이 토요일 또는 공휴일에 해당한 때에는 기간은 그 익일로 만료한다.**

### 관공서의 공휴일에 관한 규정 제2조

- 일요일은 항상 공휴일로 간주
- 법정 공휴일: 신정, 설날, 삼일절, 어린이날, 현충일, 광복절, 추석, 개천절, 한글날, 성탄절 등

### 민사소송법 불변기간

- **제396조 (항소기간)**: 판결서 송달받은 날로부터 2주일
- **제422조의2 (항소이유서 제출기한)**: 항소기록접수 통지일로부터 40일 (2025. 3. 1. 시행)
- **제451조 (즉시항고)**: 재판고지일로부터 1주일
- **제456조 (재심의 소)**: 판결확정일 또는 사유를 안 날로부터 30일

**참고 자료**:
- [민법 제161조](https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=61603#0000)
- [민사소송법 개정 (2025. 3. 1. 시행)](https://www.classhklaw.com/newsletter_view.php?seq=2815)
- [나홀로 민사소송 가이드](https://easylaw.go.kr/CSP/CnpClsMain.laf?popMenu=ov&csmSeq=568&ccfNo=7&cciNo=2&cnpClsNo=1)

---

## 시스템 구조

### 데이터베이스 스키마

#### 1. `korean_public_holidays` (공휴일 테이블)

```sql
CREATE TABLE korean_public_holidays (
  id UUID PRIMARY KEY,
  holiday_date DATE NOT NULL UNIQUE,
  holiday_name VARCHAR(100) NOT NULL,
  year INTEGER GENERATED ALWAYS AS (EXTRACT(YEAR FROM holiday_date)::INTEGER) STORED,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**2025년 공휴일 (17개)**:
- 신정 (1/1)
- 설날 연휴 (1/28-30)
- 삼일절 (3/1) + 대체공휴일 (3/3)
- 어린이날 (5/5) + 대체공휴일 (5/6)
- 현충일 (6/6)
- 광복절 (8/15)
- 개천절 (10/3)
- 추석 연휴 (10/5-7) + 대체공휴일 (10/8)
- 한글날 (10/9)
- 성탄절 (12/25)

#### 2. `deadline_types` (불변기간 유형)

```sql
CREATE TABLE deadline_types (
  type VARCHAR(50) PRIMARY KEY,
  label VARCHAR(100) NOT NULL,
  days INTEGER NOT NULL,
  is_immutable BOOLEAN DEFAULT TRUE,
  is_extendable BOOLEAN DEFAULT FALSE,
  max_extensions INTEGER DEFAULT 0,
  extension_days INTEGER DEFAULT 0,
  description TEXT
);
```

#### 3. `case_deadlines` (사건별 데드라인)

```sql
CREATE TABLE case_deadlines (
  id UUID PRIMARY KEY,
  case_number VARCHAR(100) NOT NULL,
  deadline_type VARCHAR(50) REFERENCES deadline_types(type),
  trigger_date DATE NOT NULL,          -- 기산일
  deadline_date DATE,                  -- 만료일 (자동 계산)
  deadline_datetime TIMESTAMPTZ,       -- 만료 일시 (자동 계산)
  status VARCHAR(20) DEFAULT 'PENDING',
  ...
);
```

**트리거**: `trigger_date`나 `deadline_type`이 변경되면 `deadline_date`가 자동 재계산됩니다.

### 핵심 함수

#### PostgreSQL 함수

1. **`is_saturday(date)`**: 토요일 여부 확인
2. **`is_sunday(date)`**: 일요일 여부 확인 (공휴일)
3. **`is_public_holiday(date)`**: 법정 공휴일 여부 확인 (일요일 포함)
4. **`is_non_business_day(date)`**: 비영업일 확인 (토요일 또는 공휴일)
5. **`get_next_business_day(date)`**: 다음 영업일 반환
6. **`calculate_legal_deadline(trigger_date, days, exclude_initial_day)`**: 법정 기간 계산

#### TypeScript 함수 (`lib/utils/korean-legal-dates.ts`)

```typescript
// 공휴일 확인
isPublicHoliday(date: Date): boolean

// 비영업일 확인
isNonBusinessDay(date: Date): boolean

// 다음 영업일
getNextBusinessDay(date: Date): Date

// 법정 기간 계산
calculateLegalDeadline(
  triggerDate: Date,
  days: number,
  excludeInitialDay: boolean = false
): Date
```

---

## 불변기간 종류

### 1. 상소 관련 (5개)

| 코드 | 명칭 | 기간 | 연장 | 초일불산입 |
|------|------|------|------|------------|
| `DL_APPEAL` | 상소기간 | 14일 | ❌ | ❌ |
| `DL_APPELLATE_BRIEF` | 항소이유서 제출기한 | 40일 | ✅ 1회(30일) | ❌ |
| `DL_FINAL_APPEAL_BRIEF` | 상고이유서 제출기한 | 20일 | ❌ | ❌ |
| `DL_IMMEDIATE_APPEAL` | 즉시항고기간 | 7일 | ❌ | ✅ |
| `DL_APPEAL_DISMISSAL_IMMED` | 항소각하결정 즉시항고 | 7일 | ❌ | ✅ |

### 2. 재심 (2개)

| 코드 | 명칭 | 기간 | 연장 | 초일불산입 |
|------|------|------|------|------------|
| `DL_RETRIAL` | 재심의 소 제기기한 | 30일 | ❌ | ❌ |
| `DL_FAMILY_RETRIAL` | 가사소송 재심 | 30일 | ❌ | ❌ |

### 3. 조정·화해 (3개)

| 코드 | 명칭 | 기간 | 연장 | 초일불산입 |
|------|------|------|------|------------|
| `DL_MEDIATION_OBJ` | 조정·화해 이의기간 | 14일 | ❌ | ❌ |
| `DL_RECONCILIATION_OBJ` | 화해권고결정 이의신청 | 14일 | ❌ | ❌ |
| `DL_PAYMENT_ORDER_OBJ` | 지급명령 이의신청 | 14일 | ❌ | ❌ |

### 4. 가사소송 (1개)

| 코드 | 명칭 | 기간 | 연장 | 초일불산입 |
|------|------|------|------|------------|
| `DL_FAMILY_APPEAL` | 가사소송 항소기간 | 14일 | ❌ | ❌ |

### 5. 집행·가처분 (2개)

| 코드 | 명칭 | 기간 | 연장 | 초일불산입 |
|------|------|------|------|------------|
| `DL_EXECUTION_OBJECTION` | 집행이의 | 14일 | ❌ | ❌ |
| `DL_PROVISIONAL_APPEAL` | 가처분 이의 | 14일 | ❌ | ❌ |

---

## 마이그레이션 가이드

### Step 1: 기본 스키마 마이그레이션 (완료)

```bash
# 이미 실행됨: 20251122_fix_court_hearings_schema.sql
```

### Step 2: 향상된 계산 시스템 설치

```bash
# Supabase SQL Editor에서 실행:
# supabase/migrations/20251122_enhanced_deadline_calculation.sql
```

이 마이그레이션은 다음을 수행합니다:
- 공휴일 테이블 생성 및 2025년 데이터 삽입
- 법정 기간 계산 함수 생성
- 기존 데드라인 데이터 자동 재계산

### Step 3: 전체 불변기간 유형 추가

```bash
# Supabase SQL Editor에서 실행:
# supabase/migrations/20251122_add_all_immutable_periods.sql
```

이 마이그레이션은 다음을 수행합니다:
- 13가지 불변기간 유형 추가
- 연장 가능 기간 설정 (항소이유서)
- 연장 이력 테이블 생성

### Step 4: 애플리케이션 코드 업데이트 (선택)

현재 자동 생성 매핑 (`lib/supabase/court-hearings.ts`):
```typescript
const AUTO_DEADLINE_MAPPING: Record<string, string> = {
  'HEARING_JUDGMENT': 'DL_APPEAL',           // 선고기일 → 상소기간
  'HEARING_MEDIATION': 'DL_MEDIATION_OBJ',   // 조정기일 → 조정·화해 이의기간
};
```

필요시 추가:
```typescript
'HEARING_RECONCILIATION': 'DL_RECONCILIATION_OBJ',  // 화해권고
'HEARING_PAYMENT_ORDER': 'DL_PAYMENT_ORDER_OBJ',    // 지급명령
```

---

## 사용 방법

### 1. 법원 기일 추가 (UI)

1. 관리자 대시보드 → "법원 기일 추가" 버튼 클릭
2. 사건번호 검색 (자동완성)
3. 기일 유형 선택:
   - 선고기일 → **자동으로 상소기간(14일) 데드라인 생성**
   - 조정기일 → **자동으로 조정·화해 이의기간(14일) 데드라인 생성**
4. 날짜/시간 입력 → 제출

### 2. 데드라인 직접 추가

1. 관리자 대시보드 → "데드라인 추가" 버튼 클릭
2. 사건번호 검색
3. 데드라인 유형 선택 (13가지 중 선택)
4. 기산일 입력 → **만료일 자동 계산 (민법 제161조 적용)**

### 3. API 사용 예시

#### 법원 기일 생성 (자동 데드라인 포함)

```typescript
const response = await fetch('/api/admin/court-hearings', {
  method: 'POST',
  body: JSON.stringify({
    case_number: '2025가단1234',
    hearing_type: 'HEARING_JUDGMENT',
    hearing_date: '2025-03-15T10:00:00',
    location: '서울가정법원 301호',
    judge_name: '홍길동',
    auto_create_deadline: true  // 기본값 true
  })
});
```

**결과**:
- 법원 기일 생성 (3/15 10:00)
- 상소기간 데드라인 자동 생성:
  - 기산일: 2025-03-15
  - 만료일: 2025-03-31 (3/29 토요일 → 3/31 월요일로 연장)

#### 데드라인 직접 생성

```typescript
const response = await fetch('/api/admin/case-deadlines', {
  method: 'POST',
  body: JSON.stringify({
    case_number: '2025가단1234',
    deadline_type: 'DL_APPELLATE_BRIEF',
    trigger_date: '2025-03-15'
  })
});
```

**결과**:
- 만료일 자동 계산: 2025-04-24 (40일 후)
- 만료일이 토요일/공휴일이면 자동 연장

---

## 테스트

### 자동 테스트 실행

```bash
cd /Users/hskim/theyool-admin
npx tsx scripts/test-legal-deadline-calculation.ts
```

**테스트 케이스 (7개)**:
1. ✅ 평일 → 평일 만료
2. ✅ 평일 → 토요일 만료 → 월요일 연장
3. ✅ 평일 → 일요일 만료 → 월요일 연장
4. ✅ 평일 → 어린이날 만료 → 대체공휴일 다음날로 연장
5. ✅ 평일 → 추석 연휴 만료 → 연휴 다음 평일로 연장
6. ✅ 초일불산입 적용
7. ✅ 연말연시 공휴일 연장

**성공률**: 100%

### 수동 테스트 예시

#### 시나리오 1: 토요일 연장

- 기산일: 2025-03-01 (토요일, 삼일절)
- 기간: 14일
- 예상 만료일: 2025-03-17 (월요일)
  - 3/15 (토요일) → 민법 제161조에 따라 3/17 (월요일)로 연장

#### 시나리오 2: 추석 연휴 연장

- 기산일: 2025-09-22 (월요일)
- 기간: 14일
- 예상 만료일: 2025-10-10 (금요일)
  - 10/6 (월, 추석) → 10/7 (화, 추석연휴) → 10/8 (수, 대체공휴일) → 10/9 (목, 한글날) → 10/10 (금)

---

## 트러블슈팅

### Q1: 만료일이 토요일/일요일로 계산됩니다

**A**: 마이그레이션이 정상적으로 실행되지 않았을 가능성이 있습니다.
Supabase SQL Editor에서 다음을 확인하세요:

```sql
-- 공휴일 테이블 확인
SELECT * FROM korean_public_holidays ORDER BY holiday_date;

-- 함수 존재 확인
SELECT proname FROM pg_proc WHERE proname LIKE '%legal%';
```

### Q2: 기존 데드라인이 재계산되지 않습니다

**A**: 수동으로 재계산 트리거:

```sql
UPDATE case_deadlines
SET trigger_date = trigger_date
WHERE trigger_date IS NOT NULL;
```

### Q3: 2026년 공휴일은 어떻게 추가하나요?

**A**: Supabase SQL Editor에서:

```sql
INSERT INTO korean_public_holidays (holiday_date, holiday_name) VALUES
  ('2026-01-01', '신정'),
  ('2026-02-16', '설날 연휴'),
  ('2026-02-17', '설날'),
  ('2026-02-18', '설날 연휴'),
  -- ... 나머지 추가
ON CONFLICT (holiday_date) DO NOTHING;
```

---

## 향후 개선 사항

- [ ] 연장 신청 UI 구현 (항소이유서 제출기한)
- [ ] 데드라인 알림 시스템 (이메일/SMS)
- [ ] 자동 공휴일 업데이트 (API 연동)
- [ ] 데드라인 캘린더 뷰
- [ ] 통계 대시보드 (마감 임박 건수 등)

---

## 참고 자료

- [민법 제161조](https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=61603#0000)
- [민사소송법](https://www.law.go.kr/LSW/lsRvsDocListP.do?chrClsCd=010102&lsId=001700)
- [2025. 3. 1. 민사소송법 개정](https://www.classhklaw.com/newsletter_view.php?seq=2815)
- [나홀로 민사소송 가이드](https://easylaw.go.kr/CSP/CnpClsMain.laf?popMenu=ov&csmSeq=568&ccfNo=7&cciNo=2&cnpClsNo=1)
- [불변기간 계산기](http://support.lawtop.co.kr/immutable/index.asp)

---

**문의**: admin@theyool.com
**버전 히스토리**:
- v2.0 (2025-11-22): 민법 제161조 완전 적용, 13가지 불변기간 지원
- v1.0 (2025-11-21): 초기 구현 (기본 CRUD + 자동 데드라인 생성)
