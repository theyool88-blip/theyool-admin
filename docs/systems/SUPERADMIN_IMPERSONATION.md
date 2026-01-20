# 슈퍼 어드민 Impersonation 시스템

## 개요

슈퍼 어드민이 특정 테넌트의 관점에서 시스템을 조회할 수 있는 기능입니다. 실제 Supabase 인증 없이도 테넌트의 데이터를 확인할 수 있습니다.

## 아키텍처

```
┌─────────────────────────────────────────────────────────────────┐
│                        슈퍼 어드민                               │
│                  /superadmin/tenants/[id]                       │
│                           │                                      │
│                    "Impersonate" 클릭                            │
│                           ▼                                      │
│              POST /api/superadmin/impersonate                    │
│                           │                                      │
│                    쿠키 설정 (1시간 만료)                         │
│                    sa_impersonate = base64({                     │
│                      tenantId, tenantName, expiresAt             │
│                    })                                            │
│                           │                                      │
│                           ▼                                      │
│                    리다이렉트 → /                                 │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      proxy.ts (middleware)                       │
│                           │                                      │
│              1. sa_impersonate 쿠키 확인                         │
│              2. 토큰 유효성 검증 (만료시간, tenantId)             │
│              3. 유효하면 보호된 경로 접근 허용                    │
│                           │                                      │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    페이지 컴포넌트                                │
│              (cases, clients, schedules 등)                      │
│                           │                                      │
│              getCurrentTenantContext() 호출                      │
│                           │                                      │
│              ┌────────────┴────────────┐                         │
│              ▼                         ▼                         │
│       일반 인증 사용자            Impersonation 모드              │
│    (Supabase auth.getUser)      (쿠키에서 tenantId 추출)         │
│              │                         │                         │
│              ▼                         ▼                         │
│         TenantContext 반환 (통합된 형태)                          │
└─────────────────────────────────────────────────────────────────┘
```

## 주요 파일

### 1. API 엔드포인트

**`app/api/superadmin/impersonate/route.ts`**

```typescript
// POST - Impersonation 시작
// 요청: { tenantId: string, tenantName: string }
// 응답: 쿠키 설정 후 리다이렉트 URL 반환

// DELETE - Impersonation 종료
// 응답: 쿠키 삭제 후 슈퍼어드민 페이지로 리다이렉트
```

### 2. 인증 컨텍스트

**`lib/auth/tenant-context.ts`**

```typescript
export interface TenantContext {
  tenantId: string | null
  tenantName: string
  memberId: string
  memberRole: string
  memberDisplayName: string | null
  isSuperAdmin: boolean
  isImpersonating: boolean    // Impersonation 상태 표시
}

export async function getCurrentTenantContext(): Promise<TenantContext | null>
```

### 3. 미들웨어

**`lib/supabase/middleware.ts`**

- `sa_impersonate` 쿠키 확인
- 토큰 유효성 검증 (만료시간, tenantId 존재)
- 유효한 impersonation이면 보호된 경로 접근 허용

### 4. UI 컴포넌트

**`components/ImpersonationBanner.tsx`**

- Impersonation 상태일 때 상단에 경고 배너 표시
- 테넌트 이름 표시
- "종료" 버튼으로 impersonation 해제

## 지원하는 페이지

| 경로 | 파일 | 설명 |
|------|------|------|
| `/` | `app/page.tsx` | 대시보드 |
| `/cases` | `app/cases/page.tsx` | 사건 목록 |
| `/cases/[id]` | `app/cases/[id]/page.tsx` | 사건 상세 |
| `/cases/[id]/edit` | `app/cases/[id]/edit/page.tsx` | 사건 수정 |
| `/cases/new` | `app/cases/new/page.tsx` | 사건 추가 |
| `/clients` | `app/clients/page.tsx` | 의뢰인 목록 |
| `/clients/[id]` | `app/clients/[id]/page.tsx` | 의뢰인 상세 |
| `/clients/[id]/edit` | `app/clients/[id]/edit/page.tsx` | 의뢰인 수정 |
| `/clients/new` | `app/clients/new/page.tsx` | 의뢰인 추가 |
| `/schedules` | `app/schedules/page.tsx` | 일정 목록 |

## 쿠키 구조

```typescript
// sa_impersonate 쿠키 값 (base64 인코딩)
{
  tenantId: string       // 테넌트 UUID
  tenantName: string     // 테넌트 이름 (배너 표시용)
  expiresAt: string      // ISO 8601 형식 만료시간 (1시간)
}
```

## 보안 고려사항

1. **1시간 자동 만료**: 토큰이 1시간 후 자동 만료
2. **슈퍼 어드민 전용**: impersonate API는 슈퍼 어드민만 호출 가능
3. **읽기 전용 권장**: Impersonation 모드에서는 데이터 조회만 권장
4. **명시적 표시**: ImpersonationBanner로 현재 상태 명확히 표시

## 사용 방법

### Impersonation 시작

1. `/superadmin/tenants` 접속
2. 테넌트 목록에서 테넌트 선택
3. 테넌트 상세 페이지에서 "Impersonate" 버튼 클릭
4. 해당 테넌트의 대시보드(`/`)로 리다이렉트

### Impersonation 종료

1. 상단 노란색 배너의 "종료" 버튼 클릭
2. 또는 `/superadmin/tenants/[id]` 페이지에서 "Stop Impersonation" 클릭
3. 슈퍼 어드민 페이지로 리다이렉트

## 새 페이지에 Impersonation 지원 추가하기

```typescript
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentTenantContext } from '@/lib/auth/tenant-context'

export default async function YourPage() {
  // 1. 테넌트 컨텍스트 조회 (impersonation 포함)
  const tenantContext = await getCurrentTenantContext()
  if (!tenantContext) {
    redirect('/login')
  }

  // 2. Admin client 사용 (Service Role Key)
  const adminClient = createAdminClient()

  // 3. 쿼리에 테넌트 필터 적용
  let query = adminClient.from('your_table').select('*')

  if (!tenantContext.isSuperAdmin && tenantContext.tenantId) {
    query = query.eq('tenant_id', tenantContext.tenantId)
  }

  const { data } = await query

  return <YourComponent data={data} />
}
```

## 슈퍼 어드민 테마

슈퍼 어드민 페이지는 다크 테마를 사용합니다. CSS 변수:

```css
--sa-bg-primary: #0a0a0a;      /* 메인 배경 */
--sa-bg-secondary: #111111;    /* 카드 배경 */
--sa-bg-hover: #1a1a1a;        /* 호버 배경 */
--sa-text-primary: #ffffff;    /* 메인 텍스트 */
--sa-text-muted: #888888;      /* 보조 텍스트 */
--sa-border-default: #222222;  /* 기본 테두리 */
--sa-accent: #3b82f6;          /* 강조 색상 (파랑) */
```

슈퍼 어드민 페이지에서는 Tailwind의 `text-neutral-*` 대신 CSS 변수를 사용:

```tsx
// 올바른 사용
<p className="text-[--sa-text-primary]">제목</p>
<p className="text-[--sa-text-muted]">설명</p>

// 잘못된 사용 (테마 무시됨)
<p className="text-neutral-900">제목</p>
```
