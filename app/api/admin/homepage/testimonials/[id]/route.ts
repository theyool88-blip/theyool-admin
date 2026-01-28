/**
 * GET/PUT/PATCH/DELETE /api/admin/homepage/testimonials/[id]
 * 후기 상세 조회, 수정, 삭제
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withHomepage } from '@/lib/api/with-homepage';

interface HomepageTestimonial {
  id: string;
  tenant_id: string;
  client_display_name: string;
  case_type: string;
  testimonial_text: string;
  rating: number;
  verified: boolean;
  consent_given: boolean;
  status: 'pending' | 'approved' | 'rejected' | 'published';
  published_at: string | null;
  featured: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  homepage_testimonial_photos?: unknown[];
}

// 프론트엔드 필드 형식으로 변환
function transformTestimonial(item: HomepageTestimonial) {
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
        { success: false, error: '후기 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const { data, error } = await supabase
      .from('homepage_testimonials')
      .select('*, homepage_testimonial_photos(*)')
      .eq('tenant_id', tenant.tenantId)
      .eq('id', id)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { success: false, error: '후기를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: transformTestimonial(data),
    });
  } catch (error) {
    console.error('Testimonial get error:', error);
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
        { success: false, error: '후기 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const supabase = await createClient();

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (body.client_name !== undefined) updateData.client_display_name = body.client_name;
    if (body.content !== undefined) updateData.testimonial_text = body.content;
    if (body.case_type !== undefined) updateData.case_type = body.case_type;
    if (body.rating !== undefined) updateData.rating = body.rating;
    if (body.verified !== undefined) updateData.verified = body.verified;
    if (body.consent_given !== undefined) updateData.consent_given = body.consent_given;
    if (body.published !== undefined) {
      updateData.status = body.published ? 'published' : 'pending';
      if (body.published) updateData.published_at = new Date().toISOString();
    }
    if (body.featured !== undefined) updateData.featured = body.featured;
    if (body.sort_order !== undefined) updateData.sort_order = body.sort_order;

    const { data, error } = await supabase
      .from('homepage_testimonials')
      .update(updateData)
      .eq('tenant_id', tenant.tenantId)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Testimonial update error:', error);
      return NextResponse.json(
        { success: false, error: '후기 수정에 실패했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Testimonial update error:', error);
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
        { success: false, error: '후기 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const supabase = await createClient();

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (body.published !== undefined) {
      updateData.status = body.published ? 'published' : 'pending';
      if (body.published) updateData.published_at = new Date().toISOString();
    }
    if (body.featured !== undefined) updateData.featured = body.featured;
    if (body.sort_order !== undefined) updateData.sort_order = body.sort_order;

    const { data, error } = await supabase
      .from('homepage_testimonials')
      .update(updateData)
      .eq('tenant_id', tenant.tenantId)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Testimonial patch error:', error);
      return NextResponse.json(
        { success: false, error: '후기 수정에 실패했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Testimonial patch error:', error);
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
        { success: false, error: '후기 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // 연관된 증거 사진도 삭제
    await supabase
      .from('homepage_testimonial_photos')
      .delete()
      .eq('testimonial_id', id);

    const { error } = await supabase
      .from('homepage_testimonials')
      .delete()
      .eq('tenant_id', tenant.tenantId)
      .eq('id', id);

    if (error) {
      console.error('Testimonial delete error:', error);
      return NextResponse.json(
        { success: false, error: '후기 삭제에 실패했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '후기가 삭제되었습니다.',
    });
  } catch (error) {
    console.error('Testimonial delete error:', error);
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
});
