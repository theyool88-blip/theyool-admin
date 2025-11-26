import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth/auth';
import { getDetailedConsultationStats } from '@/lib/supabase/consultations';

/**
 * GET /api/admin/consultations/stats
 * Get detailed consultation statistics for stats page
 */
export async function GET() {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const stats = await getDetailedConsultationStats();

    return NextResponse.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error fetching consultation stats:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch consultation stats';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
