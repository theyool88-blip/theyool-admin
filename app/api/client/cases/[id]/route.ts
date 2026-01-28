/**
 * 의뢰인 사건 상세 API
 * 의뢰인이 본인 사건의 상세 정보, 재판기일, 기한 조회
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const clientId = session.user.id;
    const { id: caseId } = await params;
    const supabase = await createClient();

    // 1. case_clients에서 본인 사건인지 확인
    const { data: caseClientLink, error: linkError } = await supabase
      .from('case_clients')
      .select('case_id')
      .eq('case_id', caseId)
      .eq('client_id', clientId)
      .maybeSingle();

    if (linkError || !caseClientLink) {
      return NextResponse.json({ error: '사건을 찾을 수 없습니다.' }, { status: 404 });
    }

    // 2. 사건 조회 (opponent_name은 case_parties에서 별도 조회)
    const { data: caseDetailRaw, error: caseError } = await supabase
      .from('legal_cases')
      .select(`
        id,
        case_name,
        court_case_number,
        case_type,
        status,
        court_name,
        notes,
        created_at
      `)
      .eq('id', caseId)
      .single();

    if (caseError || !caseDetailRaw) {
      return NextResponse.json({ error: '사건을 찾을 수 없습니다.' }, { status: 404 });
    }

    // case_parties에서 상대방(is_primary=false) 이름 조회
    // NOTE: is_our_client 컬럼이 스키마에서 제거됨
    const { data: opponentParty } = await supabase
      .from('case_parties')
      .select('party_name')
      .eq('case_id', caseId)
      .eq('is_primary', false)
      .order('party_order', { ascending: true })
      .limit(1)
      .maybeSingle();

    const caseDetail = {
      ...caseDetailRaw,
      opponent_name: opponentParty?.party_name || null
    };

    // 재판기일 조회
    // 스키마: hearing_date(timestamptz), location, result, report
    const { data: hearings, error: _hearingsError } = await supabase
      .from('court_hearings')
      .select(`
        id,
        hearing_date,
        location,
        hearing_type,
        result,
        judge_name,
        report,
        scourt_type_raw
      `)
      .eq('case_id', caseId)
      .order('hearing_date', { ascending: false });

    // 기한 조회
    // 스키마: notes(not description), status(not is_completed)
    const { data: deadlines, error: _deadlinesError } = await supabase
      .from('case_deadlines')
      .select(`
        id,
        deadline_date,
        deadline_type,
        trigger_date,
        notes,
        status
      `)
      .eq('case_id', caseId)
      .order('deadline_date', { ascending: true });

    return NextResponse.json({
      success: true,
      case: caseDetail,
      hearings: hearings || [],
      deadlines: deadlines || [],
    });
  } catch (error) {
    console.error('GET /api/client/cases/[id] error:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
