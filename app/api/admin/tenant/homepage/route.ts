/**
 * 테넌트 홈페이지 설정 관리
 * GET /api/admin/tenant/homepage - 홈페이지 설정 조회
 * PUT /api/admin/tenant/homepage - 홈페이지 설정 저장
 */

import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/lib/api/with-tenant';
import { createClient } from '@supabase/supabase-js';
import { TenantHomepageSettings, OfficeLocation } from '@/types/tenant';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const getServiceClient = () => {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });
};

// 기본 홈페이지 설정
const DEFAULT_HOMEPAGE_SETTINGS: TenantHomepageSettings = {
  enabled: false,
  officeLocations: [],
  consultationCategories: [],
  defaultSlotDuration: 30,
  allowVideoConsultation: true,
  allowVisitConsultation: true,
  allowPhoneConsultation: true,
  allowCallbackRequest: true,
  defaultConsultationFee: 0,
  freeConsultationEnabled: true,
};

// GET - 홈페이지 설정 조회
export const GET = withRole('admin')(async (request, { tenant }) => {
  const supabase = getServiceClient();

  // tenant_settings에서 homepage 카테고리 조회
  const { data: settingsRow } = await supabase
    .from('tenant_settings')
    .select('settings')
    .eq('tenant_id', tenant.tenantId)
    .eq('category', 'homepage')
    .single();

  // tenants 테이블에서 홈페이지 관련 필드 조회
  const { data: tenantData } = await supabase
    .from('tenants')
    .select('has_homepage, homepage_domain, homepage_subdomain')
    .eq('id', tenant.tenantId)
    .single();

  const settings: TenantHomepageSettings = {
    ...DEFAULT_HOMEPAGE_SETTINGS,
    ...(settingsRow?.settings as Partial<TenantHomepageSettings> || {}),
    enabled: tenantData?.has_homepage || false,
    domain: tenantData?.homepage_domain || undefined,
    subdomain: tenantData?.homepage_subdomain || undefined,
  };

  return NextResponse.json({
    success: true,
    data: settings,
  });
});

// PUT - 홈페이지 설정 저장
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

  const {
    enabled,
    domain,
    subdomain,
    officeLocations,
    consultationCategories,
    defaultSlotDuration,
    allowVideoConsultation,
    allowVisitConsultation,
    allowPhoneConsultation,
    allowCallbackRequest,
    defaultConsultationFee,
    freeConsultationEnabled,
    primaryColor,
  } = body as Partial<TenantHomepageSettings>;

  const supabase = getServiceClient();

  // tenants 테이블 업데이트 (has_homepage, homepage_domain, homepage_subdomain)
  const tenantUpdate: Record<string, unknown> = {};
  if (enabled !== undefined) tenantUpdate.has_homepage = enabled;
  if (domain !== undefined) tenantUpdate.homepage_domain = domain || null;
  if (subdomain !== undefined) tenantUpdate.homepage_subdomain = subdomain || null;
  if (primaryColor !== undefined) tenantUpdate.primary_color = primaryColor || null;

  if (Object.keys(tenantUpdate).length > 0) {
    const { error: tenantError } = await supabase
      .from('tenants')
      .update(tenantUpdate)
      .eq('id', tenant.tenantId);

    if (tenantError) {
      console.error('Failed to update tenant:', tenantError);
      return NextResponse.json(
        { success: false, error: '테넌트 정보 업데이트에 실패했습니다.' },
        { status: 500 }
      );
    }
  }

  // tenant_settings 업데이트 (homepage 카테고리)
  const settingsData: Record<string, unknown> = {};
  if (officeLocations !== undefined) settingsData.officeLocations = officeLocations;
  if (consultationCategories !== undefined) settingsData.consultationCategories = consultationCategories;
  if (defaultSlotDuration !== undefined) settingsData.defaultSlotDuration = defaultSlotDuration;
  if (allowVideoConsultation !== undefined) settingsData.allowVideoConsultation = allowVideoConsultation;
  if (allowVisitConsultation !== undefined) settingsData.allowVisitConsultation = allowVisitConsultation;
  if (allowPhoneConsultation !== undefined) settingsData.allowPhoneConsultation = allowPhoneConsultation;
  if (allowCallbackRequest !== undefined) settingsData.allowCallbackRequest = allowCallbackRequest;
  if (defaultConsultationFee !== undefined) settingsData.defaultConsultationFee = defaultConsultationFee;
  if (freeConsultationEnabled !== undefined) settingsData.freeConsultationEnabled = freeConsultationEnabled;

  if (Object.keys(settingsData).length > 0) {
    // upsert 사용
    const { error: settingsError } = await supabase
      .from('tenant_settings')
      .upsert(
        {
          tenant_id: tenant.tenantId,
          category: 'homepage',
          settings: settingsData,
        },
        {
          onConflict: 'tenant_id,category',
        }
      );

    if (settingsError) {
      console.error('Failed to update homepage settings:', settingsError);
      return NextResponse.json(
        { success: false, error: '홈페이지 설정 저장에 실패했습니다.' },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({
    success: true,
    message: '홈페이지 설정이 저장되었습니다.',
  });
});
