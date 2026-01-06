/**
 * SCOURT 사건 상세 페이지 열기 API
 *
 * POST /api/admin/scourt/open-case
 *
 * 요청:
 * - caseId: 사건 ID (필수)
 * - caseNumber: 사건번호 (필수, 예: "2025드단5823")
 *
 * 응답:
 * - success: 성공 여부
 * - error: 에러 메시지 (실패 시)
 *
 * Puppeteer로 SCOURT 브라우저를 열고 사건을 찾아 상세 페이지를 띄워줍니다.
 * DB에서 wmonid를 조회하여 API 세션과 브라우저 세션을 동기화합니다.
 */

import { NextRequest, NextResponse } from 'next/server';
import { openCaseInBrowser } from '@/lib/scourt/case-opener';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { caseId, caseNumber } = body;

    if (!caseId || !caseNumber) {
      return NextResponse.json(
        { error: 'caseId와 caseNumber가 필요합니다' },
        { status: 400 }
      );
    }

    console.log(`📍 SCOURT 사건 열기: ${caseNumber} (${caseId})`);

    // DB에서 wmonid, encCsNo 조회
    const supabase = createAdminClient();
    const { data: legalCase } = await supabase
      .from('legal_cases')
      .select('scourt_wmonid, enc_cs_no')
      .eq('id', caseId)
      .single();

    const wmonid = legalCase?.scourt_wmonid;
    const encCsNo = legalCase?.enc_cs_no;

    if (!encCsNo) {
      return NextResponse.json(
        { success: false, error: 'SCOURT 연동 정보가 없습니다. 먼저 사건을 검색해주세요.' },
        { status: 400 }
      );
    }

    console.log(`🔑 wmonid: ${wmonid?.substring(0, 15) || '없음'}...`);
    console.log(`🔑 encCsNo: ${encCsNo.substring(0, 30)}...`);

    const result = await openCaseInBrowser({ caseNumber, wmonid, encCsNo });

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: `${caseNumber} 사건 상세 페이지를 열었습니다`,
      });
    } else {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 422 }
      );
    }

  } catch (error) {
    console.error('사건 열기 API 에러:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '알 수 없는 에러' },
      { status: 500 }
    );
  }
}
