/**
 * GET /api/admin/clients/search
 * 이름+전화번호로 기존 의뢰인 검색 (이해충돌 검토용)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { withTenant } from '@/lib/api/with-tenant';

export const GET = withTenant(async (request, { tenant }) => {
  try {
    const { searchParams } = new URL(request.url);
    const name = searchParams.get('name');
    const phone = searchParams.get('phone');

    if (!name && !phone) {
      return NextResponse.json(
        { success: false, error: 'name 또는 phone 파라미터가 필요합니다.' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // 전화번호에서 하이픈 제거 (검색 시 형식 무관하게 매칭)
    const normalizedPhone = phone?.replace(/-/g, '');

    // 의뢰인 검색 쿼리
    let query = supabase
      .from('clients')
      .select('id, name, phone, email, bank_account, created_at');

    // 테넌트 격리
    if (!tenant.isSuperAdmin && tenant.tenantId) {
      query = query.eq('tenant_id', tenant.tenantId);
    }

    // 이름과 전화번호 모두 있으면 AND 조건
    // 하나만 있으면 해당 조건으로만 검색
    if (name && normalizedPhone) {
      // 이름 완전 일치 + 전화번호 유사 매칭
      query = query
        .ilike('name', name)
        .or(`phone.eq.${phone},phone.eq.${normalizedPhone}`);
    } else if (name) {
      query = query.ilike('name', name);
    } else if (normalizedPhone) {
      // 전화번호 유사 매칭 (하이픈 있는/없는 버전 모두)
      query = query.or(`phone.eq.${phone},phone.eq.${normalizedPhone}`);
    }

    const { data: clients, error: clientError } = await query;

    if (clientError) {
      console.error('Client search error:', clientError);
      return NextResponse.json(
        { success: false, error: '의뢰인 검색에 실패했습니다.' },
        { status: 500 }
      );
    }

    if (!clients || clients.length === 0) {
      return NextResponse.json({
        success: true,
        found: false,
        client: null,
        cases: [],
      });
    }

    // 첫 번째 일치하는 의뢰인의 사건 목록 조회
    const matchedClient = clients[0];

    const { data: cases, error: casesError } = await supabase
      .from('legal_cases')
      .select(`
        id,
        case_name,
        case_type,
        status,
        court_case_number,
        contract_number,
        opponent_name,
        created_at
      `)
      .eq('client_id', matchedClient.id)
      .order('created_at', { ascending: false });

    if (casesError) {
      console.error('Cases fetch error:', casesError);
      // 사건 조회 실패해도 의뢰인 정보는 반환
    }

    return NextResponse.json({
      success: true,
      found: true,
      client: matchedClient,
      cases: cases || [],
      // 추가 매칭 의뢰인이 있으면 알림
      additionalMatches: clients.length > 1 ? clients.length - 1 : 0,
    });

  } catch (error) {
    console.error('Client search API error:', error);
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
});
