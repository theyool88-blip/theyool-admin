import { NextRequest, NextResponse } from 'next/server';
import {
  getTokensFromCode,
  validateOAuthState,
  deleteOAuthState,
  upsertTenantIntegration,
} from '@/lib/google-calendar';

/**
 * Google OAuth 통합 콜백
 * Calendar와 Drive 모두 이 콜백을 사용
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  // OAuth 에러 처리
  if (error) {
    console.error('[Google OAuth] Error from Google:', error);
    return NextResponse.redirect(
      new URL(
        `/admin/settings/tenant?error=${encodeURIComponent(error)}`,
        request.url
      )
    );
  }

  // Code 파라미터 확인
  if (!code) {
    console.error('[Google OAuth] No authorization code received');
    return NextResponse.redirect(
      new URL('/admin/settings/tenant?error=no_code', request.url)
    );
  }

  // State 파라미터 확인
  if (!state) {
    console.error('[Google OAuth] No state parameter received');
    return NextResponse.redirect(
      new URL('/admin/settings/tenant?error=no_state', request.url)
    );
  }

  // State 검증
  const stateValidation = await validateOAuthState(state);

  if (!stateValidation.valid) {
    console.error('[Google OAuth] Invalid state:', stateValidation.error);
    return NextResponse.redirect(
      new URL(
        `/admin/settings/tenant?error=${encodeURIComponent(stateValidation.error || 'invalid_state')}`,
        request.url
      )
    );
  }

  const { tenantId, provider, userId } = stateValidation;

  if (!tenantId || !provider || !userId) {
    console.error('[Google OAuth] Missing data in state');
    return NextResponse.redirect(
      new URL('/admin/settings/tenant?error=invalid_state_data', request.url)
    );
  }

  try {
    // Authorization code를 토큰으로 교환
    const tokens = await getTokensFromCode(code);

    if (!tokens.access_token) {
      throw new Error('No access token received');
    }

    // tenant_integrations에 저장
    const integration = await upsertTenantIntegration(tenantId, provider, {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || undefined,
      tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
      connectedBy: userId,
    });

    if (!integration) {
      throw new Error('Failed to save integration');
    }

    // State 삭제
    await deleteOAuthState(state);

    // 성공 - 설정 페이지로 리다이렉트
    const successParam = provider === 'google_calendar' ? 'calendar_connected' : 'drive_connected';
    return NextResponse.redirect(
      new URL(`/admin/settings/tenant?success=${successParam}`, request.url)
    );
  } catch (err) {
    console.error('[Google OAuth] Error exchanging code for tokens:', err);

    // State 삭제 (에러 시에도)
    await deleteOAuthState(state);

    return NextResponse.redirect(
      new URL('/admin/settings/tenant?error=token_exchange_failed', request.url)
    );
  }
}
