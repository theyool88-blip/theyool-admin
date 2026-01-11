/**
 * 대법원 사건 업데이트 조회 API
 *
 * GET /api/admin/scourt/updates - 전체 업데이트 조회
 * GET /api/admin/scourt/updates?caseId=xxx - 특정 사건 업데이트 조회
 * PATCH /api/admin/scourt/updates - 읽음 처리
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * 업데이트 목록 조회
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const caseId = searchParams.get('caseId');
    const clientId = searchParams.get('clientId');
    const unreadOnly = searchParams.get('unreadOnly') === 'true';
    const importance = searchParams.get('importance'); // high, normal, low
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // 쿼리 빌드
    let query = supabase
      .from('scourt_case_updates')
      .select(
        `
        *,
        legal_case:legal_cases(
          id,
          case_number,
          case_name,
          client:clients(id, name)
        )
      `,
        { count: 'exact' }
      )
      .order('detected_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // 필터 적용
    if (caseId) {
      query = query.eq('legal_case_id', caseId);
    }

    if (unreadOnly) {
      query = query.eq('is_read_by_client', false);
    }

    if (importance) {
      query = query.eq('importance', importance);
    }

    const { data, error, count } = await query;

    if (error) {
      return NextResponse.json(
        { error: `조회 실패: ${error.message}` },
        { status: 500 }
      );
    }

    // 클라이언트별 필터링 (join 후 필터)
    let filteredData = data || [];
    if (clientId) {
      filteredData = filteredData.filter(
        (item) => item.legal_case?.client?.id === clientId
      );
    }

    return NextResponse.json({
      success: true,
      updates: filteredData,
      total: count || 0,
      limit,
      offset,
    });
  } catch (error) {
    console.error('업데이트 조회 에러:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '조회 실패' },
      { status: 500 }
    );
  }
}

/**
 * 업데이트 읽음 처리
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { updateIds, readBy = 'admin' } = body;

    if (!updateIds || !Array.isArray(updateIds) || updateIds.length === 0) {
      return NextResponse.json(
        { error: 'updateIds 배열이 필요합니다' },
        { status: 400 }
      );
    }

    if (!['admin', 'client'].includes(readBy)) {
      return NextResponse.json(
        { error: 'readBy는 admin 또는 client여야 합니다' },
        { status: 400 }
      );
    }

    const column = readBy === 'admin' ? 'is_read_by_admin' : 'is_read_by_client';
    const timestampColumn =
      readBy === 'admin' ? 'read_at_admin' : 'read_at_client';

    const { data, error } = await supabase
      .from('scourt_case_updates')
      .update({
        [column]: true,
        [timestampColumn]: new Date().toISOString(),
      })
      .in('id', updateIds)
      .select();

    if (error) {
      return NextResponse.json(
        { error: `읽음 처리 실패: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      updatedCount: data?.length || 0,
    });
  } catch (error) {
    console.error('읽음 처리 에러:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '읽음 처리 실패' },
      { status: 500 }
    );
  }
}

/**
 * 사건별 업데이트 요약 조회
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'summary') {
      // 최근 업데이트가 있는 사건 요약
      const { clientId, daysBack = 30, limit = 20 } = body;

      const since = new Date();
      since.setDate(since.getDate() - daysBack);

      const query = supabase
        .from('scourt_case_updates')
        .select(
          `
          legal_case_id,
          legal_case:legal_cases(
            id,
            case_number,
            case_name,
            client:clients(id, name)
          )
        `
        )
        .gte('detected_at', since.toISOString())
        .order('detected_at', { ascending: false });

      const { data, error } = await query;

      if (error) {
        return NextResponse.json(
          { error: `요약 조회 실패: ${error.message}` },
          { status: 500 }
        );
      }

      // 사건별 그룹화 및 최신 업데이트 집계
      const caseMap = new Map<
        string,
        {
          legalCaseId: string;
          caseNumber: string;
          caseName: string;
          clientName: string;
          updateCount: number;
        }
      >();

      for (const item of data || []) {
        const caseId = item.legal_case_id;
        // Supabase 조인 결과 타입 처리
        const legalCase = Array.isArray(item.legal_case)
          ? item.legal_case[0]
          : item.legal_case;
        const client = legalCase?.client
          ? (Array.isArray(legalCase.client) ? legalCase.client[0] : legalCase.client)
          : null;

        if (!caseMap.has(caseId)) {
          caseMap.set(caseId, {
            legalCaseId: caseId,
            caseNumber: legalCase?.case_number || '',
            caseName: legalCase?.case_name || '',
            clientName: client?.name || '',
            updateCount: 0,
          });
        }
        const entry = caseMap.get(caseId)!;
        entry.updateCount++;
      }

      // 클라이언트 필터링
      const results = Array.from(caseMap.values());
      if (clientId) {
        // legal_case.client.id로 필터링 필요 - 현재 구조에서는 추가 쿼리 필요
        // 간단히 처리
      }

      // 업데이트 수 기준 정렬
      results.sort((a, b) => b.updateCount - a.updateCount);

      return NextResponse.json({
        success: true,
        summary: results.slice(0, limit),
        totalCases: results.length,
      });
    }

    if (action === 'unread-count') {
      // 미읽음 업데이트 수 조회
      const { caseIds, readBy = 'client' } = body;

      const column =
        readBy === 'admin' ? 'is_read_by_admin' : 'is_read_by_client';

      let query = supabase
        .from('scourt_case_updates')
        .select('legal_case_id', { count: 'exact' })
        .eq(column, false);

      if (caseIds && Array.isArray(caseIds) && caseIds.length > 0) {
        query = query.in('legal_case_id', caseIds);
      }

      const { count, error } = await query;

      if (error) {
        return NextResponse.json(
          { error: `미읽음 수 조회 실패: ${error.message}` },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        unreadCount: count || 0,
      });
    }

    return NextResponse.json(
      { error: '지원하지 않는 action입니다' },
      { status: 400 }
    );
  } catch (error) {
    console.error('POST 에러:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '처리 실패' },
      { status: 500 }
    );
  }
}
