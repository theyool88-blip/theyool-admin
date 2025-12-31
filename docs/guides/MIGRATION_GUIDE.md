# 데이터베이스 마이그레이션 가이드

**Last Updated**: 2025-12-02

Supabase PostgreSQL 데이터베이스 마이그레이션 및 데이터 임포트 절차 안내입니다.

---

## 마이그레이션 실행 방법

### 방법 1: Supabase Dashboard (권장)

1. **SQL Editor 접속**
   ```
   https://supabase.com/dashboard/project/kqqyipnlkmmprfgygauk/sql
   ```

2. **마이그레이션 SQL 실행**
   - `New Query` 버튼 클릭
   - 마이그레이션 파일 내용 복사
   - SQL Editor에 붙여넣기
   - `Run` 버튼 클릭 (또는 Cmd/Ctrl + Enter)

3. **결과 확인**
   - Table Editor에서 새 테이블 확인

### 방법 2: Supabase CLI

```bash
# 1. CLI 로그인
supabase login

# 2. 프로젝트 연결
supabase link --project-ref kqqyipnlkmmprfgygauk

# 3. 마이그레이션 푸시
supabase db push
```

### 방법 3: psql 직접 실행

```bash
psql "postgresql://postgres:[PASSWORD]@db.kqqyipnlkmmprfgygauk.supabase.co:5432/postgres" \
  -f supabase/migrations/[MIGRATION_FILE].sql
```

---

## 주요 마이그레이션 파일

| 파일명 | 설명 |
|--------|------|
| `20251124_create_payments_table.sql` | 입금 관리 테이블 |
| `20251124_create_expense_management_system.sql` | 지출 관리 시스템 |
| `20251126_add_client_id_to_payments.sql` | 입금-의뢰인 직접 연결 |
| `20251122_create_court_hearing_tables.sql` | 법원기일 시스템 |

---

## 마이그레이션 검증

### 테이블 생성 확인

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'payments', 'expenses', 'court_hearings',
    'case_deadlines', 'deadline_types'
  );
```

### View 확인

```sql
SELECT table_name
FROM information_schema.views
WHERE table_schema = 'public'
  AND table_name IN (
    'upcoming_hearings', 'urgent_deadlines',
    'payment_stats_by_office', 'partner_debt_status'
  );
```

### 트리거 확인

```sql
SELECT trigger_name, event_object_table
FROM information_schema.triggers
WHERE trigger_schema = 'public';
```

---

## 데이터 임포트

### CSV 데이터 임포트

```bash
# 입금 데이터
node scripts/import-payments-csv.js

# 지출 데이터
node scripts/import-expense-data.js
```

### 임포트 검증

```sql
-- 입금 건수
SELECT COUNT(*) FROM payments;

-- 지출 건수
SELECT COUNT(*) FROM expenses;

-- 고정 지출 템플릿
SELECT COUNT(*) FROM recurring_templates;
```

---

## 트러블슈팅

### "relation already exists" 오류

```sql
-- 기존 테이블 삭제 (주의: 데이터 손실)
DROP TABLE IF EXISTS [table_name] CASCADE;

-- 다시 마이그레이션 실행
```

### 트리거가 동작하지 않음

```sql
-- 트리거 함수 재생성
CREATE OR REPLACE FUNCTION [function_name]()
RETURNS TRIGGER AS $$
...
$$ LANGUAGE plpgsql;

-- 트리거 재생성
DROP TRIGGER IF EXISTS [trigger_name] ON [table_name];
CREATE TRIGGER [trigger_name]
  BEFORE INSERT OR UPDATE ON [table_name]
  FOR EACH ROW
  EXECUTE FUNCTION [function_name]();
```

### 누적 계산 불일치

```bash
# 누적 채무 재계산
npx ts-node scripts/fix-accumulated-debt.js
```

---

## RLS 정책 설정

```sql
-- 테이블별 RLS 활성화
ALTER TABLE [table_name] ENABLE ROW LEVEL SECURITY;

-- 관리자 전용 정책
CREATE POLICY "관리자만 조회 가능" ON [table_name]
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "관리자만 수정 가능" ON [table_name]
  FOR ALL USING (auth.role() = 'authenticated');
```

---

## 백업 및 복원

### 데이터 백업

```bash
# Supabase Dashboard → Settings → Database → Backups
# 또는 pg_dump 사용
pg_dump [CONNECTION_STRING] > backup.sql
```

### 데이터 복원

```bash
psql [CONNECTION_STRING] < backup.sql
```
