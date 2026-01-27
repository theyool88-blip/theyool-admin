/**
 * GET/PUT/PATCH/DELETE /api/admin/homepage/faqs/[id]
 * FAQ 상세 조회, 수정, 삭제
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
        { success: false, error: 'FAQ ID가 필요합니다.' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const { data, error } = await supabase
      .from('homepage_faqs')
      .select('*')
      .eq('tenant_id', tenant.tenantId)
      .eq('id', id)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { success: false, error: 'FAQ를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: transformFaq(data),
    });
  } catch (error) {
    console.error('FAQ get error:', error);
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
        { success: false, error: 'FAQ ID가 필요합니다.' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const supabase = await createClient();

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (body.question !== undefined) updateData.question = body.question;
    if (body.answer !== undefined) updateData.answer = body.answer;
    if (body.category !== undefined) updateData.category = body.category;
    if (body.sort_order !== undefined) updateData.sort_order = body.sort_order;
    if (body.published !== undefined) updateData.status = body.published ? 'published' : 'draft';

    const { data, error } = await supabase
      .from('homepage_faqs')
      .update(updateData)
      .eq('tenant_id', tenant.tenantId)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('FAQ update error:', error);
      return NextResponse.json(
        { success: false, error: 'FAQ 수정에 실패했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('FAQ update error:', error);
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
});

// 부분 수정 (게시 상태 토글 등)
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
        { success: false, error: 'FAQ ID가 필요합니다.' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const supabase = await createClient();

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (body.published !== undefined) updateData.status = body.published ? 'published' : 'draft';
    if (body.sort_order !== undefined) updateData.sort_order = body.sort_order;

    const { data, error } = await supabase
      .from('homepage_faqs')
      .update(updateData)
      .eq('tenant_id', tenant.tenantId)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('FAQ patch error:', error);
      return NextResponse.json(
        { success: false, error: 'FAQ 수정에 실패했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('FAQ patch error:', error);
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
        { success: false, error: 'FAQ ID가 필요합니다.' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const { error } = await supabase
      .from('homepage_faqs')
      .delete()
      .eq('tenant_id', tenant.tenantId)
      .eq('id', id);

    if (error) {
      console.error('FAQ delete error:', error);
      return NextResponse.json(
        { success: false, error: 'FAQ 삭제에 실패했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'FAQ가 삭제되었습니다.',
    });
  } catch (error) {
    console.error('FAQ delete error:', error);
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
});
