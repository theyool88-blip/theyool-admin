/**
 * Consultation Sources API - List and Create
 * 상담 유입 경로 관리 API
 */

import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth/auth';
import { createClient } from '@/lib/supabase/server';
import type { CreateConsultationSourceInput } from '@/types/consultation-source';

/**
 * GET /api/admin/consultation-sources
 * Get all consultation sources
 */
export async function GET(request: NextRequest) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get('active_only') === 'true';

    let query = supabase
      .from('consultation_sources')
      .select('*')
      .order('display_order', { ascending: true });

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    const { data: sources, error } = await query;

    if (error) {
      console.error('Error fetching consultation sources:', error);
      throw error;
    }

    return NextResponse.json({
      success: true,
      data: sources,
      count: sources?.length || 0,
    });
  } catch (error) {
    console.error('Error in GET /api/admin/consultation-sources:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch consultation sources';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/consultation-sources
 * Create a new consultation source
 */
export async function POST(request: NextRequest) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: CreateConsultationSourceInput = await request.json();

    // Validation
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

    const supabase = await createClient();

    // Check for duplicate name
    const { data: existing } = await supabase
      .from('consultation_sources')
      .select('id')
      .eq('name', body.name.trim())
      .single();

    if (existing) {
      return NextResponse.json(
        { error: '이미 존재하는 유입 경로입니다.' },
        { status: 409 }
      );
    }

    // If this is set as default, unset other defaults
    if (body.is_default) {
      await supabase
        .from('consultation_sources')
        .update({ is_default: false })
        .eq('is_default', true);
    }

    // Create new source
    const { data: newSource, error } = await supabase
      .from('consultation_sources')
      .insert([{
        name: body.name.trim(),
        display_order: body.display_order ?? 0,
        color: body.color ?? 'gray',
        is_active: body.is_active ?? true,
        is_default: body.is_default ?? false,
        description: body.description || null,
      }])
      .select()
      .single();

    if (error) {
      console.error('Error creating consultation source:', error);
      throw error;
    }

    return NextResponse.json({
      success: true,
      data: newSource,
      message: '유입 경로가 추가되었습니다.',
    }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/admin/consultation-sources:', error);
    const message = error instanceof Error ? error.message : 'Failed to create consultation source';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
