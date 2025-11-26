/**
 * Admin Consultations API - Detail Routes
 * ADMIN ONLY - Requires authentication
 */

import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth/auth';
import {
  getConsultationById,
  updateConsultation,
  deleteConsultation,
} from '@/lib/supabase/consultations';
import { checkScheduleConflicts, shouldAutoConfirm } from '@/lib/consultationScheduling';
import type { UpdateConsultationInput } from '@/types/consultation';

/**
 * GET /api/admin/consultations/[id]
 * Get a single consultation by ID
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
    const consultation = await getConsultationById(id);

    if (!consultation) {
      return NextResponse.json(
        { error: 'Consultation not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: consultation,
    });
  } catch (error) {
    console.error('Error fetching consultation:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch consultation';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/consultations/[id]
 * Update a consultation (ADMIN ONLY)
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
    const body = await request.json();

    console.log(`[ADMIN CONSULTATION UPDATE] ID: ${id}`);
    console.log('[ADMIN CONSULTATION UPDATE] Request body:', body);

    // Get current consultation to check status
    const currentConsultation = await getConsultationById(id);
    if (!currentConsultation) {
      return NextResponse.json(
        { error: '상담을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // No strict Zod validation in admin route - trust admin input
    // But still filter to only allowed fields
    const input: UpdateConsultationInput = {};

    if (body.status !== undefined) input.status = body.status;
    if (body.assigned_lawyer !== undefined) input.assigned_lawyer = body.assigned_lawyer;
    if (body.confirmed_date !== undefined) input.confirmed_date = body.confirmed_date || null;
    if (body.confirmed_time !== undefined) input.confirmed_time = body.confirmed_time || null;
    if (body.video_link !== undefined) input.video_link = body.video_link;
    if (body.admin_notes !== undefined) input.admin_notes = body.admin_notes;
    if (body.cancellation_reason !== undefined) input.cancellation_reason = body.cancellation_reason;
    if (body.office_location !== undefined) input.office_location = body.office_location;
    if (body.consultation_fee !== undefined) input.consultation_fee = body.consultation_fee;
    if (body.payment_method !== undefined) input.payment_method = body.payment_method;
    if (body.payment_status !== undefined) input.payment_status = body.payment_status;
    if (body.payment_transaction_id !== undefined) input.payment_transaction_id = body.payment_transaction_id;
    if (body.case_id !== undefined) input.case_id = body.case_id;
    if (body.source !== undefined) input.source = body.source;

    // Schedule conflict checking when confirmed_date and confirmed_time are being set
    if (input.confirmed_date && input.confirmed_time) {
      const conflicts = await checkScheduleConflicts({
        date: input.confirmed_date,
        time: input.confirmed_time,
        lawyer: input.assigned_lawyer || body.assigned_lawyer || null,
        officeLocation: input.office_location || body.office_location || null,
        excludeId: id, // Exclude current consultation from conflict check
      });

      if (conflicts.length > 0) {
        const conflictDetails = conflicts.map((c) =>
          `${c.name} (${c.phone}) - ${c.assigned_lawyer || '담당자 미지정'}`
        ).join(', ');

        return NextResponse.json(
          {
            error: `선택한 시간에 다른 예약이 있습니다: ${conflictDetails}`,
            conflicts,
          },
          { status: 409 } // Conflict status code
        );
      }

      // Auto-change status to 'confirmed' if currently pending or contacted
      if (!input.status && shouldAutoConfirm(currentConsultation.status)) {
        input.status = 'confirmed';
        console.log('[ADMIN CONSULTATION UPDATE] Auto-changing status to confirmed');
      }
    }

    console.log('[ADMIN CONSULTATION UPDATE] Input to update:', input);

    const consultation = await updateConsultation(id, input);

    console.log('[ADMIN CONSULTATION UPDATE] Updated consultation:', {
      id: consultation.id,
      status: consultation.status,
      updated_at: consultation.updated_at,
    });

    // TODO: Send notifications based on status change
    // - If status changed to 'contacted', send SMS
    // - If status changed to 'confirmed', send confirmation SMS/email
    // - etc.

    return NextResponse.json({
      success: true,
      data: consultation,
      message: '상담 정보가 수정되었습니다',
    });
  } catch (error) {
    console.error('[ADMIN CONSULTATION UPDATE ERROR]:', error);
    const message = error instanceof Error ? error.message : '상담 정보 수정에 실패했습니다';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/consultations/[id]
 * Delete a consultation
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
    await deleteConsultation(id);

    return NextResponse.json({
      success: true,
      message: 'Consultation deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting consultation:', error);
    const message = error instanceof Error ? error.message : 'Failed to delete consultation';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
