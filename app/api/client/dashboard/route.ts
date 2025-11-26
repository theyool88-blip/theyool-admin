/**
 * 의뢰인 대시보드 API
 * 의뢰인의 사건 목록 및 다가오는 재판 조회
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const clientId = session.user.id;
    const supabase = await createClient();

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
      cases: cases || [],
      upcomingHearings,
    });
  } catch (error) {
    console.error('GET /api/client/dashboard error:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
