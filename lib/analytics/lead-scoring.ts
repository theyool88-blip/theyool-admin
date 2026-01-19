/**
 * 리드 스코어링 시스템
 * 방문자 행동을 기반으로 전환 가능성 점수 계산
 */

export interface LeadScoreFactors {
  // 방문 관련
  visitCount: number;           // 방문 횟수
  isReturning: boolean;         // 재방문 여부
  pageViewCount: number;        // 페이지뷰 수
  avgTimeOnPage: number;        // 평균 체류 시간 (초)
  avgScrollDepth: number;       // 평균 스크롤 깊이 (0-100)

  // 콘텐츠 참여
  viewedServicePages: boolean;  // 서비스 페이지 조회
  viewedCaseStudies: boolean;   // 사례 페이지 조회
  viewedBlogPosts: number;      // 블로그 포스트 조회 수
  viewedFAQ: boolean;           // FAQ 페이지 조회
  viewedContactPage: boolean;   // 연락처 페이지 조회

  // 유입 경로
  utmSource?: string;
  utmMedium?: string;
  referrer?: string;

  // 디바이스
  deviceType: 'mobile' | 'tablet' | 'desktop';
}

export interface LeadScoreResult {
  score: number;                // 0-100
  grade: 'hot' | 'warm' | 'cold';
  factors: {
    category: string;
    label: string;
    points: number;
    maxPoints: number;
  }[];
  recommendations: string[];
}

// 스코어링 규칙
const SCORING_RULES = {
  // 방문 행동 (최대 30점)
  visits: {
    maxPoints: 30,
    rules: [
      { condition: (f: LeadScoreFactors) => f.visitCount >= 5, points: 15, label: '5회 이상 방문' },
      { condition: (f: LeadScoreFactors) => f.visitCount >= 3, points: 10, label: '3회 이상 방문' },
      { condition: (f: LeadScoreFactors) => f.visitCount >= 2, points: 5, label: '재방문' },
      { condition: (f: LeadScoreFactors) => f.isReturning, points: 5, label: '재방문 고객' },
      { condition: (f: LeadScoreFactors) => f.pageViewCount >= 10, points: 10, label: '10+ 페이지 조회' },
      { condition: (f: LeadScoreFactors) => f.pageViewCount >= 5, points: 5, label: '5+ 페이지 조회' },
    ],
  },

  // 참여도 (최대 25점)
  engagement: {
    maxPoints: 25,
    rules: [
      { condition: (f: LeadScoreFactors) => f.avgTimeOnPage >= 180, points: 10, label: '높은 체류 시간 (3분+)' },
      { condition: (f: LeadScoreFactors) => f.avgTimeOnPage >= 60, points: 5, label: '적정 체류 시간 (1분+)' },
      { condition: (f: LeadScoreFactors) => f.avgScrollDepth >= 80, points: 10, label: '깊은 스크롤 (80%+)' },
      { condition: (f: LeadScoreFactors) => f.avgScrollDepth >= 50, points: 5, label: '적정 스크롤 (50%+)' },
    ],
  },

  // 콘텐츠 관심 (최대 30점)
  content: {
    maxPoints: 30,
    rules: [
      { condition: (f: LeadScoreFactors) => f.viewedContactPage, points: 15, label: '연락처 페이지 조회' },
      { condition: (f: LeadScoreFactors) => f.viewedServicePages, points: 10, label: '서비스 페이지 조회' },
      { condition: (f: LeadScoreFactors) => f.viewedCaseStudies, points: 10, label: '사례 페이지 조회' },
      { condition: (f: LeadScoreFactors) => f.viewedBlogPosts >= 3, points: 5, label: '블로그 3+ 조회' },
      { condition: (f: LeadScoreFactors) => f.viewedFAQ, points: 5, label: 'FAQ 조회' },
    ],
  },

  // 유입 품질 (최대 15점)
  source: {
    maxPoints: 15,
    rules: [
      { condition: (f: LeadScoreFactors) => f.utmSource === 'google' && f.utmMedium === 'cpc', points: 10, label: '검색 광고 유입' },
      { condition: (f: LeadScoreFactors) => f.utmSource === 'naver' && f.utmMedium === 'cpc', points: 10, label: '네이버 광고 유입' },
      { condition: (f: LeadScoreFactors) => f.utmMedium === 'organic', points: 8, label: '자연 검색 유입' },
      { condition: (f: LeadScoreFactors) => f.referrer?.includes('blog'), points: 5, label: '블로그 유입' },
      { condition: (f: LeadScoreFactors) => !f.utmSource && !f.referrer, points: 3, label: '직접 방문' },
    ],
  },
};

/**
 * 리드 스코어 계산
 */
export function calculateLeadScore(factors: LeadScoreFactors): LeadScoreResult {
  const appliedFactors: LeadScoreResult['factors'] = [];
  let totalScore = 0;

  // 각 카테고리별 점수 계산
  for (const [category, config] of Object.entries(SCORING_RULES)) {
    let categoryPoints = 0;

    for (const rule of config.rules) {
      if (rule.condition(factors) && categoryPoints + rule.points <= config.maxPoints) {
        categoryPoints += rule.points;
        appliedFactors.push({
          category,
          label: rule.label,
          points: rule.points,
          maxPoints: config.maxPoints,
        });
      }
    }

    totalScore += categoryPoints;
  }

  // 점수를 0-100으로 정규화
  const maxPossibleScore = Object.values(SCORING_RULES).reduce(
    (sum, config) => sum + config.maxPoints,
    0
  );
  const normalizedScore = Math.round((totalScore / maxPossibleScore) * 100);

  // 등급 결정
  let grade: LeadScoreResult['grade'];
  if (normalizedScore >= 70) {
    grade = 'hot';
  } else if (normalizedScore >= 40) {
    grade = 'warm';
  } else {
    grade = 'cold';
  }

  // 추천 사항 생성
  const recommendations = generateRecommendations(factors, normalizedScore);

  return {
    score: normalizedScore,
    grade,
    factors: appliedFactors,
    recommendations,
  };
}

/**
 * 추천 사항 생성
 */
function generateRecommendations(
  factors: LeadScoreFactors,
  score: number
): string[] {
  const recommendations: string[] = [];

  if (score >= 70) {
    recommendations.push('높은 전환 가능성! 빠른 연락을 권장합니다.');
    if (factors.viewedContactPage) {
      recommendations.push('연락처 페이지를 조회했습니다. 즉시 연락하세요.');
    }
  } else if (score >= 40) {
    if (!factors.viewedServicePages) {
      recommendations.push('서비스 페이지를 아직 보지 않았습니다. 리마케팅을 고려하세요.');
    }
    if (factors.pageViewCount < 5) {
      recommendations.push('페이지 탐색이 적습니다. 콘텐츠 추천을 고려하세요.');
    }
  } else {
    if (factors.avgTimeOnPage < 30) {
      recommendations.push('체류 시간이 짧습니다. 랜딩 페이지 개선을 고려하세요.');
    }
    if (!factors.isReturning) {
      recommendations.push('첫 방문자입니다. 리타겟팅 캠페인을 고려하세요.');
    }
  }

  return recommendations;
}

/**
 * 방문자 세션에서 리드 스코어 팩터 추출
 */
export async function extractLeadScoreFactors(
  supabase: any,
  tenantId: string,
  visitorId: string
): Promise<LeadScoreFactors> {
  // 방문자 세션 정보
  const { data: sessions } = await supabase
    .from('visitor_sessions')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('visitor_id', visitorId)
    .order('started_at', { ascending: false });

  const latestSession = sessions?.[0];
  const visitCount = sessions?.length || 1;

  // 페이지뷰 정보
  const { data: pageViews } = await supabase
    .from('page_views')
    .select('*')
    .eq('tenant_id', tenantId)
    .in('session_id', sessions?.map((s: any) => s.id) || []);

  const pageViewCount = pageViews?.length || 0;

  // 평균 체류 시간 및 스크롤 깊이 계산
  let totalTime = 0;
  let totalScroll = 0;
  let timeCount = 0;
  let scrollCount = 0;

  (pageViews || []).forEach((pv: any) => {
    if (pv.time_on_page) {
      totalTime += pv.time_on_page;
      timeCount++;
    }
    if (pv.scroll_depth) {
      totalScroll += pv.scroll_depth;
      scrollCount++;
    }
  });

  // 페이지 유형별 조회 여부
  const pageTypes = new Set((pageViews || []).map((pv: any) => pv.page_type));
  const pagePaths = (pageViews || []).map((pv: any) => pv.page_path);

  return {
    visitCount,
    isReturning: visitCount > 1,
    pageViewCount,
    avgTimeOnPage: timeCount > 0 ? Math.round(totalTime / timeCount) : 0,
    avgScrollDepth: scrollCount > 0 ? Math.round(totalScroll / scrollCount) : 0,

    viewedServicePages: pageTypes.has('service') || pagePaths.some((p: string) => p.includes('/service')),
    viewedCaseStudies: pageTypes.has('case') || pagePaths.some((p: string) => p.includes('/case')),
    viewedBlogPosts: (pageViews || []).filter((pv: any) => pv.page_type === 'blog').length,
    viewedFAQ: pageTypes.has('faq') || pagePaths.some((p: string) => p.includes('/faq')),
    viewedContactPage: pagePaths.some((p: string) => p.includes('/contact') || p.includes('/consultation')),

    utmSource: latestSession?.utm_source,
    utmMedium: latestSession?.utm_medium,
    referrer: latestSession?.referrer,

    deviceType: latestSession?.device_type || 'desktop',
  };
}

/**
 * 리드 스코어 등급 라벨
 */
export const GRADE_LABELS = {
  hot: { label: 'Hot', color: 'red', description: '높은 전환 가능성' },
  warm: { label: 'Warm', color: 'amber', description: '관심 있는 방문자' },
  cold: { label: 'Cold', color: 'blue', description: '탐색 중인 방문자' },
};
