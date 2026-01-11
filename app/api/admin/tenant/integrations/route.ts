import { NextResponse } from 'next/server';
import { withRole } from '@/lib/api/with-tenant';
import {
  getTenantIntegrations,
  getTenantAuthUrl,
  disconnectTenantIntegration,
} from '@/lib/google-calendar';
import { toTenantIntegration, type IntegrationProvider } from '@/types/integration';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/admin/tenant/integrations
 * 테넌트의 모든 연동 목록 조회
 */
export const GET = withRole('admin')(async (request, { tenant }) => {
  try {
    if (!tenant.tenantId) {
      return NextResponse.json({ success: false, error: 'No tenant context' }, { status: 400 });
    }

    const integrations = await getTenantIntegrations(tenant.tenantId);

    return NextResponse.json({
      success: true,
      data: integrations.map(toTenantIntegration),
    });
  } catch (error) {
    console.error('[GET /tenant/integrations] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch integrations' },
      { status: 500 }
    );
  }
});

/**
 * POST /api/admin/tenant/integrations
 * 새 연동 시작 (OAuth URL 반환)
 */
export const POST = withRole('admin')(async (request, { tenant }) => {
  try {
    if (!tenant.tenantId) {
      return NextResponse.json({ success: false, error: 'No tenant context' }, { status: 400 });
    }

    const body = await request.json();
    const provider = body.provider as IntegrationProvider;

    if (!provider || !['google_calendar', 'google_drive'].includes(provider)) {
      return NextResponse.json(
        { success: false, error: 'Invalid provider' },
        { status: 400 }
      );
    }

    // 현재 사용자 ID 가져오기
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // OAuth URL 생성
    const authUrl = await getTenantAuthUrl(tenant.tenantId, provider, user.id);

    return NextResponse.json({
      success: true,
      authUrl,
    });
  } catch (error) {
    console.error('[POST /tenant/integrations] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate auth URL' },
      { status: 500 }
    );
  }
});

/**
 * DELETE /api/admin/tenant/integrations
 * 연동 해제
 */
export const DELETE = withRole('admin')(async (request, { tenant }) => {
  try {
    if (!tenant.tenantId) {
      return NextResponse.json({ success: false, error: 'No tenant context' }, { status: 400 });
    }

    const url = new URL(request.url);
    const provider = url.searchParams.get('provider') as IntegrationProvider;

    if (!provider || !['google_calendar', 'google_drive'].includes(provider)) {
      return NextResponse.json(
        { success: false, error: 'Invalid provider' },
        { status: 400 }
      );
    }

    const success = await disconnectTenantIntegration(tenant.tenantId, provider);

    if (!success) {
      return NextResponse.json(
        { success: false, error: 'Failed to disconnect integration' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[DELETE /tenant/integrations] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to disconnect integration' },
      { status: 500 }
    );
  }
});
