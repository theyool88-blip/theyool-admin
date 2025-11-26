/**
 * 기한 마감 리마인더 Cron Job
 * Vercel Cron 또는 외부 스케줄러에서 호출
 *
 * 매일 설정된 시각에 실행하여 임박한 기한에 대해 의뢰인에게 알림 발송
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendByCategory } from '@/lib/notifications/sender';

// Cron Job 인증 키
const CRON_SECRET = process.env.CRON_SECRET;

/**
 * GET /api/cron/deadline-reminders
 * 기한 마감 리마인더 발송
 */
export async function GET(request: NextRequest) {
  try {
    // 인증 확인
    const authHeader = request.headers.get('authorization');
    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();

    // 자동 발송 설정 확인
    const { data: schedule } = await supabase
      .from('notification_schedules')
      .select('*')
      .eq('category', 'deadline_reminder')
      .eq('is_active', true)
      .single();

    if (!schedule) {
      return NextResponse.json({
        success: true,
        message: '기한 알림이 비활성화되어 있습니다.',
        sent: 0,
      });
    }

    // 대상 기한 조회 (days_before 일 후의 기한)
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + schedule.days_before);
    const targetDateStr = targetDate.toISOString().split('T')[0];

    const { data: deadlines, error } = await supabase
      .from('case_deadlines')
      .select(`
        id,
        deadline_date,
        deadline_type,
        description,
        legal_cases (
          id,
          case_name,
          case_number,
          office_location,
          clients (
            id,
            name,
            phone
          )
        )
      `)
      .eq('deadline_date', targetDateStr)
      .eq('is_completed', false);  // 완료되지 않은 기한만

    if (error) {
      console.error('기한 조회 오류:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!deadlines || deadlines.length === 0) {
      return NextResponse.json({
        success: true,
        message: `${targetDateStr}에 마감되는 기한이 없습니다.`,
        sent: 0,
      });
    }

    // 알림 발송
    let sentCount = 0;
    let failedCount = 0;

    for (const deadline of deadlines) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const legalCase = deadline.legal_cases as any;
      const client = legalCase?.clients;

      if (!client?.phone) {
        console.log(`기한 ${deadline.id}: 의뢰인 연락처 없음, 건너뜀`);
        continue;
      }

      const result = await sendByCategory('deadline_reminder', client.phone, client.name, {
        의뢰인명: client.name,
        기한일시: deadline.deadline_date,
        기한내용: deadline.description || deadline.deadline_type || '중요 기한',
        사건명: legalCase?.case_name || legalCase?.case_number || '',
      }, {
        recipientType: 'client',
        recipientId: client.id,
        relatedType: 'deadline',
        relatedId: deadline.id,
        office: legalCase?.office_location,  // 사무소별 발신번호
      });

      if (result.success) {
        sentCount++;
      } else {
        failedCount++;
        console.error(`기한 ${deadline.id} 알림 발송 실패:`, result.error);
      }
    }

    return NextResponse.json({
      success: true,
      message: `기한 알림: ${sentCount}건 발송, ${failedCount}건 실패`,
      sent: sentCount,
      failed: failedCount,
      targetDate: targetDateStr,
    });
  } catch (error) {
    console.error('GET /api/cron/deadline-reminders error:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
