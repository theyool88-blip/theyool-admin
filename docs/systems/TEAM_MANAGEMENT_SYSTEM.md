# 팀원 관리 시스템

## 개요

법무법인/개인 사무소의 팀원(멤버) 관리 및 모듈별 세부 권한 시스템을 제공합니다.

## 접근 경로

- **팀원 관리**: `/admin/settings/team`
- **알림 설정**: `/admin/settings/alerts`
- **연동 설정**: `/admin/settings/integrations`

## 기능 구성

### 1. 멤버 관리 (`/admin/settings/team` - 멤버 탭)

| 기능 | 설명 | 권한 |
|------|------|------|
| 멤버 목록 | 현재 테넌트의 모든 멤버 조회 | owner, admin |
| 멤버 초대 | 이메일로 신규 멤버 초대 | owner, admin |
| 정보 수정 | 멤버 정보 (이름, 이메일, 전화번호, 변호사등록번호) 수정 | owner, admin |
| 역할 변경 | 멤버의 역할(admin, lawyer, staff) 변경 | owner만 |
| 정지/해제 | 멤버 계정 일시 정지 및 해제 | owner, admin |
| 제거 | 멤버를 테넌트에서 완전 제거 | owner, admin |

### 2. 권한 설정 (`/admin/settings/team` - 권한 설정 탭)

#### 역할 체계

| 역할 | 설명 | 기본 권한 |
|------|------|----------|
| owner | 테넌트 소유자 | 모든 모듈 전체 권한 (수정 불가) |
| admin | 관리자 | 모든 모듈 전체 권한 |
| lawyer | 변호사 | 본인 데이터 위주, 재무 조회만 |
| staff | 직원 | 담당 변호사 데이터만, 제한된 권한 |

#### 권한 모듈

| 모듈 | 설명 |
|------|------|
| dashboard | 대시보드 |
| calendar | 일정 및 기일 |
| cases | 사건 관리 |
| clients | 의뢰인 관리 |
| consultations | 상담 관리 |
| expenses | 지출 관리 |
| payments | 수임료 입금 |
| receivables | 미수금 |
| homepage | 홈페이지 콘텐츠 |
| settings | 시스템 설정 |
| team | 팀원 관리 |

#### 권한 액션

- **read**: 조회 권한
- **write**: 생성/수정 권한
- **delete**: 삭제 권한

#### 데이터 범위 (Data Scope)

| 범위 | 설명 |
|------|------|
| all | 테넌트 전체 데이터 |
| assigned | 담당 변호사의 데이터만 (staff용) |
| own | 본인 데이터만 |

#### 개별 권한 오버라이드

역할 기본 권한 외에 개별 멤버에게 추가/제한 권한 부여 가능:
- 특정 모듈만 권한 확장
- 특정 모듈 권한 제한
- 데이터 범위 조정

### 3. 직원-변호사 배정 (`/admin/settings/team` - 배정 탭)

직원(staff)이 담당할 변호사를 매핑하는 기능:
- 직원은 배정된 변호사의 데이터만 조회 가능
- 여러 변호사를 한 직원에게 배정 가능
- 한 변호사를 여러 직원에게 배정 가능

## API 엔드포인트

### 멤버 관리

```
GET    /api/admin/tenant/members          - 멤버 목록
POST   /api/admin/tenant/members          - 멤버 추가 (내부용)
GET    /api/admin/tenant/members/[id]     - 멤버 상세
PUT    /api/admin/tenant/members/[id]     - 멤버 수정
DELETE /api/admin/tenant/members/[id]     - 멤버 제거
POST   /api/admin/tenant/members/[id]/suspend - 정지/해제
```

### 초대

```
GET    /api/admin/tenant/invitations      - 초대 목록
POST   /api/admin/tenant/invitations      - 초대 발송
DELETE /api/admin/tenant/invitations/[id] - 초대 취소
POST   /api/admin/tenant/invitations/[id]/resend - 재발송
```

### 권한

```
GET    /api/admin/tenant/permissions      - 역할별 권한 조회
PUT    /api/admin/tenant/permissions      - 역할별 권한 수정

GET    /api/admin/tenant/permissions/member/[id]    - 멤버 권한 조회
PUT    /api/admin/tenant/permissions/member/[id]    - 멤버 권한 오버라이드
DELETE /api/admin/tenant/permissions/member/[id]    - 오버라이드 초기화
```

### 직원-변호사 배정

```
GET    /api/admin/staff-lawyer-assignments              - 배정 목록
POST   /api/admin/staff-lawyer-assignments              - 배정 추가
DELETE /api/admin/staff-lawyer-assignments?staffId=&lawyerId= - 배정 삭제
```

## 데이터베이스 스키마

### role_permissions (역할별 기본 권한)

```sql
CREATE TABLE role_permissions (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  role TEXT NOT NULL,        -- owner, admin, lawyer, staff
  module TEXT NOT NULL,      -- 권한 모듈
  can_read BOOLEAN,
  can_write BOOLEAN,
  can_delete BOOLEAN,
  data_scope TEXT,           -- all, assigned, own
  UNIQUE(tenant_id, role, module)
);
```

### member_permissions (개별 멤버 오버라이드)

```sql
CREATE TABLE member_permissions (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  member_id UUID NOT NULL,
  module TEXT NOT NULL,
  can_read BOOLEAN,          -- null이면 역할 기본값 사용
  can_write BOOLEAN,
  can_delete BOOLEAN,
  data_scope TEXT,
  UNIQUE(tenant_id, member_id, module)
);
```

## 권한 체크 로직

```typescript
// lib/auth/permission-service.ts

// 1. 효과적 권한 계산
async function getEffectivePermissions(
  tenantId: string,
  memberId: string,
  role: MemberRole
): Promise<ModulePermission[]>

// 2. 모듈 권한 체크
async function checkModulePermission(
  tenantContext: TenantContext,
  module: PermissionModule,
  action: PermissionAction
): Promise<boolean>

// 3. 데이터 범위 조회
async function getModuleDataScope(
  tenantContext: TenantContext,
  module: PermissionModule
): Promise<DataScope>
```

## 기본 역할별 권한 매트릭스

| 모듈 | Owner | Admin | Lawyer | Staff |
|------|-------|-------|--------|-------|
| dashboard | RWD | RWD | R | R |
| calendar | RWD | RWD | RW(own) | R(assigned) |
| cases | RWD | RWD | RW(own) | R(assigned) |
| clients | RWD | RWD | RW(own) | R(assigned) |
| consultations | RWD | RWD | RW | R |
| expenses | RWD | RWD | R | - |
| payments | RWD | RWD | R | - |
| receivables | RWD | RWD | R | - |
| homepage | RWD | RWD | - | - |
| settings | RWD | RWD | - | - |
| team | RWD | RW | - | - |

- R: Read, W: Write, D: Delete
- (own): 본인 데이터만
- (assigned): 담당 변호사 데이터만

## 컴포넌트 구조

```
components/team/
├── index.ts                    - 내보내기
├── MemberList.tsx              - 멤버 목록 및 관리
├── PermissionMatrix.tsx        - 역할별 권한 매트릭스
├── MemberPermissionModal.tsx   - 개별 멤버 권한 설정 모달
└── AssignmentList.tsx          - 직원-변호사 배정 목록
```

## 설정 페이지 구조

```
/admin/settings
├── (상담 시간)                  - ConsultationAvailability
├── /sources                    - 유입 경로 관리
├── /team                       - 팀원 관리
│   ├── 멤버 탭                 - MemberList
│   ├── 권한 설정 탭            - PermissionMatrix
│   └── 배정 탭                 - AssignmentList
├── /alerts                     - 알림 설정 (AlertSettings)
├── /integrations               - 연동 설정 (Google, API키)
└── /tenant                     - 사무소 설정 (기본정보, 로고)
```

## 홈페이지 관리 구조

```
/admin/homepage
├── (대시보드)                   - HomepageDashboard
├── /settings                   - 도메인 + 상담 설정
├── /monitoring                 - 방문자 모니터링
├── /analytics                  - 전환 분석
├── /blog                       - 블로그 관리
├── /faqs                       - FAQ 관리
├── /cases                      - 성공사례 관리
├── /testimonials               - 후기 관리
└── /instagram                  - 인스타그램 관리
```

## 마이그레이션

권한 시스템 마이그레이션:
```bash
# supabase/migrations/20260121_permissions_system.sql 적용
supabase db push
```

테넌트 생성 시 기본 권한 초기화:
```sql
SELECT initialize_default_permissions('tenant_id_here');
```

## 사용 예시

### 권한 체크 (서버)

```typescript
import { checkModulePermission } from '@/lib/auth/permission-service';

// API 라우트에서
const hasPermission = await checkModulePermission(
  tenantContext,
  'cases',
  'write'
);

if (!hasPermission) {
  return NextResponse.json(
    { success: false, error: '권한이 없습니다.' },
    { status: 403 }
  );
}
```

### 데이터 범위 필터링

```typescript
import { getModuleDataScope } from '@/lib/auth/permission-service';

const scope = await getModuleDataScope(tenantContext, 'cases');

let query = supabase.from('cases').select('*');

if (scope === 'own') {
  query = query.eq('assigned_lawyer_id', tenantContext.userId);
} else if (scope === 'assigned') {
  // 담당 변호사 목록 조회 후 필터
  const lawyerIds = await getAssignedLawyerIds(tenantContext.memberId);
  query = query.in('assigned_lawyer_id', lawyerIds);
}
```
