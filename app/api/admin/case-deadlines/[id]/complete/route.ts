/**
 * 데드라인 완료 처리 API
 * @route POST /api/admin/case-deadlines/[id]/complete
 */

import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth/auth';
import { completeDeadline } from '@/lib/supabase/case-deadlines';

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

/**
 * POST /api/admin/case-deadlines/[id]/complete
 * 데드라인 완료 처리
 */
export async function POST(request: NextRequest, context: RouteParams) {
  try {
    // 인증 확인
    const authCheck = await isAuthenticated();
    if (!authCheck) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const params = await context.params;
    const body = await request.json().catch(() => ({}));
    const completionNotes = body.completion_notes || null;

    const deadline = await completeDeadline(params.id, completionNotes);

    return NextResponse.json({
      success: true,
      data: deadline,
      message: '데드라인이 완료 처리되었습니다.',
    });
  } catch (error) {
    console.error('Error in POST /api/admin/case-deadlines/[id]/complete:', error);
    return NextResponse.json(
      {
        error: '데드라인 완료 처리 중 오류가 발생했습니다.',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
