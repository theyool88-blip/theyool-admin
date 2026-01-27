/**
 * GET/POST /api/admin/homepage/faqs
 * FAQ 목록 조회 및 생성
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withHomepage } from '@/lib/api/with-homepage';

// 프론트엔드 필드 형식으로 변환
function transformFaq(item: any) {
  return {
    ...item,
    published: item.status === 'published',
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
    const limit = parseInt(searchParams.get('limit') || '50');
    const published = searchParams.get('published');
    const category = searchParams.get('category');

    const supabase = await createClient();

    let query = supabase
      .from('homepage_faqs')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenant.tenantId)
      .order('category', { ascending: true })
      .order('sort_order', { ascending: true });

    // status 컬럼 사용: 'draft', 'published', 'archived'
    if (published === 'true') {
      query = query.eq('status', 'published');
    } else if (published === 'false') {
      query = query.neq('status', 'published');
    }

    if (category) {
      query = query.eq('category', category);
    }

    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      console.error('FAQ fetch error:', error);
      return NextResponse.json(
        { success: false, error: 'FAQ를 불러오는데 실패했습니다.' },
        { status: 500 }
      );
    }

    // 변환 적용
    const transformedData = data?.map(transformFaq) || [];

    // 카테고리별로 그룹화
    const grouped = transformedData.reduce((acc, faq) => {
      const cat = faq.category || '일반';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(faq);
      return acc;
    }, {} as Record<string, typeof transformedData>);

    return NextResponse.json({
      success: true,
      data: transformedData,
      grouped,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    console.error('FAQ list error:', error);
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
});

// 새 FAQ 생성
export const POST = withHomepage(async (request, { tenant }) => {
  try {
    if (!tenant.tenantId) {
      return NextResponse.json(
        { success: false, error: '테넌트 정보가 없습니다.' },
        { status: 400 }
      );
    }

    const body = await request.json();

    if (!body.question?.trim()) {
      return NextResponse.json(
        { success: false, error: '질문을 입력해주세요.' },
        { status: 400 }
      );
    }

    if (!body.answer?.trim()) {
      return NextResponse.json(
        { success: false, error: '답변을 입력해주세요.' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // 현재 카테고리의 마지막 sort_order 조회
    const { data: lastOrder } = await supabase
      .from('homepage_faqs')
      .select('sort_order')
      .eq('tenant_id', tenant.tenantId)
      .eq('category', body.category || '일반')
      .order('sort_order', { ascending: false })
      .limit(1)
      .single();

    const { data, error } = await supabase
      .from('homepage_faqs')
      .insert({
        tenant_id: tenant.tenantId,
        question: body.question,
        answer: body.answer,
        category: body.category || '일반',
        sort_order: (lastOrder?.sort_order || 0) + 1,
        status: body.published ? 'published' : 'draft',
      })
      .select()
      .single();

    if (error) {
      console.error('FAQ create error:', error);
      return NextResponse.json(
        { success: false, error: 'FAQ 생성에 실패했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('FAQ create error:', error);
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
});
