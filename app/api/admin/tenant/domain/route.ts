/**
 * 테넌트 도메인 관리
 * GET /api/admin/tenant/domain - 도메인 정보 조회
 * PUT /api/admin/tenant/domain - 도메인 설정 저장
 * POST /api/admin/tenant/domain/validate - 도메인 유효성 검증
 */

import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/lib/api/with-tenant';
import { createClient } from '@supabase/supabase-js';
import {
  validateDomain,
  invalidateTenantCache,
} from '@/lib/tenant/domain-resolver';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const getServiceClient = () => {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });
};

// GET - 도메인 정보 조회
export const GET = withRole('admin')(async (request, { tenant }) => {
  const supabase = getServiceClient();

  const { data: tenantData } = await supabase
    .from('tenants')
    .select('homepage_domain, homepage_subdomain, has_homepage, primary_color')
    .eq('id', tenant.tenantId)
    .single();

  if (!tenantData) {
    return NextResponse.json(
      { success: false, error: '테넌트를 찾을 수 없습니다.' },
      { status: 404 }
    );
  }

  return NextResponse.json({
    success: true,
    data: {
      domain: tenantData.homepage_domain,
      subdomain: tenantData.homepage_subdomain,
      hasHomepage: tenantData.has_homepage,
      primaryColor: tenantData.primary_color,
      // DNS 설정 안내
      dnsInstructions: {
        cname: 'cname.vercel-dns.com', // Vercel 사용 시
        // 또는 Cloudflare Pages 사용 시
        // cname: '[project].pages.dev',
      },
    },
  });
});

// PUT - 도메인 설정 저장
export const PUT = withRole('admin')(async (request, { tenant }) => {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid request body' },
      { status: 400 }
    );
  }

  const { domain, subdomain, primaryColor } = body as {
    domain?: string;
    subdomain?: string;
    primaryColor?: string;
  };

  const supabase = getServiceClient();

  // 기존 도메인 조회 (캐시 무효화용)
  const { data: existingTenant } = await supabase
    .from('tenants')
    .select('homepage_domain, homepage_subdomain')
    .eq('id', tenant.tenantId)
    .single();

  // 도메인 유효성 검증
  if (domain) {
    const validation = await validateDomain(domain, tenant.tenantId);
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      );
    }
  }

  // 서브도메인 유효성 검증
  if (subdomain) {
    const subdomainFull = `${subdomain}.theyool.kr`;
    const validation = await validateDomain(subdomainFull, tenant.tenantId);
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      );
    }
  }

  // 업데이트
  const updateData: Record<string, unknown> = {};
  if (domain !== undefined) updateData.homepage_domain = domain || null;
  if (subdomain !== undefined) updateData.homepage_subdomain = subdomain || null;
  if (primaryColor !== undefined) updateData.primary_color = primaryColor || null;

  const { error } = await supabase
    .from('tenants')
    .update(updateData)
    .eq('id', tenant.tenantId);

  if (error) {
    console.error('Failed to update domain:', error);
    return NextResponse.json(
      { success: false, error: '도메인 설정 저장에 실패했습니다.' },
      { status: 500 }
    );
  }

  // 캐시 무효화
  if (existingTenant?.homepage_domain) {
    invalidateTenantCache(existingTenant.homepage_domain);
  }
  if (existingTenant?.homepage_subdomain) {
    invalidateTenantCache(`${existingTenant.homepage_subdomain}.theyool.kr`);
  }
  if (domain) {
    invalidateTenantCache(domain);
  }
  if (subdomain) {
    invalidateTenantCache(`${subdomain}.theyool.kr`);
  }

  return NextResponse.json({
    success: true,
    message: '도메인 설정이 저장되었습니다.',
  });
});

// POST - 도메인 유효성 검증
export const POST = withRole('admin')(async (request, { tenant }) => {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid request body' },
      { status: 400 }
    );
  }

  const { domain, subdomain } = body as {
    domain?: string;
    subdomain?: string;
  };

  if (domain) {
    const validation = await validateDomain(domain, tenant.tenantId);
    return NextResponse.json({
      success: true,
      data: {
        domain,
        valid: validation.valid,
        error: validation.error,
      },
    });
  }

  if (subdomain) {
    const subdomainFull = `${subdomain}.theyool.kr`;
    const validation = await validateDomain(subdomainFull, tenant.tenantId);
    return NextResponse.json({
      success: true,
      data: {
        subdomain,
        valid: validation.valid,
        error: validation.error,
      },
    });
  }

  return NextResponse.json(
    { success: false, error: '도메인 또는 서브도메인을 입력하세요.' },
    { status: 400 }
  );
});
