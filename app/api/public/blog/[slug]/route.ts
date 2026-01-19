/**
 * 홈페이지 블로그 상세 공개 API
 * GET /api/public/blog/[slug] - 블로그 상세 조회
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

// slug 추출을 위한 래퍼
function createHandler(slug: string) {
  return withPublicApi(
    async (request: NextRequest, context: PublicApiContext) => {
      const supabase = getServiceClient();

      // 블로그 조회
      const { data: post, error } = await supabase
        .from('homepage_blog_posts')
        .select(
          `
          id,
          slug,
          title,
          content,
          excerpt,
          cover_image,
          category,
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

      if (error || !post) {
        return errorResponse('블로그 글을 찾을 수 없습니다.', 404);
      }

      // 조회수 증가 (비동기로 처리, 응답에 영향 없음)
      supabase
        .from('homepage_blog_posts')
        .update({ views: (post.views || 0) + 1 })
        .eq('id', post.id)
        .then(() => {})
        .catch(console.error);

      // 관련 글 조회 (같은 카테고리)
      const { data: relatedPosts } = await supabase
        .from('homepage_blog_posts')
        .select('id, slug, title, excerpt, cover_image, published_at')
        .eq('tenant_id', context.tenantId)
        .eq('status', 'published')
        .eq('category', post.category)
        .neq('id', post.id)
        .order('published_at', { ascending: false })
        .limit(4);

      return successResponse({
        data: {
          ...post,
          relatedPosts: relatedPosts || [],
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
