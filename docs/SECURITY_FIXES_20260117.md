# 스키마 보안 취약점 수정 (2026-01-17)

## 개요

`supabase/combined_schema_20260201.sql` 분석 결과 발견된 5개 보안 취약점을 수정했습니다.

**마이그레이션 파일:** `supabase/migrations/20260117_security_fixes.sql`

---

## 수정된 취약점

### 1. [HIGH] Cross-tenant 권한 상승

#### 문제 1-1: `get_current_tenant_id()` 비결정적 선택

**수정 전:**
```sql
SELECT tenant_id FROM tenant_members
WHERE user_id = auth.uid() AND status = 'active'
LIMIT 1;  -- ORDER BY 없음!
```

**취약점:**
- 사용자가 여러 테넌트에 속한 경우 어떤 tenant_id가 반환될지 예측 불가
- RLS 정책에서 이 함수 사용 시 다른 테넌트 데이터 접근 가능성

**수정 후:**
```sql
SELECT tenant_id FROM tenant_members
WHERE user_id = auth.uid() AND status = 'active'
ORDER BY created_at ASC  -- 가장 먼저 가입한 테넌트 반환
LIMIT 1;
```

#### 문제 1-2: `has_role_or_higher()` 테넌트 범위 무시

**수정 전:**
```sql
SELECT role INTO user_role FROM tenant_members
WHERE user_id = auth.uid() AND status = 'active'
LIMIT 1;  -- 테넌트 필터 없음!
```

**취약점:**
- Alice가 Tenant A(staff), Tenant B(admin)인 경우
- Tenant A에서 `has_role_or_higher('admin')` 호출 시 Tenant B 역할로 TRUE 반환 가능
- 다른 테넌트에서 admin 권한 행사 가능 (권한 상승)

**수정 후:**
```sql
current_tenant := get_current_tenant_id();
SELECT role INTO user_role FROM tenant_members
WHERE user_id = auth.uid()
  AND tenant_id = current_tenant  -- 테넌트 범위 추가
  AND status = 'active'
LIMIT 1;
```

---

### 2. [HIGH] 초대 데이터 노출

**수정 전:**
```sql
CREATE POLICY "public_view_invitation_by_token" ON tenant_invitations
  FOR SELECT TO authenticated
  USING (status = 'pending' AND expires_at > NOW());
  -- tenant_id 필터 없음!
```

**취약점:**
- 인증된 모든 사용자가 시스템 내 **모든 테넌트**의 pending 초대 조회 가능
- 이메일, 역할, 초대 토큰 등 민감 정보 노출

**수정 후:**
```sql
CREATE POLICY "secure_view_invitation" ON tenant_invitations
  FOR SELECT TO authenticated
  USING (
    is_super_admin() OR
    tenant_id = get_current_tenant_id() OR
    (email = auth.jwt()->>'email' AND status = 'pending' AND expires_at > NOW())
  );
```

---

### 3. [MEDIUM] 공개 INSERT 무제한

**수정 전:**
```sql
CREATE POLICY "public_insert_consultations" ON consultations
  FOR INSERT WITH CHECK (true);  -- 모든 INSERT 허용

CREATE POLICY "public_insert_bookings" ON bookings
  FOR INSERT WITH CHECK (true);  -- 모든 INSERT 허용
```

**취약점:**
- 악의적 사용자가 임의의 tenant_id로 데이터 삽입 가능
- 타 테넌트 스팸/오염, 운영 방해 가능

**수정 후:**
```sql
-- tenant_id 유효성 검증 트리거 추가
CREATE TRIGGER trg_validate_consultation_tenant
  BEFORE INSERT ON consultations
  FOR EACH ROW EXECUTE FUNCTION validate_consultation_tenant();

CREATE TRIGGER trg_validate_booking_tenant
  BEFORE INSERT ON bookings
  FOR EACH ROW EXECUTE FUNCTION validate_booking_tenant();
```

---

### 4. [MEDIUM] 환불 반영 누락

**수정 전:**
```sql
-- receivables_summary 뷰
SELECT SUM(p.amount) FROM payments p
WHERE p.case_id = lc.id AND p.amount > 0  -- 양수만!
```

**취약점:**
- 스키마에서 "음수 = 환불" 명시했으나 뷰에서 환불 제외
- 미수금 과대 계산

**예시:**
```
총 수임료: 10,000,000원
결제: 6,000,000원
환불: -1,000,000원

수정 전: 미수금 = 10,000,000 - 6,000,000 = 4,000,000원 (틀림!)
수정 후: 미수금 = 10,000,000 - (6,000,000 - 1,000,000) = 5,000,000원 (정확)
```

**수정 후:**
```sql
-- amount > 0 필터 제거
SELECT SUM(p.amount) FROM payments p
WHERE p.case_id = lc.id
```

---

### 5. [MEDIUM] case_payment_summary 환불 미분리

**수정 전:**
- total_amount만 존재, 환불 금액 구분 불가

**수정 후:**
```sql
-- 새 컬럼 추가
total_payments  -- 양수 입금만
total_refunds   -- 환불 금액 (음수의 절대값)
```

---

## 검증 방법

### 1. 권한 상승 테스트
```sql
-- 사용자가 Tenant A(staff), Tenant B(admin)에 소속된 경우
-- Tenant A 컨텍스트에서 admin 기능 접근 시도
SELECT has_role_or_higher('admin');  -- FALSE여야 함
```

### 2. 초대 데이터 노출 테스트
```sql
SELECT * FROM tenant_invitations WHERE status = 'pending';
-- 자신의 테넌트 또는 자신의 이메일로 초대된 것만 반환되어야 함
```

### 3. INSERT 트리거 테스트
```sql
-- 유효하지 않은 tenant_id로 INSERT 시도
INSERT INTO consultations (tenant_id, name, phone, request_type, status)
VALUES ('00000000-0000-0000-0000-000000000000', '테스트', '010-0000-0000', 'visit', 'pending');
-- ERROR: Invalid tenant_id: 00000000-0000-0000-0000-000000000000
```

### 4. 환불 계산 테스트
```sql
SELECT case_name, total_amount, total_payments, total_refunds
FROM case_payment_summary
WHERE payment_count > 0;
-- total_amount = total_payments - total_refunds 확인
```

---

## 영향 범위

### 함수 변경
| 함수명 | 변경 내용 |
|--------|----------|
| `get_current_tenant_id()` | ORDER BY created_at ASC 추가 |
| `get_current_member_id()` | ORDER BY created_at ASC 추가 |
| `get_current_member_role()` | ORDER BY created_at ASC 추가 |
| `has_role_or_higher()` | tenant_id 필터 추가 |

### 정책 변경
| 테이블 | 변경 내용 |
|--------|----------|
| `tenant_invitations` | SELECT 정책에 테넌트 격리 추가 |

### 트리거 추가
| 테이블 | 트리거명 |
|--------|----------|
| `consultations` | `trg_validate_consultation_tenant` |
| `bookings` | `trg_validate_booking_tenant` |

### 뷰 변경
| 뷰명 | 변경 내용 |
|------|----------|
| `receivables_summary` | amount > 0 필터 제거 (환불 포함) |
| `case_payment_summary` | `total_payments`, `total_refunds` 컬럼 추가 |

---

## 롤백 방법

필요 시 아래 SQL로 롤백 가능:

```sql
-- 함수 롤백 (ORDER BY 제거)
CREATE OR REPLACE FUNCTION get_current_tenant_id()
RETURNS UUID AS $$
  SELECT tenant_id FROM tenant_members
  WHERE user_id = auth.uid() AND status = 'active'
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 정책 롤백
DROP POLICY IF EXISTS "secure_view_invitation" ON tenant_invitations;
CREATE POLICY "public_view_invitation_by_token" ON tenant_invitations
  FOR SELECT TO authenticated
  USING (status = 'pending' AND expires_at > NOW());

-- 트리거 롤백
DROP TRIGGER IF EXISTS trg_validate_consultation_tenant ON consultations;
DROP TRIGGER IF EXISTS trg_validate_booking_tenant ON bookings;
```

---

## 적용 일시

- **마이그레이션 적용:** 2026-01-17
- **검증 완료:** 2026-01-17
