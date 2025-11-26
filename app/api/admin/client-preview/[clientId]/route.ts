/**
 * 관리자용 의뢰인 미리보기 API
 * 관리자가 특정 의뢰인의 포털 화면을 미리볼 수 있게 함
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    // 관리자 인증 확인
    const cookieStore = await cookies();
    const isAdmin = cookieStore.get('admin_authenticated')?.value === 'true';

    if (!isAdmin) {
      return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 401 });
    }

    const { clientId } = await params;
    const supabase = await createClient();

    // 의뢰인 정보 조회
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, name, phone')
      .eq('id', clientId)
      .single();

    if (clientError || !client) {
      return NextResponse.json({ error: '의뢰인을 찾을 수 없습니다.' }, { status: 404 });
    }

    // 의뢰인의 사건 목록 조회
    const { data: cases, error: casesError } = await supabase
      .from('legal_cases')
      .select('id, case_name, case_number, case_type, status, office_location, created_at, opponent_name')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });

    if (casesError) {
      console.error('사건 조회 오류:', casesError);
    }

    // 다가오는 재판 조회 (30일 이내)
    const today = new Date().toISOString().split('T')[0];
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);
    const futureDateStr = futureDate.toISOString().split('T')[0];

    const caseIds = (cases || []).map((c) => c.id);

    let upcomingHearings: Array<{
      id: string;
      hearing_date: string;
      hearing_time: string;
      court_name: string;
      case_number: string;
      case_name: string;
    }> = [];

    if (caseIds.length > 0) {
      const { data: hearings, error: hearingsError } = await supabase
        .from('court_hearings')
        .select(`
          id,
          hearing_date,
          hearing_time,
          court_name,
          case_number,
          legal_cases (
            case_name
          )
        `)
        .in('case_id', caseIds)
        .gte('hearing_date', today)
        .lte('hearing_date', futureDateStr)
        .order('hearing_date', { ascending: true })
        .limit(5);

      if (!hearingsError && hearings) {
        upcomingHearings = hearings.map((h) => ({
          id: h.id,
          hearing_date: h.hearing_date,
          hearing_time: h.hearing_time || '',
          court_name: h.court_name || '',
          case_number: h.case_number || '',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          case_name: (h.legal_cases as any)?.case_name || '',
        }));
      }
    }

    return NextResponse.json({
      success: true,
      client,
      cases: cases || [],
      upcomingHearings,
    });
  } catch (error) {
    console.error('GET /api/admin/client-preview/[clientId] error:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
