/**
 * GET/PUT/DELETE /api/admin/homepage/blog/[id]
 * 블로그 상세 조회, 수정, 삭제
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withHomepage } from '@/lib/api/with-homepage';

interface BlogPostData {
  id: string;
  tenant_id: string;
  title: string;
  slug: string;
  content: string;
  excerpt?: string;
  category?: string;
  tags?: string[];
  cover_image?: string;
  author_name?: string;
  status: string;
  published_at?: string;
  view_count?: number;
  meta_title?: string;
  meta_description?: string;
  created_at: string;
  updated_at: string;
}

// 프론트엔드 필드 형식으로 변환
function transformBlogPost(item: BlogPostData) {
  return {
    ...item,
    featured_image: item.cover_image,
    published: item.status === 'published',
    views: item.view_count || 0,
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
        { success: false, error: '블로그 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const { data, error } = await supabase
      .from('homepage_blog_posts')
      .select('*')
      .eq('tenant_id', tenant.tenantId)
      .eq('id', id)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { success: false, error: '블로그를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: transformBlogPost(data),
    });
  } catch (error) {
    console.error('Blog get error:', error);
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
        { success: false, error: '블로그 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const supabase = await createClient();

    // 기존 데이터 확인
    const { data: existing } = await supabase
      .from('homepage_blog_posts')
      .select('id, status')
      .eq('tenant_id', tenant.tenantId)
      .eq('id', id)
      .single();

    if (!existing) {
      return NextResponse.json(
        { success: false, error: '블로그를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {};

    if (body.title !== undefined) updateData.title = body.title;
    if (body.slug !== undefined) updateData.slug = body.slug;
    if (body.content !== undefined) updateData.content = body.content;
    if (body.excerpt !== undefined) updateData.excerpt = body.excerpt;
    if (body.category !== undefined) updateData.category = body.category;
    if (body.tags !== undefined) updateData.tags = body.tags;
    if (body.featured_image !== undefined) updateData.cover_image = body.featured_image;
    if (body.author_name !== undefined) updateData.author_name = body.author_name;
    if (body.meta_title !== undefined) updateData.meta_title = body.meta_title;
    if (body.meta_description !== undefined) updateData.meta_description = body.meta_description;

    // 게시 상태 변경 시 published_at 업데이트 (status 컬럼 사용)
    if (body.published !== undefined) {
      updateData.status = body.published ? 'published' : 'draft';
      if (body.published && existing.status !== 'published') {
        updateData.published_at = new Date().toISOString();
      }
    }

    const { data, error } = await supabase
      .from('homepage_blog_posts')
      .update(updateData)
      .eq('tenant_id', tenant.tenantId)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Blog update error:', error);
      return NextResponse.json(
        { success: false, error: '블로그 수정에 실패했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Blog update error:', error);
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
        { success: false, error: '블로그 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const { error } = await supabase
      .from('homepage_blog_posts')
      .delete()
      .eq('tenant_id', tenant.tenantId)
      .eq('id', id);

    if (error) {
      console.error('Blog delete error:', error);
      return NextResponse.json(
        { success: false, error: '블로그 삭제에 실패했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '블로그가 삭제되었습니다.',
    });
  } catch (error) {
    console.error('Blog delete error:', error);
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
});

// PATCH for partial updates (e.g., toggle published)
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
        { success: false, error: '블로그 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const supabase = await createClient();

    // 기존 데이터 확인
    const { data: existing } = await supabase
      .from('homepage_blog_posts')
      .select('id, status')
      .eq('tenant_id', tenant.tenantId)
      .eq('id', id)
      .single();

    if (!existing) {
      return NextResponse.json(
        { success: false, error: '블로그를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {};

    // 게시 상태 토글 (status 컬럼 사용)
    if (body.published !== undefined) {
      updateData.status = body.published ? 'published' : 'draft';
      if (body.published && existing.status !== 'published') {
        updateData.published_at = new Date().toISOString();
      }
    }

    const { data, error } = await supabase
      .from('homepage_blog_posts')
      .update(updateData)
      .eq('tenant_id', tenant.tenantId)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Blog patch error:', error);
      return NextResponse.json(
        { success: false, error: '블로그 수정에 실패했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Blog patch error:', error);
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
});
