/**
 * Admin Consultation Activities API
 * ADMIN ONLY - Requires authentication
 * Endpoint: GET /api/admin/consultations/[id]/activities
 */

import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth/auth';
import { createClient } from '@/lib/supabase/server';
import type { ConsultationActivity, ActivitySummary } from '@/types/consultation-activity';

/**
 * GET /api/admin/consultations/[id]/activities
 * Get all activity logs for a specific consultation
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
    const { searchParams } = new URL(request.url);
    const includeSummary = searchParams.get('include_summary') === 'true';

    const supabase = await createClient();

    // Fetch activity logs
    const { data: activities, error: activitiesError } = await supabase
      .from('consultation_activity_log')
      .select('*')
      .eq('consultation_id', id)
      .order('created_at', { ascending: false });

    if (activitiesError) {
      throw activitiesError;
    }

    // Optionally fetch summary
    let summary: ActivitySummary | null = null;
    if (includeSummary) {
      const { data: summaryData, error: summaryError } = await supabase
        .rpc('get_consultation_activity_summary', {
          consultation_uuid: id,
        });

      if (!summaryError && summaryData && summaryData.length > 0) {
        summary = summaryData[0];
      }
    }

    return NextResponse.json({
      success: true,
      data: activities as ConsultationActivity[],
      summary,
      count: activities?.length || 0,
    });
  } catch (error) {
    console.error('Error fetching consultation activities:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch activities';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/consultations/[id]/activities
 * Create a manual activity log entry
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    const supabase = await createClient();

    // Validate consultation exists
    const { data: consultation, error: consultationError } = await supabase
      .from('consultations')
      .select('id')
      .eq('id', id)
      .single();

    if (consultationError || !consultation) {
      return NextResponse.json(
        { error: '상담을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // Insert activity log
    const { data: activity, error: insertError } = await supabase
      .from('consultation_activity_log')
      .insert({
        consultation_id: id,
        activity_type: body.activity_type || 'note_added',
        description: body.description,
        field_name: body.field_name || null,
        old_value: body.old_value || null,
        new_value: body.new_value || null,
        actor_type: body.actor_type || 'admin',
        actor_id: body.actor_id || null,
        actor_name: body.actor_name || '관리자',
        metadata: body.metadata || null,
        is_system_generated: false,
      })
      .select()
      .single();

    if (insertError) {
      throw insertError;
    }

    return NextResponse.json({
      success: true,
      data: activity,
      message: '활동 기록이 추가되었습니다.',
    });
  } catch (error) {
    console.error('Error creating activity log:', error);
    const message = error instanceof Error ? error.message : 'Failed to create activity log';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
