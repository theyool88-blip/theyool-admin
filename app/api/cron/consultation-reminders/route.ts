/**
 * 상담 리마인더 Cron Job
 * Vercel Cron 또는 외부 스케줄러에서 호출
 *
 * 매일 설정된 시각에 실행하여 다음날 상담이 있는 고객에게 알림 발송
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendByCategory } from '@/lib/notifications/sender';

// Cron Job 인증 키
const CRON_SECRET = process.env.CRON_SECRET;

/**
 * GET /api/cron/consultation-reminders
 * 상담 리마인더 발송
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
      .eq('category', 'consultation_reminder')
      .eq('is_active', true)
      .single();

    if (!schedule) {
      return NextResponse.json({
        success: true,
        message: '상담 리마인더가 비활성화되어 있습니다.',
        sent: 0,
      });
    }

    // 대상 상담 조회 (days_before 일 후의 확정된 상담)
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + schedule.days_before);
    const targetDateStr = targetDate.toISOString().split('T')[0];

    const { data: consultations, error } = await supabase
      .from('consultations')
      .select('*')
      .eq('status', 'confirmed')  // 확정된 상담만
      .eq('confirmed_date', targetDateStr);

    if (error) {
      console.error('상담 조회 오류:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!consultations || consultations.length === 0) {
      return NextResponse.json({
        success: true,
        message: `${targetDateStr}에 예정된 상담이 없습니다.`,
        sent: 0,
      });
    }

    // 알림 발송
    let sentCount = 0;
    let failedCount = 0;

    for (const consultation of consultations) {
      if (!consultation.phone) {
        console.log(`상담 ${consultation.id}: 연락처 없음, 건너뜀`);
        continue;
      }

      // 상담 장소 결정
      let location = '법무법인 더율';
      if (consultation.office_location) {
        location = `법무법인 더율 ${consultation.office_location}사무소`;
      }

      const result = await sendByCategory('consultation_reminder', consultation.phone, consultation.name, {
        이름: consultation.name,
        상담일시: `${consultation.confirmed_date} ${consultation.confirmed_time || ''}`,
        상담장소: location,
      }, {
        recipientType: 'consultation',
        recipientId: consultation.id,
        relatedType: 'consultation',
        relatedId: consultation.id,
        office: consultation.office_location,  // 사무소별 발신번호
      });

      if (result.success) {
        sentCount++;
      } else {
        failedCount++;
        console.error(`상담 ${consultation.id} 알림 발송 실패:`, result.error);
      }
    }

    return NextResponse.json({
      success: true,
      message: `상담 리마인더: ${sentCount}건 발송, ${failedCount}건 실패`,
      sent: sentCount,
      failed: failedCount,
      targetDate: targetDateStr,
    });
  } catch (error) {
    console.error('GET /api/cron/consultation-reminders error:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
