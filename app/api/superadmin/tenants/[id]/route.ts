/**
 * GET/PATCH /api/superadmin/tenants/[id]
 * 테넌트 상세 조회 및 수정 (슈퍼 어드민 전용)
 */

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { withSuperAdmin } from '@/lib/api/with-super-admin';

export const GET = withSuperAdmin(async (request, context) => {
  try {
    const supabase = createAdminClient();
    const id = context.params?.id;

    if (!id) {
      return NextResponse.json(
        { success: false, error: '테넌트 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    // 테넌트 조회
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', id)
      .single();

    if (tenantError || !tenant) {
      return NextResponse.json(
        { success: false, error: '테넌트를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 멤버 목록 조회
    const { data: members, error: membersError } = await supabase
      .from('tenant_members')
      .select(`
        id,
        role,
        status,
        created_at,
        users:user_id (
          id,
          full_name,
          email
        )
      `)
      .eq('tenant_id', id)
      .eq('status', 'active')
      .order('created_at', { ascending: true });

    if (membersError) {
      console.error('Members fetch error:', membersError);
    }

    // 통계 조회
    const [
      { count: memberCount },
      { count: caseCount },
      { count: clientCount },
      { count: consultationCount },
    ] = await Promise.all([
      supabase
        .from('tenant_members')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', id)
        .eq('status', 'active'),
      supabase
        .from('legal_cases')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', id),
      supabase
        .from('clients')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', id),
      supabase
        .from('consultations')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', id),
    ]);

    // 홈페이지 콘텐츠 통계 조회 (has_homepage인 경우에만)
    let homepageStats = null;
    if (tenant.has_homepage) {
      const [
        { count: blogCount },
        { count: faqCount },
        { count: homepageCaseCount },
        { count: testimonialCount },
        { count: instagramCount },
      ] = await Promise.all([
        supabase
          .from('blog_posts')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', id),
        supabase
          .from('faqs')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', id),
        supabase
          .from('homepage_cases')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', id),
        supabase
          .from('testimonials')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', id),
        supabase
          .from('instagram_posts')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', id),
      ]);

      homepageStats = {
        blogs: blogCount || 0,
        faqs: faqCount || 0,
        cases: homepageCaseCount || 0,
        testimonials: testimonialCount || 0,
        instagram: instagramCount || 0,
      };
    }

    // 멤버 데이터 포맷팅
    const formattedMembers = (members || []).map((member: any) => ({
      id: member.id,
      name: member.users?.full_name || '알 수 없음',
      email: member.users?.email || '',
      role: member.role,
      created_at: member.created_at,
    }));

    return NextResponse.json({
      success: true,
      data: {
        tenant,
        stats: {
          members: memberCount || 0,
          cases: caseCount || 0,
          clients: clientCount || 0,
          consultations: consultationCount || 0,
        },
        homepageStats,
        members: formattedMembers,
      },
    });

  } catch (error) {
    console.error('Tenant detail API error:', error);
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
});

export const PATCH = withSuperAdmin(async (request, context) => {
  try {
    const supabase = createAdminClient();
    const id = context.params?.id;
    const body = await request.json();

    if (!id) {
      return NextResponse.json(
        { success: false, error: '테넌트 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    // 허용된 필드만 업데이트
    const allowedFields = ['name', 'email', 'phone', 'status', 'plan', 'has_homepage'];
    const updateData: Record<string, any> = {};

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { success: false, error: '업데이트할 데이터가 없습니다.' },
        { status: 400 }
      );
    }

    updateData.updated_at = new Date().toISOString();

    const { data: tenant, error } = await supabase
      .from('tenants')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Tenant update error:', error);
      return NextResponse.json(
        { success: false, error: '테넌트 수정에 실패했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: tenant,
    });

  } catch (error) {
    console.error('Tenant update API error:', error);
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
});
