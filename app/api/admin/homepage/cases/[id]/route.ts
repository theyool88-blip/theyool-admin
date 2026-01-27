/**
 * GET/PUT/PATCH/DELETE /api/admin/homepage/cases/[id]
 * 성공사례 상세 조회, 수정, 삭제
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

// 상세 조회
export const GET = withHomepage(async (_request, { tenant, params }) => {
  try {
    if (!tenant.tenantId) {
      return NextResponse.json(
        { success: false, error: '테넌트 정보가 없습니다.' },
        { status: 400 }
      );
    }

    const id = params?.id;
    if (!id) {
      return NextResponse.json(
        { success: false, error: '성공사례 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const { data, error } = await supabase
      .from('homepage_cases')
      .select('*')
      .eq('tenant_id', tenant.tenantId)
      .eq('id', id)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { success: false, error: '성공사례를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: transformCase(data),
    });
  } catch (error) {
    console.error('Case get error:', error);
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
});

// 수정
export const PUT = withHomepage(async (request, { tenant, params }) => {
  try {
    if (!tenant.tenantId) {
      return NextResponse.json(
        { success: false, error: '테넌트 정보가 없습니다.' },
        { status: 400 }
      );
    }

    const id = params?.id;
    if (!id) {
      return NextResponse.json(
        { success: false, error: '성공사례 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const supabase = await createClient();

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (body.title !== undefined) updateData.title = body.title;
    if (body.slug !== undefined) updateData.slug = body.slug;
    if (body.badge !== undefined) updateData.category = body.badge;
    if (body.categories !== undefined) updateData.tags = body.categories;
    if (body.background !== undefined) updateData.content = body.background;
    if (body.strategy !== undefined) updateData.summary = body.strategy;
    if (body.result !== undefined) updateData.result = body.result;
    if (body.image_url !== undefined) updateData.cover_image = body.image_url;
    if (body.published !== undefined) {
      updateData.status = body.published ? 'published' : 'draft';
      if (body.published) updateData.published_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('homepage_cases')
      .update(updateData)
      .eq('tenant_id', tenant.tenantId)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Case update error:', error);
      return NextResponse.json(
        { success: false, error: '성공사례 수정에 실패했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Case update error:', error);
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
});

// 부분 수정
export const PATCH = withHomepage(async (request, { tenant, params }) => {
  try {
    if (!tenant.tenantId) {
      return NextResponse.json(
        { success: false, error: '테넌트 정보가 없습니다.' },
        { status: 400 }
      );
    }

    const id = params?.id;
    if (!id) {
      return NextResponse.json(
        { success: false, error: '성공사례 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const supabase = await createClient();

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (body.published !== undefined) {
      updateData.status = body.published ? 'published' : 'draft';
      if (body.published) updateData.published_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('homepage_cases')
      .update(updateData)
      .eq('tenant_id', tenant.tenantId)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Case patch error:', error);
      return NextResponse.json(
        { success: false, error: '성공사례 수정에 실패했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Case patch error:', error);
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
});

// 삭제
export const DELETE = withHomepage(async (_request, { tenant, params }) => {
  try {
    if (!tenant.tenantId) {
      return NextResponse.json(
        { success: false, error: '테넌트 정보가 없습니다.' },
        { status: 400 }
      );
    }

    const id = params?.id;
    if (!id) {
      return NextResponse.json(
        { success: false, error: '성공사례 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const { error } = await supabase
      .from('homepage_cases')
      .delete()
      .eq('tenant_id', tenant.tenantId)
      .eq('id', id);

    if (error) {
      console.error('Case delete error:', error);
      return NextResponse.json(
        { success: false, error: '성공사례 삭제에 실패했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '성공사례가 삭제되었습니다.',
    });
  } catch (error) {
    console.error('Case delete error:', error);
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
});
