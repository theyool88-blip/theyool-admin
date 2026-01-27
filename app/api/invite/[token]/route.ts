/**
 * GET/POST /api/invite/[token]
 * 초대 정보 조회 및 수락 (공개 API)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/invite/[token]
 * 초대 정보 조회 (로그인 불필요)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    if (!token) {
      return NextResponse.json(
        { success: false, error: '초대 토큰이 필요합니다.' },
        { status: 400 }
      );
    }

    const supabaseAdmin = createAdminClient();

    // 초대 정보 조회
    const { data: invitation, error: fetchError } = await supabaseAdmin
      .from('tenant_invitations')
      .select(`
        id,
        email,
        role,
        status,
        expires_at,
        created_at,
        tenant:tenants (
          id,
          name,
          slug,
          type
        )
      `)
      .eq('token', token)
      .single();

    if (fetchError || !invitation) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 초대입니다.' },
        { status: 404 }
      );
    }

    // 상태 확인
    if (invitation.status === 'accepted') {
      return NextResponse.json(
        { success: false, error: '이미 수락된 초대입니다.', code: 'ALREADY_ACCEPTED' },
        { status: 400 }
      );
    }

    if (invitation.status === 'expired') {
      return NextResponse.json(
        { success: false, error: '만료된 초대입니다.', code: 'EXPIRED' },
        { status: 400 }
      );
    }

    // 만료일 확인
    if (new Date(invitation.expires_at) < new Date()) {
      // 상태 업데이트
      await supabaseAdmin
        .from('tenant_invitations')
        .update({ status: 'expired' })
        .eq('id', invitation.id);

      return NextResponse.json(
        { success: false, error: '만료된 초대입니다.', code: 'EXPIRED' },
        { status: 400 }
      );
    }

    // 현재 로그인한 사용자 확인
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const tenant = invitation.tenant as unknown as {
      id: string;
      name: string;
      slug: string;
      type: string;
    } | null;

    return NextResponse.json({
      success: true,
      data: {
        invitation: {
          id: invitation.id,
          email: invitation.email,
          role: invitation.role,
          expiresAt: invitation.expires_at,
        },
        tenant: tenant
          ? {
              id: tenant.id,
              name: tenant.name,
              type: tenant.type,
            }
          : null,
        currentUser: user
          ? {
              id: user.id,
              email: user.email,
              emailMatches: user.email?.toLowerCase() === invitation.email.toLowerCase(),
            }
          : null,
      },
    });
  } catch (error) {
    console.error('Invite info API error:', error);
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/invite/[token]
 * 초대 수락 (로그인 필요)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    if (!token) {
      return NextResponse.json(
        { success: false, error: '초대 토큰이 필요합니다.' },
        { status: 400 }
      );
    }

    // 로그인 확인
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.', code: 'LOGIN_REQUIRED' },
        { status: 401 }
      );
    }

    const supabaseAdmin = createAdminClient();

    // 초대 정보 조회
    const { data: invitation, error: fetchError } = await supabaseAdmin
      .from('tenant_invitations')
      .select(`
        *,
        tenant:tenants (
          id,
          name,
          slug,
          type
        )
      `)
      .eq('token', token)
      .single();

    if (fetchError || !invitation) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 초대입니다.' },
        { status: 404 }
      );
    }

    // 상태 확인
    if (invitation.status === 'accepted') {
      return NextResponse.json(
        { success: false, error: '이미 수락된 초대입니다.', code: 'ALREADY_ACCEPTED' },
        { status: 400 }
      );
    }

    // 만료일 확인
    if (invitation.status === 'expired' || new Date(invitation.expires_at) < new Date()) {
      return NextResponse.json(
        { success: false, error: '만료된 초대입니다.', code: 'EXPIRED' },
        { status: 400 }
      );
    }

    // 이메일 일치 확인
    if (user.email?.toLowerCase() !== invitation.email.toLowerCase()) {
      return NextResponse.json(
        {
          success: false,
          error: '초대받은 이메일과 로그인한 계정의 이메일이 일치하지 않습니다.',
          code: 'EMAIL_MISMATCH',
        },
        { status: 400 }
      );
    }

    // 이미 멤버인지 확인
    const { data: existingMember } = await supabaseAdmin
      .from('tenant_members')
      .select('id')
      .eq('tenant_id', invitation.tenant_id)
      .eq('user_id', user.id)
      .single();

    if (existingMember) {
      // 초대 상태를 accepted로 변경하고 멤버십 유지
      await supabaseAdmin
        .from('tenant_invitations')
        .update({
          status: 'accepted',
          accepted_at: new Date().toISOString(),
        })
        .eq('id', invitation.id);

      return NextResponse.json(
        { success: false, error: '이미 이 사무소의 멤버입니다.', code: 'ALREADY_MEMBER' },
        { status: 400 }
      );
    }

    // 멤버 추가
    const body = await request.json().catch(() => ({}));
    const displayName = body.displayName || user.user_metadata?.full_name || user.email?.split('@')[0];

    const { data: newMember, error: insertError } = await supabaseAdmin
      .from('tenant_members')
      .insert({
        tenant_id: invitation.tenant_id,
        user_id: user.id,
        role: invitation.role,
        display_name: displayName,
        email: user.email,
        status: 'active',
        invited_at: invitation.created_at,
        invited_by: invitation.invited_by,
        joined_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      console.error('Member insert error:', insertError);
      return NextResponse.json(
        { success: false, error: '멤버 등록에 실패했습니다.' },
        { status: 500 }
      );
    }

    // 초대 상태 업데이트
    await supabaseAdmin
      .from('tenant_invitations')
      .update({
        status: 'accepted',
        accepted_at: new Date().toISOString(),
      })
      .eq('id', invitation.id);

    const tenant = invitation.tenant as unknown as {
      id: string;
      name: string;
      slug: string;
      type: string;
    } | null;

    return NextResponse.json({
      success: true,
      data: {
        member: newMember,
        tenant: tenant,
      },
      message: `${tenant?.name || '사무소'}에 합류하셨습니다!`,
    });
  } catch (error) {
    console.error('Invite accept API error:', error);
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
