/**
 * POST/DELETE /api/admin/tenant/members/[id]/suspend
 * 멤버 정지 및 정지 해제
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { withRole } from '@/lib/api/with-tenant';

/**
 * POST /api/admin/tenant/members/[id]/suspend
 * 멤버 정지 (owner/admin만)
 */
export const POST = withRole('admin')(async (request, { tenant, params }) => {
  try {
    const memberId = params?.id;
    if (!memberId) {
      return NextResponse.json(
        { success: false, error: '멤버 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // 멤버 정보 조회
    const { data: member, error: fetchError } = await supabase
      .from('tenant_members')
      .select('*')
      .eq('id', memberId)
      .eq('tenant_id', tenant.tenantId)
      .single();

    if (fetchError || !member) {
      return NextResponse.json(
        { success: false, error: '멤버를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 본인 정지 불가
    if (memberId === tenant.memberId) {
      return NextResponse.json(
        { success: false, error: '본인은 정지할 수 없습니다.' },
        { status: 400 }
      );
    }

    // owner 정지 불가
    if (member.role === 'owner') {
      return NextResponse.json(
        { success: false, error: 'Owner는 정지할 수 없습니다.' },
        { status: 400 }
      );
    }

    // admin은 owner만 정지 가능
    if (member.role === 'admin' && tenant.memberRole !== 'owner') {
      return NextResponse.json(
        { success: false, error: 'Admin은 소유자만 정지할 수 있습니다.' },
        { status: 403 }
      );
    }

    // 이미 정지된 경우
    if (member.status === 'suspended') {
      return NextResponse.json(
        { success: false, error: '이미 정지된 멤버입니다.' },
        { status: 400 }
      );
    }

    // 멤버 정지
    const { data: updatedMember, error: updateError } = await supabase
      .from('tenant_members')
      .update({ status: 'suspended' })
      .eq('id', memberId)
      .eq('tenant_id', tenant.tenantId)
      .select()
      .single();

    if (updateError) {
      console.error('Member suspend error:', updateError);
      return NextResponse.json(
        { success: false, error: '멤버 정지에 실패했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { member: updatedMember },
      message: '멤버가 정지되었습니다.',
    });
  } catch (error) {
    console.error('Member suspend API error:', error);
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
});

/**
 * DELETE /api/admin/tenant/members/[id]/suspend
 * 멤버 정지 해제 (owner/admin만)
 */
export const DELETE = withRole('admin')(async (request, { tenant, params }) => {
  try {
    const memberId = params?.id;
    if (!memberId) {
      return NextResponse.json(
        { success: false, error: '멤버 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // 멤버 정보 조회
    const { data: member, error: fetchError } = await supabase
      .from('tenant_members')
      .select('*')
      .eq('id', memberId)
      .eq('tenant_id', tenant.tenantId)
      .single();

    if (fetchError || !member) {
      return NextResponse.json(
        { success: false, error: '멤버를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 정지 상태가 아닌 경우
    if (member.status !== 'suspended') {
      return NextResponse.json(
        { success: false, error: '정지된 멤버가 아닙니다.' },
        { status: 400 }
      );
    }

    // 멤버 정지 해제
    const { data: updatedMember, error: updateError } = await supabase
      .from('tenant_members')
      .update({ status: 'active' })
      .eq('id', memberId)
      .eq('tenant_id', tenant.tenantId)
      .select()
      .single();

    if (updateError) {
      console.error('Member unsuspend error:', updateError);
      return NextResponse.json(
        { success: false, error: '정지 해제에 실패했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { member: updatedMember },
      message: '멤버 정지가 해제되었습니다.',
    });
  } catch (error) {
    console.error('Member unsuspend API error:', error);
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
});
