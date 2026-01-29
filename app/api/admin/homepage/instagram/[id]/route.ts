/**
 * GET/PUT/PATCH/DELETE /api/admin/homepage/instagram/[id]
 * Instagram 포스트 상세 조회, 수정, 삭제
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withHomepage } from '@/lib/api/with-homepage';

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
        { success: false, error: 'Instagram 포스트 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const { data, error } = await supabase
      .from('homepage_instagram_posts')
      .select('*')
      .eq('tenant_id', tenant.tenantId)
      .eq('id', id)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { success: false, error: 'Instagram 포스트를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Instagram get error:', error);
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
        { success: false, error: 'Instagram 포스트 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const supabase = await createClient();

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (body.post_url !== undefined) updateData.permalink = body.post_url;
    if (body.media_url !== undefined) updateData.media_url = body.media_url;
    if (body.thumbnail_url !== undefined) updateData.thumbnail_url = body.thumbnail_url;
    if (body.caption !== undefined) updateData.caption = body.caption;
    if (body.media_type !== undefined) updateData.media_type = body.media_type;
    if (body.published !== undefined) updateData.is_visible = body.published;
    if (body.sort_order !== undefined) updateData.sort_order = body.sort_order;

    const { data, error } = await supabase
      .from('homepage_instagram_posts')
      .update(updateData)
      .eq('tenant_id', tenant.tenantId)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Instagram update error:', error);
      return NextResponse.json(
        { success: false, error: 'Instagram 포스트 수정에 실패했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Instagram update error:', error);
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
        { success: false, error: 'Instagram 포스트 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const supabase = await createClient();

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (body.published !== undefined) updateData.is_visible = body.published;
    if (body.sort_order !== undefined) updateData.sort_order = body.sort_order;

    const { data, error } = await supabase
      .from('homepage_instagram_posts')
      .update(updateData)
      .eq('tenant_id', tenant.tenantId)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Instagram patch error:', error);
      return NextResponse.json(
        { success: false, error: 'Instagram 포스트 수정에 실패했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Instagram patch error:', error);
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
        { success: false, error: 'Instagram 포스트 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const { error } = await supabase
      .from('homepage_instagram_posts')
      .delete()
      .eq('tenant_id', tenant.tenantId)
      .eq('id', id);

    if (error) {
      console.error('Instagram delete error:', error);
      return NextResponse.json(
        { success: false, error: 'Instagram 포스트 삭제에 실패했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Instagram 포스트가 삭제되었습니다.',
    });
  } catch (error) {
    console.error('Instagram delete error:', error);
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
});
