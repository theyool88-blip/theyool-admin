/**
 * 대법원 사건 스냅샷 조회 API
 *
 * GET /api/admin/scourt/snapshot?caseId=xxx
 * - 저장된 스냅샷 데이터 조회 (진행사항, 기일, 서류 등)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const caseId = searchParams.get('caseId');

    if (!caseId) {
      return NextResponse.json(
        { error: 'caseId 파라미터가 필요합니다' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // 최신 스냅샷 조회
    const { data: snapshot, error: snapshotError } = await supabase
      .from('scourt_case_snapshots')
      .select('*')
      .eq('legal_case_id', caseId)
      .order('scraped_at', { ascending: false })
      .limit(1)
      .single();

    if (snapshotError && snapshotError.code !== 'PGRST116') {
      console.error('스냅샷 조회 에러:', snapshotError);
      return NextResponse.json(
        { error: '스냅샷 조회 실패' },
        { status: 500 }
      );
    }

    // 최근 업데이트 조회 (미읽음 우선)
    const { data: updates } = await supabase
      .from('scourt_case_updates')
      .select('*')
      .eq('legal_case_id', caseId)
      .order('detected_at', { ascending: false })
      .limit(10);

    // 사건의 scourt 연동 상태 조회
    const { data: legalCase } = await supabase
      .from('legal_cases')
      .select('scourt_last_sync, scourt_sync_status, court_case_number')
      .eq('id', caseId)
      .single();

    // 프로필 케이스 연동 여부 확인
    const { data: profileCase } = await supabase
      .from('scourt_profile_cases')
      .select('id, profile_id, enc_cs_no, wmonid')
      .eq('legal_case_id', caseId)
      .limit(1)
      .single();

    return NextResponse.json({
      success: true,
      hasSnapshot: !!snapshot,
      snapshot: snapshot ? {
        id: snapshot.id,
        scrapedAt: snapshot.scraped_at,
        caseType: snapshot.case_type,
        basicInfo: snapshot.basic_info,
        hearings: snapshot.hearings || [],
        progress: snapshot.progress || [],
        documents: snapshot.documents || [],
        lowerCourt: snapshot.lower_court || [],
        relatedCases: snapshot.related_cases || [],
      } : null,
      updates: updates || [],
      syncStatus: {
        lastSync: legalCase?.scourt_last_sync,
        status: legalCase?.scourt_sync_status,
        caseNumber: legalCase?.court_case_number,
        isLinked: !!profileCase,
        profileId: profileCase?.profile_id,
      },
    });

  } catch (error) {
    console.error('스냅샷 API 에러:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '알 수 없는 에러' },
      { status: 500 }
    );
  }
}
