/**
 * court_hearings → Google Calendar 동기화 API
 *
 * POST /api/admin/court-hearings/sync-to-calendar
 * - 미래 기일 중 아직 Google Calendar에 등록되지 않은 것들을 등록
 */

import { NextResponse } from 'next/server';
import { withRole } from '@/lib/api/with-tenant';
import { createAdminClient } from '@/lib/supabase/admin';
import { syncHearingToGoogleCalendar } from '@/lib/scourt/hearing-sync';
import type { HearingType } from '@/types/court-hearing';

export const POST = withRole('admin')(async (request, { tenant }) => {
  try {
    if (!tenant.tenantId) {
      return NextResponse.json({ error: 'No tenant context' }, { status: 400 });
    }

    const tenantId = tenant.tenantId;
    const supabase = createAdminClient();

    // 요청 파라미터
    const body = await request.json().catch(() => ({}));
    const { caseId, hearingId } = body;

    // 동기화 대상 조회
    let query = supabase
      .from('court_hearings')
      .select('id, case_id, case_number, hearing_type, hearing_date, location, google_event_id')
      .is('google_event_id', null)
      .gte('hearing_date', new Date().toISOString())
      .eq('status', 'SCHEDULED');

    if (hearingId) {
      // 특정 기일만
      query = query.eq('id', hearingId);
    } else if (caseId) {
      // 특정 사건의 기일들
      query = query.eq('case_id', caseId);
    }

    const { data: hearings, error: fetchError } = await query.order('hearing_date');

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!hearings || hearings.length === 0) {
      return NextResponse.json({
        success: true,
        message: '동기화할 기일이 없습니다',
        synced: 0,
      });
    }

    // Google Calendar 동기화
    const results = [];
    for (const hearing of hearings) {
      const result = await syncHearingToGoogleCalendar(
        tenantId,
        hearing.id,
        hearing.case_number,
        hearing.hearing_type as HearingType,
        hearing.hearing_date,
        hearing.location
      );

      results.push({
        hearingId: hearing.id,
        success: !!result,
        eventId: result?.eventId,
      });
    }

    const successCount = results.filter((r) => r.success).length;

    return NextResponse.json({
      success: true,
      total: hearings.length,
      synced: successCount,
      failed: hearings.length - successCount,
      results,
    });

  } catch (error) {
    console.error('[sync-to-calendar] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Sync failed' },
      { status: 500 }
    );
  }
});
