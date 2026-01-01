/**
 * Communication Generate API
 *
 * POST /api/admin/communication/generate - 특정 유형 메시지 생성
 *
 * 지원 유형:
 * - hearing_reminder: 기일 안내 (hearingId 필요)
 * - deadline_reminder: 기한 안내 (deadlineId 필요)
 * - payment_reminder: 결제 안내
 * - progress_report: 진행상황 보고
 */

import { NextRequest, NextResponse } from 'next/server';
import { withTenant } from '@/lib/api/with-tenant';
import { getClientUpdateGenerator } from '@/lib/communication/client-update-generator';
import type { UpdateType, MessageChannel } from '@/lib/communication/types';

interface GenerateRequest {
  caseId: string;
  type: UpdateType;
  channel?: MessageChannel;
  // 유형별 추가 파라미터
  hearingId?: string;
  deadlineId?: string;
}

export const POST = withTenant(async (request: NextRequest) => {
  try {
    const body: GenerateRequest = await request.json();
    const { caseId, type, channel = 'kakao', hearingId, deadlineId } = body;

    if (!caseId) {
      return NextResponse.json(
        { success: false, error: 'caseId가 필요합니다' },
        { status: 400 }
      );
    }

    if (!type) {
      return NextResponse.json(
        { success: false, error: 'type이 필요합니다' },
        { status: 400 }
      );
    }

    const generator = getClientUpdateGenerator();
    let message;

    switch (type) {
      case 'hearing_reminder':
        if (!hearingId) {
          return NextResponse.json(
            { success: false, error: '기일 안내는 hearingId가 필요합니다' },
            { status: 400 }
          );
        }
        message = await generator.generateHearingReminder(caseId, hearingId, channel);
        break;

      case 'deadline_reminder':
        if (!deadlineId) {
          return NextResponse.json(
            { success: false, error: '기한 안내는 deadlineId가 필요합니다' },
            { status: 400 }
          );
        }
        message = await generator.generateDeadlineReminder(caseId, deadlineId, channel);
        break;

      case 'payment_reminder':
        message = await generator.generatePaymentReminder(caseId, channel);
        break;

      case 'progress_report':
        message = await generator.generateProgressReport(caseId, channel);
        break;

      default:
        // 일반 생성
        message = await generator.generate({ caseId, type, channel });
    }

    return NextResponse.json({
      success: true,
      data: message,
    });
  } catch (error) {
    console.error('[Communication Generate API] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
});
