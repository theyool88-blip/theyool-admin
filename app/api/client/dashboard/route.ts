/**
 * 의뢰인 대시보드 API
 * 의뢰인의 사건 목록 및 다가오는 재판 조회
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export async function GET(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const clientId = session.user.id;
    const supabase = await createClient();

    // 의뢰인의 사건 목록 조회 (opponent_name은 case_parties에서 별도 조회)
    const { data: casesRaw, error: casesError } = await supabase
      .from('legal_cases')
      .select('id, case_name, case_number, case_type, status, office_location, created_at')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });

    if (casesError) {
      console.error('사건 조회 오류:', casesError);
    }

    const caseIds = (casesRaw || []).map((c) => c.id);

    // case_parties에서 상대방(is_our_client=false, is_primary=true) 이름 조회
    let opponentMap = new Map<string, string>();
    if (caseIds.length > 0) {
      const { data: opponents } = await supabase
        .from('case_parties')
        .select('case_id, party_name')
        .in('case_id', caseIds)
        .eq('is_our_client', false)
        .eq('is_primary', true);

      if (opponents) {
        opponentMap = new Map(opponents.map(o => [o.case_id, o.party_name]));
      }
    }

    // 사건 목록에 opponent_name 매핑
    const cases = (casesRaw || []).map(c => ({
      ...c,
      opponent_name: opponentMap.get(c.id) || null
    }));

    // 다가오는 재판 조회 (30일 이내)
    const today = new Date().toISOString().split('T')[0];
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);
    const futureDateStr = futureDate.toISOString().split('T')[0];

    // 스키마: hearing_date(timestamptz - 시간 포함), location(not court_name)
    let upcomingHearings: Array<{
      id: string;
      hearing_date: string;
      location: string;
      case_number: string;
      case_name: string;
    }> = [];

    if (caseIds.length > 0) {
      const { data: hearings, error: hearingsError } = await supabase
        .from('court_hearings')
        .select(`
          id,
          hearing_date,
          location,
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
          location: h.location || '',
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
