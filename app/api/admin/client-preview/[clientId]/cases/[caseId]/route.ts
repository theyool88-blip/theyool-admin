/**
 * 관리자용 의뢰인 사건 상세 미리보기 API
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string; caseId: string }> }
) {
  try {
    // 관리자 인증 확인
    const cookieStore = await cookies();
    const isAdmin = cookieStore.get('admin_authenticated')?.value === 'true';

    if (!isAdmin) {
      return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 401 });
    }

    const { clientId, caseId } = await params;
    const supabase = await createClient();

    // 사건 조회 (해당 의뢰인의 사건인지 확인)
    const { data: caseDetail, error: caseError } = await supabase
      .from('legal_cases')
      .select(`
        id,
        case_name,
        case_number,
        case_type,
        status,
        office_location,
        court_name,
        opponent_name,
        lawyer_name,
        description,
        created_at
      `)
      .eq('id', caseId)
      .eq('client_id', clientId)
      .single();

    if (caseError || !caseDetail) {
      return NextResponse.json({ error: '사건을 찾을 수 없습니다.' }, { status: 404 });
    }

    // 재판기일 조회
    const { data: hearings } = await supabase
      .from('court_hearings')
      .select(`
        id,
        hearing_date,
        hearing_time,
        court_name,
        hearing_type,
        hearing_result,
        judge_name,
        hearing_report
      `)
      .eq('case_id', caseId)
      .order('hearing_date', { ascending: false });

    // 기한 조회
    const { data: deadlines } = await supabase
      .from('case_deadlines')
      .select(`
        id,
        deadline_date,
        deadline_type,
        description,
        is_completed
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
    console.error('GET /api/admin/client-preview/[clientId]/cases/[caseId] error:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
