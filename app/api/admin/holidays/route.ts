/**
 * 공휴일 관리 API (관리자 전용)
 * @route GET/POST /api/admin/holidays
 */

import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth/auth';

/**
 * GET /api/admin/holidays
 * 공휴일 목록 조회 (연도별 필터링 가능)
 */
export async function GET(request: NextRequest) {
  try {
    const authCheck = await isAuthenticated();
    if (!authCheck) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year');

    // NOTE: korean_public_holidays 테이블이 스키마에서 제거됨
    // 공휴일 기능이 필요하면 consultation_date_exceptions 테이블 사용 또는 외부 API 연동 필요
    // 현재는 빈 배열 반환
    console.log(`공휴일 조회 요청: year=${year || 'all'} (테이블 없음, 빈 응답 반환)`);

    return NextResponse.json({
      success: true,
      data: [],
      count: 0,
      message: 'korean_public_holidays 테이블이 스키마에서 제거되었습니다. consultation_date_exceptions 사용을 권장합니다.'
    });
  } catch (error) {
    console.error('GET /api/admin/holidays error:', error);
    const message = error instanceof Error ? error.message : '공휴일 조회 실패'
    return NextResponse.json(
      {
        success: false,
        error: message
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/holidays
 * 공휴일 추가
 */
type HolidayPayload = {
  holiday_date: string
  holiday_name: string
}

export async function POST(request: NextRequest) {
  try {
    const authCheck = await isAuthenticated();
    if (!authCheck) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const body = (await request.json()) as Partial<HolidayPayload>;
    const { holiday_date, holiday_name } = body;

    if (!holiday_date || !holiday_name) {
      return NextResponse.json(
        { error: '날짜와 공휴일명을 입력하세요.' },
        { status: 400 }
      );
    }

    // NOTE: korean_public_holidays 테이블이 스키마에서 제거됨
    // 공휴일 추가 기능 비활성화
    console.log(`공휴일 추가 시도: ${holiday_date} - ${holiday_name} (테이블 없음, 거부됨)`);

    return NextResponse.json({
      success: false,
      error: 'korean_public_holidays 테이블이 스키마에서 제거되었습니다. consultation_date_exceptions 테이블을 사용하세요.',
    }, { status: 501 });
  } catch (error) {
    console.error('POST /api/admin/holidays error:', error);
    const message = error instanceof Error ? error.message : '공휴일 추가 실패'
    return NextResponse.json(
      {
        success: false,
        error: message
      },
      { status: 500 }
    );
  }
}
