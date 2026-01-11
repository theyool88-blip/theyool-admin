/**
 * GET/PUT /api/admin/tenant
 * 현재 테넌트 정보 조회 및 수정
 */

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { withTenant } from '@/lib/api/with-tenant';

/**
 * GET /api/admin/tenant
 * 현재 테넌트 정보 조회
 */
export const GET = withTenant(async (request, { tenant }) => {
  try {
    const supabase = createAdminClient();

    // 테넌트 정보 조회
    const { data: tenantData, error } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', tenant.tenantId)
      .single();

    if (error) {
      console.error('Tenant fetch error:', error);
      return NextResponse.json(
        { success: false, error: '테넌트 정보를 가져올 수 없습니다.' },
        { status: 500 }
      );
    }

    // 멤버 목록 조회
    const { data: members } = await supabase
      .from('tenant_members')
      .select('id, user_id, role, display_name, email, phone, bar_number, status, joined_at')
      .eq('tenant_id', tenant.tenantId)
      .order('role', { ascending: true });

    // 통계 조회
    const { count: caseCount } = await supabase
      .from('legal_cases')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenant.tenantId);

    const { count: clientCount } = await supabase
      .from('clients')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenant.tenantId);

    const { count: consultationCount } = await supabase
      .from('consultations')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenant.tenantId);

    return NextResponse.json({
      success: true,
      data: {
        tenant: tenantData,
        members: members || [],
        stats: {
          cases: caseCount || 0,
          clients: clientCount || 0,
          consultations: consultationCount || 0,
          members: members?.length || 0,
        },
        currentMember: {
          id: tenant.memberId,
          role: tenant.memberRole,
        },
      },
    });

  } catch (error) {
    console.error('Tenant API error:', error);
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
});

/**
 * PUT /api/admin/tenant
 * 테넌트 정보 수정 (owner/admin만)
 */
export const PUT = withTenant(async (request, { tenant }) => {
  try {
    // 권한 확인 (owner 또는 admin만)
    if (!['owner', 'admin'].includes(tenant.memberRole)) {
      return NextResponse.json(
        { success: false, error: '테넌트 설정 변경 권한이 없습니다.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const supabase = createAdminClient();

    // 업데이트 가능한 필드만 추출
    const updateData: Record<string, unknown> = {};

    if (body.name) updateData.name = body.name;
    if (body.phone !== undefined) updateData.phone = body.phone;
    if (body.email !== undefined) updateData.email = body.email;
    if (body.address !== undefined) updateData.address = body.address;
    if (body.settings) updateData.settings = body.settings;

    // 홈페이지 설정은 슈퍼어드민이나 특별 권한 필요
    // (일단 owner만 가능)
    if (tenant.memberRole === 'owner') {
      if (body.has_homepage !== undefined) updateData.has_homepage = body.has_homepage;
      if (body.homepage_domain !== undefined) updateData.homepage_domain = body.homepage_domain;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { success: false, error: '변경할 내용이 없습니다.' },
        { status: 400 }
      );
    }

    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('tenants')
      .update(updateData)
      .eq('id', tenant.tenantId)
      .select()
      .single();

    if (error) {
      console.error('Tenant update error:', error);
      return NextResponse.json(
        { success: false, error: '테넌트 정보 수정에 실패했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { tenant: data },
    });

  } catch (error) {
    console.error('Tenant update API error:', error);
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
});
