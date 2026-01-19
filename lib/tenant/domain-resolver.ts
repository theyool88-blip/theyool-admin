/**
 * 도메인 → 테넌트 매핑 리졸버
 * 홈페이지에서 도메인을 기반으로 테넌트를 식별
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// 테넌트 정보 캐시 (인메모리)
interface TenantCache {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  primaryColor?: string;
  logoUrl?: string;
  logoDarkUrl?: string;
  hasHomepage: boolean;
  cachedAt: number;
}

const tenantCache = new Map<string, TenantCache>();
const CACHE_TTL = 5 * 60 * 1000; // 5분

/**
 * 도메인에서 테넌트 정보 조회
 */
export async function resolveTenantByDomain(
  hostname: string
): Promise<TenantCache | null> {
  // 캐시 확인
  const cached = tenantCache.get(hostname);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL) {
    return cached;
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });

  // 1. 커스텀 도메인으로 조회
  let { data: tenant } = await supabase
    .from('tenants')
    .select('id, name, slug, primary_color, logo_url, logo_dark_url, has_homepage')
    .eq('homepage_domain', hostname)
    .eq('has_homepage', true)
    .single();

  // 2. 서브도메인으로 조회 (예: abc.theyool.kr)
  if (!tenant) {
    const subdomain = extractSubdomain(hostname);
    if (subdomain) {
      const result = await supabase
        .from('tenants')
        .select('id, name, slug, primary_color, logo_url, logo_dark_url, has_homepage')
        .eq('homepage_subdomain', subdomain)
        .eq('has_homepage', true)
        .single();
      tenant = result.data;
    }
  }

  // 3. 슬러그로 조회 (예: theyool.kr/abc → abc)
  if (!tenant) {
    const { data: tenantBySlug } = await supabase
      .from('tenants')
      .select('id, name, slug, primary_color, logo_url, logo_dark_url, has_homepage')
      .eq('slug', hostname)
      .eq('has_homepage', true)
      .single();
    tenant = tenantBySlug;
  }

  if (!tenant) {
    return null;
  }

  // 캐시에 저장
  const tenantInfo: TenantCache = {
    tenantId: tenant.id,
    tenantName: tenant.name,
    tenantSlug: tenant.slug,
    primaryColor: tenant.primary_color || undefined,
    logoUrl: tenant.logo_url || undefined,
    logoDarkUrl: tenant.logo_dark_url || undefined,
    hasHomepage: tenant.has_homepage,
    cachedAt: Date.now(),
  };

  tenantCache.set(hostname, tenantInfo);
  return tenantInfo;
}

/**
 * 서브도메인 추출
 * 예: abc.theyool.kr → abc
 *     www.example.com → null (www는 제외)
 */
function extractSubdomain(hostname: string): string | null {
  // theyool.kr 도메인 패턴
  const theyoolPattern = /^([^.]+)\.theyool\.kr$/i;
  const match = hostname.match(theyoolPattern);

  if (match && match[1] && match[1] !== 'www' && match[1] !== 'admin') {
    return match[1];
  }

  return null;
}

/**
 * 캐시 무효화
 */
export function invalidateTenantCache(hostname?: string): void {
  if (hostname) {
    tenantCache.delete(hostname);
  } else {
    tenantCache.clear();
  }
}

/**
 * 테넌트 ID로 도메인 정보 조회
 */
export async function getTenantDomains(
  tenantId: string
): Promise<{ domain?: string; subdomain?: string } | null> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });

  const { data: tenant } = await supabase
    .from('tenants')
    .select('homepage_domain, homepage_subdomain')
    .eq('id', tenantId)
    .single();

  if (!tenant) return null;

  return {
    domain: tenant.homepage_domain || undefined,
    subdomain: tenant.homepage_subdomain || undefined,
  };
}

/**
 * 도메인/서브도메인 유효성 검증
 */
export async function validateDomain(
  domain: string,
  excludeTenantId?: string
): Promise<{ valid: boolean; error?: string }> {
  // 기본 형식 검증
  if (!domain || domain.length < 3) {
    return { valid: false, error: '도메인이 너무 짧습니다.' };
  }

  // 예약된 서브도메인 체크
  const reservedSubdomains = ['www', 'admin', 'api', 'app', 'mail', 'ftp', 'blog'];
  const subdomain = extractSubdomain(domain);
  if (subdomain && reservedSubdomains.includes(subdomain.toLowerCase())) {
    return { valid: false, error: '사용할 수 없는 서브도메인입니다.' };
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });

  // 중복 체크 - 커스텀 도메인
  let query = supabase
    .from('tenants')
    .select('id')
    .eq('homepage_domain', domain);

  if (excludeTenantId) {
    query = query.neq('id', excludeTenantId);
  }

  const { data: existingDomain } = await query.single();
  if (existingDomain) {
    return { valid: false, error: '이미 사용 중인 도메인입니다.' };
  }

  // 중복 체크 - 서브도메인
  if (subdomain) {
    let subQuery = supabase
      .from('tenants')
      .select('id')
      .eq('homepage_subdomain', subdomain);

    if (excludeTenantId) {
      subQuery = subQuery.neq('id', excludeTenantId);
    }

    const { data: existingSubdomain } = await subQuery.single();
    if (existingSubdomain) {
      return { valid: false, error: '이미 사용 중인 서브도메인입니다.' };
    }
  }

  return { valid: true };
}

/**
 * 테넌트 테마 정보 조회 (홈페이지용)
 */
export interface TenantTheme {
  primaryColor: string;
  logoUrl?: string;
  logoDarkUrl?: string;
  tenantName: string;
}

export async function getTenantTheme(tenantId: string): Promise<TenantTheme | null> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });

  const { data: tenant } = await supabase
    .from('tenants')
    .select('name, primary_color, logo_url, logo_dark_url')
    .eq('id', tenantId)
    .single();

  if (!tenant) return null;

  return {
    primaryColor: tenant.primary_color || '#4a7c59', // 기본 sage 색상
    logoUrl: tenant.logo_url || undefined,
    logoDarkUrl: tenant.logo_dark_url || undefined,
    tenantName: tenant.name,
  };
}
