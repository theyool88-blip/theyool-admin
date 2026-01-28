/**
 * API 라우트용 테넌트 래퍼
 * 테넌트 컨텍스트를 자동으로 주입하고 권한을 확인
 * Next.js 16+ 호환
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentTenantContext, isSuperAdmin as checkSuperAdmin } from '@/lib/auth/tenant-context';
import type { TenantContext, MemberRole } from '@/types/tenant';

// Next.js 16+ route handler context type
type RouteSegmentData = {
  params: Promise<Record<string, string | string[] | undefined>>;
};

// API 핸들러 타입 (Next.js 16+ 호환)
type TenantHandler = (
  request: NextRequest,
  context: { tenant: TenantContext; params?: Record<string, string> }
) => Promise<NextResponse>;

type SuperAdminHandler = (
  request: NextRequest,
  context: { params?: Record<string, string> }
) => Promise<NextResponse>;

// 에러 응답 헬퍼
function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

// params를 Record<string, string>로 변환 (string[] → 첫번째 값)
function normalizeParams(raw: Record<string, string | string[] | undefined>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === 'string') {
      result[key] = value;
    } else if (Array.isArray(value) && value.length > 0) {
      result[key] = value[0];
    }
  }
  return result;
}

/**
 * 테넌트 인증 래퍼
 * - 로그인 확인
 * - 테넌트 멤버십 확인
 * - 테넌트 컨텍스트 주입
 */
export function withTenant(handler: TenantHandler) {
  return async (
    request: NextRequest,
    segmentData: RouteSegmentData
  ) => {
    try {
      const tenant = await getCurrentTenantContext();

      if (!tenant) {
        return errorResponse('Unauthorized: Not authenticated or not a tenant member', 401);
      }

      // 테넌트가 없는 슈퍼 어드민의 경우 (테넌트 ID 필요)
      if (!tenant.tenantId && !tenant.isSuperAdmin) {
        return errorResponse('Unauthorized: No tenant access', 401);
      }

      // Next.js 16+: params는 항상 Promise
      const rawParams = await segmentData.params;
      const params = normalizeParams(rawParams);

      return handler(request, { tenant, params });
    } catch (error) {
      console.error('withTenant error:', error);
      return errorResponse('Internal server error', 500);
    }
  };
}

/**
 * 특정 역할 이상 요구 래퍼
 * @param requiredRole 필요한 최소 역할
 */
export function withRole(requiredRole: MemberRole) {
  return function (handler: TenantHandler) {
    return async (
      request: NextRequest,
      segmentData: RouteSegmentData
    ) => {
      try {
        const tenant = await getCurrentTenantContext();

        if (!tenant) {
          return errorResponse('Unauthorized: Not authenticated', 401);
        }

        // 슈퍼 어드민은 모든 역할 접근 가능
        if (!tenant.isSuperAdmin) {
          const roleHierarchy: Record<MemberRole, number> = {
            owner: 4,
            admin: 3,
            lawyer: 2,
            staff: 1,
          };

          if (roleHierarchy[tenant.memberRole] < roleHierarchy[requiredRole]) {
            return errorResponse(
              `Forbidden: Requires ${requiredRole} role or higher`,
              403
            );
          }
        }

        // Next.js 16+: params는 항상 Promise
        const rawParams = await segmentData.params;
        const params = normalizeParams(rawParams);

        return handler(request, { tenant, params });
      } catch (error) {
        console.error('withRole error:', error);
        return errorResponse('Internal server error', 500);
      }
    };
  };
}

/**
 * 슈퍼 어드민 전용 래퍼
 */
export function withSuperAdmin(handler: SuperAdminHandler) {
  return async (
    request: NextRequest,
    segmentData: RouteSegmentData
  ) => {
    try {
      const isSuperAdminUser = await checkSuperAdmin();

      if (!isSuperAdminUser) {
        return errorResponse('Forbidden: Super admin access required', 403);
      }

      // Next.js 16+: params는 항상 Promise
      const rawParams = await segmentData.params;
      const params = normalizeParams(rawParams);

      return handler(request, { params });
    } catch (error) {
      console.error('withSuperAdmin error:', error);
      return errorResponse('Internal server error', 500);
    }
  };
}

/**
 * 테넌트 또는 슈퍼 어드민 래퍼
 * - 슈퍼 어드민: 모든 테넌트 접근 가능
 * - 일반 멤버: 자신의 테넌트만 접근
 */
export function withTenantOrSuperAdmin(handler: TenantHandler) {
  return async (
    request: NextRequest,
    segmentData: RouteSegmentData
  ) => {
    try {
      const tenant = await getCurrentTenantContext();

      if (!tenant) {
        return errorResponse('Unauthorized: Not authenticated', 401);
      }

      // Next.js 16+: params는 항상 Promise
      const rawParams = await segmentData.params;
      const params = normalizeParams(rawParams);

      // 슈퍼 어드민인 경우 특정 테넌트 ID를 쿼리에서 가져올 수 있음
      if (tenant.isSuperAdmin && !tenant.tenantId) {
        const url = new URL(request.url);
        const queryTenantId = url.searchParams.get('tenant_id');

        if (queryTenantId) {
          // 슈퍼 어드민용 컨텍스트 생성
          const superAdminContext: TenantContext = {
            ...tenant,
            tenantId: queryTenantId,
          };
          return handler(request, { tenant: superAdminContext, params });
        }
      }

      return handler(request, { tenant, params });
    } catch (error) {
      console.error('withTenantOrSuperAdmin error:', error);
      return errorResponse('Internal server error', 500);
    }
  };
}

/**
 * 공개 API (인증 불필요) + 선택적 테넌트 컨텍스트
 */
export function withOptionalTenant(
  handler: (
    request: NextRequest,
    context: { tenant: TenantContext | null; params?: Record<string, string> }
  ) => Promise<NextResponse>
) {
  return async (
    request: NextRequest,
    segmentData: RouteSegmentData
  ) => {
    try {
      const tenant = await getCurrentTenantContext();

      // Next.js 16+: params는 항상 Promise
      const rawParams = await segmentData.params;
      const params = normalizeParams(rawParams);

      return handler(request, { tenant, params });
    } catch (error) {
      console.error('withOptionalTenant error:', error);
      return errorResponse('Internal server error', 500);
    }
  };
}

/**
 * 테넌트 ID 필터 헬퍼
 * Supabase 쿼리에 테넌트 필터 추가
 */
export function addTenantFilter<T extends { eq: (column: string, value: string) => T }>(
  query: T,
  tenant: TenantContext
): T {
  if (!tenant.isSuperAdmin && tenant.tenantId) {
    return query.eq('tenant_id', tenant.tenantId);
  }
  return query;
}

/**
 * 새 레코드에 테넌트 ID 추가 헬퍼
 */
export function withTenantId<T extends Record<string, unknown>>(
  data: T,
  tenant: TenantContext
): T & { tenant_id: string } {
  return {
    ...data,
    tenant_id: tenant.tenantId,
  };
}
