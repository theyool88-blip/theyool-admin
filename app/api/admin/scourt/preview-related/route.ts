/**
 * Preview Related Case API
 *
 * POST /api/admin/scourt/preview-related
 * - Fetches preview data for unlinked related cases from SCOURT
 * - Uses encCsNo (encrypted case number) from snapshot
 * - Returns general info and progress history for preview modal
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getScourtApiClient } from '@/lib/scourt/api-client';
import { parseCaseNumber } from '@/lib/scourt/case-number-utils';

interface PreviewRequest {
  encCsNo: string;           // Required: SCOURT encrypted case number
  caseNo: string;            // e.g., "2025가소6582"
  courtName?: string;        // e.g., "수원지방법원"
  sourceCaseId: string;      // The source case ID (to get WMONID)
}

interface PreviewResponse {
  success: boolean;
  generalInfo?: {
    csNm: string;            // 사건명
    cortNm: string;          // 법원명
    prcdStsNm: string;       // 진행상태
    rcptDt: string;          // 접수일
    jdgNm: string;           // 재판부
    parties: Array<{ label: string; name: string }>;
  };
  progress?: Array<{
    date: string;
    event: string;
    result?: string;
  }>;
  error?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as Partial<PreviewRequest>;
    const { encCsNo, caseNo, courtName, sourceCaseId } = body;

    // Validate required parameters
    if (!encCsNo) {
      return NextResponse.json(
        { success: false, error: '암호화된 사건번호가 필요합니다' },
        { status: 400 }
      );
    }

    if (!caseNo) {
      return NextResponse.json(
        { success: false, error: '사건번호가 필요합니다' },
        { status: 400 }
      );
    }

    if (!sourceCaseId) {
      return NextResponse.json(
        { success: false, error: '소스 사건 ID가 필요합니다' },
        { status: 400 }
      );
    }

    console.log(`[PREVIEW RELATED] 미리보기 요청: ${caseNo} (encCsNo: ${encCsNo.substring(0, 10)}...)`);

    const supabase = createAdminClient();

    // Get source case WMONID (required for SCOURT session)
    const { data: sourceCase, error: sourceCaseError } = await supabase
      .from('legal_cases')
      .select('scourt_wmonid, court_name')
      .eq('id', sourceCaseId)
      .single();

    if (sourceCaseError || !sourceCase) {
      console.error('[PREVIEW RELATED] 소스 사건 조회 실패:', sourceCaseError);
      return NextResponse.json(
        { success: false, error: '소스 사건을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    if (!sourceCase.scourt_wmonid) {
      return NextResponse.json(
        { success: false, error: 'SCOURT 세션 정보가 없습니다. 먼저 소스 사건을 동기화해주세요.' },
        { status: 400 }
      );
    }

    // Parse case number
    const parsed = parseCaseNumber(caseNo);
    if (!parsed.valid) {
      return NextResponse.json(
        { success: false, error: `사건번호 형식이 올바르지 않습니다: ${caseNo}` },
        { status: 400 }
      );
    }

    const { year: csYear, caseType: csDvsNm, serial: csSerial } = parsed;

    // Get court code
    const { getCourtCodeByName, getCourtFullName } = await import('@/lib/scourt/court-codes');
    const effectiveCourtName = courtName || sourceCase.court_name || '';
    const normalizedCourtName = getCourtFullName(effectiveCourtName, csDvsNm);
    const cortCd = getCourtCodeByName(normalizedCourtName) || normalizedCourtName;

    // Initialize SCOURT API client
    const apiClient = getScourtApiClient();
    const sessionOk = await apiClient.initSession(sourceCase.scourt_wmonid);

    if (!sessionOk) {
      return NextResponse.json(
        { success: false, error: 'SCOURT 세션 초기화 실패' },
        { status: 500 }
      );
    }

    console.log(`[PREVIEW RELATED] 일반내용 조회 중: ${cortCd} ${csYear}${csDvsNm}${csSerial}`);

    // Fetch general info using stored encCsNo
    const generalResult = await apiClient.getCaseGeneralWithStoredEncCsNo(
      sourceCase.scourt_wmonid,
      encCsNo,
      {
        cortCd,
        csYear,
        csDvsCd: csDvsNm,
        csSerial,
      }
    );

    if (!generalResult.success || !generalResult.data) {
      console.error('[PREVIEW RELATED] 일반내용 조회 실패:', generalResult.error);
      return NextResponse.json(
        { success: false, error: generalResult.error || '일반내용 조회 실패' },
        { status: 500 }
      );
    }

    console.log(`[PREVIEW RELATED] 진행내용 조회 중...`);

    // Fetch progress history
    const progressResult = await apiClient.getCaseProgress({
      cortCd,
      csYear,
      csDvsCd: csDvsNm,
      csSerial,
      encCsNo,
    });

    // Transform general info for preview
    const generalData = generalResult.data;
    const generalInfo = {
      csNm: generalData.csNm || '',
      cortNm: generalData.cortNm || effectiveCourtName,
      prcdStsNm: generalData.prcdStsNm || '',
      rcptDt: generalData.rcptDt || '',
      jdgNm: generalData.jdgNm || '',
      parties: [] as Array<{ label: string; name: string }>,
    };

    // Extract party information
    const parties = generalData.parties || [];
    const plaintiffLabel = generalData.titRprsPtnr || '원고';
    const defendantLabel = generalData.titRprsRqstr || '피고';

    // Group parties by type (using SCOURT property names)
    const plaintiffs = parties.filter((p: { btprNm: string; btprDvsNm: string }) =>
      ['원고', '신청인', '채권자', '항소인', '상고인'].some(label => p.btprDvsNm?.includes(label))
    );
    const defendants = parties.filter((p: { btprNm: string; btprDvsNm: string }) =>
      ['피고', '피신청인', '채무자', '피항소인', '피상고인'].some(label => p.btprDvsNm?.includes(label))
    );

    // Add to generalInfo.parties
    if (plaintiffs.length > 0) {
      plaintiffs.forEach((p: { btprNm: string; btprDvsNm: string }) => {
        if (p.btprNm) {
          generalInfo.parties.push({
            label: plaintiffLabel,
            name: p.btprNm
          });
        }
      });
    } else if (generalData.aplNm) {
      generalInfo.parties.push({
        label: plaintiffLabel,
        name: generalData.aplNm
      });
    }

    if (defendants.length > 0) {
      defendants.forEach((p: { btprNm: string; btprDvsNm: string }) => {
        if (p.btprNm) {
          generalInfo.parties.push({
            label: defendantLabel,
            name: p.btprNm
          });
        }
      });
    } else if (generalData.rspNm) {
      generalInfo.parties.push({
        label: defendantLabel,
        name: generalData.rspNm
      });
    }

    // Transform progress for preview
    const progress = (progressResult.success && progressResult.progress)
      ? progressResult.progress.map((p) => ({
          date: p.prcdDt || '',
          event: p.prcdNm || '',
          result: p.prcdRslt || undefined,
        }))
      : [];

    console.log(`[PREVIEW RELATED] 미리보기 완료: 진행내용 ${progress.length}건`);

    const response: PreviewResponse = {
      success: true,
      generalInfo,
      progress,
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('[PREVIEW RELATED] 미리보기 에러:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '미리보기 실패'
      },
      { status: 500 }
    );
  }
}
