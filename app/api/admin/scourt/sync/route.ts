/**
 * 대법원 사건 동기화 API
 *
 * POST /api/admin/scourt/sync
 * - 저장된 encCsNo로 상세 조회 → 스냅샷 저장
 * - REST API 기반 (Puppeteer 불필요)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getScourtApiClient } from '@/lib/scourt/api-client';
import { syncHearingsToCourtHearings } from '@/lib/scourt/hearing-sync';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { legalCaseId, caseNumber, forceRefresh = false } = body;

    if (!legalCaseId || !caseNumber) {
      return NextResponse.json(
        { error: '필수 파라미터 누락: legalCaseId, caseNumber' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // 1. 사건 정보 조회 (enc_cs_no, scourt_wmonid 확인)
    const { data: legalCase, error: caseError } = await supabase
      .from('legal_cases')
      .select('*, scourt_last_sync, enc_cs_no, scourt_wmonid, court_name')
      .eq('id', legalCaseId)
      .single();

    if (caseError || !legalCase) {
      return NextResponse.json(
        { error: '사건을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // 2. 최근 동기화 확인 (5분 이내면 스킵, forceRefresh가 아닌 경우)
    if (!forceRefresh && legalCase.scourt_last_sync) {
      const lastSync = new Date(legalCase.scourt_last_sync);
      const now = new Date();
      const diffMinutes = (now.getTime() - lastSync.getTime()) / 1000 / 60;

      if (diffMinutes < 5) {
        return NextResponse.json({
          success: true,
          message: '최근 동기화됨',
          lastSync: legalCase.scourt_last_sync,
          skipped: true,
        });
      }
    }

    // 3. enc_cs_no 확인 (REST API 방식)
    if (!legalCase.enc_cs_no) {
      // scourt_profile_cases에서도 확인 (기존 Puppeteer 방식 호환)
      const { data: profileCase } = await supabase
        .from('scourt_profile_cases')
        .select('enc_cs_no, wmonid')
        .eq('legal_case_id', legalCaseId)
        .limit(1)
        .single();

      if (!profileCase?.enc_cs_no) {
        return NextResponse.json(
          { error: '저장된 사건을 찾을 수 없습니다. 먼저 사건 검색이 필요합니다.' },
          { status: 404 }
        );
      }

      // enc_cs_no를 legal_cases에 업데이트
      legalCase.enc_cs_no = profileCase.enc_cs_no;
    }

    // 4. 사건번호 파싱
    const caseNumberPattern = /(\d{4})([가-힣]+)(\d+)/;
    const match = caseNumber.match(caseNumberPattern);
    if (!match) {
      return NextResponse.json(
        { error: '사건번호 형식이 올바르지 않습니다' },
        { status: 400 }
      );
    }
    const [, csYear, csDvsNm, csSerial] = match;

    // 5. API 클라이언트로 상세 조회
    const apiClient = getScourtApiClient();

    // 세션 초기화 (저장된 WMONID 사용)
    const savedWmonid = legalCase.scourt_wmonid;
    if (!savedWmonid) {
      return NextResponse.json(
        { error: 'WMONID가 저장되어 있지 않습니다. 사건을 다시 검색해주세요.' },
        { status: 400 }
      );
    }

    console.log(`🔑 저장된 WMONID 사용: ${savedWmonid}`);

    // 저장된 encCsNo + wmonid로 상세 조회 (한글 법원명/사건유형 자동 변환)
    const detailResult = await apiClient.getCaseDetailWithStoredEncCsNo(
      savedWmonid,
      legalCase.enc_cs_no,
      {
        cortCd: legalCase.court_name || '',  // 한글 법원명 (예: 평택가정)
        csYear,
        csDvsCd: csDvsNm,                     // 한글 사건유형 (예: 드단)
        csSerial,
      }
    );

    if (!detailResult.success || !detailResult.data) {
      return NextResponse.json(
        { error: detailResult.error || '상세 조회 실패' },
        { status: 500 }
      );
    }

    const detailData = detailResult.data;

    // 6. 스냅샷 저장 (upsert)
    const { data: existingSnapshot } = await supabase
      .from('scourt_case_snapshots')
      .select('id')
      .eq('legal_case_id', legalCaseId)
      .order('scraped_at', { ascending: false })
      .limit(1)
      .single();

    const snapshotData = {
      legal_case_id: legalCaseId,
      basic_info: {
        csNo: detailData.csNo || caseNumber,
        csNm: detailData.csNm,
        cortNm: detailData.cortNm || legalCase.court_name,
        aplNm: detailData.aplNm,
        rspNm: detailData.rspNm,
        prcdStsNm: detailData.prcdStsNm,
      },
      hearings: detailData.hearings || [],
      progress: detailData.progress || [],
      documents: [],
      lower_court: [],
      related_cases: [],
      case_number: caseNumber,
      court_code: legalCase.court_name,
      scraped_at: new Date().toISOString(),
    };

    let snapshotId: string;
    if (existingSnapshot) {
      // 기존 스냅샷 업데이트
      const { error: updateError } = await supabase
        .from('scourt_case_snapshots')
        .update(snapshotData)
        .eq('id', existingSnapshot.id);

      if (updateError) {
        console.error('스냅샷 업데이트 에러:', updateError);
      }
      snapshotId = existingSnapshot.id;
    } else {
      // 새 스냅샷 생성
      const { data: newSnapshot, error: insertError } = await supabase
        .from('scourt_case_snapshots')
        .insert(snapshotData)
        .select('id')
        .single();

      if (insertError) {
        console.error('스냅샷 생성 에러:', insertError);
        return NextResponse.json(
          { error: '스냅샷 저장 실패' },
          { status: 500 }
        );
      }
      snapshotId = newSnapshot.id;
    }

    // 7. 기일 동기화 (court_hearings 테이블)
    let hearingSyncResult = null;
    if (detailData.hearings && detailData.hearings.length > 0) {
      const hearingsForSync = detailData.hearings.map((h: {
        trmDt?: string;
        trmHm?: string;
        trmNm?: string;
        trmPntNm?: string;
        rslt?: string;
      }) => ({
        date: h.trmDt || '',
        time: h.trmHm || '',
        type: h.trmNm || '',
        location: h.trmPntNm || '',
        result: h.rslt || '',
      }));

      hearingSyncResult = await syncHearingsToCourtHearings(
        legalCaseId,
        caseNumber,
        hearingsForSync
      );
      console.log('📅 기일 동기화 결과:', hearingSyncResult);
    }

    // 8. legal_cases 업데이트
    await supabase
      .from('legal_cases')
      .update({
        scourt_last_sync: new Date().toISOString(),
        scourt_sync_status: 'synced',
        scourt_case_name: detailData.csNm,
      })
      .eq('id', legalCaseId);

    // 9. 응답
    return NextResponse.json({
      success: true,
      caseNumber,
      caseName: detailData.csNm,
      snapshotId,
      hearingsCount: detailData.hearings?.length || 0,
      progressCount: detailData.progress?.length || 0,
      basicInfo: snapshotData.basic_info,
      hearingSync: hearingSyncResult,
    });

  } catch (error) {
    console.error('동기화 에러:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '동기화 실패' },
      { status: 500 }
    );
  }
}

/**
 * 배치 동기화 (여러 사건)
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { caseIds } = body;

    if (!caseIds || !Array.isArray(caseIds) || caseIds.length === 0) {
      return NextResponse.json(
        { error: 'caseIds 배열이 필요합니다' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // 사건 목록 조회
    const { data: cases, error } = await supabase
      .from('legal_cases')
      .select('id, court_case_number')
      .in('id', caseIds);

    if (error || !cases) {
      return NextResponse.json(
        { error: '사건 조회 실패' },
        { status: 500 }
      );
    }

    // 순차 동기화 (너무 빠르면 차단될 수 있음)
    const results = [];
    for (const c of cases) {
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_APP_URL}/api/admin/scourt/sync`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              legalCaseId: c.id,
              caseNumber: c.court_case_number,
            }),
          }
        );
        const result = await response.json();
        results.push({ caseId: c.id, ...result });

        // 요청 간격 (2초)
        await new Promise((r) => setTimeout(r, 2000));
      } catch (err) {
        results.push({
          caseId: c.id,
          success: false,
          error: err instanceof Error ? err.message : '동기화 실패',
        });
      }
    }

    return NextResponse.json({
      success: true,
      totalCount: cases.length,
      successCount: results.filter((r) => r.success).length,
      failedCount: results.filter((r) => !r.success).length,
      results,
    });
  } catch (error) {
    console.error('배치 동기화 에러:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '배치 동기화 실패' },
      { status: 500 }
    );
  }
}
