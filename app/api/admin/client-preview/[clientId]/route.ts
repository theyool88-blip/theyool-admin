/**
 * 관리자용 의뢰인 미리보기 API
 * @description 관리자가 특정 의뢰인의 포털 화면을 미리볼 수 있게 함
 * @endpoint GET /api/admin/client-preview/[clientId]
 * @returns 의뢰인 기본 정보, 사건 목록, 다가오는 재판기일, 다가오는 기한
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isAuthenticated } from '@/lib/auth/auth';

// Response Types
interface ClientInfo {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  birth_date?: string;
  resident_number?: string;
  bank_account?: string;
  client_type?: 'individual' | 'corporation';
  company_name?: string;
  registration_number?: string;
}

interface CaseInfo {
  id: string;
  case_name: string;
  contract_number: string;
  case_type: string;
  status: string;
  office: string;
  contract_date: string;
  created_at: string;
  onedrive_folder_url: string | null;
}

interface UpcomingHearing {
  id: string;
  hearing_date: string;
  hearing_time: string;
  court_name: string;
  case_number: string;
  case_name: string;
}

interface UpcomingDeadline {
  id: string;
  deadline_date: string;
  deadline_type: string;
  description: string;
  case_name: string;
}

interface ClientPreviewResponse {
  success: true;
  client: ClientInfo;
  cases: CaseInfo[];
  upcomingHearings: UpcomingHearing[];
  upcomingDeadlines: UpcomingDeadline[];
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    // Authentication check
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    const supabase = createAdminClient();
    const { clientId } = await params;

    // Validate clientId format (UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(clientId)) {
      return NextResponse.json(
        { error: '유효하지 않은 의뢰인 ID입니다.' },
        { status: 400 }
      );
    }

    // 1. 의뢰인 정보 조회
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, name, phone, email, address, birth_date, resident_number, bank_account, client_type, company_name, registration_number')
      .eq('id', clientId)
      .single();

    if (clientError) {
      console.error('[Client Preview] Client fetch error:', {
        clientId,
        error: clientError.message,
        code: clientError.code
      });
      return NextResponse.json(
        { error: '의뢰인을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    if (!client) {
      return NextResponse.json(
        { error: '의뢰인을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 2. 의뢰인의 사건 목록 조회 (primary_client_id 또는 case_clients 테이블 사용)
    // 먼저 case_clients에서 해당 의뢰인이 연결된 사건 ID 목록 조회
    const { data: clientCases } = await supabase
      .from('case_clients')
      .select('case_id')
      .eq('client_id', clientId);

    const caseIdsFromClientTable = clientCases?.map(cc => cc.case_id) || [];

    // primary_client_id로도 조회 (레거시 호환)
    const { data: cases, error: casesError } = await supabase
      .from('legal_cases')
      .select('id, case_name, contract_number, case_type, status, office, contract_date, created_at, onedrive_folder_url')
      .or(`primary_client_id.eq.${clientId}${caseIdsFromClientTable.length > 0 ? `,id.in.(${caseIdsFromClientTable.join(',')})` : ''}`)
      .order('created_at', { ascending: false });

    if (casesError) {
      console.error('[Client Preview] Cases fetch error:', {
        clientId,
        error: casesError.message
      });
    }

    const casesList = cases || [];
    const caseIds = casesList.map((c) => c.id);

    // Date range for upcoming items (30 days)
    const today = new Date().toISOString().split('T')[0];
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);
    const futureDateStr = futureDate.toISOString().split('T')[0];

    // 3. 다가오는 재판기일 조회 (30일 이내)
    let upcomingHearings: UpcomingHearing[] = [];

    if (caseIds.length > 0) {
      const { data: hearings, error: hearingsError } = await supabase
        .from('court_hearings')
        .select(`
          id,
          hearing_date,
          location,
          case_number,
          legal_cases!inner (
            case_name
          )
        `)
        .in('case_id', caseIds)
        .gte('hearing_date', today)
        .lte('hearing_date', futureDateStr)
        .order('hearing_date', { ascending: true })
        .limit(10);

      if (hearingsError) {
        console.error('[Client Preview] Hearings fetch error:', {
          clientId,
          error: hearingsError.message
        });
      } else if (hearings) {
        upcomingHearings = hearings.map((h) => {
          const legalCase = Array.isArray(h.legal_cases)
            ? h.legal_cases[0]
            : h.legal_cases;

          // hearing_date에서 시간 추출 (YYYY-MM-DD HH:MM 형식인 경우)
          const dateTimeParts = h.hearing_date.split(' ');
          const date = dateTimeParts[0];
          const time = dateTimeParts.length > 1 ? dateTimeParts[1] : '';

          return {
            id: h.id,
            hearing_date: date,
            hearing_time: time,
            court_name: h.location || '',
            case_number: h.case_number || '',
            case_name: legalCase?.case_name || '',
          };
        });
      }
    }

    // 4. 다가오는 기한 조회 (30일 이내, 미완료만)
    let upcomingDeadlines: UpcomingDeadline[] = [];

    if (caseIds.length > 0) {
      const { data: deadlines, error: deadlinesError } = await supabase
        .from('case_deadlines')
        .select(`
          id,
          deadline_date,
          deadline_type,
          notes,
          status,
          legal_cases!inner (
            case_name
          )
        `)
        .in('case_id', caseIds)
        .neq('status', 'COMPLETED')
        .gte('deadline_date', today)
        .lte('deadline_date', futureDateStr)
        .order('deadline_date', { ascending: true })
        .limit(10);

      if (deadlinesError) {
        console.error('[Client Preview] Deadlines fetch error:', {
          clientId,
          error: deadlinesError.message
        });
      } else if (deadlines) {
        upcomingDeadlines = deadlines.map((d) => {
          const legalCase = Array.isArray(d.legal_cases)
            ? d.legal_cases[0]
            : d.legal_cases;

          return {
            id: d.id,
            deadline_date: d.deadline_date,
            deadline_type: d.deadline_type || '',
            description: d.notes || '',
            case_name: legalCase?.case_name || '',
          };
        });
      }
    }

    const response: ClientPreviewResponse = {
      success: true,
      client,
      cases: casesList,
      upcomingHearings,
      upcomingDeadlines,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[Client Preview] Unexpected error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });

    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
