/**
 * GET/PUT /api/admin/profile
 * 본인 프로필 조회 및 수정
 */

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { withTenant } from '@/lib/api/with-tenant';

/**
 * GET /api/admin/profile
 * 본인 프로필 조회
 */
export const GET = withTenant(async (request, { tenant }) => {
  try {
    const supabase = createAdminClient();

    const { data: member, error } = await supabase
      .from('tenant_members')
      .select('id, display_name, title, phone, email, bar_number, role')
      .eq('id', tenant.memberId)
      .single();

    if (error || !member) {
      return NextResponse.json(
        { success: false, error: '프로필을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { profile: member },
    });
  } catch (error) {
    console.error('Profile fetch error:', error);
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
});

/**
 * PUT /api/admin/profile
 * 본인 프로필 수정
 */
export const PUT = withTenant(async (request, { tenant }) => {
  try {
    const body = await request.json();
    const supabase = createAdminClient();

    // 업데이트 가능한 필드만 허용
    const updateData: Record<string, unknown> = {};

    if (body.display_name !== undefined) updateData.display_name = body.display_name;
    if (body.title !== undefined) updateData.title = body.title;
    if (body.phone !== undefined) updateData.phone = body.phone;
    if (body.email !== undefined) updateData.email = body.email;
    if (body.bar_number !== undefined) updateData.bar_number = body.bar_number;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { success: false, error: '변경할 내용이 없습니다.' },
        { status: 400 }
      );
    }

    const { data: updatedProfile, error } = await supabase
      .from('tenant_members')
      .update(updateData)
      .eq('id', tenant.memberId)
      .select('id, display_name, title, phone, email, bar_number, role')
      .single();

    if (error) {
      console.error('Profile update error:', error);
      return NextResponse.json(
        { success: false, error: '프로필 수정에 실패했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { profile: updatedProfile },
    });
  } catch (error) {
    console.error('Profile update API error:', error);
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
});
