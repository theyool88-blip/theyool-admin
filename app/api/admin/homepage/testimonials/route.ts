/**
 * GET/POST /api/admin/homepage/testimonials
 * 후기 목록 조회 및 생성
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withHomepage } from '@/lib/api/with-homepage';

// 프론트엔드 필드 형식으로 변환
function transformTestimonial(item: any) {
  const bgColors = [
    'from-slate-500 to-slate-700',
    'from-stone-400 to-stone-600',
    'from-zinc-400 to-zinc-600',
    'from-sage-400 to-sage-600',
  ];
  return {
    ...item,
    client_name: item.client_display_name,
    content: item.testimonial_text,
    published: item.status === 'published',
    display_order: item.sort_order,
    client_initial: item.client_display_name?.charAt(0)?.toUpperCase() || '?',
    avatar_bg_color: bgColors[item.id?.charCodeAt(0) % bgColors.length] || bgColors[0],
    avatar_text_color: 'text-white',
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
    const featured = searchParams.get('featured');

    const supabase = await createClient();

    let query = supabase
      .from('homepage_testimonials')
      .select('*, homepage_testimonial_photos(*)', { count: 'exact' })
      .eq('tenant_id', tenant.tenantId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });

    // status 컬럼 사용: 'pending', 'approved', 'rejected', 'published'
    if (published === 'true') {
      query = query.eq('status', 'published');
    } else if (published === 'false') {
      query = query.neq('status', 'published');
    }

    if (featured === 'true') {
      query = query.eq('featured', true);
    }

    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      console.error('Testimonials fetch error:', error);
      return NextResponse.json(
        { success: false, error: '후기를 불러오는데 실패했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: data?.map(transformTestimonial) || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    console.error('Testimonials list error:', error);
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
});

// 새 후기 생성
export const POST = withHomepage(async (request, { tenant }) => {
  try {
    if (!tenant.tenantId) {
      return NextResponse.json(
        { success: false, error: '테넌트 정보가 없습니다.' },
        { status: 400 }
      );
    }

    const body = await request.json();

    if (!body.client_name?.trim()) {
      return NextResponse.json(
        { success: false, error: '의뢰인 이름을 입력해주세요.' },
        { status: 400 }
      );
    }

    if (!body.content?.trim()) {
      return NextResponse.json(
        { success: false, error: '후기 내용을 입력해주세요.' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // 마지막 sort_order 조회
    const { data: lastOrder } = await supabase
      .from('homepage_testimonials')
      .select('sort_order')
      .eq('tenant_id', tenant.tenantId)
      .order('sort_order', { ascending: false })
      .limit(1)
      .single();

    // 아바타 컬러 생성
    const bgColors = [
      'from-blue-400 to-blue-600',
      'from-green-400 to-green-600',
      'from-purple-400 to-purple-600',
      'from-pink-400 to-pink-600',
      'from-yellow-400 to-yellow-600',
      'from-indigo-400 to-indigo-600',
    ];
    const avatarBgColor = body.avatar_bg_color || bgColors[Math.floor(Math.random() * bgColors.length)];

    const { data, error } = await supabase
      .from('homepage_testimonials')
      .insert({
        tenant_id: tenant.tenantId,
        client_display_name: body.client_name,
        case_type: body.case_type || '이혼',
        testimonial_text: body.content,
        rating: body.rating || 5,
        verified: body.verified ?? false,
        consent_given: body.consent_given ?? true,
        status: body.published ? 'published' : 'pending',
        published_at: body.published ? new Date().toISOString() : null,
        featured: body.featured ?? false,
        sort_order: (lastOrder?.sort_order || 0) + 1,
      })
      .select()
      .single();

    if (error) {
      console.error('Testimonial create error:', error);
      return NextResponse.json(
        { success: false, error: '후기 생성에 실패했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Testimonial create error:', error);
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
});
