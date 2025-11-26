/**
 * Marketing Statistics API
 * GET: 상담 마케팅 통계 조회
 */

import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth/auth';
import { createAdminClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month') || new Date().toISOString().slice(0, 7);

    // Parse month to get date range
    const startDate = `${month}-01`;
    const endDate = new Date(`${month}-01`);
    endDate.setMonth(endDate.getMonth() + 1);
    const endDateStr = endDate.toISOString().slice(0, 10);

    const supabase = await createAdminClient();

    // Fetch consultations for the month (UTM 필드 포함)
    const { data: consultations, error } = await supabase
      .from('consultations')
      .select('id, status, request_type, source, utm_source, utm_medium, utm_campaign, created_at')
      .gte('created_at', startDate)
      .lt('created_at', endDateStr);

    if (error) {
      console.error('Error fetching consultations:', error);
      return NextResponse.json(
        { error: '상담 데이터를 불러오는데 실패했습니다' },
        { status: 500 }
      );
    }

    const data = consultations || [];

    // Calculate statistics
    const bySource: Record<string, { count: number; converted: number }> = {};
    const byType: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    // UTM 기반 통계
    const byUtmSource: Record<string, { count: number; converted: number }> = {};
    const byUtmMedium: Record<string, { count: number; converted: number }> = {};
    const byUtmCampaign: Record<string, { count: number; converted: number }> = {};

    let total = 0;
    let contacted = 0;
    let confirmed = 0;
    let completed = 0;

    data.forEach((consultation: any) => {
      total++;
      const isConverted = consultation.status === 'completed' || consultation.status === 'contracted';

      // By source (legacy)
      const source = consultation.source || '미지정';
      if (!bySource[source]) {
        bySource[source] = { count: 0, converted: 0 };
      }
      bySource[source].count++;
      if (isConverted) {
        bySource[source].converted++;
      }

      // By UTM Source
      const utmSource = consultation.utm_source || '(direct)';
      if (!byUtmSource[utmSource]) {
        byUtmSource[utmSource] = { count: 0, converted: 0 };
      }
      byUtmSource[utmSource].count++;
      if (isConverted) byUtmSource[utmSource].converted++;

      // By UTM Medium
      if (consultation.utm_medium) {
        const utmMedium = consultation.utm_medium;
        if (!byUtmMedium[utmMedium]) {
          byUtmMedium[utmMedium] = { count: 0, converted: 0 };
        }
        byUtmMedium[utmMedium].count++;
        if (isConverted) byUtmMedium[utmMedium].converted++;
      }

      // By UTM Campaign
      if (consultation.utm_campaign) {
        const utmCampaign = consultation.utm_campaign;
        if (!byUtmCampaign[utmCampaign]) {
          byUtmCampaign[utmCampaign] = { count: 0, converted: 0 };
        }
        byUtmCampaign[utmCampaign].count++;
        if (isConverted) byUtmCampaign[utmCampaign].converted++;
      }

      // By type
      const type = consultation.request_type || 'unknown';
      byType[type] = (byType[type] || 0) + 1;

      // By status
      const status = consultation.status;
      byStatus[status] = (byStatus[status] || 0) + 1;

      // Funnel counts
      if (['contacted', 'confirmed', 'completed', 'contracted', 'in_progress'].includes(status)) {
        contacted++;
      }
      if (['confirmed', 'completed', 'contracted', 'in_progress'].includes(status)) {
        confirmed++;
      }
      if (['completed', 'contracted'].includes(status)) {
        completed++;
      }
    });

    // Convert to arrays for frontend
    const bySourceArray = Object.entries(bySource)
      .map(([source, stats]) => ({
        source,
        count: stats.count,
        converted: stats.converted
      }))
      .sort((a, b) => b.count - a.count);

    const byTypeArray = Object.entries(byType)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);

    const byStatusArray = Object.entries(byStatus)
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => {
        // Sort by status workflow order
        const order = ['pending', 'contacted', 'confirmed', 'completed', 'cancelled'];
        return order.indexOf(a.status) - order.indexOf(b.status);
      });

    const conversionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    // UTM 배열 변환
    const byUtmSourceArray = Object.entries(byUtmSource)
      .map(([source, stats]) => ({
        source,
        count: stats.count,
        converted: stats.converted,
        rate: stats.count > 0 ? Math.round((stats.converted / stats.count) * 100) : 0
      }))
      .sort((a, b) => b.count - a.count);

    const byUtmMediumArray = Object.entries(byUtmMedium)
      .map(([medium, stats]) => ({
        medium,
        count: stats.count,
        converted: stats.converted,
        rate: stats.count > 0 ? Math.round((stats.converted / stats.count) * 100) : 0
      }))
      .sort((a, b) => b.count - a.count);

    const byUtmCampaignArray = Object.entries(byUtmCampaign)
      .map(([campaign, stats]) => ({
        campaign,
        count: stats.count,
        converted: stats.converted,
        rate: stats.count > 0 ? Math.round((stats.converted / stats.count) * 100) : 0
      }))
      .sort((a, b) => b.count - a.count);

    return NextResponse.json({
      bySource: bySourceArray,
      byType: byTypeArray,
      byStatus: byStatusArray,
      // UTM 기반 마케팅 분석
      utm: {
        bySource: byUtmSourceArray,
        byMedium: byUtmMediumArray,
        byCampaign: byUtmCampaignArray
      },
      funnel: {
        total,
        contacted,
        confirmed,
        completed
      },
      conversionRate,
      trends: [] // TODO: Add daily trends if needed
    });
  } catch (error) {
    console.error('GET /api/admin/consultations/marketing error:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
