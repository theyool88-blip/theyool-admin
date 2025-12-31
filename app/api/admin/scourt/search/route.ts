/**
 * 대법원 사건 검색 API
 *
 * POST /api/admin/scourt/search
 *
 * 요청:
 * - courtCode: 법원 코드 (선택)
 * - caseYear: 사건 연도 (필수)
 * - caseType: 사건 구분 코드 (필수, 예: 드단, 드합)
 * - caseSerial: 사건 일련번호 (필수)
 * - partyName: 당사자명 (선택, 없으면 캡챠 필요)
 * - lawyerId: 변호사 ID (선택)
 *
 * 응답:
 * - success: 성공 여부
 * - caseInfo: 사건 정보
 * - captchaAttempts: 캡챠 시도 횟수
 */

import { NextRequest, NextResponse } from 'next/server';
import { getScourtSessionManager, SearchParams } from '@/lib/scourt/session-manager';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { courtCode, caseYear, caseType, caseSerial, partyName, lawyerId } = body;

    // 필수 파라미터 검증
    if (!caseYear || !caseType || !caseSerial) {
      return NextResponse.json(
        { error: '필수 파라미터가 누락되었습니다 (caseYear, caseType, caseSerial)' },
        { status: 400 }
      );
    }

    const sessionManager = getScourtSessionManager();

    // 프로필 조회/생성
    const profile = await sessionManager.getOrCreateProfile(lawyerId);

    // 검색 파라미터
    const searchParams: SearchParams = {
      courtCode,
      caseYear,
      caseType,
      caseSerial,
      partyName,
    };

    // 사건 검색 실행
    console.log(`📍 사건 검색 시작: ${caseYear}${caseType}${caseSerial}`);
    const result = await sessionManager.searchCase(profile, searchParams);

    if (result.success) {
      return NextResponse.json({
        success: true,
        caseInfo: result.caseInfo,
        captchaAttempts: result.captchaAttempts,
        profileId: profile.id,
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          captchaAttempts: result.captchaAttempts,
        },
        { status: 422 }
      );
    }
  } catch (error) {
    console.error('사건 검색 API 에러:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '알 수 없는 에러' },
      { status: 500 }
    );
  }
}
