/**
 * GET /api/admin/tenant/invitations
 * 초대 목록 조회
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { withRole } from '@/lib/api/with-tenant';

/**
 * GET /api/admin/tenant/invitations
 * 초대 목록 조회 (owner/admin만)
 */
export const GET = withRole('admin')(async (request, { tenant }) => {
  try {
    const supabase = createAdminClient();
    const url = new URL(request.url);
    const status = url.searchParams.get('status') || 'all';

    // 쿼리 구성
    let query = supabase
      .from('tenant_invitations')
      .select('*')
      .eq('tenant_id', tenant.tenantId)
      .order('created_at', { ascending: false });

    // 상태 필터
    if (status === 'pending') {
      query = query
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString());
    } else if (status === 'expired') {
      query = query.or(
        `status.eq.expired,and(status.eq.pending,expires_at.lt.${new Date().toISOString()})`
      );
    } else if (status === 'accepted') {
      query = query.eq('status', 'accepted');
    }

    const { data: invitations, error } = await query;

    if (error) {
      console.error('Invitations fetch error:', error);
      return NextResponse.json(
        { success: false, error: '초대 목록을 가져올 수 없습니다.' },
        { status: 500 }
      );
    }

    // 만료된 초대 상태 업데이트 (pending인데 expires_at이 지난 경우)
    const expiredInvitations = invitations?.filter(
      (inv) =>
        inv.status === 'pending' && new Date(inv.expires_at) < new Date()
    );

    if (expiredInvitations && expiredInvitations.length > 0) {
      const expiredIds = expiredInvitations.map((inv) => inv.id);
      await supabase
        .from('tenant_invitations')
        .update({ status: 'expired' })
        .in('id', expiredIds);

      // 응답 데이터에서 상태 업데이트
      invitations?.forEach((inv) => {
        if (expiredIds.includes(inv.id)) {
          inv.status = 'expired';
        }
      });
    }

    return NextResponse.json({
      success: true,
      data: { invitations: invitations || [] },
    });
  } catch (error) {
    console.error('Invitations API error:', error);
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
});
