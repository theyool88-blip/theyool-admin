/**
 * Public API: 방문자 이벤트 추적
 * POST /api/public/visitor-events
 *
 * 홈페이지에서 방문자 이벤트를 수집하는 공개 API
 * - session_start: 세션 시작
 * - page_view: 페이지 조회
 * - session_end: 세션 종료
 */

import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  withPublicApi,
  handleCorsOptions,
  visitorEventSchema,
  errorResponse,
  successResponse,
} from '@/lib/api/public-api';

const getServiceClient = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false },
    }
  );
};

// OPTIONS (CORS preflight)
export async function OPTIONS(request: NextRequest) {
  return handleCorsOptions(request);
}

// POST - 방문자 이벤트 기록
export const POST = withPublicApi(
  async (request, context) => {
    const { tenantId } = context;

    // 요청 본문 파싱
    let body;
    try {
      body = await request.json();
    } catch {
      return errorResponse('Invalid JSON body');
    }

    // 입력 검증
    const parseResult = visitorEventSchema.safeParse(body);
    if (!parseResult.success) {
      return errorResponse('Validation failed', 400, parseResult.error.issues);
    }

    const data = parseResult.data;
    const supabase = getServiceClient();

    switch (data.eventType) {
      case 'session_start': {
        // 기존 방문자 확인 (재방문 여부)
        const { count: visitCount } = await supabase
          .from('visitor_sessions')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .eq('visitor_id', data.visitorId);

        const isReturning = (visitCount ?? 0) > 0;

        // 새 세션 생성
        const { data: session, error } = await supabase
          .from('visitor_sessions')
          .insert({
            tenant_id: tenantId,
            visitor_id: data.visitorId,
            session_id: data.sessionId,
            referrer: data.referrer || null,
            landing_page: data.landingPage || null,
            user_agent: data.userAgent || null,
            device_type: data.deviceType || null,
            utm_source: data.utmSource || null,
            utm_medium: data.utmMedium || null,
            utm_campaign: data.utmCampaign || null,
            visit_count: (visitCount ?? 0) + 1,
            is_returning: isReturning,
            ip_address: anonymizeIp(
              request.headers.get('x-forwarded-for')?.split(',')[0] || ''
            ),
          })
          .select('id')
          .single();

        if (error) {
          console.error('Failed to create session:', error);
          return errorResponse('Failed to create session', 500);
        }

        return successResponse({
          success: true,
          sessionDbId: session.id,
          isReturning,
          visitCount: (visitCount ?? 0) + 1,
        }, 201);
      }

      case 'page_view': {
        // 세션 조회
        const { data: session } = await supabase
          .from('visitor_sessions')
          .select('id')
          .eq('tenant_id', tenantId)
          .eq('session_id', data.sessionId)
          .single();

        if (!session) {
          return errorResponse('Session not found', 404);
        }

        // 페이지 뷰 기록
        const { error } = await supabase
          .from('page_views')
          .insert({
            tenant_id: tenantId,
            session_id: session.id,
            page_path: data.pagePath || '/',
            page_title: data.pageTitle || null,
            page_type: data.pageType || null,
            content_id: data.contentId || null,
            time_on_page: data.timeOnPage || null,
            scroll_depth: data.scrollDepth || null,
          });

        if (error) {
          console.error('Failed to record page view:', error);
          return errorResponse('Failed to record page view', 500);
        }

        return successResponse({ success: true });
      }

      case 'session_end': {
        // 세션 종료 시간 업데이트
        const { error } = await supabase
          .from('visitor_sessions')
          .update({ ended_at: new Date().toISOString() })
          .eq('tenant_id', tenantId)
          .eq('session_id', data.sessionId);

        if (error) {
          console.error('Failed to end session:', error);
          return errorResponse('Failed to end session', 500);
        }

        return successResponse({ success: true });
      }

      default:
        return errorResponse('Invalid event type', 400);
    }
  },
  {
    requireApiKey: false,
    rateLimit: 120,  // 분당 120회 (페이지 뷰가 많을 수 있음)
  }
);

/**
 * IP 주소 익명화 (마지막 옥텟을 0으로)
 */
function anonymizeIp(ip: string): string {
  if (!ip) return '';

  // IPv4
  if (ip.includes('.')) {
    const parts = ip.split('.');
    if (parts.length === 4) {
      parts[3] = '0';
      return parts.join('.');
    }
  }

  // IPv6 (간단히 마지막 4자리 제거)
  if (ip.includes(':')) {
    const parts = ip.split(':');
    if (parts.length >= 2) {
      parts[parts.length - 1] = '0';
      return parts.join(':');
    }
  }

  return ip;
}
