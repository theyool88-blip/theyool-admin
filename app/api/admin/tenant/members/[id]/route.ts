/**
 * PUT/DELETE /api/admin/tenant/members/[id]
 * 멤버 정보 수정 및 제거
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { withRole } from '@/lib/api/with-tenant';
import type { MemberRole } from '@/types/tenant';

/**
 * PUT /api/admin/tenant/members/[id]
 * 멤버 정보 수정 (owner/admin만)
 */
export const PUT = withRole('admin')(async (request, { tenant, params }) => {
  try {
    const memberId = params?.id;
    if (!memberId) {
      return NextResponse.json(
        { success: false, error: '멤버 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    const body = await request.json();
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

    // 본인 수정은 일부 필드만 가능
    const isSelf = memberId === tenant.memberId;

    // 역할 변경 검증
    if (body.role) {
      // owner 역할로 변경 불가
      if (body.role === 'owner') {
        return NextResponse.json(
          { success: false, error: 'Owner 역할로 변경할 수 없습니다.' },
          { status: 400 }
        );
      }

      // 본인 역할 변경 불가
      if (isSelf) {
        return NextResponse.json(
          { success: false, error: '본인의 역할은 변경할 수 없습니다.' },
          { status: 400 }
        );
      }

      // owner의 역할은 변경 불가
      if (member.role === 'owner') {
        return NextResponse.json(
          { success: false, error: 'Owner의 역할은 변경할 수 없습니다.' },
          { status: 400 }
        );
      }

      // admin 역할 부여는 owner만 가능
      if (body.role === 'admin' && tenant.memberRole !== 'owner') {
        return NextResponse.json(
          { success: false, error: 'Admin 역할은 소유자만 부여할 수 있습니다.' },
          { status: 403 }
        );
      }

      // 유효한 역할인지 확인
      const validRoles: MemberRole[] = ['admin', 'lawyer', 'staff'];
      if (!validRoles.includes(body.role)) {
        return NextResponse.json(
          { success: false, error: '유효하지 않은 역할입니다.' },
          { status: 400 }
        );
      }
    }

    // 업데이트 데이터 구성
    const updateData: Record<string, unknown> = {};

    // 프로필 필드
    if (body.display_name !== undefined) updateData.display_name = body.display_name;
    if (body.title !== undefined) updateData.title = body.title;
    if (body.phone !== undefined) updateData.phone = body.phone;
    if (body.email !== undefined) updateData.email = body.email;
    if (body.bar_number !== undefined) updateData.bar_number = body.bar_number;

    // 역할 (본인 아닐 때만)
    if (body.role && !isSelf) {
      updateData.role = body.role;
    }

    // 권한 (admin 이상만)
    if (body.permissions !== undefined && !isSelf) {
      updateData.permissions = body.permissions;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { success: false, error: '변경할 내용이 없습니다.' },
        { status: 400 }
      );
    }

    // 멤버 정보 수정
    const { data: updatedMember, error: updateError } = await supabase
      .from('tenant_members')
      .update(updateData)
      .eq('id', memberId)
      .eq('tenant_id', tenant.tenantId)
      .select()
      .single();

    if (updateError) {
      console.error('Member update error:', updateError);
      return NextResponse.json(
        { success: false, error: '멤버 정보 수정에 실패했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { member: updatedMember },
    });
  } catch (error) {
    console.error('Member update API error:', error);
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
});

/**
 * DELETE /api/admin/tenant/members/[id]
 * 멤버 제거 (owner/admin만)
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

    // 본인 제거 불가
    if (memberId === tenant.memberId) {
      return NextResponse.json(
        { success: false, error: '본인은 제거할 수 없습니다.' },
        { status: 400 }
      );
    }

    // owner 제거 불가
    if (member.role === 'owner') {
      return NextResponse.json(
        { success: false, error: 'Owner는 제거할 수 없습니다.' },
        { status: 400 }
      );
    }

    // admin은 owner만 제거 가능
    if (member.role === 'admin' && tenant.memberRole !== 'owner') {
      return NextResponse.json(
        { success: false, error: 'Admin은 소유자만 제거할 수 있습니다.' },
        { status: 403 }
      );
    }

    // 멤버 제거
    const { error: deleteError } = await supabase
      .from('tenant_members')
      .delete()
      .eq('id', memberId)
      .eq('tenant_id', tenant.tenantId);

    if (deleteError) {
      console.error('Member delete error:', deleteError);
      return NextResponse.json(
        { success: false, error: '멤버 제거에 실패했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '멤버가 제거되었습니다.',
    });
  } catch (error) {
    console.error('Member delete API error:', error);
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
});
