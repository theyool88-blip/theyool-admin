/**
 * 홈페이지 성공사례 상세 공개 API
 * GET /api/public/cases/[slug] - 성공사례 상세 조회
 */

import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  withPublicApi,
  handleCorsOptions,
  successResponse,
  errorResponse,
  PublicApiContext,
} from '@/lib/api/public-api';

const getServiceClient = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false },
    }
  );
};

// slug 추출을 위한 래퍼
function createHandler(slug: string) {
  return withPublicApi(
    async (request: NextRequest, context: PublicApiContext) => {
      const supabase = getServiceClient();

      // 성공사례 조회
      const { data: caseData, error } = await supabase
        .from('homepage_cases')
        .select(
          `
          id,
          slug,
          title,
          content,
          summary,
          cover_image,
          category,
          case_type,
          result,
          result_details,
          tags,
          meta_title,
          meta_description,
          published_at,
          views
        `
        )
        .eq('tenant_id', context.tenantId)
        .eq('slug', slug)
        .eq('status', 'published')
        .single();

      if (error || !caseData) {
        return errorResponse('성공사례를 찾을 수 없습니다.', 404);
      }

      // 조회수 증가 (비동기로 처리)
      void supabase
        .from('homepage_cases')
        .update({ views: (caseData.views || 0) + 1 })
        .eq('id', caseData.id)
        .then(() => {}, console.error);

      // 관련 사례 조회 (같은 카테고리)
      const { data: relatedCases } = await supabase
        .from('homepage_cases')
        .select('id, slug, title, summary, cover_image, result, published_at')
        .eq('tenant_id', context.tenantId)
        .eq('status', 'published')
        .eq('category', caseData.category)
        .neq('id', caseData.id)
        .order('published_at', { ascending: false })
        .limit(4);

      return successResponse({
        data: {
          ...caseData,
          relatedCases: relatedCases || [],
        },
      });
    },
    { rateLimit: 100 }
  );
}

// GET 핸들러
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const handler = createHandler(slug);
  return handler(request);
}

// CORS Preflight
export const OPTIONS = handleCorsOptions;
