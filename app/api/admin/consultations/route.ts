/**
 * Admin Consultations API
 * ADMIN ONLY - Requires authentication (테넌트 격리)
 */

import { NextResponse } from 'next/server';
import { withTenant } from '@/lib/api/with-tenant';
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
 * Get all consultations with filters (테넌트 격리)
 */
export const GET = withTenant(async (request, { tenant }) => {
  try {
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

    // Get consultations (테넌트 ID 전달)
    const consultations = await getConsultations(filters, tenant.isSuperAdmin ? undefined : tenant.tenantId);

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
})
