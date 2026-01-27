import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { withSuperAdmin } from '@/lib/api/with-super-admin';
import { signToken, verifyToken, isTokenExpired } from '@/lib/auth/impersonation-token';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST: 테넌트 대리 접속 토큰 생성 (슈퍼 어드민 인증 필요)
export const POST = withSuperAdmin(async (request: NextRequest, { superAdmin }) => {
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

    // 서명된 대리 접속 토큰 생성
    const impersonationToken = signToken({
      tenantId: tenant.id,
      tenantName: tenant.name,
      tenantSlug: tenant.slug,
      impersonatedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1시간 만료
      superAdminUserId: superAdmin.userId, // 대리 접속을 시작한 슈퍼어드민 ID 기록
    });

    // 쿠키에 대리 접속 토큰 저장
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
      httpOnly: true, // XSS 공격 방지
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict', // CSRF 방지 강화
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
});

// DELETE: 대리 접속 종료
export async function DELETE() {
  try {
    const response = NextResponse.json({
      success: true,
      message: '대리 접속이 종료되었습니다.',
    });

    response.cookies.set('sa_impersonate', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
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

    // 서명된 토큰 검증
    const payload = verifyToken(token);

    if (!payload) {
      // 토큰 검증 실패 시 쿠키 삭제
      const response = NextResponse.json({
        success: true,
        data: { isImpersonating: false },
      });
      response.cookies.set('sa_impersonate', '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 0,
        path: '/',
      });
      return response;
    }

    // 토큰 만료 확인
    if (isTokenExpired(payload)) {
      const response = NextResponse.json({
        success: true,
        data: { isImpersonating: false },
      });
      response.cookies.set('sa_impersonate', '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 0,
        path: '/',
      });
      return response;
    }

    return NextResponse.json({
      success: true,
      data: {
        isImpersonating: true,
        tenantId: payload.tenantId,
        tenantName: payload.tenantName,
        tenantSlug: payload.tenantSlug,
        impersonatedAt: payload.impersonatedAt,
        expiresAt: payload.expiresAt,
      },
    });
  } catch (error) {
    console.error('Check impersonation error:', error);
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
