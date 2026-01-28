/**
 * Public API: 상담 예약
 * POST /api/public/bookings
 *
 * 홈페이지에서 상담 예약을 받는 공개 API
 */

import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  withPublicApi,
  handleCorsOptions,
  bookingSchema,
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

// POST - 상담 예약
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
    const parseResult = bookingSchema.safeParse(body);
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
      'bookings'
    );
    if (isDuplicate) {
      return errorResponse('이미 최근에 예약 신청을 하셨습니다. 잠시 후 다시 시도해주세요.', 429);
    }

    const supabase = getServiceClient();

    // 예약 가능 여부 확인 (선택적)
    // TODO: 해당 시간대에 이미 예약이 있는지 확인
    const existingBooking = await supabase
      .from('bookings')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('preferred_date', data.preferredDate)
      .eq('preferred_time', data.preferredTime)
      .eq('office_location', data.officeLocation || '')
      .in('status', ['pending', 'confirmed'])
      .maybeSingle();

    if (existingBooking.data) {
      return errorResponse('해당 시간대에 이미 예약이 있습니다. 다른 시간을 선택해주세요.', 409);
    }

    // DB에 저장
    const bookingData = {
      tenant_id: tenantId,
      name: data.name,
      phone: data.phone,
      email: data.email || null,
      type: data.type,
      category: data.category || null,
      message: data.message || null,
      preferred_date: data.preferredDate,
      preferred_time: data.preferredTime,
      office_location: data.officeLocation || null,
      assigned_to: data.preferredLawyerId || null,
      utm_source: data.utmSource || null,
      utm_medium: data.utmMedium || null,
      utm_campaign: data.utmCampaign || null,
      visitor_session_id: data.visitorSessionId || null,
      status: 'pending',
    };

    const { data: booking, error } = await supabase
      .from('bookings')
      .insert(bookingData)
      .select('id, created_at')
      .single();

    if (error) {
      console.error('Failed to create booking:', error);
      return errorResponse('예약 신청 중 오류가 발생했습니다.', 500);
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
            .from('bookings')
            .update({ lead_score: scoreData })
            .eq('id', booking.id);
        }
      } catch (e) {
        console.warn('Failed to calculate lead score:', e);
      }
    }

    // 예약 유형별 메시지
    const typeMessages: Record<string, string> = {
      visit: '방문 상담',
      video: '화상 상담',
      phone: '전화 상담',
    };

    return successResponse({
      success: true,
      bookingId: booking.id,
      message: `${typeMessages[data.type]} 예약이 완료되었습니다. 확정 안내를 드리겠습니다.`,
      booking: {
        type: data.type,
        date: data.preferredDate,
        time: data.preferredTime,
        location: data.officeLocation,
      },
    }, 201);
  },
  {
    requireApiKey: false,
    rateLimit: 10,
  }
);
