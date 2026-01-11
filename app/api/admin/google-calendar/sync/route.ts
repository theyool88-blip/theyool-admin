/**
 * [DEPRECATED] Google Calendar 동기화 API
 *
 * 기존: Google Calendar → court_hearings (읽기)
 * 신규: court_hearings → Google Calendar (쓰기)
 *
 * 쓰기 기능은 /api/admin/court-hearings/sync-to-calendar 사용
 */

import { NextResponse } from 'next/server';

const DEPRECATION_MESSAGE = {
  deprecated: true,
  message: 'Google Calendar 읽기 기능이 비활성화되었습니다.',
  info: 'SCOURT → court_hearings → Google Calendar (쓰기 전용) 구조로 변경됨',
  alternative: '/api/admin/court-hearings/sync-to-calendar',
};

// POST: 수동 동기화 실행 (비활성화)
export async function POST() {
  return NextResponse.json(DEPRECATION_MESSAGE, { status: 410 });  // 410 Gone
}

// GET: 매칭 안 된 이벤트 목록 조회 (비활성화)
export async function GET() {
  return NextResponse.json(DEPRECATION_MESSAGE, { status: 410 });
}

// PUT: Push Watch 등록 (비활성화)
export async function PUT() {
  return NextResponse.json(DEPRECATION_MESSAGE, { status: 410 });
}

// DELETE: Push Watch 해제 (비활성화)
export async function DELETE() {
  return NextResponse.json(DEPRECATION_MESSAGE, { status: 410 });
}
