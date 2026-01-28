/**
 * 고급 분석 API
 * GET /api/admin/tenant/analytics - 전환율 및 상세 분석
 */

import { NextResponse } from 'next/server';
import { withRole } from '@/lib/api/with-tenant';
import { createClient } from '@supabase/supabase-js';

const getServiceClient = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false },
    }
  );
};

interface FunnelStep {
  name: string;
  count: number;
  rate: number; // 이전 단계 대비 전환율
  dropoff: number; // 이탈률
}

interface SourceAnalysis {
  source: string;
  visitors: number;
  consultations: number;
  bookings: number;
  conversionRate: number;
  avgLeadScore: number;
}

interface PagePerformance {
  pagePath: string;
  pageType: string;
  views: number;
  avgTimeOnPage: number;
  avgScrollDepth: number;
  exitRate: number;
  conversions: number;
}

interface TimeAnalysis {
  hour: number;
  dayOfWeek: number;
  visitors: number;
  consultations: number;
  conversionRate: number;
}

// GET - 고급 분석 데이터
export const GET = withRole('admin')(async (request, { tenant }) => {
  const supabase = getServiceClient();
  const url = new URL(request.url);
  const period = url.searchParams.get('period') || '30d';
  const analysisType = url.searchParams.get('type') || 'overview';

  const days = period === '7d' ? 7 : period === '90d' ? 90 : 30;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const startDateStr = startDate.toISOString();

  try {
    switch (analysisType) {
      case 'funnel':
        return NextResponse.json({
          success: true,
          data: await getFunnelAnalysis(supabase, tenant.tenantId, startDateStr),
        });

      case 'sources':
        return NextResponse.json({
          success: true,
          data: await getSourceAnalysis(supabase, tenant.tenantId, startDateStr),
        });

      case 'pages':
        return NextResponse.json({
          success: true,
          data: await getPagePerformance(supabase, tenant.tenantId, startDateStr),
        });

      case 'time':
        return NextResponse.json({
          success: true,
          data: await getTimeAnalysis(supabase, tenant.tenantId, startDateStr),
        });

      case 'overview':
      default:
        return NextResponse.json({
          success: true,
          data: await getOverviewAnalysis(supabase, tenant.tenantId, startDateStr, days),
        });
    }
  } catch (error) {
    console.error('Analytics error:', error);
    return NextResponse.json(
      { success: false, error: '분석 데이터를 가져오는 데 실패했습니다.' },
      { status: 500 }
    );
  }
});

// 퍼널 분석
async function getFunnelAnalysis(
  supabase: ReturnType<typeof getServiceClient>,
  tenantId: string,
  startDate: string
): Promise<{ funnel: FunnelStep[]; insights: string[] }> {
  // 1. 방문자 수
  const { count: visitorCount } = await supabase
    .from('visitor_sessions')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .gte('started_at', startDate);

  // 2. 페이지뷰 (2페이지 이상 본 방문자)
  const { data: engagedVisitors } = await supabase
    .from('page_views')
    .select('session_id')
    .eq('tenant_id', tenantId)
    .gte('viewed_at', startDate);

  const uniqueEngagedSessions = new Set(engagedVisitors?.map(p => p.session_id) || []);
  const engagedCount = uniqueEngagedSessions.size;

  // 3. 상담 신청
  const { count: consultationCount } = await supabase
    .from('consultations')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .gte('created_at', startDate);

  // 4. 예약 완료
  const { count: bookingCount } = await supabase
    .from('bookings')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .gte('created_at', startDate);

  const visitors = visitorCount || 0;
  const engaged = engagedCount || 0;
  const consultations = consultationCount || 0;
  const bookings = bookingCount || 0;
  const totalConversions = consultations + bookings;

  const funnel: FunnelStep[] = [
    {
      name: '방문',
      count: visitors,
      rate: 100,
      dropoff: 0,
    },
    {
      name: '참여 (2+ 페이지)',
      count: engaged,
      rate: visitors > 0 ? (engaged / visitors) * 100 : 0,
      dropoff: visitors > 0 ? ((visitors - engaged) / visitors) * 100 : 0,
    },
    {
      name: '상담 신청',
      count: consultations,
      rate: engaged > 0 ? (consultations / engaged) * 100 : 0,
      dropoff: engaged > 0 ? ((engaged - consultations) / engaged) * 100 : 0,
    },
    {
      name: '예약 완료',
      count: bookings,
      rate: consultations > 0 ? (bookings / consultations) * 100 : 0,
      dropoff: consultations > 0 ? ((consultations - bookings) / consultations) * 100 : 0,
    },
  ];

  // 인사이트 생성
  const insights: string[] = [];

  if (visitors > 0 && engaged / visitors < 0.3) {
    insights.push('방문자의 30% 미만만 2페이지 이상 탐색합니다. 랜딩페이지 개선을 고려하세요.');
  }

  if (engaged > 0 && consultations / engaged < 0.05) {
    insights.push('참여 방문자 대비 상담 전환율이 5% 미만입니다. CTA 버튼 배치를 검토하세요.');
  }

  if (consultations > 0 && bookings / consultations > 0.7) {
    insights.push('상담 신청자의 70% 이상이 예약으로 전환됩니다. 우수한 전환율입니다!');
  }

  const overallRate = visitors > 0 ? (totalConversions / visitors) * 100 : 0;
  if (overallRate > 3) {
    insights.push(`전체 전환율 ${overallRate.toFixed(1)}%는 업계 평균(1-3%)보다 높습니다.`);
  }

  return { funnel, insights };
}

// UTM 소스별 분석
async function getSourceAnalysis(
  supabase: ReturnType<typeof getServiceClient>,
  tenantId: string,
  startDate: string
): Promise<SourceAnalysis[]> {
  // 방문자 세션에서 UTM 소스별 집계
  const { data: sessions } = await supabase
    .from('visitor_sessions')
    .select('id, utm_source, utm_medium, utm_campaign')
    .eq('tenant_id', tenantId)
    .gte('started_at', startDate);

  // 상담에서 UTM 소스별 집계
  const { data: consultations } = await supabase
    .from('consultations')
    .select('id, utm_source')
    .eq('tenant_id', tenantId)
    .gte('created_at', startDate);

  // 예약에서 UTM 소스별 집계
  const { data: bookings } = await supabase
    .from('bookings')
    .select('id, utm_source')
    .eq('tenant_id', tenantId)
    .gte('created_at', startDate);

  // 소스별 집계
  const sourceMap = new Map<string, {
    visitors: number;
    consultations: number;
    bookings: number;
  }>();

  (sessions || []).forEach((s) => {
    const source = s.utm_source || '직접 유입';
    const current = sourceMap.get(source) || { visitors: 0, consultations: 0, bookings: 0 };
    current.visitors++;
    sourceMap.set(source, current);
  });

  (consultations || []).forEach((c) => {
    const source = c.utm_source || '직접 유입';
    const current = sourceMap.get(source) || { visitors: 0, consultations: 0, bookings: 0 };
    current.consultations++;
    sourceMap.set(source, current);
  });

  (bookings || []).forEach((b) => {
    const source = b.utm_source || '직접 유입';
    const current = sourceMap.get(source) || { visitors: 0, consultations: 0, bookings: 0 };
    current.bookings++;
    sourceMap.set(source, current);
  });

  const result: SourceAnalysis[] = Array.from(sourceMap.entries())
    .map(([source, data]) => ({
      source,
      visitors: data.visitors,
      consultations: data.consultations,
      bookings: data.bookings,
      conversionRate: data.visitors > 0
        ? ((data.consultations + data.bookings) / data.visitors) * 100
        : 0,
      avgLeadScore: 0, // 리드 스코어 평균은 별도 계산 필요
    }))
    .sort((a, b) => b.visitors - a.visitors);

  return result;
}

// 페이지 성과 분석
async function getPagePerformance(
  supabase: ReturnType<typeof getServiceClient>,
  tenantId: string,
  startDate: string
): Promise<PagePerformance[]> {
  const { data: pageViews } = await supabase
    .from('page_views')
    .select('page_path, page_type, time_on_page, scroll_depth')
    .eq('tenant_id', tenantId)
    .gte('viewed_at', startDate);

  // 페이지별 집계
  const pageMap = new Map<string, {
    pageType: string;
    views: number;
    totalTime: number;
    totalScroll: number;
    timeCount: number;
    scrollCount: number;
  }>();

  (pageViews || []).forEach((pv) => {
    const path = pv.page_path || '/';
    const current = pageMap.get(path) || {
      pageType: pv.page_type || 'unknown',
      views: 0,
      totalTime: 0,
      totalScroll: 0,
      timeCount: 0,
      scrollCount: 0,
    };

    current.views++;
    if (pv.time_on_page) {
      current.totalTime += pv.time_on_page;
      current.timeCount++;
    }
    if (pv.scroll_depth) {
      current.totalScroll += pv.scroll_depth;
      current.scrollCount++;
    }

    pageMap.set(path, current);
  });

  const result: PagePerformance[] = Array.from(pageMap.entries())
    .map(([path, data]) => ({
      pagePath: path,
      pageType: data.pageType,
      views: data.views,
      avgTimeOnPage: data.timeCount > 0 ? Math.round(data.totalTime / data.timeCount) : 0,
      avgScrollDepth: data.scrollCount > 0 ? Math.round(data.totalScroll / data.scrollCount) : 0,
      exitRate: 0, // 이탈률은 세션 데이터와 연계 필요
      conversions: 0, // 전환은 별도 추적 필요
    }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 20); // 상위 20개

  return result;
}

// 시간대별 분석
async function getTimeAnalysis(
  supabase: ReturnType<typeof getServiceClient>,
  tenantId: string,
  startDate: string
): Promise<{ hourly: TimeAnalysis[]; daily: TimeAnalysis[]; bestTimes: string[] }> {
  const { data: sessions } = await supabase
    .from('visitor_sessions')
    .select('started_at')
    .eq('tenant_id', tenantId)
    .gte('started_at', startDate);

  const { data: consultations } = await supabase
    .from('consultations')
    .select('created_at')
    .eq('tenant_id', tenantId)
    .gte('created_at', startDate);

  // 시간대별 집계
  const hourlyMap = new Map<number, { visitors: number; consultations: number }>();
  const dailyMap = new Map<number, { visitors: number; consultations: number }>();

  for (let i = 0; i < 24; i++) {
    hourlyMap.set(i, { visitors: 0, consultations: 0 });
  }
  for (let i = 0; i < 7; i++) {
    dailyMap.set(i, { visitors: 0, consultations: 0 });
  }

  (sessions || []).forEach((s) => {
    const date = new Date(s.started_at);
    const hour = date.getHours();
    const day = date.getDay();

    const hourData = hourlyMap.get(hour)!;
    hourData.visitors++;

    const dayData = dailyMap.get(day)!;
    dayData.visitors++;
  });

  (consultations || []).forEach((c) => {
    const date = new Date(c.created_at);
    const hour = date.getHours();
    const day = date.getDay();

    const hourData = hourlyMap.get(hour)!;
    hourData.consultations++;

    const dayData = dailyMap.get(day)!;
    dayData.consultations++;
  });

  const hourly: TimeAnalysis[] = Array.from(hourlyMap.entries()).map(([hour, data]) => ({
    hour,
    dayOfWeek: -1,
    visitors: data.visitors,
    consultations: data.consultations,
    conversionRate: data.visitors > 0 ? (data.consultations / data.visitors) * 100 : 0,
  }));

  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  const daily: TimeAnalysis[] = Array.from(dailyMap.entries()).map(([day, data]) => ({
    hour: -1,
    dayOfWeek: day,
    visitors: data.visitors,
    consultations: data.consultations,
    conversionRate: data.visitors > 0 ? (data.consultations / data.visitors) * 100 : 0,
  }));

  // 최적 시간대 분석
  const bestTimes: string[] = [];

  const peakHour = hourly.reduce((max, h) => h.visitors > max.visitors ? h : max, hourly[0]);
  if (peakHour.visitors > 0) {
    bestTimes.push(`가장 많은 방문: ${peakHour.hour}시 (${peakHour.visitors}명)`);
  }

  const bestConversionHour = hourly
    .filter(h => h.visitors >= 5)
    .reduce((max, h) => h.conversionRate > max.conversionRate ? h : max, { hour: -1, conversionRate: 0, visitors: 0, consultations: 0, dayOfWeek: -1 });
  if (bestConversionHour.hour >= 0) {
    bestTimes.push(`최고 전환율: ${bestConversionHour.hour}시 (${bestConversionHour.conversionRate.toFixed(1)}%)`);
  }

  const peakDay = daily.reduce((max, d) => d.visitors > max.visitors ? d : max, daily[0]);
  if (peakDay.visitors > 0) {
    bestTimes.push(`가장 활발한 요일: ${dayNames[peakDay.dayOfWeek]}요일`);
  }

  return { hourly, daily, bestTimes };
}

// 종합 분석
async function getOverviewAnalysis(
  supabase: ReturnType<typeof getServiceClient>,
  tenantId: string,
  startDate: string,
  days: number
) {
  // 현재 기간
  const { count: currentVisitors } = await supabase
    .from('visitor_sessions')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .gte('started_at', startDate);

  const { count: currentConsultations } = await supabase
    .from('consultations')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .gte('created_at', startDate);

  const { count: currentBookings } = await supabase
    .from('bookings')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .gte('created_at', startDate);

  // 이전 기간 (비교용)
  const prevStartDate = new Date();
  prevStartDate.setDate(prevStartDate.getDate() - days * 2);
  const prevEndDate = new Date();
  prevEndDate.setDate(prevEndDate.getDate() - days);

  const { count: prevVisitors } = await supabase
    .from('visitor_sessions')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .gte('started_at', prevStartDate.toISOString())
    .lt('started_at', prevEndDate.toISOString());

  const { count: prevConsultations } = await supabase
    .from('consultations')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .gte('created_at', prevStartDate.toISOString())
    .lt('created_at', prevEndDate.toISOString());

  // 변화율 계산
  const visitorChange = prevVisitors && prevVisitors > 0
    ? (((currentVisitors || 0) - prevVisitors) / prevVisitors) * 100
    : 0;

  const consultationChange = prevConsultations && prevConsultations > 0
    ? (((currentConsultations || 0) - prevConsultations) / prevConsultations) * 100
    : 0;

  // 전환율
  const currentConversionRate = currentVisitors && currentVisitors > 0
    ? (((currentConsultations || 0) + (currentBookings || 0)) / currentVisitors) * 100
    : 0;

  const prevConversionRate = prevVisitors && prevVisitors > 0
    ? ((prevConsultations || 0) / prevVisitors) * 100
    : 0;

  return {
    current: {
      visitors: currentVisitors || 0,
      consultations: currentConsultations || 0,
      bookings: currentBookings || 0,
      conversionRate: currentConversionRate,
    },
    changes: {
      visitors: visitorChange,
      consultations: consultationChange,
      conversionRate: currentConversionRate - prevConversionRate,
    },
    period: {
      days,
      startDate,
    },
  };
}
