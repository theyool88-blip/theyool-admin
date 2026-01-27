/**
 * GET/POST /api/admin/homepage/instagram
 * Instagram 포스트 목록 조회 및 생성
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withHomepage } from '@/lib/api/with-homepage';

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
    const mediaType = searchParams.get('media_type');

    const supabase = await createClient();

    let query = supabase
      .from('homepage_instagram_posts')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenant.tenantId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });

    // is_visible 컬럼 사용 (boolean)
    if (published === 'true') {
      query = query.eq('is_visible', true);
    } else if (published === 'false') {
      query = query.eq('is_visible', false);
    }

    if (mediaType) {
      query = query.eq('media_type', mediaType);
    }

    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      console.error('Instagram fetch error:', error);
      return NextResponse.json(
        { success: false, error: 'Instagram 포스트를 불러오는데 실패했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    console.error('Instagram list error:', error);
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
});

// 새 Instagram 포스트 생성
export const POST = withHomepage(async (request, { tenant }) => {
  try {
    if (!tenant.tenantId) {
      return NextResponse.json(
        { success: false, error: '테넌트 정보가 없습니다.' },
        { status: 400 }
      );
    }

    const body = await request.json();

    const supabase = await createClient();

    // 마지막 sort_order 조회
    const { data: lastOrder } = await supabase
      .from('homepage_instagram_posts')
      .select('sort_order')
      .eq('tenant_id', tenant.tenantId)
      .order('sort_order', { ascending: false })
      .limit(1)
      .single();

    const { data, error } = await supabase
      .from('homepage_instagram_posts')
      .insert({
        tenant_id: tenant.tenantId,
        instagram_id: body.instagram_id || `manual_${Date.now()}`,
        permalink: body.post_url || null,
        media_url: body.media_url || null,
        thumbnail_url: body.thumbnail_url || body.media_url || null,
        caption: body.caption || '',
        media_type: body.media_type || 'IMAGE',
        is_visible: body.published ?? true,
        sort_order: (lastOrder?.sort_order || 0) + 1,
      })
      .select()
      .single();

    if (error) {
      console.error('Instagram create error:', error);
      return NextResponse.json(
        { success: false, error: 'Instagram 포스트 생성에 실패했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Instagram create error:', error);
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
});
