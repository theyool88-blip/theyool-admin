/**
 * GET /api/superadmin/tenants
 * 전체 테넌트 목록 조회 (슈퍼 어드민 전용)
 */

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { withSuperAdmin } from '@/lib/api/with-super-admin';

export const GET = withSuperAdmin(async (request) => {
  try {
    const supabase = createAdminClient();
    const { searchParams } = new URL(request.url);

    // 쿼리 파라미터
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const sortBy = searchParams.get('sort_by') || 'created_at';
    const sortOrder = searchParams.get('sort_order') || 'desc';

    // 기본 쿼리
    let query = supabase
      .from('tenants')
      .select('*', { count: 'exact' });

    // 필터 적용
    if (status) {
      query = query.eq('status', status);
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,slug.ilike.%${search}%`);
    }

    // 정렬
    query = query.order(sortBy, { ascending: sortOrder === 'asc' });

    // 페이지네이션
    const from = (page - 1) * limit;
    query = query.range(from, from + limit - 1);

    const { data: tenants, error, count } = await query;

    if (error) {
      console.error('Tenants fetch error:', error);
      return NextResponse.json(
        { success: false, error: '테넌트 목록 조회에 실패했습니다.' },
        { status: 500 }
      );
    }

    // 각 테넌트별 통계 조회
    const tenantsWithStats = await Promise.all(
      (tenants || []).map(async (tenant) => {
        // 멤버 수
        const { count: memberCount } = await supabase
          .from('tenant_members')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenant.id)
          .eq('status', 'active');

        // 사건 수
        const { count: caseCount } = await supabase
          .from('legal_cases')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenant.id);

        // 의뢰인 수
        const { count: clientCount } = await supabase
          .from('clients')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenant.id);

        return {
          ...tenant,
          stats: {
            members: memberCount || 0,
            cases: caseCount || 0,
            clients: clientCount || 0,
          },
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: {
        tenants: tenantsWithStats,
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit),
        },
      },
    });

  } catch (error) {
    console.error('Tenants API error:', error);
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
});
