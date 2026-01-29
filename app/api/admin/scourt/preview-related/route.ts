/**
 * Preview Related Case API
 *
 * POST /api/admin/scourt/preview-related
 * - Fetches preview data for unlinked related cases from SCOURT
 * - Uses encCsNo (encrypted case number) from snapshot
 * - Returns rawData for ScourtGeneralInfoXml and progress in same format as CaseDetail
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

interface ProgressItem {
  date: string;
  content: string;
  result?: string | null;
  progCttDvs?: string;  // 진행구분 코드: 0=법원, 1=기일, 2=명령, 3=제출, 4=송달
}

interface PreviewResponse {
  success: boolean;
  rawData?: Record<string, unknown>;  // For ScourtGeneralInfoXml
  caseType?: string;                   // SCOURT case type (ssgo101, ssgo102, etc.)
  progress?: ProgressItem[];           // Same format as CaseDetail
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

    // Get raw data for ScourtGeneralInfoXml
    const generalData = generalResult.data;
    const rawData = generalData.raw || {};

    // Determine case type from caseCategory
    const caseCategory = generalData.caseCategory;
    const caseTypeMap: Record<string, string> = {
      family: 'ssgo102',
      civil: 'ssgo101',
      criminal: 'ssgo10g',
      application: 'ssgo105',
      execution: 'ssgo10a',
      electronicOrder: 'ssgo10c',
      insolvency: 'ssgo107',
      appeal: 'ssgo108',
      protection: 'ssgo10i',
      contempt: 'ssgo106',
    };
    const caseType = caseTypeMap[caseCategory || 'civil'] || 'ssgo101';

    // Transform progress to match CaseDetail format
    const progress: ProgressItem[] = (progressResult.success && progressResult.progress)
      ? progressResult.progress.map((p) => ({
          date: p.prcdDt || '',
          content: p.prcdNm || '',
          result: p.prcdRslt || null,
          progCttDvs: p.progCttDvs,
        }))
      : [];

    console.log(`[PREVIEW RELATED] 미리보기 완료: 진행내용 ${progress.length}건`);

    const response: PreviewResponse = {
      success: true,
      rawData,
      caseType,
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
