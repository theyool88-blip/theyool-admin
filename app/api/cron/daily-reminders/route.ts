/**
 * 일일 리마인더 통합 Cron Job
 * 재판기일 + 상담 알림을 한 번에 처리
 *
 * 매일 설정된 시각에 실행하여 다음날 일정이 있는 의뢰인/고객에게 알림 발송
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendByCategory } from '@/lib/notifications/sender';

const CRON_SECRET = process.env.CRON_SECRET;

/**
 * GET /api/cron/daily-reminders
 * 재판기일 + 상담 리마인더 통합 발송
 */
export async function GET(request: NextRequest) {
  try {
    // 인증 확인
    const authHeader = request.headers.get('authorization');
    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();
    const results = {
      hearing: { sent: 0, failed: 0, skipped: false },
      consultation: { sent: 0, failed: 0, skipped: false },
    };

    // ========== 1. 재판기일 알림 ==========
    const { data: hearingSchedule } = await supabase
      .from('notification_schedules')
      .select('*')
      .eq('category', 'hearing_reminder')
      .eq('is_active', true)
      .single();

    if (hearingSchedule) {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + hearingSchedule.days_before);
      const targetDateStr = targetDate.toISOString().split('T')[0];

      const { data: hearings } = await supabase
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

      if (hearings) {
        for (const hearing of hearings) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const legalCase = hearing.legal_cases as any;
          const client = legalCase?.clients;

          if (!client?.phone) continue;

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
            office: legalCase?.office_location,
          });

          if (result.success) {
            results.hearing.sent++;
          } else {
            results.hearing.failed++;
          }
        }
      }
    } else {
      results.hearing.skipped = true;
    }

    // ========== 2. 상담 알림 ==========
    const { data: consultationSchedule } = await supabase
      .from('notification_schedules')
      .select('*')
      .eq('category', 'consultation_reminder')
      .eq('is_active', true)
      .single();

    if (consultationSchedule) {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + consultationSchedule.days_before);
      const targetDateStr = targetDate.toISOString().split('T')[0];

      const { data: consultations } = await supabase
        .from('consultations')
        .select('*')
        .eq('status', 'confirmed')
        .eq('confirmed_date', targetDateStr);

      if (consultations) {
        for (const consultation of consultations) {
          if (!consultation.phone) continue;

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
            office: consultation.office_location,
          });

          if (result.success) {
            results.consultation.sent++;
          } else {
            results.consultation.failed++;
          }
        }
      }
    } else {
      results.consultation.skipped = true;
    }

    return NextResponse.json({
      success: true,
      message: `일일 알림 발송 완료`,
      hearing: results.hearing,
      consultation: results.consultation,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('GET /api/cron/daily-reminders error:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
