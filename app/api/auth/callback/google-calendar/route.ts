import { NextRequest, NextResponse } from 'next/server';
import { getTokensFromCode } from '@/lib/google-calendar';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error) {
    return NextResponse.redirect(
      new URL(`/admin/settings?error=${error}`, request.url)
    );
  }

  if (!code) {
    return NextResponse.redirect(
      new URL('/admin/settings?error=no_code', request.url)
    );
  }

  try {
    const tokens = await getTokensFromCode(code);

    // 토큰을 DB에 저장
    const supabase = await createClient();

    const { error: upsertError } = await supabase
      .from('app_settings')
      .upsert({
        key: 'google_calendar_tokens',
        value: JSON.stringify({
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expiry_date: tokens.expiry_date,
        }),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'key'
      });

    if (upsertError) {
      console.error('Error saving tokens:', upsertError);
      return NextResponse.redirect(
        new URL('/admin/settings?error=save_failed', request.url)
      );
    }

    return NextResponse.redirect(
      new URL('/admin/settings?success=google_calendar_connected', request.url)
    );
  } catch (err) {
    console.error('Error getting tokens:', err);
    return NextResponse.redirect(
      new URL('/admin/settings?error=token_failed', request.url)
    );
  }
}
