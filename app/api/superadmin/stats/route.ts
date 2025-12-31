/**
 * GET /api/superadmin/stats
 * 전체 시스템 통계 조회 (슈퍼 어드민 전용)
 */

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { withSuperAdmin } from '@/lib/api/with-super-admin';

export const GET = withSuperAdmin(async () => {
  try {
    const supabase = createAdminClient();
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // 전체 테넌트 수
    const { count: totalTenants } = await supabase
      .from('tenants')
      .select('id', { count: 'exact', head: true });

    // 활성 테넌트 수
    const { count: activeTenants } = await supabase
      .from('tenants')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active');

    // 이번 달 신규 테넌트
    const { count: newTenantsThisMonth } = await supabase
      .from('tenants')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', thisMonthStart.toISOString());

    // 전체 멤버 수
    const { count: totalMembers } = await supabase
      .from('tenant_members')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active');

    // 전체 사건 수
    const { count: totalCases } = await supabase
      .from('legal_cases')
      .select('id', { count: 'exact', head: true });

    // 이번 달 신규 사건
    const { count: newCasesThisMonth } = await supabase
      .from('legal_cases')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', thisMonthStart.toISOString());

    // 전체 상담 수
    const { count: totalConsultations } = await supabase
      .from('consultations')
      .select('id', { count: 'exact', head: true });

    // 이번 달 상담
    const { count: consultationsThisMonth } = await supabase
      .from('consultations')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', thisMonthStart.toISOString());

    // 전체 의뢰인 수
    const { count: totalClients } = await supabase
      .from('clients')
      .select('id', { count: 'exact', head: true });

    // 플랜별 테넌트 수
    const { data: planStats } = await supabase
      .from('tenants')
      .select('plan')
      .eq('status', 'active');

    const planCounts = {
      basic: 0,
      professional: 0,
      enterprise: 0,
    };

    planStats?.forEach((t) => {
      if (t.plan in planCounts) {
        planCounts[t.plan as keyof typeof planCounts]++;
      }
    });

    // 타입별 테넌트 수
    const { data: typeStats } = await supabase
      .from('tenants')
      .select('type')
      .eq('status', 'active');

    const typeCounts = {
      individual: 0,
      firm: 0,
    };

    typeStats?.forEach((t) => {
      if (t.type in typeCounts) {
        typeCounts[t.type as keyof typeof typeCounts]++;
      }
    });

    // 최근 가입한 테넌트 5개
    const { data: recentTenants } = await supabase
      .from('tenants')
      .select('id, name, slug, type, plan, created_at, status')
      .order('created_at', { ascending: false })
      .limit(5);

    return NextResponse.json({
      success: true,
      data: {
        overview: {
          totalTenants: totalTenants || 0,
          activeTenants: activeTenants || 0,
          newTenantsThisMonth: newTenantsThisMonth || 0,
          totalMembers: totalMembers || 0,
          totalCases: totalCases || 0,
          newCasesThisMonth: newCasesThisMonth || 0,
          totalConsultations: totalConsultations || 0,
          consultationsThisMonth: consultationsThisMonth || 0,
          totalClients: totalClients || 0,
        },
        distribution: {
          byPlan: planCounts,
          byType: typeCounts,
        },
        recentTenants: recentTenants || [],
      },
    });

  } catch (error) {
    console.error('Stats API error:', error);
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
});
