/**
 * GET/POST /api/admin/homepage/cases
 * 성공사례 목록 조회 및 생성
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withHomepage } from '@/lib/api/with-homepage';

// 프론트엔드 필드 형식으로 변환
function transformCase(item: any) {
  return {
    ...item,
    badge: item.category,
    categories: item.tags || [],
    background: item.content,
    strategy: item.summary,
    icon: item.icon || '',
    image_url: item.cover_image,
    published: item.status === 'published',
    views: item.view_count || 0,
    sort_order: null, // 테이블에 없음
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
      .from('homepage_cases')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenant.tenantId)
      .order('created_at', { ascending: false });

    // status 컬럼 사용: 'draft', 'published', 'archived'
    if (published === 'true') {
      query = query.eq('status', 'published');
    } else if (published === 'false') {
      query = query.neq('status', 'published');
    }

    if (search) {
      query = query.ilike('title', `%${search}%`);
    }

    if (category) {
      query = query.contains('categories', [category]);
    }

    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      console.error('Cases fetch error:', error);
      return NextResponse.json(
        { success: false, error: '성공사례를 불러오는데 실패했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: data?.map(transformCase) || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    console.error('Cases list error:', error);
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
});

// 새 성공사례 생성
export const POST = withHomepage(async (request, { tenant }) => {
  try {
    if (!tenant.tenantId) {
      return NextResponse.json(
        { success: false, error: '테넌트 정보가 없습니다.' },
        { status: 400 }
      );
    }

    const body = await request.json();

    if (!body.title?.trim()) {
      return NextResponse.json(
        { success: false, error: '제목을 입력해주세요.' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Slug 생성
    let slug = body.slug || body.title.toLowerCase()
      .replace(/[^가-힣a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    const { data: existingSlug } = await supabase
      .from('homepage_cases')
      .select('id')
      .eq('tenant_id', tenant.tenantId)
      .eq('slug', slug)
      .single();

    if (existingSlug) {
      slug = `${slug}-${Date.now()}`;
    }

    const { data, error } = await supabase
      .from('homepage_cases')
      .insert({
        tenant_id: tenant.tenantId,
        title: body.title,
        slug,
        category: body.badge || null,
        tags: body.categories || [],
        content: body.background || '',
        summary: body.strategy || '',
        result: body.result || '',
        cover_image: body.image_url || null,
        status: body.published ? 'published' : 'draft',
        published_at: body.published ? new Date().toISOString() : null,
      })
      .select()
      .single();

    if (error) {
      console.error('Case create error:', error);
      return NextResponse.json(
        { success: false, error: '성공사례 생성에 실패했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Case create error:', error);
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
});
