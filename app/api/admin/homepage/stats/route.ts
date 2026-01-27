/**
 * GET /api/admin/homepage/stats
 * 홈페이지 콘텐츠 통계 조회
 */

import { NextResponse } from 'next/server';
import { withHomepage, getHomepageDetailedStats } from '@/lib/api/with-homepage';

export const GET = withHomepage(async (_request, { tenant }) => {
  try {
    if (!tenant.tenantId) {
      return NextResponse.json(
        { success: false, error: '테넌트 정보가 없습니다.' },
        { status: 400 }
      );
    }

    const stats = await getHomepageDetailedStats(tenant.tenantId);

    // 총 콘텐츠 수 계산
    const totalContent =
      stats.blog.total +
      stats.faqs.total +
      stats.cases.total +
      stats.testimonials.total +
      stats.instagram.total;

    const totalPublished =
      stats.blog.published +
      stats.faqs.published +
      stats.cases.published +
      stats.testimonials.published +
      stats.instagram.published;

    return NextResponse.json({
      success: true,
      data: {
        stats,
        summary: {
          totalContent,
          totalPublished,
          totalDraft: totalContent - totalPublished,
        },
      },
    });
  } catch (error) {
    console.error('Homepage stats error:', error);
    return NextResponse.json(
      { success: false, error: '통계를 불러오는데 실패했습니다.' },
      { status: 500 }
    );
  }
});
