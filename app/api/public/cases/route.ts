/**
 * 홈페이지 성공사례 공개 API
 * GET /api/public/cases - 성공사례 목록 조회
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

// GET - 성공사례 목록 조회
export const GET = withPublicApi(
  async (request: NextRequest, context: PublicApiContext) => {
    const supabase = getServiceClient();
    const { searchParams } = new URL(request.url);

    // 쿼리 파라미터
    const category = searchParams.get('category');
    const caseType = searchParams.get('case_type');
    const result = searchParams.get('result');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') || '10', 10), 50);
    const offset = (page - 1) * limit;

    // 기본 쿼리
    let query = supabase
      .from('homepage_cases')
      .select(
        `
        id,
        slug,
        title,
        summary,
        cover_image,
        category,
        case_type,
        result,
        tags,
        published_at,
        views
      `,
        { count: 'exact' }
      )
      .eq('tenant_id', context.tenantId)
      .eq('status', 'published')
      .order('published_at', { ascending: false });

    // 필터 적용
    if (category) {
      query = query.eq('category', category);
    }

    if (caseType) {
      query = query.eq('case_type', caseType);
    }

    if (result) {
      query = query.eq('result', result);
    }

    if (search) {
      query = query.or(`title.ilike.%${search}%,summary.ilike.%${search}%`);
    }

    // 페이지네이션
    query = query.range(offset, offset + limit - 1);

    const { data: cases, error, count } = await query;

    if (error) {
      console.error('Failed to fetch cases:', error);
      return errorResponse('성공사례 목록을 가져올 수 없습니다.', 500);
    }

    return successResponse({
      data: cases || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  },
  { rateLimit: 100 }
);

// CORS Preflight
export const OPTIONS = handleCorsOptions;
