/**
 * Consultation Sources API - Detail Routes
 * 상담 유입 경로 상세 API
 */

import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth/auth';
import { createClient } from '@/lib/supabase/server';
import type { UpdateConsultationSourceInput } from '@/types/consultation-source';

/**
 * GET /api/admin/consultation-sources/[id]
 * Get a single consultation source
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const supabase = await createClient();

    const { data: source, error } = await supabase
      .from('consultation_sources')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !source) {
      return NextResponse.json(
        { error: '유입 경로를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: source,
    });
  } catch (error) {
    console.error('Error fetching consultation source:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch consultation source';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/consultation-sources/[id]
 * Update a consultation source
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body: UpdateConsultationSourceInput = await request.json();

    // Validation
    if (body.name !== undefined) {
      if (!body.name || body.name.trim().length === 0) {
        return NextResponse.json(
          { error: '유입 경로 이름을 입력해주세요.' },
          { status: 400 }
        );
      }

      if (body.name.length > 50) {
        return NextResponse.json(
          { error: '유입 경로 이름은 50자 이하여야 합니다.' },
          { status: 400 }
        );
      }
    }

    const supabase = await createClient();

    // Check if source exists
    const { data: existing } = await supabase
      .from('consultation_sources')
      .select('*')
      .eq('id', id)
      .single();

    if (!existing) {
      return NextResponse.json(
        { error: '유입 경로를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // Check for duplicate name (if name is being changed)
    if (body.name && body.name !== existing.name) {
      const { data: duplicate } = await supabase
        .from('consultation_sources')
        .select('id')
        .eq('name', body.name.trim())
        .neq('id', id)
        .single();

      if (duplicate) {
        return NextResponse.json(
          { error: '이미 존재하는 유입 경로입니다.' },
          { status: 409 }
        );
      }
    }

    // If this is being set as default, unset other defaults
    if (body.is_default === true) {
      await supabase
        .from('consultation_sources')
        .update({ is_default: false })
        .eq('is_default', true)
        .neq('id', id);
    }

    // Update source
    const updateData: any = {};
    if (body.name !== undefined) updateData.name = body.name.trim();
    if (body.display_order !== undefined) updateData.display_order = body.display_order;
    if (body.color !== undefined) updateData.color = body.color;
    if (body.is_active !== undefined) updateData.is_active = body.is_active;
    if (body.is_default !== undefined) updateData.is_default = body.is_default;
    if (body.description !== undefined) updateData.description = body.description;

    const { data: updated, error } = await supabase
      .from('consultation_sources')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating consultation source:', error);
      throw error;
    }

    return NextResponse.json({
      success: true,
      data: updated,
      message: '유입 경로가 수정되었습니다.',
    });
  } catch (error) {
    console.error('Error in PATCH /api/admin/consultation-sources/[id]:', error);
    const message = error instanceof Error ? error.message : 'Failed to update consultation source';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/consultation-sources/[id]
 * Delete a consultation source
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const supabase = await createClient();

    // Check if source is being used
    const { data: source } = await supabase
      .from('consultation_sources')
      .select('name, usage_count')
      .eq('id', id)
      .single();

    if (!source) {
      return NextResponse.json(
        { error: '유입 경로를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    if (source.usage_count > 0) {
      // Don't delete if it's being used, just deactivate
      const { data: updated, error } = await supabase
        .from('consultation_sources')
        .update({ is_active: false })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      return NextResponse.json({
        success: true,
        data: updated,
        message: `'${source.name}'은(는) 사용 중이므로 비활성화되었습니다. (사용 횟수: ${source.usage_count}건)`,
        deactivated: true,
      });
    }

    // If not being used, actually delete
    const { error } = await supabase
      .from('consultation_sources')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting consultation source:', error);
      throw error;
    }

    return NextResponse.json({
      success: true,
      message: '유입 경로가 삭제되었습니다.',
      deleted: true,
    });
  } catch (error) {
    console.error('Error in DELETE /api/admin/consultation-sources/[id]:', error);
    const message = error instanceof Error ? error.message : 'Failed to delete consultation source';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
