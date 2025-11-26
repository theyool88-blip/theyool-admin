/**
 * 재판기일 리마인더 Cron Job
 * Vercel Cron 또는 외부 스케줄러에서 호출
 *
 * 매일 설정된 시각에 실행하여 다음날 재판이 있는 의뢰인에게 알림 발송
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendByCategory } from '@/lib/notifications/sender';

// Cron Job 인증 키 (환경변수에서)
const CRON_SECRET = process.env.CRON_SECRET;

/**
 * GET /api/cron/hearing-reminders
 * 재판기일 리마인더 발송
 */
export async function GET(request: NextRequest) {
  try {
    // 인증 확인 (Vercel Cron 또는 외부 스케줄러)
    const authHeader = request.headers.get('authorization');
    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();

    // 자동 발송 설정 확인
    const { data: schedule } = await supabase
      .from('notification_schedules')
      .select('*')
      .eq('category', 'hearing_reminder')
      .eq('is_active', true)
      .single();

    if (!schedule) {
      return NextResponse.json({
        success: true,
        message: '재판기일 알림이 비활성화되어 있습니다.',
        sent: 0,
      });
    }

    // 대상 재판 조회 (days_before 일 후의 재판)
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + schedule.days_before);
    const targetDateStr = targetDate.toISOString().split('T')[0];

    const { data: hearings, error } = await supabase
      .from('court_hearings')
      .select(`
        id,
        hearing_date,
        hearing_time,
        court_name,
        case_number,
        legal_cases (
          id,
          case_name,
          office_location,
          clients (
            id,
            name,
            phone
          )
        )
      `)
      .eq('hearing_date', targetDateStr);

    if (error) {
      console.error('재판 조회 오류:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!hearings || hearings.length === 0) {
      return NextResponse.json({
        success: true,
        message: `${targetDateStr}에 예정된 재판이 없습니다.`,
        sent: 0,
      });
    }

    // 알림 발송
    let sentCount = 0;
    let failedCount = 0;

    for (const hearing of hearings) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const legalCase = hearing.legal_cases as any;
      const client = legalCase?.clients;

      if (!client?.phone) {
        console.log(`재판 ${hearing.id}: 의뢰인 연락처 없음, 건너뜀`);
        continue;
      }

      const result = await sendByCategory('hearing_reminder', client.phone, client.name, {
        의뢰인명: client.name,
        재판일시: `${hearing.hearing_date} ${hearing.hearing_time || ''}`,
        법원명: hearing.court_name || '',
        사건번호: hearing.case_number || legalCase?.case_name || '',
      }, {
        recipientType: 'client',
        recipientId: client.id,
        relatedType: 'hearing',
        relatedId: hearing.id,
        office: legalCase?.office_location,  // 사무소별 발신번호
      });

      if (result.success) {
        sentCount++;
      } else {
        failedCount++;
        console.error(`재판 ${hearing.id} 알림 발송 실패:`, result.error);
      }
    }

    return NextResponse.json({
      success: true,
      message: `재판기일 알림: ${sentCount}건 발송, ${failedCount}건 실패`,
      sent: sentCount,
      failed: failedCount,
      targetDate: targetDateStr,
    });
  } catch (error) {
    console.error('GET /api/cron/hearing-reminders error:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
