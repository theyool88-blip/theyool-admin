# 멀티테넌트 SaaS 시스템

> **상태**: Phase 1-5 완료, Phase 6 (E2E 테스트) 진행 중
> **마지막 업데이트**: 2025-12-31
> **검증 보고서**: [SAAS_VERIFICATION_REPORT.md](../SAAS_VERIFICATION_REPORT.md)

## 개요

법률 사건관리 시스템을 멀티테넌트 SaaS로 전환하여 변호사 회원이 가입하고 독립적인 서비스를 이용할 수 있도록 합니다.

## 핵심 개념

### 테넌트 모델 (Hybrid)

```
┌─────────────────────────────────────────────────────────┐
│                    Super Admin                          │
│              (모든 테넌트 관리 권한)                      │
└────────────────────────┬────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
┌───────▼───────┐ ┌──────▼──────┐ ┌───────▼───────┐
│   Tenant A    │ │  Tenant B   │ │   Tenant C    │
│ (법무법인 더율)│ │ (개인 변호사)│ │  (법무법인 X) │
└───────┬───────┘ └──────┬──────┘ └───────┬───────┘
        │                │                │
   ┌────┴────┐      ┌────┴────┐      ┌────┴────┐
   │ Members │      │ Members │      │ Members │
   │ - Owner │      │ - Owner │      │ - Owner │
   │ - Lawyer│      └─────────┘      │ - Admin │
   │ - Staff │                       │ - Lawyer│
   └─────────┘                       │ - Staff │
                                     └─────────┘
```

### 역할 계층

| 역할 | 레벨 | 권한 |
|------|------|------|
| **Super Admin** | ∞ | 모든 테넌트 관리, 시스템 설정 |
| **Owner** | 4 | 테넌트 설정, 멤버 관리, 결제 |
| **Admin** | 3 | 멤버 관리, 설정 변경 (Owner 제외) |
| **Lawyer** | 2 | 사건 관리, 의뢰인 관리 |
| **Staff** | 1 | 제한된 조회, 일부 수정 |

## 권한 시스템

### 계정 유형 (단순화)

SaaS 보편화를 위해 권한을 2가지 유형으로 단순화:

| 유형 | 역할 | 접근 가능 모듈 |
|------|------|----------------|
| **전체 권한** | owner, admin | 모든 모듈 (회계 포함) |
| **회계 제외** | lawyer, staff | 사건, 의뢰인, 상담, 캘린더 |

### 모듈별 권한

```typescript
// lib/auth/permissions.ts

// 회계 모듈 (제한된 계정 접근 불가)
const ACCOUNTING_MODULES = ['payments', 'expenses', 'receivables'];

// 관리자 전용 모듈
const ADMIN_ONLY_MODULES = ['settings', 'members'];

// 전체 권한 역할
const FULL_ACCESS_ROLES = ['owner', 'admin'];

// 회계 제외 역할
const LIMITED_ROLES = ['lawyer', 'staff'];
```

### 권한 체크 함수

```typescript
// 모듈 접근 가능 여부
canAccessModule(role: MemberRole, module: PermissionModule): boolean

// 회계 모듈 접근 가능 여부
canAccessAccounting(role: MemberRole): boolean

// 설정/멤버 관리 가능 여부
canManageSettings(role: MemberRole): boolean

// 접근 가능한 모듈 목록
getAccessibleModules(role: MemberRole): PermissionModule[]
```

### API에서 사용

```typescript
import { withTenant } from '@/lib/api/with-tenant';
import { canAccessModule } from '@/lib/auth/permissions';

export const GET = withTenant(async (request, { tenant }) => {
  // 회계 모듈 접근 권한 체크
  if (!canAccessModule(tenant.memberRole, 'payments')) {
    return NextResponse.json({ error: '접근 권한 없음' }, { status: 403 });
  }

  // ... 로직
});
```

## 테넌트 설정 시스템

### tenant_settings 테이블

```sql
CREATE TABLE tenant_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  category VARCHAR(50) NOT NULL, -- cases, payments, expenses, consultations
  settings JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, category)
);
```

### 설정 카테고리별 스키마

```typescript
// 사건 설정
interface CaseSettings {
  branches: { id: string; name: string }[];
  caseTypes: { value: string; label: string }[];
  scourtEnabled: boolean;
}

// 상담 설정
interface ConsultationSettings {
  categories: { value: string; label: string }[];
  defaultFee?: number;
  autoAssignLawyer: boolean;
  officeLocations: string[];
}

// 지출 설정
interface ExpenseSettings {
  categories: string[];
  officeLocations: string[];
}

// 수임료 설정
interface PaymentSettings {
  categories: { value: string; label: string }[];
  receiptTypes: { value: string; label: string }[];
  officeLocations: string[];
}
```

### 설정 API

```
GET  /api/admin/tenant/settings?category=consultations
PUT  /api/admin/tenant/settings
```

## 클라이언트 훅

### useTenant

현재 로그인한 사용자의 테넌트 정보와 역할을 조회합니다.

```typescript
// hooks/useTenant.ts
const {
  tenantId,
  tenantName,
  tenantLogo,
  memberRole,
  isSuperAdmin,
  isLoading
} = useTenant();
```

**사용 예시 (AdminHeader)**:
```typescript
import { useTenant } from '@/hooks/useTenant';
import { canAccessModule } from '@/lib/auth/permissions';

function AdminHeader() {
  const { memberRole } = useTenant();

  // 권한 기반 메뉴 필터링
  const menuItems = allMenuItems.filter(item =>
    !item.module || canAccessModule(memberRole, item.module)
  );
}
```

### useTenantOptions

테넌트의 변호사 목록과 사무소 위치를 동적으로 가져옵니다.

```typescript
// hooks/useTenantOptions.ts
const {
  lawyerNames,      // string[] - 활성 멤버 중 변호사 이름 목록
  officeLocations,  // string[] - 테넌트 설정의 사무소 위치
  isLoading
} = useTenantOptions();
```

**사용 예시 (ConsultationScheduleModal)**:
```typescript
import { useTenantOptions } from '@/hooks/useTenantOptions';

function ConsultationScheduleModal() {
  const { lawyerNames, officeLocations } = useTenantOptions();

  return (
    <select>
      {lawyerNames.map(name => (
        <option key={name} value={name}>{name}</option>
      ))}
    </select>
  );
}
```

**데이터 소스**:
- `lawyerNames`: `/api/admin/tenant` → `members` (role='lawyer'/'owner'/'admin', status='active')
- `officeLocations`: `/api/admin/tenant/settings` → `consultations.offices` 또는 `cases.branches`

## 데이터베이스 스키마

### 신규 테이블

#### tenants
```sql
tenants
├── id (UUID, PK)
├── name (VARCHAR) - 사무소명
├── slug (VARCHAR, UNIQUE) - URL 슬러그
├── type (VARCHAR) - individual/firm
├── has_homepage (BOOLEAN) - 홈페이지 연결 여부
├── plan (VARCHAR) - basic/professional/enterprise
├── features (JSONB) - 활성화된 기능
├── settings (JSONB) - 테넌트 설정
└── status (VARCHAR) - active/suspended/cancelled
```

#### tenant_members
```sql
tenant_members
├── id (UUID, PK)
├── tenant_id (UUID, FK → tenants)
├── user_id (UUID, FK → auth.users)
├── role (VARCHAR) - owner/admin/lawyer/staff
├── display_name (VARCHAR)
├── bar_number (VARCHAR) - 변호사 등록번호
├── permissions (JSONB) - 추가 권한
└── status (VARCHAR) - active/invited/suspended
```

#### super_admins
```sql
super_admins
├── id (UUID, PK)
├── user_id (UUID, FK → auth.users)
└── permissions (JSONB) - 권한 목록
```

### 기존 테이블 변경

모든 주요 테이블에 `tenant_id` 컬럼 추가:

- `clients`
- `legal_cases`
- `consultations`
- `payments`
- `expenses`
- `bookings`
- `general_schedules`
- `scourt_*` 테이블들

## RLS 정책

### 핵심 헬퍼 함수

```sql
-- 현재 사용자의 테넌트 ID
get_current_tenant_id() → UUID

-- 슈퍼 어드민 확인
is_super_admin() → BOOLEAN

-- 특정 역할 이상 확인
has_role_or_higher(role) → BOOLEAN
```

### 정책 패턴

```sql
-- 기본 테넌트 격리 정책
CREATE POLICY "tenant_isolation" ON [table]
  FOR ALL
  USING (is_super_admin() OR tenant_id = get_current_tenant_id());
```

## WMONID 관리

### 50건 제한

- DB 트리거로 강제: `check_wmonid_case_limit()`
- INSERT 시 자동 체크
- 제한 도달 시 에러 발생

### 멤버별 WMONID

```sql
scourt_user_wmonid
├── tenant_id (UUID) - 테넌트 소속
├── member_id (UUID) - 담당 변호사(멤버)
└── case_count (INTEGER) - 현재 사건 수 (최대 50)
```

## 마이그레이션 파일

| 파일 | 설명 |
|------|------|
| `20260101_create_tenant_system.sql` | 신규 테이블 생성 |
| `20260102_add_tenant_id.sql` | 기존 테이블에 tenant_id 추가 |
| `20260103_wmonid_limits.sql` | WMONID 50건 제한 |
| `20260104_tenant_rls.sql` | RLS 정책 업데이트 |
| `20260105_migrate_theyool.sql` | 기존 더율 데이터 마이그레이션 |

## 적용 방법

### 1. 마이그레이션 실행

```bash
# Supabase CLI 사용
supabase db push

# 또는 직접 SQL 실행
psql -h [host] -U [user] -d [db] -f supabase/migrations/20260101_create_tenant_system.sql
psql -h [host] -U [user] -d [db] -f supabase/migrations/20260102_add_tenant_id.sql
psql -h [host] -U [user] -d [db] -f supabase/migrations/20260103_wmonid_limits.sql
psql -h [host] -U [user] -d [db] -f supabase/migrations/20260104_tenant_rls.sql
psql -h [host] -U [user] -d [db] -f supabase/migrations/20260105_migrate_theyool.sql
```

### 2. 마이그레이션 확인

```sql
-- 테넌트 생성 확인
SELECT * FROM tenants;

-- 멤버 마이그레이션 확인
SELECT * FROM tenant_members;

-- 슈퍼 어드민 확인
SELECT * FROM super_admins;

-- 데이터 마이그레이션 확인
SELECT
  'clients' AS table_name,
  COUNT(*) FILTER (WHERE tenant_id IS NOT NULL) AS migrated,
  COUNT(*) FILTER (WHERE tenant_id IS NULL) AS remaining
FROM clients;
```

## API 사용법 (구현 예정)

### 테넌트 컨텍스트

```typescript
import { getCurrentTenantContext } from '@/lib/auth/tenant-context';

// 현재 테넌트 정보 가져오기
const tenant = await getCurrentTenantContext();
// {
//   tenantId: 'uuid',
//   tenantName: '법무법인 더율',
//   tenantSlug: 'theyool',
//   hasHomepage: true,
//   memberRole: 'owner',
//   memberId: 'uuid'
// }
```

### API 래퍼

```typescript
import { withTenant } from '@/lib/api/with-tenant';

// 테넌트 격리된 API
export const GET = withTenant(async (request, { tenant }) => {
  const cases = await supabase
    .from('legal_cases')
    .select('*')
    .eq('tenant_id', tenant.tenantId);

  return NextResponse.json({ cases });
});
```

## SaaS 보편화 작업

### 개요

더율 전용 하드코딩을 제거하고 보편적인 SaaS로 전환하는 작업입니다.

### 완료된 작업

#### 1. 하드코딩 제거

| 파일 | 변경 내용 |
|------|----------|
| `types/consultation.ts` | `LAWYER_NAMES`, `OFFICE_LOCATIONS` 동적화 |
| `types/expense.ts` | 카테고리/지역 동적화, 파트너 정산 타입 삭제 |
| `lib/supabase/expenses.ts` | 정산 함수 제거, tenantId 지원 |

#### 2. 파트너 정산 기능 삭제

더율 전용 2인 파트너 정산 기능을 완전히 제거:

**삭제된 파일:**
- `app/api/admin/expenses/settlements/` (디렉토리)
- `app/api/admin/expenses/withdrawals/` (디렉토리)
- `app/admin/expenses/withdrawals/page.tsx`
- `components/admin/WithdrawalFormModal.tsx`

**삭제된 타입:**
- `PartnerWithdrawal`
- `MonthlySettlement`
- `PartnerDebtStatus`
- `SettlementDashboard`
- `kim_*`, `lim_*` 관련 필드

**삭제된 함수:**
- `getPartnerWithdrawals()`
- `createPartnerWithdrawal()`
- `getMonthlySettlements()`
- `getLatestSettlement()`
- `calculatePartnerDebt()`
- `exportSettlementsToExcel()`
- `exportWithdrawalsToExcel()`

#### 3. 테넌트 격리 보완

- `receivables` API에 withTenant 래퍼 적용
- `receivables/memos` API에 withTenant 래퍼 적용

#### 4. 권한 체크 적용

**API 라우트:**
- `payments` API (GET/POST) - `canAccessModuleWithContext(tenant, 'payments')`
- `expenses` API (GET/POST) - `canAccessModuleWithContext(tenant, 'expenses')`
- `receivables` API (GET, memos POST/PATCH/DELETE) - `canAccessAccountingWithContext(tenant)`

**프론트엔드:**
- `AdminHeader.tsx` - memberRole prop 추가, 메뉴별 module 지정 및 필터링

### 남은 작업

- [ ] 프론트엔드 컴포넌트에서 동적 데이터 연동
  - `ConsultationAvailability.tsx` - LAWYER_NAMES, OFFICE_LOCATIONS API 연동
  - `ConsultationScheduleModal.tsx` - LAWYER_NAMES, OFFICE_LOCATIONS API 연동
- [ ] AdminHeader에 memberRole 전달 (각 페이지에서)

## 완료된 작업

### Phase 4 - 백엔드 코드 (완료)
- [x] `lib/auth/tenant-context.ts` - 테넌트 컨텍스트 함수
- [x] `lib/api/with-tenant.ts` - API 래퍼 (Next.js 16+ 호환)
- [x] `lib/api/with-super-admin.ts` - 슈퍼 어드민 API 래퍼
- [x] `types/tenant.ts` - 테넌트 타입 정의
- [x] API 라우트 테넌트 격리 적용:
  - `/api/admin/cases` - GET/POST
  - `/api/admin/clients` - GET/POST
  - `/api/admin/consultations` - GET
  - `/api/admin/payments` - GET/POST
  - `/api/admin/expenses` - GET/POST
  - `/api/admin/court-hearings` - GET/POST
  - `/api/admin/case-deadlines` - GET/POST
  - `/api/admin/dashboard` - GET (통계)
  - `/api/admin/calendar` - GET (통합 캘린더)
  - `/api/admin/availability/weekly` - GET/POST
  - `/api/admin/availability/exceptions` - GET/POST
  - `/api/admin/tenant` - GET/PUT (테넌트 정보)
- [x] lib 함수 테넌트 지원:
  - `lib/supabase/consultations.ts`
  - `lib/supabase/court-hearings.ts`
  - `lib/supabase/case-deadlines.ts`

### Phase 5 - 프론트엔드 (완료)
- [x] `app/register/lawyer/page.tsx` - 변호사 회원가입 페이지
  - 3단계 가입 폼 (기본정보 → 사무소정보 → 약관동의)
  - 개인/법무법인 선택
  - 홈페이지 서비스 연결 옵션
- [x] `app/api/auth/register/lawyer/route.ts` - 회원가입 API
- [x] `lib/auth/lawyer-registration.ts` - 회원가입 로직
- [x] `app/superadmin/page.tsx` - 슈퍼 어드민 대시보드
  - 전체 통계 (테넌트, 멤버, 사건, 상담)
  - 플랜별/유형별 분포
  - 최근 가입 테넌트
- [x] `app/superadmin/tenants/page.tsx` - 테넌트 관리 목록
  - 검색, 필터, 정렬
  - 페이지네이션
  - 테넌트별 통계
- [x] `app/api/superadmin/stats/route.ts` - 슈퍼 어드민 통계 API
- [x] `app/api/superadmin/tenants/route.ts` - 테넌트 목록 API
- [x] `app/admin/settings/tenant/page.tsx` - 테넌트 설정 페이지
  - 사무소 정보 수정
  - 팀원 목록
  - 현황 통계
  - 플랜 정보

## 다음 단계

- [ ] 테스트 및 배포 (Phase 6)
  - 신규 회원가입 테스트
  - 테넌트간 데이터 격리 검증
  - WMONID 50건 제한 테스트
- [ ] 추가 기능 (선택)
  - 팀원 초대 기능
  - 결제 연동
  - 홈페이지 빌더

## 관련 문서

- [계획 파일](/Users/hskim/.claude/plans/giggly-coalescing-globe.md)
- [WMONID 시스템](/docs/systems/SCOURT_API_ANALYSIS.md)
