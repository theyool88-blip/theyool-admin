import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST: 테넌트 대리 접속 토큰 생성
export async function POST(request: NextRequest) {
  try {
    const { tenantId } = await request.json();

    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: '테넌트 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    // 테넌트 정보 조회
    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from('tenants')
      .select('id, name, slug, status')
      .eq('id', tenantId)
      .single();

    if (tenantError || !tenant) {
      return NextResponse.json(
        { success: false, error: '테넌트를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    if (tenant.status !== 'active') {
      return NextResponse.json(
        { success: false, error: '비활성 테넌트에는 접속할 수 없습니다.' },
        { status: 403 }
      );
    }

    // 대리 접속 토큰 생성 (간단한 JWT-like 토큰)
    const impersonationToken = Buffer.from(JSON.stringify({
      tenantId: tenant.id,
      tenantName: tenant.name,
      tenantSlug: tenant.slug,
      impersonatedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1시간 만료
    })).toString('base64');

    // 쿠키에 대리 접속 토큰 저장 (NextResponse 사용)
    const response = NextResponse.json({
      success: true,
      data: {
        tenantId: tenant.id,
        tenantName: tenant.name,
        tenantSlug: tenant.slug,
        redirectUrl: '/admin',
      },
    });

    response.cookies.set('sa_impersonate', impersonationToken, {
      httpOnly: false, // 클라이언트에서 읽을 수 있도록
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60, // 1시간
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Impersonation error:', error);
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// DELETE: 대리 접속 종료
export async function DELETE() {
  try {
    const response = NextResponse.json({
      success: true,
      message: '대리 접속이 종료되었습니다.',
    });

    response.cookies.set('sa_impersonate', '', {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0, // 즉시 만료
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('End impersonation error:', error);
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// GET: 현재 대리 접속 상태 확인
export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('sa_impersonate')?.value;

    if (!token) {
      return NextResponse.json({
        success: true,
        data: { isImpersonating: false },
      });
    }

    try {
      const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
      const expiresAt = new Date(decoded.expiresAt);

      if (expiresAt < new Date()) {
        // 토큰 만료
        cookieStore.delete('sa_impersonate');
        return NextResponse.json({
          success: true,
          data: { isImpersonating: false },
        });
      }

      return NextResponse.json({
        success: true,
        data: {
          isImpersonating: true,
          tenantId: decoded.tenantId,
          tenantName: decoded.tenantName,
          tenantSlug: decoded.tenantSlug,
          impersonatedAt: decoded.impersonatedAt,
          expiresAt: decoded.expiresAt,
        },
      });
    } catch {
      cookieStore.delete('sa_impersonate');
      return NextResponse.json({
        success: true,
        data: { isImpersonating: false },
      });
    }
  } catch (error) {
    console.error('Check impersonation error:', error);
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
