import { NextResponse } from 'next/server';
import { withRole } from '@/lib/api/with-tenant';
import {
  getTenantIntegration,
  getTenantCalendarList,
  updateTenantIntegrationSettings,
} from '@/lib/google-calendar';
import { toTenantIntegration, type IntegrationProvider, type GoogleCalendarListItem } from '@/types/integration';

const VALID_PROVIDERS = ['google_calendar', 'google_drive'];

/**
 * GET /api/admin/tenant/integrations/[provider]
 * 특정 연동 상세 조회 (Calendar: 캘린더 목록 포함)
 */
export const GET = withRole('admin')(async (request, { tenant, params }) => {
  try {
    if (!tenant.tenantId) {
      return NextResponse.json({ success: false, error: 'No tenant context' }, { status: 400 });
    }

    const provider = params?.provider as IntegrationProvider;

    if (!provider || !VALID_PROVIDERS.includes(provider)) {
      return NextResponse.json(
        { success: false, error: 'Invalid provider' },
        { status: 400 }
      );
    }

    const integration = await getTenantIntegration(tenant.tenantId, provider);

    if (!integration) {
      return NextResponse.json({
        success: true,
        data: null,
        calendars: [],
      });
    }

    // Calendar인 경우 캘린더 목록도 조회
    let calendars: GoogleCalendarListItem[] = [];

    if (provider === 'google_calendar' && integration.status === 'connected') {
      try {
        const calendarList = await getTenantCalendarList(tenant.tenantId);
        calendars = calendarList.map((cal) => ({
          id: cal.id || '',
          summary: cal.summary || '',
          description: cal.description || undefined,
          primary: cal.primary || false,
          accessRole: cal.accessRole || undefined,
          backgroundColor: cal.backgroundColor || undefined,
          foregroundColor: cal.foregroundColor || undefined,
        }));
      } catch (error) {
        console.error('[GET /tenant/integrations/[provider]] Error fetching calendars:', error);
        // 캘린더 목록 조회 실패해도 연동 정보는 반환
      }
    }

    return NextResponse.json({
      success: true,
      data: toTenantIntegration(integration),
      calendars,
    });
  } catch (error) {
    console.error('[GET /tenant/integrations/[provider]] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch integration' },
      { status: 500 }
    );
  }
});

/**
 * PUT /api/admin/tenant/integrations/[provider]
 * 연동 설정 업데이트 (calendarId, folderId 등)
 */
export const PUT = withRole('admin')(async (request, { tenant, params }) => {
  try {
    if (!tenant.tenantId) {
      return NextResponse.json({ success: false, error: 'No tenant context' }, { status: 400 });
    }

    const provider = params?.provider as IntegrationProvider;

    if (!provider || !VALID_PROVIDERS.includes(provider)) {
      return NextResponse.json(
        { success: false, error: 'Invalid provider' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const settings = body.settings as Record<string, unknown>;

    if (!settings || typeof settings !== 'object') {
      return NextResponse.json(
        { success: false, error: 'Invalid settings' },
        { status: 400 }
      );
    }

    // 기존 설정 조회
    const integration = await getTenantIntegration(tenant.tenantId, provider);

    if (!integration) {
      return NextResponse.json(
        { success: false, error: 'Integration not found' },
        { status: 404 }
      );
    }

    // 기존 설정과 병합
    const mergedSettings = {
      ...(integration.settings as Record<string, unknown>),
      ...settings,
    };

    const success = await updateTenantIntegrationSettings(
      tenant.tenantId,
      provider,
      mergedSettings
    );

    if (!success) {
      return NextResponse.json(
        { success: false, error: 'Failed to update settings' },
        { status: 500 }
      );
    }

    // 업데이트된 연동 정보 반환
    const updatedIntegration = await getTenantIntegration(tenant.tenantId, provider);

    return NextResponse.json({
      success: true,
      data: updatedIntegration ? toTenantIntegration(updatedIntegration) : null,
    });
  } catch (error) {
    console.error('[PUT /tenant/integrations/[provider]] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update settings' },
      { status: 500 }
    );
  }
});
