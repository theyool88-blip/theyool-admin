/**
 * Admin Consultations History API
 * Check for previous consultations by phone number
 */

import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth/auth';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/admin/consultations/history?phone=010-1234-5678
 * Get previous consultation history for a phone number
 */
export async function GET(request: NextRequest) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const phone = searchParams.get('phone');

    if (!phone) {
      return NextResponse.json(
        { error: 'Phone number is required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Clean phone number (remove hyphens, spaces, etc.)
    const cleanedPhone = phone.replace(/[-\s()]/g, '');

    // Find all consultations with this phone number
    const { data: consultations, error } = await supabase
      .from('consultations')
      .select('*')
      .or(`phone.eq.${phone},phone.eq.${cleanedPhone}`)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    const isReturningCustomer = (consultations || []).length > 1;
    const previousCount = (consultations || []).length - 1; // Exclude current one

    // Get consultation statistics
    const stats = {
      total_consultations: consultations?.length || 0,
      completed_consultations: consultations?.filter(c => c.status === 'completed').length || 0,
      cancelled_consultations: consultations?.filter(c => c.status === 'cancelled').length || 0,
      total_payments: 0, // Will calculate below
      last_consultation_date: consultations && consultations.length > 0
        ? consultations[0].created_at
        : null,
    };

    // Get total payments for this customer
    const { data: payments, error: paymentsError } = await supabase
      .from('payments')
      .select('amount')
      .in('consultation_id', consultations?.map(c => c.id) || []);

    if (!paymentsError && payments) {
      stats.total_payments = payments.reduce((sum, p) => sum + p.amount, 0);
    }

    return NextResponse.json({
      success: true,
      data: {
        phone,
        is_returning_customer: isReturningCustomer,
        previous_count: previousCount,
        consultations: consultations || [],
        stats,
      },
    });
  } catch (error) {
    console.error('Error fetching consultation history:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch consultation history';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
