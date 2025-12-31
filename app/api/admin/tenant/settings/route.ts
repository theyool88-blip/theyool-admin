/**
 * GET/PUT /api/admin/tenant/settings
 * 테넌트 서비스 설정 조회 및 수정
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { withTenant } from '@/lib/api/with-tenant';

// 설정 카테고리 타입
type SettingsCategory = 'cases' | 'payments' | 'expenses' | 'consultations' | 'clients';

const VALID_CATEGORIES: SettingsCategory[] = ['cases', 'payments', 'expenses', 'consultations', 'clients'];

/**
 * GET /api/admin/tenant/settings
 * 테넌트 설정 조회
 * Query params:
 * - category: 특정 카테고리만 조회 (옵션)
 */
export const GET = withTenant(async (request, { tenant }) => {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') as SettingsCategory | null;

    const supabase = createAdminClient();

    let query = supabase
      .from('tenant_settings')
      .select('*')
      .eq('tenant_id', tenant.tenantId);

    // 특정 카테고리만 조회
    if (category) {
      if (!VALID_CATEGORIES.includes(category)) {
        return NextResponse.json(
          { success: false, error: `유효하지 않은 카테고리입니다: ${category}` },
          { status: 400 }
        );
      }
      query = query.eq('category', category);
    }

    const { data, error } = await query.order('category');

    if (error) {
      console.error('Tenant settings fetch error:', error);
      return NextResponse.json(
        { success: false, error: '설정을 가져올 수 없습니다.' },
        { status: 500 }
      );
    }

    // 카테고리별로 정리
    const settingsByCategory: Record<string, unknown> = {};
    for (const setting of data || []) {
      settingsByCategory[setting.category] = setting.settings;
    }

    return NextResponse.json({
      success: true,
      data: {
        settings: settingsByCategory,
        raw: data,
      },
    });

  } catch (error) {
    console.error('Tenant settings API error:', error);
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
});

/**
 * PUT /api/admin/tenant/settings
 * 테넌트 설정 수정 (owner/admin만)
 * Body:
 * {
 *   category: 'payments' | 'expenses' | 'consultations' | 'cases' | 'clients',
 *   settings: { ... }
 * }
 */
export const PUT = withTenant(async (request, { tenant }) => {
  try {
    // 권한 확인 (owner 또는 admin만)
    if (!['owner', 'admin'].includes(tenant.memberRole)) {
      return NextResponse.json(
        { success: false, error: '설정 변경 권한이 없습니다.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { category, settings } = body;

    // 카테고리 유효성 검사
    if (!category || !VALID_CATEGORIES.includes(category)) {
      return NextResponse.json(
        { success: false, error: `유효하지 않은 카테고리입니다: ${category}` },
        { status: 400 }
      );
    }

    // 설정 값 유효성 검사
    if (!settings || typeof settings !== 'object') {
      return NextResponse.json(
        { success: false, error: '설정 값이 필요합니다.' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // upsert로 설정 저장 (없으면 생성, 있으면 업데이트)
    const { data, error } = await supabase
      .from('tenant_settings')
      .upsert(
        {
          tenant_id: tenant.tenantId,
          category,
          settings,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'tenant_id,category',
        }
      )
      .select()
      .single();

    if (error) {
      console.error('Tenant settings update error:', error);
      return NextResponse.json(
        { success: false, error: '설정 저장에 실패했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        category: data.category,
        settings: data.settings,
      },
    });

  } catch (error) {
    console.error('Tenant settings update API error:', error);
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
});

/**
 * POST /api/admin/tenant/settings
 * 여러 카테고리 설정을 한번에 저장
 * Body:
 * {
 *   settings: {
 *     payments: { ... },
 *     expenses: { ... },
 *     ...
 *   }
 * }
 */
export const POST = withTenant(async (request, { tenant }) => {
  try {
    // 권한 확인 (owner 또는 admin만)
    if (!['owner', 'admin'].includes(tenant.memberRole)) {
      return NextResponse.json(
        { success: false, error: '설정 변경 권한이 없습니다.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { settings } = body;

    if (!settings || typeof settings !== 'object') {
      return NextResponse.json(
        { success: false, error: '설정 값이 필요합니다.' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();
    const upsertData = [];

    for (const [category, settingsData] of Object.entries(settings)) {
      if (!VALID_CATEGORIES.includes(category as SettingsCategory)) {
        continue;
      }

      upsertData.push({
        tenant_id: tenant.tenantId,
        category,
        settings: settingsData,
        updated_at: new Date().toISOString(),
      });
    }

    if (upsertData.length === 0) {
      return NextResponse.json(
        { success: false, error: '유효한 설정이 없습니다.' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('tenant_settings')
      .upsert(upsertData, { onConflict: 'tenant_id,category' })
      .select();

    if (error) {
      console.error('Tenant settings batch update error:', error);
      return NextResponse.json(
        { success: false, error: '설정 저장에 실패했습니다.' },
        { status: 500 }
      );
    }

    // 카테고리별로 정리
    const settingsByCategory: Record<string, unknown> = {};
    for (const setting of data || []) {
      settingsByCategory[setting.category] = setting.settings;
    }

    return NextResponse.json({
      success: true,
      data: {
        settings: settingsByCategory,
      },
    });

  } catch (error) {
    console.error('Tenant settings batch update API error:', error);
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
});
