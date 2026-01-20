/**
 * DELETE/POST /api/admin/tenant/invitations/[id]
 * 초대 취소 및 재전송
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { withRole } from '@/lib/api/with-tenant';

/**
 * DELETE /api/admin/tenant/invitations/[id]
 * 초대 취소 (owner/admin만)
 */
export const DELETE = withRole('admin')(async (request, { tenant, params }) => {
  try {
    const invitationId = params?.id;
    if (!invitationId) {
      return NextResponse.json(
        { success: false, error: '초대 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // 초대 정보 조회
    const { data: invitation, error: fetchError } = await supabase
      .from('tenant_invitations')
      .select('*')
      .eq('id', invitationId)
      .eq('tenant_id', tenant.tenantId)
      .single();

    if (fetchError || !invitation) {
      return NextResponse.json(
        { success: false, error: '초대를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 이미 수락된 초대는 취소 불가
    if (invitation.status === 'accepted') {
      return NextResponse.json(
        { success: false, error: '이미 수락된 초대는 취소할 수 없습니다.' },
        { status: 400 }
      );
    }

    // 초대 삭제
    const { error: deleteError } = await supabase
      .from('tenant_invitations')
      .delete()
      .eq('id', invitationId)
      .eq('tenant_id', tenant.tenantId);

    if (deleteError) {
      console.error('Invitation delete error:', deleteError);
      return NextResponse.json(
        { success: false, error: '초대 취소에 실패했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '초대가 취소되었습니다.',
    });
  } catch (error) {
    console.error('Invitation delete API error:', error);
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
});

/**
 * POST /api/admin/tenant/invitations/[id]/resend
 * 이 라우트는 [id]/resend/route.ts로 이동해야 하지만,
 * 편의상 여기서 action 파라미터로 처리
 *
 * action=resend: 초대 재전송
 */
export const POST = withRole('admin')(async (request, { tenant, params }) => {
  try {
    const invitationId = params?.id;
    if (!invitationId) {
      return NextResponse.json(
        { success: false, error: '초대 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    const url = new URL(request.url);
    const action = url.searchParams.get('action');

    if (action !== 'resend') {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 액션입니다.' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // 초대 정보 조회
    const { data: invitation, error: fetchError } = await supabase
      .from('tenant_invitations')
      .select('*')
      .eq('id', invitationId)
      .eq('tenant_id', tenant.tenantId)
      .single();

    if (fetchError || !invitation) {
      return NextResponse.json(
        { success: false, error: '초대를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 이미 수락된 초대는 재전송 불가
    if (invitation.status === 'accepted') {
      return NextResponse.json(
        { success: false, error: '이미 수락된 초대는 재전송할 수 없습니다.' },
        { status: 400 }
      );
    }

    // 새 토큰 생성 및 만료일 연장
    const crypto = await import('crypto');
    const newToken = crypto.randomBytes(32).toString('hex');
    const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    // 초대 업데이트
    const { data: updatedInvitation, error: updateError } = await supabase
      .from('tenant_invitations')
      .update({
        token: newToken,
        expires_at: newExpiresAt,
        status: 'pending',
      })
      .eq('id', invitationId)
      .eq('tenant_id', tenant.tenantId)
      .select()
      .single();

    if (updateError) {
      console.error('Invitation resend error:', updateError);
      return NextResponse.json(
        { success: false, error: '초대 재전송에 실패했습니다.' },
        { status: 500 }
      );
    }

    // 새 초대 링크 생성
    const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/invite/${newToken}`;

    return NextResponse.json({
      success: true,
      data: {
        invitation: updatedInvitation,
        inviteUrl,
      },
      message: '초대가 재전송되었습니다.',
    });
  } catch (error) {
    console.error('Invitation resend API error:', error);
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
});
