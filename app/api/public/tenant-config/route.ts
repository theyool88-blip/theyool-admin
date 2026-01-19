/**
 * Public API: 테넌트 공개 설정 조회
 * GET /api/public/tenant-config
 *
 * 홈페이지에서 사용할 테넌트 설정 조회 API
 * - 변호사 목록
 * - 사무소 위치
 * - 상담 카테고리
 * - 예약 가능 시간 등
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  withPublicApi,
  handleCorsOptions,
  errorResponse,
  successResponse,
} from '@/lib/api/public-api';
import { TenantPublicConfig, OfficeLocation } from '@/types/tenant';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const getServiceClient = () => {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });
};

// OPTIONS (CORS preflight)
export async function OPTIONS(request: NextRequest) {
  return handleCorsOptions(request);
}

// GET - 테넌트 공개 설정 조회
export const GET = withPublicApi(
  async (request, context) => {
    const { tenantId } = context;
    const supabase = getServiceClient();

    // 테넌트 기본 정보 조회
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('id, name, logo_url, primary_color, has_homepage')
      .eq('id', tenantId)
      .single();

    if (tenantError || !tenant) {
      return errorResponse('Tenant not found', 404);
    }

    if (!tenant.has_homepage) {
      return errorResponse('Homepage not enabled for this tenant', 403);
    }

    // 변호사 목록 조회
    const { data: members } = await supabase
      .from('tenant_members')
      .select('id, display_name, title')
      .eq('tenant_id', tenantId)
      .in('role', ['owner', 'admin', 'lawyer'])
      .eq('status', 'active')
      .order('role', { ascending: true });

    const lawyers = (members || []).map(m => ({
      id: m.id,
      name: m.display_name || '변호사',
      title: m.title || undefined,
    }));

    // 테넌트 설정 조회 (consultations 카테고리)
    const { data: consultationSettings } = await supabase
      .from('tenant_settings')
      .select('settings')
      .eq('tenant_id', tenantId)
      .eq('category', 'consultations')
      .single();

    // 기본값
    let officeLocations: OfficeLocation[] = [];
    let consultationCategories: string[] = [];
    let allowVideoConsultation = true;
    let allowVisitConsultation = true;
    let allowPhoneConsultation = true;
    let allowCallbackRequest = true;
    let defaultSlotDuration = 30;

    if (consultationSettings?.settings) {
      const settings = consultationSettings.settings as Record<string, unknown>;

      // 사무소 위치
      if (Array.isArray(settings.officeLocations)) {
        officeLocations = settings.officeLocations as OfficeLocation[];
      } else if (Array.isArray(settings.offices)) {
        // 이전 형식 호환
        officeLocations = (settings.offices as string[]).map((name: string, index: number) => ({
          id: `office-${index}`,
          name,
          address: '',
        }));
      }

      // 상담 카테고리
      if (Array.isArray(settings.categories)) {
        consultationCategories = settings.categories as string[];
      }

      // 예약 설정
      if (typeof settings.allowVideoConsultation === 'boolean') {
        allowVideoConsultation = settings.allowVideoConsultation;
      }
      if (typeof settings.allowVisitConsultation === 'boolean') {
        allowVisitConsultation = settings.allowVisitConsultation;
      }
      if (typeof settings.allowPhoneConsultation === 'boolean') {
        allowPhoneConsultation = settings.allowPhoneConsultation;
      }
      if (typeof settings.allowCallbackRequest === 'boolean') {
        allowCallbackRequest = settings.allowCallbackRequest;
      }
      if (typeof settings.defaultSlotDuration === 'number') {
        defaultSlotDuration = settings.defaultSlotDuration;
      }
    }

    // 응답 구성
    const config: TenantPublicConfig = {
      tenantId: tenant.id,
      name: tenant.name,
      lawyers,
      officeLocations,
      consultationCategories,
      allowVideoConsultation,
      allowVisitConsultation,
      allowPhoneConsultation,
      allowCallbackRequest,
      defaultSlotDuration,
      primaryColor: tenant.primary_color || undefined,
      logoUrl: tenant.logo_url || undefined,
    };

    // 캐시 헤더 설정 (5분)
    const response = successResponse(config);
    response.headers.set('Cache-Control', 'public, max-age=300, s-maxage=300');

    return response;
  },
  {
    requireApiKey: false,
    rateLimit: 60,
  }
);

// GET - 예약 가능 시간 조회
// /api/public/tenant-config/availability?date=2026-02-20&type=visit&office=천안
export const dynamic = 'force-dynamic';
