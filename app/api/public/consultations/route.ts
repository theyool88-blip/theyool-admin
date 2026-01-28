/**
 * Public API: 상담 신청
 * POST /api/public/consultations
 *
 * 홈페이지에서 상담 신청을 받는 공개 API
 */

import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  withPublicApi,
  handleCorsOptions,
  consultationSchema,
  checkDuplicateSubmission,
  verifyCaptcha,
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

// POST - 상담 신청
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
    const parseResult = consultationSchema.safeParse(body);
    if (!parseResult.success) {
      return errorResponse('Validation failed', 400, parseResult.error.issues);
    }

    const data = parseResult.data;

    // CAPTCHA 검증 (프로덕션 환경)
    if (process.env.NODE_ENV === 'production' && data.captchaToken) {
      const ip = request.headers.get('x-forwarded-for')?.split(',')[0];
      const captchaValid = await verifyCaptcha(data.captchaToken, ip);
      if (!captchaValid) {
        return errorResponse('CAPTCHA verification failed', 400);
      }
    }

    // 중복 신청 체크 (5분 내 동일 전화번호)
    const isDuplicate = await checkDuplicateSubmission(
      tenantId,
      data.phone,
      'consultations'
    );
    if (isDuplicate) {
      return errorResponse('이미 최근에 상담 신청을 하셨습니다. 잠시 후 다시 시도해주세요.', 429);
    }

    // DB에 저장
    const supabase = getServiceClient();

    const consultationData = {
      tenant_id: tenantId,
      name: data.name,
      phone: data.phone,
      email: data.email || null,
      category: data.category || null,
      message: data.message || null,
      preferred_date: data.preferredDate || null,
      preferred_time: data.preferredTime || null,
      utm_source: data.utmSource || null,
      utm_medium: data.utmMedium || null,
      utm_campaign: data.utmCampaign || null,
      visitor_session_id: data.visitorSessionId || null,
      status: 'pending',
      source: 'homepage',
    };

    const { data: consultation, error } = await supabase
      .from('consultations')
      .insert(consultationData)
      .select('id, created_at')
      .single();

    if (error) {
      console.error('Failed to create consultation:', error);
      return errorResponse('상담 신청 중 오류가 발생했습니다.', 500);
    }

    // 리드 스코어 계산 (방문자 세션이 있는 경우)
    if (data.visitorSessionId) {
      try {
        const { data: scoreData } = await supabase.rpc(
          'calculate_visitor_lead_score',
          { p_visitor_session_id: data.visitorSessionId }
        );

        if (scoreData !== null) {
          await supabase
            .from('consultations')
            .update({ lead_score: scoreData })
            .eq('id', consultation.id);
        }
      } catch (e) {
        // 리드 스코어 계산 실패는 무시
        console.warn('Failed to calculate lead score:', e);
      }
    }

    return successResponse({
      success: true,
      consultationId: consultation.id,
      message: '상담 신청이 완료되었습니다. 빠른 시일 내에 연락드리겠습니다.',
    }, 201);
  },
  {
    requireApiKey: false,
    rateLimit: 10,  // 분당 10회 제한
  }
);
