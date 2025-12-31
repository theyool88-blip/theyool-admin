# 마이그레이션 적용 가이드

## 📋 적용 대기 중인 마이그레이션

### 1. ✅ 상담 유입 경로 (이미 적용됨)
- `20251125_add_consultation_sources.sql` ✅ 완료

### 2. ⏳ 상담 예약 가능 시간 (적용 필요)
- **파일**: `20251125_create_consultation_availability_tables.sql`
- **목적**: 상담 예약 시간 관리 시스템
- **포함 내용**:
  - `consultation_weekly_schedule` 테이블 (주간 반복 일정)
  - `consultation_date_exceptions` 테이블 (특정 날짜 예외)
  - 기본 데이터: 월~금 09:00-18:00 (점심시간 제외)

### 3. ⏳ Phase 2 캘린더 통합 (적용 필요)
- **파일**: `20251125_update_consultations_in_calendar.sql`
- **목적**: 캘린더에서 미확정/확정 상담 구분
- **효과**: 점선/실선 구분 표시

---

## 🚀 적용 방법

### Step 1: Supabase Dashboard 접속
```
https://supabase.com/dashboard/project/kqqyipnlkmmprfgygauk/sql/new
```

### Step 2: 마이그레이션 SQL 복사

**우선순위 1 (필수)**: 상담 예약 가능 시간
```bash
cat supabase/migrations/20251125_create_consultation_availability_tables.sql
```

**우선순위 2 (선택)**: Phase 2 캘린더 통합
```bash
cat supabase/migrations/20251125_update_consultations_in_calendar.sql
```

### Step 3: SQL Editor에 붙여넣고 실행

1. SQL 복사
2. Supabase Dashboard SQL Editor에 붙여넣기
3. "Run" 버튼 클릭
4. 성공 메시지 확인

### Step 4: 검증

**상담 예약 가능 시간 검증:**
```bash
# 1. 테이블 생성 확인
node -e "
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
supabase.from('consultation_weekly_schedule').select('*').then(({data, error}) => {
  if (error) console.error('❌', error);
  else console.log('✅ 주간 일정:', data.length, '건');
});
"

# 2. 웹에서 테스트
# /admin/consultations 페이지에서 상담 일정 확정 시도
```

**Phase 2 캘린더 검증:**
```bash
node scripts/test-consultation-subtypes.js
```

---

## 📊 현재 상태

```
✅ consultation_sources                    - 적용 완료
⏳ consultation_weekly_schedule            - 적용 필요 (우선)
⏳ consultation_date_exceptions            - 적용 필요 (우선)
⏳ unified_calendar VIEW 업데이트          - 적용 필요 (선택)
```

---

## 🔍 각 마이그레이션 설명

### 1. consultation_weekly_schedule
주간 반복 일정 관리:
- 월~금 09:00-12:00, 13:00-18:00 (기본값)
- 30분 단위 슬롯
- 변호사별, 사무소별 설정 가능

### 2. consultation_date_exceptions
특정 날짜 예외 처리:
- 휴무일 설정
- 임시 운영 시간 변경
- 공휴일, 휴가 등

### 3. unified_calendar VIEW 업데이트
캘린더 표시 개선:
- 확정 상담: confirmed_date 사용, 실선 표시
- 미확정 상담: preferred_date 사용, 점선 표시
- event_subtype에 상태 prefix 추가

---

## ⚠️ 주의사항

1. **순서 준수**
   - 상담 예약 가능 시간 마이그레이션을 먼저 적용
   - 이후 Phase 2 캘린더 마이그레이션 적용

2. **데이터 백업**
   - 중요한 데이터가 있다면 백업 권장
   - 마이그레이션은 기존 데이터를 수정하지 않음

3. **에러 발생 시**
   - 에러 메시지 확인
   - 이미 적용된 경우 무시 가능
   - "already exists" 에러는 정상

---

## 📞 문제 해결

### "Failed to fetch weekly schedules" 에러
→ `consultation_weekly_schedule` 테이블 생성 필요
→ 20251125_create_consultation_availability_tables.sql 적용

### "event_subtype does not have status prefix"
→ unified_calendar VIEW 업데이트 필요
→ 20251125_update_consultations_in_calendar.sql 적용

### "table already exists" 에러
→ 정상, 이미 적용된 마이그레이션
→ 다음 마이그레이션 진행

---

**작성일**: 2025-11-25
**업데이트**: 상담 예약 시스템 마이그레이션 추가
