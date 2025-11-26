# 법무법인 더율 - 지출 관리 시스템 마이그레이션 가이드

## 📋 개요

이 가이드는 지출 관리 시스템을 위한 데이터베이스 마이그레이션 및 데이터 임포트 절차를 안내합니다.

## 🗂️ 생성되는 테이블

1. **expenses** - 지출 내역
2. **recurring_templates** - 고정 지출 템플릿
3. **partner_withdrawals** - 변호사 인출/지급
4. **monthly_settlements** - 월별 정산

## 📊 생성되는 View (통계)

1. **monthly_revenue_summary** - 월별 수입 합계
2. **monthly_expense_summary** - 월별 지출 합계
3. **partner_debt_status** - 변호사별 채권/채무 상태
4. **expense_stats_by_category** - 카테고리별 지출 통계
5. **settlement_dashboard** - 정산 대시보드 (최근 12개월)

---

## 🚀 마이그레이션 실행 방법

### 방법 1: Supabase Dashboard (권장)

1. **Supabase Dashboard 접속**
   ```
   https://supabase.com/dashboard/project/kqqyipnlkmmprfgygauk
   ```

2. **SQL Editor 열기**
   - 왼쪽 메뉴에서 `SQL Editor` 클릭
   - 또는 직접 접속: https://supabase.com/dashboard/project/kqqyipnlkmmprfgygauk/sql

3. **마이그레이션 SQL 실행**
   - `New Query` 버튼 클릭
   - `/supabase/migrations/20251124_create_expense_management_system.sql` 파일 내용 복사
   - SQL Editor에 붙여넣기
   - `Run` 버튼 클릭 (또는 Cmd/Ctrl + Enter)

4. **결과 확인**
   - 모든 테이블이 성공적으로 생성되었는지 확인
   - 왼쪽 메뉴 `Table Editor`에서 새로운 테이블들 확인

### 방법 2: psql CLI (고급 사용자)

Supabase에서 데이터베이스 연결 정보를 확인한 후:

```bash
psql "postgresql://postgres:[YOUR-PASSWORD]@db.kqqyipnlkmmprfgygauk.supabase.co:5432/postgres"
\i supabase/migrations/20251124_create_expense_management_system.sql
```

---

## 📥 데이터 임포트

마이그레이션 완료 후 기존 CSV 데이터를 임포트합니다.

### 사전 준비

1. **CSV 파일 확인**
   - `/Users/hskim/Desktop/Private & Shared 4/더율 고정지출내역_all.csv`
   - `/Users/hskim/Desktop/Private & Shared 5/더율 월별 회계내역_all.csv`

2. **필요한 패키지 설치**
   ```bash
   npm install csv-parse
   ```

### 임포트 실행

```bash
cd /Users/hskim/theyool-admin
npx ts-node scripts/import-expense-data.ts
```

### 임포트 순서

1. **고정 지출 템플릿 임포트** (`recurring_templates`)
   - 고정지출내역_all.csv 데이터 임포트
   - 임대료, 인건비, 구독료 등 반복 지출 항목

2. **월별 회계 데이터 임포트**
   - 변호사 인출 데이터 (`partner_withdrawals`)
     - 김현성 변호사: 입금, 카드, 현금, 법인지출
     - 임은지 변호사: 입금, 카드, 현금, 법인지출
   - 월별 정산 데이터 (`monthly_settlements`)
     - 매출 정보 (천안/평택)
     - 지출 정보
     - 정산 상태

3. **누적 채무 재계산**
   - 각 월별 정산의 누적 채권/채무 자동 계산
   - 김현성/임은지 변호사별 누적 현황 업데이트

---

## ✅ 마이그레이션 검증

### 1. 테이블 생성 확인

Supabase Dashboard → Table Editor에서 확인:

- [ ] expenses
- [ ] recurring_templates
- [ ] partner_withdrawals
- [ ] monthly_settlements

### 2. View 생성 확인

SQL Editor에서 실행:

```sql
SELECT * FROM monthly_revenue_summary LIMIT 5;
SELECT * FROM monthly_expense_summary LIMIT 5;
SELECT * FROM partner_debt_status;
SELECT * FROM expense_stats_by_category LIMIT 5;
SELECT * FROM settlement_dashboard;
```

### 3. RLS 정책 확인

각 테이블에 다음 정책들이 생성되었는지 확인:

- 관리자만 조회
- 관리자만 삽입
- 관리자만 수정
- 관리자만 삭제

### 4. 데이터 임포트 검증

```sql
-- 고정 지출 템플릿 개수 확인
SELECT COUNT(*) FROM recurring_templates;

-- 변호사 인출 건수 확인
SELECT partner_name, COUNT(*) FROM partner_withdrawals GROUP BY partner_name;

-- 월별 정산 건수 확인
SELECT COUNT(*) FROM monthly_settlements;

-- 최종 누적 채무 확인
SELECT settlement_month, kim_accumulated_debt, lim_accumulated_debt
FROM monthly_settlements
ORDER BY settlement_month DESC
LIMIT 3;
```

---

## 🔧 트러블슈팅

### 문제 1: "relation already exists" 오류

**원인:** 테이블이 이미 존재합니다.

**해결:**
```sql
-- 기존 테이블 삭제 (주의: 데이터 손실됨)
DROP TABLE IF EXISTS expenses CASCADE;
DROP TABLE IF EXISTS recurring_templates CASCADE;
DROP TABLE IF EXISTS partner_withdrawals CASCADE;
DROP TABLE IF EXISTS monthly_settlements CASCADE;

-- 다시 마이그레이션 실행
```

### 문제 2: 임포트 스크립트 오류

**원인:** CSV 파일 경로 또는 형식 문제

**해결:**
1. CSV 파일 경로 확인
2. CSV 파일 인코딩 확인 (UTF-8 권장)
3. 스크립트의 `readCSV` 함수 디버깅

### 문제 3: 누적 채무 금액이 맞지 않음

**원인:** 정산 데이터 순서 또는 계산 로직 문제

**해결:**
```bash
# 누적 채무 재계산 스크립트 재실행
npx ts-node -e "
import { recalculateAccumulatedDebt } from './scripts/import-expense-data';
recalculateAccumulatedDebt();
"
```

---

## 📈 다음 단계

마이그레이션 및 임포트 완료 후:

1. **Phase 4: Admin UI 개발**
   - 지출 관리 페이지
   - 고정 지출 관리 페이지
   - 변호사 인출 관리 페이지
   - 월별 정산 페이지

2. **Phase 5: 자동화 구현**
   - 고정 지출 자동 생성 (매월)
   - 월별 정산 자동 집계
   - 누적 채무 자동 업데이트

---

## 📞 문제 발생 시

1. Supabase Dashboard Logs 확인
2. 마이그레이션 SQL 파일 재검토
3. 임포트 스크립트 로그 확인
4. 필요시 데이터 백업 후 재시도

---

**작성일:** 2025-11-24
**작성자:** Claude Code
**프로젝트:** 법무법인 더율 관리자 시스템
