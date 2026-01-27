/**
 * GET/POST /api/admin/homepage/blog
 * 블로그 목록 조회 및 생성
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withHomepage } from '@/lib/api/with-homepage';

// 프론트엔드 필드 형식으로 변환
function transformBlogPost(item: any) {
  return {
    ...item,
    featured_image: item.cover_image,
    published: item.status === 'published',
    views: item.view_count || 0,
  };
}

// 목록 조회
export const GET = withHomepage(async (request, { tenant }) => {
  try {
    if (!tenant.tenantId) {
      return NextResponse.json(
        { success: false, error: '테넌트 정보가 없습니다.' },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const published = searchParams.get('published');
    const search = searchParams.get('search');
    const category = searchParams.get('category');

    const supabase = await createClient();

    let query = supabase
      .from('homepage_blog_posts')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenant.tenantId)
      .order('created_at', { ascending: false });

    // 필터 적용 (status 컬럼 사용: 'draft', 'published', 'archived')
    if (published === 'true') {
      query = query.eq('status', 'published');
    } else if (published === 'false') {
      query = query.neq('status', 'published');
    }

    if (search) {
      query = query.or(`title.ilike.%${search}%,content.ilike.%${search}%`);
    }

    if (category) {
      query = query.eq('category', category);
    }

    // 페이지네이션
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      console.error('Blog fetch error:', error);
      return NextResponse.json(
        { success: false, error: '블로그를 불러오는데 실패했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: data?.map(transformBlogPost) || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    console.error('Blog list error:', error);
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
});

// 새 블로그 생성
export const POST = withHomepage(async (request, { tenant }) => {
  try {
    if (!tenant.tenantId) {
      return NextResponse.json(
        { success: false, error: '테넌트 정보가 없습니다.' },
        { status: 400 }
      );
    }

    const body = await request.json();

    // 필수 필드 검증
    if (!body.title?.trim()) {
      return NextResponse.json(
        { success: false, error: '제목을 입력해주세요.' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Slug 생성 (중복 체크 포함)
    let slug = body.slug || body.title.toLowerCase()
      .replace(/[^가-힣a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    const { data: existingSlug } = await supabase
      .from('homepage_blog_posts')
      .select('id')
      .eq('tenant_id', tenant.tenantId)
      .eq('slug', slug)
      .single();

    if (existingSlug) {
      slug = `${slug}-${Date.now()}`;
    }

    const { data, error } = await supabase
      .from('homepage_blog_posts')
      .insert({
        tenant_id: tenant.tenantId,
        title: body.title,
        slug,
        content: body.content || '',
        excerpt: body.excerpt || '',
        category: body.category || null,
        tags: body.tags || [],
        cover_image: body.featured_image || null,
        author_name: body.author_name || null,
        status: body.published ? 'published' : 'draft',
        published_at: body.published ? new Date().toISOString() : null,
        meta_title: body.meta_title || body.title,
        meta_description: body.meta_description || body.excerpt,
      })
      .select()
      .single();

    if (error) {
      console.error('Blog create error:', error);
      return NextResponse.json(
        { success: false, error: '블로그 생성에 실패했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Blog create error:', error);
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
});
