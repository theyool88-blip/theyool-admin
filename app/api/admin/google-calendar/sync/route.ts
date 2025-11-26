import { NextRequest, NextResponse } from 'next/server';
import { syncCalendarEvents, registerCalendarWatch, stopCalendarWatch, retryPendingEvents, getPendingEvents } from '@/lib/google-calendar-sync';

// POST: 수동 동기화 실행
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    // action=retry: 매칭 안 된 항목만 재시도
    if (action === 'retry') {
      const result = await retryPendingEvents();
      return NextResponse.json(result);
    }

    // 기본: 전체 동기화
    const result = await syncCalendarEvents();
    return NextResponse.json(result);
  } catch (error) {
    console.error('Calendar sync error:', error);
    return NextResponse.json(
      { error: 'Sync failed', details: String(error) },
      { status: 500 }
    );
  }
}

// GET: 매칭 안 된 이벤트 목록 조회
export async function GET() {
  try {
    const pendingEvents = await getPendingEvents();
    return NextResponse.json({ pendingEvents });
  } catch (error) {
    console.error('Get pending events error:', error);
    return NextResponse.json(
      { error: 'Failed to get pending events', details: String(error) },
      { status: 500 }
    );
  }
}

// PUT: Push Watch 등록
export async function PUT(request: NextRequest) {
  try {
    const result = await registerCalendarWatch();
    return NextResponse.json({ status: 'registered', ...result });
  } catch (error) {
    console.error('Watch registration error:', error);
    return NextResponse.json(
      { error: 'Watch registration failed', details: String(error) },
      { status: 500 }
    );
  }
}

// DELETE: Push Watch 해제
export async function DELETE(request: NextRequest) {
  try {
    const result = await stopCalendarWatch();
    return NextResponse.json(result);
  } catch (error) {
    console.error('Watch stop error:', error);
    return NextResponse.json(
      { error: 'Watch stop failed', details: String(error) },
      { status: 500 }
    );
  }
}
