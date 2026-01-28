/**
 * 홈페이지 기능 활성화 여부 검증 미들웨어
 * has_homepage가 true인 테넌트만 접근 가능하도록 제한
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentTenantContext } from '@/lib/auth/tenant-context';
import { createClient } from '@/lib/supabase/server';
import type { TenantContext } from '@/types/tenant';

// Next.js 16+ route handler context type
type RouteSegmentData = {
  params: Promise<Record<string, string | string[] | undefined>>;
};

type HomepageHandler = (
  request: NextRequest,
  context: { tenant: TenantContext; params?: Record<string, string> }
) => Promise<NextResponse>;

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
 * 홈페이지 기능 활성화 여부 검증 미들웨어
 * staff 이상 권한 + has_homepage=true 필요
 */
export function withHomepage(handler: HomepageHandler) {
  return async (
    request: NextRequest,
    segmentData: RouteSegmentData
  ) => {
    try {
      const tenant = await getCurrentTenantContext();

      if (!tenant) {
        return errorResponse('Unauthorized: Not authenticated', 401);
      }

      // 슈퍼 어드민은 테넌트 컨텍스트가 없을 수 있음
      if (!tenant.tenantId && !tenant.isSuperAdmin) {
        return errorResponse('Unauthorized: No tenant access', 401);
      }

      // staff 이상 역할 확인 (슈퍼 어드민은 통과)
      if (!tenant.isSuperAdmin) {
        const roleHierarchy: Record<string, number> = {
          owner: 4,
          admin: 3,
          lawyer: 2,
          staff: 1,
        };

        if (roleHierarchy[tenant.memberRole] < roleHierarchy['staff']) {
          return errorResponse('Forbidden: Requires staff role or higher', 403);
        }

        // 홈페이지 기능 활성화 확인
        if (!tenant.hasHomepage) {
          return errorResponse('Forbidden: Homepage feature is not enabled for this tenant', 403);
        }
      }

      // Next.js 16+: params는 항상 Promise
      const rawParams = await segmentData.params;
      const params = normalizeParams(rawParams);

      return handler(request, { tenant, params });
    } catch (error) {
      console.error('withHomepage error:', error);
      return errorResponse('Internal server error', 500);
    }
  };
}

/**
 * 홈페이지 콘텐츠 통계 조회 헬퍼
 */
export async function getHomepageStats(tenantId: string) {
  const supabase = await createClient();

  const [blogResult, faqResult, casesResult, testimonialsResult, instagramResult] = await Promise.all([
    supabase.from('homepage_blog_posts').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
    supabase.from('homepage_faqs').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
    supabase.from('homepage_cases').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
    supabase.from('homepage_testimonials').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
    supabase.from('homepage_instagram_posts').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
  ]);

  return {
    blog: blogResult.count || 0,
    faqs: faqResult.count || 0,
    cases: casesResult.count || 0,
    testimonials: testimonialsResult.count || 0,
    instagram: instagramResult.count || 0,
  };
}

/**
 * 홈페이지 콘텐츠 상세 통계 조회 (published/draft 포함)
 */
export async function getHomepageDetailedStats(tenantId: string) {
  const supabase = await createClient();

  const [
    blogTotal,
    blogPublished,
    faqTotal,
    faqPublished,
    casesTotal,
    casesPublished,
    testimonialsTotal,
    testimonialsPublished,
    instagramTotal,
    instagramPublished,
  ] = await Promise.all([
    supabase.from('homepage_blog_posts').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
    supabase.from('homepage_blog_posts').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('status', 'published'),
    supabase.from('homepage_faqs').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
    supabase.from('homepage_faqs').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('status', 'published'),
    supabase.from('homepage_cases').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
    supabase.from('homepage_cases').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('status', 'published'),
    supabase.from('homepage_testimonials').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
    supabase.from('homepage_testimonials').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('status', 'published'),
    supabase.from('homepage_instagram_posts').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
    supabase.from('homepage_instagram_posts').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('is_visible', true),
  ]);

  return {
    blog: {
      total: blogTotal.count || 0,
      published: blogPublished.count || 0,
      draft: (blogTotal.count || 0) - (blogPublished.count || 0),
    },
    faqs: {
      total: faqTotal.count || 0,
      published: faqPublished.count || 0,
      draft: (faqTotal.count || 0) - (faqPublished.count || 0),
    },
    cases: {
      total: casesTotal.count || 0,
      published: casesPublished.count || 0,
      draft: (casesTotal.count || 0) - (casesPublished.count || 0),
    },
    testimonials: {
      total: testimonialsTotal.count || 0,
      published: testimonialsPublished.count || 0,
      draft: (testimonialsTotal.count || 0) - (testimonialsPublished.count || 0),
    },
    instagram: {
      total: instagramTotal.count || 0,
      published: instagramPublished.count || 0,
      draft: (instagramTotal.count || 0) - (instagramPublished.count || 0),
    },
  };
}
