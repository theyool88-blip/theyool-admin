/**
 * API 사용량 통계
 * GET /api/admin/tenant/api-stats - API 사용량 통계 조회
 */

import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/lib/api/with-tenant';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const getServiceClient = () => {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });
};

interface DailyStats {
  date: string;
  consultations: number;
  bookings: number;
  visitors: number;
  pageViews: number;
}

interface ApiKeyStats {
  keyId: string;
  keyPrefix: string;
  name: string;
  usageCount: number;
  lastUsedAt: string | null;
  isActive: boolean;
}

interface AnomalyAlert {
  type: 'spike' | 'unusual_origin' | 'rate_limit' | 'error_rate';
  severity: 'low' | 'medium' | 'high';
  message: string;
  timestamp: string;
  details?: Record<string, unknown>;
}

// GET - API 사용량 통계 조회
export const GET = withRole('admin')(async (request, { tenant }) => {
  const supabase = getServiceClient();
  const url = new URL(request.url);
  const period = url.searchParams.get('period') || '7d'; // 7d, 30d, 90d

  // 기간 계산
  const days = period === '30d' ? 30 : period === '90d' ? 90 : 7;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const startDateStr = startDate.toISOString();

  try {
    // 1. API 키별 사용량
    const { data: apiKeys } = await supabase
      .from('tenant_api_keys')
      .select('id, key_prefix, name, usage_count, last_used_at, is_active')
      .eq('tenant_id', tenant.tenantId)
      .order('usage_count', { ascending: false });

    const apiKeyStats: ApiKeyStats[] = (apiKeys || []).map((key) => ({
      keyId: key.id,
      keyPrefix: key.key_prefix,
      name: key.name || '이름 없음',
      usageCount: key.usage_count || 0,
      lastUsedAt: key.last_used_at,
      isActive: key.is_active,
    }));

    // 2. 일별 상담 신청 수
    const { data: consultations } = await supabase
      .from('consultations')
      .select('id, created_at')
      .eq('tenant_id', tenant.tenantId)
      .gte('created_at', startDateStr);

    // 3. 일별 예약 수
    const { data: bookings } = await supabase
      .from('bookings')
      .select('id, created_at')
      .eq('tenant_id', tenant.tenantId)
      .gte('created_at', startDateStr);

    // 4. 방문자 세션 수
    const { data: sessions } = await supabase
      .from('visitor_sessions')
      .select('id, started_at')
      .eq('tenant_id', tenant.tenantId)
      .gte('started_at', startDateStr);

    // 5. 페이지뷰 수
    const { data: pageViews } = await supabase
      .from('page_views')
      .select('id, viewed_at')
      .eq('tenant_id', tenant.tenantId)
      .gte('viewed_at', startDateStr);

    // 일별 통계 집계
    const dailyStatsMap = new Map<string, DailyStats>();

    // 날짜 초기화
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      dailyStatsMap.set(dateStr, {
        date: dateStr,
        consultations: 0,
        bookings: 0,
        visitors: 0,
        pageViews: 0,
      });
    }

    // 상담 집계
    (consultations || []).forEach((c) => {
      const dateStr = new Date(c.created_at).toISOString().split('T')[0];
      const stats = dailyStatsMap.get(dateStr);
      if (stats) stats.consultations++;
    });

    // 예약 집계
    (bookings || []).forEach((b) => {
      const dateStr = new Date(b.created_at).toISOString().split('T')[0];
      const stats = dailyStatsMap.get(dateStr);
      if (stats) stats.bookings++;
    });

    // 방문자 집계
    (sessions || []).forEach((s) => {
      const dateStr = new Date(s.started_at).toISOString().split('T')[0];
      const stats = dailyStatsMap.get(dateStr);
      if (stats) stats.visitors++;
    });

    // 페이지뷰 집계
    (pageViews || []).forEach((p) => {
      const dateStr = new Date(p.viewed_at).toISOString().split('T')[0];
      const stats = dailyStatsMap.get(dateStr);
      if (stats) stats.pageViews++;
    });

    const dailyStats = Array.from(dailyStatsMap.values()).sort(
      (a, b) => a.date.localeCompare(b.date)
    );

    // 6. 이상 패턴 탐지
    const anomalies: AnomalyAlert[] = detectAnomalies(dailyStats, apiKeyStats);

    // 7. 요약 통계
    const totalConsultations = dailyStats.reduce((sum, d) => sum + d.consultations, 0);
    const totalBookings = dailyStats.reduce((sum, d) => sum + d.bookings, 0);
    const totalVisitors = dailyStats.reduce((sum, d) => sum + d.visitors, 0);
    const totalPageViews = dailyStats.reduce((sum, d) => sum + d.pageViews, 0);

    // 전환율 계산 (방문자 대비 상담+예약)
    const conversionRate = totalVisitors > 0
      ? ((totalConsultations + totalBookings) / totalVisitors * 100).toFixed(2)
      : '0.00';

    // 평균 일일 통계
    const avgDailyConsultations = (totalConsultations / days).toFixed(1);
    const avgDailyVisitors = (totalVisitors / days).toFixed(1);

    return NextResponse.json({
      success: true,
      data: {
        period,
        summary: {
          totalConsultations,
          totalBookings,
          totalVisitors,
          totalPageViews,
          conversionRate: `${conversionRate}%`,
          avgDailyConsultations,
          avgDailyVisitors,
        },
        dailyStats,
        apiKeyStats,
        anomalies,
      },
    });
  } catch (error) {
    console.error('Failed to fetch API stats:', error);
    return NextResponse.json(
      { success: false, error: '통계를 가져오는 데 실패했습니다.' },
      { status: 500 }
    );
  }
});

// 이상 패턴 탐지 함수
function detectAnomalies(
  dailyStats: DailyStats[],
  apiKeyStats: ApiKeyStats[]
): AnomalyAlert[] {
  const anomalies: AnomalyAlert[] = [];
  const now = new Date().toISOString();

  if (dailyStats.length < 3) return anomalies;

  // 1. 트래픽 스파이크 탐지 (평균의 3배 이상)
  const recentStats = dailyStats.slice(-7);
  const avgConsultations = recentStats.reduce((sum, d) => sum + d.consultations, 0) / recentStats.length;
  const avgVisitors = recentStats.reduce((sum, d) => sum + d.visitors, 0) / recentStats.length;

  const today = dailyStats[dailyStats.length - 1];
  if (today && avgConsultations > 0 && today.consultations > avgConsultations * 3) {
    anomalies.push({
      type: 'spike',
      severity: 'medium',
      message: `오늘 상담 신청이 평소보다 ${Math.round(today.consultations / avgConsultations)}배 많습니다.`,
      timestamp: now,
      details: {
        todayCount: today.consultations,
        averageCount: Math.round(avgConsultations),
      },
    });
  }

  if (today && avgVisitors > 0 && today.visitors > avgVisitors * 3) {
    anomalies.push({
      type: 'spike',
      severity: 'low',
      message: `오늘 방문자가 평소보다 ${Math.round(today.visitors / avgVisitors)}배 많습니다.`,
      timestamp: now,
      details: {
        todayCount: today.visitors,
        averageCount: Math.round(avgVisitors),
      },
    });
  }

  // 2. 비활성 API 키 경고
  const inactiveKeys = apiKeyStats.filter((k) => k.isActive && !k.lastUsedAt);
  if (inactiveKeys.length > 0) {
    anomalies.push({
      type: 'unusual_origin',
      severity: 'low',
      message: `${inactiveKeys.length}개의 API 키가 생성 후 한 번도 사용되지 않았습니다.`,
      timestamp: now,
      details: {
        keys: inactiveKeys.map((k) => k.keyPrefix),
      },
    });
  }

  // 3. 7일간 활동 없음 경고
  const last7Days = dailyStats.slice(-7);
  const totalActivity = last7Days.reduce(
    (sum, d) => sum + d.consultations + d.bookings + d.visitors,
    0
  );
  if (totalActivity === 0 && apiKeyStats.some((k) => k.isActive)) {
    anomalies.push({
      type: 'unusual_origin',
      severity: 'medium',
      message: '지난 7일간 홈페이지에서 유입된 활동이 없습니다.',
      timestamp: now,
    });
  }

  return anomalies;
}
