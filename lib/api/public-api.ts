/**
 * Public API 유틸리티
 * - 홈페이지에서 호출하는 인증 불필요 API용
 * - API Key 검증, Origin 검증, Rate Limiting
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import bcrypt from 'bcryptjs';

// ============================================================================
// 환경 변수
// ============================================================================

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// 개발 환경 기본 테넌트 (법무법인 더율)
// theyool 홈페이지에서 API Key 없이 호출할 때 사용
const DEV_DEFAULT_TENANT_ID = process.env.DEV_DEFAULT_TENANT_ID;

// Service Role 클라이언트 (RLS 우회)
const getServiceClient = () => {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });
};

// ============================================================================
// 타입 정의
// ============================================================================

export interface ApiKeyContext {
  tenantId: string;
  keyId: string;
  scopes: string[];
  rateLimitPerMinute: number;
}

export interface PublicApiContext {
  tenantId: string;
  apiKey?: ApiKeyContext;
  origin?: string;
}

type PublicApiHandler = (
  request: NextRequest,
  context: PublicApiContext
) => Promise<NextResponse>;

// ============================================================================
// 입력 검증 스키마 (Zod)
// ============================================================================

// 전화번호 정규식 (한국)
const phoneRegex = /^01[0-9]-?[0-9]{3,4}-?[0-9]{4}$/;

// 문자열 정리 함수
const sanitizeString = (str: string) => {
  return str.trim().replace(/[<>]/g, '');
};

// 상담 신청 스키마
export const consultationSchema = z.object({
  name: z.string().min(2, '이름은 2자 이상이어야 합니다')
    .max(50, '이름은 50자 이하여야 합니다')
    .transform(sanitizeString),
  phone: z.string().regex(phoneRegex, '유효한 전화번호 형식이 아닙니다'),
  email: z.string().email('유효한 이메일 형식이 아닙니다').optional().or(z.literal('')),
  category: z.string().max(100).optional(),
  message: z.string().max(2000).optional(),
  preferredDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '날짜 형식이 올바르지 않습니다').optional(),
  preferredTime: z.string().regex(/^\d{2}:\d{2}$/, '시간 형식이 올바르지 않습니다').optional(),
  utmSource: z.string().max(100).optional(),
  utmMedium: z.string().max(100).optional(),
  utmCampaign: z.string().max(100).optional(),
  visitorSessionId: z.string().uuid().optional(),
  captchaToken: z.string().optional(),  // Cloudflare Turnstile 토큰
});

// 예약 스키마
export const bookingSchema = z.object({
  name: z.string().min(2).max(50).transform(sanitizeString),
  phone: z.string().regex(phoneRegex),
  email: z.string().email().optional().or(z.literal('')),
  type: z.enum(['visit', 'video', 'phone']),
  preferredDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  preferredTime: z.string().regex(/^\d{2}:\d{2}$/),
  category: z.string().max(100).optional(),
  message: z.string().max(2000).optional(),
  officeLocation: z.string().max(100).optional(),
  preferredLawyerId: z.string().uuid().optional(),
  utmSource: z.string().max(100).optional(),
  utmMedium: z.string().max(100).optional(),
  utmCampaign: z.string().max(100).optional(),
  visitorSessionId: z.string().uuid().optional(),
  captchaToken: z.string().optional(),
});

// 방문자 이벤트 스키마
export const visitorEventSchema = z.object({
  visitorId: z.string().min(1).max(100),
  sessionId: z.string().min(1).max(100),
  eventType: z.enum(['session_start', 'page_view', 'session_end']),
  // session_start 전용
  referrer: z.string().max(2000).optional(),
  landingPage: z.string().max(2000).optional(),
  userAgent: z.string().max(500).optional(),
  deviceType: z.enum(['mobile', 'tablet', 'desktop']).optional(),
  utmSource: z.string().max(100).optional(),
  utmMedium: z.string().max(100).optional(),
  utmCampaign: z.string().max(100).optional(),
  // page_view 전용
  pagePath: z.string().max(2000).optional(),
  pageTitle: z.string().max(200).optional(),
  pageType: z.string().max(50).optional(),
  contentId: z.string().max(200).optional(),
  timeOnPage: z.number().int().min(0).max(86400).optional(),  // 최대 24시간
  scrollDepth: z.number().int().min(0).max(100).optional(),
});

// ============================================================================
// API Key 검증
// ============================================================================

/**
 * API Key를 검증하고 tenant_id를 반환
 */
export async function verifyApiKey(apiKey: string): Promise<ApiKeyContext | null> {
  if (!apiKey || !apiKey.startsWith('pk_')) {
    return null;
  }

  const supabase = getServiceClient();
  const keyPrefix = apiKey.substring(0, 12);

  // 프리픽스로 키 조회
  const { data: keyRecord, error } = await supabase
    .from('tenant_api_keys')
    .select('id, tenant_id, key_hash, scopes, rate_limit_per_minute, is_active, expires_at, allowed_origins')
    .eq('key_prefix', keyPrefix)
    .eq('is_active', true)
    .single();

  if (error || !keyRecord) {
    return null;
  }

  // 만료 확인
  if (keyRecord.expires_at && new Date(keyRecord.expires_at) < new Date()) {
    return null;
  }

  // 해시 검증
  const isValid = await bcrypt.compare(apiKey, keyRecord.key_hash);
  if (!isValid) {
    return null;
  }

  // 사용량 업데이트 (간단히 last_used_at만 업데이트)
  await supabase
    .from('tenant_api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', keyRecord.id);

  return {
    tenantId: keyRecord.tenant_id,
    keyId: keyRecord.id,
    scopes: keyRecord.scopes || [],
    rateLimitPerMinute: keyRecord.rate_limit_per_minute || 60,
  };
}

/**
 * Origin 검증 (API Key의 allowed_origins와 비교)
 */
export async function verifyOrigin(
  origin: string | null,
  tenantId: string
): Promise<boolean> {
  if (!origin) {
    // Origin이 없으면 서버 요청으로 간주 (허용)
    return true;
  }

  const supabase = getServiceClient();

  // 테넌트의 홈페이지 도메인 확인
  const { data: tenant } = await supabase
    .from('tenants')
    .select('homepage_domain, homepage_subdomain')
    .eq('id', tenantId)
    .single();

  if (!tenant) {
    return false;
  }

  // 허용된 도메인 목록 구성
  const allowedDomains: string[] = [];

  if (tenant.homepage_domain) {
    allowedDomains.push(tenant.homepage_domain);
    allowedDomains.push(`www.${tenant.homepage_domain}`);
  }

  if (tenant.homepage_subdomain) {
    // 서브도메인 형식: subdomain.theyool.kr
    allowedDomains.push(`${tenant.homepage_subdomain}.theyool.kr`);
  }

  // localhost 개발 환경 허용
  if (process.env.NODE_ENV === 'development') {
    allowedDomains.push('localhost:3000', 'localhost:3001', '127.0.0.1:3000');
  }

  // Origin 파싱
  try {
    const url = new URL(origin);
    const host = url.host;
    return allowedDomains.some(domain =>
      host === domain || host.endsWith(`.${domain}`)
    );
  } catch {
    return false;
  }
}

// ============================================================================
// 도메인 기반 테넌트 조회
// ============================================================================

/**
 * 개발 환경에서 기본 테넌트 자동 검색
 * "더율" 또는 "theyool" 이름을 포함하는 테넌트, 또는 첫 번째 테넌트 반환
 */
async function findDefaultDevTenant(): Promise<string | null> {
  const supabase = getServiceClient();

  // 1. "더율" 이름 검색
  const { data: byName } = await supabase
    .from('tenants')
    .select('id')
    .ilike('name', '%더율%')
    .limit(1)
    .single();

  if (byName) {
    return byName.id;
  }

  // 2. "theyool" 도메인 검색
  const { data: byDomain } = await supabase
    .from('tenants')
    .select('id')
    .or('homepage_domain.ilike.%theyool%,homepage_subdomain.ilike.%theyool%')
    .limit(1)
    .single();

  if (byDomain) {
    return byDomain.id;
  }

  // 3. has_homepage가 true인 첫 번째 테넌트
  const { data: firstWithHomepage } = await supabase
    .from('tenants')
    .select('id')
    .eq('has_homepage', true)
    .limit(1)
    .single();

  if (firstWithHomepage) {
    return firstWithHomepage.id;
  }

  // 4. 그냥 첫 번째 테넌트
  const { data: first } = await supabase
    .from('tenants')
    .select('id')
    .limit(1)
    .single();

  return first?.id || null;
}

/**
 * 도메인/서브도메인으로 tenant_id 조회
 */
export async function getTenantIdFromDomain(hostname: string): Promise<string | null> {
  const supabase = getServiceClient();

  // 1. 커스텀 도메인으로 조회
  const { data: byDomain } = await supabase
    .from('tenants')
    .select('id')
    .eq('homepage_domain', hostname)
    .eq('has_homepage', true)
    .single();

  if (byDomain) {
    return byDomain.id;
  }

  // 2. 서브도메인으로 조회 (subdomain.theyool.kr 형식)
  const subdomainMatch = hostname.match(/^([^.]+)\.theyool\.kr$/);
  if (subdomainMatch) {
    const subdomain = subdomainMatch[1];
    const { data: bySubdomain } = await supabase
      .from('tenants')
      .select('id')
      .eq('homepage_subdomain', subdomain)
      .eq('has_homepage', true)
      .single();

    if (bySubdomain) {
      return bySubdomain.id;
    }
  }

  return null;
}

// ============================================================================
// Rate Limiting (간단한 메모리 기반)
// ============================================================================

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

/**
 * Rate limit 확인 (IP + API Key 기반)
 */
export function checkRateLimit(
  identifier: string,
  limitPerMinute: number
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const record = rateLimitStore.get(identifier);

  if (!record || record.resetAt < now) {
    // 새 윈도우 시작
    rateLimitStore.set(identifier, {
      count: 1,
      resetAt: now + 60000, // 1분 후
    });
    return { allowed: true, remaining: limitPerMinute - 1, resetAt: now + 60000 };
  }

  if (record.count >= limitPerMinute) {
    return { allowed: false, remaining: 0, resetAt: record.resetAt };
  }

  record.count++;
  return { allowed: true, remaining: limitPerMinute - record.count, resetAt: record.resetAt };
}

// 주기적으로 오래된 레코드 정리 (5분마다)
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    if (record.resetAt < now) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

// ============================================================================
// 중복 신청 체크
// ============================================================================

/**
 * 동일 전화번호로 최근 5분 내 신청 있는지 확인
 */
export async function checkDuplicateSubmission(
  tenantId: string,
  phone: string,
  table: 'consultations' | 'bookings'
): Promise<boolean> {
  const supabase = getServiceClient();
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

  const { count } = await supabase
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('phone', phone)
    .gte('created_at', fiveMinutesAgo);

  return (count ?? 0) > 0;
}

// ============================================================================
// Cloudflare Turnstile 검증
// ============================================================================

/**
 * Cloudflare Turnstile CAPTCHA 검증
 */
export async function verifyCaptcha(token: string, ip?: string): Promise<boolean> {
  const secretKey = process.env.TURNSTILE_SECRET_KEY;

  if (!secretKey) {
    // 개발 환경에서는 CAPTCHA 스킵
    if (process.env.NODE_ENV === 'development') {
      return true;
    }
    console.warn('TURNSTILE_SECRET_KEY not set');
    return false;
  }

  const formData = new URLSearchParams();
  formData.append('secret', secretKey);
  formData.append('response', token);
  if (ip) {
    formData.append('remoteip', ip);
  }

  const response = await fetch(
    'https://challenges.cloudflare.com/turnstile/v0/siteverify',
    {
      method: 'POST',
      body: formData,
    }
  );

  const result = await response.json();
  return result.success === true;
}

// ============================================================================
// Public API 래퍼
// ============================================================================

/**
 * Public API 핸들러 래퍼
 * - API Key 검증 (선택적)
 * - Origin 검증
 * - Rate Limiting
 */
export function withPublicApi(
  handler: PublicApiHandler,
  options: {
    requireApiKey?: boolean;
    requireCaptcha?: boolean;
    rateLimit?: number;
  } = {}
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const { requireApiKey = false, requireCaptcha = false, rateLimit = 60 } = options;

    // IP 주소 추출
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ||
      request.headers.get('x-real-ip') ||
      'unknown';

    // Origin 추출
    const origin = request.headers.get('origin');

    // API Key 검증 (있는 경우)
    const apiKeyHeader = request.headers.get('x-api-key');
    let apiKeyContext: ApiKeyContext | undefined;
    let tenantId: string | undefined;

    if (apiKeyHeader) {
      const keyContext = await verifyApiKey(apiKeyHeader);
      if (!keyContext) {
        return NextResponse.json(
          { error: 'Invalid API key' },
          { status: 401 }
        );
      }
      apiKeyContext = keyContext;
      tenantId = keyContext.tenantId;

      // Origin 검증
      if (origin) {
        const originValid = await verifyOrigin(origin, tenantId);
        if (!originValid) {
          return NextResponse.json(
            { error: 'Origin not allowed' },
            { status: 403 }
          );
        }
      }
    } else if (requireApiKey) {
      return NextResponse.json(
        { error: 'API key required' },
        { status: 401 }
      );
    } else {
      // API Key 없이 도메인으로 테넌트 식별
      const host = request.headers.get('host') || '';
      tenantId = await getTenantIdFromDomain(host) || undefined;

      if (!tenantId) {
        // Referer에서 시도
        const referer = request.headers.get('referer');
        if (referer) {
          try {
            const refererUrl = new URL(referer);
            tenantId = await getTenantIdFromDomain(refererUrl.host) || undefined;
          } catch {
            // 무시
          }
        }
      }

      if (!tenantId) {
        // 개발 환경에서 기본 테넌트 사용
        if (process.env.NODE_ENV === 'development') {
          if (DEV_DEFAULT_TENANT_ID) {
            tenantId = DEV_DEFAULT_TENANT_ID;
          } else {
            // 환경변수 없으면 "더율" 또는 "theyool" 관련 테넌트 자동 검색
            const defaultTenant = await findDefaultDevTenant();
            if (defaultTenant) {
              tenantId = defaultTenant;
            }
          }
        }

        if (!tenantId) {
          return NextResponse.json(
            { error: 'Could not determine tenant' },
            { status: 400 }
          );
        }
      }
    }

    // Rate Limiting
    const rateLimitKey = apiKeyContext
      ? `key:${apiKeyContext.keyId}`
      : `ip:${ip}:tenant:${tenantId}`;
    const effectiveLimit = apiKeyContext?.rateLimitPerMinute || rateLimit;

    const rateLimitResult = checkRateLimit(rateLimitKey, effectiveLimit);
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', retryAfter: Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000) },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000)),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(rateLimitResult.resetAt),
          },
        }
      );
    }

    // 컨텍스트 구성
    const context: PublicApiContext = {
      tenantId,
      apiKey: apiKeyContext,
      origin: origin || undefined,
    };

    // CORS 헤더 추가
    const response = await handler(request, context);

    // CORS 헤더 설정
    if (origin) {
      response.headers.set('Access-Control-Allow-Origin', origin);
      response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      response.headers.set('Access-Control-Allow-Headers', 'Content-Type, X-API-Key');
    }

    // Rate limit 헤더 추가
    response.headers.set('X-RateLimit-Remaining', String(rateLimitResult.remaining));
    response.headers.set('X-RateLimit-Reset', String(rateLimitResult.resetAt));

    return response;
  };
}

// ============================================================================
// CORS Preflight 핸들러
// ============================================================================

export function handleCorsOptions(request: NextRequest): NextResponse {
  const origin = request.headers.get('origin') || '*';

  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-API-Key',
      'Access-Control-Max-Age': '86400',
    },
  });
}

// ============================================================================
// 에러 응답 헬퍼
// ============================================================================

export function errorResponse(
  message: string,
  status: number = 400,
  details?: unknown
): NextResponse {
  return NextResponse.json(
    { error: message, details },
    { status }
  );
}

export function successResponse<T>(
  data: T,
  status: number = 200
): NextResponse {
  return NextResponse.json(data, { status });
}
