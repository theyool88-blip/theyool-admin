/**
 * GET/POST /api/admin/tenant/members
 * 멤버 목록 조회 및 초대
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { withRole } from '@/lib/api/with-tenant';
import type { MemberRole } from '@/types/tenant';

// 플랜별 멤버 제한
const PLAN_MEMBER_LIMITS: Record<string, number> = {
  basic: 2,
  professional: 5,
  enterprise: -1, // 무제한
};

/**
 * GET /api/admin/tenant/members
 * 멤버 목록 조회 (owner/admin만)
 */
export const GET = withRole('admin')(async (request, { tenant }) => {
  try {
    const supabase = createAdminClient();

    // 멤버 목록 조회
    const { data: members, error: memberError } = await supabase
      .from('tenant_members')
      .select('*')
      .eq('tenant_id', tenant.tenantId)
      .order('created_at', { ascending: true });

    if (memberError) {
      console.error('Members fetch error:', memberError);
      return NextResponse.json(
        { success: false, error: '멤버 목록을 가져올 수 없습니다.' },
        { status: 500 }
      );
    }

    // 대기중인 초대 목록 조회
    const { data: invitations, error: invitationError } = await supabase
      .from('tenant_invitations')
      .select('*')
      .eq('tenant_id', tenant.tenantId)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (invitationError) {
      console.error('Invitations fetch error:', invitationError);
    }

    // 테넌트 플랜 정보 조회
    const { data: tenantData } = await supabase
      .from('tenants')
      .select('plan, features')
      .eq('id', tenant.tenantId)
      .single();

    const plan = tenantData?.plan || 'basic';
    const memberLimit = PLAN_MEMBER_LIMITS[plan] || 2;
    const currentMemberCount = members?.length || 0;

    return NextResponse.json({
      success: true,
      data: {
        members: members || [],
        invitations: invitations || [],
        memberLimit,
        currentMemberCount,
        canInvite: memberLimit === -1 || currentMemberCount < memberLimit,
      },
    });
  } catch (error) {
    console.error('Members API error:', error);
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
});

/**
 * POST /api/admin/tenant/members
 * 새 멤버 초대 (owner/admin만)
 */
export const POST = withRole('admin')(async (request, { tenant }) => {
  try {
    const body = await request.json();
    const { email, role } = body;

    // 유효성 검사
    if (!email || !role) {
      return NextResponse.json(
        { success: false, error: '이메일과 역할을 입력해주세요.' },
        { status: 400 }
      );
    }

    // 이메일 형식 검사
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { success: false, error: '유효한 이메일 주소를 입력해주세요.' },
        { status: 400 }
      );
    }

    // 역할 검사
    const allowedRoles: MemberRole[] = ['admin', 'lawyer', 'staff'];
    if (!allowedRoles.includes(role)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 역할입니다.' },
        { status: 400 }
      );
    }

    // owner 역할은 초대 불가
    if (role === 'owner') {
      return NextResponse.json(
        { success: false, error: 'Owner 역할은 초대할 수 없습니다.' },
        { status: 400 }
      );
    }

    // admin 역할은 owner만 초대 가능
    if (role === 'admin' && tenant.memberRole !== 'owner') {
      return NextResponse.json(
        { success: false, error: 'Admin 역할은 소유자만 초대할 수 있습니다.' },
        { status: 403 }
      );
    }

    const supabase = createAdminClient();

    // 플랜 제한 확인
    const { data: tenantData } = await supabase
      .from('tenants')
      .select('plan')
      .eq('id', tenant.tenantId)
      .single();

    const plan = tenantData?.plan || 'basic';
    const memberLimit = PLAN_MEMBER_LIMITS[plan] || 2;

    // 현재 멤버 수 확인
    const { count: memberCount } = await supabase
      .from('tenant_members')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenant.tenantId);

    // 대기중인 초대 수 확인
    const { count: invitationCount } = await supabase
      .from('tenant_invitations')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenant.tenantId)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString());

    const totalCount = (memberCount || 0) + (invitationCount || 0);

    if (memberLimit !== -1 && totalCount >= memberLimit) {
      return NextResponse.json(
        {
          success: false,
          error: `현재 플랜(${plan})에서는 최대 ${memberLimit}명까지 멤버를 추가할 수 있습니다.`,
        },
        { status: 400 }
      );
    }

    // 이미 초대가 대기중인지 확인
    const { data: existingInvitation } = await supabase
      .from('tenant_invitations')
      .select('id')
      .eq('tenant_id', tenant.tenantId)
      .eq('email', email.toLowerCase())
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
      .single();

    if (existingInvitation) {
      return NextResponse.json(
        { success: false, error: '이미 대기중인 초대가 있습니다.' },
        { status: 400 }
      );
    }

    // 이미 수락된 초대가 있는지 확인 (이메일로)
    const { data: acceptedInvitation } = await supabase
      .from('tenant_invitations')
      .select('id')
      .eq('tenant_id', tenant.tenantId)
      .eq('email', email.toLowerCase())
      .eq('status', 'accepted')
      .single();

    if (acceptedInvitation) {
      return NextResponse.json(
        { success: false, error: '이 이메일로 이미 멤버가 등록되어 있습니다.' },
        { status: 400 }
      );
    }

    // invited_by를 위해 현재 멤버의 user_id 조회
    const { data: currentMember } = await supabase
      .from('tenant_members')
      .select('user_id')
      .eq('id', tenant.memberId)
      .single();

    if (!currentMember) {
      return NextResponse.json(
        { success: false, error: '현재 멤버 정보를 찾을 수 없습니다.' },
        { status: 500 }
      );
    }

    // 초대 생성
    const { data: invitation, error: insertError } = await supabase
      .from('tenant_invitations')
      .insert({
        tenant_id: tenant.tenantId,
        email: email.toLowerCase(),
        role,
        invited_by: currentMember.user_id,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7일
      })
      .select()
      .single();

    if (insertError) {
      console.error('Invitation insert error:', insertError);
      return NextResponse.json(
        { success: false, error: '초대 생성에 실패했습니다.' },
        { status: 500 }
      );
    }

    // 초대 링크 생성
    const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/invite/${invitation.token}`;

    return NextResponse.json({
      success: true,
      data: {
        invitation,
        inviteUrl,
      },
    });
  } catch (error) {
    console.error('Member invite API error:', error);
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
});
