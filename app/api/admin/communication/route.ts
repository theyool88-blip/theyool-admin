/**
 * Communication API
 *
 * POST /api/admin/communication/generate - 메시지 생성
 */

import { NextRequest, NextResponse } from 'next/server';
import { withTenant } from '@/lib/api/with-tenant';
import { getClientUpdateGenerator } from '@/lib/communication/client-update-generator';
import { getAvailableTypes, getSupportedChannels } from '@/lib/communication/templates';
import type { UpdateType, MessageChannel } from '@/lib/communication/types';

/**
 * GET /api/admin/communication
 * 사용 가능한 메시지 유형 및 채널 목록
 */
export const GET = withTenant(async () => {
  try {
    const types = getAvailableTypes();
    const typeChannels: Record<string, string[]> = {};

    for (const type of types) {
      typeChannels[type] = getSupportedChannels(type);
    }

    return NextResponse.json({
      success: true,
      data: {
        types,
        typeChannels,
      },
    });
  } catch (error) {
    console.error('[Communication API] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
});

/**
 * POST /api/admin/communication
 * 메시지 생성
 */
export const POST = withTenant(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const { caseId, type, channel, customContext } = body as {
      caseId: string;
      type: UpdateType;
      channel?: MessageChannel;
      customContext?: Record<string, string>;
    };

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
    const message = await generator.generate({
      caseId,
      type,
      channel,
      customContext,
    });

    return NextResponse.json({
      success: true,
      data: message,
    });
  } catch (error) {
    console.error('[Communication API] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
});
