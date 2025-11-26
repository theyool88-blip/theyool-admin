/**
 * Admin Consultations API
 * ADMIN ONLY - Requires authentication
 */

import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth/auth';
import { getConsultations } from '@/lib/supabase/consultations';
import type {
  ConsultationFilters,
  RequestType,
  ConsultationStatus,
  LawyerName,
  OfficeLocation,
  PaymentStatus,
} from '@/types/consultation';

/**
 * GET /api/admin/consultations
 * Get all consultations with filters (ADMIN ONLY)
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);

    // Extract filters from query params
    const filters: ConsultationFilters = {
      request_type: (searchParams.get('request_type') as RequestType) || undefined,
      status: (searchParams.get('status') as ConsultationStatus) || undefined,
      assigned_lawyer: (searchParams.get('assigned_lawyer') as LawyerName) || undefined,
      date_from: searchParams.get('date_from') || undefined,
      date_to: searchParams.get('date_to') || undefined,
      office_location: (searchParams.get('office_location') as OfficeLocation) || undefined,
      payment_status: (searchParams.get('payment_status') as PaymentStatus) || undefined,
      search: searchParams.get('search') || undefined,
      source: searchParams.get('source') || undefined,
    };

    // Remove undefined/null values
    Object.keys(filters).forEach((key) => {
      if (filters[key as keyof ConsultationFilters] === null || filters[key as keyof ConsultationFilters] === undefined) {
        delete filters[key as keyof ConsultationFilters];
      }
    });

    // Get consultations
    const consultations = await getConsultations(filters);

    return NextResponse.json({
      success: true,
      data: consultations,
      count: consultations.length,
    });
  } catch (error) {
    console.error('GET /api/admin/consultations error:', error);

    const errorMessage = error instanceof Error ? error.message : '서버 오류가 발생했습니다';

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
