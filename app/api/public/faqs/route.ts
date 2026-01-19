/**
 * 홈페이지 FAQ 공개 API
 * GET /api/public/faqs - FAQ 목록 조회
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  withPublicApi,
  handleCorsOptions,
  successResponse,
  errorResponse,
  PublicApiContext,
} from '@/lib/api/public-api';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const getServiceClient = () => {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });
};

// GET - FAQ 목록 조회
export const GET = withPublicApi(
  async (request: NextRequest, context: PublicApiContext) => {
    const supabase = getServiceClient();
    const { searchParams } = new URL(request.url);

    // 쿼리 파라미터
    const category = searchParams.get('category');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
    const offset = (page - 1) * limit;

    // 기본 쿼리
    let query = supabase
      .from('homepage_faqs')
      .select(
        `
        id,
        slug,
        question,
        answer,
        category,
        tags,
        sort_order
      `,
        { count: 'exact' }
      )
      .eq('tenant_id', context.tenantId)
      .eq('status', 'published')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });

    // 필터 적용
    if (category) {
      query = query.eq('category', category);
    }

    if (search) {
      query = query.or(`question.ilike.%${search}%,answer.ilike.%${search}%`);
    }

    // 페이지네이션
    query = query.range(offset, offset + limit - 1);

    const { data: faqs, error, count } = await query;

    if (error) {
      console.error('Failed to fetch FAQs:', error);
      return errorResponse('FAQ 목록을 가져올 수 없습니다.', 500);
    }

    // 카테고리별 그룹화 옵션
    const grouped = searchParams.get('grouped') === 'true';

    if (grouped && faqs) {
      const groupedFaqs: Record<string, typeof faqs> = {};
      for (const faq of faqs) {
        const cat = faq.category || '기타';
        if (!groupedFaqs[cat]) {
          groupedFaqs[cat] = [];
        }
        groupedFaqs[cat].push(faq);
      }

      return successResponse({
        data: groupedFaqs,
        categories: Object.keys(groupedFaqs),
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit),
        },
      });
    }

    return successResponse({
      data: faqs || [],
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
